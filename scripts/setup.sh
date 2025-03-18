#!/bin/bash

# Create .cursor directory if it doesn't exist
mkdir -p .cursor

# Get current directory path
CURRENT_DIR=$(pwd)

bun install

# Create mcp.json with the current directory path
echo "{
  \"mcpServers\": {
    \"TalkToFigma\": {
      \"command\": \"bun\",
      \"args\": [
        \"${CURRENT_DIR}/src/talk_to_figma_mcp/server.ts\"
      ]
    }
  }
}" > .cursor/mcp.json 