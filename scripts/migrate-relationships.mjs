import fs from 'node:fs';
import path from 'node:path';
import yaml from 'js-yaml';

const DIR = path.resolve('data/persons');

let migrated = 0;
let skipped = 0;

for (const file of fs.readdirSync(DIR)) {
  if (!file.endsWith('.yaml')) continue;
  const fp = path.join(DIR, file);
  const data = yaml.load(fs.readFileSync(fp, 'utf-8'));

  // Skip if already migrated
  if (data.relationships) { skipped++; continue; }

  const relationships = [];
  for (const p of (data.parents || [])) {
    relationships.push({ type: 'parent', person: p });
  }
  for (const p of (data.partners || [])) {
    relationships.push({ type: 'partner', person: p });
  }

  delete data.parents;
  delete data.partners;
  if (relationships.length) data.relationships = relationships;

  fs.writeFileSync(fp, yaml.dump(data, { lineWidth: -1 }), 'utf-8');
  migrated++;
}

console.log(`Migrated: ${migrated}, Skipped: ${skipped}`);
