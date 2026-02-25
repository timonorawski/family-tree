# Static-Crypt: Tiered Encryption for Static Sites

**Date:** 2026-02-25
**Status:** Approved

## Problem

The family tree static site needs access control without server-side authentication. Requirements:

- 100% CDN-cacheable static files
- Tiered access (e.g., family, extended, researcher)
- Per-tier revocation without affecting other tiers
- Time-limited access via CDN regeneration (client-side time is untrusted)
- Graceful error messages for revoked/expired access
- QR codes as side-channel for key distribution

## Solution

A reusable library (`static-crypt`) that encrypts data blobs for multiple named tiers. Each tier gets its own independently-encrypted file. Revocation is as simple as deleting a file from the CDN.

## Design Decisions

### Per-Tier Files vs. Shared Blob

**Chosen:** Per-tier files (`data.family.enc`, `data.extended.enc`, etc.)

**Trade-off:** Storage overhead (N copies of the data) in exchange for:
- Emergency revocation via CDN file deletion
- Independent cache control per tier
- Simpler encryption structure (no key wrapping)

### Symmetric vs. Asymmetric Encryption

**Chosen:** Symmetric (HKDF + AES-GCM)

**Rationale:** Asymmetric keys provide no practical benefit for this threat model. The QR code is the secret either way. Asymmetric approach reserved for future per-user revocation if needed.

### Library Scope

The library is application-agnostic. It handles:
- Encrypting blobs for named tiers
- Decrypting in browser with Web Crypto API
- QR code generation

