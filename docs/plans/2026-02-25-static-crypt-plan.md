# Static-Crypt Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Build a reusable encryption library for tiered access control on static sites, with first integration into the family tree app.

**Architecture:** Monorepo package (`packages/static-crypt`) with Node.js build-time encryption, browser runtime decryption, and CLI. Uses HKDF for tier key derivation and AES-256-GCM for encryption via Web Crypto API.

**Tech Stack:** Node.js (crypto module), Web Crypto API (browser), qrcode library, SvelteKit integration

---

## Task 1: Package Scaffolding

**Files:**
- Create: `packages/static-crypt/package.json`
- Create: `packages/static-crypt/src/index.mjs`
- Create: `packages/static-crypt/src/browser.mjs`
- Modify: `package.json` (root)

**Step 1: Create package directory and package.json**

```bash
mkdir -p packages/static-crypt/src packages/static-crypt/bin
```

```json
// packages/static-crypt/package.json
{
  "name": "static-crypt",
  "version": "0.1.0",
  "type": "module",
  "main": "./src/index.mjs",
  "exports": {
    ".": "./src/index.mjs",
    "./browser": "./src/browser.mjs"
  },
  "bin": {
    "static-crypt": "./bin/static-crypt.mjs"
  },
  "dependencies": {
    "qrcode": "^1.5.3"
  }
}
```

**Step 2: Create stub exports**

```js
// packages/static-crypt/src/index.mjs
export { encrypt } from './encrypt.mjs';
export { deriveTierKey } from './crypto.mjs';
export { generateQRCode } from './qr.mjs';
```

```js
// packages/static-crypt/src/browser.mjs
export { decrypt } from './decrypt.mjs';
export { getKeyFromFragment, persistKey, loadPersistedKey, clearPersistedKey } from './fragment.mjs';
```

**Step 3: Add workspace to root package.json**

Add to root `package.json`:
```json
{
  "workspaces": ["packages/*"]
}
```

**Step 4: Commit**

```bash
git add packages/static-crypt package.json
git commit -m "chore: scaffold static-crypt package"
```

---

## Task 2: Crypto Primitives (Node.js)

**Files:**
- Create: `packages/static-crypt/src/crypto.mjs`
- Create: `packages/static-crypt/src/crypto.test.mjs`

**Step 1: Write failing test for HKDF derivation**

```js
// packages/static-crypt/src/crypto.test.mjs
import { test } from 'node:test';
import assert from 'node:assert';
import { deriveTierKey } from './crypto.mjs';

test('deriveTierKey produces 32-byte key', async () => {
  const masterSecret = Buffer.from('a'.repeat(64), 'hex');
  const key = await deriveTierKey(masterSecret, 'family');
  assert.strictEqual(key.length, 32);
});

test('deriveTierKey produces different keys for different tiers', async () => {
  const masterSecret = Buffer.from('a'.repeat(64), 'hex');
  const key1 = await deriveTierKey(masterSecret, 'family');
  const key2 = await deriveTierKey(masterSecret, 'extended');
  assert.notDeepStrictEqual(key1, key2);
});

test('deriveTierKey is deterministic', async () => {
  const masterSecret = Buffer.from('a'.repeat(64), 'hex');
  const key1 = await deriveTierKey(masterSecret, 'family');
  const key2 = await deriveTierKey(masterSecret, 'family');
  assert.deepStrictEqual(key1, key2);
});
```

**Step 2: Run test to verify it fails**

```bash
node --test packages/static-crypt/src/crypto.test.mjs
```

Expected: FAIL with module not found or function not defined

**Step 3: Implement HKDF derivation**

```js
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
```

**Step 4: Run test to verify it passes**

```bash
node --test packages/static-crypt/src/crypto.test.mjs
```

Expected: PASS (3 tests)

**Step 5: Commit**

```bash
git add packages/static-crypt/src/crypto.mjs packages/static-crypt/src/crypto.test.mjs
git commit -m "feat(static-crypt): add HKDF key derivation"
```

---

## Task 3: AES-GCM Encryption (Node.js)

**Files:**
- Modify: `packages/static-crypt/src/crypto.mjs`
- Modify: `packages/static-crypt/src/crypto.test.mjs`

**Step 1: Write failing test for encryption**

Add to `crypto.test.mjs`:

