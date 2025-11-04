#!/bin/bash

# Create .cursor directory if it doesn't exist
mkdir -p ~/.cursor

bun install

MCP_JSON_PATH="$HOME/.cursor/mcp.json"

TALKTOFIGMA_JSON='\
  "TalkToFigma": {\
    "command": "bunx",\
    "args": [\
      "cursor-talk-to-figma-mcp@latest"\
    ]\
  }'

if [ ! -f "$MCP_JSON_PATH" ]; then
  echo "{\n  \"mcpServers\": {\n    $TALKTOFIGMA_JSON\n  }\n}" > "$MCP_JSON_PATH"
else
  if ! command -v jq &> /dev/null; then
    echo "Error: jq is required but not installed. Please install jq (e.g., 'brew install jq' or 'apt-get install jq') and rerun this script."
    exit 1
  fi

  if ! jq -e ".mcpServers.TalkToFigma" "$MCP_JSON_PATH" > /dev/null; then
    tmpfile=$(mktemp)
    jq ".mcpServers += {TalkToFigma: {command: \"bunx\", args: [\"cursor-talk-to-figma-mcp@latest\"]}}" "$MCP_JSON_PATH" > "$tmpfile" && mv "$tmpfile" "$MCP_JSON_PATH"
  else
    echo "TalkToFigma already exists in mcpServers"
  fi
fi 