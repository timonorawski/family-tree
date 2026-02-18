# Family Tree MCP Server — Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Build a validated store layer and MCP server so Claude Code can read, edit, and analyze the family tree through structured tools.

**Architecture:** Shared `person-schema.mjs` (JSON Schema + validate) and `store.mjs` (YAML CRUD) in `src/lib/`. Both SvelteKit API routes and a stdio MCP server consume them. The MCP server adds analysis tools (ancestors, descendants, validation, stats).

**Tech Stack:** `@modelcontextprotocol/sdk` (MCP), `ajv` (JSON Schema validation), `js-yaml` (existing), Node.js stdio transport.

---

### Task 1: Install dependencies

**Files:**
- Modify: `package.json`

**Step 1: Install ajv and MCP SDK**

Run: `npm install ajv @modelcontextprotocol/sdk`

**Step 2: Verify installation**

Run: `node -e "import('ajv').then(m => console.log('ajv ok')); import('@modelcontextprotocol/sdk/server/index.js').then(m => console.log('mcp ok'));"`
Expected: Both print "ok"

**Step 3: Commit**

```bash
git add package.json package-lock.json
git commit -m "deps: add ajv and @modelcontextprotocol/sdk"
```

---

### Task 2: Create person-schema.mjs

**Files:**
- Create: `src/lib/person-schema.mjs`

**Step 1: Write the schema and validate function**

```js
import Ajv from 'ajv';

const personSchema = {
  type: 'object',
  required: ['name', 'gender'],
  additionalProperties: false,
  properties: {
    name: {
      type: 'object',
      required: ['given'],
      additionalProperties: false,
      properties: {
        given: { type: 'string', minLength: 1 },
        middles: { type: 'array', items: { type: 'string' } },
        surnames: {
          type: 'object',
          additionalProperties: false,
          properties: {
            current: { type: 'string' },
            birth: { type: 'string' }
          }
        }
      }
    },
    gender: { type: 'string', enum: ['male', 'female'] },
    dob: { type: 'string', pattern: '^\\d{4}-\\d{2}-\\d{2}$' },
    dod: { type: 'string', pattern: '^\\d{4}-\\d{2}-\\d{2}$' },
    country_of_birth: { type: 'string' },
    deceased: { type: 'boolean' },
    profession: { type: 'string' },
    interesting_facts: { type: 'string' },
    parents: { type: 'array', items: { type: 'string' } },
    partners: { type: 'array', items: { type: 'string' } },
    research: {
      type: 'array',
      items: {
        type: 'object',
        additionalProperties: false,
        properties: {
          description: { type: 'string' },
          confidence: { type: 'number', minimum: 0, maximum: 100 },
          sources: { type: 'array', items: { type: 'string' } }
        }
      }
    },
    stories: {
      type: 'array',
      items: {
        type: 'object',
        additionalProperties: false,
        properties: {
          name: { type: 'string' },
          description: { type: 'string' },
          sources: { type: 'array', items: { type: 'string' } },
          places: { type: 'array', items: { type: 'string' } },
          dates: { type: 'array', items: { type: 'string' } },
          people: { type: 'array', items: { type: 'string' } }
        }
      }
    }
  }
};

const ajv = new Ajv({ allErrors: true });
const compiledValidate = ajv.compile(personSchema);

export { personSchema };

/**
 * Validate a person object against the schema.
 * Returns { valid: true } or { valid: false, errors: string[] }.
 */
export function validate(data) {
  const valid = compiledValidate(data);
  if (valid) return { valid: true };
  const errors = compiledValidate.errors.map(
    (e) => `${e.instancePath || '/'} ${e.message}`
  );
  return { valid: false, errors };
}
```

**Step 2: Smoke-test it**

Run: `node -e "import('./src/lib/person-schema.mjs').then(m => { console.log(m.validate({name:{given:'Test'},gender:'male'})); console.log(m.validate({name:'bad'})); })"`
Expected: First prints `{ valid: true }`, second prints `{ valid: false, errors: [...] }`

