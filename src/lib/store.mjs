import fs from 'node:fs';
import path from 'node:path';
import yaml from 'js-yaml';
import { validate } from './person-schema.mjs';

const PERSONS_DIR = path.resolve('data/persons');

export { PERSONS_DIR };

export function slugify(name) {
  return name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '');
}

/** Load all persons. Returns { [slug]: data } */
export function loadAll() {
  const persons = {};
  for (const file of fs.readdirSync(PERSONS_DIR)) {
    if (!file.endsWith('.yaml')) continue;
    const slug = file.replace('.yaml', '');
    const content = fs.readFileSync(path.join(PERSONS_DIR, file), 'utf-8');
    persons[slug] = yaml.load(content);
  }
  return persons;
}

/** Load one person by slug. Returns data or null. */
export function getOne(slug) {
  const fp = path.join(PERSONS_DIR, `${slug}.yaml`);
  if (!fs.existsSync(fp)) return null;
  return yaml.load(fs.readFileSync(fp, 'utf-8'));
}

/** Strip empty/null scalar values from object. Preserves objects and arrays. */
function cleanEmpty(obj) {
  const out = { ...obj };
  for (const [k, v] of Object.entries(out)) {
    if (v === '' || v === null || v === undefined) delete out[k];
    else if (typeof v === 'object' && !Array.isArray(v) && v !== null && Object.keys(v).length === 0) delete out[k];
  }
  return out;
}

/** Replace oldSlug with newSlug in every other person's relationships array. */
function rewriteReferences(oldSlug, newSlug) {
  for (const file of fs.readdirSync(PERSONS_DIR)) {
    if (!file.endsWith('.yaml')) continue;
    const fp = path.join(PERSONS_DIR, file);
    const data = yaml.load(fs.readFileSync(fp, 'utf-8'));
    let changed = false;
    if (Array.isArray(data.relationships)) {
      for (const rel of data.relationships) {
        if (rel.person === oldSlug) { rel.person = newSlug; changed = true; }
      }
    }
    if (changed) fs.writeFileSync(fp, yaml.dump(data, { lineWidth: -1 }), 'utf-8');
  }
}

/**
 * Create a new person. Returns { slug, ...data }.
 * Throws on validation failure.
 */
export function create(data) {
  const result = validate(data);
  if (!result.valid) throw new Error(`Validation failed: ${result.errors.join(', ')}`);

  const given = data.name.given;
  let slug = slugify(given);
  let candidate = slug;
  let counter = 1;
  while (fs.existsSync(path.join(PERSONS_DIR, `${candidate}.yaml`))) {
    candidate = `${slug}-${counter++}`;
  }
  slug = candidate;

  fs.writeFileSync(path.join(PERSONS_DIR, `${slug}.yaml`), yaml.dump(data, { lineWidth: -1 }), 'utf-8');
  return { slug, ...data };
}

/**
 * Update a person by slug. Full replace of person data.
 * Returns { slug, ...data } (slug may change if name changed).
 * Throws on not found or validation failure.
 */
export function update(slug, data) {
  const fp = path.join(PERSONS_DIR, `${slug}.yaml`);
  if (!fs.existsSync(fp)) throw new Error(`Person not found: ${slug}`);

  const cleaned = cleanEmpty(data);
  const result = validate(cleaned);
  if (!result.valid) throw new Error(`Validation failed: ${result.errors.join(', ')}`);

  fs.writeFileSync(fp, yaml.dump(cleaned, { lineWidth: -1 }), 'utf-8');
  return { slug, ...cleaned };
}

/**
 * Rename a person's slug. Updates the filename and all references in other persons.
 * Returns { oldSlug, newSlug }.
 * Throws on not found or if newSlug already exists.
 */
export function rename(oldSlug, newSlug) {
  const fp = path.join(PERSONS_DIR, `${oldSlug}.yaml`);
  if (!fs.existsSync(fp)) throw new Error(`Person not found: ${oldSlug}`);
  const newPath = path.join(PERSONS_DIR, `${newSlug}.yaml`);
  if (fs.existsSync(newPath)) throw new Error(`Slug already exists: ${newSlug}`);

  fs.renameSync(fp, newPath);
  rewriteReferences(oldSlug, newSlug);
  return { oldSlug, newSlug };
}

/**
 * Delete a person. Returns { deleted, danglingRefs }.
 * Throws on not found.
 */
