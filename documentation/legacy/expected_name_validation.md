# Add Expected Name Validation for Node Renaming

## Goal
Prevent accidental renaming of the wrong Figma node by enforcing a check on the node's current name before applying changes. This directly addresses the user's report of renaming the wrong node.

## User Review Required
> [!IMPORTANT]
> This change introduces a new optional parameter `expectedName` to the `set_node_name` tool. While it doesn't break existing usage (since it's optional), it is highly recommended to use this parameter in future workflows to ensure safety.

## Proposed Changes

### Figma Plugin Handlers
#### [MODIFY] [nodeModifiers.js](file:///Users/neoworks/Git/figma-edit-mcp/src/figma_plugin/handlers/nodeModifiers.js)
- Update `setNodeName` function to accept `expectedName` in `params`.
- Implement validation logic: if `expectedName` is provided, compare it with `node.name`.
- Throw a descriptive error if they do not match.

### MCP Server Definition
#### [MODIFY] [server.ts](file:///Users/neoworks/Git/figma-edit-mcp/src/mcp_server/server.ts)
- Update `set_node_name` tool definition to include `expectedName` as an optional string parameter.
- Pass `expectedName` in the payload sent to Figma.

## Verification Plan

### Manual Verification
1.  **Safety Check**: Attempt to rename a node while providing an incorrect `expectedName`.
    *   *Expected Result*: Operation fails with an error message stating the name mismatch.
2.  **Success Check**: Attempt to rename a node while providing the correct `expectedName`.
    *   *Expected Result*: Node is renamed successfully.
3.  **Legacy Check**: Attempt to rename a node without providing `expectedName`.
    *   *Expected Result*: Node is renamed successfully (backward compatibility).

## Additional Tools to Secure
The following tools will also be updated to support `expectedName` validation to prevent accidental destructive actions:

### 1. `delete_multiple_nodes`
*   **Risk**: High. Deletion is destructive.
*   **Change**: specialized parameters to allow `{id, expectedName}` tuples.

### 2. `set_multiple_text_contents`
*   **Risk**: Medium. Overwriting content on wrong nodes breaks context.
*   **Change**: Add `expectedName` to text content objects.

### 3. `set_instance_overrides`
*   **Risk**: Medium. Swapping properties on wrong instances breaks design system usage.
*   **Change**: Add `expectedName` validation for target instances.

### 4. `move_node`
*   **Risk**: Low/Medium. Displaced items can be confusing.
*   **Change**: Add optional `expectedName` param.

### 5. `resize_node`
*   **Risk**: Low/Medium. Malformed layouts.
*   **Change**: Add optional `expectedName` param.

### 6. `clone_node`
*   **Risk**: Low. Cloning the wrong object clutters the document.
*   **Change**: Add optional `expectedName` param.

## Excluded Commands (Rationale)
The following write-operations are **NOT** subject to `expectedName` validation. The reasoning is based on the trade-off between safety and API friction.

### 1. Creation Commands
*   `create_rectangle`, `create_frame`, `create_text`, `create_component_instance`
*   **Reason**: These commands create *new* entities. They do not structurally alter or destroy the target `parentId`. If an item is created in the wrong parent, it can be moved or deleted without data loss.

### 2. Styling & Layout Tweaks
*   `set_fill_color`, `set_stroke_color`, `set_corner_radius`, `set_bound_variable`
*   `set_layout_mode`, `set_padding`, `set_axis_align`, `set_layout_sizing`, `set_item_spacing`
*   **Reason**: These are non-destructive visual property changes. Applying a style to the wrong node is a visual error that is easily reversible and does not result in loss of content, structure, or identity.

### 3. Additive / Connecting
*   `set_multiple_annotations`, `create_connections`
*   **Reason**: These operations add distinct metadata or separate connector nodes. They do not mutate the inherent content of the target nodes in a way that risks confusion or loss.

