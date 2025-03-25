import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { z } from "zod";
import WebSocket from 'ws';
import { v4 as uuidv4 } from 'uuid';

// Define TypeScript interfaces for Figma responses
interface FigmaResponse {
  id: string;
  result?: any;
  error?: string;
}

// WebSocket connection and request tracking
let ws: WebSocket | null = null;
const pendingRequests = new Map<string, {
  resolve: (value: unknown) => void;
  reject: (reason: unknown) => void;
  timeout: NodeJS.Timeout;
}>();

// Track which channel each client is in
let currentChannel: string | null = null;

// Create MCP server
const server = new McpServer({
  name: "TalkToFigmaMCP",
  version: "1.0.0",
});

// Document Info Tool
server.tool(
  "get_document_info",
  "Get detailed information about the current Figma document",
  {},
  async () => {
    try {
      const result = await sendCommandToFigma('get_document_info');
      return {
        content: [
          {
            type: "text",
            text: JSON.stringify(result, null, 2)
          }
        ]
      };
    } catch (error) {
      return {
        content: [
          {
            type: "text",
            text: `Error getting document info: ${error instanceof Error ? error.message : String(error)}`
          }
        ]
      };
    }
  }
);

// Selection Tool
server.tool(
  "get_selection",
  "Get information about the current selection in Figma",
  {},
  async () => {
    try {
      const result = await sendCommandToFigma('get_selection');
      return {
        content: [
          {
            type: "text",
            text: JSON.stringify(result, null, 2)
          }
        ]
      };
    } catch (error) {
      return {
        content: [
          {
            type: "text",
            text: `Error getting selection: ${error instanceof Error ? error.message : String(error)}`
          }
        ]
      };
    }
  }
);

// Node Info Tool
server.tool(
  "get_node_info",
  "Get detailed information about a specific node in Figma",
  {
    nodeId: z.string().describe("The ID of the node to get information about")
  },
  async ({ nodeId }) => {
    try {
      const result = await sendCommandToFigma('get_node_info', { nodeId });
      return {
        content: [
          {
            type: "text",
            text: JSON.stringify(result, null, 2)
          }
        ]
      };
    } catch (error) {
      return {
        content: [
          {
            type: "text",
            text: `Error getting node info: ${error instanceof Error ? error.message : String(error)}`
          }
        ]
      };
    }
  }
);

// Create Rectangle Tool
server.tool(
  "create_rectangle",
  "Create a new rectangle in Figma",
  {
    x: z.number().describe("X position"),
    y: z.number().describe("Y position"),
    width: z.number().describe("Width of the rectangle"),
    height: z.number().describe("Height of the rectangle"),
    name: z.string().optional().describe("Optional name for the rectangle"),
    parentId: z.string().optional().describe("Optional parent node ID to append the rectangle to")
  },
  async ({ x, y, width, height, name, parentId }) => {
    try {
      const result = await sendCommandToFigma('create_rectangle', {
        x, y, width, height, name: name || 'Rectangle', parentId
      });
      return {
        content: [
          {
            type: "text",
            text: `Created rectangle "${JSON.stringify(result)}"`
          }
        ]
      }
    } catch (error) {
      return {
        content: [
          {
            type: "text",
            text: `Error creating rectangle: ${error instanceof Error ? error.message : String(error)}`
          }
        ]
      };
    }
  }
);

