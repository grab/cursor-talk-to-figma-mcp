/**
 * Connector handlers for Figma plugin
 * Handles reactions and connector-related operations
 */

import { generateCommandId, sendProgressUpdate } from '../utils/progressUtils.js';

/**
 * Gets reactions from nodes and their children
 * @param {string[]} nodeIds - Array of node IDs to search
 * @returns {Promise<Object>} Object containing nodes with reactions
 */
export async function getReactions(nodeIds) {
    try {
        const commandId = generateCommandId();
        sendProgressUpdate(
            commandId,
            "get_reactions",
            "started",
            0,
            nodeIds.length,
            0,
            `Starting deep search for reactions in ${nodeIds.length} nodes and their children`
        );

        // Function to find nodes with reactions from the node and all its children
        async function findNodesWithReactions(node, processedNodes = new Set(), depth = 0, results = []) {
            // Skip already processed nodes (prevent circular references)
            if (processedNodes.has(node.id)) {
                return results;
            }

            processedNodes.add(node.id);

            // Check if the current node has reactions
            let filteredReactions = [];
            if (node.reactions && node.reactions.length > 0) {
                // Filter out reactions with navigation === 'CHANGE_TO'
                filteredReactions = node.reactions.filter(r => {
                    // Some reactions may have action or actions array
                    if (r.action && r.action.navigation === 'CHANGE_TO') return false;
                    if (Array.isArray(r.actions)) {
                        // If any action in actions array is CHANGE_TO, exclude
                        return !r.actions.some(a => a.navigation === 'CHANGE_TO');
                    }
                    return true;
                });
            }
            const hasFilteredReactions = filteredReactions.length > 0;

            // If the node has filtered reactions, add it to results and apply highlight effect
            if (hasFilteredReactions) {
                results.push({
                    id: node.id,
                    name: node.name,
                    type: node.type,
                    depth: depth,
                    hasReactions: true,
                    reactions: filteredReactions,
                    path: getNodePath(node)
                });

            }

            // If node has children, recursively search them
            if (node.children) {
                for (const child of node.children) {
                    await findNodesWithReactions(child, processedNodes, depth + 1, results);
                }
            }

            return results;
        }



        // Get node hierarchy path as a string
        function getNodePath(node) {
            const path = [];
            let current = node;

            while (current && current.parent) {
                path.unshift(current.name);
                current = current.parent;
            }

            return path.join(' > ');
        }

        // Array to store all results
        let allResults = [];
        let processedCount = 0;
        const totalCount = nodeIds.length;

        // Iterate through each node and its children to search for reactions
        for (let i = 0; i < nodeIds.length; i++) {
            try {
                const nodeId = nodeIds[i];
                const node = await figma.getNodeByIdAsync(nodeId);

                if (!node) {
                    processedCount++;
                    sendProgressUpdate(
                        commandId,
                        "get_reactions",
                        "in_progress",
                        processedCount / totalCount,
                        totalCount,
                        processedCount,
                        `Node not found: ${nodeId}`
                    );
                    continue;
                }

                // Search for reactions in the node and its children
                const processedNodes = new Set();
                const nodeResults = await findNodesWithReactions(node, processedNodes);

                // Add results
                allResults = allResults.concat(nodeResults);

                // Update progress
                processedCount++;
                sendProgressUpdate(
                    commandId,
                    "get_reactions",
                    "in_progress",
                    processedCount / totalCount,
                    totalCount,
                    processedCount,
                    `Processed node ${processedCount}/${totalCount}, found ${nodeResults.length} nodes with reactions`
                );
            } catch (error) {
                processedCount++;
                sendProgressUpdate(
                    commandId,
                    "get_reactions",
                    "in_progress",
                    processedCount / totalCount,
                    totalCount,
                    processedCount,
                    `Error processing node: ${error.message}`
                );
            }
        }

        // Completion update
        sendProgressUpdate(
            commandId,
            "get_reactions",
            "completed",
            1,
            totalCount,
            totalCount,
            `Completed deep search: found ${allResults.length} nodes with reactions.`
        );

        return {
            nodesCount: nodeIds.length,
            nodesWithReactions: allResults.length,
            nodes: allResults
        };
    } catch (error) {
        throw new Error(`Failed to get reactions: ${error.message}`);
    }
}

/**
 * Sets or retrieves the default connector
 * @param {Object} params - Parameters object
 * @param {string} params.connectorId - Optional connector ID to set as default
 * @returns {Promise<Object>} Result with connector info
 */