```js
import { deriveTierKey, encryptWithKey, decryptWithKey } from './crypto.mjs';

test('encryptWithKey returns nonce and ciphertext', async () => {
  const key = Buffer.from('b'.repeat(64), 'hex');
  const plaintext = Buffer.from('hello world');
  const result = await encryptWithKey(key, plaintext);

  assert.ok(result.nonce);
  assert.ok(result.ciphertext);
  assert.strictEqual(result.nonce.length, 12);
  assert.ok(result.ciphertext.length > plaintext.length); // includes auth tag
});

test('decryptWithKey recovers plaintext', async () => {
  const key = Buffer.from('b'.repeat(64), 'hex');
  const plaintext = Buffer.from('hello world');
  const { nonce, ciphertext } = await encryptWithKey(key, plaintext);

  const recovered = await decryptWithKey(key, nonce, ciphertext);
  assert.deepStrictEqual(recovered, plaintext);
});

test('decryptWithKey fails with wrong key', async () => {
  const key1 = Buffer.from('b'.repeat(64), 'hex');
  const key2 = Buffer.from('c'.repeat(64), 'hex');
  const plaintext = Buffer.from('hello world');
  const { nonce, ciphertext } = await encryptWithKey(key1, plaintext);

  await assert.rejects(
    decryptWithKey(key2, nonce, ciphertext),
    /Unsupported state or unable to authenticate/
  );
});
```

**Step 2: Run test to verify it fails**

```bash
node --test packages/static-crypt/src/crypto.test.mjs
```

Expected: FAIL with function not defined

**Step 3: Implement AES-GCM encryption**

Add to `crypto.mjs`:

```js
import { hkdf, randomBytes, createCipheriv, createDecipheriv } from 'node:crypto';

// ... existing code ...

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
```

**Step 4: Run test to verify it passes**

```bash
node --test packages/static-crypt/src/crypto.test.mjs
```

Expected: PASS (6 tests)

**Step 5: Commit**

```bash
git add packages/static-crypt/src/crypto.mjs packages/static-crypt/src/crypto.test.mjs
git commit -m "feat(static-crypt): add AES-256-GCM encryption"
```

---

## Task 4: Encrypt Function

**Files:**
- Create: `packages/static-crypt/src/encrypt.mjs`
- Create: `packages/static-crypt/src/encrypt.test.mjs`

**Step 1: Write failing test**

```js
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
```

**Step 2: Run test to verify it fails**

```bash
node --test packages/static-crypt/src/encrypt.test.mjs
```

Expected: FAIL

**Step 3: Implement encrypt**

```js
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
```

**Step 4: Run test to verify it passes**

```bash
node --test packages/static-crypt/src/encrypt.test.mjs
```

Expected: PASS

**Step 5: Commit**

```bash
git add packages/static-crypt/src/encrypt.mjs packages/static-crypt/src/encrypt.test.mjs
git commit -m "feat(static-crypt): add multi-tier encrypt function"
```

---

## Task 5: Browser Crypto (Web Crypto API)

**Files:**
- Create: `packages/static-crypt/src/browser-crypto.mjs`
- Create: `packages/static-crypt/src/browser-crypto.test.mjs`

**Step 1: Write failing test**

Note: These tests run in Node.js using the Web Crypto API polyfill (available in Node 20+).

```js
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
```

**Step 2: Run test to verify it fails**

```bash
node --test packages/static-crypt/src/browser-crypto.test.mjs
```

Expected: FAIL

**Step 3: Implement browser crypto**

```js
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
```

**Step 4: Run test to verify it passes**

```bash
node --test packages/static-crypt/src/browser-crypto.test.mjs
```

Expected: PASS

**Step 5: Commit**

```bash
git add packages/static-crypt/src/browser-crypto.mjs packages/static-crypt/src/browser-crypto.test.mjs
git commit -m "feat(static-crypt): add browser-compatible crypto via Web Crypto API"
```

---

## Task 6: URL Fragment Parser

**Files:**
- Create: `packages/static-crypt/src/fragment.mjs`
- Create: `packages/static-crypt/src/fragment.test.mjs`

**Step 1: Write failing test**

