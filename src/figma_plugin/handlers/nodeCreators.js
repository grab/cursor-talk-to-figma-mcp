/**
 * Node creator handlers for Figma plugin
 * Handles creation of new nodes (rectangles, frames, text, clones)
 */

import { setCharacters } from '../utils/textUtils.js';

/**
 * Creates a new rectangle node
 * @param {Object} params - Parameters object
 * @param {number} params.x - X position
 * @param {number} params.y - Y position
 * @param {number} params.width - Width of rectangle
 * @param {number} params.height - Height of rectangle
 * @param {string} params.name - Name of rectangle
 * @param {string} params.parentId - Optional parent node ID
 * @returns {Promise<Object>} Created rectangle info
 */
export async function createRectangle(params) {
    const {
        x = 0,
        y = 0,
        width = 100,
        height = 100,
        name = "Rectangle",
        parentId,
    } = params || {};

    const rect = figma.createRectangle();
    rect.x = x;
    rect.y = y;
    rect.resize(width, height);
    rect.name = name;

    // If parentId is provided, append to that node, otherwise append to current page
    if (parentId) {
        const parentNode = await figma.getNodeByIdAsync(parentId);
        if (!parentNode) {
            throw new Error(`Parent node not found with ID: ${parentId}`);
        }
        if (!("appendChild" in parentNode)) {
            throw new Error(`Parent node does not support children: ${parentId}`);
        }
        parentNode.appendChild(rect);
    } else {
        figma.currentPage.appendChild(rect);
    }

    return {
        id: rect.id,
        name: rect.name,
        x: rect.x,
        y: rect.y,
        width: rect.width,
        height: rect.height,
        parentId: rect.parent ? rect.parent.id : undefined,
    };
}

/**
 * Creates a new frame node
 * @param {Object} params - Parameters object
 * @param {number} params.x - X position
 * @param {number} params.y - Y position
 * @param {number} params.width - Width of frame
 * @param {number} params.height - Height of frame
 * @param {string} params.name - Name of frame
 * @param {string} params.parentId - Optional parent node ID
 * @param {Object} params.fillColor - Optional fill color
 * @param {Object} params.strokeColor - Optional stroke color
 * @param {number} params.strokeWeight - Optional stroke weight
 * @param {string} params.layoutMode - Layout mode (NONE, HORIZONTAL, VERTICAL)
 * @param {string} params.layoutWrap - Layout wrap (NO_WRAP, WRAP)
 * @returns {Promise<Object>} Created frame info
 */
export async function createFrame(params) {
    const {
        x = 0,
        y = 0,
        width = 100,
        height = 100,
        name = "Frame",
        parentId,
        fillColor,
        strokeColor,
        strokeWeight,
        layoutMode = "NONE",
        layoutWrap = "NO_WRAP",
        paddingTop = 10,
        paddingRight = 10,
        paddingBottom = 10,
        paddingLeft = 10,
        primaryAxisAlignItems = "MIN",
        counterAxisAlignItems = "MIN",
        layoutSizingHorizontal = "FIXED",
        layoutSizingVertical = "FIXED",
        itemSpacing = 0,
    } = params || {};

    const frame = figma.createFrame();
    frame.x = x;
    frame.y = y;
    frame.resize(width, height);
    frame.name = name;

    // Set layout mode if provided
    if (layoutMode !== "NONE") {
        frame.layoutMode = layoutMode;
        frame.layoutWrap = layoutWrap;

        // Set padding values only when layoutMode is not NONE
        frame.paddingTop = paddingTop;
        frame.paddingRight = paddingRight;
        frame.paddingBottom = paddingBottom;
        frame.paddingLeft = paddingLeft;

        // Set axis alignment only when layoutMode is not NONE
        frame.primaryAxisAlignItems = primaryAxisAlignItems;
        frame.counterAxisAlignItems = counterAxisAlignItems;

        // Set layout sizing only when layoutMode is not NONE
        frame.layoutSizingHorizontal = layoutSizingHorizontal;
        frame.layoutSizingVertical = layoutSizingVertical;

        // Set item spacing only when layoutMode is not NONE
        frame.itemSpacing = itemSpacing;
    }

    // Set fill color if provided
    if (fillColor) {
        const paintStyle = {
            type: "SOLID",
            color: {
                r: parseFloat(fillColor.r) || 0,
                g: parseFloat(fillColor.g) || 0,
                b: parseFloat(fillColor.b) || 0,
            },
            opacity: parseFloat(fillColor.a) || 1,
        };
        frame.fills = [paintStyle];
    }

    // Set stroke color and weight if provided
    if (strokeColor) {
        const strokeStyle = {
            type: "SOLID",
            color: {
                r: parseFloat(strokeColor.r) || 0,
                g: parseFloat(strokeColor.g) || 0,
                b: parseFloat(strokeColor.b) || 0,
            },
            opacity: parseFloat(strokeColor.a) || 1,
        };
        frame.strokes = [strokeStyle];
    }

    // Set stroke weight if provided
    if (strokeWeight !== undefined) {
        frame.strokeWeight = strokeWeight;
    }

    // If parentId is provided, append to that node, otherwise append to current page
    if (parentId) {
        const parentNode = await figma.getNodeByIdAsync(parentId);
        if (!parentNode) {
            throw new Error(`Parent node not found with ID: ${parentId}`);
        }
        if (!("appendChild" in parentNode)) {
            throw new Error(`Parent node does not support children: ${parentId}`);
        }
        parentNode.appendChild(frame);
    } else {
        figma.currentPage.appendChild(frame);
    }

    return {
        id: frame.id,
        name: frame.name,
        x: frame.x,
        y: frame.y,
        width: frame.width,
        height: frame.height,
        fills: frame.fills,
        strokes: frame.strokes,
        strokeWeight: frame.strokeWeight,
        layoutMode: frame.layoutMode,
        layoutWrap: frame.layoutWrap,
        parentId: frame.parent ? frame.parent.id : undefined,
    };
}

