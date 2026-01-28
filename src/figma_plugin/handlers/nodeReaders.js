/**
 * Node reader handlers for Figma plugin
 * Handles reading and querying node information
 */

import { filterFigmaNode } from '../utils/nodeUtils.js';

/**
 * Gets information about the current document
 * @returns {Promise<Object>} Document information including pages and children
 */
export async function getDocumentInfo() {
    await figma.currentPage.loadAsync();
    const page = figma.currentPage;
    return {
        name: page.name,
        id: page.id,
        type: page.type,
        children: page.children.map((node) => ({
            id: node.id,
            name: node.name,
            type: node.type,
        })),
        currentPage: {
            id: page.id,
            name: page.name,
            childCount: page.children.length,
        },
        pages: [
            {
                id: page.id,
                name: page.name,
                childCount: page.children.length,
            },
        ],
    };
}

/**
 * Gets the current selection
 * @returns {Promise<Object>} Selection information
 */
export async function getSelection() {
    return {
        selectionCount: figma.currentPage.selection.length,
        selection: figma.currentPage.selection.map((node) => ({
            id: node.id,
            name: node.name,
            type: node.type,
            visible: node.visible,
        })),
    };
}

/**
 * Gets detailed information about multiple nodes
 * @param {string[]} nodeIds - Array of node IDs to query
 * @returns {Promise<Object[]>} Array of node information objects
 */
export async function getNodesInfo(nodeIds) {
    try {
        // Load all nodes in parallel
        const nodes = await Promise.all(
            nodeIds.map((id) => figma.getNodeByIdAsync(id))
        );

        // Filter out any null values (nodes that weren't found)
        const validNodes = nodes.filter((node) => node !== null);

        // Export all valid nodes in parallel
        const responses = await Promise.all(
            validNodes.map(async (node) => {
                const response = await node.exportAsync({
                    format: "JSON_REST_V1",
                });
                return {
                    nodeId: node.id,
                    document: filterFigmaNode(response.document),
                };
            })
        );

        return responses;
    } catch (error) {
        throw new Error(`Error getting nodes info: ${error.message}`);
    }
}

/**
 * Reads the design of currently selected nodes
 * @returns {Promise<Object[]>} Array of selected node information
 */
export async function readMyDesign() {
    try {
        // Load all selected nodes in parallel
        const nodes = await Promise.all(
            figma.currentPage.selection.map((node) => figma.getNodeByIdAsync(node.id))
        );

        // Filter out any null values (nodes that weren't found)
        const validNodes = nodes.filter((node) => node !== null);

        // Export all valid nodes in parallel
        const responses = await Promise.all(
            validNodes.map(async (node) => {
                const response = await node.exportAsync({
                    format: "JSON_REST_V1",
                });
                return {
                    nodeId: node.id,
                    document: filterFigmaNode(response.document),
                };
            })
        );

        return responses;
    } catch (error) {
        throw new Error(`Error getting nodes info: ${error.message}`);
    }
}
