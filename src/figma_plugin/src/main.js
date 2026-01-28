/**
 * Figma Plugin Main Entry Point
 * This file bundles all handlers and utilities for the Figma plugin
 */

// Import utilities
import { generateCommandId, sendProgressUpdate } from '../utils/progressUtils.js';

// Import handlers
import { getDocumentInfo, getSelection, getNodesInfo, readMyDesign } from '../handlers/nodeReaders.js';
import { createRectangle, createFrame, createText, cloneNode } from '../handlers/nodeCreators.js';
import { moveNode, resizeNode, deleteMultipleNodes, setSelections, setNodeName } from '../handlers/nodeModifiers.js';
import { setFillColor, setStrokeColor, setCornerRadius } from '../handlers/stylingHandlers.js';
import { setLayoutMode, setPadding, setAxisAlign, setLayoutSizing, setItemSpacing } from '../handlers/layoutHandlers.js';
import {
    getStyles,
    getLocalComponents,
    createComponentInstance,
    exportNodeAsImage,
    getInstanceOverrides,
    getValidTargetInstances,
    getSourceInstanceData,
    setInstanceOverrides
} from '../handlers/componentHandlers.js';
import { getReactions, setDefaultConnector, createConnections } from '../handlers/connectorHandlers.js';
import { scanTextNodes, setMultipleTextContents } from '../handlers/textHandlers.js';
import { getAnnotations, scanNodesByTypes, setMultipleAnnotations } from '../handlers/annotationHandlers.js';
import { getVariables, getNodeVariables, setBoundVariable } from '../handlers/variableHandlers.js';

// Plugin state
const state = {
    serverPort: 3055, // Default port
    scopeRootId: null,
    readOnly: false // Default to false, but connection flow will set this
};

// Helper: Check if a node is within the allowed scope
async function checkScopeAccess(nodeId) {
    if (state.readOnly) return false;

    // If scope is not set, we assume restricted access (deny) unless strict flow says otherwise.
    // However, based on the flow: "Empty -> Read-Only", "Link -> Scoped".
    // So if we are NOT read-only, we MUST have a scopeRootId.
    if (!state.scopeRootId) return false;

    let node = await figma.getNodeByIdAsync(nodeId);
    // Be robust against missing nodes
    if (!node) return false;

    // Traverse up
    while (node) {
        if (node.id === state.scopeRootId) return true;
        node = node.parent;
    }
    return false;
}

// Helper: Parse Node ID from URL
function parseNodeIdFromUrl(url) {
    try {
        const urlObj = new URL(url);
        const nodeId = urlObj.searchParams.get("node-id");
        return nodeId ? nodeId.replace(/-/g, ":") : null;
    } catch (e) {
        // Fallback for simple paste? Or maybe strictly require URL structure
        // Figma often copies as: "https://www.figma.com/design/..."
        // Regex fallback might be safer if URL object fails or protocol is weird
        const match = url.match(/node-id=([^&]+)/);
        if (match) return match[1].replace(/-/g, ":");
        return null;
    }
}

// Show UI
figma.showUI(__html__, { width: 350, height: 450 });

// Plugin commands from UI
figma.ui.onmessage = async (msg) => {
    switch (msg.type) {
        case "update-settings":
            updateSettings(msg);
            break;
        case "notify":
            figma.notify(msg.message);
            break;
        case "close-plugin":
            figma.closePlugin();
            break;
        case "validate-scope-link":
            const nodeId = parseNodeIdFromUrl(msg.link);
            if (!nodeId) {
                figma.ui.postMessage({ type: "scope-validation-result", valid: false, reason: "Invalid Figma URL" });
                return;
            }
            const node = await figma.getNodeByIdAsync(nodeId);
            if (node) {
                figma.ui.postMessage({
                    type: "scope-validation-result",
                    valid: true,
                    nodeName: node.name,
                    nodeId: node.id
                });
            } else {
                figma.ui.postMessage({ type: "scope-validation-result", valid: false, reason: "Node not found in current document" });
            }
            break;
        case "set-scope":
            if (msg.scopeNodeId) {
                state.scopeRootId = msg.scopeNodeId;
                state.readOnly = false;
                figma.notify(`Scope locked to node: ${msg.scopeNodeId}`);
            } else {
                state.scopeRootId = null;
                state.readOnly = true;
                figma.notify("Connected in Read-Only Mode");
            }
            break;
        case "execute-command":
            // Execute commands received from UI (which gets them from WebSocket)
            try {
                const result = await handleCommand(msg.command, msg.params);
                // Send result back to UI
                figma.ui.postMessage({
                    type: "command-result",
                    id: msg.id,
                    result,
                });
            } catch (error) {
                figma.ui.postMessage({
                    type: "command-error",
                    id: msg.id,
                    error: error.message || "Error executing command",
                });
            }
            break;
    }
};

// Listen for plugin commands from menu
figma.on("run", ({ command }) => {
    // Auto-connect removed to enforce Scope Selection workflow.
    // figma.ui.postMessage({ type: "auto-connect" });
});