It does NOT handle:
- Application semantics (family tree, JSON structure)
- UI (error messages are consumer's responsibility)
- CDN deployment or caching headers

## Cryptographic Design

### Key Derivation

```
masterSecret (32 bytes, from env)
    │
    └─► HKDF-SHA256(master, salt="static-crypt", info="tier:" + tierName)
            │
            └─► tierKey (32 bytes per tier)
```

### Encryption

1. Generate random nonce (12 bytes)
2. Encrypt plaintext with AES-256-GCM(tierKey, nonce) → ciphertext
3. Output bundle: `{ v: 1, nonce: "<base64>", ciphertext: "<base64>" }`

### Bundle Format

Each `.enc` file is self-contained JSON:

```json
{
  "v": 1,
  "nonce": "<base64>",
  "ciphertext": "<base64>"
}
```

### URL Fragment Format

```
https://tree.example.com/#t=family&k=<base64url-tier-key>
```

- `t` = tier name
- `k` = base64url-encoded tier key

### Revocation

Remove the tier's `.enc` file from CDN. The tier key becomes useless.

## Library Structure

```
/packages/static-crypt/
  ├── src/
  │   ├── index.mjs          # Node.js exports (encrypt, deriveTierKey)
  │   ├── browser.mjs        # Browser exports (decrypt, getKeyFromFragment)
  │   ├── crypto.mjs         # Shared HKDF/AES-GCM primitives
  │   └── qr.mjs             # QR code generation
  ├── bin/
  │   └── static-crypt.mjs   # CLI entry point
  ├── package.json
  └── README.md
```

## API

### Node.js (Build-time)

```js
import { encrypt, generateQRCode, deriveTierKey } from 'static-crypt';

// Encrypt for multiple tiers
const results = await encrypt(plaintextBuffer, {
  masterSecret: process.env.STATIC_CRYPT_SECRET,
  tiers: ['family', 'extended', 'researcher']
});
// results = { family: { nonce, ciphertext }, extended: {...}, ... }

// Generate QR code
const qrDataUrl = await generateQRCode('family', {
  masterSecret: process.env.STATIC_CRYPT_SECRET,
  baseUrl: 'https://tree.example.com/'
});
```

### Browser (Runtime)

```js
import { decrypt, getKeyFromFragment } from 'static-crypt/browser';

const { tier, key } = getKeyFromFragment();
// tier = "family", key = Uint8Array

const plaintext = await decrypt(bundle, key);
// plaintext = Uint8Array
```

## CLI Interface

```bash
# Encrypt a file for specified tiers
static-crypt encrypt data.json --tiers family,extended,researcher --out ./static/data/
# Output: ./static/data/data.family.enc, data.extended.enc, data.researcher.enc

# Generate QR code for a tier
static-crypt qr family --base-url https://tree.example.com/ --out ./qr-family.png

# Generate all QR codes
static-crypt qr --all --base-url https://tree.example.com/ --out ./qrcodes/
```

### Configuration

Master secret via environment variable or flag:

```bash
STATIC_CRYPT_SECRET=<32-byte-hex-or-base64>
# or
--secret <value>
# or
--secret-file .secret
```

## Family Tree Integration

### Build Pipeline

```
npm run build (vite)
    │
    └─► /build/persons.json
            │
            └─► npm run build:encrypt (static-crypt)
                    │
                    ├─► /build/data/data.family.enc
                    ├─► /build/data/data.extended.enc
                    └─► (delete persons.json)
```

### package.json Scripts

```json
{
  "scripts": {
    "build": "vite build",
    "build:encrypt": "static-crypt encrypt ./build/persons.json --tiers family,extended --out ./build/data/",
    "build:static": "npm run build && npm run build:encrypt"
  }
}
```

### SvelteKit Integration

`+page.svelte` wraps initialization in decryption:

```js
import { decrypt, getKeyFromFragment } from 'static-crypt/browser';

let persons = null;
let accessState = 'loading'; // 'loading' | 'ready' | 'denied' | 'prompt'

onMount(async () => {
  const { tier, key } = getKeyFromFragment();
  if (!tier) { accessState = 'prompt'; return; }

  try {
    const res = await fetch(`/data/data.${tier}.enc`);
    if (!res.ok) { accessState = 'denied'; return; }

    const bundle = await res.json();
    persons = JSON.parse(await decrypt(bundle, key));
    accessState = 'ready';
  } catch {
    accessState = 'denied';
  }
});
```

### Access States

| State | UI |
|-------|-----|
| `loading` | Spinner or blank |
| `ready` | Family tree visualization |
| `denied` | "Access expired or revoked. Contact the tree owner." |
| `prompt` | "Scan QR code to access" (or input field) |

### Unencrypted Mode

For local development and the editable server, skip decryption. Detect via:
- Absence of URL fragment, or
- `VITE_ENCRYPTED=false` build flag

## Browser Runtime Details

### localStorage Persistence

- On load, check localStorage before prompting for QR
- If found, attempt decrypt; on failure, clear and show graceful message
- URL fragment always takes precedence (allows re-sharing fresh links)

```js
// Keys
localStorage.getItem('static-crypt-tier')
localStorage.getItem('static-crypt-key')
```

### Bundle Size

Zero dependencies — uses native Web Crypto API (`crypto.subtle`). Browser module target: <2KB minified.

## Future Enhancements

### Asymmetric Keys (Approach B)

For per-user revocation without full rebuild:
- Each user gets a keypair derived from master
- Data key encrypted to each user's public key
- Revoke by removing their encrypted key from bundle

### Public Tier with Sanitized Data

A separate build step that:
1. Sanitizes data (remove birthdates for living people, maiden names, etc.)
2. Outputs as `data.public.enc` or unencrypted `data.public.json`

Sanitization logic is application-specific, not part of `static-crypt`.

### Depth-Limited Sharing

Tier keys could derive sub-keys with limited re-sharing depth. Not needed for initial implementation.

## Security Considerations

- Master secret must be kept secure (env var, CI secret)
- Tier keys in URL fragments are never sent to server (fragment is client-only)
- AES-GCM provides authenticated encryption (tampering detected)
- HKDF provides proper key separation between tiers
- No forward secrecy (acceptable for this threat model)

## Non-Goals

- Server-side authentication
- Per-request access logging
- Real-time revocation (requires CDN purge or rebuild)
- Encryption of HTML/JS/CSS (only data blob)