// Create Frame Tool
server.tool(
  "create_frame",
  "Create a new frame in Figma",
  {
    x: z.number().describe("X position"),
    y: z.number().describe("Y position"),
    width: z.number().describe("Width of the frame"),
    height: z.number().describe("Height of the frame"),
    name: z.string().optional().describe("Optional name for the frame"),
    parentId: z.string().optional().describe("Optional parent node ID to append the frame to"),
    fillColor: z.object({
      r: z.number().min(0).max(1).describe("Red component (0-1)"),
      g: z.number().min(0).max(1).describe("Green component (0-1)"),
      b: z.number().min(0).max(1).describe("Blue component (0-1)"),
      a: z.number().min(0).max(1).optional().describe("Alpha component (0-1)")
    }).optional().describe("Fill color in RGBA format"),
    strokeColor: z.object({
      r: z.number().min(0).max(1).describe("Red component (0-1)"),
      g: z.number().min(0).max(1).describe("Green component (0-1)"),
      b: z.number().min(0).max(1).describe("Blue component (0-1)"),
      a: z.number().min(0).max(1).optional().describe("Alpha component (0-1)")
    }).optional().describe("Stroke color in RGBA format"),
    strokeWeight: z.number().positive().optional().describe("Stroke weight")
  },
  async ({ x, y, width, height, name, parentId, fillColor, strokeColor, strokeWeight }) => {
    try {
      const result = await sendCommandToFigma('create_frame', {
        x, y, width, height, name: name || 'Frame', parentId,
        fillColor: fillColor || { r: 1, g: 1, b: 1, a: 1 },
        strokeColor: strokeColor,
        strokeWeight: strokeWeight
      });
      const typedResult = result as { name: string, id: string };
      return {
        content: [
          {
            type: "text",
            text: `Created frame "${typedResult.name}" with ID: ${typedResult.id}. Use the ID as the parentId to appendChild inside this frame.`
          }
        ]
      };
    } catch (error) {
      return {
        content: [
          {
            type: "text",
            text: `Error creating frame: ${error instanceof Error ? error.message : String(error)}`
          }
        ]
      };
    }
  }
);

// Create Text Tool
server.tool(
  "create_text",
  "Create a new text element in Figma",
  {
    x: z.number().describe("X position"),
    y: z.number().describe("Y position"),
    text: z.string().describe("Text content"),
    fontSize: z.number().optional().describe("Font size (default: 14)"),
    fontWeight: z.number().optional().describe("Font weight (e.g., 400 for Regular, 700 for Bold)"),
    fontColor: z.object({
      r: z.number().min(0).max(1).describe("Red component (0-1)"),
      g: z.number().min(0).max(1).describe("Green component (0-1)"),
      b: z.number().min(0).max(1).describe("Blue component (0-1)"),
      a: z.number().min(0).max(1).optional().describe("Alpha component (0-1)")
    }).optional().describe("Font color in RGBA format"),
    name: z.string().optional().describe("Optional name for the text node by default following text"),
    parentId: z.string().optional().describe("Optional parent node ID to append the text to")
  },
  async ({ x, y, text, fontSize, fontWeight, fontColor, name, parentId }) => {
    try {
      const result = await sendCommandToFigma('create_text', {
        x, y, text,
        fontSize: fontSize || 14,
        fontWeight: fontWeight || 400,
        fontColor: fontColor || { r: 0, g: 0, b: 0, a: 1 },
        name: name || 'Text',
        parentId
      });
      const typedResult = result as { name: string, id: string };
      return {
        content: [
          {
            type: "text",
            text: `Created text "${typedResult.name}" with ID: ${typedResult.id}`
          }
        ]
      };
    } catch (error) {
      return {
        content: [
          {
            type: "text",
            text: `Error creating text: ${error instanceof Error ? error.message : String(error)}`
          }
        ]
      };
    }
  }
);

// Set Fill Color Tool
server.tool(
  "set_fill_color",
  "Set the fill color of a node in Figma can be TextNode or FrameNode",
  {
    nodeId: z.string().describe("The ID of the node to modify"),
    r: z.number().min(0).max(1).describe("Red component (0-1)"),
    g: z.number().min(0).max(1).describe("Green component (0-1)"),
    b: z.number().min(0).max(1).describe("Blue component (0-1)"),
    a: z.number().min(0).max(1).optional().describe("Alpha component (0-1)")
  },
  async ({ nodeId, r, g, b, a }) => {
    try {
      const result = await sendCommandToFigma('set_fill_color', {
        nodeId,
        color: { r, g, b, a: a || 1 }
      });
      const typedResult = result as { name: string };
      return {
        content: [
          {
            type: "text",
            text: `Set fill color of node "${typedResult.name}" to RGBA(${r}, ${g}, ${b}, ${a || 1})`
          }
        ]
      };
    } catch (error) {
      return {
        content: [
          {
            type: "text",
            text: `Error setting fill color: ${error instanceof Error ? error.message : String(error)}`
          }
        ]
      };
    }
  }
);