export async function setDefaultConnector(params) {
    const { connectorId } = params || {};

    // If connectorId is provided, search and set by that ID (do not check existing storage)
    if (connectorId) {
        // Get node by specified ID
        const node = await figma.getNodeByIdAsync(connectorId);
        if (!node) {
            throw new Error(`Connector node not found with ID: ${connectorId}`);
        }

        // Check node type
        if (node.type !== 'CONNECTOR') {
            throw new Error(`Node is not a connector: ${connectorId}`);
        }

        // Set the found connector as the default connector
        await figma.clientStorage.setAsync('defaultConnectorId', connectorId);

        return {
            success: true,
            message: `Default connector set to: ${connectorId}`,
            connectorId: connectorId
        };
    }
    // If connectorId is not provided, check existing storage
    else {
        // Check if there is an existing default connector in client storage
        try {
            const existingConnectorId = await figma.clientStorage.getAsync('defaultConnectorId');

            // If there is an existing connector ID, check if the node is still valid
            if (existingConnectorId) {
                try {
                    const existingConnector = await figma.getNodeByIdAsync(existingConnectorId);

                    // If the stored connector still exists and is of type CONNECTOR
                    if (existingConnector && existingConnector.type === 'CONNECTOR') {
                        return {
                            success: true,
                            message: `Default connector is already set to: ${existingConnectorId}`,
                            connectorId: existingConnectorId,
                            exists: true
                        };
                    }
                    // The stored connector is no longer valid - find a new connector
                    else {
                        console.log(`Stored connector ID ${existingConnectorId} is no longer valid, finding a new connector...`);
                    }
                } catch (error) {
                    console.log(`Error finding stored connector: ${error.message}. Will try to set a new one.`);
                }
            }
        } catch (error) {
            console.log(`Error checking for existing connector: ${error.message}`);
        }

        // If there is no stored default connector or it is invalid, find one in the current page
        try {
            // Find CONNECTOR type nodes in the current page
            const currentPageConnectors = figma.currentPage.findAllWithCriteria({ types: ['CONNECTOR'] });

            if (currentPageConnectors && currentPageConnectors.length > 0) {
                // Use the first connector found
                const foundConnector = currentPageConnectors[0];
                const autoFoundId = foundConnector.id;

                // Set the found connector as the default connector
                await figma.clientStorage.setAsync('defaultConnectorId', autoFoundId);

                return {
                    success: true,
                    message: `Automatically found and set default connector to: ${autoFoundId}`,
                    connectorId: autoFoundId,
                    autoSelected: true
                };
            } else {
                // If no connector is found in the current page, show a guide message
                throw new Error('No connector found in the current page. Please create a connector in Figma first or specify a connector ID.');
            }
        } catch (error) {
            // Error occurred while running findAllWithCriteria
            throw new Error(`Failed to find a connector: ${error.message}`);
        }
    }
}

/**
 * Creates a cursor node for nested node connections
 * @param {string} targetNodeId - Target node ID
 * @returns {Promise<Object>} Created cursor node info
 */
