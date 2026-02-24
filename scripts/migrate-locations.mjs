import fs from 'node:fs';
import path from 'node:path';
import yaml from 'js-yaml';

const DIR = path.resolve('data/persons');

const COUNTRY_TO_REGION = {
  'Scotland': 'scotland',
  'Ireland': 'ireland',
  'England': 'england',
  'Canada': 'canada',
  'Poland': 'poland',
  'Hungary': 'hungary',
  'United States': 'united-states',
};

let migrated = 0;
let skipped = 0;
let alreadyMigrated = 0;
let noFields = 0;

for (const file of fs.readdirSync(DIR).sort()) {
  if (!file.endsWith('.yaml')) continue;
  const fp = path.join(DIR, file);
  const raw = fs.readFileSync(fp, 'utf-8');
  const data = yaml.load(raw);

  // Skip files that already have locations
  if (data.locations) {
    alreadyMigrated++;
    console.log(`  SKIP (already migrated): ${file}`);
    continue;
  }

  const hasDob = 'dob' in data;
  const hasDod = 'dod' in data;
  const hasCountry = 'country_of_birth' in data;

  // Skip files with none of the legacy fields
  if (!hasDob && !hasDod && !hasCountry) {
    noFields++;
    continue;
  }

  // Build the locations object
  const locations = {};

  if (hasDob || hasCountry) {
    locations.birth = {};
    if (hasDob) locations.birth.date = data.dob;
    if (hasCountry) {
      const region = COUNTRY_TO_REGION[data.country_of_birth];
      if (!region) {
        console.error(`  ERROR: Unknown country "${data.country_of_birth}" in ${file}`);
        skipped++;
        continue;
      }
      locations.birth.region = region;
    }
  }

  if (hasDod) {
    locations.death = { date: data.dod };
  }

  // Delete old fields
  delete data.dob;
  delete data.dod;
  delete data.country_of_birth;

  // Add locations
  data.locations = locations;

  // Write back. lineWidth: -1 prevents js-yaml from wrapping long strings.
  fs.writeFileSync(fp, yaml.dump(data, { lineWidth: -1, quotingType: "'", forceQuotes: false }), 'utf-8');
  migrated++;
  console.log(`  MIGRATED: ${file}`);
}

console.log('\n--- Summary ---');
console.log(`Migrated:         ${migrated}`);
console.log(`Already migrated: ${alreadyMigrated}`);
console.log(`Skipped (error):  ${skipped}`);
console.log(`No fields:        ${noFields}`);
console.log(`Total files:      ${migrated + alreadyMigrated + skipped + noFields}`);
