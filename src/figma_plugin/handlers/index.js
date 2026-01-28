/**
 * Handler module exports for Figma plugin
 * Central export point for all handler modules
 */

// Styling handlers
export { setFillColor, setStrokeColor, setCornerRadius } from './stylingHandlers.js';

// Layout handlers
export {
    setLayoutMode,
    setPadding,
    setAxisAlign,
    setLayoutSizing,
    setItemSpacing
} from './layoutHandlers.js';

// Node readers
export {
    getDocumentInfo,
    getSelection,
    getNodesInfo,
    readMyDesign
} from './nodeReaders.js';

// Node creators
export {
    createRectangle,
    createFrame,
    createText,
    cloneNode
} from './nodeCreators.js';

// Node modifiers
export {
    moveNode,
    resizeNode,
    deleteMultipleNodes,
    setSelections,
    setNodeName
} from './nodeModifiers.js';

// Component handlers
export {
    getStyles,
    getLocalComponents,
    createComponentInstance,
    exportNodeAsImage,
    getInstanceOverrides,
    getValidTargetInstances,
    getSourceInstanceData,
    setInstanceOverrides
} from './componentHandlers.js';

// Connector handlers
export {
    getReactions,
    setDefaultConnector,
    createCursorNode,
    createConnections
} from './connectorHandlers.js';

// Text handlers
export {
    scanTextNodes,
    setMultipleTextContents
} from './textHandlers.js';

// Annotation handlers
export {
    getAnnotations,
    scanNodesByTypes,
    setMultipleAnnotations
} from './annotationHandlers.js';
