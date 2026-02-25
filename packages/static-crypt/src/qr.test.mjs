// packages/static-crypt/src/qr.test.mjs
import { test } from 'node:test';
import assert from 'node:assert';
import { generateQRCode, generateQRCodeDataURL } from './qr.mjs';

test('generateQRCode returns PNG buffer', async () => {
  const masterSecret = Buffer.from('a'.repeat(64), 'hex');
  const png = await generateQRCode('family', {
    masterSecret,
    baseUrl: 'https://example.com/'
  });

  assert.ok(Buffer.isBuffer(png));
  // PNG magic bytes
  assert.deepStrictEqual(png.subarray(0, 4), Buffer.from([0x89, 0x50, 0x4e, 0x47]));
});

test('generateQRCodeDataURL returns data URL', async () => {
  const masterSecret = Buffer.from('a'.repeat(64), 'hex');
  const dataUrl = await generateQRCodeDataURL('family', {
    masterSecret,
    baseUrl: 'https://example.com/'
  });

  assert.ok(dataUrl.startsWith('data:image/png;base64,'));
});
