// packages/static-crypt/src/crypto.mjs
import { hkdf } from 'node:crypto';
import { promisify } from 'node:util';

const hkdfAsync = promisify(hkdf);

const SALT = Buffer.from('static-crypt');

/**
 * Derive a tier-specific key from master secret using HKDF-SHA256
 * @param {Buffer} masterSecret - 32-byte master secret
 * @param {string} tierName - Tier identifier (e.g., 'family')
 * @returns {Promise<Buffer>} 32-byte tier key
 */
export async function deriveTierKey(masterSecret, tierName) {
  const info = Buffer.from(`tier:${tierName}`);
  const key = await hkdfAsync('sha256', masterSecret, SALT, info, 32);
  return Buffer.from(key);
}
