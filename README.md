# Talk to Figma MCP

This project implements a Model Context Protocol (MCP) integration between AI agent (Cursor, Claude Code) and Figma, allowing AI agent to communicate with Figma for reading designs and modifying them programmatically.

https://github.com/user-attachments/assets/129a14d2-ed73-470f-9a4c-2240b2a4885c

## Project Structure

- `src/talk_to_figma_mcp/` - TypeScript MCP server for Figma integration
- `src/cursor_mcp_plugin/` - Figma plugin for communicating with Cursor
- `src/socket.ts` - WebSocket server that facilitates communication between the MCP server and Figma plugin

## How to use

1. Install Bun if you haven't already:

```bash
curl -fsSL https://bun.sh/install | bash
```

2. Run setup, this will also install MCP in your Cursor's active project

```bash
bun setup
```

3. Start the Websocket server

```bash
bun socket
```

4. **NEW** Install Figma plugin from [Figma community page](https://www.figma.com/community/plugin/1485687494525374295/cursor-talk-to-figma-mcp-plugin) or [install locally](#figma-plugin)

## Quick Video Tutorial

[Video Link](https://www.linkedin.com/posts/sonnylazuardi_just-wanted-to-share-my-latest-experiment-activity-7307821553654657024-yrh8)

## Design Automation Example

**Bulk text content replacement**

Thanks to [@dusskapark](https://github.com/dusskapark) for contributing the bulk text replacement feature. Here is the [demo video](https://www.youtube.com/watch?v=j05gGT3xfCs).

**Instance Override Propagation**
Another contribution from [@dusskapark](https://github.com/dusskapark)
Propagate component instance overrides from a source instance to multiple target instances with a single command. This feature dramatically reduces repetitive design work when working with component instances that need similar customizations. Check out our [demo video](https://youtu.be/uvuT8LByroI).

## Manual Setup and Installation

### MCP Server: Integration with Cursor

Add the server to your Cursor MCP configuration in `~/.cursor/mcp.json`:

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

### WebSocket Server

Start the WebSocket server:

```bash
bun socket
```

### Figma Plugin

1. In Figma, go to Plugins > Development > New Plugin
2. Choose "Link existing plugin"
3. Select the `src/cursor_mcp_plugin/manifest.json` file
4. The plugin should now be available in your Figma development plugins

## Windows + WSL Guide

1. Install bun via powershell

```bash
powershell -c "irm bun.sh/install.ps1|iex"
```

2. Start the websocket so it accepts connections from outside WSL (by default it only listens on `127.0.0.1`)

```bash
# PowerShell
$env:HOST="0.0.0.0"; bun socket

# bash
HOST=0.0.0.0 bun socket
```

## Usage

1. Start the WebSocket server
2. Install the MCP server in Cursor
3. Open Figma and run the Cursor MCP Plugin
4. Connect the plugin to the WebSocket server by joining a channel using `join_channel`
5. Use Cursor to communicate with Figma using the MCP tools

## Local Development Setup

To develop, update your mcp config to direct to your local directory.

```json
{
  "mcpServers": {
    "TalkToFigma": {
      "command": "bun",
      "args": ["/path-to-repo/src/talk_to_figma_mcp/server.ts"]
    }
  }
}
```

Options: `--server=<host>` (remote relay over wss) and `--port=<port>` (relay port, default 3055).
The relay port can be changed with `PORT=3056 bun socket`.

## MCP Tools

The MCP server provides the following tools for interacting with Figma:

### Document & Selection

- `get_document_info` - Get current-page details plus a document-wide page index
- `get_pages` - Enumerate every page; top-level child counts are opt-in
- `set_current_page` - Switch the active page for subsequent page-scoped operations
- `get_selection` - Get information about the current selection
- `read_my_design` - Get detailed node information about the current selection without parameters
- `get_node_info` - Get detailed information about a specific node
- `get_nodes_info` - Get detailed information about multiple nodes by providing an array of node IDs
- `set_focus` - Set focus on a specific node by selecting it and scrolling viewport to it
- `set_selections` - Set selection to multiple nodes and scroll viewport to show them
- `select_nodes` - Multi-select nodes by ID; switches to the page that holds them (reports IDs that are missing or on other pages)

### Annotations

- `get_annotations` - Get all annotations in the current document or specific node
- `set_annotation` - Create or update an annotation with markdown support
- `set_multiple_annotations` - Batch create/update multiple annotations efficiently
- `scan_nodes_by_types` - Scan for nodes with specific types (useful for finding annotation targets)

### Prototyping & Connections

- `get_reactions` - Get all prototype reactions from nodes with visual highlight animation
- `set_default_connector` - Set a copied FigJam connector as the default connector style for creating connections (must be set before creating connections)
- `create_connections` - Create FigJam connector lines between nodes, based on prototype flows or custom mapping

### Creating Elements

- `create_rectangle` - Create a new rectangle with position, size, and optional name
- `create_frame` - Create a new frame with position, size, and optional name
- `create_section` - Create a section to group related content on the canvas
- `create_text` - Create a new text node with customizable font properties

### Modifying text content

- `scan_text_nodes` - Scan text nodes with intelligent chunking for large designs
- `set_text_content` - Set the text content of a single text node
- `set_multiple_text_contents` - Batch update multiple text nodes efficiently

### Auto Layout & Spacing

- `set_layout_mode` - Set the layout mode and wrap behavior of a frame (NONE, HORIZONTAL, VERTICAL)
- `set_padding` - Set padding values for an auto-layout frame (top, right, bottom, left)
- `set_axis_align` - Set primary and counter axis alignment for auto-layout frames
- `set_layout_sizing` - Set horizontal and vertical sizing modes for auto-layout frames (FIXED, HUG, FILL)
- `set_item_spacing` - Set distance between children in an auto-layout frame

### Styling

- `set_fill_color` - Set the fill color of a node (RGBA)
- `set_stroke_color` - Set the stroke color and weight of a node
- `set_corner_radius` - Set the corner radius of a node with optional per-corner control
- `set_image_fill` - Fill a node with an image from a local file path, URL, or base64 data (FILL, FIT, CROP, or TILE)

### Layout & Organization

- `move_node` - Move a node to a new position
- `resize_node` - Resize a node with new dimensions
- `delete_node` - Delete a node
- `delete_multiple_nodes` - Delete multiple nodes at once efficiently
- `clone_node` - Create a copy of an existing node with optional position offset
- `rename_node` - Rename a node
- `set_parent` - Move a node into a new parent (section, frame or group), preserving its absolute position by default

### Components & Styles

- `get_styles` - Get information about local styles
- `get_local_components` - Get information about local components
- `create_component_instance` - Create an instance of a component
- `get_instance_overrides` - Extract override properties from a selected component instance
- `set_instance_overrides` - Apply extracted overrides to target instances

### Export & Advanced

- `export_node_as_image` - Export a node as an image (PNG, JPG, SVG, or PDF) - limited support on image currently returning base64 as text
- `start_bulk_export` - Select many nodes by ID and export them all to files on disk as a background job; returns a `jobId` immediately
- `get_bulk_export_status` - Progress of a bulk export: done / left / failed (with errors), percent, current node, ETA, status
- `cancel_bulk_export` - Cancel a running bulk export (files already written are kept)

### Bulk export

Exporting many nodes with `export_node_as_image` in a loop is slow: every node is a separate
round trip, and the image comes back as base64 into the agent's context. Bulk export runs the
whole batch inside the plugin and writes files on the machine that runs the MCP server.

```text
start_bulk_export({
  nodeIds: ["12:34", "12:35", ...],
  outputDir: "/tmp/exports",        // created if missing
  format: "PNG",                    // PNG (default) | JPG | SVG | PDF
  scale: 2,                         // PNG/JPG only, default 1
  fileNames: ["home", "settings"],  // optional: array in nodeIds order, or { "12:34": "home" }
  concurrency: 3,                   // optional, default 3, falls back to 1 if Figma errors
  nodeTimeoutMs: 120000,            // optional per-node timeout
  select: true                      // optional, multi-select the nodes in Figma first
})
-> { "jobId": "bulk-...", "status": "running", "total": 323, "selectedCount": 323, ... }

get_bulk_export_status({ jobId: "bulk-..." })
-> 180/323 done (55.7%), 143 left, 2 failed, ETA ~4m
   { "status": "running", "done": 180, "left": 143, "failed": [{ "nodeId": "...", "error": "..." }], ... }
```

- Files are named `<fileName or nodeId>.<ext>`; `:` and other unsafe characters become `-`
  (node `12:34` -> `12-34.png`). Duplicate names get `_2`, `_3`, ...
- A node that fails or times out is recorded in `failed` and the batch keeps going.
- When the job ends, `bulk-export-<jobId>.json` (final status + file list) is written to `outputDir`.
- The plugin window shows a progress bar with done / left / failed, and Figma shows a
  notification when the export starts and ends.
- Status is `running`, `done`, `failed` or `cancelled`. A job that gets no events from Figma
  for 3 minutes, or loses the relay connection, is marked `failed`.
- Bulk export needs the plugin from this repo (re-link `src/cursor_mcp_plugin/manifest.json`);
  the relay can be the stock one, but the updated `src/socket.ts` avoids logging image data.

### Connection Management

- `join_channel` - Join a specific channel to communicate with Figma

### MCP Prompts

The MCP server includes several helper prompts to guide you through complex design tasks:

- `design_strategy` - Best practices for working with Figma designs
- `read_design_strategy` - Best practices for reading Figma designs
- `text_replacement_strategy` - Systematic approach for replacing text in Figma designs
- `annotation_conversion_strategy` - Strategy for converting manual annotations to Figma's native annotations
- `swap_overrides_instances` - Strategy for transferring overrides between component instances in Figma
- `reaction_to_connector_strategy` - Strategy for converting Figma prototype reactions to connector lines using the output of 'get_reactions', and guiding the use 'create_connections' in sequence

## Development

### Building the Figma Plugin

1. Navigate to the Figma plugin directory:

   ```
   cd src/cursor_mcp_plugin
   ```

2. Edit code.js and ui.html

### Tests

```bash
bun run typecheck
bun run test   # builds, then runs unit tests and an end-to-end test
```

The end-to-end test starts the relay on a random free port, runs the built MCP server
against it, and runs the real `code.js` and `ui.html` script with a fake Figma API.

## Best Practices

When working with the Figma MCP:

1. Always join a channel before sending commands
2. Get the document page index using `get_pages`, then use `get_document_info` for the current page
3. Check current selection with `get_selection` before modifications
4. Use appropriate creation tools based on needs:
   - `create_frame` for containers
   - `create_rectangle` for basic shapes
   - `create_text` for text elements
5. Verify changes using `get_node_info`
6. Use component instances when possible for consistency
7. Handle errors appropriately as all commands can throw exceptions
8. For large designs:
   - Use chunking parameters in `scan_text_nodes`
   - Monitor progress through WebSocket updates
   - Implement appropriate error handling
9. For text operations:
   - Use batch operations when possible
   - Consider structural relationships
   - Verify changes with targeted exports
10. For converting legacy annotations:
    - Scan text nodes to identify numbered markers and descriptions
    - Use `scan_nodes_by_types` to find UI elements that annotations refer to
    - Match markers with their target elements using path, name, or proximity
    - Categorize annotations appropriately with `get_annotations`
    - Create native annotations with `set_multiple_annotations` in batches
    - Verify all annotations are properly linked to their targets
    - Delete legacy annotation nodes after successful conversion
11. Visualize prototype noodles as FigJam connectors:

- Use `get_reactions` to extract prototype flows,
- set a default connector with `set_default_connector`,
- and generate connector lines with `create_connections` for clear visual flow mapping.

## License

MIT