export function remove(slug) {
  const fp = path.join(PERSONS_DIR, `${slug}.yaml`);
  if (!fs.existsSync(fp)) throw new Error(`Person not found: ${slug}`);

  fs.unlinkSync(fp);

  // Find dangling references
  const danglingRefs = [];
  for (const file of fs.readdirSync(PERSONS_DIR)) {
    if (!file.endsWith('.yaml')) continue;
    const otherSlug = file.replace('.yaml', '');
    const data = yaml.load(fs.readFileSync(path.join(PERSONS_DIR, file), 'utf-8'));
    if (Array.isArray(data.relationships)) {
      for (const rel of data.relationships) {
        if (rel.person === slug) {
          danglingRefs.push({ slug: otherSlug, type: rel.type });
        }
      }
    }
  }

  return { deleted: slug, danglingRefs };
}

/**
 * Add a relationship atomically.
 * - parent: adds {type: parent, person: targetSlug} to slug's file.
 * - partner: adds to both sides.
 * Throws if either person not found or relationship already exists.
 */
export function addRelationship(slug, targetSlug, type) {
  if (!['parent', 'partner'].includes(type)) throw new Error(`Invalid relationship type: ${type}`);
  const fp = path.join(PERSONS_DIR, `${slug}.yaml`);
  if (!fs.existsSync(fp)) throw new Error(`Person not found: ${slug}`);
  const tfp = path.join(PERSONS_DIR, `${targetSlug}.yaml`);
  if (!fs.existsSync(tfp)) throw new Error(`Person not found: ${targetSlug}`);

  function addRel(filePath, rel) {
    const data = yaml.load(fs.readFileSync(filePath, 'utf-8'));
    if (!data.relationships) data.relationships = [];
    const exists = data.relationships.some(r => r.type === rel.type && r.person === rel.person);
    if (exists) return false;
    data.relationships.push(rel);
    fs.writeFileSync(filePath, yaml.dump(data, { lineWidth: -1 }), 'utf-8');
    return true;
  }

  const added = addRel(fp, { type, person: targetSlug });
  if (type === 'partner') {
    addRel(tfp, { type: 'partner', person: slug });
  }

  return { slug, targetSlug, type, added };
}

/**
 * Remove a relationship atomically.
 * - parent: removes {type: parent, person: targetSlug} from slug's file.
 * - partner: removes from both sides.
 * Throws if either person not found.
 */
export function removeRelationship(slug, targetSlug, type) {
  if (!['parent', 'partner'].includes(type)) throw new Error(`Invalid relationship type: ${type}`);
  const fp = path.join(PERSONS_DIR, `${slug}.yaml`);
  if (!fs.existsSync(fp)) throw new Error(`Person not found: ${slug}`);
  const tfp = path.join(PERSONS_DIR, `${targetSlug}.yaml`);
  if (!fs.existsSync(tfp)) throw new Error(`Person not found: ${targetSlug}`);

  function removeRel(filePath, relType, relPerson) {
    const data = yaml.load(fs.readFileSync(filePath, 'utf-8'));
    if (!data.relationships) return false;
    const before = data.relationships.length;
    data.relationships = data.relationships.filter(r => !(r.type === relType && r.person === relPerson));
    if (data.relationships.length === before) return false;
    if (data.relationships.length === 0) delete data.relationships;
    fs.writeFileSync(filePath, yaml.dump(data, { lineWidth: -1 }), 'utf-8');
    return true;
  }

  const removed = removeRel(fp, type, targetSlug);
  if (type === 'partner') {
    removeRel(tfp, 'partner', slug);
  }

  return { slug, targetSlug, type, removed };
}

/**
 * Search persons by query string. Matches against name, profession, interesting_facts.
 * Returns [{ slug, ...data }].
 */
export function search(query) {
  const q = query.toLowerCase();
  const all = loadAll();
  return Object.entries(all)
    .filter(([slug, p]) => {
      const given = (typeof p.name === 'object' ? p.name.given : p.name) || '';
      const searchable = [
        slug, given,
        p.name?.given_at_birth, p.name?.preferred,
        p.name?.surnames?.current, p.name?.surnames?.birth,
        p.profession, p.interesting_facts, p.country_of_birth
      ].filter(Boolean).join(' ').toLowerCase();
      return searchable.includes(q);
    })
    .map(([slug, data]) => ({ slug, ...data }));
}
