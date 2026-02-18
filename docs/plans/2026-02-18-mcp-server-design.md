# MCP Server for Family Tree — Design

## Goal

Provide a structured, validated interface for Claude Code to read, edit, and analyze the family tree via MCP (Model Context Protocol). Establish a formal JSON Schema for person YAML files and a shared store layer used by both the SvelteKit dev server and the MCP server.

## Architecture

```
src/lib/
  person-schema.mjs   — JSON Schema definition + validate() function
  store.mjs            — YAML CRUD: read, create, update, delete, search, slug logic
  load-tree.js         — existing loader (delegates to store)
  graph.js             — existing chart data transformer

mcp-server/
  index.mjs            — stdio MCP server entry point
  analysis.mjs         — tree traversal, validation, statistics

src/routes/api/persons/
  +server.js           — GET/POST, refactored to use store + schema
  [slug]/+server.js    — PUT/DELETE, refactored to use store + schema

.mcp.json              — MCP config (stdio, points to mcp-server/index.mjs)
```

### Data flow

Both the SvelteKit API routes and the MCP server call the same `store.mjs` functions, which validate against `person-schema.mjs` before writing YAML.

```
Claude Code ──MCP──> mcp-server/index.mjs ──> src/lib/store.mjs ──> data/persons/*.yaml
Browser UI  ──HTTP─> API routes            ──> src/lib/store.mjs ──> data/persons/*.yaml
                                                     │
                                              src/lib/person-schema.mjs (validation)
```

## Person Schema

```json
{
  "type": "object",
  "required": ["name", "gender"],
  "properties": {
    "name": {
      "type": "object",
      "required": ["given"],
      "properties": {
        "given": { "type": "string", "minLength": 1 },
        "middles": { "type": "array", "items": { "type": "string" } },
        "surnames": {
          "type": "object",
          "properties": {
            "current": { "type": "string" },
            "birth": { "type": "string" }
          }
        }
      }
    },
    "gender": { "enum": ["male", "female"] },
    "dob": { "type": "string", "pattern": "^\\d{4}-\\d{2}-\\d{2}$" },
    "dod": { "type": "string", "pattern": "^\\d{4}-\\d{2}-\\d{2}$" },
    "country_of_birth": { "type": "string" },
    "deceased": { "type": "boolean" },
    "profession": { "type": "string" },
    "interesting_facts": { "type": "string" },
    "parents": { "type": "array", "items": { "type": "string" } },
    "partners": { "type": "array", "items": { "type": "string" } },
    "research": {
      "type": "array",
      "items": {
        "type": "object",
        "properties": {
          "description": { "type": "string" },
          "confidence": { "type": "number", "minimum": 0, "maximum": 100 },
          "sources": { "type": "array", "items": { "type": "string" } }
        }
      }
    },
    "stories": {
      "type": "array",
      "items": {
        "type": "object",
        "properties": {
          "name": { "type": "string" },
          "description": { "type": "string" },
          "sources": { "type": "array", "items": { "type": "string" } },
          "places": { "type": "array", "items": { "type": "string" } },
          "dates": { "type": "array", "items": { "type": "string" } },
          "people": { "type": "array", "items": { "type": "string" } }
        }
      }
    }
  },
  "additionalProperties": false
}
```

## MCP Tools

### CRUD

| Tool | Input | Output |
|---|---|---|
| `list_persons` | optional filter (gender, has_parents, etc.) | Array of `{ slug, name, gender }` summaries |
| `get_person` | `slug` | Full person data + computed children list |
| `create_person` | Person object (validated) | `{ slug, ...person }` |
| `update_person` | `slug` + full person object (validated) | `{ slug, ...person }` (slug may change if name changed) |
| `delete_person` | `slug` | `{ deleted: slug, dangling_refs: [...] }` |
| `search_persons` | `query` string | Matching persons with relevance |

### Analysis

| Tool | Input | Output |
|---|---|---|
| `get_ancestors` | `slug`, optional `depth` | Tree of ancestors |
| `get_descendants` | `slug`, optional `depth` | Tree of descendants |
| `get_relatives` | `slug` | `{ parents, siblings, partners, children }` with names |
| `validate_tree` | (none) | List of issues: dangling refs, missing fields, cycles |
| `get_statistics` | (none) | Counts, date ranges, coverage percentages |

## Store API (src/lib/store.mjs)

```js
loadAll()                        → { [slug]: data }
getOne(slug)                     → data | null
create(data)                     → { slug, ...data }
update(slug, data)               → { slug, ...data }  (handles rename + ref rewrite)
remove(slug)                     → { deleted, danglingRefs }
search(query)                    → [{ slug, ...data }]
slugify(name)                    → string
```

All write operations validate against the schema before touching disk.

## Dependencies

- `@modelcontextprotocol/sdk` — MCP server framework
- `ajv` — JSON Schema validation
- `js-yaml` — already installed

## Configuration

`.mcp.json` at project root:
```json
{
  "family-tree": {
    "command": "node",
    "args": ["mcp-server/index.mjs"]
  }
}
```
