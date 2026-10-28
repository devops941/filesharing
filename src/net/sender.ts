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
  fileIndex?: number,
  fileTotal?: number,
): Uint8Array {
  const meta = JSON.stringify({
    fileName: file.name,
    size: file.size,
    mimeType: file.type ?? 'application/octet-stream',
    fileIndex: fileIndex !== undefined ? fileIndex + 1 : 1,
    fileTotal: fileTotal ?? 1,
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
          // BUG-1 FIX: encodeOffer(file, header) — no extra args for single-file
          socket.write(
            frame(T.OFFER, encodeOffer(file, enc.header)),
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
      const total = Math.max(1, Math.ceil(file.size / CHUNK_SIZE));

      await readChunks(
        file.uri,
        async b64 => {
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
      }, file.size);
    }
  });
}

export type SenderFilesUI = {
  confirmCode: (code: string) => Promise<boolean>;
  progress: (fileIndex: number, sent: number, total: number) => void;
  done: () => void;
  rejected: (fileIndex: number, reason: string) => void;
  error: (msg: string) => void;
  cancelled: () => void;
};

export async function sendFiles(
  device: Device,
  files: PickedFile[],
  ui: SenderFilesUI,
  cancelRef?: { cancel: () => void },
): Promise<void> {
  const me = await newSession();

  return new Promise<void>((resolveTransfer, rejectTransfer) => {
    let savedKeys: ReturnType<typeof sessionKeys> | null = null;
    let enc: ReturnType<typeof encryptor> | null = null;
    let fileIdx = 0;
    let inFlight = 0;
    let waitAck: (() => void) | null = null;
    let waitDone: (() => void) | null = null;
    let doneReceived = false;

    function abortWaiters() {
      if (waitAck) {
        waitAck();
        waitAck = null;
      }
      if (waitDone) {
        waitDone();
        waitDone = null;
      }
    }

    let destroyed = false;
    let connectTimeout: ReturnType<typeof setTimeout>;
    const socket = TcpSocket.createConnection(
      { host: device.ip, port: device.port },
      () => {
        clearTimeout(connectTimeout);
        socket.write(frame(T.HELLO, helloPayload(me)));
      },
    );
    if (cancelRef) {
      cancelRef.cancel = () => {
        if (destroyed) return;
        destroyed = true;
        clearTimeout(connectTimeout);
        abortWaiters();
        try {
          socket.write(frame(T.CANCEL));
        } catch {}
        socket.destroy();
        ui.cancelled();
        resolveTransfer();
      };
    }

    connectTimeout = setTimeout(() => {
      if (destroyed) return;
      destroyed = true;
      abortWaiters();
      ui.error(
        `Unable to reach receiver (${device.name || 'Device'} at ${device.ip}:${device.port}).\n\n` +
        `Please ensure both devices have Wi-Fi turned ON, are placed close together, and the receiver screen is open.`,
      );
      socket.destroy();
      rejectTransfer(new Error('Connection timeout'));
    }, 12000);

    const parser = new FrameParser(async (type, p) => {
      try {
        if (type === T.HELLO) {
          const peer = JSON.parse(p.toString('utf8'));
          const peerPub = Buffer.from(peer.publicKey, 'base64');
          savedKeys = sessionKeys('client', me, peerPub);
          const code = verificationCode(me.publicKey, peerPub);
          const ok = await ui.confirmCode(code);
          if (!ok) {
            socket.write(frame(T.CANCEL));
            abortWaiters();
            socket.destroy();
            ui.cancelled();
            resolveTransfer();
            return;
          }
          offerFile(0);
        }

        if (type === T.ACCEPT) {
          streamFile(fileIdx).catch((err: any) => {
            abortWaiters();
            ui.error(err?.message ?? 'Stream error');
            socket.destroy();
            rejectTransfer(err);
          });
        }

        if (type === T.REJECT) {
          abortWaiters();
          ui.rejected(fileIdx, p.toString('utf8'));
          socket.write(frame(T.CANCEL));
          socket.destroy();
          resolveTransfer();
        }

        if (type === T.ACK) {
          inFlight = 0;
          if (waitAck) {
            waitAck();
            waitAck = null;
          }
        }

        if (type === T.DONE) {
          doneReceived = true;
          if (waitDone) {
            waitDone();
            waitDone = null;
          }
        }

        if (type === T.CANCEL) {
          abortWaiters();
          ui.cancelled();
          socket.destroy();
          resolveTransfer();
        }
      } catch (err: any) {
        abortWaiters();
        ui.error(err?.message ?? 'Unknown error');
        socket.destroy();
        rejectTransfer(err);
      }
    });

    socket.on('data', d => parser.push(d as Buffer));
    socket.on('error', err => {
      if (destroyed) return;
      destroyed = true;
      clearTimeout(connectTimeout);
      abortWaiters();
      ui.error(`Connection error: ${err.message}`);
      rejectTransfer(err);
    });
    socket.on('close', () => {
      if (destroyed) return;
      destroyed = true;
      clearTimeout(connectTimeout);
      abortWaiters();
      ui.error('Connection closed by receiver');
      resolveTransfer();
    });

    function offerFile(idx: number) {
      if (!savedKeys) return;
      doneReceived = false;
      enc = encryptor(savedKeys.sharedTx);
      socket.write(frame(T.OFFER, encodeOffer(files[idx], enc.header, idx, files.length)));
    }

    async function streamFile(idx: number) {
      if (!enc) return;
      const file = files[idx];
      let i = 0;
      let sent = 0;
      const total = Math.max(1, Math.ceil(file.size / CHUNK_SIZE));
      inFlight = 0;

      await readChunks(
        file.uri,
        async b64 => {
        const plain = Buffer.from(b64, 'base64');
        const last = ++i === total;
        const cipher = enc!.push(plain, last);
        const chunkFrame = frame(
          T.CHUNK,
          Buffer.concat([u32(i), Buffer.from(cipher)]),
        );
        await writeAsync(socket as any, chunkFrame);
        sent += plain.length;
        ui.progress(idx, sent, file.size);

        if (++inFlight >= ACK_EVERY * 2) {
          // BUG-10 FIX: Removed inner redundant check; just always wait for ACK
          await new Promise<void>(r => {
            waitAck = r;
          });
        }
      }, file.size);

      if (!doneReceived) {
        await new Promise<void>(r => {
          if (doneReceived) {
            r();
          } else {
            waitDone = r;
          }
        });
      }
      doneReceived = false;

      fileIdx++;
      if (fileIdx < files.length) {
        offerFile(fileIdx);
      } else {
        await writeAsync(socket as any, frame(T.FINISH));
        setTimeout(() => {
          try {
            socket.destroy();
          } catch {}
        }, 300);
        ui.done();
        resolveTransfer();
      }
    }
  });
}
