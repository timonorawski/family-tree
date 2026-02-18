import { readFileSync, writeFileSync, mkdirSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import yaml from 'js-yaml';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, '..');
const OUTPUT_DIR = join(ROOT, 'data', 'persons');

// --- Read source data ---
const people = JSON.parse(readFileSync(join(ROOT, 'tree.json'), 'utf8'));
console.log(`Read ${people.length} people from tree.json`);

// --- Slug generation ---

function toBaseSlug(name) {
  // Strip parenthetical nicknames: "Norry (Norris)" → "Norry"
  let clean = name.replace(/\s*\(.*?\)\s*/g, '').trim();
  // Lowercase, replace non-alphanumeric runs with hyphens, trim hyphens
  return clean
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '');
}

// Count how many times each base slug appears
const slugCounts = new Map();
for (const person of people) {
  const base = toBaseSlug(person.name);
  slugCounts.set(base, (slugCounts.get(base) || 0) + 1);
}

// For duplicate slugs, we need stable ordering. Use a deterministic approach:
// among people sharing a base slug, assign numbers by who appears as a parent first.
const slugCounters = new Map();
const idToSlug = new Map();

// Build a set of all IDs that appear as parents
const parentIdSet = new Set();
for (const person of people) {
  if (person.parentIds) {
    for (const pid of person.parentIds) parentIdSet.add(pid);
  }
}

// Sort people so that those who are parents of others come first (get lower number)
const sortedPeople = [...people].sort((a, b) => {
  const aIsParent = parentIdSet.has(a.id) ? 0 : 1;
  const bIsParent = parentIdSet.has(b.id) ? 0 : 1;
  return aIsParent - bIsParent;
});

for (const person of sortedPeople) {
  const base = toBaseSlug(person.name);
  let slug;
  if (slugCounts.get(base) > 1) {
    const num = (slugCounters.get(base) || 0) + 1;
    slugCounters.set(base, num);
    slug = `${base}-${num}`;
  } else {
    slug = base;
  }
  idToSlug.set(person.id, slug);
}

// --- Date cleaning ---
function cleanDate(dateStr) {
  if (!dateStr) return null;
  // Extract YYYY-MM-DD from ISO string
  const match = dateStr.match(/^(\d{4}-\d{2}-\d{2})/);
  return match ? match[1] : null;
}

// --- Build YAML files ---
mkdirSync(OUTPUT_DIR, { recursive: true });

let fileCount = 0;
const allSlugs = new Set(idToSlug.values());

for (const person of people) {
  const slug = idToSlug.get(person.id);
  const doc = {};

  // name (required)
  doc.name = person.name;

  // gender (required)
  doc.gender = person.gender;

  // Optional fields — only include if non-empty
  const dob = cleanDate(person.dob);
  if (dob) doc.dob = dob;

  const dod = cleanDate(person.dod);
  if (dod) doc.dod = dod;

  if (person.deceased === true) doc.deceased = true;

  if (person.surnameAtBirth) doc.surname_at_birth = person.surnameAtBirth;
  if (person.surnameNow) doc.surname_now = person.surnameNow;
  if (person.countryOfBirth) doc.country_of_birth = person.countryOfBirth;
  if (person.profession) doc.profession = person.profession;
  if (person.interestingFacts) doc.interesting_facts = person.interestingFacts;
  if (person.defaultImageName) doc.image = person.defaultImageName;

  // Parents — convert IDs to slugs
  if (person.parentIds && person.parentIds.length > 0) {
    const parentSlugs = person.parentIds
      .map(pid => idToSlug.get(pid))
      .filter(Boolean);
    if (parentSlugs.length > 0) doc.parents = parentSlugs;
  }

  // Partners — convert IDs to slugs
  if (person.partners && person.partners.length > 0) {
    const partnerSlugs = person.partners
      .map(pid => idToSlug.get(pid))
      .filter(Boolean);
    if (partnerSlugs.length > 0) doc.partners = partnerSlugs;
  }

  // Serialize to YAML
  const yamlStr = yaml.dump(doc, {
    lineWidth: -1,       // no line wrapping
    quotingType: "'",
    forceQuotes: false,
    noRefs: true,
  });

  writeFileSync(join(OUTPUT_DIR, `${slug}.yaml`), yamlStr);
  fileCount++;
}

console.log(`\nWrote ${fileCount} YAML files to data/persons/`);

// --- Verification ---
console.log('\n--- Verification ---');

// Check all cross-references point to existing files
let brokenRefs = 0;
for (const person of people) {
  const slug = idToSlug.get(person.id);
  const refs = [
    ...(person.parentIds || []).map(pid => idToSlug.get(pid)),
    ...(person.partners || []).map(pid => idToSlug.get(pid)),
  ].filter(Boolean);
  for (const ref of refs) {
    if (!allSlugs.has(ref)) {
      console.log(`  BROKEN REF: ${slug} -> ${ref}`);
      brokenRefs++;
    }
  }
}
console.log(`Cross-reference check: ${brokenRefs === 0 ? 'ALL OK' : `${brokenRefs} broken refs`}`);

// Spot-check a few people
const spotChecks = ['timon', 'sonia', 'norry', 'edward'];
for (const s of spotChecks) {
  const match = [...allSlugs].find(slug => slug.startsWith(s));
  if (match) {
    const content = readFileSync(join(OUTPUT_DIR, `${match}.yaml`), 'utf8');
    console.log(`\n--- ${match}.yaml ---`);
    console.log(content);
  }
}
