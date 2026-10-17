import TcpSocket from 'react-native-tcp-socket';
import { Buffer } from 'buffer';
import { CHUNK_SIZE, ACK_EVERY } from '../config';
import { T, FrameParser, frame, u32 } from './protocol';
import {
  newSession,
  sessionKeys,
  verificationCode,
  encryptor,
  helloPayload,
} from '../crypto/session';
import { readChunks } from '../files/reader';
import { Device } from './discovery';

export type PickedFile = {
  uri: string;
  name: string;
  size: number;
  type?: string;
};

export type SenderUI = {
  confirmCode: (code: string) => Promise<boolean>;
  progress: (sent: number) => void;
  done: () => void;
  rejected: (reason: string) => void;
  error: (msg: string) => void;
  cancelled: () => void;
};

// Respects TCP backpressure — waits for 'drain' if socket buffer is full
function writeAsync(socket: ReturnType<typeof TcpSocket.createConnection>, data: Buffer): Promise<void> {
  return new Promise<void>(resolve => {
    if ((socket as any).write(data)) {
      resolve();
    } else {
      (socket as any).once('drain', () => resolve());
    }
  });
}

function encodeOffer(
  file: PickedFile,
  header: Uint8Array,
  sharedTx: Uint8Array,
): Uint8Array {
  const meta = JSON.stringify({
    fileName: file.name,
    size: file.size,
    mimeType: file.type ?? 'application/octet-stream',
  });
  return Buffer.concat([Buffer.from(header), Buffer.from(meta, 'utf8')]);
}

export async function sendFile(
  device: Device,
  file: PickedFile,
  ui: SenderUI,
): Promise<void> {
  const me = await newSession();
  let inFlight = 0;
  let waitAck: (() => void) | null = null;

  // Mutable shared state between the parser callback and streamFile
  const state: { enc: ReturnType<typeof encryptor> | null } = { enc: null };

  return new Promise<void>((resolveTransfer, rejectTransfer) => {
    const socket = TcpSocket.createConnection(
      { host: device.ip, port: device.port },
      () => {
        socket.write(frame(T.HELLO, helloPayload(me)));
      },
    );

    const parser = new FrameParser(async (type, p) => {
      try {
        if (type === T.HELLO) {
          const peer = JSON.parse(p.toString('utf8'));
          const peerPub = Buffer.from(peer.publicKey, 'base64');
          const keys = sessionKeys('client', me, peerPub);
          const code = verificationCode(me.publicKey, peerPub);

          const ok = await ui.confirmCode(code);
          if (!ok) {
            socket.write(frame(T.CANCEL));
            socket.destroy();
            ui.cancelled();
            resolveTransfer();
            return;
          }

          const enc = encryptor(keys.sharedTx);
          state.enc = enc;
          socket.write(
            frame(T.OFFER, encodeOffer(file, enc.header, keys.sharedTx)),
          );
        }

        if (type === T.ACCEPT) {
          streamFile();
        }

        if (type === T.ACK) {
          inFlight = 0;
          waitAck?.();
          waitAck = null;
        }

        if (type === T.REJECT) {
          const reason = p.toString('utf8');
          ui.rejected(reason);
          socket.destroy();
          resolveTransfer();
        }

        if (type === T.DONE) {
          ui.done();
          socket.destroy();
          resolveTransfer();
        }

        if (type === T.CANCEL) {
          ui.cancelled();
          socket.destroy();
          resolveTransfer();
        }
      } catch (err: any) {
        ui.error(err?.message ?? 'Unknown error');
        socket.destroy();
        rejectTransfer(err);
      }
    });

    socket.on('data', d => parser.push(d as Buffer));
    socket.on('error', err => {
      ui.error(err.message);
      rejectTransfer(err);
    });

    async function streamFile() {
      if (!state.enc) return;
      let i = 0;
      let sent = 0;
      const total = Math.ceil(file.size / CHUNK_SIZE);

      await readChunks(file.uri, async b64 => {
        const plain = Buffer.from(b64, 'base64');
        const last = ++i === total;
        const cipher = state.enc!.push(plain, last);
        const chunkFrame = frame(
          T.CHUNK,
          Buffer.concat([u32(i), Buffer.from(cipher)]),
        );

        await writeAsync(socket as any, chunkFrame);
        sent += plain.length;
        ui.progress(sent);

        if (++inFlight >= ACK_EVERY * 2) {
          // Sliding window: wait for ACK before sending more
          await new Promise<void>(r => {
            waitAck = r;
          });
        }
      });
    }
  });
}