// Set Stroke Color Tool
server.tool(
  "set_stroke_color",
  "Set the stroke color of a node in Figma",
  {
    nodeId: z.string().describe("The ID of the node to modify"),
    r: z.number().min(0).max(1).describe("Red component (0-1)"),
    g: z.number().min(0).max(1).describe("Green component (0-1)"),
    b: z.number().min(0).max(1).describe("Blue component (0-1)"),
    a: z.number().min(0).max(1).optional().describe("Alpha component (0-1)"),
    weight: z.number().positive().optional().describe("Stroke weight")
  },
  async ({ nodeId, r, g, b, a, weight }) => {
    try {
      const result = await sendCommandToFigma('set_stroke_color', {
        nodeId,
        color: { r, g, b, a: a || 1 },
        weight: weight || 1
      });
      const typedResult = result as { name: string };
      return {
        content: [
          {
            type: "text",
            text: `Set stroke color of node "${typedResult.name}" to RGBA(${r}, ${g}, ${b}, ${a || 1}) with weight ${weight || 1}`
          }
        ]
      };
    } catch (error) {
      return {
        content: [
          {
            type: "text",
            text: `Error setting stroke color: ${error instanceof Error ? error.message : String(error)}`
          }
        ]
      };
    }
  }
);

// Move Node Tool
server.tool(
  "move_node",
  "Move a node to a new position in Figma",
  {
    nodeId: z.string().describe("The ID of the node to move"),
    x: z.number().describe("New X position"),
    y: z.number().describe("New Y position")
  },
  async ({ nodeId, x, y }) => {
    try {
      const result = await sendCommandToFigma('move_node', { nodeId, x, y });
      const typedResult = result as { name: string };
      return {
        content: [
          {
            type: "text",
            text: `Moved node "${typedResult.name}" to position (${x}, ${y})`
          }
        ]
      };
    } catch (error) {
      return {
        content: [
          {
            type: "text",
            text: `Error moving node: ${error instanceof Error ? error.message : String(error)}`
          }
        ]
      };
    }
  }
);

// Resize Node Tool
server.tool(
  "resize_node",
  "Resize a node in Figma",
  {
    nodeId: z.string().describe("The ID of the node to resize"),
    width: z.number().positive().describe("New width"),
    height: z.number().positive().describe("New height")
  },
  async ({ nodeId, width, height }) => {
    try {
      const result = await sendCommandToFigma('resize_node', { nodeId, width, height });
      const typedResult = result as { name: string };
      return {
        content: [
          {
            type: "text",
            text: `Resized node "${typedResult.name}" to width ${width} and height ${height}`
          }
        ]
      };
    } catch (error) {
      return {
        content: [
          {
            type: "text",
            text: `Error resizing node: ${error instanceof Error ? error.message : String(error)}`
          }
        ]
      };
    }
  }
);

// Delete Node Tool
server.tool(
  "delete_node",
  "Delete a node from Figma",
  {
    nodeId: z.string().describe("The ID of the node to delete")
  },
  async ({ nodeId }) => {
    try {
      await sendCommandToFigma('delete_node', { nodeId });
      return {
        content: [
          {
            type: "text",
            text: `Deleted node with ID: ${nodeId}`
          }
        ]
      };
    } catch (error) {
      return {
        content: [
          {
            type: "text",
            text: `Error deleting node: ${error instanceof Error ? error.message : String(error)}`
          }
        ]
      };
    }
  }
);

// Get Styles Tool
server.tool(
  "get_styles",
  "Get all styles from the current Figma document",
  {},
  async () => {
    try {
      const result = await sendCommandToFigma('get_styles');
      return {
        content: [
          {
            type: "text",
            text: JSON.stringify(result, null, 2)
          }
        ]
      };
    } catch (error) {
      return {
        content: [
          {
            type: "text",
            text: `Error getting styles: ${error instanceof Error ? error.message : String(error)}`
          }
        ]
      };
    }
  }
);

