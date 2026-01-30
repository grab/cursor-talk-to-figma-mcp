export async function createStyle(params) {
    const { type, name, description, properties } = params;

    // Validate required parameters
    if (!type || !name) {
        throw new Error("Missing required parameters: type and name are required.");
    }

    let style;

    switch (type.toUpperCase()) {
        case 'TEXT':
            style = figma.createTextStyle();
            if (properties) {
                if (properties.fontName) await figma.loadFontAsync(properties.fontName);
                if (properties.fontName) style.fontName = properties.fontName;
                if (properties.fontSize) style.fontSize = properties.fontSize;
                if (properties.lineHeight) style.lineHeight = properties.lineHeight;
                if (properties.letterSpacing) style.letterSpacing = properties.letterSpacing;
                if (properties.paragraphIndent) style.paragraphIndent = properties.paragraphIndent;
                if (properties.paragraphSpacing) style.paragraphSpacing = properties.paragraphSpacing;
                if (properties.textCase) style.textCase = properties.textCase;
                if (properties.textDecoration) style.textDecoration = properties.textDecoration;
            }
            break;

        case 'PAINT':
            style = figma.createPaintStyle();
            if (properties) {
                if (properties.paints) style.paints = properties.paints;
            }
            break;

        case 'EFFECT':
            style = figma.createEffectStyle();
            if (properties) {
                if (properties.effects) style.effects = properties.effects;
            }
            break;

        case 'GRID':
            style = figma.createGridStyle();
            if (properties) {
                if (properties.layoutGrids) style.layoutGrids = properties.layoutGrids;
            }
            break;

        default:
            throw new Error(`Unsupported style type: ${type}`);
    }

    style.name = name;
    if (description) style.description = description;

    return {
        id: style.id,
        name: style.name,
        type: style.type
    };
}

export async function applyStyle(params) {
    const { nodeId, styleId, styleType } = params;

    // Validate parameters
    if (!nodeId || !styleId || !styleType) {
        throw new Error("Missing required parameters: nodeId, styleId, and styleType are required.");
    }

    const node = await figma.getNodeByIdAsync(nodeId);
    if (!node) {
        throw new Error(`Node with ID ${nodeId} not found.`);
    }

    // Determine which property to set based on styleType
    // styleType can be: TEXT, FILL, STROKE, EFFECT, GRID
    switch (styleType.toUpperCase()) {
        case 'TEXT':
            if (node.type !== 'TEXT') throw new Error("Target node must be a Text node to apply specific text styles.");
            // We need to load the font of the style before we can apply it? 
            // Actually, assigning textStyleId usually works if the style exists.
            // But if the command fails, we might need to load fonts.
            // However, figma.getStyleByIdAsync might be needed to verify.
            // For now, simpler implementation:
            node.textStyleId = styleId;
            break;
        case 'FILL':
            if (!('fillStyleId' in node)) throw new Error("Target node does not support fill styles.");
            node.fillStyleId = styleId;
            break;
        case 'STROKE':
            if (!('strokeStyleId' in node)) throw new Error("Target node does not support stroke styles.");
            node.strokeStyleId = styleId;
            break;
        case 'EFFECT':
            if (!('effectStyleId' in node)) throw new Error("Target node does not support effect styles.");
            node.effectStyleId = styleId;
            break;
        case 'GRID':
            if (!('gridStyleId' in node)) throw new Error("Target node does not support grid styles.");
            node.gridStyleId = styleId;
            break;
        default:
            throw new Error(`Unsupported style type target: ${styleType}`);
    }

    return {
        success: true,
        message: `Style ${styleId} applied to node ${nodeId}`
    };
}
