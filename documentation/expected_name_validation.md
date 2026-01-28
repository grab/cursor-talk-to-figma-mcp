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