// Get Local Components Tool
server.tool(
  "get_local_components",
  "Get all local components from the Figma document",
  {},
  async () => {
    try {
      const result = await sendCommandToFigma('get_local_components');
      return {
        content: [
          {
            type: "text",
            text: JSON.stringify(result, null, 2)
          }
        ]
      };
    } catch (error) {
      return {
        content: [
          {
            type: "text",
            text: `Error getting local components: ${error instanceof Error ? error.message : String(error)}`
          }
        ]
      };
    }
  }
);

// Get Team Components Tool
// server.tool(
//   "get_team_components",
//   "Get all team library components available in Figma",
//   {},
//   async () => {
//     try {
//       const result = await sendCommandToFigma('get_team_components');
//       return {
//         content: [
//           {
//             type: "text",
//             text: JSON.stringify(result, null, 2)
//           }
//         ]
//       };
//     } catch (error) {
//       return {
//         content: [
//           {
//             type: "text",
//             text: `Error getting team components: ${error instanceof Error ? error.message : String(error)}`
//           }
//         ]
//       };
//     }
//   }
// );

// Create Component Instance Tool
server.tool(
  "create_component_instance",
  "Create an instance of a component in Figma",
  {
    componentKey: z.string().describe("Key of the component to instantiate"),
    x: z.number().describe("X position"),
    y: z.number().describe("Y position")
  },
  async ({ componentKey, x, y }) => {
    try {
      const result = await sendCommandToFigma('create_component_instance', { componentKey, x, y });
      const typedResult = result as { name: string, id: string };
      return {
        content: [
          {
            type: "text",
            text: `Created component instance "${typedResult.name}" with ID: ${typedResult.id}`
          }
        ]
      };
    } catch (error) {
      return {
        content: [
          {
            type: "text",
            text: `Error creating component instance: ${error instanceof Error ? error.message : String(error)}`
          }
        ]
      };
    }
  }
);

// Export Node as Image Tool
server.tool(
  "export_node_as_image",
  "Export a node as an image from Figma",
  {
    nodeId: z.string().describe("The ID of the node to export"),
    format: z.enum(["PNG", "JPG", "SVG", "PDF"]).optional().describe("Export format"),
    scale: z.number().positive().optional().describe("Export scale")
  },
  async ({ nodeId, format, scale }) => {
    try {
      const result = await sendCommandToFigma('export_node_as_image', {
        nodeId,
        format: format || 'PNG',
        scale: scale || 1
      });
      const typedResult = result as { imageData: string, mimeType: string };

      return {
        content: [
          {
            type: "image",
            data: typedResult.imageData,
            mimeType: typedResult.mimeType || "image/png"
          }
        ]
      };
    } catch (error) {
      return {
        content: [
          {
            type: "text",
            text: `Error exporting node as image: ${error instanceof Error ? error.message : String(error)}`
          }
        ]
      };
    }
  }
);

// Execute Figma Code Tool
// server.tool(
//   "execute_figma_code",
//   "Execute arbitrary JavaScript code in Figma (use with caution)",
//   {
//     code: z.string().describe("JavaScript code to execute in Figma")
//   },
//   async ({ code }) => {
//     try {
//       const result = await sendCommandToFigma('execute_code', { code });
//       return {
//         content: [
//           {
//             type: "text",
//             text: `Code executed successfully: ${JSON.stringify(result, null, 2)}`
//           }
//         ]
//       };
//     } catch (error) {
//       return {
//         content: [
//           {
//             type: "text",
//             text: `Error executing code: ${error instanceof Error ? error.message : String(error)}`
//           }
//         ]
//       };
//     }
//   }
// );

