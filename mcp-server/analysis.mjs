import { loadAll, getOne } from '../src/lib/store.mjs';
import { validate } from '../src/lib/person-schema.mjs';

/** Extract parent slugs from a person's relationships array. */
function getParents(p) {
  return (p.relationships || []).filter(r => r.type === 'parent').map(r => r.person);
}

/** Extract partner slugs from a person's relationships array. */
function getPartners(p) {
  return (p.relationships || []).filter(r => r.type === 'partner').map(r => r.person);
}

export function getAncestors(slug, depth = 10) {
  const all = loadAll();
  function walk(s, d) {
    const p = all[s];
    if (!p || d <= 0) return null;
    const node = { slug: s, name: p.name };
    node.parents = getParents(p)
      .filter(ps => all[ps])
      .map(ps => walk(ps, d - 1))
      .filter(Boolean);
    return node;
  }
  return walk(slug, depth);
}

export function getDescendants(slug, depth = 10) {
  const all = loadAll();
  const childrenOf = new Map();
  for (const [s, p] of Object.entries(all)) {
    for (const ps of getParents(p)) {
      if (!childrenOf.has(ps)) childrenOf.set(ps, []);
      childrenOf.get(ps).push(s);
    }
  }
  function walk(s, d) {
    const p = all[s];
    if (!p || d <= 0) return null;
    const node = { slug: s, name: p.name };
    node.children = (childrenOf.get(s) || [])
      .map(cs => walk(cs, d - 1))
      .filter(Boolean);
    return node;
  }
  return walk(slug, depth);
}

export function getRelatives(slug) {
  const all = loadAll();
  const p = all[slug];
  if (!p) return null;

  const brief = (s) => ({ slug: s, name: all[s]?.name });

  const parents = getParents(p).filter(s => all[s]).map(brief);

  const parentSlugs = getParents(p);
  const sibSlugs = new Set();
  for (const ps of parentSlugs) {
    for (const [s, d] of Object.entries(all)) {
      if (s !== slug && getParents(d).includes(ps)) sibSlugs.add(s);
    }
  }
  const siblings = [...sibSlugs].map(brief);

  const partners = getPartners(p).filter(s => all[s]).map(brief);

  const children = Object.entries(all)
    .filter(([s, d]) => getParents(d).includes(slug))
    .map(([s]) => brief(s));

  return { parents, siblings, partners, children };
}

export function validateTree() {
  const all = loadAll();
  const issues = [];

  for (const [slug, data] of Object.entries(all)) {
    const result = validate(data);
    if (!result.valid) {
      issues.push({ type: 'schema', slug, message: result.errors.join(', ') });
    }

    for (const rel of (data.relationships || [])) {
      if (!all[rel.person]) {
        issues.push({ type: 'dangling_ref', slug, message: `${rel.type} "${rel.person}" not found` });
      }
    }

    // Check asymmetric partners
    for (const ps of getPartners(data)) {
      if (all[ps] && !getPartners(all[ps]).includes(slug)) {
        issues.push({ type: 'asymmetric_partner', slug, message: `lists "${ps}" as partner but "${ps}" does not list "${slug}" back` });
      }
    }

    for (const story of (data.stories || [])) {
      for (const ps of (story.people || [])) {
        if (!all[ps]) issues.push({ type: 'dangling_ref', slug, message: `story person "${ps}" not found` });
      }
    }
  }

  return issues;
}

export function getStatistics() {
  const all = loadAll();
  const slugs = Object.keys(all);
  const total = slugs.length;
  const male = slugs.filter(s => all[s].gender === 'male').length;
  const female = slugs.filter(s => all[s].gender === 'female').length;
  const withDob = slugs.filter(s => all[s].dob).length;
  const withDod = slugs.filter(s => all[s].dod).length;
  const withProfession = slugs.filter(s => all[s].profession).length;
  const withResearch = slugs.filter(s => all[s].research?.length).length;
  const withStories = slugs.filter(s => all[s].stories?.length).length;
  const withRelationships = slugs.filter(s => all[s].relationships?.length).length;
  const dobs = slugs.map(s => all[s].dob).filter(Boolean).sort();

  return {
    total, male, female,
    dob_range: dobs.length ? { earliest: dobs[0], latest: dobs[dobs.length - 1] } : null,
    coverage: {
      dob: `${withDob}/${total}`,
      dod: `${withDod}/${total}`,
      profession: `${withProfession}/${total}`,
      relationships: `${withRelationships}/${total}`,
      research: `${withResearch}/${total}`,
      stories: `${withStories}/${total}`
    }
  };
}
