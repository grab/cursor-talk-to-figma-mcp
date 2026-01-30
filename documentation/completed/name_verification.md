# Implementation Plan - Node Verification for Figma Tools

To prevent AI hallucinations and errors, we will implement a verification mechanism that requires tools to provide the name of the node they are modifying (or the parent node for creation tools). The Figma plugin will verify these names before executing the operations.

## User Review Required

> [!IMPORTANT]
> **Breaking Change**: This change will update the tool definitions (schemas) for most Figma tools. The AI (and any other API consumers) will be required to provide `expectedName` or `expectedParentName`. Existing scripts or prompts using these tools may break if not updated.

## Proposed Changes

We will modify `src/mcp_server/server.ts` to update Zod schemas and `src/figma_plugin/src/main.js` to implement the verification logic.

### Server Side (`src/mcp_server/server.ts`)

Update the following tool schemas:

#### Modification Tools (Single Node)
Add `expectedName: z.string().describe("The name of the node to verify against before modifying")` to:
- `set_fill_color`
- `set_stroke_color`
- `set_corner_radius`
- `set_layout_mode`
- `set_padding`
- `set_axis_align`
- `set_layout_sizing`
- `set_item_spacing`
- `set_bound_variable`
- `set_node_name`

- `move_node`
- `resize_node`
- `clone_node`

#### Creation Tools
Add `expectedParentName: z.string().describe("The name of the parent node to verify against")` to:
- `create_rectangle`
- `create_frame`
- `create_text`
- `create_component_instance`: Add `parentId` support to the tool and `expectedParentName` validation.

#### Multi-Node Tools
These tools operate on multiple nodes and will require an array of objects pattern to verify each node independently.

- `set_instance_overrides`: Replace `targetNodeIds: z.array(z.string())` with `targetNodes: z.array(z.object({ nodeId: z.string(), expectedName: z.string() }))`.
- `delete_multiple_nodes`: Replace `nodeIds: z.array(z.string())` with `nodes: z.array(z.object({ nodeId: z.string(), expectedName: z.string() }))`.
- `set_multiple_text_contents`: Update the existing `text` array objects to include `expectedName: z.string()`.
- `set_multiple_annotations`: Update the existing `annotations` array objects to include `expectedName: z.string()`.
- `create_connections`: Update `connections` array objects to include `expectedStartNodeName: z.string()` and `expectedEndNodeName: z.string()`. These verify the identities of the nodes being connected.

### Plugin Side (`src/figma_plugin/src/main.js`)

1.  **Helper Functions**:
    - `verifyNodeName(nodeId, expectedName)`: Throws error if node not found or name mismatch.
    - `verifyParentName(parentId, expectedParentName)`: Throws error if parent not found or name mismatch.

2.  **Handler Updates**:
    - Update `handleCommand` for each modified tool to extract the expected name from params and call the helper verification function *before* calling the actual handler.

## Verification Plan

### Automated Tests
- We cannot easily run automated tests for the plugin interaction without a Figma environment.
- We will rely on manual verification steps.

### Manual Verification
1.  **Build Plugin**: Run `npm run plugin:build` (or relevant build script).
2.  **Connect**: Connect the plugin to the server.
3.  **Test Modification**:
    - Call `set_node_name` with correct `expectedName`. Verify success.
    - Call `set_node_name` with incorrect `expectedName`. Verify error "Name mismatch".
4.  **Test Creation**:
    - Call `create_rectangle` with correct `expectedParentName`. Verify success.
    - Call `create_rectangle` with incorrect `expectedParentName`. Verify error.
