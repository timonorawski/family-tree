# Region Annotations & Structured Locations — Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Add colored card accents by birth region, backed by a region registry and structured location data replacing flat dob/dod/country_of_birth fields.

**Architecture:** A `data/regions.yaml` registry maps region slugs to names and colors. Person YAML files get a `locations` object with uniform `birth`/`death`/`other` entries. The chart reads birth region to apply a colored left border on cards. A migration script converts the ~110 existing files that have flat fields.

**Tech Stack:** SvelteKit, Svelte 5 ($state/$derived/$effect/$props), family-chart v0.9.0, AJV validation, js-yaml, Node.js scripts

---

### Task 1: Create the Region Registry

**Files:**
- Create: `data/regions.yaml`

**Step 1: Write the registry file**

```yaml
scotland:
  name: Scotland
  color: "#0065BF"
ireland:
  name: Ireland
  color: "#169B62"
england:
  name: England
  color: "#C8102E"
canada:
  name: Canada
  color: "#FF0000"
poland:
  name: Poland
  color: "#DC143C"
hungary:
  name: Kingdom of Hungary
  color: "#477050"
  historical: true
united-states:
  name: United States
  color: "#3C3B6E"
```

The current data has these `country_of_birth` values: Scotland, Ireland, England, Canada, Poland, Hungary, United States. Each needs a slug mapping.

**Step 2: Add region loading to store**

Modify: `src/lib/store.mjs`

Add at the top, after the `PERSONS_DIR` const:

```js
const REGIONS_FILE = path.resolve('data/regions.yaml');

/** Load region registry. Returns { [slug]: { name, color, ... } } */
export function loadRegions() {
  if (!fs.existsSync(REGIONS_FILE)) return {};
  return yaml.load(fs.readFileSync(REGIONS_FILE, 'utf-8')) || {};
}
```