**Step 3: Commit**

```bash
git add src/lib/person-schema.mjs
git commit -m "feat: add person JSON Schema with validate()"
```

---

### Task 3: Create store.mjs

Extract all YAML read/write/slug/rename logic from the API routes into a shared store.

**Files:**
- Create: `src/lib/store.mjs`

**Step 1: Write the store module**

```js
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

/** Replace oldSlug with newSlug in every other person's parents/partners arrays. */
function rewriteReferences(oldSlug, newSlug) {
  for (const file of fs.readdirSync(PERSONS_DIR)) {
    if (!file.endsWith('.yaml')) continue;
    const fp = path.join(PERSONS_DIR, file);
    const data = yaml.load(fs.readFileSync(fp, 'utf-8'));
    let changed = false;
    for (const field of ['parents', 'partners']) {
      if (Array.isArray(data[field])) {
        const idx = data[field].indexOf(oldSlug);
        if (idx !== -1) { data[field][idx] = newSlug; changed = true; }
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

  // Check if slug needs to change
  let newSlug = slug;
  const given = cleaned.name?.given;
  if (given && slugify(given) !== slug) {
    newSlug = slugify(given);
    let candidate = newSlug;
    let counter = 1;
    while (fs.existsSync(path.join(PERSONS_DIR, `${candidate}.yaml`))) {
      candidate = `${newSlug}-${counter++}`;
    }
    newSlug = candidate;
    const newPath = path.join(PERSONS_DIR, `${newSlug}.yaml`);
    fs.renameSync(fp, newPath);
    rewriteReferences(slug, newSlug);
    fs.writeFileSync(newPath, yaml.dump(cleaned, { lineWidth: -1 }), 'utf-8');
  } else {
    fs.writeFileSync(fp, yaml.dump(cleaned, { lineWidth: -1 }), 'utf-8');
  }

  return { slug: newSlug, ...cleaned };
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
    for (const field of ['parents', 'partners']) {
      if (Array.isArray(data[field]) && data[field].includes(slug)) {
        danglingRefs.push({ slug: otherSlug, field });
      }
    }
  }

  return { deleted: slug, danglingRefs };
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
        p.name?.surnames?.current, p.name?.surnames?.birth,
        p.profession, p.interesting_facts, p.country_of_birth
      ].filter(Boolean).join(' ').toLowerCase();
      return searchable.includes(q);
    })
    .map(([slug, data]) => ({ slug, ...data }));
}
```

**Step 2: Smoke-test the store**

Run: `node -e "import('./src/lib/store.mjs').then(m => { const all = m.loadAll(); console.log(Object.keys(all).length, 'persons'); console.log(m.getOne('timon').name); })"`
Expected: `88 persons` and `{ given: 'Timon' }`

**Step 3: Commit**

```bash
git add src/lib/store.mjs
git commit -m "feat: add shared store with validated YAML CRUD"
```

---

### Task 4: Refactor API routes to use store

Replace inline fs/yaml/validation logic in the SvelteKit API routes with store calls.

**Files:**
- Modify: `src/routes/api/persons/+server.js` (full rewrite)
- Modify: `src/routes/api/persons/[slug]/+server.js` (full rewrite)
- Modify: `src/lib/load-tree.js` (delegate to store)

**Step 1: Rewrite `src/routes/api/persons/+server.js`**

```js
import { json } from '@sveltejs/kit';
import { loadAll, create } from '$lib/store.mjs';

export async function GET() {
  return json(loadAll());
}

export async function POST({ request }) {
  try {
    const body = await request.json();
    const result = create(body);
    return json(result, { status: 201 });
  } catch (e) {
    return json({ error: e.message }, { status: 400 });
  }
}
```

**Step 2: Rewrite `src/routes/api/persons/[slug]/+server.js`**

