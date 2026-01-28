/**
 * Text handlers for Figma plugin
 * Handles text scanning and modification operations
 */

import { generateCommandId, sendProgressUpdate } from '../utils/progressUtils.js';
import { delay } from '../utils/helpers.js';
import { setCharacters } from '../utils/textUtils.js';
import { collectNodesToProcess } from '../utils/nodeUtils.js';

/**
 * Scans for text nodes within a node hierarchy
 * @param {Object} params - Parameters object
 * @param {string} params.nodeId - ID of the root node to scan
 * @param {boolean} params.useChunking - Whether to use chunked processing
 * @param {number} params.chunkSize - Size of processing chunks
 * @returns {Promise<Object>} Scan results with text nodes
 */
export async function scanTextNodes(params) {
    console.log(`Starting to scan text nodes from node ID: ${params.nodeId}`);
    const {
        nodeId,
        useChunking = true,
        chunkSize = 10,
        commandId = generateCommandId(),
    } = params || {};

    const node = await figma.getNodeByIdAsync(nodeId);

    if (!node) {
        console.error(`Node with ID ${nodeId} not found`);
        // Send error progress update
        sendProgressUpdate(
            commandId,
            "scan_text_nodes",
            "error",
            0,
            0,
            0,
            `Node with ID ${nodeId} not found`,
            { error: `Node not found: ${nodeId}` }
        );
        throw new Error(`Node with ID ${nodeId} not found`);
    }

    // If chunking is not enabled, use the original implementation
    if (!useChunking) {
        const textNodes = [];
        try {
            // Send started progress update
            sendProgressUpdate(
                commandId,
                "scan_text_nodes",
                "started",
                0,
                1, // Not known yet how many nodes there are
                0,
                `Starting scan of node "${node.name || nodeId}" without chunking`,
                null
            );

            await findTextNodes(node, [], 0, textNodes);

            // Send completed progress update
            sendProgressUpdate(
                commandId,
                "scan_text_nodes",
                "completed",
                100,
                textNodes.length,
                textNodes.length,
                `Scan complete. Found ${textNodes.length} text nodes.`,
                { textNodes }
            );

            return {
                success: true,
                message: `Scanned ${textNodes.length} text nodes.`,
                count: textNodes.length,
                textNodes: textNodes,
                commandId,
            };
        } catch (error) {
            console.error("Error scanning text nodes:", error);

            // Send error progress update
            sendProgressUpdate(
                commandId,
                "scan_text_nodes",
                "error",
                0,
                0,
                0,
                `Error scanning text nodes: ${error.message}`,
                { error: error.message }
            );

            throw new Error(`Error scanning text nodes: ${error.message}`);
        }
    }

    // Chunked implementation
    console.log(`Using chunked scanning with chunk size: ${chunkSize}`);

    // First, collect all nodes to process (without processing them yet)
    const nodesToProcess = [];

    // Send started progress update
    sendProgressUpdate(
        commandId,
        "scan_text_nodes",
        "started",
        0,
        0, // Not known yet how many nodes there are
        0,
        `Starting chunked scan of node "${node.name || nodeId}"`,
        { chunkSize }
    );

    await collectNodesToProcess(node, [], 0, nodesToProcess);

    const totalNodes = nodesToProcess.length;
    console.log(`Found ${totalNodes} total nodes to process`);

    // Calculate number of chunks needed
    const totalChunks = Math.ceil(totalNodes / chunkSize);
    console.log(`Will process in ${totalChunks} chunks`);

    // Send update after node collection
    sendProgressUpdate(
        commandId,
        "scan_text_nodes",
        "in_progress",
        5, // 5% progress for collection phase
        totalNodes,
        0,
        `Found ${totalNodes} nodes to scan. Will process in ${totalChunks} chunks.`,
        {
            totalNodes,
            totalChunks,
            chunkSize,
        }
    );

    // Process nodes in chunks
    const allTextNodes = [];
    let processedNodes = 0;
    let chunksProcessed = 0;

    for (let i = 0; i < totalNodes; i += chunkSize) {
        const chunkEnd = Math.min(i + chunkSize, totalNodes);
        console.log(
            `Processing chunk ${chunksProcessed + 1}/${totalChunks} (nodes ${i} to ${chunkEnd - 1
            })`
        );

        // Send update before processing chunk
        sendProgressUpdate(
            commandId,
            "scan_text_nodes",
            "in_progress",
            Math.round(5 + (chunksProcessed / totalChunks) * 90), // 5-95% for processing
            totalNodes,
            processedNodes,
            `Processing chunk ${chunksProcessed + 1}/${totalChunks}`,
            {
                currentChunk: chunksProcessed + 1,
                totalChunks,
                textNodesFound: allTextNodes.length,
            }
        );

        const chunkNodes = nodesToProcess.slice(i, chunkEnd);
        const chunkTextNodes = [];

        // Process each node in this chunk
        for (const nodeInfo of chunkNodes) {
            if (nodeInfo.node.type === "TEXT") {
                try {
                    const textNodeInfo = await processTextNode(
                        nodeInfo.node,
                        nodeInfo.parentPath,
                        nodeInfo.depth
                    );
                    if (textNodeInfo) {
                        chunkTextNodes.push(textNodeInfo);
                    }
                } catch (error) {
                    console.error(`Error processing text node: ${error.message}`);
                    // Continue with other nodes
                }
            }

            // Brief delay to allow UI updates and prevent freezing
            await delay(5);
        }

        // Add results from this chunk
        allTextNodes.push(...chunkTextNodes);
        processedNodes += chunkNodes.length;
        chunksProcessed++;

        // Send update after processing chunk
        sendProgressUpdate(
            commandId,
            "scan_text_nodes",
            "in_progress",
            Math.round(5 + (chunksProcessed / totalChunks) * 90), // 5-95% for processing
            totalNodes,
            processedNodes,
            `Processed chunk ${chunksProcessed}/${totalChunks}. Found ${allTextNodes.length} text nodes so far.`,
            {
                currentChunk: chunksProcessed,
                totalChunks,
                processedNodes,
                textNodesFound: allTextNodes.length,
                chunkResult: chunkTextNodes,
            }
        );

        // Small delay between chunks to prevent UI freezing
        if (i + chunkSize < totalNodes) {
            await delay(50);
        }
    }

    // Send completed progress update
    sendProgressUpdate(
        commandId,
        "scan_text_nodes",
        "completed",
        100,
        totalNodes,
        processedNodes,
        `Scan complete. Found ${allTextNodes.length} text nodes.`,
        {
            textNodes: allTextNodes,
            processedNodes,
            chunks: chunksProcessed,
        }
    );

    return {
        success: true,
        message: `Chunked scan complete. Found ${allTextNodes.length} text nodes.`,
        totalNodes: allTextNodes.length,
        processedNodes: processedNodes,
        chunks: chunksProcessed,
        textNodes: allTextNodes,
        commandId,
    };
}

