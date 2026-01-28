/**
 * Annotation handlers for Figma plugin
 * Handles annotation operations
 */

import { generateCommandId, sendProgressUpdate } from '../utils/progressUtils.js';

/**
 * Gets annotations from nodes
 * @param {Object} params - Parameters object
 * @param {string} params.nodeId - Optional node ID to get annotations from
 * @param {boolean} params.includeCategories - Whether to include category info
 * @returns {Promise<Object>} Annotations result
 */
export async function getAnnotations(params) {
    try {
        const { nodeId, includeCategories = true } = params;

        // Get categories first if needed
        let categoriesMap = {};
        if (includeCategories) {
            const categories = await figma.annotations.getAnnotationCategoriesAsync();
            categoriesMap = categories.reduce((map, category) => {
                map[category.id] = {
                    id: category.id,
                    label: category.label,
                    color: category.color,
                    isPreset: category.isPreset,
                };
                return map;
            }, {});
        }

        if (nodeId) {
            // Get annotations for a specific node
            const node = await figma.getNodeByIdAsync(nodeId);
            if (!node) {
                throw new Error(`Node not found: ${nodeId}`);
            }

            if (!("annotations" in node)) {
                throw new Error(`Node type ${node.type} does not support annotations`);
            }

            // Collect annotations from this node and all its descendants
            const mergedAnnotations = [];
            const collect = async (n) => {
                if ("annotations" in n && n.annotations && n.annotations.length > 0) {
                    for (const a of n.annotations) {
                        mergedAnnotations.push({ nodeId: n.id, annotation: a });
                    }
                }
                if ("children" in n) {
                    for (const child of n.children) {
                        await collect(child);
                    }
                }
            };
            await collect(node);

            const result = {
                nodeId: node.id,
                name: node.name,
                annotations: mergedAnnotations,
            };

            if (includeCategories) {
                result.categories = Object.values(categoriesMap);
            }

            return result;
        } else {
            // Get all annotations in the current page
            const annotations = [];
            const processNode = async (node) => {
                if (
                    "annotations" in node &&
                    node.annotations &&
                    node.annotations.length > 0
                ) {
                    annotations.push({
                        nodeId: node.id,
                        name: node.name,
                        annotations: node.annotations,
                    });
                }
                if ("children" in node) {
                    for (const child of node.children) {
                        await processNode(child);
                    }
                }
            };

            // Start from current page
            await processNode(figma.currentPage);

            const result = {
                annotatedNodes: annotations,
            };

            if (includeCategories) {
                result.categories = Object.values(categoriesMap);
            }

            return result;
        }
    } catch (error) {
        console.error("Error in getAnnotations:", error);
        throw error;
    }
}

/**
 * Scans for nodes with specific types within a node
 * @param {Object} params - Parameters object
 * @param {string} params.nodeId - ID of the node to scan within
 * @param {string[]} params.types - Array of node types to find
 * @returns {Promise<Object>} Object containing found nodes
 */
export async function scanNodesByTypes(params) {
    console.log(`Starting to scan nodes by types from node ID: ${params.nodeId}`);
    const { nodeId, types = [] } = params || {};

    if (!types || types.length === 0) {
        throw new Error("No types specified to search for");
    }

    const node = await figma.getNodeByIdAsync(nodeId);

    if (!node) {
        throw new Error(`Node with ID ${nodeId} not found`);
    }

    // Simple implementation without chunking
    const matchingNodes = [];

    // Send a single progress update to notify start
    const commandId = generateCommandId();
    sendProgressUpdate(
        commandId,
        "scan_nodes_by_types",
        "started",
        0,
        1,
        0,
        `Starting scan of node "${node.name || nodeId}" for types: ${types.join(
            ", "
        )}`,
        null
    );

    // Recursively find nodes with specified types
    await findNodesByTypes(node, types, matchingNodes);

    // Send completion update
    sendProgressUpdate(
        commandId,
        "scan_nodes_by_types",
        "completed",
        100,
        matchingNodes.length,
        matchingNodes.length,
        `Scan complete. Found ${matchingNodes.length} matching nodes.`,
        { matchingNodes }
    );

    return {
        success: true,
        message: `Found ${matchingNodes.length} matching nodes.`,
        count: matchingNodes.length,
        matchingNodes: matchingNodes,
        searchedTypes: types,
    };
}

/**
 * Helper function to recursively find nodes with specific types
 * @param {SceneNode} node - The root node to start searching from
 * @param {string[]} types - Array of node types to find
 * @param {Array} matchingNodes - Array to store found nodes
 */
