// packages/static-crypt/src/encrypt.mjs
import { deriveTierKey, encryptWithKey } from './crypto.mjs';

/**
 * Encrypt plaintext for multiple tiers
 * @param {Buffer} plaintext - Data to encrypt
 * @param {Object} options
 * @param {Buffer} options.masterSecret - 32-byte master secret
 * @param {string[]} options.tiers - Tier names
 * @returns {Promise<Object>} Map of tier name to bundle {v, nonce, ciphertext}
 */
export async function encrypt(plaintext, { masterSecret, tiers }) {
  const results = {};

  for (const tier of tiers) {
    const tierKey = await deriveTierKey(masterSecret, tier);
    const { nonce, ciphertext } = await encryptWithKey(tierKey, plaintext);

    results[tier] = {
      v: 1,
      nonce: nonce.toString('base64'),
      ciphertext: ciphertext.toString('base64')
    };
  }

  return results;
}