```js
// packages/static-crypt/src/fragment.test.mjs
import { test } from 'node:test';
import assert from 'node:assert';
import { parseFragment, buildFragment } from './fragment.mjs';

test('parseFragment extracts tier and key', () => {
  const fragment = '#t=family&k=YWJjZGVmZ2hpamtsbW5vcHFyc3R1dnd4eXoxMjM0NTY';
  const { tier, key } = parseFragment(fragment);

  assert.strictEqual(tier, 'family');
  assert.ok(key instanceof Uint8Array);
  assert.strictEqual(key.length, 32);
});

test('parseFragment returns null for missing tier', () => {
  const fragment = '#k=YWJjZGVmZ2hpamtsbW5vcHFyc3R1dnd4eXoxMjM0NTY';
  const result = parseFragment(fragment);

  assert.strictEqual(result, null);
});

test('parseFragment returns null for missing key', () => {
  const fragment = '#t=family';
  const result = parseFragment(fragment);

  assert.strictEqual(result, null);
});

test('parseFragment returns null for empty fragment', () => {
  const result = parseFragment('');
  assert.strictEqual(result, null);
});

test('buildFragment creates valid fragment', () => {
  const key = new Uint8Array(32).fill(65); // 'AAAA...'
  const fragment = buildFragment('family', key);

  assert.ok(fragment.startsWith('#t=family&k='));

  // Round-trip
  const parsed = parseFragment(fragment);
  assert.strictEqual(parsed.tier, 'family');
  assert.deepStrictEqual(parsed.key, key);
});
```

**Step 2: Run test to verify it fails**

```bash
node --test packages/static-crypt/src/fragment.test.mjs
```

Expected: FAIL

**Step 3: Implement fragment parser**

```js
// packages/static-crypt/src/fragment.mjs

/**
 * Base64url encode
 * @param {Uint8Array} bytes
 * @returns {string}
 */
function base64urlEncode(bytes) {
  const base64 = btoa(String.fromCharCode(...bytes));
  return base64.replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

/**
 * Base64url decode
 * @param {string} str
 * @returns {Uint8Array}
 */
function base64urlDecode(str) {
  const base64 = str.replace(/-/g, '+').replace(/_/g, '/');
  const padded = base64 + '='.repeat((4 - base64.length % 4) % 4);
  const binary = atob(padded);
  return new Uint8Array([...binary].map(c => c.charCodeAt(0)));
}

/**
 * Parse URL fragment to extract tier and key
 * @param {string} fragment - URL fragment including #
 * @returns {{tier: string, key: Uint8Array} | null}
 */
export function parseFragment(fragment) {
  if (!fragment || !fragment.startsWith('#')) return null;

  const params = new URLSearchParams(fragment.slice(1));
  const tier = params.get('t');
  const keyStr = params.get('k');

  if (!tier || !keyStr) return null;

  try {
    const key = base64urlDecode(keyStr);
    if (key.length !== 32) return null;
    return { tier, key };
  } catch {
    return null;
  }
}

/**
 * Build URL fragment from tier and key
 * @param {string} tier
 * @param {Uint8Array} key
 * @returns {string}
 */
export function buildFragment(tier, key) {
  const keyStr = base64urlEncode(key);
  return `#t=${encodeURIComponent(tier)}&k=${keyStr}`;
}

/**
 * Get key from current window location fragment (browser only)
 * @returns {{tier: string, key: Uint8Array} | null}
 */
export function getKeyFromFragment() {
  if (typeof window === 'undefined') return null;
  return parseFragment(window.location.hash);
}

const STORAGE_PREFIX = 'static-crypt-';

/**
 * Persist key to localStorage
 * @param {string} tier
 * @param {Uint8Array} key
 */
export function persistKey(tier, key) {
  if (typeof localStorage === 'undefined') return;
  localStorage.setItem(`${STORAGE_PREFIX}tier`, tier);
  localStorage.setItem(`${STORAGE_PREFIX}key`, base64urlEncode(key));
}

/**
 * Load persisted key from localStorage
 * @returns {{tier: string, key: Uint8Array} | null}
 */
export function loadPersistedKey() {
  if (typeof localStorage === 'undefined') return null;
  const tier = localStorage.getItem(`${STORAGE_PREFIX}tier`);
  const keyStr = localStorage.getItem(`${STORAGE_PREFIX}key`);
  if (!tier || !keyStr) return null;
  try {
    return { tier, key: base64urlDecode(keyStr) };
  } catch {
    return null;
  }
}

/**
 * Clear persisted key from localStorage
 */
