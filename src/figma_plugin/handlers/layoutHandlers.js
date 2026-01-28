/**
 * Layout handlers for Figma plugin
 * Handles auto-layout related operations
 */

/**
 * Sets the layout mode and wrap behavior of a frame
 * @param {Object} params - Parameters object
 * @param {string} params.nodeId - ID of the node to modify
 * @param {string} params.layoutMode - Layout mode (NONE, HORIZONTAL, VERTICAL)
 * @param {string} params.layoutWrap - Wrap behavior (NO_WRAP, WRAP)
 * @returns {Promise<Object>} Result with node info and applied layout settings
 */
export async function setLayoutMode(params) {
    const { nodeId, layoutMode = "NONE", layoutWrap = "NO_WRAP" } = params || {};

    // Get the target node
    const node = await figma.getNodeByIdAsync(nodeId);
    if (!node) {
        throw new Error(`Node with ID ${nodeId} not found`);
    }

    // Check if node is a frame or component that supports layoutMode
    if (
        node.type !== "FRAME" &&
        node.type !== "COMPONENT" &&
        node.type !== "COMPONENT_SET" &&
        node.type !== "INSTANCE"
    ) {
        throw new Error(`Node type ${node.type} does not support layoutMode`);
    }

    // Set layout mode
    node.layoutMode = layoutMode;

    // Set layoutWrap if applicable
    if (layoutMode !== "NONE") {
        node.layoutWrap = layoutWrap;
    }

    return {
        id: node.id,
        name: node.name,
        layoutMode: node.layoutMode,
        layoutWrap: node.layoutWrap,
    };
}

/**
 * Sets padding values for an auto-layout frame
 * @param {Object} params - Parameters object
 * @param {string} params.nodeId - ID of the node to modify
 * @param {number} params.paddingTop - Top padding value
 * @param {number} params.paddingRight - Right padding value
 * @param {number} params.paddingBottom - Bottom padding value
 * @param {number} params.paddingLeft - Left padding value
 * @returns {Promise<Object>} Result with node info and applied padding
 */
export async function setPadding(params) {
    const { nodeId, paddingTop, paddingRight, paddingBottom, paddingLeft } =
        params || {};

    // Get the target node
    const node = await figma.getNodeByIdAsync(nodeId);
    if (!node) {
        throw new Error(`Node with ID ${nodeId} not found`);
    }

    // Check if node is a frame or component that supports padding
    if (
        node.type !== "FRAME" &&
        node.type !== "COMPONENT" &&
        node.type !== "COMPONENT_SET" &&
        node.type !== "INSTANCE"
    ) {
        throw new Error(`Node type ${node.type} does not support padding`);
    }

    // Check if the node has auto-layout enabled
    if (node.layoutMode === "NONE") {
        throw new Error(
            "Padding can only be set on auto-layout frames (layoutMode must not be NONE)"
        );
    }

    // Set padding values if provided
    if (paddingTop !== undefined) node.paddingTop = paddingTop;
    if (paddingRight !== undefined) node.paddingRight = paddingRight;
    if (paddingBottom !== undefined) node.paddingBottom = paddingBottom;
    if (paddingLeft !== undefined) node.paddingLeft = paddingLeft;

    return {
        id: node.id,
        name: node.name,
        paddingTop: node.paddingTop,
        paddingRight: node.paddingRight,
        paddingBottom: node.paddingBottom,
        paddingLeft: node.paddingLeft,
    };
}

/**
 * Sets axis alignment for an auto-layout frame
 * @param {Object} params - Parameters object
 * @param {string} params.nodeId - ID of the node to modify
 * @param {string} params.primaryAxisAlignItems - Primary axis alignment (MIN, MAX, CENTER, SPACE_BETWEEN)
 * @param {string} params.counterAxisAlignItems - Counter axis alignment (MIN, MAX, CENTER, BASELINE)
 * @returns {Promise<Object>} Result with node info and applied alignment
 */
