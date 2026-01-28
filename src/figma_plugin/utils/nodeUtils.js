/**
 * Node utility functions for Figma plugin
 */

import { rgbaToHex } from './colorUtils.js';

/**
 * Filters and transforms a Figma node for serialization
 * @param {SceneNode} node - Figma node to filter
 * @returns {Object|null} Filtered node object or null for VECTOR nodes
 */
export function filterFigmaNode(node) {
    if (node.type === "VECTOR") {
        return null;
    }

    var filtered = {
        id: node.id,
        name: node.name,
        type: node.type,
    };

    if (node.fills && node.fills.length > 0) {
        filtered.fills = node.fills.map((fill) => {
            var processedFill = Object.assign({}, fill);
            delete processedFill.boundVariables;
            delete processedFill.imageRef;

            if (processedFill.gradientStops) {
                processedFill.gradientStops = processedFill.gradientStops.map(
                    (stop) => {
                        var processedStop = Object.assign({}, stop);
                        if (processedStop.color) {
                            processedStop.color = rgbaToHex(processedStop.color);
                        }
                        delete processedStop.boundVariables;
                        return processedStop;
                    }
                );
            }

            if (processedFill.color) {
                processedFill.color = rgbaToHex(processedFill.color);
            }

            return processedFill;
        });
    }

    if (node.strokes && node.strokes.length > 0) {
        filtered.strokes = node.strokes.map((stroke) => {
            var processedStroke = Object.assign({}, stroke);
            delete processedStroke.boundVariables;
            if (processedStroke.color) {
                processedStroke.color = rgbaToHex(processedStroke.color);
            }
            return processedStroke;
        });
    }

    if (node.cornerRadius !== undefined) {
        filtered.cornerRadius = node.cornerRadius;
    }

    if (node.absoluteBoundingBox) {
        filtered.absoluteBoundingBox = node.absoluteBoundingBox;
    }

    if (node.characters) {
        filtered.characters = node.characters;
    }

    if (node.style) {
        filtered.style = {
            fontFamily: node.style.fontFamily,
            fontStyle: node.style.fontStyle,
            fontWeight: node.style.fontWeight,
            fontSize: node.style.fontSize,
            textAlignHorizontal: node.style.textAlignHorizontal,
            letterSpacing: node.style.letterSpacing,
            lineHeightPx: node.style.lineHeightPx,
        };
    }

    if (node.children) {
        filtered.children = node.children
            .map((child) => {
                return filterFigmaNode(child);
            })
            .filter((child) => {
                return child !== null;
            });
    }

    return filtered;
}

/**
 * Collects all nodes that need to be processed recursively
 * @param {SceneNode} node - Root node to start from
 * @param {Array} parentPath - Path to parent node
 * @param {number} depth - Current depth level
 * @param {Array} nodesToProcess - Array to collect nodes
 */
export async function collectNodesToProcess(
    node,
    parentPath = [],
    depth = 0,
    nodesToProcess = []
) {
    // Skip invisible nodes
    if (node.visible === false) return;

    // Get the path to this node
    const nodePath = [...parentPath, node.name || `Unnamed ${node.type}`];

    // Add this node to the processing list
    nodesToProcess.push({
        node: node,
        parentPath: nodePath,
        depth: depth,
    });

    // Recursively add children
    if ("children" in node) {
        for (const child of node.children) {
            await collectNodesToProcess(child, nodePath, depth + 1, nodesToProcess);
        }
    }
}
