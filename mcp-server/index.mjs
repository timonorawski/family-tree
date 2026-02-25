import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { z } from 'zod';

import { loadAll, getOne, create, update, remove, search, rename, addRelationship, removeRelationship } from '../src/lib/store.mjs';
import {
  getAncestors,
  getDescendants,
  getRelatives,
  validateTree,
  getStatistics,
} from './analysis.mjs';

const server = new McpServer({ name: "family-tree", version: "1.0.0" });

// Helper: wrap a value as a successful text response
function ok(data) {
  return { content: [{ type: "text", text: JSON.stringify(data, null, 2) }] };
}

// Helper: wrap an error as an error response
function err(message) {
  return { content: [{ type: "text", text: `Error: ${message}` }], isError: true };
}

// 1. list_persons — no params
server.tool(
  "list_persons",
  "List all persons in the family tree. Returns JSON array of {slug, name, gender} summaries.",
  async () => {
    try {
      const all = loadAll();
      const summaries = Object.entries(all).map(([slug, p]) => ({
        slug,
        name: p.name,
        gender: p.gender,
      }));
      return ok(summaries);
    } catch (e) {
      return err(e.message);
    }
  }
);

// 2. get_person — params: { slug }
server.tool(
  "get_person",
  "Get full data for a person by slug, including computed children.",
  { slug: z.string().describe("The person's slug identifier") },
  async ({ slug }) => {
    try {
      const person = getOne(slug);
      if (!person) return err(`Person not found: ${slug}`);

      // Compute children (persons who list this slug as a parent)
      const all = loadAll();
      const children = Object.entries(all)
        .filter(([, d]) => (d.relationships || []).some(r => r.type === 'parent' && r.person === slug))
        .map(([s, d]) => ({ slug: s, name: d.name }));

      return ok({ slug, ...person, children });
    } catch (e) {
      return err(e.message);
    }
  }
);

// 3. create_person — params: { data } as JSON string
server.tool(
  "create_person",
  "Create a new person. Accepts a JSON string of person data.",
  { data: z.string().describe("JSON string of person data") },
  async ({ data }) => {
    try {
      const parsed = JSON.parse(data);
      const result = create(parsed);
      return ok(result);
    } catch (e) {
      return err(e.message);
    }
  }
);

// 4. update_person — params: { slug, data }
server.tool(
  "update_person",
  "Update an existing person. Accepts slug and a JSON string of complete person data. The slug is stable — changing the name does NOT rename the slug. Use rename_person to change a slug.",
  {
    slug: z.string().describe("The person's slug identifier"),
    data: z.string().describe("JSON string of complete person data"),
  },
  async ({ slug, data }) => {
    try {
      const parsed = JSON.parse(data);
      const result = update(slug, parsed);
      return ok(result);
    } catch (e) {
      return err(e.message);
    }
  }
);

// 5. delete_person — params: { slug }
server.tool(
  "delete_person",
  "Delete a person by slug. Returns the deleted slug and any dangling references.",
  { slug: z.string().describe("The person's slug identifier") },
  async ({ slug }) => {
    try {
      const result = remove(slug);
      return ok(result);
    } catch (e) {
      return err(e.message);
    }
  }
);

// 6. rename_person — params: { oldSlug, newSlug }
server.tool(
  "rename_person",
  "Rename a person's slug. Updates the filename and all references in other persons. Use this instead of update_person when you need to change a slug.",
  {
    oldSlug: z.string().describe("The current slug"),
    newSlug: z.string().describe("The desired new slug"),
  },
  async ({ oldSlug, newSlug }) => {
    try {
      const result = rename(oldSlug, newSlug);
      return ok(result);
    } catch (e) {
      return err(e.message);
    }
  }
);

// 7. search_persons — params: { query }
server.tool(
  "search_persons",
  "Search persons by query string. Matches against name (given, preferred, given_at_birth, surnames), profession, interesting_facts, birth region, and birth place.",
  { query: z.string().describe("Search query string") },
  async ({ query }) => {
    try {
      const results = search(query);
      return ok(results);
    } catch (e) {
      return err(e.message);
    }
  }
);

// 7. get_ancestors — params: { slug, depth? }
server.tool(
  "get_ancestors",
  "Get ancestor tree for a person up to a given depth.",
  {
    slug: z.string().describe("The person's slug identifier"),
    depth: z.number().optional().default(10).describe("Maximum depth to traverse (default 10)"),
  },
  async ({ slug, depth }) => {
    try {
      const result = getAncestors(slug, depth);
      if (!result) return err(`Person not found: ${slug}`);
      return ok(result);
    } catch (e) {
      return err(e.message);
    }
  }
);

// 8. get_descendants — params: { slug, depth? }
server.tool(
  "get_descendants",
  "Get descendant tree for a person up to a given depth.",
  {
    slug: z.string().describe("The person's slug identifier"),
    depth: z.number().optional().default(10).describe("Maximum depth to traverse (default 10)"),
  },
  async ({ slug, depth }) => {
    try {
      const result = getDescendants(slug, depth);
      if (!result) return err(`Person not found: ${slug}`);
      return ok(result);
    } catch (e) {
      return err(e.message);
    }
  }
);

// 9. get_relatives — params: { slug }
server.tool(
  "get_relatives",
  "Get all direct relatives (parents, siblings, partners, children) of a person.",
  { slug: z.string().describe("The person's slug identifier") },
  async ({ slug }) => {
    try {
      const result = getRelatives(slug);
      if (!result) return err(`Person not found: ${slug}`);
      return ok(result);
    } catch (e) {
      return err(e.message);
    }
  }
);

// 10. validate_tree — no params
server.tool(
  "validate_tree",
  "Validate the entire family tree for integrity issues (dangling refs, schema errors, asymmetric partners).",
  async () => {
    try {
      const issues = validateTree();
      return ok({ issueCount: issues.length, issues });
    } catch (e) {
      return err(e.message);
    }
  }
);

// 11. get_statistics — no params
server.tool(
  "get_statistics",
  "Get statistics about the family tree (totals, gender split, coverage, date ranges).",
  async () => {
    try {
      const stats = getStatistics();
      return ok(stats);
    } catch (e) {
      return err(e.message);
    }
  }
);

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

// Connect via stdio
const transport = new StdioServerTransport();
await server.connect(transport);