```js
import { json } from '@sveltejs/kit';
import { update, remove } from '$lib/store.mjs';

export async function PUT({ params, request }) {
  try {
    const body = await request.json();
    const result = update(params.slug, body);
    return json(result);
  } catch (e) {
    const status = e.message.includes('not found') ? 404 : 400;
    return json({ error: e.message }, { status });
  }
}

export async function DELETE({ params }) {
  try {
    const result = remove(params.slug);
    return json(result);
  } catch (e) {
    return json({ error: e.message }, { status: 404 });
  }
}
```

**Step 3: Simplify `src/lib/load-tree.js`**

```js
export { PERSONS_DIR, loadAll as loadPersons } from './store.mjs';
```

**Step 4: Verify the dev server still works**

Run: `npm run dev &` then `curl -s http://localhost:5173/api/persons | node -e "process.stdin.on('data',d=>console.log(Object.keys(JSON.parse(d)).length,'persons'))"`
Expected: `88 persons`

**Step 5: Commit**

```bash
git add src/routes/api/persons/+server.js src/routes/api/persons/\[slug\]/+server.js src/lib/load-tree.js
git commit -m "refactor: API routes delegate to shared store"
```

---

### Task 5: Create analysis module

**Files:**
- Create: `mcp-server/analysis.mjs`

**Step 1: Write the analysis module**

```js
import { loadAll, getOne } from '../src/lib/store.mjs';
import { validate } from '../src/lib/person-schema.mjs';

/**
 * Get ancestors of a person up to a given depth.
 * Returns nested tree: { slug, name, parents: [{ slug, name, parents: [...] }] }
 */
export function getAncestors(slug, depth = 10) {
  const all = loadAll();
  function walk(s, d) {
    const p = all[s];
    if (!p || d <= 0) return null;
    const node = { slug: s, name: p.name };
    node.parents = (p.parents || [])
      .filter(ps => all[ps])
      .map(ps => walk(ps, d - 1))
      .filter(Boolean);
    return node;
  }
  return walk(slug, depth);
}

/**
 * Get descendants of a person up to a given depth.
 * Returns nested tree: { slug, name, children: [...] }
 */
export function getDescendants(slug, depth = 10) {
  const all = loadAll();
  // Pre-compute children
  const childrenOf = new Map();
  for (const [s, p] of Object.entries(all)) {
    if (p.parents) {
      for (const ps of p.parents) {
        if (!childrenOf.has(ps)) childrenOf.set(ps, []);
        childrenOf.get(ps).push(s);
      }
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

/**
 * Get all direct relatives of a person.
 * Returns { parents, siblings, partners, children } with slug and name.
 */
export function getRelatives(slug) {
  const all = loadAll();
  const p = all[slug];
  if (!p) return null;

  const brief = (s) => ({ slug: s, name: all[s]?.name });

  const parents = (p.parents || []).filter(s => all[s]).map(brief);

  // Siblings: other children of the same parents
  const sibSlugs = new Set();
  for (const ps of (p.parents || [])) {
    const parent = all[ps];
    if (!parent) continue;
    for (const [s, d] of Object.entries(all)) {
      if (s !== slug && d.parents && d.parents.includes(ps)) sibSlugs.add(s);
    }
  }
  const siblings = [...sibSlugs].map(brief);

  const partners = (p.partners || []).filter(s => all[s]).map(brief);

  // Children: anyone who lists this slug as parent
  const children = Object.entries(all)
    .filter(([s, d]) => d.parents && d.parents.includes(slug))
    .map(([s]) => brief(s));

  return { parents, siblings, partners, children };
}

/**
 * Validate tree integrity.
 * Returns array of { type, slug, message } issues.
 */
export function validateTree() {
  const all = loadAll();
  const issues = [];

  for (const [slug, data] of Object.entries(all)) {
    // Schema validation
    const result = validate(data);
    if (!result.valid) {
      issues.push({ type: 'schema', slug, message: result.errors.join(', ') });
    }

    // Dangling parent refs
    for (const ps of (data.parents || [])) {
      if (!all[ps]) issues.push({ type: 'dangling_ref', slug, message: `parent "${ps}" not found` });
    }

    // Dangling partner refs
    for (const ps of (data.partners || [])) {
      if (!all[ps]) issues.push({ type: 'dangling_ref', slug, message: `partner "${ps}" not found` });
    }

    // One-way partner links (A lists B as partner but B doesn't list A)
    for (const ps of (data.partners || [])) {
      if (all[ps] && !(all[ps].partners || []).includes(slug)) {
        issues.push({ type: 'asymmetric_partner', slug, message: `lists "${ps}" as partner but "${ps}" does not list "${slug}" back` });
      }
    }

    // Dangling story people refs
    for (const story of (data.stories || [])) {
      for (const ps of (story.people || [])) {
        if (!all[ps]) issues.push({ type: 'dangling_ref', slug, message: `story person "${ps}" not found` });
      }
    }
  }

  return issues;
}

/**
 * Get tree statistics.
 */
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
  const withParents = slugs.filter(s => all[s].parents?.length).length;
  const withPartners = slugs.filter(s => all[s].partners?.length).length;
  const dobs = slugs.map(s => all[s].dob).filter(Boolean).sort();

  return {
    total, male, female,
    dob_range: dobs.length ? { earliest: dobs[0], latest: dobs[dobs.length - 1] } : null,
    coverage: {
      dob: `${withDob}/${total}`,
      dod: `${withDod}/${total}`,
      profession: `${withProfession}/${total}`,
      parents: `${withParents}/${total}`,
      partners: `${withPartners}/${total}`,
      research: `${withResearch}/${total}`,
      stories: `${withStories}/${total}`
    }
  };
}
```

