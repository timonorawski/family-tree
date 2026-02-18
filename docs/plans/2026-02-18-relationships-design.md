# Unified Relationships — Design

## Goal

Replace separate `parents`/`partners` arrays with a single `relationships` array in the person YAML schema. Provide atomic `addRelationship`/`removeRelationship` store functions that maintain both sides of a link.

## Data Model

```yaml
# Each person's YAML file
relationships:
  - type: parent
    person: walter
  - type: parent
    person: wendy
  - type: partner
    person: sonia
```

- `type`: `"parent"` | `"partner"` (extensible later with friend, godparent, etc.)
- `person`: slug of the related person

Children remain computed: anyone with `{type: parent, person: X}` is a child of X.

## Store API

New functions:
- `addRelationship(slug, targetSlug, type)` — atomic, updates both sides:
  - `parent`: adds `{type: parent, person: targetSlug}` to slug's file. No reverse entry needed (children are computed).
  - `partner`: adds `{type: partner, person: targetSlug}` to slug's file AND `{type: partner, person: slug}` to target's file.
- `removeRelationship(slug, targetSlug, type)` — atomic reverse of add.

`update()` still accepts full `relationships` array for document-level updates.

## Schema Changes

Remove `parents` and `partners` properties. Add:
```json
"relationships": {
  "type": "array",
  "items": {
    "type": "object",
    "required": ["type", "person"],
    "additionalProperties": false,
    "properties": {
      "type": { "type": "string", "enum": ["parent", "partner"] },
      "person": { "type": "string" }
    }
  }
}
```

## Impacted Files

| File | Change |
|---|---|
| `data/persons/*.yaml` | Migration: parents/partners arrays to relationships |
| `src/lib/person-schema.mjs` | Remove parents/partners, add relationships |
| `src/lib/store.mjs` | Add addRelationship/removeRelationship, update rewriteReferences |
| `src/lib/graph.js` | Read relationships to build rels.parents/spouses/children |
| `src/lib/Sidebar.svelte` | Use relationship API for add-relative, pass relationships in save |
| `src/routes/api/persons/+server.js` | Add POST endpoint for relationships (or keep REST-ful) |
| `mcp-server/index.mjs` | Add add_relationship/remove_relationship tools |
| `mcp-server/analysis.mjs` | Read from relationships instead of parents/partners |
| `scripts/migrate-relationships.mjs` | Migration script |