/**
 * Processes a single text node
 * @param {TextNode} node - Text node to process
 * @param {string[]} parentPath - Path to parent node
 * @param {number} depth - Current depth level
 * @returns {Promise<Object|null>} Text node information
 */
async function processTextNode(node, parentPath, depth) {
    if (node.type !== "TEXT") return null;

    try {
        // Safely extract font information
        let fontFamily = "";
        let fontStyle = "";

        if (node.fontName) {
            if (typeof node.fontName === "object") {
                if ("family" in node.fontName) fontFamily = node.fontName.family;
                if ("style" in node.fontName) fontStyle = node.fontName.style;
            }
        }

        // Create a safe representation of the text node
        const safeTextNode = {
            id: node.id,
            name: node.name || "Text",
            type: node.type,
            characters: node.characters,
            fontSize: typeof node.fontSize === "number" ? node.fontSize : 0,
            fontFamily: fontFamily,
            fontStyle: fontStyle,
            x: typeof node.x === "number" ? node.x : 0,
            y: typeof node.y === "number" ? node.y : 0,
            width: typeof node.width === "number" ? node.width : 0,
            height: typeof node.height === "number" ? node.height : 0,
            path: parentPath.join(" > "),
            depth: depth,
        };



        return safeTextNode;
    } catch (nodeErr) {
        console.error("Error processing text node:", nodeErr);
        return null;
    }
}

/**
 * Recursively finds text nodes within a node hierarchy
 * @param {SceneNode} node - Root node to search
 * @param {string[]} parentPath - Path to parent node
 * @param {number} depth - Current depth level
 * @param {Array} textNodes - Array to collect text nodes
 */
