# Add set_table_cell_contents tool for FigJam/Figma tables

## Summary

Adds a new MCP tool `set_table_cell_contents` so Cursor can update table cell text in FigJam (and Figma) tables by **row and column index**, without needing to resolve individual TEXT node IDs. Table cells are `TABLE_CELL` nodes whose content lives in a `TableCellNode.text` (TextSublayerNode); this tool uses the Figma Plugin API to set `cell.text.characters` after loading the font.

## Motivation

- `set_multiple_text_contents` only works on **TEXT** nodes. FigJam table cells are **TABLE_CELL** nodes, so filling a table from Cursor was not possible without this.
- Enables use cases like: “Insert my top 10 stock picks into this FigJam rankings table” by passing the table ID and an array of `{ rowIndex, columnIndex, text }`.

## Changes

### Plugin (`src/cursor_mcp_plugin/code.js`)

- New command handler: `set_table_cell_contents`.
- New async function `setTableCellContents(params)`:
  - Validates `tableNodeId` and `updates` (array of `{ rowIndex, columnIndex, text }`).
  - Resolves the table node; errors if not found or not type `TABLE`.
  - For each update: `table.cellAt(rowIndex, columnIndex)` → get `cell.text` → `figma.loadFontAsync(textNode.fontName)` → `textNode.characters = text`.
  - Returns `{ success, updated, failed, results }` per cell.

### MCP server (`src/talk_to_figma_mcp/server.ts`)

- New tool `set_table_cell_contents` with params:
  - `tableNodeId` (string): table node ID (e.g. from `get_document_info` / `get_node_info`).
  - `updates` (array): `{ rowIndex: number, columnIndex: number, text: string }[]`.
- Added `set_table_cell_contents` to `FigmaCommand` and `CommandParams`.

## Usage example

From Cursor (after joining channel and with plugin connected):

```json
{
  "tableNodeId": "0:20",
  "updates": [
    { "rowIndex": 1, "columnIndex": 1, "text": "Western Digital" },
    { "rowIndex": 1, "columnIndex": 2, "text": "WDC" }
  ]
}
```

Row and column indices are 0-based (row 0 = first row, e.g. header).

## Testing

- Manual: Open a FigJam file with a table, connect the Talk to Figma plugin, join channel, then call `set_table_cell_contents` with the table node ID and a few updates; confirm cell text changes in FigJam.

## References

- [Figma Plugin API: TableNode](https://www.figma.com/plugin-docs/api/TableNode/) — `cellAt(rowIndex, columnIndex)`
- [Figma Plugin API: TableCellNode](https://www.figma.com/plugin-docs/api/TableCellNode/) — `text: TextSublayerNode`
- TextSublayerNode supports `characters`; font must be loaded with `figma.loadFontAsync()` before setting.
