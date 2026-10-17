import * as s from 'react-native-libsodium';
import { Buffer } from 'buffer';

export type Keypair = {
  publicKey: Uint8Array;
  privateKey: Uint8Array;
  keyType: string;
};

export async function newSession(): Promise<Keypair> {
  await s.ready;
  const kp = s.crypto_kx_keypair() as unknown as Keypair;
  return kp;
}

// Sender = client side, Receiver = server side
export function sessionKeys(
  role: 'client' | 'server',
  me: Keypair,
  peerPub: Uint8Array,
) {
  const lib = s as any;
  return role === 'client'
    ? lib.crypto_kx_client_session_keys(me.publicKey, me.privateKey, peerPub)
    : lib.crypto_kx_server_session_keys(me.publicKey, me.privateKey, peerPub);
}

// Both phones derive the SAME 6-digit code (sort keys then hash)
export function verificationCode(a: Uint8Array, b: Uint8Array): string {
  const [x, y] =
    Buffer.compare(Buffer.from(a), Buffer.from(b)) < 0 ? [a, b] : [b, a];
  const combined = new Uint8Array([...x, ...y]);
  const h = (s as any).crypto_generichash(8, combined) as Uint8Array;
  const n = Buffer.from(h).readUInt32BE(0) % 1_000_000;
  return n.toString().padStart(6, '0');
}

// Streaming authenticated encryption (XChaCha20-Poly1305)
export function encryptor(key: Uint8Array) {
  const { state, header } =
    s.crypto_secretstream_xchacha20poly1305_init_push(key);
  return {
    header,
    push: (chunk: Uint8Array, last: boolean) =>
      s.crypto_secretstream_xchacha20poly1305_push(
        state,
        chunk,
        null,
        last
          ? s.crypto_secretstream_xchacha20poly1305_TAG_FINAL
          : s.crypto_secretstream_xchacha20poly1305_TAG_MESSAGE,
      ),
  };
}

export function decryptor(key: Uint8Array, header: Uint8Array) {
  const state = s.crypto_secretstream_xchacha20poly1305_init_pull(
    header,
    key,
  );
  return (cipher: Uint8Array) =>
    s.crypto_secretstream_xchacha20poly1305_pull(state, cipher, null);
  // Returns { message, tag } — TAG_FINAL means file is complete and untampered
}

export const FINAL_TAG = (s as any).crypto_secretstream_xchacha20poly1305_TAG_FINAL as number;

export function helloPayload(kp: Keypair): Uint8Array {
  const json = JSON.stringify({
    publicKey: Buffer.from(kp.publicKey).toString('base64'),
    v: 1,
  });
  return Buffer.from(json);
}
