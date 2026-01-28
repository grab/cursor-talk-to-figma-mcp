# Change Protection / Scope Restriction Implementation Plan

## Goal
Restrict the Figma Plugin to only allow modifications (writes) to a specific target node and its descendants. This prevents AI agents or users from accidentally modifying other parts of the Figma document.

## 1. Architecture Design

### User Workflow & State Management
1.  **Initial State**: Plugin UI opens. "Connect" button is **ENABLED**.
2.  **User Action**: User may paste a Figma Link into "Link to Selection" text field, or leave it empty.
3.  **Connection**:
    *   **Option A (Scoped Read/Write)**: User provides a valid link.
        *   Link is verified. If valid, connect with `scopeNodeId`.
        *   Plugin allows edits ONLY within that node tree.
    *   **Option B (Read-Only)**: User leaves field empty.
        *   Connect with `readOnly = true`.
        *   Plugin denies ALL modification commands.
    *   **Error Case**: If link is submitted but invalid, show error and do not connect.

### State Variables
- `state.scopeRootId` (string | null): If set, edits allowed only in this tree.
- `state.readOnly` (boolean): If true, NO edits allowed. (Derived if no scope is provided).
- **Input**: A text field in the Figma Plugin UI (`ui.html`) where the user pastes a link to the node.
- **Persistence**: Per user request, the value in the text field does NOT need to be saved (session-only).
- **Communication**: The UI will parse the link, extract the `nodeId`, and send a message to `src/figma_plugin/src/main.js` to update the `state.scopeRootId`.

### Validation Helper
(Unchanged) `isNodeInScope(targetNodeId)` will check against the locked `scopeRootId`.

### Command Dispatcher Interception
Modify the `handleCommand` switch statement in `src/figma_plugin/src/main.js`.
Before executing specific commands, run the validation.

## 2. Implementation Steps

### Step 1: Add Scope UI & Validation Loop
Modify `src/figma_plugin/ui.html`:
*   Add Input: `id="scope-link-input"` above the Connect button.
*   "Connect" Button State: Always **ENABLED**.
*   Button Click Logic:
    *   Get value of input.
    *   If empty -> Connect (Read-Only).
    *   If not empty -> `postMessage({ type: 'validate-scope-link', ... })`.
        *   If valid -> Connect with `scopeNodeId`.
        *   If invalid -> Show error, do not connect.

Modify `src/figma_plugin/src/main.js`:
*   Handle `validate-scope-link`:
    *   Parse Node ID from URL.
    *   `figma.getNodeById(id)`.
    *   Return `{ valid: true, nodeName: node.name }` or `{ valid: false, reason: '...' }`.

### Step 2: Implement "Connect & Lock"
*   Update `connectToServer` flow in UI:
    *   When clicking Connect, include `scopeNodeId` in the handshake or simple `postMessage({ type: 'set-scope', scopeNodeId: ... })` immediately before connecting.
*   Update `src/figma_plugin/src/main.js` state:
    *   Handle connect message.
    *   Set `state.scopeRootId` if provided.
    *   Set `state.readOnly = true` if no scope provided (or specific flag).

### Step 3: Enforce Logic in Handlers
We must categorize operations:

#### A. Node Modifications (Write)
Commands: `set_fill_color`, `set_stroke_color`, `resize_node`, `move_node`, `set_text_contents`, `set_corner_radius`, etc.
**Check**: 
*   If `state.readOnly` -> **DENY**.
*   Else `checkScopeAccess(targetNodeId)`.

#### B. Node Creation
Commands: `create_rectangle`, `create_frame`, `create_text`, `clone_node`.
**Check**: 
*   If `state.readOnly` -> **DENY**.
*   Else `checkScopeAccess(parentId)`.
*   If `parentId` is NOT provided (creating at root), and scope is active -> **DENY**.

#### C. Connector & Component Logic
*   `set_default_connector`: **ALLOW**. (Read operation / Client Storage only).
*   `create_connections`: **Check**. For each connection, BOTH `startNodeId` and `endNodeId` must be in scope.
*   `create_component_instance`: **DENY if Scope Active**. (Current implementation forces creation at Page Root, which is outside any Frame scope).

#### C. Deletion
Commands: `delete_node`, `delete_multiple_nodes`.
**Check**: 
*   If `state.readOnly` -> **DENY**.
*   Else `checkScopeAccess(nodeId)` for every node in the list.

#### D. Global/Read Operations
Commands: `get_document_info`, `get_selection`, `get_nodes_info`.
**Check**: **ALWAYS ALLOWED**. Read operations do not require scope or read-only checks.


## 3. Risk Assessment
*   **Performance**: Walking up the tree is fast (O(depth)), negligible impact.
*   **UX**: If an agent tries to edit outside scope, it will receive an Error. The error message must be clear: "Operation denied: Node is outside the active scope."

## 4. Testing Plan
1.  **Set Scope**: Select a Frame ("Frame A"). Set it as scope.
2.  **Valid Edit**: Modify a child of Frame A. -> Success.
3.  **Invalid Edit**: Modify a sibling of Frame A. -> Failure.
4.  **Creation**: Create rect inside Frame A. -> Success.
5.  **Invalid Creation**: Create rect at Page root. -> Failure.
6.  **Clear Scope**: Remove restriction. Modify sibling. -> Success.

## 5. Files to Change
The following files will be modified to implement this feature:
1.  **`src/figma_plugin/ui.html`**:
    *   Add "Link to Selection" input field.
    *   Add validation event logic.
2.  **`src/figma_plugin/src/main.js`**:
    *   Implement `validate-scope-link` handler.
    *   Manage scope state (`state.scopeRootId`).
    *   Implement `checkScopeAccess` validation logic.
    *   Enforce scope limits in `handleCommand`.

