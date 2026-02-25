// packages/static-crypt/src/crypto.mjs
import { hkdf, randomBytes, createCipheriv, createDecipheriv } from 'node:crypto';
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

/**
 * Encrypt plaintext with AES-256-GCM
 * @param {Buffer} key - 32-byte key
 * @param {Buffer} plaintext - Data to encrypt
 * @returns {Promise<{nonce: Buffer, ciphertext: Buffer}>}
 */
export async function encryptWithKey(key, plaintext) {
  const nonce = randomBytes(12);
  const cipher = createCipheriv('aes-256-gcm', key, nonce);
  const encrypted = Buffer.concat([cipher.update(plaintext), cipher.final()]);
  const authTag = cipher.getAuthTag();
  const ciphertext = Buffer.concat([encrypted, authTag]);
  return { nonce, ciphertext };
}

/**
 * Decrypt ciphertext with AES-256-GCM
 * @param {Buffer} key - 32-byte key
 * @param {Buffer} nonce - 12-byte nonce
 * @param {Buffer} ciphertext - Encrypted data with auth tag
 * @returns {Promise<Buffer>} Decrypted plaintext
 */
export async function decryptWithKey(key, nonce, ciphertext) {
  const authTag = ciphertext.subarray(-16);
  const encrypted = ciphertext.subarray(0, -16);
  const decipher = createDecipheriv('aes-256-gcm', key, nonce);
  decipher.setAuthTag(authTag);
  return Buffer.concat([decipher.update(encrypted), decipher.final()]);
}
