# Design: Region Annotations & Structured Locations

**Date:** 2026-02-24

## Summary

Add visual region-based card accents to the family tree chart, driven by a region registry and structured location data on each person. Replace the flat `dob`/`dod`/`country_of_birth` fields with a unified `locations` object.

## 1. Region Registry — `data/regions.yaml`

A flat map of region slugs to display metadata:

```yaml
scotland:
  name: Scotland
  color: "#0065BF"
ireland:
  name: Ireland
  color: "#169B62"
poland:
  name: Poland
  color: "#DC143C"
hungary:
  name: Kingdom of Hungary
  color: "#477050"
  historical: true
canada:
  name: Canada
  color: "#FF0000"
england:
  name: England
  color: "#C8102E"
```

Each entry has:
- `name` — display label
- `color` — hex color for card accents
- `historical` — optional boolean for regions that no longer exist
- `fictional` — optional boolean for imaginary regions (other use cases)

## 2. Location Entry Schema

All location entries (birth, death, biographical) share a single uniform schema. Every field is optional since any detail may be unknown:

```yaml
date:       # ISO date string (YYYY-MM-DD) — start/event date
end_date:   # ISO date string — end date (for residences, etc.)
region:     # slug referencing regions.yaml
place:      # freeform string — village, county, address, etc.
notes:      # freeform string — context, narrative
tags:       # array of strings — e.g. ["residence", "emigration", "burial"]
```

## 3. Person Schema — `locations` Object

Replaces flat `dob`, `dod`, `country_of_birth` fields:

```yaml
locations:
  birth:                              # well-known key
    date: "1913-03-12"
    region: poland
    place: "Podwilk, Nowy Targ County"
  death:                              # well-known key
    date: "1998-03-09"
    region: canada
  other:                              # array of additional locations
    - date: "1932"
      end_date: "1998"
      region: canada
      place: "Leamington, Ontario"
      notes: "Emigrated and settled"
      tags: ["residence"]
```

`birth` and `death` are single location entries. `other` is an array of location entries.

## 4. Schema Migration

Migrate existing person YAML files:
- `dob` → `locations.birth.date`
- `dod` → `locations.death.date`
- `country_of_birth` → `locations.birth.region` (lowercase, map freeform values to region slugs)
- If `deceased: true` and no `dod`, still create `locations.death: {}` only if needed for other death info
- Remove old flat fields after migration
- Update `person-schema.mjs` to validate the new shape
- Validate `region` references against loaded `regions.yaml`

## 5. Card Accent Rendering

In `setOnCardUpdate`, look up `locations.birth.region` on each card's data:
- Resolve to a color from the loaded regions registry
- Apply as a **colored left border** (4px solid) on the `.card` element
- No accent if region is missing/unknown

```css
/* Example generated inline style */
.card { border-left: 4px solid #0065BF; } /* Scotland */
```

## 6. Legend

A small overlay on the chart (bottom-left or top-left) showing region colors:
- Only displays regions that appear in the currently rendered tree
- Each entry: colored swatch + region name
- Collapsible or semi-transparent to avoid obscuring the tree
- Hidden in compact/mobile views

## 7. Data Flow Updates

- `graph.js` — pull `birthday` from `locations.birth.date` instead of `dob`; pass through `locations` in the data object
- `store.mjs` — load `regions.yaml` alongside person data; expose regions to the frontend
- `Sidebar.svelte` — display structured location info in the person detail view (birth place, death place, other locations)
- `person-schema.mjs` — new schema shape with `locations` object; drop `dob`/`dod`/`country_of_birth`

## 8. Files Affected

| File | Change |
|------|--------|
| `data/regions.yaml` | **New** — region registry |
| `data/persons/*.yaml` (~195 files) | **Migrate** — flat fields → `locations` |
| `src/lib/person-schema.mjs` | **Update** — new schema with `locations` + location entry shape |
| `src/lib/store.mjs` | **Update** — load regions.yaml, expose regions |
| `src/lib/graph.js` | **Update** — read `locations.birth.date` for birthday display |
| `src/lib/Sidebar.svelte` | **Update** — render structured locations in view/edit |
| `src/routes/+page.svelte` | **Update** — load regions, apply card accents, add legend |
| `src/routes/+page.server.js` | **Update** — load and pass regions data |
| Migration script (one-time) | **New** — migrate existing YAML files |
