import { Buffer } from 'buffer';
import { T, frame, FrameParser, u32, enc } from '../src/net/protocol';

describe('Protocol framing and parsing', () => {
  test('frame layout encodes length, type, and payload correctly', () => {
    const payload = Buffer.from('hello-world');
    const f = frame(T.HELLO, payload);

    expect(f.length).toBe(4 + 1 + payload.length);
    const len = f.readUInt32BE(0);
    expect(len).toBe(1 + payload.length);
    const type = f.readUInt8(4);
    expect(type).toBe(T.HELLO);
    const data = f.subarray(5);
    expect(data.toString('utf8')).toBe('hello-world');
  });

  test('FrameParser parses single frame correctly', done => {
    const parser = new FrameParser((type, payload) => {
      expect(type).toBe(T.OFFER);
      expect(payload.toString('utf8')).toBe('offer-data');
      done();
    });

    parser.push(frame(T.OFFER, Buffer.from('offer-data')));
  });

  test('FrameParser parses multiple frames merged in single TCP chunk', done => {
    const received: { type: T; str: string }[] = [];

    const parser = new FrameParser((type, payload) => {
      received.push({ type, str: payload.toString('utf8') });
      if (received.length === 3) {
        expect(received[0]).toEqual({ type: T.HELLO, str: 'frame1' });
        expect(received[1]).toEqual({ type: T.ACCEPT, str: 'frame2' });
        expect(received[2]).toEqual({ type: T.DONE, str: 'frame3' });
        done();
      }
    });

    const f1 = frame(T.HELLO, Buffer.from('frame1'));
    const f2 = frame(T.ACCEPT, Buffer.from('frame2'));
    const f3 = frame(T.DONE, Buffer.from('frame3'));

    parser.push(Buffer.concat([f1, f2, f3]));
  });

  test('FrameParser handles fragmented chunks arriving across multiple packets', done => {
    const fullFrame = frame(T.CHUNK, Buffer.from('large-chunk-payload-split-across-network'));

    const parser = new FrameParser((type, payload) => {
      expect(type).toBe(T.CHUNK);
      expect(payload.toString('utf8')).toBe('large-chunk-payload-split-across-network');
      done();
    });

    // Split into 3 arbitrary slices
    const p1 = fullFrame.subarray(0, 7);
    const p2 = fullFrame.subarray(7, 20);
    const p3 = fullFrame.subarray(20);

    parser.push(p1);
    parser.push(p2);
    parser.push(p3);
  });

  test('FrameParser processes frames strictly in sequential order with async callbacks', async () => {
    const executionOrder: number[] = [];

    const parser = new FrameParser(async (type, payload) => {
      const idx = payload.readUInt32BE(0);
      // Simulate variable disk write latency (chunk 0 takes longer than chunk 1)
      const delay = idx === 0 ? 50 : 10;
      await new Promise(r => setTimeout(r, delay));
      executionOrder.push(idx);
    });

    const f0 = frame(T.CHUNK, u32(0));
    const f1 = frame(T.CHUNK, u32(1));
    const f2 = frame(T.CHUNK, u32(2));

    parser.push(Buffer.concat([f0, f1, f2]));

    // Wait for queue processing to finish
    await new Promise(r => setTimeout(r, 100));

    // Must be sequential: 0, 1, 2 (never 1, 0, 2)
    expect(executionOrder).toEqual([0, 1, 2]);
  });

  test('u32 and enc helper functions work correctly', () => {
    const b = u32(42);
    expect(b.readUInt32BE(0)).toBe(42);

    const r = enc('no_space');
    expect(r.toString('utf8')).toBe('no_space');
  });
});
