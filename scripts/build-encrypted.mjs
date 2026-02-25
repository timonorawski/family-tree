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