/**
 * Maps font weight number to Figma font style name
 * @param {number} weight - Font weight (100-900)
 * @returns {string} Figma font style name
 */
function getFontStyle(weight) {
    switch (weight) {
        case 100:
            return "Thin";
        case 200:
            return "Extra Light";
        case 300:
            return "Light";
        case 400:
            return "Regular";
        case 500:
            return "Medium";
        case 600:
            return "Semi Bold";
        case 700:
            return "Bold";
        case 800:
            return "Extra Bold";
        case 900:
            return "Black";
        default:
            return "Regular";
    }
}

/**
 * Creates a new text node
 * @param {Object} params - Parameters object
 * @param {number} params.x - X position
 * @param {number} params.y - Y position
 * @param {string} params.text - Text content
 * @param {number} params.fontSize - Font size
 * @param {number} params.fontWeight - Font weight (100-900)
 * @param {Object} params.fontColor - Font color
 * @param {string} params.name - Node name
 * @param {string} params.parentId - Optional parent node ID
 * @returns {Promise<Object>} Created text node info
 */
export async function createText(params) {
    const {
        x = 0,
        y = 0,
        text = "Text",
        fontSize = 14,
        fontWeight = 400,
        fontColor = { r: 0, g: 0, b: 0, a: 1 }, // Default to black
        name = "",
        parentId,
    } = params || {};

    const textNode = figma.createText();
    textNode.x = x;
    textNode.y = y;
    textNode.name = name || text;
    try {
        await figma.loadFontAsync({
            family: "Inter",
            style: getFontStyle(fontWeight),
        });
        textNode.fontName = { family: "Inter", style: getFontStyle(fontWeight) };
        textNode.fontSize = parseInt(fontSize);
    } catch (error) {
        console.error("Error setting font size", error);
    }
    setCharacters(textNode, text);

    // Set text color
    const paintStyle = {
        type: "SOLID",
        color: {
            r: parseFloat(fontColor.r) || 0,
            g: parseFloat(fontColor.g) || 0,
            b: parseFloat(fontColor.b) || 0,
        },
        opacity: parseFloat(fontColor.a) || 1,
    };
    textNode.fills = [paintStyle];

    // If parentId is provided, append to that node, otherwise append to current page
    if (parentId) {
        const parentNode = await figma.getNodeByIdAsync(parentId);
        if (!parentNode) {
            throw new Error(`Parent node not found with ID: ${parentId}`);
        }
        if (!("appendChild" in parentNode)) {
            throw new Error(`Parent node does not support children: ${parentId}`);
        }
        parentNode.appendChild(textNode);
    } else {
        figma.currentPage.appendChild(textNode);
    }

    return {
        id: textNode.id,
        name: textNode.name,
        x: textNode.x,
        y: textNode.y,
        width: textNode.width,
        height: textNode.height,
        characters: textNode.characters,
        fontSize: textNode.fontSize,
        fontWeight: fontWeight,
        fontColor: fontColor,
        fontName: textNode.fontName,
        fills: textNode.fills,
        parentId: textNode.parent ? textNode.parent.id : undefined,
    };
}

/**
 * Clones an existing node
 * @param {Object} params - Parameters object
 * @param {string} params.nodeId - ID of node to clone
 * @param {number} params.x - Optional X position for clone
 * @param {number} params.y - Optional Y position for clone
 * @returns {Promise<Object>} Cloned node info
 */
export async function cloneNode(params) {
    const { nodeId, x, y } = params || {};

    if (!nodeId) {
        throw new Error("Missing nodeId parameter");
    }

    const node = await figma.getNodeByIdAsync(nodeId);
    if (!node) {
        throw new Error(`Node not found with ID: ${nodeId}`);
    }

    // Clone the node
    const clone = node.clone();

    // If x and y are provided, move the clone to that position
    if (x !== undefined && y !== undefined) {
        if (!("x" in clone) || !("y" in clone)) {
            throw new Error(`Cloned node does not support position: ${nodeId}`);
        }
        clone.x = x;
        clone.y = y;
    }

    // Add the clone to the same parent as the original node
    if (node.parent) {
        node.parent.appendChild(clone);
    } else {
        figma.currentPage.appendChild(clone);
    }

    return {
        id: clone.id,
        name: clone.name,
        x: "x" in clone ? clone.x : undefined,
        y: "y" in clone ? clone.y : undefined,
        width: "width" in clone ? clone.width : undefined,
        height: "height" in clone ? clone.height : undefined,
    };
}