async function findTextNodes(node, parentPath = [], depth = 0, textNodes = []) {
    // Skip invisible nodes
    if (node.visible === false) return;

    // Get the path to this node including its name
    const nodePath = [...parentPath, node.name || `Unnamed ${node.type}`];

    if (node.type === "TEXT") {
        try {
            // Safely extract font information to avoid Symbol serialization issues
            let fontFamily = "";
            let fontStyle = "";

            if (node.fontName) {
                if (typeof node.fontName === "object") {
                    if ("family" in node.fontName) fontFamily = node.fontName.family;
                    if ("style" in node.fontName) fontStyle = node.fontName.style;
                }
            }

            // Create a safe representation of the text node with only serializable properties
            const safeTextNode = {
                id: node.id,
                name: node.name || "Text",
                type: node.type,
                characters: node.characters,
                fontSize: typeof node.fontSize === "number" ? node.fontSize : 0,
                fontFamily: fontFamily,
                fontStyle: fontStyle,
                x: typeof node.x === "number" ? node.x : 0,
                y: typeof node.y === "number" ? node.y : 0,
                width: typeof node.width === "number" ? node.width : 0,
                height: typeof node.height === "number" ? node.height : 0,
                path: nodePath.join(" > "),
                depth: depth,
            };



            textNodes.push(safeTextNode);
        } catch (nodeErr) {
            console.error("Error processing text node:", nodeErr);
            // Skip this node but continue with others
        }
    }

    // Recursively process children of container nodes
    if ("children" in node) {
        for (const child of node.children) {
            await findTextNodes(child, nodePath, depth + 1, textNodes);
        }
    }
}

/**
 * Sets text content for a single text node
 * @param {Object} params - Parameters object
 * @param {string} params.nodeId - ID of the text node
 * @param {string} params.text - New text content
 * @returns {Promise<Object>} Result of the operation
 */
async function setTextContent(params) {
    const { nodeId, text } = params || {};

    if (!nodeId) {
        throw new Error("Missing nodeId parameter");
    }

    const node = await figma.getNodeByIdAsync(nodeId);
    if (!node) {
        throw new Error(`Node not found with ID: ${nodeId}`);
    }

    if (node.type !== "TEXT") {
        throw new Error(`Node is not a text node: ${nodeId} (type: ${node.type})`);
    }

    // Use the setCharacters utility from textUtils
    await setCharacters(node, text);

    return {
        success: true,
        nodeId: nodeId,
        text: text,
    };
}

/**
 * Sets text content for multiple text nodes
 * @param {Object} params - Parameters object
 * @param {string} params.nodeId - Parent node ID (for context)
 * @param {Array} params.text - Array of {nodeId, text} objects
 * @returns {Promise<Object>} Results of the operations
 */