export async function createCursorNode(targetNodeId) {
    const svgString = `<svg width="48" height="48" viewBox="0 0 48 48" fill="none" xmlns="http://www.w3.org/2000/svg">
    <path d="M16 8V35.2419L22 28.4315L27 39.7823C27 39.7823 28.3526 40.2722 29 39.7823C29.6474 39.2924 30.2913 38.3057 30 37.5121C28.6247 33.7654 25 26.1613 25 26.1613H32L16 8Z" fill="#202125" />
  </svg>`;
    try {
        const targetNode = await figma.getNodeByIdAsync(targetNodeId);
        if (!targetNode) throw new Error("Target node not found");

        // The targetNodeId has semicolons since it is a nested node.
        // So we need to get the parent node ID from the target node ID and check if we can appendChild to it or not.
        let parentNodeId = targetNodeId.includes(';')
            ? targetNodeId.split(';')[0]
            : targetNodeId;
        if (!parentNodeId) throw new Error("Could not determine parent node ID");

        // Find the parent node to append cursor node as child
        let parentNode = await figma.getNodeByIdAsync(parentNodeId);
        if (!parentNode) throw new Error("Parent node not found");

        // If the parent node is not eligible to appendChild, set the parentNode to the parent of the parentNode
        if (parentNode.type === 'INSTANCE' || parentNode.type === 'COMPONENT' || parentNode.type === 'COMPONENT_SET') {
            parentNode = parentNode.parent;
            if (!parentNode) throw new Error("Parent node not found");
        }

        // Create the cursor node
        const importedNode = await figma.createNodeFromSvg(svgString);
        if (!importedNode || !importedNode.id) {
            throw new Error("Failed to create imported cursor node");
        }
        importedNode.name = "TTF_Connector / Mouse Cursor";
        importedNode.resize(48, 48);

        const cursorNode = importedNode.findOne(node => node.type === 'VECTOR');
        if (cursorNode) {
            cursorNode.fills = [{
                type: 'SOLID',
                color: { r: 0, g: 0, b: 0 },
                opacity: 1
            }];
            cursorNode.strokes = [{
                type: 'SOLID',
                color: { r: 1, g: 1, b: 1 },
                opacity: 1
            }];
            cursorNode.strokeWeight = 2;
            cursorNode.strokeAlign = 'OUTSIDE';
            cursorNode.effects = [{
                type: "DROP_SHADOW",
                color: { r: 0, g: 0, b: 0, a: 0.3 },
                offset: { x: 1, y: 1 },
                radius: 2,
                spread: 0,
                visible: true,
                blendMode: "NORMAL"
            }];
        }

        // Append the cursor node to the parent node
        parentNode.appendChild(importedNode);

        // if the parentNode has auto-layout enabled, set the layoutPositioning to ABSOLUTE
        if ('layoutMode' in parentNode && parentNode.layoutMode !== 'NONE') {
            importedNode.layoutPositioning = 'ABSOLUTE';
        }

        // Adjust the importedNode's position to the targetNode's position
        if (
            targetNode.absoluteBoundingBox &&
            parentNode.absoluteBoundingBox
        ) {
            // if the targetNode has absoluteBoundingBox, set the importedNode's absoluteBoundingBox to the targetNode's absoluteBoundingBox
            console.log('targetNode.absoluteBoundingBox', targetNode.absoluteBoundingBox);
            console.log('parentNode.absoluteBoundingBox', parentNode.absoluteBoundingBox);
            importedNode.x = targetNode.absoluteBoundingBox.x - parentNode.absoluteBoundingBox.x + targetNode.absoluteBoundingBox.width / 2 - 48 / 2
            importedNode.y = targetNode.absoluteBoundingBox.y - parentNode.absoluteBoundingBox.y + targetNode.absoluteBoundingBox.height / 2 - 48 / 2;
        } else if (
            'x' in targetNode && 'y' in targetNode && 'width' in targetNode && 'height' in targetNode) {
            // if the targetNode has x, y, width, height, calculate center based on relative position
            console.log('targetNode.x/y/width/height', targetNode.x, targetNode.y, targetNode.width, targetNode.height);
            importedNode.x = targetNode.x + targetNode.width / 2 - 48 / 2;
            importedNode.y = targetNode.y + targetNode.height / 2 - 48 / 2;
        } else {
            // Fallback: Place at top-left of target if possible, otherwise at (0,0) relative to parent
            if ('x' in targetNode && 'y' in targetNode) {
                console.log('Fallback to targetNode x/y');
                importedNode.x = targetNode.x;
                importedNode.y = targetNode.y;
            } else {
                console.log('Fallback to (0,0)');
                importedNode.x = 0;
                importedNode.y = 0;
            }
        }

        // get the importedNode ID and the importedNode
        console.log('importedNode', importedNode);

        return { id: importedNode.id, node: importedNode };

    } catch (error) {
        console.error("Error creating cursor from SVG:", error);
        return { id: null, node: null, error: error.message };
    }
}

/**
 * Creates connections between nodes
 * @param {Object} params - Parameters object
 * @param {Array} params.connections - Array of connection objects
 * @returns {Promise<Object>} Result with created connections
 */