export function clearPersistedKey() {
  if (typeof localStorage === 'undefined') return;
  localStorage.removeItem(`${STORAGE_PREFIX}tier`);
  localStorage.removeItem(`${STORAGE_PREFIX}key`);
}
```

**Step 4: Run test to verify it passes**

```bash
node --test packages/static-crypt/src/fragment.test.mjs
```

Expected: PASS

**Step 5: Commit**

```bash
git add packages/static-crypt/src/fragment.mjs packages/static-crypt/src/fragment.test.mjs
git commit -m "feat(static-crypt): add URL fragment parser and localStorage persistence"
```

---

## Task 7: Browser Decrypt Function

**Files:**
- Create: `packages/static-crypt/src/decrypt.mjs`
- Create: `packages/static-crypt/src/decrypt.test.mjs`

**Step 1: Write failing test**

```js
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
```

**Step 2: Run test to verify it fails**

```bash
node --test packages/static-crypt/src/decrypt.test.mjs
```

Expected: FAIL

**Step 3: Implement decrypt**

```js
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
```

**Step 4: Run test to verify it passes**

```bash
node --test packages/static-crypt/src/decrypt.test.mjs
```

Expected: PASS

**Step 5: Commit**

```bash
git add packages/static-crypt/src/decrypt.mjs packages/static-crypt/src/decrypt.test.mjs
git commit -m "feat(static-crypt): add browser decrypt function"
```

---

## Task 8: QR Code Generation

**Files:**
- Create: `packages/static-crypt/src/qr.mjs`
- Create: `packages/static-crypt/src/qr.test.mjs`

**Step 1: Install qrcode dependency**

```bash
cd packages/static-crypt && npm install qrcode && cd ../..
```

**Step 2: Write failing test**

```js
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
```

**Step 3: Run test to verify it fails**

```bash
node --test packages/static-crypt/src/qr.test.mjs
```

Expected: FAIL

**Step 4: Implement QR generation**

```js
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
```

**Step 5: Run test to verify it passes**

```bash
node --test packages/static-crypt/src/qr.test.mjs
```

Expected: PASS

**Step 6: Commit**

```bash
git add packages/static-crypt/src/qr.mjs packages/static-crypt/src/qr.test.mjs packages/static-crypt/package.json
git commit -m "feat(static-crypt): add QR code generation"
```

---

## Task 9: CLI Tool

**Files:**
- Create: `packages/static-crypt/bin/static-crypt.mjs`

**Step 1: Implement CLI**

```js
#!/usr/bin/env node
// packages/static-crypt/bin/static-crypt.mjs

import { parseArgs } from 'node:util';
import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { join, basename } from 'node:path';
import { encrypt } from '../src/encrypt.mjs';
import { generateQRCode } from '../src/qr.mjs';

const args = parseArgs({
  allowPositionals: true,
  options: {
    tiers: { type: 'string', short: 't' },
    out: { type: 'string', short: 'o' },
    secret: { type: 'string', short: 's' },
    'secret-file': { type: 'string' },
    'base-url': { type: 'string', short: 'u' },
    all: { type: 'boolean', short: 'a' },
    help: { type: 'boolean', short: 'h' }
  }
});

const [command, ...positional] = args.positionals;

async function getSecret(args) {
  if (args.values.secret) {
    return Buffer.from(args.values.secret, 'hex');
  }
  if (args.values['secret-file']) {
    const content = await readFile(args.values['secret-file'], 'utf8');
    return Buffer.from(content.trim(), 'hex');
  }
  if (process.env.STATIC_CRYPT_SECRET) {
    return Buffer.from(process.env.STATIC_CRYPT_SECRET, 'hex');
  }
  throw new Error('No secret provided. Use --secret, --secret-file, or STATIC_CRYPT_SECRET env var');
}

function getTiers(args) {
  const tiersStr = args.values.tiers || process.env.STATIC_CRYPT_TIERS;
  if (!tiersStr) {
    throw new Error('No tiers provided. Use --tiers or STATIC_CRYPT_TIERS env var');
  }
  return tiersStr.split(',').map(t => t.trim());
}

async function cmdEncrypt() {
  const [inputFile] = positional;
  if (!inputFile) {
    console.error('Usage: static-crypt encrypt <file> --tiers a,b,c --out <dir>');
    process.exit(1);
  }

  const secret = await getSecret(args);
  const tiers = getTiers(args);
  const outDir = args.values.out || '.';

  const plaintext = await readFile(inputFile);
  const bundles = await encrypt(plaintext, { masterSecret: secret, tiers });

  await mkdir(outDir, { recursive: true });

  const baseName = basename(inputFile, '.json');

  for (const [tier, bundle] of Object.entries(bundles)) {
    const outPath = join(outDir, `${baseName}.${tier}.enc`);
    await writeFile(outPath, JSON.stringify(bundle));
    console.log(`Wrote ${outPath}`);
  }
}

async function cmdQr() {
  const [tier] = positional;
  const secret = await getSecret(args);
  const baseUrl = args.values['base-url'];
  const outDir = args.values.out || '.';

  if (!baseUrl) {
    console.error('Usage: static-crypt qr <tier> --base-url <url> --out <dir>');
    console.error('   or: static-crypt qr --all --base-url <url> --out <dir>');
    process.exit(1);
  }

  await mkdir(outDir, { recursive: true });

  const tiersToGenerate = args.values.all ? getTiers(args) : [tier];

  if (!args.values.all && !tier) {
    console.error('Specify a tier or use --all');
    process.exit(1);
  }

  for (const t of tiersToGenerate) {
    const png = await generateQRCode(t, { masterSecret: secret, baseUrl });
    const outPath = join(outDir, `${t}.png`);
    await writeFile(outPath, png);
    console.log(`Wrote ${outPath}`);
  }
}

