// Example: Correct Safe Area Frame Creation After Bug Fix
// This demonstrates how to properly create Safe Area frames as children of slide frames

// Specification for Safe Area:
// - Offset from parent: left/right = 112px, top/bottom = 96px
// - Size: 1696×888 for 1920×1080 parent frames
// - Fill: Fully transparent (opacity 0)
// - Stroke: 1px white

/**
 * Creates a Safe Area frame inside a slide frame
 * @param {string} slideId - The ID of the slide frame
 * @param {number} slideWidth - Width of the slide (typically 1920)
 * @param {number} slideHeight - Height of the slide (typically 1080)
 */
async function createSafeArea(slideId, slideWidth = 1920, slideHeight = 1080) {
  const SAFE_AREA_OFFSET_X = 112;
  const SAFE_AREA_OFFSET_Y = 96;
  
  // Calculate Safe Area dimensions
  const safeAreaWidth = slideWidth - (SAFE_AREA_OFFSET_X * 2);
  const safeAreaHeight = slideHeight - (SAFE_AREA_OFFSET_Y * 2);
  
  // Create the Safe Area frame
  // IMPORTANT: When parentId is provided, x/y are RELATIVE to the parent
  const safeArea = await create_frame({
    x: SAFE_AREA_OFFSET_X,  // Relative to parent slide
    y: SAFE_AREA_OFFSET_Y,  // Relative to parent slide
    width: safeAreaWidth,    // 1696 for 1920 width
    height: safeAreaHeight,  // 888 for 1080 height
    name: "Safe Area",
    parentId: slideId,
    fillColor: { r: 0, g: 0, b: 0, a: 0 }, // Fully transparent
    strokeColor: { r: 1, g: 1, b: 1, a: 1 }, // White stroke
    strokeWeight: 1
  });
  
  return safeArea;
}

/**
 * Fixes existing misaligned Safe Area frames
 * @param {string} safeAreaId - The ID of the Safe Area frame to fix
 * @param {string} parentSlideId - The ID of the parent slide frame
 */
async function fixExistingSafeArea(safeAreaId, parentSlideId) {
  const SAFE_AREA_OFFSET_X = 112;
  const SAFE_AREA_OFFSET_Y = 96;
  
  // Move the Safe Area to the correct position
  // Note: x/y are relative to the node's current parent
  await move_node({
    nodeId: safeAreaId,
    x: SAFE_AREA_OFFSET_X,  // Relative to parent
    y: SAFE_AREA_OFFSET_Y   // Relative to parent
  });
  
  // Ensure correct styling
  await set_fill_color({
    nodeId: safeAreaId,
    color: { r: 0, g: 0, b: 0, a: 0 }  // Fully transparent
  });
  
  await set_stroke_color({
    nodeId: safeAreaId,
    color: { r: 1, g: 1, b: 1, a: 1 },  // White
    weight: 1
  });
}

// Example usage for the slides mentioned in the bug report
const slidesToFix = [
  { slideId: "65:1472", safeAreaId: "2014:261" },  // Slide 2
  { slideId: "53:795", safeAreaId: "2014:262" },   // Slide 3
  { slideId: "52:627", safeAreaId: "2014:263" },   // Slide 4
  { slideId: "5:320", safeAreaId: "2014:264" },    // Slide 5
  // ... add more slides as needed
];

// Fix all Safe Areas
async function fixAllSafeAreas() {
  for (const { slideId, safeAreaId } of slidesToFix) {
    try {
      await fixExistingSafeArea(safeAreaId, slideId);
      console.log(`Fixed Safe Area ${safeAreaId} in slide ${slideId}`);
    } catch (error) {
      console.error(`Failed to fix Safe Area ${safeAreaId}:`, error.message);
    }
  }
}

// Create new Safe Areas for slides that don't have them
async function createMissingSafeAreas() {
  const slidesNeedingSafeArea = [
    // Add slide IDs that need Safe Areas created
  ];
  
  for (const slideId of slidesNeedingSafeArea) {
    try {
      const safeArea = await createSafeArea(slideId);
      console.log(`Created Safe Area ${safeArea.id} for slide ${slideId}`);
    } catch (error) {
      console.error(`Failed to create Safe Area for slide ${slideId}:`, error.message);
    }
  }
}