Also update the `search()` function — replace `p.country_of_birth` in the searchable string with `p.locations?.birth?.region || ''` (this will be needed after migration, but add it now so we don't forget).

**Step 3: Expose regions in page data**

Modify: `src/lib/load-tree.js`

```js
export { PERSONS_DIR, loadAll as loadPersons, loadRegions } from './store.mjs';
```

Modify: `src/routes/+page.server.js`

```js
import { loadPersons, loadRegions } from '$lib/load-tree.js';

export function load() {
  const persons = loadPersons();
  const regions = loadRegions();
  return { persons, regions };
}
```

**Step 4: Commit**

```
feat: add region registry and loading infrastructure
```

---

### Task 2: Update the Person Schema

**Files:**
- Modify: `src/lib/person-schema.mjs`

**Step 1: Define the location entry sub-schema**

Add inside the `personSchema.properties` object, replacing the old `dob`, `dod`, `country_of_birth` properties:

The location entry schema (reusable):
```js
const locationEntrySchema = {
  type: 'object',
  additionalProperties: false,
  properties: {
    date: { type: 'string' },
    end_date: { type: 'string' },
    region: { type: 'string' },
    place: { type: 'string' },
    notes: { type: 'string' },
    tags: { type: 'array', items: { type: 'string' } }
  }
};
```

Replace the three flat properties (`dob`, `dod`, `country_of_birth`) with:
```js
locations: {
  type: 'object',
  additionalProperties: false,
  properties: {
    birth: locationEntrySchema,
    death: locationEntrySchema,
    other: {
      type: 'array',
      items: locationEntrySchema
    }
  }
}
```

**Important:** Keep `dob`, `dod`, and `country_of_birth` in the schema temporarily (alongside `locations`) so we can migrate incrementally. Remove them in Task 4 after migration.

**Step 2: Commit**

```
feat: add locations schema to person validation (alongside legacy fields)
```

---

### Task 3: Write and Run the Migration Script

**Files:**
- Create: `scripts/migrate-locations.mjs` (one-time, can be deleted after)

**Step 1: Write the migration script**

```js
#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';
import yaml from 'js-yaml';

const PERSONS_DIR = path.resolve('data/persons');

// Map freeform country_of_birth values to region slugs
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

for (const file of fs.readdirSync(PERSONS_DIR).filter(f => f.endsWith('.yaml'))) {
  const fp = path.join(PERSONS_DIR, file);
  const data = yaml.load(fs.readFileSync(fp, 'utf-8'));

  // Skip if already migrated
  if (data.locations) {
    skipped++;
    continue;
  }

  // Skip if nothing to migrate
  if (!data.dob && !data.dod && !data.country_of_birth) {
    skipped++;
    continue;
  }

  const locations = {};

  // Build birth entry
  if (data.dob || data.country_of_birth) {
    const birth = {};
    if (data.dob) birth.date = data.dob;
    if (data.country_of_birth) {
      const region = COUNTRY_TO_REGION[data.country_of_birth];
      if (region) {
        birth.region = region;
      } else {
        console.warn(`  WARNING: Unknown country "${data.country_of_birth}" in ${file}`);
        birth.region = data.country_of_birth.toLowerCase().replace(/\s+/g, '-');
      }
    }
    locations.birth = birth;
  }

  // Build death entry
  if (data.dod) {
    locations.death = { date: data.dod };
  }

  // Apply migration
  delete data.dob;
  delete data.dod;
  delete data.country_of_birth;
  data.locations = locations;

  fs.writeFileSync(fp, yaml.dump(data, { lineWidth: -1 }), 'utf-8');
  migrated++;
  console.log(`  Migrated: ${file}`);
}

console.log(`\nDone. Migrated: ${migrated}, Skipped: ${skipped}`);
```

**Step 2: Run the migration**

```bash
node scripts/migrate-locations.mjs
```

Expected: ~110 files migrated (those with dob/dod/country_of_birth), ~85 skipped (those without).

**Step 3: Verify a few files manually**

Read 2-3 migrated YAML files to confirm the shape is correct. For example, `genevieve.yaml` should have:
```yaml
locations:
  birth:
    date: "1913-03-12"
    region: poland
  death:
    date: "1998-03-09"
```

**Step 4: Commit**

```
data: migrate dob/dod/country_of_birth to structured locations
```

---

### Task 4: Remove Legacy Schema Fields

**Files:**
- Modify: `src/lib/person-schema.mjs`

**Step 1: Remove `dob`, `dod`, `country_of_birth` from the schema**

Delete these three properties from `personSchema.properties`. The `locations` property added in Task 2 replaces them.

**Step 2: Commit**

```
feat: remove legacy dob/dod/country_of_birth from schema
```

---

### Task 5: Update Data Layer and Graph

**Files:**
- Modify: `src/lib/graph.js`
- Modify: `src/lib/store.mjs`

**Step 1: Update graph.js to read from locations**

In `toFamilyChartData`, the `birthday` field currently reads `p.dob`. Change to read from `locations.birth.date`:

```js
birthday: p.locations?.birth?.date || '',
```

Also pass through the full locations object so cards can access the region:

```js
// In the data spread, the ...extra already passes locations through.
// Just confirm birthday mapping changed.
```

**Step 2: Update store.mjs search to use new fields**

In the `search()` function, the searchable string currently includes `p.country_of_birth`. Replace with:

```js
p.locations?.birth?.region, p.locations?.birth?.place
```

**Step 3: Commit**

```
feat: update graph and search to use structured locations
```

---

### Task 6: Card Accents in Chart

**Files:**
- Modify: `src/routes/+page.svelte`

**Step 1: Accept regions in page data**

The `data` prop already comes from `+page.server.js`. Destructure regions:

```js
const { data } = $props();
let persons = $state(data.persons);
let regions = $state(data.regions || {});
```

**Step 2: Add region color lookup to setOnCardUpdate**

Inside the existing `setOnCardUpdate` callback, after the hidden-rels badge logic, add:

```js
// Region accent
const birthRegion = d.data.data.locations?.birth?.region;
if (birthRegion && regions[birthRegion]) {
  card.style.borderLeft = `4px solid ${regions[birthRegion].color}`;
} else {
  card.style.borderLeft = '';
}
```

**Step 3: Add the legend component**

Add a legend overlay to the template, after the `#FamilyChart` div:

```svelte
<div class="region-legend">
  {#each Object.entries(regions) as [slug, region]}
    <div class="legend-item">
      <span class="legend-swatch" style="background: {region.color}"></span>
      <span class="legend-label">{region.name}</span>
    </div>
  {/each}
</div>
```

**Step 4: Style the legend**

```css
:global(.region-legend) {
  position: absolute;
  bottom: 16px;
  left: 16px;
  background: rgba(26, 26, 46, 0.9);
  border: 1px solid #444;
  border-radius: 6px;
  padding: 8px 12px;
  display: flex;
  flex-direction: column;
  gap: 4px;
  z-index: 10;
  font-size: 11px;
  color: #ccc;
}

:global(.legend-item) {
  display: flex;
  align-items: center;
  gap: 6px;
}

:global(.legend-swatch) {
  width: 12px;
  height: 12px;
  border-radius: 2px;
  flex-shrink: 0;
}
```

The `.layout` container needs `position: relative` so the legend positions correctly within it.

**Step 5: Commit**

```
feat: add region-based card accent colors and legend
```

---

### Task 7: Update Sidebar View/Edit for Locations

**Files:**
- Modify: `src/lib/Sidebar.svelte`

**Step 1: Accept regions prop**

Add `regions = {}` to the props destructure:

```js
let { person, persons, chartData, onNavigate, onSaved, readonly = false, regions = {} } = $props();
```

**Step 2: Update syncFormFromNode for locations**

Replace the flat field reads:
```js
// Old:
dob: node.data.dob || '',
dod: node.data.dod || '',
country_of_birth: node.data.country_of_birth || '',

// New:
locations: {
  birth: {
    date: node.data.locations?.birth?.date || '',
    region: node.data.locations?.birth?.region || '',
    place: node.data.locations?.birth?.place || '',
    notes: node.data.locations?.birth?.notes || '',
  },
  death: {
    date: node.data.locations?.death?.date || '',
    region: node.data.locations?.death?.region || '',
    place: node.data.locations?.death?.place || '',
    notes: node.data.locations?.death?.notes || '',
  },
  other: (node.data.locations?.other || []).map(loc => ({
    date: loc.date || '',
    end_date: loc.end_date || '',
    region: loc.region || '',
    place: loc.place || '',
    notes: loc.notes || '',
    tags: loc.tags ? [...loc.tags] : [],
  })),
},
```

**Step 3: Update the view mode**

Replace the dates-line block that reads `node.data.dob`/`node.data.dod`/`node.data.country_of_birth` with structured location display:

```svelte
{@const birth = node.data.locations?.birth}
{@const death = node.data.locations?.death}

{#if birth?.date || birth?.region || birth?.place || death?.date}
  <div class="dates-line">
    {#if birth?.date}b. {birth.date}{/if}
    {#if birth?.place}{birth.date ? ', ' : ''}{birth.place}{/if}
    {#if birth?.region && regions[birth.region]}{(birth.date || birth.place) ? ', ' : ''}{regions[birth.region].name}{/if}
    {#if death?.date}{(birth?.date || birth?.place || birth?.region) ? ' — ' : ''}d. {death.date}{/if}
  </div>
{/if}

{#if node.data.locations?.other?.length}
  <div class="detail-row">
    <span class="detail-label">Locations</span>
    {#each node.data.locations.other as loc}
      <div class="view-card">
        {#if loc.place}<span>{loc.place}</span>{/if}
        {#if loc.region && regions[loc.region]}<span class="rel-meta">{regions[loc.region].name}</span>{/if}
        {#if loc.date || loc.end_date}
          <span class="rel-meta">
            {loc.date || ''}{loc.end_date ? ` – ${loc.end_date}` : ''}
          </span>
        {/if}
        {#if loc.notes}<p class="detail-text">{loc.notes}</p>{/if}
        {#if loc.tags?.length}
          <div class="tags">
            {#each loc.tags as tag}
              <span class="tag">{tag}</span>
            {/each}
          </div>
        {/if}
      </div>
    {/each}
  </div>
{/if}
```

**Step 4: Update the edit mode**

Replace the flat dob/dod/country_of_birth form fields with structured location editors:

```svelte
<fieldset class="research-section">
  <legend>Birth</legend>
  <label>
    Date
    <input type="date" bind:value={form.locations.birth.date} />
  </label>
  <label>
    Region
    <select bind:value={form.locations.birth.region}>
      <option value="">— none —</option>
      {#each Object.entries(regions) as [slug, r]}
        <option value={slug}>{r.name}</option>
      {/each}
    </select>
  </label>
  <label>
    Place
    <input type="text" bind:value={form.locations.birth.place} placeholder="Village, county, etc." />
  </label>
  <label>
    Notes
    <input type="text" bind:value={form.locations.birth.notes} />
  </label>
</fieldset>

<fieldset class="research-section">
  <legend>Death</legend>
  <label>
    Date
    <input type="date" bind:value={form.locations.death.date} />
  </label>
  <label>
    Region
    <select bind:value={form.locations.death.region}>
      <option value="">— none —</option>
      {#each Object.entries(regions) as [slug, r]}
        <option value={slug}>{r.name}</option>
      {/each}
    </select>
  </label>
  <label>
    Place
    <input type="text" bind:value={form.locations.death.place} />
  </label>
  <label>
    Notes
    <input type="text" bind:value={form.locations.death.notes} />
  </label>
</fieldset>
```

Also keep the `deceased` checkbox — it's a separate flag from having a death location.

**Step 5: Update buildPayload**

Replace the flat field handling with structured locations:

```js
// In buildPayload, remove dob, dod, country_of_birth from destructure/rest.
// Instead, pull form.locations and build the payload:

const locations = {};
const birth = form.locations?.birth;
if (birth?.date || birth?.region || birth?.place || birth?.notes) {
  locations.birth = {};
  if (birth.date) locations.birth.date = birth.date;
  if (birth.region) locations.birth.region = birth.region;
  if (birth.place) locations.birth.place = birth.place;
  if (birth.notes) locations.birth.notes = birth.notes;
}
const death = form.locations?.death;
if (death?.date || death?.region || death?.place || death?.notes) {
  locations.death = {};
  if (death.date) locations.death.date = death.date;
  if (death.region) locations.death.region = death.region;
  if (death.place) locations.death.place = death.place;
  if (death.notes) locations.death.notes = death.notes;
}
const other = (form.locations?.other || [])
  .map(loc => {
    const entry = {};
    if (loc.date) entry.date = loc.date;
    if (loc.end_date) entry.end_date = loc.end_date;
    if (loc.region) entry.region = loc.region;
    if (loc.place) entry.place = loc.place;
    if (loc.notes) entry.notes = loc.notes;
    const tags = (loc.tags || []).filter(Boolean);
    if (tags.length) entry.tags = tags;
    return entry;
  })
  .filter(e => Object.keys(e).length > 0);
if (other.length) locations.other = other;
if (Object.keys(locations).length) payload.locations = locations;
```

**Step 6: Pass regions from +page.svelte**

In `src/routes/+page.svelte`, pass `regions` to the Sidebar:

```svelte
<Sidebar
  person={selectedPerson}
  {persons}
  {chartData}
  onNavigate={navigateTo}
  onSaved={reloadPersons}
  readonly={isStatic}
  {regions}
/>
```

**Step 7: Commit**

```
feat: update sidebar to display and edit structured locations
```

---

### Task 8: Update MCP Server (if applicable)

**Files:**
- Check: any MCP server code that reads/writes person data

The MCP server (`@modelcontextprotocol/sdk` in dependencies) may need updates if it reads `dob`/`dod`/`country_of_birth` directly. The store functions (`create`, `update`) will handle validation through the updated schema, but any MCP tool descriptions or handlers may reference the old field names.

**Step 1: Check MCP server for references to old fields**

Search for `dob`, `dod`, `country_of_birth` in any MCP-related code.

**Step 2: Update if needed, commit**

```
fix: update MCP server for structured locations schema
```

---

### Task 9: Clean Up and Final Verification

**Step 1: Run the dev server**

```bash
npm run dev
```

**Step 2: Verify visually**

- Cards should show colored left borders matching their birth region
- Legend should appear in the bottom-left corner
- Sidebar view mode should show structured birth/death info
- Sidebar edit mode should have region dropdowns
- Clicking through several people should show correct data

**Step 3: Delete migration script**

```bash
rm scripts/migrate-locations.mjs
```

Or keep it for reference — user's choice.

**Step 4: Final commit**

```
chore: region annotations feature complete
```