function showHelp() {
  console.log(`
static-crypt - Tiered encryption for static sites

Commands:
  encrypt <file>   Encrypt a file for multiple tiers
  qr <tier>        Generate QR code for a tier

Options:
  --tiers, -t      Comma-separated tier names
  --out, -o        Output directory
  --secret, -s     Master secret (hex)
  --secret-file    Path to file containing master secret
  --base-url, -u   Base URL for QR codes
  --all, -a        Generate QR codes for all tiers

Environment:
  STATIC_CRYPT_SECRET   Master secret (hex)
  STATIC_CRYPT_TIERS    Default tier list

Examples:
  static-crypt encrypt data.json --tiers family,extended --out ./build/data/
  static-crypt qr family --base-url https://example.com/ --out ./qrcodes/
  static-crypt qr --all --base-url https://example.com/ --out ./qrcodes/
`);
}

if (args.values.help || !command) {
  showHelp();
  process.exit(0);
}

switch (command) {
  case 'encrypt':
    await cmdEncrypt();
    break;
  case 'qr':
    await cmdQr();
    break;
  default:
    console.error(`Unknown command: ${command}`);
    showHelp();
    process.exit(1);
}
```

**Step 2: Make executable and test**

```bash
chmod +x packages/static-crypt/bin/static-crypt.mjs
```

```bash
echo '{"test": true}' > /tmp/test.json
STATIC_CRYPT_SECRET=$(openssl rand -hex 32) packages/static-crypt/bin/static-crypt.mjs encrypt /tmp/test.json --tiers family,extended --out /tmp/out
ls -la /tmp/out/
```

Expected: `test.family.enc` and `test.extended.enc` created

**Step 3: Commit**

```bash
git add packages/static-crypt/bin/static-crypt.mjs
git commit -m "feat(static-crypt): add CLI tool"
```

---

## Task 10: Update Package Exports

**Files:**
- Modify: `packages/static-crypt/src/index.mjs`
- Modify: `packages/static-crypt/src/browser.mjs`

**Step 1: Update index.mjs**

```js
// packages/static-crypt/src/index.mjs
export { encrypt } from './encrypt.mjs';
export { deriveTierKey, encryptWithKey, decryptWithKey } from './crypto.mjs';
export { generateQRCode, generateQRCodeDataURL } from './qr.mjs';
export { buildFragment, parseFragment } from './fragment.mjs';
```

**Step 2: Update browser.mjs**

```js
// packages/static-crypt/src/browser.mjs
export { decrypt } from './decrypt.mjs';
export { deriveTierKeyBrowser, decryptWithKeyBrowser } from './browser-crypto.mjs';
export {
  getKeyFromFragment,
  parseFragment,
  buildFragment,
  persistKey,
  loadPersistedKey,
  clearPersistedKey
} from './fragment.mjs';
```

**Step 3: Run all tests**

```bash
node --test packages/static-crypt/src/*.test.mjs
```

Expected: All tests pass

**Step 4: Commit**

```bash
git add packages/static-crypt/src/index.mjs packages/static-crypt/src/browser.mjs
git commit -m "feat(static-crypt): finalize package exports"
```

---

## Task 11: Family Tree Integration - Build Script

**Files:**
- Create: `scripts/build-encrypted.mjs`
- Modify: `package.json`

**Step 1: Create build script**

```js
// scripts/build-encrypted.mjs
import { readFile, writeFile, mkdir, rm } from 'node:fs/promises';
import { join } from 'node:path';
import { loadAll } from '../src/lib/store.mjs';
import { encrypt } from '../packages/static-crypt/src/encrypt.mjs';

const BUILD_DIR = 'build';
const DATA_DIR = join(BUILD_DIR, 'data');

async function main() {
  const secret = process.env.STATIC_CRYPT_SECRET;
  const tiersStr = process.env.STATIC_CRYPT_TIERS || 'family';

  if (!secret) {
    console.error('STATIC_CRYPT_SECRET env var required');
    process.exit(1);
  }

  const tiers = tiersStr.split(',').map(t => t.trim());
  const masterSecret = Buffer.from(secret, 'hex');

  // Load all persons
  const persons = loadAll();
  const plaintext = Buffer.from(JSON.stringify(persons));

  console.log(`Encrypting for tiers: ${tiers.join(', ')}`);

  // Encrypt for each tier
  const bundles = await encrypt(plaintext, { masterSecret, tiers });

  // Write encrypted files
  await mkdir(DATA_DIR, { recursive: true });

  for (const [tier, bundle] of Object.entries(bundles)) {
    const outPath = join(DATA_DIR, `persons.${tier}.enc`);
    await writeFile(outPath, JSON.stringify(bundle));
    console.log(`Wrote ${outPath}`);
  }

  // Remove unencrypted data if present
  try {
    await rm(join(BUILD_DIR, 'persons.json'));
    console.log('Removed unencrypted persons.json');
  } catch {
    // File may not exist
  }

  console.log('Encryption complete');
}

main();
```

**Step 2: Update package.json scripts**

Add to root `package.json` scripts:

```json
{
  "scripts": {
    "build:encrypt": "node scripts/build-encrypted.mjs",
    "build:encrypted": "npm run build:static && npm run build:encrypt"
  }
}
```

**Step 3: Test build**

```bash
STATIC_CRYPT_SECRET=$(openssl rand -hex 32) STATIC_CRYPT_TIERS=family,extended npm run build:encrypted
ls -la build/data/
```

Expected: `persons.family.enc` and `persons.extended.enc` created

**Step 4: Commit**

```bash
git add scripts/build-encrypted.mjs package.json
git commit -m "feat: add encrypted static build script"
```

---

## Task 12: Family Tree Integration - Svelte Component

**Files:**
- Create: `src/lib/EncryptedLoader.svelte`
- Modify: `src/routes/+page.svelte`

**Step 1: Create EncryptedLoader component**

```svelte
<!-- src/lib/EncryptedLoader.svelte -->
<script>
  import { onMount } from 'svelte';
  import {
    getKeyFromFragment,
    loadPersistedKey,
    persistKey,
    clearPersistedKey
  } from 'static-crypt/browser';
  import { decrypt } from 'static-crypt/browser';

  let { onLoad, onError } = $props();

  let state = $state('loading'); // 'loading' | 'prompt' | 'error'
  let errorMessage = $state('');

  onMount(async () => {
    // Try URL fragment first, then localStorage
    let auth = getKeyFromFragment();
    if (!auth) {
      auth = loadPersistedKey();
    }

    if (!auth) {
      state = 'prompt';
      return;
    }

    const { tier, key } = auth;

    try {
      const res = await fetch(`/data/persons.${tier}.enc`);

      if (!res.ok) {
        if (res.status === 404) {
          clearPersistedKey();
          state = 'error';
          errorMessage = 'Access revoked or tier no longer exists.';
          return;
        }
        throw new Error(`HTTP ${res.status}`);
      }

      const bundle = await res.json();
      const plaintext = await decrypt(bundle, key);
      const persons = JSON.parse(new TextDecoder().decode(plaintext));

      // Persist for future visits
      persistKey(tier, key);

      // Clear fragment from URL for cleaner sharing
      if (window.location.hash) {
        history.replaceState(null, '', window.location.pathname + window.location.search);
      }

      onLoad(persons);
    } catch (err) {
      console.error('Decryption failed:', err);
      clearPersistedKey();
      state = 'error';
      errorMessage = 'Access expired or revoked. Please request a new access link.';
    }
  });
</script>

{#if state === 'loading'}
  <div class="loader-container">
    <div class="spinner"></div>
    <p>Loading...</p>
  </div>
{:else if state === 'prompt'}
  <div class="loader-container">
    <h2>Access Required</h2>
    <p>Scan the QR code or use the access link provided to view this family tree.</p>
  </div>
{:else if state === 'error'}
  <div class="loader-container">
    <h2>Access Denied</h2>
    <p>{errorMessage}</p>
    <p>Contact the tree owner for a new access link.</p>
  </div>
{/if}

<style>
  .loader-container {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    height: 100vh;
    background: rgb(33, 33, 33);
    color: #fff;
    text-align: center;
    padding: 2rem;
  }

  .spinner {
    width: 40px;
    height: 40px;
    border: 3px solid #444;
    border-top-color: #5e60ce;
    border-radius: 50%;
    animation: spin 1s linear infinite;
  }

  @keyframes spin {
    to { transform: rotate(360deg); }
  }

  h2 {
    margin-bottom: 1rem;
  }

  p {
    color: #aaa;
    max-width: 400px;
  }
</style>
```

**Step 2: Update +page.svelte for encrypted mode**

Modify `src/routes/+page.svelte`:

```svelte
<script>
  import { onMount } from 'svelte';
  import { page } from '$app/state';
  import { toFamilyChartData } from '$lib/graph.js';
  import Sidebar from '$lib/Sidebar.svelte';
  import EncryptedLoader from '$lib/EncryptedLoader.svelte';
  import 'family-chart/styles/family-chart.css';

  const isStatic = import.meta.env.VITE_STATIC === 'true';
  const isEncrypted = import.meta.env.VITE_ENCRYPTED === 'true';
  const { data } = $props();

  let persons = $state(isEncrypted ? null : data.persons);
  let chartData = $derived(persons ? toFamilyChartData(persons) : null);
  let selectedPerson = $state('');
  let chart = null;
  let ready = $state(!isEncrypted);

  function handleEncryptedLoad(loadedPersons) {
    persons = loadedPersons;
    ready = true;
  }

  function handleEncryptedError() {
    // Error UI handled by EncryptedLoader
  }

  function navigateTo(slug) {
    selectedPerson = slug;
    if (slug && chart) {
      chart.updateMainId(slug).updateTree({ tree_position: 'main_to_middle' });
    }
  }

  async function reloadPersons() {
    const res = await fetch('/api/persons');
    if (res.ok) {
      persons = await res.json();
      if (chart) {
        const newChartData = toFamilyChartData(persons);
        chart.updateData(newChartData).updateTree({ tree_position: 'inherit' });
      }
    }
  }

  onMount(async () => {
    if (!ready) return; // Wait for encrypted load
    initChart();
  });

  $effect(() => {
    if (ready && !chart && typeof window !== 'undefined') {
      initChart();
    }
  });

  async function initChart() {
    if (!chartData) return;

    const f3 = await import('family-chart');

    chart = f3.createChart('#FamilyChart', chartData)
      .setTransitionTime(1000)
      .setCardXSpacing(250)
      .setCardYSpacing(150)
      .setShowSiblingsOfMain(true)
      .setSingleParentEmptyCard(!isStatic && !isEncrypted);

    const f3Card = chart
      .setCardHtml()
      .setCardDisplay([['first name'], ['birthday']])
      .setMiniTree(true);

    f3Card.setOnCardClick((e, d) => {
      f3Card.onCardClickDefault(e, d);
      selectedPerson = d.data.id;
    });

    f3Card.setOnCardUpdate(function (d) {
      const card = this.querySelector('.card');
      if (!card) return;

      const prev = card.querySelector('.hidden-rels-badge');
      if (prev) prev.remove();

      if (d.all_rels_displayed !== false) return;

      const tree = chart.store.getTree();
      if (!tree) return;
      const rendered = new Set(tree.data.map((n) => n.data.id));

      const rels = d.data.rels;
      const hp = (rels.parents || []).filter((id) => !rendered.has(id)).length;
      const hs = (rels.spouses || []).filter((id) => !rendered.has(id)).length;
      const hc = (rels.children || []).filter((id) => !rendered.has(id)).length;

      const parts = [];
      if (hp) parts.push(`+${hp} parent${hp > 1 ? 's' : ''}`);
      if (hs) parts.push(`+${hs} partner${hs > 1 ? 's' : ''}`);
      if (hc) parts.push(`+${hc} ${hc > 1 ? 'children' : 'child'}`);
      if (!parts.length) return;

      const badge = document.createElement('div');
      badge.className = 'hidden-rels-badge';
      badge.textContent = parts.join(', ');
      badge.addEventListener('click', (e) => {
        e.stopPropagation();
        chart.updateMainId(d.data.id).updateTree({ tree_position: 'main_to_middle' });
      });
      card.appendChild(badge);
    });

    const initialPerson = page.url.searchParams.get('person') || 'timon';

    chart
      .updateMainId(initialPerson)
      .updateTree({ initial: true });

    if (initialPerson !== 'timon') {
      selectedPerson = initialPerson;
    }
  }
</script>

{#if isEncrypted && !ready}
  <EncryptedLoader onLoad={handleEncryptedLoad} onError={handleEncryptedError} />
{:else if ready}
  <div class="layout">
    <div id="FamilyChart" class="f3"></div>
    <Sidebar
      person={selectedPerson}
      {persons}
      {chartData}
      onNavigate={navigateTo}
      onSaved={reloadPersons}
      readonly={isStatic || isEncrypted}
    />
  </div>
{/if}

<style>
  .layout {
    display: flex;
    width: 100vw;
    height: 100vh;
  }

  :global(#FamilyChart) {
    flex: 1;
    height: 100vh;
    background-color: rgb(33, 33, 33);
    color: #fff;
  }

  :global(.hidden-rels-badge) {
    position: absolute;
    bottom: -20px;
    left: 50%;
    transform: translateX(-50%);
    background: #5e60ce;
    color: #fff;
    font-size: 10px;
    padding: 2px 6px;
    border-radius: 8px;
    white-space: nowrap;
    cursor: pointer;
    pointer-events: auto;
    opacity: 0.85;
  }

  :global(.hidden-rels-badge:hover) {
    opacity: 1;
  }
</style>
```

**Step 3: Commit**

```bash
git add src/lib/EncryptedLoader.svelte src/routes/+page.svelte
git commit -m "feat: add encrypted mode support to family tree"
```

---

## Task 13: Update Build Configuration

**Files:**
- Modify: `package.json`
- Modify: `svelte.config.js`

**Step 1: Add encrypted build script**

Update root `package.json` scripts:

```json
{
  "scripts": {
    "dev": "vite dev",
    "build": "vite build",
    "build:static": "VITE_STATIC=true vite build",
    "build:node": "NODE_ADAPTER=true vite build",
    "build:encrypt": "node scripts/build-encrypted.mjs",
    "build:encrypted": "VITE_STATIC=true VITE_ENCRYPTED=true vite build && npm run build:encrypt",
    "preview": "vite preview",
    "prepare": "svelte-kit sync || echo ''"
  }
}
```

**Step 2: Update svelte.config.js**

```js
// svelte.config.js
import adapterAuto from '@sveltejs/adapter-auto';
import adapterStatic from '@sveltejs/adapter-static';
import adapterNode from '@sveltejs/adapter-node';

function pickAdapter() {
  if (process.env.VITE_STATIC === 'true') return adapterStatic({ strict: false });
  if (process.env.NODE_ADAPTER === 'true') return adapterNode();
  return adapterAuto();
}

/** @type {import('@sveltejs/kit').Config} */
const config = {
  kit: {
    adapter: pickAdapter(),
    prerender: {
      // Don't prerender in encrypted mode - we load data client-side
      entries: process.env.VITE_ENCRYPTED === 'true' ? ['*'] : ['*']
    }
  }
};