export async function createConnections(params) {
    if (!params || !params.connections || !Array.isArray(params.connections)) {
        throw new Error('Missing or invalid connections parameter');
    }

    const { connections } = params;

    // Command ID for progress tracking
    const commandId = generateCommandId();
    sendProgressUpdate(
        commandId,
        "create_connections",
        "started",
        0,
        connections.length,
        0,
        `Starting to create ${connections.length} connections`
    );

    // Get default connector ID from client storage
    const defaultConnectorId = await figma.clientStorage.getAsync('defaultConnectorId');
    if (!defaultConnectorId) {
        throw new Error('No default connector set. Please try one of the following options to create connections:\n1. Create a connector in FigJam and copy/paste it to your current page, then run the "set_default_connector" command.\n2. Select an existing connector on the current page, then run the "set_default_connector" command.');
    }

    // Get the default connector
    const defaultConnector = await figma.getNodeByIdAsync(defaultConnectorId);
    if (!defaultConnector) {
        throw new Error(`Default connector not found with ID: ${defaultConnectorId}`);
    }
    if (defaultConnector.type !== 'CONNECTOR') {
        throw new Error(`Node is not a connector: ${defaultConnectorId}`);
    }

    // Results array for connection creation
    const results = [];
    let processedCount = 0;
    const totalCount = connections.length;

    for (let i = 0; i < connections.length; i++) {
        try {
            const { startNodeId: originalStartId, endNodeId: originalEndId, text } = connections[i];
            let startId = originalStartId;
            let endId = originalEndId;

            // Check and potentially replace start node ID
            if (startId.includes(';')) {
                console.log(`Nested start node detected: ${startId}. Creating cursor node.`);
                const cursorResult = await createCursorNode(startId);
                if (!cursorResult || !cursorResult.id) {
                    throw new Error(`Failed to create cursor node for nested start node: ${startId}`);
                }
                startId = cursorResult.id;
            }

            const startNode = await figma.getNodeByIdAsync(startId);
            if (!startNode) throw new Error(`Start node not found with ID: ${startId}`);

            // Check and potentially replace end node ID
            if (endId.includes(';')) {
                console.log(`Nested end node detected: ${endId}. Creating cursor node.`);
                const cursorResult = await createCursorNode(endId);
                if (!cursorResult || !cursorResult.id) {
                    throw new Error(`Failed to create cursor node for nested end node: ${endId}`);
                }
                endId = cursorResult.id;
            }
            const endNode = await figma.getNodeByIdAsync(endId);
            if (!endNode) throw new Error(`End node not found with ID: ${endId}`);


            // Clone the default connector
            const clonedConnector = defaultConnector.clone();

            // Update connector name using potentially replaced node names
            clonedConnector.name = `TTF_Connector/${startNode.id}/${endNode.id}`;

            // Set start and end points using potentially replaced IDs
            clonedConnector.connectorStart = {
                endpointNodeId: startId,
                magnet: 'AUTO'
            };

            clonedConnector.connectorEnd = {
                endpointNodeId: endId,
                magnet: 'AUTO'
            };

            // Add text (if provided)
            if (text) {
                try {
                    // Try to load the necessary fonts
                    try {
                        // First check if default connector has font and use the same
                        if (defaultConnector.text && defaultConnector.text.fontName) {
                            const fontName = defaultConnector.text.fontName;
                            await figma.loadFontAsync(fontName);
                            clonedConnector.text.fontName = fontName;
                        } else {
                            // Try default Inter font
                            await figma.loadFontAsync({ family: "Inter", style: "Regular" });
                        }
                    } catch (fontError) {
                        // If first font load fails, try another font style
                        try {
                            await figma.loadFontAsync({ family: "Inter", style: "Medium" });
                        } catch (mediumFontError) {
                            // If second font fails, try system font
                            try {
                                await figma.loadFontAsync({ family: "System", style: "Regular" });
                            } catch (systemFontError) {
                                // If all font loading attempts fail, throw error
                                throw new Error(`Failed to load any font: ${fontError.message}`);
                            }
                        }
                    }

                    // Set the text
                    clonedConnector.text.characters = text;
                } catch (textError) {
                    console.error("Error setting text:", textError);
                    // Continue with connection even if text setting fails
                    results.push({
                        id: clonedConnector.id,
                        startNodeId: originalStartId,
                        endNodeId: originalEndId,
                        text: "",
                        textError: textError.message
                    });

                    // Continue to next connection
                    continue;
                }
            }

            // Add to results (using the *original* IDs for reference if needed)
            results.push({
                id: clonedConnector.id,
                originalStartNodeId: originalStartId,
                originalEndNodeId: originalEndId,
                usedStartNodeId: startId, // ID actually used for connection
                usedEndNodeId: endId,     // ID actually used for connection
                text: text || ""
            });

            // Update progress
            processedCount++;
            sendProgressUpdate(
                commandId,
                "create_connections",
                "in_progress",
                processedCount / totalCount,
                totalCount,
                processedCount,
                `Created connection ${processedCount}/${totalCount}`
            );

        } catch (error) {
            console.error("Error creating connection", error);
            // Continue processing remaining connections even if an error occurs
            processedCount++;
            sendProgressUpdate(
                commandId,
                "create_connections",
                "in_progress",
                processedCount / totalCount,
                totalCount,
                processedCount,
                `Error creating connection: ${error.message}`
            );

            results.push({
                error: error.message,
                connectionInfo: connections[i]
            });
        }
    }

    // Completion update
    sendProgressUpdate(
        commandId,
        "create_connections",
        "completed",
        1,
        totalCount,
        totalCount,
        `Completed creating ${results.length} connections`
    );

    return {
        success: true,
        count: results.length,
        connections: results
    };
}
