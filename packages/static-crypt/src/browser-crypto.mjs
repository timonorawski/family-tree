// packages/static-crypt/src/browser-crypto.mjs

const SALT = new TextEncoder().encode('static-crypt');

/**
 * Derive tier key using Web Crypto API (browser-compatible)
 * @param {Uint8Array} masterSecret - 32-byte master secret
 * @param {string} tierName - Tier identifier
 * @returns {Promise<Uint8Array>} 32-byte tier key
 */
export async function deriveTierKeyBrowser(masterSecret, tierName) {
  const keyMaterial = await crypto.subtle.importKey(
    'raw',
    masterSecret,
    'HKDF',
    false,
    ['deriveBits']
  );

  const info = new TextEncoder().encode(`tier:${tierName}`);

  const derivedBits = await crypto.subtle.deriveBits(
    { name: 'HKDF', hash: 'SHA-256', salt: SALT, info },
    keyMaterial,
    256
  );

  return new Uint8Array(derivedBits);
}

/**
 * Decrypt ciphertext using Web Crypto API
 * @param {Uint8Array} key - 32-byte key
 * @param {Uint8Array} nonce - 12-byte nonce
 * @param {Uint8Array} ciphertext - Encrypted data with auth tag
 * @returns {Promise<Uint8Array>} Decrypted plaintext
 */
export async function decryptWithKeyBrowser(key, nonce, ciphertext) {
  const cryptoKey = await crypto.subtle.importKey(
    'raw',
    key,
    'AES-GCM',
    false,
    ['decrypt']
  );

  const plaintext = await crypto.subtle.decrypt(
    { name: 'AES-GCM', iv: nonce },
    cryptoKey,
    ciphertext
  );

  return new Uint8Array(plaintext);
}