export async function setAxisAlign(params) {
    const { nodeId, primaryAxisAlignItems, counterAxisAlignItems } = params || {};

    // Get the target node
    const node = await figma.getNodeByIdAsync(nodeId);
    if (!node) {
        throw new Error(`Node with ID ${nodeId} not found`);
    }

    // Check if node is a frame or component that supports axis alignment
    if (
        node.type !== "FRAME" &&
        node.type !== "COMPONENT" &&
        node.type !== "COMPONENT_SET" &&
        node.type !== "INSTANCE"
    ) {
        throw new Error(`Node type ${node.type} does not support axis alignment`);
    }

    // Check if the node has auto-layout enabled
    if (node.layoutMode === "NONE") {
        throw new Error(
            "Axis alignment can only be set on auto-layout frames (layoutMode must not be NONE)"
        );
    }

    // Validate and set primaryAxisAlignItems if provided
    if (primaryAxisAlignItems !== undefined) {
        if (
            !["MIN", "MAX", "CENTER", "SPACE_BETWEEN"].includes(primaryAxisAlignItems)
        ) {
            throw new Error(
                "Invalid primaryAxisAlignItems value. Must be one of: MIN, MAX, CENTER, SPACE_BETWEEN"
            );
        }
        node.primaryAxisAlignItems = primaryAxisAlignItems;
    }

    // Validate and set counterAxisAlignItems if provided
    if (counterAxisAlignItems !== undefined) {
        if (!["MIN", "MAX", "CENTER", "BASELINE"].includes(counterAxisAlignItems)) {
            throw new Error(
                "Invalid counterAxisAlignItems value. Must be one of: MIN, MAX, CENTER, BASELINE"
            );
        }
        // BASELINE is only valid for horizontal layout
        if (
            counterAxisAlignItems === "BASELINE" &&
            node.layoutMode !== "HORIZONTAL"
        ) {
            throw new Error(
                "BASELINE alignment is only valid for horizontal auto-layout frames"
            );
        }
        node.counterAxisAlignItems = counterAxisAlignItems;
    }

    return {
        id: node.id,
        name: node.name,
        primaryAxisAlignItems: node.primaryAxisAlignItems,
        counterAxisAlignItems: node.counterAxisAlignItems,
        layoutMode: node.layoutMode,
    };
}

/**
 * Sets layout sizing modes for an auto-layout frame
 * @param {Object} params - Parameters object
 * @param {string} params.nodeId - ID of the node to modify
 * @param {string} params.layoutSizingHorizontal - Horizontal sizing (FIXED, HUG, FILL)
 * @param {string} params.layoutSizingVertical - Vertical sizing (FIXED, HUG, FILL)
 * @returns {Promise<Object>} Result with node info and applied sizing
 */
