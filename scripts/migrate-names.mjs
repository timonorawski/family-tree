/**
 * Migrate YAML person files from flat name to structured name:
 *   name: "Timon"         →  name:
 *   surname_now: "X"           given: Timon
 *   surname_at_birth: "Y"     surnames:
 *                                current: X
 *                                birth: Y
 */
import fs from 'node:fs';
import path from 'node:path';
import yaml from 'js-yaml';

const PERSONS_DIR = path.resolve('data/persons');

for (const file of fs.readdirSync(PERSONS_DIR)) {
	if (!file.endsWith('.yaml')) continue;
	const fp = path.join(PERSONS_DIR, file);
	const data = yaml.load(fs.readFileSync(fp, 'utf-8'));

	// Skip if already migrated
	if (typeof data.name === 'object') continue;

	const oldName = data.name;
	const newName = { given: oldName };

	// Migrate surname fields if present
	const surnames = {};
	if (data.surname_now) {
		surnames.current = data.surname_now;
		delete data.surname_now;
	}
	if (data.surname_at_birth) {
		surnames.birth = data.surname_at_birth;
		delete data.surname_at_birth;
	}
	if (Object.keys(surnames).length) {
		newName.surnames = surnames;
	}

	data.name = newName;

	fs.writeFileSync(fp, yaml.dump(data, { lineWidth: -1 }), 'utf-8');
	console.log(`Migrated: ${file}`);
}

console.log('Done.');
