// packages/static-crypt/src/decrypt.test.mjs
import { test } from 'node:test';
import assert from 'node:assert';
import { decrypt } from './decrypt.mjs';
import { encrypt } from './encrypt.mjs';
import { deriveTierKey } from './crypto.mjs';

test('decrypt recovers original data from bundle', async () => {
  const masterSecret = Buffer.from('a'.repeat(64), 'hex');
  const plaintext = Buffer.from(JSON.stringify({ name: 'test' }));

  const bundles = await encrypt(plaintext, {
    masterSecret,
    tiers: ['family']
  });

  const tierKey = await deriveTierKey(masterSecret, 'family');
  const recovered = await decrypt(bundles.family, new Uint8Array(tierKey));

  assert.deepStrictEqual(Buffer.from(recovered), plaintext);
});

test('decrypt fails with wrong key', async () => {
  const masterSecret = Buffer.from('a'.repeat(64), 'hex');
  const wrongSecret = Buffer.from('b'.repeat(64), 'hex');
  const plaintext = Buffer.from(JSON.stringify({ name: 'test' }));

  const bundles = await encrypt(plaintext, {
    masterSecret,
    tiers: ['family']
  });

  const wrongKey = await deriveTierKey(wrongSecret, 'family');

  await assert.rejects(
    decrypt(bundles.family, new Uint8Array(wrongKey))
  );
});
