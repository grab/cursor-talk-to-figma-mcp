# Figma Edit MCP

Connect AI coding assistants to Figma via Model Context Protocol. Read designs, create and modify elements, manage components, variables, and styles — all programmatically through your AI assistant.

**Supported AI Integrations:**
- Cursor
- GitHub Copilot (VS Code)
- Google Antigravity
- Claude Code (VS Code & CLI)
- Claude Desktop

## Project Structure

- `src/mcp_server/` — TypeScript MCP server implementing 40+ Figma tools
- `src/figma_plugin/` — Figma plugin with a modular handler architecture
- `src/socket.ts` — WebSocket server that bridges communication between the MCP server and the Figma plugin

## Quick Start

### 1. Install Prerequisites

```bash
# Install Bun
curl -fsSL https://bun.sh/install | bash
```

### 2. Setup (Install & Build)

```bash
bun setup
```

This installs dependencies and builds both the MCP server and the Figma plugin.

### 3. Configure Integration

```bash
bun integrate
```

You'll see an interactive menu:

```
🤖 Figma Edit MCP Integration
========================================

Select an integration to configure:

  1) Google Antigravity
  2) Visual Studio Code (GitHub Copilot)
  3) Cursor
  4) Claude Desktop
  5) Claude Code (Command Line, Visual Studio Code, Google Antigravity)

  q) Quit

Enter your choice:
```

### 4. Start WebSocket Server

```bash
bun socket
```

Keep this terminal running. The WebSocket server bridges communication between your AI assistant and the Figma plugin.

### 5. Install Figma Plugin