export async function setLayoutSizing(params) {
    const { nodeId, layoutSizingHorizontal, layoutSizingVertical } = params || {};

    // Get the target node
    const node = await figma.getNodeByIdAsync(nodeId);
    if (!node) {
        throw new Error(`Node with ID ${nodeId} not found`);
    }

    // Check if node is a frame or component that supports layout sizing
    if (
        node.type !== "FRAME" &&
        node.type !== "COMPONENT" &&
        node.type !== "COMPONENT_SET" &&
        node.type !== "INSTANCE"
    ) {
        throw new Error(`Node type ${node.type} does not support layout sizing`);
    }

    // Check if the node has auto-layout enabled
    if (node.layoutMode === "NONE") {
        throw new Error(
            "Layout sizing can only be set on auto-layout frames (layoutMode must not be NONE)"
        );
    }

    // Validate and set layoutSizingHorizontal if provided
    if (layoutSizingHorizontal !== undefined) {
        if (!["FIXED", "HUG", "FILL"].includes(layoutSizingHorizontal)) {
            throw new Error(
                "Invalid layoutSizingHorizontal value. Must be one of: FIXED, HUG, FILL"
            );
        }
        // HUG is only valid on auto-layout frames and text nodes
        if (
            layoutSizingHorizontal === "HUG" &&
            !["FRAME", "TEXT"].includes(node.type)
        ) {
            throw new Error(
                "HUG sizing is only valid on auto-layout frames and text nodes"
            );
        }
        // FILL is only valid on auto-layout children
        if (
            layoutSizingHorizontal === "FILL" &&
            (!node.parent || node.parent.layoutMode === "NONE")
        ) {
            throw new Error("FILL sizing is only valid on auto-layout children");
        }
        node.layoutSizingHorizontal = layoutSizingHorizontal;
    }

    // Validate and set layoutSizingVertical if provided
    if (layoutSizingVertical !== undefined) {
        if (!["FIXED", "HUG", "FILL"].includes(layoutSizingVertical)) {
            throw new Error(
                "Invalid layoutSizingVertical value. Must be one of: FIXED, HUG, FILL"
            );
        }
        // HUG is only valid on auto-layout frames and text nodes
        if (
            layoutSizingVertical === "HUG" &&
            !["FRAME", "TEXT"].includes(node.type)
        ) {
            throw new Error(
                "HUG sizing is only valid on auto-layout frames and text nodes"
            );
        }
        // FILL is only valid on auto-layout children
        if (
            layoutSizingVertical === "FILL" &&
            (!node.parent || node.parent.layoutMode === "NONE")
        ) {
            throw new Error("FILL sizing is only valid on auto-layout children");
        }
        node.layoutSizingVertical = layoutSizingVertical;
    }

    return {
        id: node.id,
        name: node.name,
        layoutSizingHorizontal: node.layoutSizingHorizontal,
        layoutSizingVertical: node.layoutSizingVertical,
        layoutMode: node.layoutMode,
    };
}

/**
 * Sets item spacing for an auto-layout frame
 * @param {Object} params - Parameters object
 * @param {string} params.nodeId - ID of the node to modify
 * @param {number} params.itemSpacing - Space between children
 * @param {number} params.counterAxisSpacing - Space between wrapped rows/columns
 * @returns {Promise<Object>} Result with node info and applied spacing
 */
export async function setItemSpacing(params) {
    const { nodeId, itemSpacing, counterAxisSpacing } = params || {};

    // Validate that at least one spacing parameter is provided
    if (itemSpacing === undefined && counterAxisSpacing === undefined) {
        throw new Error("At least one of itemSpacing or counterAxisSpacing must be provided");
    }

    // Get the target node
    const node = await figma.getNodeByIdAsync(nodeId);
    if (!node) {
        throw new Error(`Node with ID ${nodeId} not found`);
    }

    // Check if node is a frame or component that supports item spacing
    if (
        node.type !== "FRAME" &&
        node.type !== "COMPONENT" &&
        node.type !== "COMPONENT_SET" &&
        node.type !== "INSTANCE"
    ) {
        throw new Error(`Node type ${node.type} does not support item spacing`);
    }

    // Check if the node has auto-layout enabled
    if (node.layoutMode === "NONE") {
        throw new Error(
            "Item spacing can only be set on auto-layout frames (layoutMode must not be NONE)"
        );
    }

    // Set item spacing if provided
    if (itemSpacing !== undefined) {
        if (typeof itemSpacing !== "number") {
            throw new Error("Item spacing must be a number");
        }
        node.itemSpacing = itemSpacing;
    }

    // Set counter axis spacing if provided
    if (counterAxisSpacing !== undefined) {
        if (typeof counterAxisSpacing !== "number") {
            throw new Error("Counter axis spacing must be a number");
        }
        // counterAxisSpacing only applies when layoutWrap is WRAP
        if (node.layoutWrap !== "WRAP") {
            throw new Error(
                "Counter axis spacing can only be set on frames with layoutWrap set to WRAP"
            );
        }
        node.counterAxisSpacing = counterAxisSpacing;
    }

    return {
        id: node.id,
        name: node.name,
        itemSpacing: node.itemSpacing || undefined,
        counterAxisSpacing: node.counterAxisSpacing || undefined,
        layoutMode: node.layoutMode,
        layoutWrap: node.layoutWrap,
    };
}
