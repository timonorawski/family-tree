// packages/static-crypt/src/crypto.test.mjs
import { test } from 'node:test';
import assert from 'node:assert';
import { deriveTierKey, encryptWithKey, decryptWithKey } from './crypto.mjs';

test('deriveTierKey produces 32-byte key', async () => {
  const masterSecret = Buffer.from('a'.repeat(64), 'hex');
  const key = await deriveTierKey(masterSecret, 'family');
  assert.strictEqual(key.length, 32);
});

test('deriveTierKey produces different keys for different tiers', async () => {
  const masterSecret = Buffer.from('a'.repeat(64), 'hex');
  const key1 = await deriveTierKey(masterSecret, 'family');
  const key2 = await deriveTierKey(masterSecret, 'extended');
  assert.notDeepStrictEqual(key1, key2);
});

test('deriveTierKey is deterministic', async () => {
  const masterSecret = Buffer.from('a'.repeat(64), 'hex');
  const key1 = await deriveTierKey(masterSecret, 'family');
  const key2 = await deriveTierKey(masterSecret, 'family');
  assert.deepStrictEqual(key1, key2);
});

test('encryptWithKey returns nonce and ciphertext', async () => {
  const key = Buffer.from('b'.repeat(64), 'hex');
  const plaintext = Buffer.from('hello world');
  const result = await encryptWithKey(key, plaintext);

  assert.ok(result.nonce);
  assert.ok(result.ciphertext);
  assert.strictEqual(result.nonce.length, 12);
  assert.ok(result.ciphertext.length > plaintext.length); // includes auth tag
});

test('decryptWithKey recovers plaintext', async () => {
  const key = Buffer.from('b'.repeat(64), 'hex');
  const plaintext = Buffer.from('hello world');
  const { nonce, ciphertext } = await encryptWithKey(key, plaintext);

  const recovered = await decryptWithKey(key, nonce, ciphertext);
  assert.deepStrictEqual(recovered, plaintext);
});

test('decryptWithKey fails with wrong key', async () => {
  const key1 = Buffer.from('b'.repeat(64), 'hex');
  const key2 = Buffer.from('c'.repeat(64), 'hex');
  const plaintext = Buffer.from('hello world');
  const { nonce, ciphertext } = await encryptWithKey(key1, plaintext);

  await assert.rejects(
    decryptWithKey(key2, nonce, ciphertext),
    /Unsupported state or unable to authenticate/
  );
});