export async function setMultipleTextContents(params) {
    const { nodeId, text } = params || {};
    const commandId = params.commandId || generateCommandId();

    if (!nodeId || !text || !Array.isArray(text)) {
        const errorMsg = "Missing required parameters: nodeId and text array";

        // Send error progress update
        sendProgressUpdate(
            commandId,
            "set_multiple_text_contents",
            "error",
            0,
            0,
            0,
            errorMsg,
            { error: errorMsg }
        );

        throw new Error(errorMsg);
    }

    console.log(
        `Starting text replacement for node: ${nodeId} with ${text.length} text replacements`
    );

    // Send started progress update
    sendProgressUpdate(
        commandId,
        "set_multiple_text_contents",
        "started",
        0,
        text.length,
        0,
        `Starting text replacement for ${text.length} nodes`,
        { totalReplacements: text.length }
    );

    // Define the results array and counters
    const results = [];
    let successCount = 0;
    let failureCount = 0;

    // Split text replacements into chunks of 5
    const CHUNK_SIZE = 5;
    const chunks = [];

    for (let i = 0; i < text.length; i += CHUNK_SIZE) {
        chunks.push(text.slice(i, i + CHUNK_SIZE));
    }

    console.log(`Split ${text.length} replacements into ${chunks.length} chunks`);

    // Send chunking info update
    sendProgressUpdate(
        commandId,
        "set_multiple_text_contents",
        "in_progress",
        5, // 5% progress for planning phase
        text.length,
        0,
        `Preparing to replace text in ${text.length} nodes using ${chunks.length} chunks`,
        {
            totalReplacements: text.length,
            chunks: chunks.length,
            chunkSize: CHUNK_SIZE,
        }
    );

    // Process each chunk sequentially
    for (let chunkIndex = 0; chunkIndex < chunks.length; chunkIndex++) {
        const chunk = chunks[chunkIndex];
        console.log(
            `Processing chunk ${chunkIndex + 1}/${chunks.length} with ${chunk.length
            } replacements`
        );

        // Send chunk processing start update
        sendProgressUpdate(
            commandId,
            "set_multiple_text_contents",
            "in_progress",
            Math.round(5 + (chunkIndex / chunks.length) * 90), // 5-95% for processing
            text.length,
            successCount + failureCount,
            `Processing text replacements chunk ${chunkIndex + 1}/${chunks.length}`,
            {
                currentChunk: chunkIndex + 1,
                totalChunks: chunks.length,
                successCount,
                failureCount,
            }
        );

        // Process replacements within a chunk in parallel
        const chunkPromises = chunk.map(async (replacement) => {
            if (!replacement.nodeId || replacement.text === undefined) {
                console.error(`Missing nodeId or text for replacement`);
                return {
                    success: false,
                    nodeId: replacement.nodeId || "unknown",
                    error: "Missing nodeId or text in replacement entry",
                };
            }

            try {
                console.log(
                    `Attempting to replace text in node: ${replacement.nodeId}`
                );

                // Get the text node to update (just to check it exists and get original text)
                const textNode = await figma.getNodeByIdAsync(replacement.nodeId);

                if (!textNode) {
                    console.error(`Text node not found: ${replacement.nodeId}`);
                    return {
                        success: false,
                        nodeId: replacement.nodeId,
                        error: `Node not found: ${replacement.nodeId}`,
                    };
                }

                if (textNode.type !== "TEXT") {
                    console.error(
                        `Node is not a text node: ${replacement.nodeId} (type: ${textNode.type})`
                    );
                    return {
                        success: false,
                        nodeId: replacement.nodeId,
                        error: `Node is not a text node: ${replacement.nodeId} (type: ${textNode.type})`,
                    };
                }

                // Save original text for the result
                const originalText = textNode.characters;
                console.log(`Original text: "${originalText}"`);
                console.log(`Will translate to: "${replacement.text}"`);



                // Use the setTextContent function to handle font loading and text setting
                await setTextContent({
                    nodeId: replacement.nodeId,
                    text: replacement.text,
                });



                console.log(
                    `Successfully replaced text in node: ${replacement.nodeId}`
                );
                return {
                    success: true,
                    nodeId: replacement.nodeId,
                    originalText: originalText,
                    translatedText: replacement.text,
                };
            } catch (error) {
                console.error(
                    `Error replacing text in node ${replacement.nodeId}: ${error.message}`
                );
                return {
                    success: false,
                    nodeId: replacement.nodeId,
                    error: `Error applying replacement: ${error.message}`,
                };
            }
        });

        // Wait for all replacements in this chunk to complete
        const chunkResults = await Promise.all(chunkPromises);

        // Process results for this chunk
        chunkResults.forEach((result) => {
            if (result.success) {
                successCount++;
            } else {
                failureCount++;
            }
            results.push(result);
        });

        // Send chunk processing complete update with partial results
        sendProgressUpdate(
            commandId,
            "set_multiple_text_contents",
            "in_progress",
            Math.round(5 + ((chunkIndex + 1) / chunks.length) * 90), // 5-95% for processing
            text.length,
            successCount + failureCount,
            `Completed chunk ${chunkIndex + 1}/${chunks.length
            }. ${successCount} successful, ${failureCount} failed so far.`,
            {
                currentChunk: chunkIndex + 1,
                totalChunks: chunks.length,
                successCount,
                failureCount,
                chunkResults: chunkResults,
            }
        );

        // Add a small delay between chunks to avoid overloading Figma
        if (chunkIndex < chunks.length - 1) {
            console.log("Pausing between chunks to avoid overloading Figma...");
            await delay(1000); // 1 second delay between chunks
        }
    }

    console.log(
        `Replacement complete: ${successCount} successful, ${failureCount} failed`
    );

    // Send completed progress update
    sendProgressUpdate(
        commandId,
        "set_multiple_text_contents",
        "completed",
        100,
        text.length,
        successCount + failureCount,
        `Text replacement complete: ${successCount} successful, ${failureCount} failed`,
        {
            totalReplacements: text.length,
            replacementsApplied: successCount,
            replacementsFailed: failureCount,
            completedInChunks: chunks.length,
            results: results,
        }
    );

    return {
        success: successCount > 0,
        nodeId: nodeId,
        replacementsApplied: successCount,
        replacementsFailed: failureCount,
        totalReplacements: text.length,
        results: results,
        completedInChunks: chunks.length,
        commandId,
    };
}
