import { Buffer } from 'buffer';

// Message types for the transfer protocol
export enum T {
  HELLO = 1,
  OFFER,
  ACCEPT,
  REJECT,
  CHUNK,
  ACK,
  DONE,
  CANCEL,
  ERROR,
  FINISH,
}

// Frame layout: [4-byte big-endian length][1-byte type][payload]
export function frame(
  type: T,
  payload: Uint8Array = new Uint8Array(0),
): Buffer {
  const head = Buffer.alloc(5);
  head.writeUInt32BE(payload.length + 1, 0);
  head.writeUInt8(type, 4);
  return Buffer.concat([head, Buffer.from(payload)]) as any;
}

// TCP streams may split or merge packets — buffer until a full frame arrives
export class FrameParser {
  private buf: any = Buffer.alloc(0);
  private queue: { type: T; payload: Buffer }[] = [];
  private isProcessing = false;

  constructor(private onFrame: (t: T, p: Buffer) => Promise<void> | void) {}

  push(data: Buffer) {
    this.buf = this.buf.length
      ? (Buffer.concat([this.buf, data]) as any)
      : data;

    while (this.buf.length >= 4) {
      const len = this.buf.readUInt32BE(0);
      if (this.buf.length < 4 + len) break; // wait for more data
      const type = this.buf.readUInt8(4) as T;
      const payload = Buffer.from(this.buf.subarray(5, 4 + len)) as unknown as Buffer;
      this.buf = Buffer.from(this.buf.subarray(4 + len)) as any;
      this.queue.push({ type, payload });
    }

    this.processQueue();
  }

  private async processQueue() {
    if (this.isProcessing) return;
    this.isProcessing = true;
    while (this.queue.length > 0) {
      const next = this.queue.shift()!;
      try {
        await this.onFrame(next.type, next.payload);
      } catch {
        // error handling is managed inside onFrame callback
      }
    }
    this.isProcessing = false;
  }

  reset(): void {
    this.buf = Buffer.alloc(0);
    this.queue = [];
    this.isProcessing = false;
  }
}

// Encode a 32-bit index as 4-byte big-endian
export function u32(n: number): Buffer {
  const b = Buffer.alloc(4);
  b.writeUInt32BE(n, 0);
  return b as any;
}

// Encode a short string reason into bytes
export function enc(reason: string): Buffer {
  return Buffer.from(reason, 'utf8') as any;
}