Install from [install locally](#figma-plugin-local-install)

---

## Integration-Specific Setup

Run `bun integrate` and select the appropriate option:

### Google Antigravity

Select option `1`. Configuration is created at `~/.gemini/antigravity/mcp_config.json`. Restart Antigravity to load the MCP server — tools are then automatically available.

### VS Code / GitHub Copilot

1. Requires VS Code 1.102+ with Copilot
2. Enable Agent Mode in Copilot settings
3. Select option `2` (creates `~/Library/Application Support/Code/User/mcp.json`)
4. Use `@workspace` or agent mode to access MCP tools

### Cursor

Select option `3`. Configuration is created at `~/.cursor/mcp.json`.

### Claude Desktop

Select option `4`. Configuration is created at `~/Library/Application Support/Claude/claude_desktop_config.json`.

### Claude Code (VS Code & CLI)

Select option `5` to see the CLI command, then run it in your terminal:

```bash
claude mcp add FigmaEdit bun run /path/to/figma-edit-mcp/dist/server.js
```

Replace `/path/to/figma-edit-mcp` with your actual installation path.

---

## Manual Configuration

If you prefer manual setup, add the following to your MCP config file:

| Integration | Config File Location |
|---|---|
| Cursor | `~/.cursor/mcp.json` |
| VS Code / Copilot | `~/Library/Application Support/Code/User/mcp.json` |
| Antigravity | `~/.gemini/antigravity/mcp_config.json` |
| Claude Desktop | `~/Library/Application Support/Claude/claude_desktop_config.json` |

```json
{
  "mcpServers": {
    "FigmaEdit": {
      "command": "bun",
      "args": ["run", "/path/to/figma-edit-mcp/dist/server.js"]
    }
  }
}
```

---

## Development Setup

### Building from Source

```bash
# Install dependencies
bun install

# Build the MCP server
bun run build

# Watch mode for development
bun run dev

# Build both MCP server and Figma plugin
bun run build:all
```

### WebSocket Server

Start the WebSocket server (required for Figma plugin communication):

```bash
bun socket
```

### Figma Plugin (Local Install)

1. In Figma, go to Plugins > Development > New Plugin
2. Choose "Link existing plugin"
3. Select the `src/figma_plugin/manifest.json` file
4. The plugin should now be available in your Figma development plugins

---

## Windows + WSL Guide

1. Install Bun via PowerShell

```bash
powershell -c "irm bun.sh/install.ps1|iex"
```

2. Uncomment the hostname `0.0.0.0` in `src/socket.ts`

```typescript
// uncomment this to allow connections in windows wsl
hostname: "0.0.0.0",
```

3. Start the WebSocket server

```bash
bun socket
```

---

## Usage

1. Start the WebSocket server (`bun socket`)
2. Install the MCP server in your AI coding assistant (`bun integrate`)
3. Open Figma and run the Figma Edit MCP Plugin
4. Join a channel using the `join_channel` tool to establish communication
5. Use your AI assistant to interact with Figma via the available MCP tools

---

## MCP Tools

The MCP server provides the following tools for interacting with Figma:

### Document & Selection

| Tool | Description |
|---|---|
| `get_document_info` | Get detailed information about the current Figma document |
| `get_nodes_info` | Get detailed information about one or more nodes by providing an array of node IDs |
| `set_selections` | Set selection to one or more nodes and scroll the viewport to show them |

### Node Creation

| Tool | Description |
|---|---|
| `create_frame` | Create a frame with optional fill, stroke, and full auto-layout configuration |
| `create_rectangle` | Create a rectangle with position, size, and optional name |
| `create_text` | Create a text node with customizable font, size, weight, and color |
| `create_node_from_svg` | Create a node from an SVG XML string |

### Node Modification

| Tool | Description |
|---|---|
| `move_node` | Move a node to a new position |
| `resize_node` | Resize a node to new dimensions |
| `clone_node` | Clone an existing node with an optional position offset |
| `delete_multiple_nodes` | Delete one or more nodes in a single operation |
| `set_node_name` | Rename a node in the Figma layer panel |

### Styling

| Tool | Description |
|---|---|
| `set_fill_color` | Set the fill color of a node (RGBA) |
| `set_stroke_color` | Set the stroke color and weight of a node |
| `set_corner_radius` | Set corner radius with optional per-corner control |
| `set_effects` | Apply drop shadow, inner shadow, layer blur, or background blur |

### Auto Layout & Spacing

| Tool | Description |
|---|---|
| `set_layout_mode` | Set layout mode (`NONE`, `HORIZONTAL`, `VERTICAL`) and wrap behavior |
| `set_padding` | Set padding values (top, right, bottom, left) for an auto-layout frame |
| `set_axis_align` | Set primary and counter axis alignment for auto-layout frames |
| `set_layout_sizing` | Set horizontal and vertical sizing modes (`FIXED`, `HUG`, `FILL`) |
| `set_item_spacing` | Set spacing between children and across wrapped rows/columns |

### Text Operations

| Tool | Description |
|---|---|
| `scan_text_nodes` | Scan and retrieve all text nodes within a node, with chunking for large designs |
| `set_multiple_text_contents` | Batch-update text content across multiple nodes in parallel |

### Annotations

| Tool | Description |
|---|---|
| `get_annotations` | Get annotations on a node, including available categories |
| `set_multiple_annotations` | Batch create or update annotations with markdown support |
| `scan_nodes_by_types` | Find child nodes matching specific types (e.g., `COMPONENT`, `FRAME`) |

### Components & Styles

| Tool | Description |
|---|---|
| `get_styles` | List all local styles in the document |
| `get_local_components` | List all local components in the document |
| `create_style` | Create a named style (Text, Paint, Effect, or Grid) |
| `apply_style` | Apply an existing named style to a node |
| `create_component` | Convert a frame into a main component |
| `create_component_instance` | Instantiate a component by key at a given position |
| `get_instance_overrides` | Extract all override properties from a component instance |
| `set_instance_overrides` | Apply extracted overrides to one or more target instances |

### Variables

| Tool | Description |
|---|---|
| `get_variables` | List all variable collections, or get details for a specific variable by ID |
| `get_node_variables` | Inspect bound variables and explicit variable modes on a node |
| `set_bound_variable` | Bind a variable to a node property, or set an explicit variable mode |
| `manage_variables` | Create collections, create variables, and set values or aliases |

### Prototyping & Connections

| Tool | Description |
|---|---|
| `get_reactions` | Extract prototype reactions (click flows, overlays) from nodes |
| `set_default_connector` | Set a FigJam connector as the default style for new connections |
| `create_connections` | Draw connector lines between nodes based on mappings or prototype flows |

### Export

| Tool | Description |
|---|---|
| `export_node_as_image` | Export a node as PNG, JPG, SVG, or PDF |

### Connection Management

| Tool | Description |
|---|---|
| `join_channel` | Join a WebSocket channel to establish communication with the Figma plugin |

---

## MCP Prompts

Built-in prompts guide complex multi-step design tasks:

| Prompt | Description |
|---|---|
| `design_strategy` | Best practices for creating Figma designs with proper hierarchy and naming |
| `read_design_strategy` | Best practices for reading and exploring Figma designs |
| `text_replacement_strategy` | Chunked, progressive approach to bulk text replacement with visual verification |
| `annotation_conversion_strategy` | Convert legacy manual annotations to Figma's native annotation system |
| `swap_overrides_instances` | Transfer component instance overrides from a source to multiple targets |
| `reaction_to_connector_strategy` | Convert prototype reaction flows into visual FigJam connector lines |

---

## Acknowledgements

This project is a fork of [grab/cursor-talk-to-figma-mcp](https://github.com/grab/cursor-talk-to-figma-mcp) by [sonnylazuardi](https://github.com/sonnylazuardi).  
Thank you to the original authors and contributors for the foundation this project builds on.

Thanks to [@dusskapark](https://github.com/dusskapark) for the following contributions:

- **Bulk text content replacement** — Batch-update text across large designs efficiently. [Demo video](https://www.youtube.com/watch?v=j05gGT3xfCs)
- **Instance override propagation** — Propagate component instance overrides from a source to multiple targets in a single command, dramatically reducing repetitive design work. [Demo video](https://youtu.be/uvuT8LByroI)

---

## Best Practices

When working with Figma Edit MCP:

1. Always join a channel first with `join_channel` before sending any other commands


---

## License

The MIT License (MIT)

Copyright (c) 2025 Github User sonnylazuardi
Copyright (c) 2026 Neo Product LLC
