# Refactor Parameter Names Implementation Plan

## Goal Description
Refactor parameter names to be more intuitive and consistent across the MCP server and Figma plugin.
The following changes will be applied:
1. `expectedName` -> `nodeName`
2. `expectedParentName` -> `parentNodeName`
3. `expectedStartNodeName` -> `startNodeName`
4. `expectedEndNodeName` -> `endNodeName`

## Parameter Descriptions
The following descriptions will be used for the new parameters in the tool definitions:

- **nodeName**: "Name of the node to modify."
- **nodeId**: "ID of the node to modify."

- **parentNodeName**: "Name of the parent node."
- **parentId**: "ID of the parent node."

- **startNodeName**: "Name of the starting node."
- **endNodeName**: "Name of the ending node."

## Error Messages
The `ERRORS` constant in `main.js` will be updated to reflect the new parameter names:

- **NAME_MISMATCH**: "Operation Denied: nodeName does not match name of nodeId. Refresh context & recheck to ensure correct nodeId is passed in."
- **PARENT_NAME_MISMATCH**: "Operation Denied: parentNodeName does not match name of parentId. Refresh context & recheck to ensure correct parentId is passed in."

## Code Scan Results
A scan of the codebase for `nodeName`, `parentNodeName`, `startNodeName`, and `endNodeName` revealed:
- `nodeName` is used in `main.js` and `ui.html` for scope validation messaging. This usage is distinct from the command parameters and will not conflict.
- Other new parameter names are not currently used in the codebase.

## User Review Required
> [!IMPORTANT]
> This is a breaking change for the MCP tools. Any clients relying on the old parameter names will need to be updated.

## Proposed Changes

### MCP Server
#### [mcp_server](src/mcp_server)
Update tool definitions to use new parameter names and descriptions.

##### [MODIFY] [server.ts](file:///Users/neoworks/Git/figma-edit-mcp/src/mcp_server/server.ts)
- Update `create_rectangle`, `create_frame`, `create_text`, `clone_node`: `expectedParentName` -> `parentNodeName`.
- Update `set_fill_color`, `set_stroke_color`, `set_corner_radius`, `set_layout_mode`, `set_padding`, `set_axis_align`, `set_layout_sizing`, `set_item_spacing`, `set_bound_variable`, `set_node_name`, `move_node`, `resize_node`, `clone_node`: `expectedName` -> `nodeName`.
- Update `create_connections`: `expectedStartNodeName` -> `startNodeName`, `expectedEndNodeName` -> `endNodeName`.
- Update `create_component_instance`: `expectedParentName` -> `parentNodeName`.
- Update `set_multiple_text_contents`, `set_multiple_annotations`, `delete_multiple_nodes`, `set_instance_overrides`: update array item properties.
- Update parameter descriptions to match user request.

### Figma Plugin
#### [figma_plugin](src/figma_plugin)
Update input validation logic to check for new parameter names.

##### [MODIFY] [main.js](file:///Users/neoworks/Git/figma-edit-mcp/src/figma_plugin/src/main.js)
- Update `ERRORS` object constants to refer to new names.
- Update `handleCommand` switch cases to access `params.nodeName`, `params.parentNodeName`, etc.
- Update `checkScopeAccess` and `verifyNodeName` calls to pass the correct new parameters.

## Verification Plan

### Automated Tests
- There are no existing automated tests for the plugin logic that I can run easily without a Figma environment.
- I will verify the build process to ensure no compilation errors.
    - `npm run build` for server
    - `npm run plugin:build` for plugin

### Manual Verification
- This change affects the interface between the MCP server and the Figma plugin.
- Since I cannot run the plugin in Figma, I will rely on code correctness and build verification.
- I will perform a self-review of the changes to ensure all occurrences are updated.
