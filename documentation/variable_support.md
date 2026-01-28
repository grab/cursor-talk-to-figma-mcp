# Figma Variable Support Guide

This document outlines the Figma Plugin APIs required to enable AI agents to read and apply variables to nodes in a Figma Design document.

## 1. Reading Variables & Collections

To discover available variables (e.g., "Primary Color", "Spacing-SM") and their IDs, the plugin needs to read global variable data.

*   **`figma.variables.getLocalVariableCollectionsAsync()`**
    *   **Purpose**: Returns all variable collections (groups of variables) in the local file.
    *   **Returns**: `Promise<VariableCollection[]>`
    
*   **`figma.variables.getLocalVariablesAsync()`**
    *   **Purpose**: Returns all individual variables defined in the file.
    *   **Returns**: `Promise<Variable[]>`

*   **`figma.variables.getVariableByIdAsync(id)`** *(Optional)*
    *   **Purpose**: Retrieves a single variable by its specific ID.
    *   **Returns**: `Promise<Variable | null>`

## 2. Reading Bound Variables on Nodes

To understand what variables are currently applied to a specific node (e.g., is a rectangle filling using "Brand/Blue" or a raw hex code?).

*   **`node.boundVariables`**
    *   **Purpose**: A property on `SceneNode` that returns an object mapping properties to the variable alias applied to them.
    *   **Structure**: `{ [field: string]: VariableAlias }`
    *   **Example Fields**: `'fills'`, `'strokes'`, `'fontName'`, `'characters'`, `'width'`, `'height'`, `'paddingLeft'`, etc.

## 3. Applying (Binding) Variables to Nodes

To apply a variable to a node property (e.g., set a text color to a variable).

*   **`node.setBoundVariable(field, variableId)`**
    *   **Purpose**: The core method to "bind" a variable to a node property.
    *   **Arguments**:
        *   `field`: The property name (e.g., `'fills'`, `'strokes'`, `'fontName'`, `'characters'`).
        *   `variableId`: The ID of the variable to apply.
    *   **Unbinding**: Pass `null` as the `variableId` to unbind/detach a variable.

## 4. Handling Variable Modes (Theming)

For switching themes (e.g., Light vs Dark mode) on a Frame or Section.

*   **`node.explicitVariableModes`**
    *   **Purpose**: Reads the specific modes manually set on a container.
    *   **Returns**: `{ [collectionId: string]: string }` (mapping of collection ID to mode ID)

*   **`node.setExplicitVariableModeForCollection(collectionId, modeId)`**
    *   **Purpose**: Sets the active mode for a specific collection on a node.

## Recommended MCP Tools Implementation Strategy

To expose this functionality to an AI agent, we can map the 7 identified Figma Plugin APIs to just 3 comprehensive MCP tools.

| MCP Tool Name | Figma Plugin API Calls Covered | Capability Description |
| :--- | :--- | :--- |
| **`get_variables`** | 1. `figma.variables.getLocalVariableCollectionsAsync()`<br>2. `figma.variables.getLocalVariablesAsync()`<br>3. `figma.variables.getVariableByIdAsync(id)` | **Global Discovery**: Retrieving the "database" of all available variables, their collections, and resolving specific IDs. |
| **`get_node_variables`** | 4. `node.boundVariables`<br>5. `node.explicitVariableModes` | **Node Inspection**: Reading both specific variable assignments (fills, dimensions) and active theme modes on a selected node. |
| **`set_bound_variable`** | 6. `node.setBoundVariable(field, variableId)`<br>7. `node.setExplicitVariableModeForCollection(...)` | **Node Mutation**: Applying variable bindings to properties AND setting explicit modes for collections on a node. |
