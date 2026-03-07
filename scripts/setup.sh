#!/bin/bash

MCP_CONFIG='{
  "mcpServers": {
    "TalkToFigma": {
      "command": "bunx",
      "args": [
        "cursor-talk-to-figma-mcp@latest"
      ]
    }
  }
}'

bun install

# Cursor: write .cursor/mcp.json
mkdir -p .cursor
echo "$MCP_CONFIG" > .cursor/mcp.json
echo "✓ Cursor MCP config written to .cursor/mcp.json"

# Claude Code: write .mcp.json in project root
echo "$MCP_CONFIG" > .mcp.json
echo "✓ Claude Code MCP config written to .mcp.json"