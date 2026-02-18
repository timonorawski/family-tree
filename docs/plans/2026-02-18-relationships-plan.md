# Unified Relationships Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Replace separate `parents`/`partners` arrays with a single `relationships` array in every YAML file, schema, store, graph, sidebar, and MCP server.

**Architecture:** Migration script converts 88 YAML files. Schema, store, graph.js, analysis.mjs, mcp-server/index.mjs, and Sidebar.svelte all switch from reading `parents`/`partners` to reading `relationships: [{type, person}]`. New atomic `addRelationship`/`removeRelationship` store functions maintain both sides of partner links. Children remain computed.

**Tech Stack:** Node.js, js-yaml, ajv, SvelteKit, Svelte 5, MCP SDK, zod

---

### Task 1: Migration script

**Files:**
- Create: `scripts/migrate-relationships.mjs`

**Step 1: Write the migration script**

```js
// scripts/migrate-relationships.mjs
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
```

**Step 2: Run the migration**

Run: `node scripts/migrate-relationships.mjs`
Expected: `Migrated: 88, Skipped: 0`

**Step 3: Verify a sample file**

Run: `cat data/persons/timon.yaml`
Expected: No `parents:` or `partners:` keys. Instead:
```yaml
relationships:
  - type: parent
    person: walter
  - type: parent
    person: wendy
  - type: partner
    person: sonia
```

**Step 4: Commit**

```bash
git add scripts/migrate-relationships.mjs data/persons/
git commit -m "feat: migrate YAML files from parents/partners to relationships array"
```

---

### Task 2: Update schema

**Files:**
- Modify: `src/lib/person-schema.mjs` (lines 32-33 → remove parents/partners, add relationships)

**Step 1: Replace parents/partners with relationships in schema**

In `src/lib/person-schema.mjs`, remove these two lines:

```js
    parents: { type: 'array', items: { type: 'string' } },
    partners: { type: 'array', items: { type: 'string' } },
```

And add this in their place:

```js
    relationships: {
      type: 'array',
      items: {
        type: 'object',
        required: ['type', 'person'],
        additionalProperties: false,
        properties: {
          type: { type: 'string', enum: ['parent', 'partner'] },
          person: { type: 'string' }
        }
      }
    },
```

**Step 2: Verify all YAML files pass validation**

Run: `node -e "import { loadAll } from './src/lib/store.mjs'; import { validate } from './src/lib/person-schema.mjs'; const all = loadAll(); let fails = 0; for (const [s,d] of Object.entries(all)) { const r = validate(d); if (!r.valid) { console.log(s, r.errors); fails++; } } console.log(fails ? fails + ' failures' : 'All valid');"`
Expected: `All valid`

**Step 3: Commit**

```bash
git add src/lib/person-schema.mjs
git commit -m "feat: update schema — parents/partners replaced by relationships array"
```

---

### Task 3: Update store.mjs

**Files:**
- Modify: `src/lib/store.mjs` (lines 43-58: rewriteReferences, lines 127-137: remove dangling check, plus add new functions)

**Step 1: Update `rewriteReferences` to use relationships**

Replace the current `rewriteReferences` function (lines 44-58) with:

```js
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
```

**Step 2: Update `remove()` dangling ref detection**

Replace the dangling references loop in `remove()` (lines 128-137) with:

```js
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
```

**Step 3: Add `addRelationship` and `removeRelationship` functions**

Add these exports after the `remove` function:

```js
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
```

**Step 4: Verify store loads and searches correctly**

Run: `node -e "import { loadAll, getOne } from './src/lib/store.mjs'; const t = getOne('timon'); console.log(JSON.stringify(t.relationships));"`
Expected: `[{"type":"parent","person":"walter"},{"type":"parent","person":"wendy"},{"type":"partner","person":"sonia"}]`

**Step 5: Commit**

```bash
git add src/lib/store.mjs
git commit -m "feat: store uses relationships array, adds addRelationship/removeRelationship"
```

---

### Task 4: Update graph.js

**Files:**
- Modify: `src/lib/graph.js` (lines 18-48)

**Step 1: Read from relationships instead of parents/partners**

Replace `toFamilyChartData` with:

```js
export function toFamilyChartData(persons) {
	// Pre-compute children lookup (parent slug → [child slugs])
	const childrenOf = new Map();
	for (const [slug, p] of Object.entries(persons)) {
		const parents = (p.relationships || [])
			.filter(r => r.type === 'parent')
			.map(r => r.person);
		for (const parentSlug of parents) {
			if (!childrenOf.has(parentSlug)) childrenOf.set(parentSlug, []);
			childrenOf.get(parentSlug).push(slug);
		}
	}

	return Object.entries(persons).map(([slug, p]) => {
		const { name, gender, relationships, ...extra } = p;
		const parents = (relationships || [])
			.filter(r => r.type === 'parent')
			.map(r => r.person);
		const partners = (relationships || [])
			.filter(r => r.type === 'partner')
			.map(r => r.person);
		return {
			id: slug,
			data: {
				gender: gender === 'female' ? 'F' : 'M',
				'first name': displayName(name),
				name,
				birthday: p.dob || '',
				...extra
			},
			rels: {
				parents: parents.filter(s => persons[s]),
				spouses: partners.filter(s => persons[s]),
				children: childrenOf.get(slug) || []
			}
		};
	});
}
```

**Step 2: Verify chart data builds correctly**

Run: `node -e "import { loadAll } from './src/lib/store.mjs'; import { toFamilyChartData } from './src/lib/graph.js'; const data = toFamilyChartData(loadAll()); const t = data.find(d => d.id === 'timon'); console.log(JSON.stringify(t.rels));"`
Expected: `{"parents":["walter","wendy"],"spouses":["sonia"],"children":[...]}` (children list depends on data)

**Step 3: Commit**

```bash
git add src/lib/graph.js
git commit -m "feat: graph.js reads relationships array instead of parents/partners"
```

---

### Task 5: Update Sidebar.svelte

**Files:**
- Modify: `src/lib/Sidebar.svelte` (lines 86-91: buildPayload, lines 181-238: addRelative)

**Step 1: Update `buildPayload` to write relationships**

Replace lines 86-91 (the relationship preservation block) with:

```js
		// Preserve relationships from the chart data (not edited via form)
		const node = currentNode();
		if (node) {
			const relationships = [];
			for (const s of node.rels.parents) {
				relationships.push({ type: 'parent', person: s });
			}
			for (const s of node.rels.spouses) {
				relationships.push({ type: 'partner', person: s });
			}
			if (relationships.length) payload.relationships = relationships;
		}
```

**Step 2: Update `addRelative` to use relationship API**

Replace the entire `addRelative` function (lines 181-239) with:

```js
	async function addRelative(relationship) {
		const given = prompt(`New ${relationship}'s given name:`);
		if (!given) return;
		const gender = prompt('Gender (male/female):', 'male');
		if (!gender) return;

		const newPerson = { name: { given }, gender };

		// For child: new person gets current person as parent
		if (relationship === 'child') {
			const node = currentNode();
			const rels = [{ type: 'parent', person: person }];
			if (node.rels.spouses.length) {
				rels.push({ type: 'parent', person: node.rels.spouses[0] });
			}
			newPerson.relationships = rels;
		}

		const res = await fetch('/api/persons', {
			method: 'POST',
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify(newPerson)
		});

		if (!res.ok) return;
		const created = await res.json();

		// Link back using relationship API
		if (relationship === 'parent') {
			await fetch('/api/persons/relationship', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ slug: person, targetSlug: created.slug, type: 'parent' })
			});
		} else if (relationship === 'sibling') {
			const node = currentNode();
			for (const parentSlug of node.rels.parents) {
				await fetch('/api/persons/relationship', {
					method: 'POST',
					headers: { 'Content-Type': 'application/json' },
					body: JSON.stringify({ slug: created.slug, targetSlug: parentSlug, type: 'parent' })
				});
			}
		} else if (relationship === 'partner') {
			await fetch('/api/persons/relationship', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ slug: person, targetSlug: created.slug, type: 'partner' })
			});
		}
		// child: already linked via newPerson.relationships above

		onSaved();
	}
```

**Step 3: Commit**

```bash
git add src/lib/Sidebar.svelte
git commit -m "feat: sidebar uses relationships array and relationship API"
```

---

### Task 6: Add relationship API route

**Files:**
- Create: `src/routes/api/persons/relationship/+server.js`

**Step 1: Create POST/DELETE endpoint**

```js
import { json } from '@sveltejs/kit';
import { addRelationship, removeRelationship } from '$lib/store.mjs';

export async function POST({ request }) {
	try {
		const { slug, targetSlug, type } = await request.json();
		const result = addRelationship(slug, targetSlug, type);
		return json(result, { status: 201 });
	} catch (e) {
		return json({ error: e.message }, { status: 400 });
	}
}

