// packages/static-crypt/src/qr.mjs
import QRCode from 'qrcode';
import { deriveTierKey } from './crypto.mjs';
import { buildFragment } from './fragment.mjs';

/**
 * Generate QR code as PNG buffer
 * @param {string} tier - Tier name
 * @param {Object} options
 * @param {Buffer} options.masterSecret - 32-byte master secret
 * @param {string} options.baseUrl - Base URL (e.g., 'https://example.com/')
 * @returns {Promise<Buffer>} PNG image buffer
 */
export async function generateQRCode(tier, { masterSecret, baseUrl }) {
  const tierKey = await deriveTierKey(masterSecret, tier);
  const fragment = buildFragment(tier, new Uint8Array(tierKey));
  const url = baseUrl.replace(/\/$/, '') + '/' + fragment;

  return QRCode.toBuffer(url, { type: 'png', width: 400 });
}

/**
 * Generate QR code as data URL
 * @param {string} tier - Tier name
 * @param {Object} options
 * @param {Buffer} options.masterSecret - 32-byte master secret
 * @param {string} options.baseUrl - Base URL
 * @returns {Promise<string>} Data URL (data:image/png;base64,...)
 */
export async function generateQRCodeDataURL(tier, { masterSecret, baseUrl }) {
  const tierKey = await deriveTierKey(masterSecret, tier);
  const fragment = buildFragment(tier, new Uint8Array(tierKey));
  const url = baseUrl.replace(/\/$/, '') + '/' + fragment;

  return QRCode.toDataURL(url, { type: 'image/png', width: 400 });
}
