import { Buffer } from 'buffer';
import { T, frame, FrameParser, u32 } from '../src/net/protocol';
import { verificationCode } from '../src/crypto/session';

describe('Transfer Pipeline Integration Verification', () => {
  test('Pairing Code derivation matches on both sender and receiver', () => {
    // Ephemeral Curve25519 public keys from Sender and Receiver
    const senderPubKey = new Uint8Array([
      1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16,
      17, 18, 19, 20, 21, 22, 23, 24, 25, 26, 27, 28, 29, 30, 31, 32
    ]);
    const receiverPubKey = new Uint8Array([
      32, 31, 30, 29, 28, 27, 26, 25, 24, 23, 22, 21, 20, 19, 18, 17,
      16, 15, 14, 13, 12, 11, 10, 9, 8, 7, 6, 5, 4, 3, 2, 1
    ]);

    const codeOnSender = verificationCode(senderPubKey, receiverPubKey);
    const codeOnReceiver = verificationCode(receiverPubKey, senderPubKey);

    expect(codeOnSender).toBe(codeOnReceiver);
    expect(codeOnSender.length).toBe(6);
  });

  test('Full Handshake, Offer, Accept, Chunk Stream, and Finish protocol simulation', async () => {
    const events: string[] = [];

    // Simulated network pipe: connects Sender out to Receiver in, and vice-versa
    let receiverParser: FrameParser;
    let senderParser: FrameParser;

    const sendToReceiver = (data: Buffer) => {
      receiverParser.push(data);
    };

    const sendToSender = (data: Buffer) => {
      senderParser.push(data);
    };

    // Receiver state
    let receiverPairingConfirmed = false;
    let receiverChunksReceived = 0;

    receiverParser = new FrameParser(async (type, payload) => {
      switch (type) {
        case T.HELLO: {
          events.push('receiver:received_hello');
          // Respond with receiver HELLO
          sendToSender(frame(T.HELLO, Buffer.from(JSON.stringify({ publicKey: 'rec-key', v: 1 }))));
          receiverPairingConfirmed = true;
          break;
        }

        case T.OFFER: {
          events.push('receiver:received_offer');
          expect(receiverPairingConfirmed).toBe(true);
          const meta = JSON.parse(payload.subarray(24).toString('utf8'));
          expect(meta.fileName).toBe('test-document.pdf');
          expect(meta.size).toBe(1000);
          expect(meta.fileIndex).toBe(1);
          expect(meta.fileTotal).toBe(1);
          // Accept offer
          sendToSender(frame(T.ACCEPT));
          break;
        }

        case T.CHUNK: {
          const chunkIdx = payload.readUInt32BE(0);
          receiverChunksReceived++;
          events.push(`receiver:chunk_${chunkIdx}`);

          if (chunkIdx % 8 === 0) {
            sendToSender(frame(T.ACK, u32(chunkIdx)));
          }

          if (chunkIdx === 2) {
            // Final chunk reached
            events.push('receiver:file_done');
            sendToSender(frame(T.DONE));
          }
          break;
        }

        case T.FINISH: {
          events.push('receiver:finished_transfer');
          break;
        }
      }
    });

    // Sender state
    senderParser = new FrameParser(async (type, _payload) => {
      switch (type) {
        case T.HELLO: {
          events.push('sender:received_hello_response');
          // Send OFFER with 24-byte header + JSON
          const header = Buffer.alloc(24, 0x01);
          const meta = Buffer.from(JSON.stringify({
            fileName: 'test-document.pdf',
            size: 1000,
            mimeType: 'application/pdf',
            fileIndex: 1,
            fileTotal: 1,
          }));
          sendToReceiver(frame(T.OFFER, Buffer.concat([header, meta])));
          break;
        }

        case T.ACCEPT: {
          events.push('sender:received_accept');
          // Stream 2 chunks
          const chunk1 = Buffer.concat([u32(1), Buffer.from('data-part-1')]);
          const chunk2 = Buffer.concat([u32(2), Buffer.from('data-part-2')]);
          sendToReceiver(frame(T.CHUNK, chunk1));
          sendToReceiver(frame(T.CHUNK, chunk2));
          break;
        }

        case T.DONE: {
          events.push('sender:received_done');
          sendToReceiver(frame(T.FINISH));
          break;
        }
      }
    });

    // Step 1: Sender initiates by sending HELLO
    sendToReceiver(frame(T.HELLO, Buffer.from(JSON.stringify({ publicKey: 'send-key', v: 1 }))));

    // Allow queue to process
    await new Promise(r => setTimeout(r, 50));

    expect(events).toEqual([
      'receiver:received_hello',
      'sender:received_hello_response',
      'receiver:received_offer',
      'sender:received_accept',
      'receiver:chunk_1',
      'receiver:chunk_2',
      'receiver:file_done',
      'sender:received_done',
      'receiver:finished_transfer',
    ]);

    expect(receiverChunksReceived).toBe(2);
  });

  test('Cancellation mid-transfer triggers proper cleanup frame', async () => {
    let cancelReceived = false;

    const receiverParser = new FrameParser((type) => {
      if (type === T.CANCEL) {
        cancelReceived = true;
      }
    });

    // Sender cancels
    receiverParser.push(frame(T.CANCEL));

    await new Promise(r => setTimeout(r, 20));
    expect(cancelReceived).toBe(true);
  });
});
