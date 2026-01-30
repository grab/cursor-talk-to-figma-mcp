/**
 * Component handlers for Figma plugin
 * Handles component-related operations including styles, instances, and overrides
 */

import { customBase64Encode } from '../utils/exportUtils.js';

/**
 * Gets all local styles from the document
 * @returns {Promise<Object>} Object containing colors, texts, effects, and grids styles
 */
export async function getStyles() {
    const styles = {
        colors: await figma.getLocalPaintStylesAsync(),
        texts: await figma.getLocalTextStylesAsync(),
        effects: await figma.getLocalEffectStylesAsync(),
        grids: await figma.getLocalGridStylesAsync(),
    };

    return {
        colors: styles.colors.map((style) => ({
            id: style.id,
            name: style.name,
            key: style.key,
            paint: style.paints[0],
        })),
        texts: styles.texts.map((style) => ({
            id: style.id,
            name: style.name,
            key: style.key,
            fontSize: style.fontSize,
            fontName: style.fontName,
        })),
        effects: styles.effects.map((style) => ({
            id: style.id,
            name: style.name,
            key: style.key,
        })),
        grids: styles.grids.map((style) => ({
            id: style.id,
            name: style.name,
            key: style.key,
        })),
    };
}

/**
 * Gets all local components from the document
 * @returns {Promise<Object>} Object containing component count and list
 */
export async function getLocalComponents() {
    await figma.loadAllPagesAsync();

    const components = figma.root.findAllWithCriteria({
        types: ["COMPONENT"],
    });

    return {
        count: components.length,
        components: components.map((component) => ({
            id: component.id,
            name: component.name,
            key: "key" in component ? component.key : null,
        })),
    };
}

/**
 * Creates an instance of a component
 * @param {Object} params - Parameters object
 * @param {string} params.componentKey - Key of the component to instantiate
 * @param {number} params.x - X position
 * @param {number} params.y - Y position
 * @returns {Promise<Object>} Created instance info
 */
export async function createComponentInstance(params) {
    const { componentKey, x = 0, y = 0, parentId } = params || {};

    if (!componentKey) {
        throw new Error("Missing componentKey parameter");
    }

    try {
        const component = await figma.importComponentByKeyAsync(componentKey);
        const instance = component.createInstance();

        instance.x = x;
        instance.y = y;

        if (parentId) {
            const parent = await figma.getNodeByIdAsync(parentId);
            if (!parent) {
                throw new Error(`Parent node not found with ID: ${parentId}`);
            }
            if (parent.type !== "FRAME" && parent.type !== "GROUP" && parent.type !== "SECTION" && parent.type !== "PAGE") {
                // Allow appending to Page, Frame, Group, Section
                // Although Page is via currentPage usually.
                // If parentId is a Page, appendChild works.
            }
            parent.appendChild(instance);
        } else {
            figma.currentPage.appendChild(instance);
        }

        return {
            id: instance.id,
            name: instance.name,
            x: instance.x,
            y: instance.y,
            width: instance.width,
            height: instance.height,
            componentId: instance.componentId,
        };
    } catch (error) {
        throw new Error(`Error creating component instance: ${error.message}`);
    }
}

/**
 * Exports a node as an image
 * @param {Object} params - Parameters object
 * @param {string} params.nodeId - ID of the node to export
 * @param {number} params.scale - Export scale (default: 1)
 * @returns {Promise<Object>} Exported image data
 */
export async function exportNodeAsImage(params) {
    const { nodeId, scale = 1 } = params || {};

    const format = "PNG";

    if (!nodeId) {
        throw new Error("Missing nodeId parameter");
    }

    const node = await figma.getNodeByIdAsync(nodeId);
    if (!node) {
        throw new Error(`Node not found with ID: ${nodeId}`);
    }

    if (!("exportAsync" in node)) {
        throw new Error(`Node does not support exporting: ${nodeId}`);
    }

    try {
        const settings = {
            format: format,
            constraint: { type: "SCALE", value: scale },
        };

        const bytes = await node.exportAsync(settings);

        let mimeType;
        switch (format) {
            case "PNG":
                mimeType = "image/png";
                break;
            case "JPG":
                mimeType = "image/jpeg";
                break;
            case "SVG":
                mimeType = "image/svg+xml";
                break;
            case "PDF":
                mimeType = "application/pdf";
                break;
            default:
                mimeType = "application/octet-stream";
        }

        // Proper way to convert Uint8Array to base64
        const base64 = customBase64Encode(bytes);

        return {
            nodeId,
            format,
            scale,
            mimeType,
            imageData: base64,
        };
    } catch (error) {
        throw new Error(`Error exporting node as image: ${error.message}`);
    }
}

