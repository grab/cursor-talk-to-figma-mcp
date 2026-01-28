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
};

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
    figma.ui.postMessage({ type: "auto-connect" });
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
            return await createRectangle(params);
        case "create_frame":
            return await createFrame(params);
        case "create_text":
            return await createText(params);
        case "set_fill_color":
            return await setFillColor(params);
        case "set_stroke_color":
            return await setStrokeColor(params);
        case "move_node":
            return await moveNode(params);
        case "resize_node":
            return await resizeNode(params);
        case "delete_multiple_nodes":
            return await deleteMultipleNodes(params);
        case "get_styles":
            return await getStyles();
        case "get_local_components":
            return await getLocalComponents();
        case "create_component_instance":
            return await createComponentInstance(params);
        case "export_node_as_image":
            return await exportNodeAsImage(params);
        case "set_corner_radius":
            return await setCornerRadius(params);
        case "clone_node":
            return await cloneNode(params);
        case "scan_text_nodes":
            return await scanTextNodes(params);
        case "set_multiple_text_contents":
            return await setMultipleTextContents(params);
        case "get_annotations":
            return await getAnnotations(params);
        case "scan_nodes_by_types":
            return await scanNodesByTypes(params);
        case "set_multiple_annotations":
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
            // Check if instanceNodeIds parameter is provided
            if (params && params.targetNodeIds) {
                // Validate that targetNodeIds is an array
                if (!Array.isArray(params.targetNodeIds)) {
                    throw new Error("targetNodeIds must be an array");
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
            return await setLayoutMode(params);
        case "set_padding":
            return await setPadding(params);
        case "set_axis_align":
            return await setAxisAlign(params);
        case "set_layout_sizing":
            return await setLayoutSizing(params);
        case "set_item_spacing":
            return await setItemSpacing(params);
        case "get_reactions":
            if (!params || !params.nodeIds || !Array.isArray(params.nodeIds)) {
                throw new Error("Missing or invalid nodeIds parameter");
            }
            return await getReactions(params.nodeIds);
        case "set_default_connector":
            return await setDefaultConnector(params);
        case "create_connections":
            return await createConnections(params);
        case "set_selections":
            return await setSelections(params);
        case "set_node_name":
            return await setNodeName(params);
        case "get_variables":
            return await getVariables(params);
        case "get_node_variables":
            return await getNodeVariables(params);
        case "set_bound_variable":
            return await setBoundVariable(params);
        default:
            throw new Error(`Unknown command: ${command}`);
    }
}