// Set Corner Radius Tool
server.tool(
  "set_corner_radius",
  "Set the corner radius of a node in Figma",
  {
    nodeId: z.string().describe("The ID of the node to modify"),
    radius: z.number().min(0).describe("Corner radius value"),
    corners: z.array(z.boolean()).length(4).optional().describe("Optional array of 4 booleans to specify which corners to round [topLeft, topRight, bottomRight, bottomLeft]")
  },
  async ({ nodeId, radius, corners }) => {
    try {
      const result = await sendCommandToFigma('set_corner_radius', {
        nodeId,
        radius,
        corners: corners || [true, true, true, true]
      });
      const typedResult = result as { name: string };
      return {
        content: [
          {
            type: "text",
            text: `Set corner radius of node "${typedResult.name}" to ${radius}px`
          }
        ]
      };
    } catch (error) {
      return {
        content: [
          {
            type: "text",
            text: `Error setting corner radius: ${error instanceof Error ? error.message : String(error)}`
          }
        ]
      };
    }
  }
);

// Define design strategy prompt
server.prompt(
  "design_strategy",
  "Best practices for working with Figma designs",
  (extra) => {
    return {
      messages: [
        {
          role: "assistant",
          content: {
            type: "text",
            text: `When working with Figma designs, follow these best practices:

1. Start with Document Structure:
   - First use get_document_info() to understand the current document
   - Plan your layout hierarchy before creating elements
   - Create a main container frame for each screen/section

2. Naming Conventions:
   - Use descriptive, semantic names for all elements
   - Follow a consistent naming pattern (e.g., "Login Screen", "Logo Container", "Email Input")
   - Group related elements with meaningful names

3. Layout Hierarchy:
   - Create parent frames first, then add child elements
   - For forms/login screens:
     * Start with the main screen container frame
     * Create a logo container at the top
     * Group input fields in their own containers
     * Place action buttons (login, submit) after inputs
     * Add secondary elements (forgot password, signup links) last

4. Input Fields Structure:
   - Create a container frame for each input field
   - Include a label text above or inside the input
   - Group related inputs (e.g., username/password) together

5. Element Creation:
   - Use create_frame() for containers and input fields
   - Use create_text() for labels, buttons text, and links
   - Set appropriate colors and styles:
     * Use fillColor for backgrounds
     * Use strokeColor for borders
     * Set proper fontWeight for different text elements

6. Visual Hierarchy:
   - Position elements in logical reading order (top to bottom)
   - Maintain consistent spacing between elements
   - Use appropriate font sizes for different text types:
     * Larger for headings/welcome text
     * Medium for input labels
     * Standard for button text
     * Smaller for helper text/links

7. Best Practices:
   - Verify each creation with get_node_info()
   - Use parentId to maintain proper hierarchy
   - Group related elements together in frames
   - Keep consistent spacing and alignment

Example Login Screen Structure:
- Login Screen (main frame)
  - Logo Container (frame)
    - Logo (image/text)
  - Welcome Text (text)
  - Input Container (frame)
    - Email Input (frame)
      - Email Label (text)
      - Email Field (frame)
    - Password Input (frame)
      - Password Label (text)
      - Password Field (frame)
  - Login Button (frame)
    - Button Text (text)
  - Helper Links (frame)
    - Forgot Password (text)
    - Don't have account (text)`
          }
        }
      ],
      description: "Best practices for working with Figma designs"
    };
  }
);

// 텍스트 노드 스캐닝 도구 추가
server.tool(
  "scan_text_nodes",
  "Scan all text nodes in the selected Figma node",
  {
    nodeId: z.string().describe("ID of the node to scan")
  },
  async ({ nodeId }) => {
    try {
      const result = await sendCommandToFigma('scan_text_nodes', { nodeId });
      return {
        content: [
          {
            type: "text",
            text: JSON.stringify(result, null, 2)
          }
        ]
      };
    } catch (error) {
      return {
        content: [
          {
            type: "text",
            text: `Error scanning text nodes: ${error instanceof Error ? error.message : String(error)}`
          }
        ]
      };
    }
  }
);

