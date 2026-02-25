#!/usr/bin/env node
// packages/static-crypt/bin/static-crypt.mjs

import { parseArgs } from 'node:util';
import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { join, basename } from 'node:path';
import { encrypt } from '../src/encrypt.mjs';
import { generateQRCode } from '../src/qr.mjs';
import { deriveTierKey } from '../src/crypto.mjs';

// Load .env file if present
async function loadEnv() {
  try {
    const content = await readFile('.env', 'utf8');
    for (const line of content.split('\n')) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith('#')) continue;
      const eqIndex = trimmed.indexOf('=');
      if (eqIndex === -1) continue;
      const key = trimmed.slice(0, eqIndex).trim();
      let value = trimmed.slice(eqIndex + 1).trim();
      // Remove quotes if present
      if ((value.startsWith('"') && value.endsWith('"')) ||
          (value.startsWith("'") && value.endsWith("'"))) {
        value = value.slice(1, -1);
      }
      // Don't override existing env vars
      if (!process.env[key]) {
        process.env[key] = value;
      }
    }
  } catch {
    // No .env file, that's fine
  }
}

await loadEnv();

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

function getBaseUrl(args) {
  const baseUrl = args.values['base-url'] || process.env.STATIC_CRYPT_BASE_URL;
  if (!baseUrl) {
    throw new Error('No base URL provided. Use --base-url or STATIC_CRYPT_BASE_URL env var');
  }
  return baseUrl;
}

/**
 * Base64url encode a Buffer
 */
function base64urlEncode(buffer) {
  return buffer.toString('base64')
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/, '');
}

/**
 * Build a full URL with tier key fragment
 */
function buildUrl(baseUrl, tier, tierKey) {
  const keyStr = base64urlEncode(tierKey);
  const base = baseUrl.endsWith('/') ? baseUrl : baseUrl + '/';
  return `${base}#t=${encodeURIComponent(tier)}&k=${keyStr}`;
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

async function cmdUrl() {
  const [tier] = positional;
  const secret = await getSecret(args);

  let baseUrl;
  try {
    baseUrl = getBaseUrl(args);
  } catch (e) {
    console.error('Usage: static-crypt url <tier> --base-url <url>');
    console.error('   or: static-crypt url --all --base-url <url>');
    console.error('\nOr set STATIC_CRYPT_BASE_URL environment variable');
    process.exit(1);
  }

  const tiersToGenerate = args.values.all ? getTiers(args) : [tier];

  if (!args.values.all && !tier) {
    console.error('Specify a tier or use --all');
    process.exit(1);
  }

  for (const t of tiersToGenerate) {
    const tierKey = await deriveTierKey(secret, t);
    const url = buildUrl(baseUrl, t, tierKey);
    if (args.values.all) {
      console.log(`${t}: ${url}`);
    } else {
      console.log(url);
    }
  }
}

async function cmdQr() {
  const [tier] = positional;
  const secret = await getSecret(args);
  const outDir = args.values.out || '.';

  let baseUrl;
  try {
    baseUrl = getBaseUrl(args);
  } catch (e) {
    console.error('Usage: static-crypt qr <tier> --base-url <url> --out <dir>');
    console.error('   or: static-crypt qr --all --base-url <url> --out <dir>');
    console.error('\nOr set STATIC_CRYPT_BASE_URL environment variable');
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
  url <tier>       Output access URL(s) for tier(s)
  qr <tier>        Generate QR code for a tier

Options:
  --tiers, -t      Comma-separated tier names
  --out, -o        Output directory (for encrypt/qr)
  --secret, -s     Master secret (hex)
  --secret-file    Path to file containing master secret
  --base-url, -u   Base URL for URLs/QR codes
  --all, -a        Process all tiers

Environment (also reads from .env file):
  STATIC_CRYPT_SECRET     Master secret (hex)
  STATIC_CRYPT_TIERS      Default tier list
  STATIC_CRYPT_BASE_URL   Base URL for URLs/QR codes

Examples:
  static-crypt encrypt data.json --tiers family,extended --out ./build/data/
  static-crypt url family
  static-crypt url --all
  static-crypt qr family --out ./qrcodes/
  static-crypt qr --all --out ./qrcodes/
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
  case 'url':
    await cmdUrl();
    break;
  case 'qr':
    await cmdQr();
    break;
  default:
    console.error(`Unknown command: ${command}`);
    showHelp();
    process.exit(1);
}
