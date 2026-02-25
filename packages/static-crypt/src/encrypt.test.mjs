// packages/static-crypt/src/encrypt.test.mjs
import { test } from 'node:test';
import assert from 'node:assert';
import { encrypt } from './encrypt.mjs';

test('encrypt produces bundles for each tier', async () => {
  const plaintext = Buffer.from(JSON.stringify({ name: 'test' }));
  const masterSecret = Buffer.from('a'.repeat(64), 'hex');

  const results = await encrypt(plaintext, {
    masterSecret,
    tiers: ['family', 'extended']
  });

  assert.ok(results.family);
  assert.ok(results.extended);
  assert.strictEqual(results.family.v, 1);
  assert.ok(results.family.nonce);
  assert.ok(results.family.ciphertext);
});

test('encrypt produces different ciphertexts per tier', async () => {
  const plaintext = Buffer.from(JSON.stringify({ name: 'test' }));
  const masterSecret = Buffer.from('a'.repeat(64), 'hex');

  const results = await encrypt(plaintext, {
    masterSecret,
    tiers: ['family', 'extended']
  });

  assert.notStrictEqual(results.family.ciphertext, results.extended.ciphertext);
});
