/* eslint-disable no-bitwise */
import {
  newSession,
  sessionKeys,
  verificationCode,
  encryptor,
  decryptor,
  helloPayload,
  Keypair,
} from '../src/crypto/session';
import * as s from 'react-native-libsodium';

describe('Cryptographic Session & Pairing', () => {
  test('newSession initializes libsodium and generates keypair', async () => {
    const kp = await newSession();
    expect(kp.publicKey).toBeDefined();
    expect(kp.privateKey).toBeDefined();
    expect(s.crypto_kx_keypair).toHaveBeenCalled();
  });

  test('verificationCode is symmetric: both sender and receiver derive the exact same 6-digit code', () => {
    const keyA = new Uint8Array(32);
    keyA[0] = 0xaa;
    keyA[31] = 0x01;

    const keyB = new Uint8Array(32);
    keyB[0] = 0xbb;
    keyB[31] = 0x02;

    // Simulate crypto_generichash returning hash based on input
    (s as any).crypto_generichash.mockImplementation((len: number, input: Uint8Array) => {
      // Deterministic mock hash based on sum of bytes
      const out = new Uint8Array(len);
      let sum = 0;
      for (let i = 0; i < input.length; i++) sum = (sum * 31 + input[i]) >>> 0;
      out[0] = (sum >>> 24) & 0xff;
      out[1] = (sum >>> 16) & 0xff;
      out[2] = (sum >>> 8) & 0xff;
      out[3] = sum & 0xff;
      return out;
    });

    const codeFromSender = verificationCode(keyA, keyB);
    const codeFromReceiver = verificationCode(keyB, keyA);

    // Must be identical on both sides
    expect(codeFromSender).toBe(codeFromReceiver);
    // Must be 6 digits
    expect(codeFromSender).toMatch(/^\d{6}$/);
  });

  test('helloPayload generates valid JSON with base64 public key', () => {
    const kp: Keypair = {
      publicKey: new Uint8Array([1, 2, 3, 4, 5]),
      privateKey: new Uint8Array(32),
      keyType: 'curve25519',
    };

    const payloadBytes = helloPayload(kp);
    const json = JSON.parse(Buffer.from(payloadBytes).toString('utf8'));

    expect(json.v).toBe(1);
    expect(json.publicKey).toBe(Buffer.from(kp.publicKey).toString('base64'));
  });

  test('sessionKeys calls client vs server libsodium KX methods', () => {
    const kp: Keypair = {
      publicKey: new Uint8Array(32),
      privateKey: new Uint8Array(32),
      keyType: 'curve25519',
    };
    const peerPub = new Uint8Array(32);

    sessionKeys('client', kp, peerPub);
    expect(s.crypto_kx_client_session_keys).toHaveBeenCalledWith(kp.publicKey, kp.privateKey, peerPub);

    sessionKeys('server', kp, peerPub);
    expect(s.crypto_kx_server_session_keys).toHaveBeenCalledWith(kp.publicKey, kp.privateKey, peerPub);
  });

  test('encryptor and decryptor invoke secretstream APIs correctly', () => {
    const key = new Uint8Array(32);
    const enc = encryptor(key);

    expect(enc.header).toBeDefined();
    expect(s.crypto_secretstream_xchacha20poly1305_init_push).toHaveBeenCalledWith(key);

    const chunk = new Uint8Array([10, 20, 30]);
    enc.push(chunk, false);
    expect(s.crypto_secretstream_xchacha20poly1305_push).toHaveBeenCalledWith(
      expect.anything(),
      chunk,
      null,
      s.crypto_secretstream_xchacha20poly1305_TAG_MESSAGE,
    );

    enc.push(chunk, true);
    expect(s.crypto_secretstream_xchacha20poly1305_push).toHaveBeenCalledWith(
      expect.anything(),
      chunk,
      null,
      s.crypto_secretstream_xchacha20poly1305_TAG_FINAL,
    );

    const dec = decryptor(key, enc.header);
    expect(s.crypto_secretstream_xchacha20poly1305_init_pull).toHaveBeenCalledWith(enc.header, key);

    const cipher = new Uint8Array(32);
    dec(cipher);
    expect(s.crypto_secretstream_xchacha20poly1305_pull).toHaveBeenCalledWith(
      expect.anything(),
      cipher,
      null,
    );
  });
});
