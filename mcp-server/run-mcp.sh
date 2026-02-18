#!/usr/bin/env bash
set -euo pipefail

# Resolve project root (parent of this script's directory)
SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"

cd "$PROJECT_ROOT"

# Ensure dependencies are installed
if [ ! -d node_modules ]; then
  npm install --silent >&2
fi

exec node mcp-server/index.mjs