// Update plugin settings
function updateSettings(settings) {
    if (settings.serverPort) {
        state.serverPort = settings.serverPort;
    }

    figma.clientStorage.setAsync("settings", {
        serverPort: state.serverPort,
    });
}

// Handle commands from UI
async function handleCommand(command, params) {
    switch (command) {
        case "get_document_info":
            return await getDocumentInfo();
        case "get_selection":
            return await getSelection();
        case "get_nodes_info":
            if (!params || !params.nodeIds || !Array.isArray(params.nodeIds)) {
                throw new Error("Missing or invalid nodeIds parameter");
            }
            return await getNodesInfo(params.nodeIds);
        case "read_my_design":
            return await readMyDesign();
        case "create_rectangle":
            if (state.readOnly) throw new Error("Operation denied: Figma Plugin is in Read-Only Mode");
            if (!(await checkScopeAccess(params ? params.parentId : null))) throw new Error("Operation denied: Parent outside scope");
            return await createRectangle(params);
        case "create_frame":
            if (state.readOnly) throw new Error("Operation denied: Figma Plugin is in Read-Only Mode");
            if (!(await checkScopeAccess(params ? params.parentId : null))) throw new Error("Operation denied: Parent outside scope");
            return await createFrame(params);
        case "create_text":
            if (state.readOnly) throw new Error("Operation denied: Figma Plugin is in Read-Only Mode");
            if (!(await checkScopeAccess(params ? params.parentId : null))) throw new Error("Operation denied: Parent outside scope");
            return await createText(params);
        case "set_fill_color":
            if (state.readOnly) throw new Error("Operation denied: Figma Plugin is in Read-Only Mode");
            if (!(await checkScopeAccess(params ? params.nodeId : null))) throw new Error("Operation denied: Node outside scope");
            return await setFillColor(params);
        case "set_stroke_color":
            if (state.readOnly) throw new Error("Operation denied: Figma Plugin is in Read-Only Mode");
            if (!(await checkScopeAccess(params ? params.nodeId : null))) throw new Error("Operation denied: Node outside scope");
            return await setStrokeColor(params);
        case "move_node":
            if (state.readOnly) throw new Error("Operation denied: Figma Plugin is in Read-Only Mode");
            if (!(await checkScopeAccess(params ? params.nodeId : null))) throw new Error("Operation denied: Node outside scope");
            return await moveNode(params);
        case "resize_node":
            if (state.readOnly) throw new Error("Operation denied: Figma Plugin is in Read-Only Mode");
            if (!(await checkScopeAccess(params ? params.nodeId : null))) throw new Error("Operation denied: Node outside scope");
            return await resizeNode(params);
        case "delete_multiple_nodes":
            if (state.readOnly) throw new Error("Operation denied: Figma Plugin is in Read-Only Mode");
            if (!params || !params.nodeIds || !Array.isArray(params.nodeIds)) throw new Error("Missing nodeIds");
            for (const id of params.nodeIds) {
                if (!(await checkScopeAccess(id))) throw new Error(`Operation denied: Node ${id} outside scope`);
            }
            return await deleteMultipleNodes(params);
        case "get_styles":
            return await getStyles();
        case "get_local_components":
            return await getLocalComponents();
        case "create_component_instance":
            if (state.readOnly) throw new Error("Operation denied: Figma Plugin is in Read-Only Mode");
            // Create component instance always appends to currentPage (Root), so it violates scope if scope is anything other than Page.
            // If scope is active, we must DENY this operation until the handler supports parentId.
            if (state.scopeRootId || state.readOnly) throw new Error("Operation denied: Cannot create instance at root while scope is active");
            return await createComponentInstance(params);
        case "export_node_as_image":
            return await exportNodeAsImage(params);
        case "set_corner_radius":
            if (state.readOnly) throw new Error("Operation denied: Figma Plugin is in Read-Only Mode");
            if (!(await checkScopeAccess(params ? params.nodeId : null))) throw new Error("Operation denied: Node outside scope");
            return await setCornerRadius(params);
        case "clone_node":
            if (state.readOnly) throw new Error("Operation denied: Figma Plugin is in Read-Only Mode");
            if (!(await checkScopeAccess(params ? params.nodeId : null))) throw new Error("Operation denied: Source node outside scope");
            return await cloneNode(params);
        case "scan_text_nodes":
            return await scanTextNodes(params);
        case "set_multiple_text_contents":
            if (state.readOnly) throw new Error("Operation denied: Figma Plugin is in Read-Only Mode");
            if (!(await checkScopeAccess(params ? params.nodeId : null))) throw new Error("Operation denied: Node outside scope");
            return await setMultipleTextContents(params);
        case "get_annotations":
            return await getAnnotations(params);
        case "scan_nodes_by_types":
            return await scanNodesByTypes(params);
        case "set_multiple_annotations":
            if (state.readOnly) throw new Error("Operation denied: Figma Plugin is in Read-Only Mode");
            if (!(await checkScopeAccess(params ? params.nodeId : null))) throw new Error("Operation denied: Node outside scope");
            return await setMultipleAnnotations(params);
        case "get_instance_overrides":
            // Check if instanceNode parameter is provided
            if (params && params.instanceNodeId) {
                // Get the instance node by ID
                const instanceNode = await figma.getNodeByIdAsync(params.instanceNodeId);
                if (!instanceNode) {
                    throw new Error(`Instance node not found with ID: ${params.instanceNodeId}`);
                }
                return await getInstanceOverrides(instanceNode);
            }
            // Call without instance node if not provided
            return await getInstanceOverrides();

        case "set_instance_overrides":
            if (state.readOnly) throw new Error("Operation denied: Figma Plugin is in Read-Only Mode");

            // Check if instanceNodeIds parameter is provided
            if (params && params.targetNodeIds) {
                // Validate that targetNodeIds is an array
                if (!Array.isArray(params.targetNodeIds)) {
                    throw new Error("targetNodeIds must be an array");
                }

                // Permission check
                for (const id of params.targetNodeIds) {
                    if (!(await checkScopeAccess(id))) throw new Error(`Operation denied: Target instance ${id} outside scope`);
                }

                // Get the instance nodes by IDs
                const targetNodes = await getValidTargetInstances(params.targetNodeIds);
                if (!targetNodes.success) {
                    figma.notify(targetNodes.message);
                    return { success: false, message: targetNodes.message };
                }

                if (params.sourceInstanceId) {
                    // get source instance data
                    let sourceInstanceData = null;
                    sourceInstanceData = await getSourceInstanceData(params.sourceInstanceId);

                    if (!sourceInstanceData.success) {
                        figma.notify(sourceInstanceData.message);
                        return { success: false, message: sourceInstanceData.message };
                    }
                    return await setInstanceOverrides(targetNodes.targetInstances, sourceInstanceData);
                } else {
                    throw new Error("Missing sourceInstanceId parameter");
                }
            }
            throw new Error("Missing targetNodeIds parameter");

        case "set_layout_mode":
            if (state.readOnly) throw new Error("Operation denied: Figma Plugin is in Read-Only Mode");
            if (!(await checkScopeAccess(params ? params.nodeId : null))) throw new Error("Operation denied: Node outside scope");
            return await setLayoutMode(params);
        case "set_padding":
            if (state.readOnly) throw new Error("Operation denied: Figma Plugin is in Read-Only Mode");
            if (!(await checkScopeAccess(params ? params.nodeId : null))) throw new Error("Operation denied: Node outside scope");
            return await setPadding(params);
        case "set_axis_align":
            if (state.readOnly) throw new Error("Operation denied: Figma Plugin is in Read-Only Mode");
            if (!(await checkScopeAccess(params ? params.nodeId : null))) throw new Error("Operation denied: Node outside scope");
            return await setAxisAlign(params);
        case "set_layout_sizing":
            if (state.readOnly) throw new Error("Operation denied: Figma Plugin is in Read-Only Mode");
            if (!(await checkScopeAccess(params ? params.nodeId : null))) throw new Error("Operation denied: Node outside scope");
            return await setLayoutSizing(params);
        case "set_item_spacing":
            if (state.readOnly) throw new Error("Operation denied: Figma Plugin is in Read-Only Mode");
            if (!(await checkScopeAccess(params ? params.nodeId : null))) throw new Error("Operation denied: Node outside scope");
            return await setItemSpacing(params);
        case "get_reactions":
            if (!params || !params.nodeIds || !Array.isArray(params.nodeIds)) {
                throw new Error("Missing or invalid nodeIds parameter");
            }
            return await getReactions(params.nodeIds);
        case "set_default_connector":
            // Read-only / Local storage operation. Allowed.
            return await setDefaultConnector(params);
        case "create_connections":
            if (state.readOnly) throw new Error("Operation denied: Figma Plugin is in Read-Only Mode");
            if (params && params.connections && Array.isArray(params.connections)) {
                for (const conn of params.connections) {
                    if (!(await checkScopeAccess(conn.startNodeId))) throw new Error(`Operation denied: Start node ${conn.startNodeId} outside scope`);
                    if (!(await checkScopeAccess(conn.endNodeId))) throw new Error(`Operation denied: End node ${conn.endNodeId} outside scope`);
                }
            }
            return await createConnections(params);
        case "set_selections":
            return await setSelections(params);
        case "set_node_name":
            if (state.readOnly) throw new Error("Operation denied: Figma Plugin is in Read-Only Mode");
            if (!(await checkScopeAccess(params ? params.nodeId : null))) throw new Error("Operation denied: Node outside scope");
            return await setNodeName(params);
        case "get_variables":
            return await getVariables(params);
        case "get_node_variables":
            return await getNodeVariables(params);
        case "set_bound_variable":
            if (state.readOnly) throw new Error("Operation denied: Figma Plugin is in Read-Only Mode");
            if (!(await checkScopeAccess(params ? params.nodeId : null))) throw new Error("Operation denied: Node outside scope");
            return await setBoundVariable(params);
        default:
            throw new Error(`Unknown command: ${command}`);
    }
}