// 텍스트 노드 주석 추가 도구
server.tool(
  "add_text_annotations",
  "Add annotations to text nodes",
  {
    nodeId: z.string().describe("ID of the parent node containing text nodes"),
    annotationStyle: z.enum(["speech_bubble", "side_note", "highlight"]).optional().describe("Style of annotations to add"),
    includeFrames: z.boolean().optional().describe("Whether to create a report frame")
  },
  async ({ nodeId, annotationStyle, includeFrames }) => {
    try {
      const result = await sendCommandToFigma('add_text_annotations', { 
        nodeId, 
        annotationStyle: annotationStyle || "speech_bubble",
        includeFrames: includeFrames !== false
      });
      return {
        content: [
          {
            type: "text",
            text: JSON.stringify(result, null, 2)
          }
        ]
      };
    } catch (error) {
      return {
        content: [
          {
            type: "text",
            text: `Error adding text annotations: ${error instanceof Error ? error.message : String(error)}`
          }
        ]
      };
    }
  }
);

// UX 텍스트 분석 도구
server.tool(
  "analyze_ux_text",
  "Analyze UX text for quality and consistency",
  {
    nodeId: z.string().describe("ID of the parent node containing text to analyze"),
    criteria: z.array(z.string()).optional().describe("Specific criteria to analyze (e.g., ['clarity', 'consistency', 'tone'])")
  },
  async ({ nodeId, criteria }) => {
    try {
      const result = await sendCommandToFigma('analyze_ux_text', { 
        nodeId,
        criteria: criteria || ["clarity", "consistency", "tone", "action-oriented", "accessibility"]
      });
      return {
        content: [
          {
            type: "text",
            text: JSON.stringify(result, null, 2)
          }
        ]
      };
    } catch (error) {
      return {
        content: [
          {
            type: "text",
            text: `Error analyzing UX text: ${error instanceof Error ? error.message : String(error)}`
          }
        ]
      };
    }
  }
);

// UX 리포트 생성 도구
server.tool(
  "generate_ux_report",
  "Generate a UX writing report as a Figma frame",
  {
    nodeId: z.string().describe("ID of the node to generate report for"),
    reportTitle: z.string().optional().describe("Title of the report"),
    includeScreenshots: z.boolean().optional().describe("Whether to include screenshots in the report"),
    reportStyle: z.enum(["minimal", "detailed", "visual"]).optional().describe("Style of the report"),
    position: z.object({
      x: z.number().describe("X position for the report frame"),
      y: z.number().describe("Y position for the report frame")
    }).optional().describe("Position of the report frame")
  },
  async ({ nodeId, reportTitle, includeScreenshots, reportStyle, position }) => {
    try {
      const result = await sendCommandToFigma('generate_ux_report', { 
        nodeId,
        reportTitle: reportTitle || "UX Writing Analysis Report",
        includeScreenshots: includeScreenshots !== false,
        reportStyle: reportStyle || "detailed",
        position: position || { x: 100, y: 100 }
      });
      return {
        content: [
          {
            type: "text",
            text: JSON.stringify(result, null, 2)
          }
        ]
      };
    } catch (error) {
      return {
        content: [
          {
            type: "text",
            text: `Error generating UX report: ${error instanceof Error ? error.message : String(error)}`
          }
        ]
      };
    }
  }
);

// 텍스트 최적화 도구
server.tool(
  "optimize_ux_text",
  "Optimize UX writing for selected text nodes",
  {
    nodeId: z.string().describe("ID of the text node to optimize"),
    optimizationType: z.enum(["clarity", "conciseness", "friendliness", "technical", "persuasive"]).optional().describe("Type of optimization to apply"),
    customInstructions: z.string().optional().describe("Custom instructions for optimization"),
    applyChanges: z.boolean().optional().describe("Whether to apply changes directly")
  },
  async ({ nodeId, optimizationType, customInstructions, applyChanges }) => {
    try {
      const result = await sendCommandToFigma('optimize_ux_text', { 
        nodeId, 
        optimizationType: optimizationType || "clarity",
        customInstructions: customInstructions || "",
        applyChanges: applyChanges !== false
      });
      return {
        content: [
          {
            type: "text",
            text: JSON.stringify(result, null, 2)
          }
        ]
      };
    } catch (error) {
      return {
        content: [
          {
            type: "text",
            text: `Error optimizing UX text: ${error instanceof Error ? error.message : String(error)}`
          }
        ]
      };
    }
  }
);