/**
 * Gets override properties from a component instance
 * @param {InstanceNode|null} instanceNode - Optional instance node
 * @returns {Promise<Object>} Override information
 */
export async function getInstanceOverrides(instanceNode = null) {
    console.log("=== getInstanceOverrides called ===");

    let sourceInstance = null;

    // Check if an instance node was passed directly
    if (instanceNode) {
        console.log("Using provided instance node");

        // Validate that the provided node is an instance
        if (instanceNode.type !== "INSTANCE") {
            console.error("Provided node is not an instance");
            figma.notify("Provided node is not a component instance");
            return { success: false, message: "Provided node is not a component instance" };
        }

        sourceInstance = instanceNode;
    } else {
        // No node provided, use selection
        console.log("No node provided, using current selection");

        // Get the current selection
        const selection = figma.currentPage.selection;

        // Check if there's anything selected
        if (selection.length === 0) {
            console.log("No nodes selected");
            figma.notify("Please select at least one instance");
            return { success: false, message: "No nodes selected" };
        }

        // Filter for instances in the selection
        const instances = selection.filter(node => node.type === "INSTANCE");

        if (instances.length === 0) {
            console.log("No instances found in selection");
            figma.notify("Please select at least one component instance");
            return { success: false, message: "No instances found in selection" };
        }

        // Take the first instance from the selection
        sourceInstance = instances[0];
    }

    try {
        console.log(`Getting instance information:`);
        console.log(sourceInstance);

        // Get component overrides and main component
        const overrides = sourceInstance.overrides || [];
        console.log(`  Raw Overrides:`, overrides);

        // Get main component
        const mainComponent = await sourceInstance.getMainComponentAsync();
        if (!mainComponent) {
            console.error("Failed to get main component");
            figma.notify("Failed to get main component");
            return { success: false, message: "Failed to get main component" };
        }

        // return data to MCP server
        const returnData = {
            success: true,
            message: `Got component information from "${sourceInstance.name}" for overrides.length: ${overrides.length}`,
            sourceInstanceId: sourceInstance.id,
            mainComponentId: mainComponent.id,
            overridesCount: overrides.length
        };

        console.log("Data to return to MCP server:", returnData);
        figma.notify(`Got component information from "${sourceInstance.name}"`);

        return returnData;
    } catch (error) {
        console.error("Error in getInstanceOverrides:", error);
        figma.notify(`Error: ${error.message}`);
        return {
            success: false,
            message: `Error: ${error.message}`
        };
    }
}

/**
 * Validates and gets target instances
 * @param {string[]} targetNodeIds - Array of instance node IDs
 * @returns {Promise<Object>} Validation result with target instances
 */
export async function getValidTargetInstances(targetNodeIds) {
    let targetInstances = [];

    // Handle array of instances or single instance
    if (Array.isArray(targetNodeIds)) {
        if (targetNodeIds.length === 0) {
            return { success: false, message: "No instances provided" };
        }
        for (const targetNodeId of targetNodeIds) {
            const targetNode = await figma.getNodeByIdAsync(targetNodeId);
            if (targetNode && targetNode.type === "INSTANCE") {
                targetInstances.push(targetNode);
            }
        }
        if (targetInstances.length === 0) {
            return { success: false, message: "No valid instances provided" };
        }
    } else {
        return { success: false, message: "Invalid target node IDs provided" };
    }

    return { success: true, message: "Valid target instances provided", targetInstances };
}

/**
 * Gets source instance data for override application
 * @param {string} sourceInstanceId - Source instance ID
 * @returns {Promise<Object>} Source instance data
 */
