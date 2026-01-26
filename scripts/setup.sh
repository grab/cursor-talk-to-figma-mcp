#!/bin/bash

# Universal setup script for Talk to Figma MCP
# Supports: Cursor, GitHub Copilot, VS Code, Claude Code, Antigravity

# Install dependencies
bun install

# MCP configuration JSON
MCP_CONFIG='{
  "mcpServers": {
    "TalkToFigma": {
      "command": "bunx",
      "args": ["vscode-talk-to-figma-mcp@latest"]
    }
  }
}'

# Create config for Cursor
mkdir -p .cursor
echo "$MCP_CONFIG" > .cursor/mcp.json
echo "✅ Created .cursor/mcp.json (for Cursor)"

# Create config for VS Code, Copilot, Antigravity, Claude Code
mkdir -p .vscode
echo "$MCP_CONFIG" > .vscode/mcp.json
echo "✅ Created .vscode/mcp.json (for VS Code, GitHub Copilot, Antigravity, Claude Code)"

echo ""
echo "🎉 Setup complete! The MCP server is now configured for:"
echo "   • Cursor"
echo "   • GitHub Copilot in VS Code"
echo "   • Google Antigravity"
echo "   • Claude Code in VS Code"
echo "   • Claude Code in Antigravity"
echo ""
echo "Next steps:"
echo "   1. Start the WebSocket server: bun socket"
echo "   2. Open Figma and run the 'Talk to Figma MCP Plugin'"
echo "   3. Connect to channel in your AI assistant"