// 로컬라이징 도구
server.tool(
  "localize_text",
  "Localize text nodes to different languages",
  {
    nodeId: z.string().describe("ID of the node containing text to localize"),
    languages: z.array(z.string()).describe("Array of language codes to translate to"),
    createVisualFrame: z.boolean().optional().describe("Whether to create a visual frame with translations"),
    adaptLayout: z.boolean().optional().describe("Whether to adapt layout for localized text")
  },
  async ({ nodeId, languages, createVisualFrame, adaptLayout }) => {
    try {
      const result = await sendCommandToFigma('localize_text', { 
        nodeId, 
        languages,
        createVisualFrame: createVisualFrame !== false,
        adaptLayout: adaptLayout === true
      });
      return {
        content: [
          {
            type: "text",
            text: JSON.stringify(result, null, 2)
          }
        ]
      };
    } catch (error) {
      return {
        content: [
          {
            type: "text",
            text: `Error localizing text: ${error instanceof Error ? error.message : String(error)}`
          }
        ]
      };
    }
  }
);

// Define command types and parameters
type FigmaCommand =
  | 'get_document_info'
  | 'get_selection'
  | 'get_node_info'
  | 'create_rectangle'
  | 'create_frame'
  | 'create_text'
  | 'set_fill_color'
  | 'set_stroke_color'
  | 'move_node'
  | 'resize_node'
  | 'delete_node'
  | 'get_styles'
  | 'get_local_components'
  | 'get_team_components'
  | 'create_component_instance'
  | 'export_node_as_image'
  | 'execute_code'
  | 'join'
  | 'set_corner_radius'
  | 'scan_text_nodes'
  | 'add_text_annotations'
  | 'analyze_ux_text'
  | 'generate_ux_report'
  | 'optimize_ux_text'
  | 'localize_text';

// Helper function to process Figma node responses
function processFigmaNodeResponse(result: unknown): any {
  if (!result || typeof result !== 'object') {
    return result;
  }

  // Check if this looks like a node response
  const resultObj = result as Record<string, unknown>;
  if ('id' in resultObj && typeof resultObj.id === 'string') {
    // It appears to be a node response, log the details
    console.info(`Processed Figma node: ${resultObj.name || 'Unknown'} (ID: ${resultObj.id})`);

    if ('x' in resultObj && 'y' in resultObj) {
      console.debug(`Node position: (${resultObj.x}, ${resultObj.y})`);
    }

    if ('width' in resultObj && 'height' in resultObj) {
      console.debug(`Node dimensions: ${resultObj.width}×${resultObj.height}`);
    }
  }

  return result;
}

// Simple function to connect to Figma WebSocket server
function connectToFigma(port: number = 3055) {
  // If already connected, do nothing
  if (ws && ws.readyState === WebSocket.OPEN) {
    console.info('Already connected to Figma');
    return;
  }

  console.info(`Connecting to Figma socket server on port ${port}...`);
  ws = new WebSocket(`ws://localhost:${port}`);

  ws.on('open', () => {
    console.info('Connected to Figma socket server');
    // Reset channel on new connection
    currentChannel = null;
  });

  ws.on('message', (data: any) => {
    try {
      const json = JSON.parse(data) as { message: FigmaResponse };
      const myResponse = json.message;
      console.debug(`Received message: ${JSON.stringify(myResponse)}`);
      console.log('myResponse', myResponse);

      // Handle response to a request
      if (myResponse.id && pendingRequests.has(myResponse.id) && myResponse.result) {
        const request = pendingRequests.get(myResponse.id)!;
        clearTimeout(request.timeout);

        if (myResponse.error) {
          console.error(`Error from Figma: ${myResponse.error}`);
          request.reject(new Error(myResponse.error));
        } else {
          if (myResponse.result) {
            request.resolve(myResponse.result);
          }
        }

        pendingRequests.delete(myResponse.id);
      } else {
        // Handle broadcast messages or events
        console.info(`Received broadcast message: ${JSON.stringify(myResponse)}`);
      }
    } catch (error) {
      console.error(`Error parsing message: ${error instanceof Error ? error.message : String(error)}`);
    }
  });

  ws.on('error', (error) => {
    console.error(`Socket error: ${error}`);
  });

  ws.on('close', () => {
    console.info('Disconnected from Figma socket server');
    ws = null;

    // Reject all pending requests
    for (const [id, request] of pendingRequests.entries()) {
      clearTimeout(request.timeout);
      request.reject(new Error('Connection closed'));
      pendingRequests.delete(id);
    }

    // Attempt to reconnect
    console.info('Attempting to reconnect in 2 seconds...');
    setTimeout(() => connectToFigma(port), 2000);
  });
}