export async function getSourceInstanceData(sourceInstanceId) {
    if (!sourceInstanceId) {
        return { success: false, message: "Missing source instance ID" };
    }

    // Get source instance by ID
    const sourceInstance = await figma.getNodeByIdAsync(sourceInstanceId);
    if (!sourceInstance) {
        return {
            success: false,
            message: "Source instance not found. The original instance may have been deleted."
        };
    }

    // Verify it's an instance
    if (sourceInstance.type !== "INSTANCE") {
        return {
            success: false,
            message: "Source node is not a component instance."
        };
    }

    // Get main component
    const mainComponent = await sourceInstance.getMainComponentAsync();
    if (!mainComponent) {
        return {
            success: false,
            message: "Failed to get main component from source instance."
        };
    }

    return {
        success: true,
        sourceInstance,
        mainComponent,
        overrides: sourceInstance.overrides || []
    };
}

/**
 * Sets overrides to target component instances
 * @param {InstanceNode[]} targetInstances - Array of target instances
 * @param {Object} sourceResult - Source instance data
 * @returns {Promise<Object>} Result of the set operation
 */
export async function setInstanceOverrides(targetInstances, sourceResult) {
    try {
        const { sourceInstance, mainComponent, overrides } = sourceResult;

        console.log(`Processing ${targetInstances.length} instances with ${overrides.length} overrides`);
        console.log(`Source instance: ${sourceInstance.id}, Main component: ${mainComponent.id}`);
        console.log(`Overrides:`, overrides);

        // Process all instances
        const results = [];
        let totalAppliedCount = 0;

        for (const targetInstance of targetInstances) {
            try {
                // Swap component
                try {
                    targetInstance.swapComponent(mainComponent);
                    console.log(`Swapped component for instance "${targetInstance.name}"`);
                } catch (error) {
                    console.error(`Error swapping component for instance "${targetInstance.name}":`, error);
                    results.push({
                        success: false,
                        instanceId: targetInstance.id,
                        instanceName: targetInstance.name,
                        message: `Error: ${error.message}`
                    });
                }

                // Prepare overrides by replacing node IDs
                let appliedCount = 0;

                // Apply each override
                for (const override of overrides) {
                    // Skip if no ID or overriddenFields
                    if (!override.id || !override.overriddenFields || override.overriddenFields.length === 0) {
                        continue;
                    }

                    // Replace source instance ID with target instance ID in the node path
                    const overrideNodeId = override.id.replace(sourceInstance.id, targetInstance.id);
                    const overrideNode = await figma.getNodeByIdAsync(overrideNodeId);

                    if (!overrideNode) {
                        console.log(`Override node not found: ${overrideNodeId}`);
                        continue;
                    }

                    // Get source node to copy properties from
                    const sourceNode = await figma.getNodeByIdAsync(override.id);
                    if (!sourceNode) {
                        console.log(`Source node not found: ${override.id}`);
                        continue;
                    }

                    // Apply each overridden field
                    let fieldApplied = false;
                    for (const field of override.overriddenFields) {
                        try {
                            if (field === "componentProperties") {
                                // Apply component properties
                                if (sourceNode.componentProperties && overrideNode.componentProperties) {
                                    const properties = {};
                                    for (const key in sourceNode.componentProperties) {
                                        properties[key] = sourceNode.componentProperties[key].value;
                                    }
                                    overrideNode.setProperties(properties);
                                    fieldApplied = true;
                                }
                            } else if (field === "characters" && overrideNode.type === "TEXT") {
                                // For text nodes, need to load fonts first
                                await figma.loadFontAsync(overrideNode.fontName);
                                overrideNode.characters = sourceNode.characters;
                                fieldApplied = true;
                            } else if (field in overrideNode) {
                                // Direct property assignment
                                overrideNode[field] = sourceNode[field];
                                fieldApplied = true;
                            }
                        } catch (fieldError) {
                            console.error(`Error applying field ${field}:`, fieldError);
                        }
                    }

                    if (fieldApplied) {
                        appliedCount++;
                    }
                }

                if (appliedCount > 0) {
                    totalAppliedCount += appliedCount;
                    results.push({
                        success: true,
                        instanceId: targetInstance.id,
                        instanceName: targetInstance.name,
                        appliedCount
                    });
                    console.log(`Applied ${appliedCount} overrides to "${targetInstance.name}"`);
                } else {
                    results.push({
                        success: false,
                        instanceId: targetInstance.id,
                        instanceName: targetInstance.name,
                        message: "No overrides were applied"
                    });
                }
            } catch (instanceError) {
                console.error(`Error processing instance "${targetInstance.name}":`, instanceError);
                results.push({
                    success: false,
                    instanceId: targetInstance.id,
                    instanceName: targetInstance.name,
                    message: `Error: ${instanceError.message}`
                });
            }
        }

        // Return results
        if (totalAppliedCount > 0) {
            const instanceCount = results.filter(r => r.success).length;
            const message = `Applied ${totalAppliedCount} overrides to ${instanceCount} instances`;
            figma.notify(message);
            return {
                success: true,
                message,
                totalCount: totalAppliedCount,
                results
            };
        } else {
            const message = "No overrides applied to any instance";
            figma.notify(message);
            return { success: false, message, results };
        }

    } catch (error) {
        console.error("Error in setInstanceOverrides:", error);
        const message = `Error: ${error.message}`;
        figma.notify(message);
        return { success: false, message };
    }
}

