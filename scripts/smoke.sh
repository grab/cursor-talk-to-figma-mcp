#!/usr/bin/env bash
set -euo pipefail
cd "$(dirname "$0")/.."
bun install
bun run build
test -f dist/server.js
echo "cursor-talk-to-figma-mcp smoke passed"
