join_channel: o4jrqyqe#!/bin/bash

# Create .trae directory if it doesn't exist
mkdir -p .trae

bun install

# Create mcp.json for Trae AI with the current directory path
echo "{
  \"mcpServers\": {
    \"TalkToFigma\": {
      \"command\": \"bunx\",
      \"args\": [
        \"cursor-talk-to-figma-mcp@latest\"
      ]
    }
  }
}" > .trae/mcp.json

echo "Trae AI MCP configuration created at .trae/mcp.json"
echo "Please copy the configuration to your Trae AI settings or import it manually."
echo ""
echo "Configuration content:"
cat .trae/mcp.json
echo ""
echo "To use with Trae AI:"
echo "1. Open Trae AI"
echo "2. Go to AI settings > MCP"
echo "3. Click '+ Add' > 'Manual Add'"
echo "4. Copy and paste the above JSON configuration"
echo "5. Start the WebSocket server with: bun socket"
echo "6. Use the join_channel tool to connect to your Figma channel"