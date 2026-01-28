/**
 * Styling handlers for Figma plugin
 * Handles fill, stroke, and corner radius operations
 */

/**
 * Sets the fill color of a node
 * @param {Object} params - Parameters object
 * @param {string} params.nodeId - ID of the node to modify
 * @param {Object} params.color - Color object with r, g, b, a values (0-1)
 * @returns {Promise<Object>} Result with node info and applied fills
 */
export async function setFillColor(params) {
    console.log("setFillColor", params);
    const {
        nodeId,
        color: { r, g, b, a },
    } = params || {};

    if (!nodeId) {
        throw new Error("Missing nodeId parameter");
    }

    const node = await figma.getNodeByIdAsync(nodeId);
    if (!node) {
        throw new Error(`Node not found with ID: ${nodeId}`);
    }

    if (!("fills" in node)) {
        throw new Error(`Node does not support fills: ${nodeId}`);
    }

    // Create RGBA color
    const rgbColor = {
        r: parseFloat(r) || 0,
        g: parseFloat(g) || 0,
        b: parseFloat(b) || 0,
        a: parseFloat(a) || 1,
    };

    // Set fill
    const paintStyle = {
        type: "SOLID",
        color: {
            r: parseFloat(rgbColor.r),
            g: parseFloat(rgbColor.g),
            b: parseFloat(rgbColor.b),
        },
        opacity: parseFloat(rgbColor.a),
    };

    console.log("paintStyle", paintStyle);

    node.fills = [paintStyle];

    return {
        id: node.id,
        name: node.name,
        fills: [paintStyle],
    };
}

/**
 * Sets the stroke color and weight of a node
 * @param {Object} params - Parameters object
 * @param {string} params.nodeId - ID of the node to modify
 * @param {Object} params.color - Color object with r, g, b, a values (0-1)
 * @param {number} params.weight - Stroke weight (default: 1)
 * @returns {Promise<Object>} Result with node info and applied strokes
 */
export async function setStrokeColor(params) {
    const {
        nodeId,
        color: { r, g, b, a },
        weight = 1,
    } = params || {};

    if (!nodeId) {
        throw new Error("Missing nodeId parameter");
    }

    const node = await figma.getNodeByIdAsync(nodeId);
    if (!node) {
        throw new Error(`Node not found with ID: ${nodeId}`);
    }

    if (!("strokes" in node)) {
        throw new Error(`Node does not support strokes: ${nodeId}`);
    }

    // Create RGBA color
    const rgbColor = {
        r: r !== undefined ? r : 0,
        g: g !== undefined ? g : 0,
        b: b !== undefined ? b : 0,
        a: a !== undefined ? a : 1,
    };

    // Set stroke
    const paintStyle = {
        type: "SOLID",
        color: {
            r: rgbColor.r,
            g: rgbColor.g,
            b: rgbColor.b,
        },
        opacity: rgbColor.a,
    };

    node.strokes = [paintStyle];

    // Set stroke weight if available
    if ("strokeWeight" in node) {
        node.strokeWeight = weight;
    }

    return {
        id: node.id,
        name: node.name,
        strokes: node.strokes,
        strokeWeight: "strokeWeight" in node ? node.strokeWeight : undefined,
    };
}

/**
 * Sets the corner radius of a node
 * @param {Object} params - Parameters object
 * @param {string} params.nodeId - ID of the node to modify
 * @param {number} params.radius - Corner radius value
 * @param {boolean[]} params.corners - Optional array of 4 booleans [topLeft, topRight, bottomRight, bottomLeft]
 * @returns {Promise<Object>} Result with node info and applied corner radii
 */
export async function setCornerRadius(params) {
    const { nodeId, radius, corners } = params || {};

    if (!nodeId) {
        throw new Error("Missing nodeId parameter");
    }

    if (radius === undefined) {
        throw new Error("Missing radius parameter");
    }

    const node = await figma.getNodeByIdAsync(nodeId);
    if (!node) {
        throw new Error(`Node not found with ID: ${nodeId}`);
    }

    // Check if node supports corner radius
    if (!("cornerRadius" in node)) {
        throw new Error(`Node does not support corner radius: ${nodeId}`);
    }

    // If corners array is provided, set individual corner radii
    if (corners && Array.isArray(corners) && corners.length === 4) {
        if ("topLeftRadius" in node) {
            // Node supports individual corner radii
            if (corners[0]) node.topLeftRadius = radius;
            if (corners[1]) node.topRightRadius = radius;
            if (corners[2]) node.bottomRightRadius = radius;
            if (corners[3]) node.bottomLeftRadius = radius;
        } else {
            // Node only supports uniform corner radius
            node.cornerRadius = radius;
        }
    } else {
        // Set uniform corner radius
        node.cornerRadius = radius;
    }

    return {
        id: node.id,
        name: node.name,
        cornerRadius: "cornerRadius" in node ? node.cornerRadius : undefined,
        topLeftRadius: "topLeftRadius" in node ? node.topLeftRadius : undefined,
        topRightRadius: "topRightRadius" in node ? node.topRightRadius : undefined,
        bottomRightRadius:
            "bottomRightRadius" in node ? node.bottomRightRadius : undefined,
        bottomLeftRadius:
            "bottomLeftRadius" in node ? node.bottomLeftRadius : undefined,
    };
}
