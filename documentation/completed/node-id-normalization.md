# Node ID Normalization Implementation

## Overview
Implemented automatic normalization of Figma node IDs to handle both URL format (dash-separated) and API format (colon-separated).

## Problem
Figma uses different formats for node IDs in different contexts:
- **URL format**: `20485-41` (used in Figma URLs like `?node-id=20485-41`)
- **API format**: `20485:41` (used internally by the Figma Plugin API)

Users copying node IDs from Figma URLs would get errors when using them with the MCP tools.

## Solution
Centralized node ID normalization in the `sendCommandToFigma` function, which automatically converts all node IDs from URL format to API format before sending commands to Figma.

## Implementation Details

### 1. Helper Functions (lines 63-91)
```typescript
/**
 * Normalize node ID from Figma URL format to API format
 * Converts dash-separated IDs (e.g., "20485-41") to colon-separated (e.g., "20485:41")
 */
function normalizeNodeId(nodeId: string | undefined): string | undefined {
  if (!nodeId || typeof nodeId !== 'string') {
    return nodeId;
  }
  
  // Replace dash with colon if it matches the pattern: digits-digits
  return nodeId.replace(/^(\d+)-(\d+)$/, '$1:$2');
}

/**
 * Normalize an array of node IDs from URL format to API format
 */
function normalizeNodeIds(nodeIds: string[] | undefined): string[] | undefined {
  if (!nodeIds || !Array.isArray(nodeIds)) {
    return nodeIds;
  }
  
  return nodeIds.map(id => normalizeNodeId(id) || id);
}
```

### 2. Centralized Normalization in sendCommandToFigma (lines 3039-3091)
The normalization handles:
- **Single node IDs**: `nodeId`, `sourceInstanceId`, `parentId`
- **Node ID arrays**: `nodeIds`, `targetNodeIds`
- **Nested node IDs in objects**:
  - `connections` array (startNodeId, endNodeId)
  - `text` array (nodeId in each item)
  - `annotations` array (nodeId in each annotation)

## Benefits

✅ **User-friendly**: Users can paste node IDs directly from Figma URLs without manual conversion  
✅ **Centralized**: Single point of normalization - easier to maintain  
✅ **Comprehensive**: Handles all parameter types (single IDs, arrays, nested objects)  
✅ **Transparent**: Works automatically without requiring changes to individual tools  
✅ **Backward compatible**: Still works with colon-format IDs (no-op transformation)

## Testing

To test the implementation:

1. Copy a node ID from a Figma URL (e.g., `20485-41`)
2. Use it with any MCP tool:
   ```
   get_node_info(nodeId: "20485-41")
   export_node_as_image(nodeId: "20485-41", format: "PNG")
   ```
3. The normalization will automatically convert it to `20485:41` before sending to Figma

## Files Modified

- `src/mcp_server/server.ts`
  - Added `normalizeNodeId()` and `normalizeNodeIds()` helper functions
  - Modified `sendCommandToFigma()` to normalize all node ID parameters