**Step 2: Smoke-test**

Run: `node -e "import('./mcp-server/analysis.mjs').then(m => { console.log(JSON.stringify(m.getRelatives('timon'), null, 2)); console.log(m.validateTree().length, 'issues'); console.log(m.getStatistics().total, 'total persons'); })"`
Expected: Relatives for timon printed, issue count, 88 total persons

**Step 3: Commit**

```bash
git add mcp-server/analysis.mjs
git commit -m "feat: add tree analysis module (ancestors, descendants, validation, stats)"
```

---

### Task 6: Create MCP server

**Files:**
- Create: `mcp-server/index.mjs`

**Step 1: Write the MCP server**

This file registers all tools (CRUD + analysis) with JSON Schema input schemas and handles tool calls by delegating to store and analysis modules. Uses `@modelcontextprotocol/sdk` stdio transport.

See design doc at `docs/plans/2026-02-18-mcp-server-design.md` for the full tool list.

The server should:
- Import `McpServer` and `StdioServerTransport` from the SDK
- Register each tool with a name, description, input schema (using zod or inline JSON Schema), and handler function
- Connect via stdio
- Return structured JSON results from each tool
- Return errors as `isError: true` content

**Step 2: Smoke-test the server**

Run: `echo '{"jsonrpc":"2.0","id":1,"method":"initialize","params":{"protocolVersion":"2024-11-05","capabilities":{},"clientInfo":{"name":"test","version":"0.1"}}}' | node mcp-server/index.mjs`
Expected: JSON-RPC response with server capabilities

**Step 3: Commit**

```bash
git add mcp-server/index.mjs
git commit -m "feat: add MCP server with CRUD and analysis tools"
```

---

### Task 7: Add .mcp.json config and test end-to-end

**Files:**
- Create: `.mcp.json`

**Step 1: Write MCP config**

```json
{
  "family-tree": {
    "command": "node",
    "args": ["mcp-server/index.mjs"]
  }
}
```

**Step 2: Verify with `/mcp` command in Claude Code**

After restarting Claude Code, run `/mcp` to see the family-tree server listed with all tools.

**Step 3: Test a few tool calls interactively**

Ask Claude to: "Use the family-tree MCP to get Timon's relatives" and "Validate the tree integrity".

**Step 4: Commit**

```bash
git add .mcp.json
git commit -m "feat: add MCP config for family-tree server"
```

---
