// packages/static-crypt/src/browser-crypto.test.mjs
import { test } from 'node:test';
import assert from 'node:assert';
import { deriveTierKeyBrowser, decryptWithKeyBrowser } from './browser-crypto.mjs';
import { deriveTierKey, encryptWithKey } from './crypto.mjs';

test('browser deriveTierKey matches Node derivation', async () => {
  const masterSecret = new Uint8Array(Buffer.from('a'.repeat(64), 'hex'));
  const nodeKey = await deriveTierKey(Buffer.from(masterSecret), 'family');
  const browserKey = await deriveTierKeyBrowser(masterSecret, 'family');

  assert.deepStrictEqual(Buffer.from(browserKey), nodeKey);
});

test('browser can decrypt Node-encrypted data', async () => {
  const masterSecret = Buffer.from('a'.repeat(64), 'hex');
  const plaintext = Buffer.from('hello world');

  // Encrypt with Node
  const tierKey = await deriveTierKey(masterSecret, 'family');
  const { nonce, ciphertext } = await encryptWithKey(tierKey, plaintext);

  // Decrypt with browser API
  const browserKey = await deriveTierKeyBrowser(new Uint8Array(masterSecret), 'family');
  const recovered = await decryptWithKeyBrowser(
    browserKey,
    new Uint8Array(nonce),
    new Uint8Array(ciphertext)
  );

  assert.deepStrictEqual(Buffer.from(recovered), plaintext);
});
