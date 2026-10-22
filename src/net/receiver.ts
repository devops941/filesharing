import TcpSocket from 'react-native-tcp-socket';
import * as FileSystem from 'expo-file-system/legacy';
import { Buffer } from 'buffer';
import { PORT, ACK_EVERY } from '../config';
import { T, FrameParser, frame, u32, enc } from './protocol';
import {
  newSession,
  sessionKeys,
  verificationCode,
  decryptor,
  helloPayload,
  FINAL_TAG,
} from '../crypto/session';
import {
  saveDir,
  ensureSaveDir,
  hasSpace,
  appendChunk,
  uniquePath,
} from '../files/writer';

export type OfferInfo = {
  fileName: string;
  size: number;
  mimeType?: string;
};

export type ReceiverUI = {
  confirmCode: (code: string) => Promise<boolean>;
  acceptFile: (offer: OfferInfo) => Promise<boolean>;
  progress: (received: number) => void;
  done: (filePath: string, verified: boolean) => void;
  cancelled: () => void;
  error: (msg: string) => void;
};

function decodeOffer(p: Buffer): OfferInfo & { header: Uint8Array } {
  // First 24 bytes: secretstream header; rest: JSON metadata
  const header = new Uint8Array(p.subarray(0, 24));
  const meta = JSON.parse(Buffer.from(p.subarray(24)).toString('utf8'));
  return { ...meta, header };
}

export function startReceiver(ui: ReceiverUI): ReturnType<typeof TcpSocket.createServer> {
  const server = TcpSocket.createServer(async socket => {
    const me = await newSession();
    let keys: ReturnType<typeof sessionKeys> | null = null;
    let decrypt: ReturnType<typeof decryptor> | null = null;
    let outPath = '';
    let received = 0;
    let idx = 0;
    let lastOutPath = '';
    let doneCalled = false;
    function finalize() {
      if (doneCalled) return;
      doneCalled = true;
      if (lastOutPath) ui.done(lastOutPath, true);
    }

    const parser = new FrameParser(async (type, p) => {
      try {
        switch (type) {
          case T.HELLO: {
            const peer = JSON.parse(p.toString('utf8'));
            const peerPub = Buffer.from(peer.publicKey, 'base64');
            socket.write(frame(T.HELLO, helloPayload(me)));
            keys = sessionKeys('server', me, peerPub);
            const code = verificationCode(me.publicKey, peerPub);
            const ok = await ui.confirmCode(code);
            if (!ok) {
              socket.write(frame(T.CANCEL));
              socket.destroy();
            }
            break;
          }

          case T.OFFER: {
            if (!keys) return;
            const offer = decodeOffer(p);
            if (!(await hasSpace(offer.size))) {
              socket.write(frame(T.REJECT, enc('no_space')));
              return;
            }
            if (!(await ui.acceptFile(offer))) {
              socket.write(frame(T.REJECT, enc('declined')));
              return;
            }
            decrypt = decryptor(keys.sharedRx, offer.header);
            await ensureSaveDir();
            outPath = await uniquePath(saveDir(), offer.fileName);
            socket.write(frame(T.ACCEPT));
            break;
          }

          case T.CHUNK: {
            if (!decrypt) return;
            const chunkIdx = p.readUInt32BE(0);
            const cipherData = new Uint8Array(p.subarray(4));
            const result = decrypt(cipherData) as { message: Uint8Array; tag: number };
            await appendChunk(outPath, result.message);
            received += result.message.length;
            idx = chunkIdx;
            ui.progress(received);

            if (idx % ACK_EVERY === 0) {
              socket.write(frame(T.ACK, u32(idx)));
            }

            if (result.tag === FINAL_TAG) {
              socket.write(frame(T.DONE));
              lastOutPath = outPath;
              decrypt = null;
              outPath = '';
              received = 0;
              idx = 0;
            }
            break;
          }

          case T.CANCEL: {
            if (outPath) {
              await FileSystem.deleteAsync(outPath, { idempotent: true }).catch(() => {});
            }
            ui.cancelled();
            socket.destroy();
            break;
          }

          case T.ERROR: {
            ui.error(p.toString('utf8'));
            socket.destroy();
            break;
          }

          case T.FINISH: {
            finalize();
            socket.destroy();
            break;
          }
        }
      } catch (err: any) {
        ui.error(err?.message ?? 'Unknown error');
        socket.destroy();
      }
    });

    socket.on('data', d => parser.push(d as Buffer));
    socket.on('error', err => ui.error(err.message));
    socket.on('close', () => finalize());
  });

  server.listen({ port: PORT, host: '0.0.0.0' });
  return server;
}
