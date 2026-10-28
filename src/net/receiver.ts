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
  clearWriteLock,
} from '../files/writer';

export type OfferInfo = {
  fileName: string;
  size: number;
  mimeType?: string;
  fileIndex?: number;
  fileTotal?: number;
};

export type ReceiverUI = {
  confirmCode: (code: string) => Promise<boolean>;
  acceptFile: (offer: OfferInfo) => Promise<boolean>;
  progress: (received: number) => void;
  done: (filePath: string, verified: boolean, fileCount?: number) => void;
  cancelled: () => void;
  error: (msg: string) => void;
};

function decodeOffer(p: Buffer): OfferInfo & { header: Uint8Array } {
  // First 24 bytes: secretstream header; rest: JSON metadata
  const header = new Uint8Array(p.subarray(0, 24));
  const meta = JSON.parse(Buffer.from(p.subarray(24)).toString('utf8'));
  return { ...meta, header };
}

export function startReceiver(
  ui: ReceiverUI,
  cancelRef?: { cancel: () => void },
): ReturnType<typeof TcpSocket.createServer> {
  const server = TcpSocket.createServer(async socket => {
    let clientSocket: any = socket;
    if (cancelRef) {
      cancelRef.cancel = () => {
        try {
          clientSocket?.write(frame(T.CANCEL));
          clientSocket?.destroy();
        } catch {}
      };
    }

    const me = await newSession();
    let keys: ReturnType<typeof sessionKeys> | null = null;
    let decrypt: ReturnType<typeof decryptor> | null = null;
    let outPath = '';
    let received = 0;
    let idx = 0;
    let lastOutPath = '';
    let receivedFileCount = 0;
    let doneCalled = false;
    let transferCompleted = false; // BUG-14 FIX: tracks successful FINISH received
    function finalize() {
      if (doneCalled) return;
      doneCalled = true;
      if (transferCompleted) {
        // Transfer already completed cleanly via T.FINISH — do nothing here
        return;
      }
      if (outPath) {
        // Delete incomplete file and navigate receiver back — not an error, just cancelled
        FileSystem.deleteAsync(outPath, { idempotent: true }).catch(() => {});
        ui.cancelled();
        return;
      }
      if (lastOutPath) ui.done(lastOutPath, true, receivedFileCount);
    }

    let pairingConfirmed = false;
    let pendingOffer: Buffer | null = null;

    async function processOffer(p: Buffer) {
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
            } else {
              pairingConfirmed = true;
              // Process any OFFER that arrived during pairing
              if (pendingOffer) {
                const buf = pendingOffer;
                pendingOffer = null;
                await processOffer(buf);
              }
            }
            break;
          }

          case T.OFFER: {
            if (!pairingConfirmed) {
              pendingOffer = p;
              return;
            }
            await processOffer(p);
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
              receivedFileCount++;
              socket.write(frame(T.DONE));
              lastOutPath = outPath;
              clearWriteLock(outPath); // BUG-13: release write mutex for this file
              decrypt = null;
              outPath = '';
              received = 0;
              idx = 0;
            }
            break;
          }

          case T.CANCEL: {
            if (outPath) {
              clearWriteLock(outPath); // BUG-13: release mutex on cancel
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
            transferCompleted = true; // BUG-14 FIX: mark before finalize
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
    socket.on('error', err => {
      if (outPath) {
        FileSystem.deleteAsync(outPath, { idempotent: true }).catch(() => {});
      }
      ui.error(err.message);
    });
    socket.on('close', () => { parser.reset(); finalize(); });
  });

  server.on('error', (err: any) => {
    ui.error(`Receiver server error on port ${PORT}: ${err?.message ?? err}`);
  });

  server.listen({ port: PORT, host: '0.0.0.0', reuseAddress: true });
  return server;
}