export async function DELETE({ request }) {
	try {
		const { slug, targetSlug, type } = await request.json();
		const result = removeRelationship(slug, targetSlug, type);
		return json(result);
	} catch (e) {
		return json({ error: e.message }, { status: 400 });
	}
}
```

**Step 2: Commit**

```bash
git add src/routes/api/persons/relationship/+server.js
git commit -m "feat: add POST/DELETE /api/persons/relationship endpoint"
```

---

### Task 7: Update analysis.mjs

**Files:**
- Modify: `mcp-server/analysis.mjs` (all functions that read parents/partners)

**Step 1: Update all functions to read from relationships**

Replace the entire file with:

```js
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
```

**Step 2: Commit**

```bash
git add mcp-server/analysis.mjs
git commit -m "feat: analysis.mjs reads relationships array instead of parents/partners"
```

---

### Task 8: Update MCP server — computed children + new tools

**Files:**
- Modify: `mcp-server/index.mjs` (lines 55-59: computed children, plus add two new tools)

**Step 1: Update get_person computed children**

Replace lines 57-59 (the children filter) with:

```js
      const children = Object.entries(all)
        .filter(([, d]) => (d.relationships || []).some(r => r.type === 'parent' && r.person === slug))
        .map(([s, d]) => ({ slug: s, name: d.name }));
```

**Step 2: Add add_relationship and remove_relationship tools**

Add these imports at line 5:

```js
import { loadAll, getOne, create, update, remove, search, addRelationship, removeRelationship } from '../src/lib/store.mjs';
```

Add the two new tools before the stdio connect section (before line 216):

```js
// 12. add_relationship — params: { slug, targetSlug, type }
server.tool(
  "add_relationship",
  "Add a relationship between two persons. Types: parent, partner. Partner relationships are added to both sides atomically.",
  {
    slug: z.string().describe("The person's slug"),
    targetSlug: z.string().describe("The related person's slug"),
    type: z.enum(["parent", "partner"]).describe("Relationship type"),
  },
  async ({ slug, targetSlug, type }) => {
    try {
      const result = addRelationship(slug, targetSlug, type);
      return ok(result);
    } catch (e) {
      return err(e.message);
    }
  }
);

// 13. remove_relationship — params: { slug, targetSlug, type }
server.tool(
  "remove_relationship",
  "Remove a relationship between two persons. Partner relationships are removed from both sides atomically.",
  {
    slug: z.string().describe("The person's slug"),
    targetSlug: z.string().describe("The related person's slug"),
    type: z.enum(["parent", "partner"]).describe("Relationship type"),
  },
  async ({ slug, targetSlug, type }) => {
    try {
      const result = removeRelationship(slug, targetSlug, type);
      return ok(result);
    } catch (e) {
      return err(e.message);
    }
  }
);
```

**Step 3: Commit**

```bash
git add mcp-server/index.mjs
git commit -m "feat: MCP server uses relationships, adds add/remove_relationship tools"
```

---

### Task 9: End-to-end verification

**Step 1: Start dev server**

Run: `npm run dev`
Expected: Compiles and starts without errors.

**Step 2: Verify UI**

1. Open browser, click a person card → sidebar shows their info
2. Parents/siblings/partners/children chips still display correctly
3. Click Save on a person → YAML file still has `relationships` array (no `parents`/`partners`)
4. Click `+ Child` → creates person, links via `relationships`
5. Click `+ Partner` → creates person, both sides get `relationships` entries

**Step 3: Verify MCP server**

Run: `echo '{"jsonrpc":"2.0","method":"initialize","params":{"protocolVersion":"2024-11-05","capabilities":{},"clientInfo":{"name":"test","version":"1"}},"id":1}' | node mcp-server/index.mjs 2>/dev/null | head -1 | node -e "process.stdin.on('data',d=>console.log(JSON.parse(d).result?'OK':'FAIL'))"`
Expected: `OK`

**Step 4: Validate tree integrity**

Use the MCP validate_tree tool or run:
Run: `node -e "import { validateTree } from './mcp-server/analysis.mjs'; const issues = validateTree(); console.log(issues.length ? JSON.stringify(issues, null, 2) : 'No issues');"`
Expected: `No issues` (or only pre-existing issues unrelated to this change)

**Step 5: Commit any remaining fixes**

If any issues were found, fix and commit.
