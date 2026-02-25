# FamilySearch Integration Design

**Date:** 2026-02-25
**Status:** Approved
**Scope:** This repo (family-tree) — lightweight integration points only

## Overview

Enable genealogy agents to access FamilySearch for record lookup, hint resolution, and source attachment. The core infrastructure (login, exploration pipeline, script generation) lives in a separate generalized repo; this project provides the integration points.

## Architecture: Exploration-Driven Script Generation

### The Pattern

1. **Explore** — Agent uses Playwright (via Lua `browser` module) to navigate FamilySearch, capturing network requests
2. **Reverse-engineer** — Agent documents discovered API endpoints, request formats, auth headers
3. **Generate** — Agent writes HTTP-based Lua scripts using discovered patterns
4. **Execute** — Scripts use `http.get`/`http.post` directly (no browser overhead)
5. **Self-heal** — When scripts break, agent re-explores, updates docs, regenerates

### Why This Approach

- **Playwright for discovery** — Handles JS-heavy pages, captures XHR/fetch calls
- **HTTP for production** — Faster, leaner, reusable once patterns are understood
- **Agent-driven iteration** — No predefined scripts; agents generate what they need
- **Self-healing** — Same exploration mechanism that builds scripts can fix them

## Authentication

Browser-based session persistence:
1. Separate login script (Playwright) takes credentials, stores session cookies
2. Agents only see cookie-authenticated sessions, never credentials
3. HTTP destination configured with session cookies for API calls
4. When session expires, human re-runs login script

## Components in This Repo

### 1. Research Documentation

`research/familysearch-api.md` — Living document where agents record:
- Discovered API endpoints
- Request/response formats
- Authentication headers required
- Rate limits or quirks observed

### 2. HTTP Destination Configuration

Added to Lua sandbox when endpoints are discovered:
```json
{
  "name": "familysearch",
  "base_url": "https://www.familysearch.org",
  "headers": {
    "Cookie": "{{session_cookie}}"
  }
}
```

### 3. Agent Instructions

Guidance for genealogy-researcher agent:
- How to trigger exploration workflow
- Where to document findings
- How to request script generation
- How to report broken scripts

## What Lives Elsewhere

The generalized "exploration → generation" pipeline:
- `login.lua` — Playwright-based authentication
- Session cookie storage/management
- Script generation templates
- Exploration agent definition

## Capabilities Required

### Lua Sandbox

| Capability | Purpose |
|------------|---------|
| `browser` | Playwright exploration, login flow |
| `http` | Generated scripts for API calls |
| `html` | DOM parsing during exploration |
| `json` | Response parsing |

### Destinations

| Destination | When Added |
|-------------|------------|
| `familysearch` | After endpoints discovered |
| `familysearch-api` | If separate API domain found |

## Success Criteria

1. Agent can explore FamilySearch and document findings
2. Agent can generate working HTTP scripts from exploration
3. Scripts can search for persons and return structured results
4. When scripts break, agent can diagnose and fix

## Future Extensions

- **Hint resolution** — Compare local persons against FamilySearch matches
- **Source attachment** — Extract citations and link to local records
- **Tree import** — Pull ancestors into local family tree format

These build on the same exploration foundation.

## Decision Log

| Decision | Rationale |
|----------|-----------|
| Browser auth, not API OAuth | Simpler setup until dev credentials obtained |
| Exploration-driven, not predefined scripts | Let usage patterns drive design |
| Minimal output format | Agents request what they need |
| Self-healing via re-exploration | Same mechanism builds and fixes |
| Core infra in separate repo | Pattern generalizes beyond FamilySearch |
