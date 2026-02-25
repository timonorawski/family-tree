// packages/static-crypt/src/decrypt.mjs
import { decryptWithKeyBrowser } from './browser-crypto.mjs';

/**
 * Decrypt a bundle using tier key
 * @param {{v: number, nonce: string, ciphertext: string}} bundle
 * @param {Uint8Array} tierKey - 32-byte tier key
 * @returns {Promise<Uint8Array>} Decrypted plaintext
 */
export async function decrypt(bundle, tierKey) {
  if (bundle.v !== 1) {
    throw new Error(`Unsupported bundle version: ${bundle.v}`);
  }

  const nonce = Uint8Array.from(atob(bundle.nonce), c => c.charCodeAt(0));
  const ciphertext = Uint8Array.from(atob(bundle.ciphertext), c => c.charCodeAt(0));

  return decryptWithKeyBrowser(tierKey, nonce, ciphertext);
}
