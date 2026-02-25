// packages/static-crypt/src/crypto.test.mjs
import { test } from 'node:test';
import assert from 'node:assert';
import { deriveTierKey } from './crypto.mjs';

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