async function findNodesByTypes(node, types, matchingNodes = []) {
    // Skip invisible nodes
    if (node.visible === false) return;

    // Check if this node is one of the specified types
    if (types.includes(node.type)) {
        // Create a minimal representation with just ID, type and bbox
        matchingNodes.push({
            id: node.id,
            name: node.name || `Unnamed ${node.type}`,
            type: node.type,
            // Basic bounding box info
            bbox: {
                x: typeof node.x === "number" ? node.x : 0,
                y: typeof node.y === "number" ? node.y : 0,
                width: typeof node.width === "number" ? node.width : 0,
                height: typeof node.height === "number" ? node.height : 0,
            },
        });
    }

    // Recursively process children of container nodes
    if ("children" in node) {
        for (const child of node.children) {
            await findNodesByTypes(child, types, matchingNodes);
        }
    }
}

/**
 * Sets a single annotation on a node
 * @param {Object} params - Parameters object
 * @param {string} params.nodeId - ID of the node to annotate
 * @param {string} params.labelMarkdown - Annotation text in markdown
 * @param {string} params.categoryId - Optional category ID
 * @param {Array} params.properties - Optional additional properties
 * @returns {Promise<Object>} Result of the annotation operation
 */
async function setAnnotation(params) {
    const { nodeId, labelMarkdown, categoryId, properties } = params || {};

    if (!nodeId) {
        return { success: false, error: "Missing nodeId parameter" };
    }

    if (!labelMarkdown) {
        return { success: false, error: "Missing labelMarkdown parameter" };
    }

    try {
        const node = await figma.getNodeByIdAsync(nodeId);
        if (!node) {
            return { success: false, error: `Node not found: ${nodeId}` };
        }

        if (!("annotations" in node)) {
            return { success: false, error: `Node type ${node.type} does not support annotations` };
        }

        // Create the annotation object
        const annotationObj = {
            label: {
                type: "MARKDOWN",
                content: labelMarkdown,
            },
        };

        // Add category if provided
        if (categoryId) {
            annotationObj.categoryId = categoryId;
        }

        // Add properties if provided
        if (properties && Array.isArray(properties)) {
            annotationObj.properties = properties;
        }

        // Add the annotation to the node
        const existingAnnotations = node.annotations || [];
        node.annotations = [...existingAnnotations, annotationObj];

        return {
            success: true,
            nodeId: nodeId,
            annotationCount: node.annotations.length,
        };
    } catch (error) {
        console.error("Error in setAnnotation:", error);
        return { success: false, error: error.message };
    }
}

/**
 * Sets multiple annotations on nodes
 * @param {Object} params - Parameters object
 * @param {string} params.nodeId - Parent node ID (for context)
 * @param {Array} params.annotations - Array of annotation objects
 * @returns {Promise<Object>} Results of the operations
 */
export async function setMultipleAnnotations(params) {
    console.log("=== setMultipleAnnotations Debug Start ===");
    console.log("Input params:", JSON.stringify(params, null, 2));

    const { nodeId, annotations } = params;

    if (!annotations || annotations.length === 0) {
        console.error("Validation failed: No annotations provided");
        return { success: false, error: "No annotations provided" };
    }

    console.log(
        `Processing ${annotations.length} annotations for node ${nodeId}`
    );

    const results = [];
    let successCount = 0;
    let failureCount = 0;

    // Process annotations sequentially
    for (let i = 0; i < annotations.length; i++) {
        const annotation = annotations[i];
        console.log(
            `\nProcessing annotation ${i + 1}/${annotations.length}:`,
            JSON.stringify(annotation, null, 2)
        );

        try {
            console.log("Calling setAnnotation with params:", {
                nodeId: annotation.nodeId,
                labelMarkdown: annotation.labelMarkdown,
                categoryId: annotation.categoryId,
                properties: annotation.properties,
            });

            const result = await setAnnotation({
                nodeId: annotation.nodeId,
                labelMarkdown: annotation.labelMarkdown,
                categoryId: annotation.categoryId,
                properties: annotation.properties,
            });

            console.log("setAnnotation result:", JSON.stringify(result, null, 2));

            if (result.success) {
                successCount++;
                results.push({ success: true, nodeId: annotation.nodeId });
                console.log(`✓ Annotation ${i + 1} applied successfully`);
            } else {
                failureCount++;
                results.push({
                    success: false,
                    nodeId: annotation.nodeId,
                    error: result.error,
                });
                console.error(`✗ Annotation ${i + 1} failed:`, result.error);
            }
        } catch (error) {
            failureCount++;
            const errorResult = {
                success: false,
                nodeId: annotation.nodeId,
                error: error.message,
            };
            results.push(errorResult);
            console.error(`✗ Annotation ${i + 1} failed with error:`, error);
            console.error("Error details:", {
                message: error.message,
                stack: error.stack,
            });
        }
    }

    const summary = {
        success: successCount > 0,
        annotationsApplied: successCount,
        annotationsFailed: failureCount,
        totalAnnotations: annotations.length,
        results: results,
    };

    console.log("\n=== setMultipleAnnotations Summary ===");
    console.log(JSON.stringify(summary, null, 2));
    console.log("=== setMultipleAnnotations Debug End ===");

    return summary;
}
