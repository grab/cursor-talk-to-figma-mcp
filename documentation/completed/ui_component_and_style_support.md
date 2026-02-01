# Figma Edit MCP Expansion Plan

## Goal Description
To enable an AI Agent to build a complete, premium design system and UI component library for a "How local LLMs work" app. The current MCP server lacks the ability to define reusable components, import vector icons (SVGs), create shared styles (Typography/Color), and apply advanced effects (Shadows/Blurs).

## User Review Required
> [!IMPORTANT]
> **SVG Handling**: We will use `createNodeFromSvg` for icons as it is significantly more reliable for AI generation than drawing vector paths point-by-point.

> [!WARNING]
> **Component Logic**: Creating components often changes legibility and layout behavior. The `create_component` tool will operate by converting an existing `FrameNode` into a `ComponentNode`.

## Proposed Changes

### Figma Plugin (`src/figma_plugin/src`)

#### [NEW] `src/figma_plugin/src/handlers/styleHandlers.js`
- Implement `createStyle` (handles TEXT, PAINT, EFFECT, GRID)
- Implement `applyStyle` (applies style by ID to node)

#### [MODIFY] `src/figma_plugin/src/handlers/componentHandlers.js`
- Add `createComponent` (wraps `figma.createComponent`)

#### [NEW] `src/figma_plugin/src/handlers/vectorHandlers.js`
- Implement `createNodeFromSvg`

#### [MODIFY] `src/figma_plugin/src/handlers/stylingHandlers.js`
- Add `setEffects` (for Drop Shadows, Layer Blurs)

#### [MODIFY] `src/figma_plugin/src/handlers/variableHandlers.js`
- Implement `handleVariableRequest` (dispatches CREATE_COLLECTION, CREATE_VARIABLE, SET_VALUE)

#### [MODIFY] `src/figma_plugin/src/main.js`
- Register new command handlers with the following validation requirements:

| Command | Enforce `state.readOnly` | Check Scope | Verify Name | Context |
| :--- | :---: | :---: | :---: | :--- |
| `manage_variables` | ✅ | ❌ | ❌ | Document Level (Non-destructive to nodes) |
| `create_style` | ✅ | ❌ | ❌ | Document Level (Non-destructive to nodes) |
| `apply_style` | ✅ | ✅ | ✅ | Target Node (`nodeId`, `nodeName`) |
| `create_component` | ✅ | ✅ | ✅ | Target Frame (to become component) |
| `create_node_from_svg` | ✅ | ✅ | ✅ | Parent Node (`parentId`, `parentNodeName`) |
| `set_effects` | ✅ | ✅ | ✅ | Target Node (`nodeId`, `nodeName`) |


### MCP Server (`src/mcp_server/server.ts`)

#### [MODIFY] `src/mcp_server/server.ts`
- Expose new tools via MCP SDK:
    - `create_component`: Transforms a frame into a main component.
    - `create_node_from_svg`: Creates a node from an SVG string.
    - `create_style`: Creates named styles (Text, Paint, Effect, Grid).
    - `apply_style`: Applies a style to a node by ID.
    - `set_effects`: Applies shadow/effect arrays to nodes.
    - `manage_variables`: Comprehensive tool to create collections, variables, and set values/aliases.

## Verification Plan

### Automated Tests
- We will create a test script `verify_expansion.js` that calls the new tools to:
    1.  Create a "Primary Blue" Paint Style using `create_style`.
    2.  Create a "Body" Text Style using `create_style`.
    3.  Create a "Theme" Variable Collection using `manage_variables`.
    4.  Create a "primary-color" Color Variable in that collection using `manage_variables`.
    5.  Set the variable value to an alias using `manage_variables`.
    6.  Create an icon from an SVG string.
    7.  Create a button Frame using the styles and variables.
    8.  Convert the button Frame into a Component.
    9.  Apply a Drop Shadow using `set_effects`.

### Manual Verification
- **Build Plugin**: `npm run plugin:build`
- **Restart Server**: Restart the MCP server.
- **Run Workflow**: Execute a test prompt: "Create a purple button component with a shadow and a verified icon."
