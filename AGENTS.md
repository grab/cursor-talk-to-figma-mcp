# AGENTS.md

This file provides guidance to Claude Code agents (claude.ai/code) when working with code in this repository.

## Project Overview

MCP (Model Context Protocol) server that bridges AI agents (Cursor, Claude Code) with Figma. Three components communicate in a pipeline:

```
Claude Code / Cursor ←(stdio)→ MCP Server ←(WebSocket)→ WebSocket Relay ←(WebSocket)→ Figma Plugin
```

## Build & Development Commands

```bash
bun install              # Install dependencies
bun run build            # Build MCP server (tsup → dist/)
bun run dev              # Build in watch mode
bun socket               # Start WebSocket relay server (port 3055)
bun run start            # Run built MCP server
bun setup                # Full setup (install + write .cursor/mcp.json + .mcp.json)
```

There is no test suite or linter configured.

## Architecture

### MCP Server (`src/talk_to_figma_mcp/server.ts`)
The main server implementing the MCP protocol via `@modelcontextprotocol/sdk`. Exposes 50+ tools (create shapes, modify text, manage layouts, export images, etc.) and several AI prompts (design strategies). Communicates with the AI agent over stdio and with the WebSocket relay via `ws`. Each request gets a UUID, is tracked in a `pendingRequests` Map with timeout/promise callbacks, and resolves when the plugin responds.

### WebSocket Relay (`src/socket.ts`)
Lightweight Bun WebSocket server on port 3055 (configurable via `PORT` env). Routes messages between MCP server and Figma plugin using channel-based isolation. Clients call `join` to enter a channel; messages broadcast only within the same channel.

### Figma Plugin (`src/cursor_mcp_plugin/`)
Runs inside Figma. `code.js` is the plugin main thread handling 30+ commands via a dispatcher. `ui.html` is the plugin UI for WebSocket connection management. `manifest.json` declares permissions (dynamic-page access, localhost network). The plugin is **not built/bundled** — `code.js` is written directly as the runtime artifact.

## Key Patterns

- **Colors**: Figma uses RGBA 0-1 range. The MCP tools accept 0-1 floats and the filter converts to hex for display.
- **Logging**: All logs go to stderr. Stdout is reserved for MCP protocol messages.
- **Timeouts**: 30s default per command. Progress updates from the plugin reset the inactivity timer.
- **Chunking**: Large operations (scanning 100+ nodes) are chunked with progress updates to prevent Figma UI freezing.
- **Reconnection**: WebSocket auto-reconnects after 2 seconds on disconnect.
- **Zod validation**: All tool parameters are validated with Zod schemas.

## Setup

1. Run `bun setup` — installs dependencies and writes MCP config for both Cursor (`.cursor/mcp.json`) and Claude Code (`.mcp.json`)
2. `bun socket` in one terminal (WebSocket relay on port 3055)
3. In Figma: Plugins → Development → Link existing plugin → select `src/cursor_mcp_plugin/manifest.json`
4. Run plugin in Figma, join a channel, then use tools from Cursor or Claude Code

The MCP config written by `bun setup` uses the published package:

```json
{
  "mcpServers": {
    "TalkToFigma": {
      "command": "bunx",
      "args": ["cursor-talk-to-figma-mcp@latest"]
    }
  }
}
```

You can also add it manually for Claude Code via the CLI:

```bash
claude mcp add TalkToFigma -- bunx cursor-talk-to-figma-mcp@latest
```

## Agent Notes

- Always call `join_channel` before issuing any Figma commands
- Call `get_document_info` first to understand the design structure
- Use `read_my_design` or `get_selection` before making modifications
- Batch operations (`set_multiple_text_contents`, `delete_multiple_nodes`, `set_multiple_annotations`) are preferred over repeated single-node calls for performance
- All MCP tool parameters are Zod-validated; invalid inputs return structured errors
- The plugin and relay must both be running before any tool calls succeed
