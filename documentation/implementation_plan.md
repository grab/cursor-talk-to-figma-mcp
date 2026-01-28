# Tool Rationalization Plan

## Goal
Reduce the number of tools exposed by the FigmaEdit MCP server to the minimal set required for full functionality, while eliminating tools that rely on fragile state (like "current selection") to ensure robustness.

## User Review Required
> [!IMPORTANT]
> This plan involves **removing 7 tools** from the API. These are breaking changes. Clients must update to use bulk/plural versions or explicit node targeting via IDs to avoid "selection drift" issues where the wrong node is modified because the user clicked away during agent execution.

## Identified Redundancies & Fragile Tools

The following tools have been identified as redundant wrappers or state-dependent tools that should be replaced with explicit ID-based operations.

| Removed Tool | Replacement Tool | Justification |
| :--- | :--- | :--- |
| `get_node_info` | `get_nodes_info` | `get_nodes_info` accepts `nodeIds: string[]`. Passing `['id']` achieves the same result. |
| `delete_node` | `delete_multiple_nodes` | `delete_multiple_nodes` accepts `nodeIds: string[]`. Passing `['id']` works. |
| `set_focus` | `set_selections` | `set_selections` accepts `nodeIds: string[]` and performs the same "select and scroll to" operation. |
| `set_text_content` | `set_multiple_text_contents` | `set_multiple_text_contents` accepts an array of updates. |
| `set_annotation` | `set_multiple_annotations` | `set_multiple_annotations` accepts an array of updates. |
| `get_selection` | `get_nodes_info` | Relies on "current selection" state which can change mid-run. Agents should use explicit IDs or `get_document_info` to find context. |
| `read_my_design` | `get_nodes_info` | Like `get_selection`, this is fragile if the user clicks a different frame during agent execution. Forcing the use of explicit `nodeIds` via `get_nodes_info` ensures the agent only modifies what it has explicitly analyzed. |

### Tools Analyzed but Kept
- **`scan_text_nodes` vs `scan_nodes_by_types`**: Kept `scan_text_nodes` because it implements **chunking** for performance on large documents.
- **`get_document_info`**: Kept as the entry point for agents to discover nodes on the page without relying on selection state.

## Proposed Changes

### [src/mcp_server]

#### [MODIFY] [server.ts](file:///Users/neoworks/Git/figma-edit-mcp/src/mcp_server/server.ts)
- Remove `server.tool("get_node_info", ...)` definition.
- Remove `server.tool("delete_node", ...)` definition.
- Remove `server.tool("set_focus", ...)` definition.
- Remove `server.tool("set_text_content", ...)` definition.
- Remove `server.tool("set_annotation", ...)` definition.
- Remove `server.tool("get_selection", ...)` definition.
- Remove `server.tool("read_my_design", ...)` definition.

Note: The underlying plugin handlers in [src/figma_plugin/code.js](file:///Users/neoworks/Git/figma-edit-mcp/src/figma_plugin/code.js) can be kept if they are used internally or by the plugin UI, but removing them from `server.ts` prevents MCP usage.

## Verification Plan

### Automated Tests
The project does not have an automated test suite for the MCP/Plugin bridge. Verification will be manual.

### Manual Verification
1.  **Build** the project: `npm run build`.
2.  **Restart** the MCP server.
3.  **Verify Removal**: Check that the 7 removed tools are no longer listed in `list_tools`.
4.  **Verify Robustness**:
    *   Call `get_nodes_info(nodeIds=["some_id"])` and verify it returns info.
    *   Call `set_selections(nodeIds=["some_id"])` and verify it focuses.
    *   Confirm that `get_document_info` provides enough context for the agent to find relevant nodes without needing to "see" the current selection.