/**
 * Creates a component from an existing frame
 * @param {Object} params - Parameters object
 * @param {string} params.nodeId - ID of the frame to convert
 * @returns {Promise<Object>} Created component info
 */
export async function createComponent(params) {
    const { nodeId } = params || {};

    if (!nodeId) {
        throw new Error("Missing nodeId parameter");
    }

    const node = await figma.getNodeByIdAsync(nodeId);
    if (!node) {
        throw new Error(`Node not found with ID: ${nodeId}`);
    }

    if (node.type !== "FRAME") {
        throw new Error(`Target node must be a FRAME, got ${node.type}`);
    }

    try {
        const component = figma.createComponent(); // This creates a new empty component

        // Copy basic properties
        component.name = node.name;
        // Resize first
        component.resize(node.width, node.height);

        // Position and Hierarchy
        // We need to keep the component in the same hierarchy
        // Insert component into parent at the index of the node
        if (node.parent) {
            const index = node.parent.children.indexOf(node);
            node.parent.insertChild(index, component);
            component.x = node.x;
            component.y = node.y;
        }

        // Styles and properties
        component.fills = node.fills;
        component.strokes = node.strokes;
        component.strokeWeight = node.strokeWeight;
        component.strokeAlign = node.strokeAlign;
        component.strokeCap = node.strokeCap;
        component.strokeJoin = node.strokeJoin;
        component.dashPattern = node.dashPattern;
        component.effects = node.effects;
        component.layoutGrids = node.layoutGrids;
        component.opacity = node.opacity;
        component.blendMode = node.blendMode;
        component.isMask = node.isMask;

        // Corner Radius (handle mixed)
        if (node.cornerRadius !== figma.mixed) {
            component.cornerRadius = node.cornerRadius;
        } else {
            component.topLeftRadius = node.topLeftRadius;
            component.topRightRadius = node.topRightRadius;
            component.bottomLeftRadius = node.bottomLeftRadius;
            component.bottomRightRadius = node.bottomRightRadius;
        }

        // Auto Layout
        // If the frame has auto-layout, apply it to the component
        if (node.layoutMode !== "NONE") {
            component.layoutMode = node.layoutMode;
            component.primaryAxisSizingMode = node.primaryAxisSizingMode;
            component.counterAxisSizingMode = node.counterAxisSizingMode;
            component.primaryAxisAlignItems = node.primaryAxisAlignItems;
            component.counterAxisAlignItems = node.counterAxisAlignItems;
            component.paddingLeft = node.paddingLeft;
            component.paddingRight = node.paddingRight;
            component.paddingTop = node.paddingTop;
            component.paddingBottom = node.paddingBottom;
            component.itemSpacing = node.itemSpacing;
        }

        // Move children
        // Clone the list of children to iterate over, as appendChild modifies the live children list
        const childrenToMove = [...node.children];
        for (const child of childrenToMove) {
            component.appendChild(child);
        }

        // Remove original frame
        node.remove();

        return {
            id: component.id,
            name: component.name,
            type: "COMPONENT"
        };
    } catch (error) {
        throw new Error(`Error creating component: ${error.message}`);
    }
}