// Function to join a channel
async function joinChannel(channelName: string): Promise<void> {
  if (!ws || ws.readyState !== WebSocket.OPEN) {
    throw new Error('Not connected to Figma');
  }

  try {
    await sendCommandToFigma('join', { channel: channelName });
    currentChannel = channelName;
    console.info(`Joined channel: ${channelName}`);
  } catch (error) {
    console.error(`Failed to join channel: ${error instanceof Error ? error.message : String(error)}`);
    throw error;
  }
}

// Function to send commands to Figma
function sendCommandToFigma(command: FigmaCommand, params: unknown = {}): Promise<unknown> {
  return new Promise((resolve, reject) => {
    // If not connected, try to connect first
    if (!ws || ws.readyState !== WebSocket.OPEN) {
      connectToFigma();
      reject(new Error('Not connected to Figma. Attempting to connect...'));
      return;
    }

    // Check if we need a channel for this command
    const requiresChannel = command !== 'join';
    if (requiresChannel && !currentChannel) {
      reject(new Error('Must join a channel before sending commands'));
      return;
    }

    const id = uuidv4();
    const request = {
      id,
      type: command === 'join' ? 'join' : 'message',
      ...(command === 'join' ? { channel: (params as any).channel } : { channel: currentChannel }),
      message: {
        id,
        command,
        params: {
          ...(params as any),
        }
      }
    };

    // Set timeout for request
    const timeout = setTimeout(() => {
      if (pendingRequests.has(id)) {
        pendingRequests.delete(id);
        console.error(`Request ${id} to Figma timed out after 30 seconds`);
        reject(new Error('Request to Figma timed out'));
      }
    }, 30000); // 30 second timeout

    // Store the promise callbacks to resolve/reject later
    pendingRequests.set(id, { resolve, reject, timeout });

    // Send the request
    console.info(`Sending command to Figma: ${command}`);
    console.debug(`Request details: ${JSON.stringify(request)}`);
    ws.send(JSON.stringify(request));
  });
}

// Update the join_channel tool
server.tool(
  "join_channel",
  "Join a specific channel to communicate with Figma",
  {
    channel: z.string().describe("The name of the channel to join").default("")
  },
  async ({ channel }) => {
    try {
      if (!channel) {
        // If no channel provided, ask the user for input
        return {
          content: [
            {
              type: "text",
              text: "Please provide a channel name to join:"
            }
          ],
          followUp: {
            tool: "join_channel",
            description: "Join the specified channel"
          }
        };
      }

      await joinChannel(channel);
      return {
        content: [
          {
            type: "text",
            text: `Successfully joined channel: ${channel}`
          }
        ]
      };
    } catch (error) {
      return {
        content: [
          {
            type: "text",
            text: `Error joining channel: ${error instanceof Error ? error.message : String(error)}`
          }
        ]
      };
    }
  }
);

// Start the server
async function main() {
  try {
    // Try to connect to Figma socket server
    connectToFigma();
  } catch (error) {
    console.warn(`Could not connect to Figma initially: ${error instanceof Error ? error.message : String(error)}`);
    console.warn('Will try to connect when the first command is sent');
  }

  // Start the MCP server with stdio transport
  const transport = new StdioServerTransport();
  await server.connect(transport);
  console.info('FigmaMCP server running on stdio');
}

// Run the server
main().catch(error => {
  console.error(`Error starting FigmaMCP server: ${error instanceof Error ? error.message : String(error)}`);
  process.exit(1);
});