export default config;
```

**Step 3: Commit**

```bash
git add package.json svelte.config.js
git commit -m "chore: add encrypted build configuration"
```

---

## Task 14: Add .env.example and Documentation

**Files:**
- Modify: `.env.example`
- Update: `README.md` (optional)

**Step 1: Update .env.example**

```bash
# .env.example

# Existing variables
VITE_STATIC=false
NODE_ADAPTER=false

# Encryption (for encrypted static builds)
STATIC_CRYPT_SECRET=your-32-byte-hex-secret-here
STATIC_CRYPT_TIERS=family,extended
```

**Step 2: Commit**

```bash
git add .env.example
git commit -m "docs: add encryption config to .env.example"
```

---

## Task 15: End-to-End Test

**Files:**
- None (manual verification)

**Step 1: Generate a test secret**

```bash
openssl rand -hex 32
# Copy output for next steps
```

**Step 2: Build encrypted version**

```bash
STATIC_CRYPT_SECRET=<your-secret> STATIC_CRYPT_TIERS=family npm run build:encrypted
```

**Step 3: Verify output**

```bash
ls -la build/data/
# Should see: persons.family.enc

cat build/data/persons.family.enc | head -c 200
# Should see JSON with v, nonce, ciphertext fields
```

**Step 4: Generate QR code**

```bash
STATIC_CRYPT_SECRET=<your-secret> npx static-crypt qr family --base-url http://localhost:4173/ --out ./qrcodes/
```

**Step 5: Preview and test**

```bash
npm run preview
# Open the URL from QR code in browser
# Should load and display family tree
```

**Step 6: Test revocation**

```bash
rm build/data/persons.family.enc
# Refresh browser - should show "Access Denied" message
```

**Step 7: Commit any fixes if needed**

---

## Summary

This plan creates a standalone `static-crypt` library in the monorepo with:

1. **Core crypto** (Tasks 2-5): HKDF derivation, AES-256-GCM encryption, browser-compatible via Web Crypto API
2. **URL/storage handling** (Tasks 6-7): Fragment parsing, localStorage persistence, decrypt function
3. **QR generation** (Task 8): PNG and data URL output
4. **CLI** (Task 9): `encrypt` and `qr` commands
5. **Integration** (Tasks 11-14): Build script, Svelte component, config updates

The library is generic and can be extracted for other projects. The family tree becomes the first consumer.
