export async function createNodeFromSvg(params) {
    const { parentId, svg, name, x = 0, y = 0 } = params;

    if (!params.svg) {
        throw new Error("Missing required parameter: svg string.");
    }

    const node = figma.createNodeFromSvg(params.svg);

    if (name) {
        node.name = name;
    }

    if (parentId) {
        const parent = await figma.getNodeByIdAsync(parentId);
        if (parent) {
            parent.appendChild(node);
        } else {
            // If parent not found, append to current page or root
            figma.currentPage.appendChild(node);
        }
    } else {
        figma.currentPage.appendChild(node);
    }

    node.x = x;
    node.y = y;

    return {
        id: node.id,
        name: node.name,
        type: node.type
    };
}
