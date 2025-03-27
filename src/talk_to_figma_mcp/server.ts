import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { z } from "zod";
import WebSocket from "ws";
import { v4 as uuidv4 } from "uuid";
import http from "http";
import crypto from "crypto";
import fs from "fs";
import path from "path";

// Define TypeScript interfaces for Figma responses
interface FigmaResponse {
  id: string;
  result?: any;
  error?: string;
}

// Define interface for image export results
interface ImageExportResult {
  imageData: string;
  mimeType: string;
}

// WebSocket connection and request tracking
let ws: WebSocket | null = null;
const pendingRequests = new Map<
  string,
  {
    resolve: (value: unknown) => void;
    reject: (reason: unknown) => void;
    timeout: ReturnType<typeof setTimeout>;
  }
>();

// Track which channel each client is in
let currentChannel: string | null = null;

// 인메모리 이미지 저장소
interface StoredImage {
  id: string;
  data: Uint8Array;
  mimeType: string;
  createdAt: number;
}

// 이미지를 저장할 맵
const imageStore = new Map<string, StoredImage>();

// 이미지 저장소 포트
const IMAGE_SERVER_PORT = 3056;

// 구조화된 이미지 저장을 위한 상수
const IMAGE_BASE_DIR = path.join(process.cwd(), "figma-exports");

// 구조화된 폴더 생성 함수
function createDirectoryStructure(documentId: string, pageId?: string): string {
  // 기본 디렉토리 생성
  if (!fs.existsSync(IMAGE_BASE_DIR)) {
    fs.mkdirSync(IMAGE_BASE_DIR, { recursive: true });
  }

  // 문서 ID 폴더
  const docDir = path.join(IMAGE_BASE_DIR, documentId);
  if (!fs.existsSync(docDir)) {
    fs.mkdirSync(docDir, { recursive: true });
  }

  // 날짜 폴더 (YYYY-MM-DD 형식)
  const today = new Date();
  const dateStr = today.toISOString().split("T")[0]; // YYYY-MM-DD
  const dateDir = path.join(docDir, dateStr);
  if (!fs.existsSync(dateDir)) {
    fs.mkdirSync(dateDir, { recursive: true });
  }

  // 페이지 ID 폴더 (있는 경우)
  if (pageId) {
    const pageDir = path.join(dateDir, pageId);
    if (!fs.existsSync(pageDir)) {
      fs.mkdirSync(pageDir, { recursive: true });
    }
    return pageDir;
  }

  return dateDir;
}

// 이미지 파일 저장 함수
function saveImageToFile(
  imageId: string,
  data: Uint8Array,
  documentId: string,
  pageId?: string
): string {
  const targetDir = createDirectoryStructure(documentId, pageId);
  const filePath = path.join(targetDir, `${imageId}.png`);

  fs.writeFileSync(filePath, Buffer.from(data));
  console.log(`[SERVER] Image saved to file: ${filePath}`);

  return filePath;
}

// 이미지 저장 함수 업데이트
function storeImage(
  data: Uint8Array,
  mimeType: string,
  documentId?: string,
  pageId?: string,
  nodeName?: string
): string {
  const imageId = crypto.randomBytes(16).toString("hex");

  // 인메모리 저장
  imageStore.set(imageId, {
    id: imageId,
    data,
    mimeType,
    createdAt: Date.now(),
  });

  // 파일 시스템에 저장 (문서 ID가 제공된 경우)
  let filePath = null;
  if (documentId) {
    filePath = saveImageToFile(imageId, data, documentId, pageId);
  }

  return imageId;
}

// 이미지를 저장할 맵
const imageServer = http.createServer((req, res) => {
  const url = new URL(req.url || "/", `http://${req.headers.host}`);
  const pathname = url.pathname;

  // CORS 헤더 설정
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
  res.setHeader(
    "Access-Control-Allow-Headers",
    "Content-Type, X-Mime-Type, X-Image-Format, X-Node-ID, X-Node-Name"
  );

  // OPTIONS 요청 처리 (CORS preflight)
  if (req.method === "OPTIONS") {
    res.writeHead(204);
    res.end();
    return;
  }

  // 업로드 엔드포인트: /upload (POST)
  if (pathname === "/upload" && req.method === "POST") {
    console.log(`[SERVER] Received image upload request`);

    const chunks: Buffer[] = [];

    // 데이터 수신
    req.on("data", (chunk) => {
      chunks.push(Buffer.from(chunk));
    });

    // 데이터 처리
    req.on("end", () => {
      try {
        // 전체 데이터 합치기
        const buffer = Buffer.concat(chunks);
        const mimeType = (req.headers["x-mime-type"] as string) || "image/png";
        const format = (req.headers["x-image-format"] as string) || "png";
        const nodeId = (req.headers["x-node-id"] as string) || "unknown";
        const nodeName = (req.headers["x-node-name"] as string) || "image";
        const documentId = req.headers["x-document-id"] as string;
        const pageId = req.headers["x-page-id"] as string;

        console.log(
          `[SERVER] Received ${buffer.length} bytes, mime type: ${mimeType}`
        );

        // 인메모리 저장소에 저장 및 파일로 저장
        const imageId = storeImage(
          new Uint8Array(buffer),
          mimeType,
          documentId,
          pageId,
          nodeName
        );
        const imageUrl = `http://localhost:${IMAGE_SERVER_PORT}/images/${imageId}`;

        // 구조화된 파일 경로 (있는 경우)
        let filePath = null;
        if (documentId) {
          const targetDir = createDirectoryStructure(documentId, pageId);
          filePath = path.join(targetDir, `${imageId}.png`);
        }

        // 응답 반환
        res.writeHead(200, { "Content-Type": "application/json" });
        res.end(
          JSON.stringify({
            success: true,
            imageId: imageId,
            imageUrl: imageUrl,
            filePath: filePath,
          })
        );
      } catch (error) {
        console.error(`[SERVER] Error processing upload:`, error);
        res.writeHead(500, { "Content-Type": "application/json" });
        res.end(
          JSON.stringify({
            success: false,
            error: error instanceof Error ? error.message : String(error),
          })
        );
      }
    });

    // 오류 처리
    req.on("error", (error) => {
      console.error(`[SERVER] Upload request error:`, error);
      res.writeHead(500, { "Content-Type": "application/json" });
      res.end(
        JSON.stringify({
          success: false,
          error: error.message,
        })
      );
    });

    return;
  }

  // 이미지 엔드포인트: /images/{imageId}
  if (pathname.startsWith("/images/")) {
    const imageId = pathname.substring("/images/".length);
    const image = imageStore.get(imageId);

    if (!image) {
      res.writeHead(404);
      res.end("Image not found");
      return;
    }

    res.writeHead(200, {
      "Content-Type": image.mimeType,
      "Content-Length": image.data.length,
      "Cache-Control": "max-age=3600",
    });
    res.end(Buffer.from(image.data));
    return;
  }

  // 기본 응답
  res.writeHead(404);
  res.end("Not found");
});

// 오래된 이미지 정리 (1시간마다)
setInterval(() => {
  const now = Date.now();
  const ONE_HOUR = 60 * 60 * 1000;

  for (const [id, image] of imageStore.entries()) {
    if (now - image.createdAt > ONE_HOUR) {
      imageStore.delete(id);
      console.log(`Removed old image: ${id}`);
    }
  }
}, 60 * 60 * 1000);

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
      const result = await sendCommandToFigma("get_document_info");
      return {
        content: [
          {
            type: "text",
            text: JSON.stringify(result, null, 2),
          },
        ],
      };
    } catch (error) {
      return {
        content: [
          {
            type: "text",
            text: `Error getting document info: ${
              error instanceof Error ? error.message : String(error)
            }`,
          },
        ],
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
      const result = await sendCommandToFigma("get_selection");
      return {
        content: [
          {
            type: "text",
            text: JSON.stringify(result, null, 2),
          },
        ],
      };
    } catch (error) {
      return {
        content: [
          {
            type: "text",
            text: `Error getting selection: ${
              error instanceof Error ? error.message : String(error)
            }`,
          },
        ],
      };
    }
  }
);

// Node Info Tool
server.tool(
  "get_node_info",
  "Get detailed information about a specific node in Figma",
  {
    nodeId: z.string().describe("The ID of the node to get information about"),
  },
  async ({ nodeId }) => {
    try {
      const result = await sendCommandToFigma("get_node_info", { nodeId });
      return {
        content: [
          {
            type: "text",
            text: JSON.stringify(result, null, 2),
          },
        ],
      };
    } catch (error) {
      return {
        content: [
          {
            type: "text",
            text: `Error getting node info: ${
              error instanceof Error ? error.message : String(error)
            }`,
          },
        ],
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
    parentId: z
      .string()
      .optional()
      .describe("Optional parent node ID to append the rectangle to"),
  },
  async ({ x, y, width, height, name, parentId }) => {
    try {
      const result = await sendCommandToFigma("create_rectangle", {
        x,
        y,
        width,
        height,
        name: name || "Rectangle",
        parentId,
      });
      return {
        content: [
          {
            type: "text",
            text: `Created rectangle "${JSON.stringify(result)}"`,
          },
        ],
      };
    } catch (error) {
      return {
        content: [
          {
            type: "text",
            text: `Error creating rectangle: ${
              error instanceof Error ? error.message : String(error)
            }`,
          },
        ],
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
    parentId: z
      .string()
      .optional()
      .describe("Optional parent node ID to append the frame to"),
    fillColor: z
      .object({
        r: z.number().min(0).max(1).describe("Red component (0-1)"),
        g: z.number().min(0).max(1).describe("Green component (0-1)"),
        b: z.number().min(0).max(1).describe("Blue component (0-1)"),
        a: z
          .number()
          .min(0)
          .max(1)
          .optional()
          .describe("Alpha component (0-1)"),
      })
      .optional()
      .describe("Fill color in RGBA format"),
    strokeColor: z
      .object({
        r: z.number().min(0).max(1).describe("Red component (0-1)"),
        g: z.number().min(0).max(1).describe("Green component (0-1)"),
        b: z.number().min(0).max(1).describe("Blue component (0-1)"),
        a: z
          .number()
          .min(0)
          .max(1)
          .optional()
          .describe("Alpha component (0-1)"),
      })
      .optional()
      .describe("Stroke color in RGBA format"),
    strokeWeight: z.number().positive().optional().describe("Stroke weight"),
  },
  async ({
    x,
    y,
    width,
    height,
    name,
    parentId,
    fillColor,
    strokeColor,
    strokeWeight,
  }) => {
    try {
      const result = await sendCommandToFigma("create_frame", {
        x,
        y,
        width,
        height,
        name: name || "Frame",
        parentId,
        fillColor: fillColor || { r: 1, g: 1, b: 1, a: 1 },
        strokeColor: strokeColor,
        strokeWeight: strokeWeight,
      });
      const typedResult = result as { name: string; id: string };
      return {
        content: [
          {
            type: "text",
            text: `Created frame "${typedResult.name}" with ID: ${typedResult.id}. Use the ID as the parentId to appendChild inside this frame.`,
          },
        ],
      };
    } catch (error) {
      return {
        content: [
          {
            type: "text",
            text: `Error creating frame: ${
              error instanceof Error ? error.message : String(error)
            }`,
          },
        ],
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
    fontWeight: z
      .number()
      .optional()
      .describe("Font weight (e.g., 400 for Regular, 700 for Bold)"),
    fontColor: z
      .object({
        r: z.number().min(0).max(1).describe("Red component (0-1)"),
        g: z.number().min(0).max(1).describe("Green component (0-1)"),
        b: z.number().min(0).max(1).describe("Blue component (0-1)"),
        a: z
          .number()
          .min(0)
          .max(1)
          .optional()
          .describe("Alpha component (0-1)"),
      })
      .optional()
      .describe("Font color in RGBA format"),
    name: z
      .string()
      .optional()
      .describe("Optional name for the text node by default following text"),
    parentId: z
      .string()
      .optional()
      .describe("Optional parent node ID to append the text to"),
  },
  async ({ x, y, text, fontSize, fontWeight, fontColor, name, parentId }) => {
    try {
      const result = await sendCommandToFigma("create_text", {
        x,
        y,
        text,
        fontSize: fontSize || 14,
        fontWeight: fontWeight || 400,
        fontColor: fontColor || { r: 0, g: 0, b: 0, a: 1 },
        name: name || "Text",
        parentId,
      });
      const typedResult = result as { name: string; id: string };
      return {
        content: [
          {
            type: "text",
            text: `Created text "${typedResult.name}" with ID: ${typedResult.id}`,
          },
        ],
      };
    } catch (error) {
      return {
        content: [
          {
            type: "text",
            text: `Error creating text: ${
              error instanceof Error ? error.message : String(error)
            }`,
          },
        ],
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
    a: z.number().min(0).max(1).optional().describe("Alpha component (0-1)"),
  },
  async ({ nodeId, r, g, b, a }) => {
    try {
      const result = await sendCommandToFigma("set_fill_color", {
        nodeId,
        color: { r, g, b, a: a || 1 },
      });
      const typedResult = result as { name: string };
      return {
        content: [
          {
            type: "text",
            text: `Set fill color of node "${
              typedResult.name
            }" to RGBA(${r}, ${g}, ${b}, ${a || 1})`,
          },
        ],
      };
    } catch (error) {
      return {
        content: [
          {
            type: "text",
            text: `Error setting fill color: ${
              error instanceof Error ? error.message : String(error)
            }`,
          },
        ],
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
    weight: z.number().positive().optional().describe("Stroke weight"),
  },
  async ({ nodeId, r, g, b, a, weight }) => {
    try {
      const result = await sendCommandToFigma("set_stroke_color", {
        nodeId,
        color: { r, g, b, a: a || 1 },
        weight: weight || 1,
      });
      const typedResult = result as { name: string };
      return {
        content: [
          {
            type: "text",
            text: `Set stroke color of node "${
              typedResult.name
            }" to RGBA(${r}, ${g}, ${b}, ${a || 1}) with weight ${weight || 1}`,
          },
        ],
      };
    } catch (error) {
      return {
        content: [
          {
            type: "text",
            text: `Error setting stroke color: ${
              error instanceof Error ? error.message : String(error)
            }`,
          },
        ],
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
    y: z.number().describe("New Y position"),
  },
  async ({ nodeId, x, y }) => {
    try {
      const result = await sendCommandToFigma("move_node", { nodeId, x, y });
      const typedResult = result as { name: string };
      return {
        content: [
          {
            type: "text",
            text: `Moved node "${typedResult.name}" to position (${x}, ${y})`,
          },
        ],
      };
    } catch (error) {
      return {
        content: [
          {
            type: "text",
            text: `Error moving node: ${
              error instanceof Error ? error.message : String(error)
            }`,
          },
        ],
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
    height: z.number().positive().describe("New height"),
  },
  async ({ nodeId, width, height }) => {
    try {
      const result = await sendCommandToFigma("resize_node", {
        nodeId,
        width,
        height,
      });
      const typedResult = result as { name: string };
      return {
        content: [
          {
            type: "text",
            text: `Resized node "${typedResult.name}" to width ${width} and height ${height}`,
          },
        ],
      };
    } catch (error) {
      return {
        content: [
          {
            type: "text",
            text: `Error resizing node: ${
              error instanceof Error ? error.message : String(error)
            }`,
          },
        ],
      };
    }
  }
);

// Delete Node Tool
server.tool(
  "delete_node",
  "Delete a node from Figma",
  {
    nodeId: z.string().describe("The ID of the node to delete"),
  },
  async ({ nodeId }) => {
    try {
      await sendCommandToFigma("delete_node", { nodeId });
      return {
        content: [
          {
            type: "text",
            text: `Deleted node with ID: ${nodeId}`,
          },
        ],
      };
    } catch (error) {
      return {
        content: [
          {
            type: "text",
            text: `Error deleting node: ${
              error instanceof Error ? error.message : String(error)
            }`,
          },
        ],
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
      const result = await sendCommandToFigma("get_styles");
      return {
        content: [
          {
            type: "text",
            text: JSON.stringify(result, null, 2),
          },
        ],
      };
    } catch (error) {
      return {
        content: [
          {
            type: "text",
            text: `Error getting styles: ${
              error instanceof Error ? error.message : String(error)
            }`,
          },
        ],
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
      const result = await sendCommandToFigma("get_local_components");
      return {
        content: [
          {
            type: "text",
            text: JSON.stringify(result, null, 2),
          },
        ],
      };
    } catch (error) {
      return {
        content: [
          {
            type: "text",
            text: `Error getting local components: ${
              error instanceof Error ? error.message : String(error)
            }`,
          },
        ],
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
    y: z.number().describe("Y position"),
  },
  async ({ componentKey, x, y }) => {
    try {
      const result = await sendCommandToFigma("create_component_instance", {
        componentKey,
        x,
        y,
      });
      const typedResult = result as { name: string; id: string };
      return {
        content: [
          {
            type: "text",
            text: `Created component instance "${typedResult.name}" with ID: ${typedResult.id}`,
          },
        ],
      };
    } catch (error) {
      return {
        content: [
          {
            type: "text",
            text: `Error creating component instance: ${
              error instanceof Error ? error.message : String(error)
            }`,
          },
        ],
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
    corners: z
      .array(z.boolean())
      .length(4)
      .optional()
      .describe(
        "Optional array of 4 booleans to specify which corners to round [topLeft, topRight, bottomRight, bottomLeft]"
      ),
  },
  async ({ nodeId, radius, corners }) => {
    try {
      const result = await sendCommandToFigma("set_corner_radius", {
        nodeId,
        radius,
        corners: corners || [true, true, true, true],
      });
      const typedResult = result as { name: string };
      return {
        content: [
          {
            type: "text",
            text: `Set corner radius of node "${typedResult.name}" to ${radius}px`,
          },
        ],
      };
    } catch (error) {
      return {
        content: [
          {
            type: "text",
            text: `Error setting corner radius: ${
              error instanceof Error ? error.message : String(error)
            }`,
          },
        ],
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
    - Don't have account (text)`,
          },
        },
      ],
      description: "Best practices for working with Figma designs",
    };
  }
);

// add text node scanning tool
server.tool(
  "scan_text_nodes",
  "Scan all text nodes in the selected Figma node",
  {
    nodeId: z.string().describe("ID of the node to scan"),
  },
  async ({ nodeId }) => {
    try {
      const result = await sendCommandToFigma("scan_text_nodes", { nodeId });
      return {
        content: [
          {
            type: "text",
            text: JSON.stringify(result, null, 2),
          },
        ],
      };
    } catch (error) {
      return {
        content: [
          {
            type: "text",
            text: `Error scanning text nodes: ${
              error instanceof Error ? error.message : String(error)
            }`,
          },
        ],
      };
    }
  }
);

// add prompt for analyzing Figma images for understanding context of the design
server.tool(
  "understand_context",
  "Send a screen to Cursor for context understanding and analysis",
  {
    nodeId: z.string().describe("The ID of the node to analyze"),
    format: z
      .enum(["PNG", "JPG", "SVG", "PDF"])
      .optional()
      .describe("Export format"),
    scale: z.number().positive().optional().describe("Export scale"),
  },
  async ({ nodeId, format, scale }) => {
    try {
      console.log(
        `[SERVER] Starting context analysis for node ${nodeId} with format ${
          format || "PNG"
        } at scale ${scale || 1}`
      );

      // get document info
      const docInfo = (await sendCommandToFigma("get_document_info")) as any;

      const imageResult = await sendCommandToFigma("understand_context", {
        nodeId,
        format: format || "PNG",
        scale: scale || 1,
        documentId: docInfo?.id || "unknown",
        pageId: docInfo?.currentPage?.id || "unknown",
      });
      const typedResult = imageResult as any;

      // Create a more structured response with workflow guidance
      return {
        content: [
          {
            type: "text",
            text: JSON.stringify(typedResult, null, 2),
          },
          {
            type: "text",
            text:
              "Execute immediately follow up prompt for downloading the exported Figma image",
          },
        ],
        followUp: {
          prompt: "download_image_prompt",
          description: "Download the exported Figma image",
        },
      };
    } catch (error) {
      console.error("[SERVER] Error analyzing context:", error);

      return {
        content: [
          {
            type: "text",
            text: `Error analyzing context: ${
              error instanceof Error ? error.message : String(error)
            }`,
          },
        ],
      };
    }
  }
);

// add prompt for processing exported Figma images
// @ts-nocheck
server.prompt(
  "download_image_prompt",
  "Downloading Figma images with Cursor",
  (extra) => {
    return {
      messages: [
        {
          role: "assistant",
          content: {
            type: "text",
            text: `I'll automatically download the Figma image for you. Let me process that right away.

I'll execute the following terminal command to download the image:

\`\`\`bash
DOCUMENT_ID="[DOCUMENT_ID_FROM_RESPONSE]" && IMAGE_ID="[IMAGE_ID_FROM_RESPONSE]" && IMAGE_URL="[IMAGE_URL_FROM_RESPONSE]" && TODAY=$(date +%Y-%m-%d) && mkdir -p "cursor-talk-to-figma-mcp/figma-exports/$DOCUMENT_ID/$TODAY" && curl -s "$IMAGE_URL" -o "figma-exports/$DOCUMENT_ID/$TODAY/$IMAGE_ID.png" && SAVED_PATH="figma-exports/$DOCUMENT_ID/$TODAY/$IMAGE_ID.png" && echo "Image saved to: $SAVED_PATH" && file "$SAVED_PATH"
\`\`\`

After downloading, I'll automatically analyze the image content using the context_understanding_prompt.`
            
          },
          followUp: {
            prompt: "context_understanding_prompt",
            description: "Analyze the content of the downloaded image",
          },
        },
      ],
      description:
        "Execute command for downloading captured design from the image server",
    };
  }
);

// add prompt for analyzing Figma images for understanding context of the design
server.prompt(
  "context_understanding_prompt",
  "Guide for analyzing Figma images for understanding context of the design",
  (extra) => {
    return {
      messages: [
        {
          role: "assistant",
          content: {
            type: "text",
            text: `I am an agent that is trained to complete certain tasks on a GUI app. I will analyze the given screenshot of a GUI app that downloaded from Figma.

I can call the following functions to interact with those UI elements to control the app:

1. tap(element: x, y: y)
This function is used to tap an UI element shown on the screen.
"x" and "y" are the coordinates of the UI element on the screen.
A simple use case can be tap(50, 100), which taps the UI element at the coordinates (50, 100).

2. text(text_input: str)
This function is used to insert text input in an input field/box. text_input is the string I want to insert and must be wrapped with double quotation marks. A simple use case can be text("Hello, world!"), which inserts the string "Hello, world!" into the input area on the screen. This function is only callable when I see a keyboard showing in the lower half of the screen.

3. long_press(element: x, y: y)
This function is used to long press an UI element shown on the screen.
"x" and "y" are the coordinates of the UI element on the screen.
A simple use case can be long_press(50, 100), which long presses the UI element at the coordinates (50, 100).

4. swipe(element: x, y: y, direction: str, dist: str)
This function is used to swipe an UI element shown on the screen, usually a scroll view or a slide bar.
"x" and "y" are the coordinates of the UI element on the screen. "direction" is a string that represents one of the four directions: up, down, left, right. "direction" must be wrapped with double quotation marks. "dist" determines the distance of the swipe and can be one of the three options: short, medium, long. I should choose the appropriate distance option according to my need.
A simple use case can be swipe(21, "up", "medium"), which swipes up the UI element at the coordinates (21, 100) for a medium distance.

The task I need to complete is to <task_description (if empty, ask user for what is the task I need to complete in this screen)>. My past actions to proceed with this task are summarized as follows: <last_act (if empty, ask user for what is the last action I took)>
Now, given the following screenshot, I need to think and call the function needed to proceed with the task. 
My output should include three parts in the given format:

* Observation: <Describe what I observe in the image>
* Thought: <To complete the given task, what is the next step I should do>
* Action: <The function call with the correct parameters to proceed with the task. If I believe the task is completed or there is nothing to be done, I should output FINISH. I cannot output anything else except a function call or FINISH in this field.>
* Summary: <Summarize my past actions along with my latest action in one or two sentences. Do not include the numeric tag in my summary>

I can only take one action at a time, so please directly call the function.

After analyzing the image, I now have a complete understanding of the design context for the selected node.

Now that I understand the design context, I would like to:

1. Improve the UX Writing: Enhance the content clarity, persuasiveness, or emotional appeal based on the design's purpose
2. Localize the Content: Translate the text content to another language while preserving the design's intent and cultural context
3. Analyze Design Patterns: Get insights about the UI components and how they compare to standard design patterns
4. Optimize for Conversion: Receive recommendations for improving conversion rates by adjusting text and UI elements

I can select one of these options or request another action related to the design I've analyzed.`
          },
        },
      ],
      description:
        "Guide for analyzing Figma images for understanding context of the design",
    };
  }
);
// @ts-check

// Define command types and parameters
type FigmaCommand =
  | "get_document_info"
  | "get_selection"
  | "get_node_info"
  | "create_rectangle"
  | "create_frame"
  | "create_text"
  | "set_fill_color"
  | "set_stroke_color"
  | "move_node"
  | "resize_node"
  | "delete_node"
  | "get_styles"
  | "get_local_components"
  | "get_team_components"
  | "create_component_instance"
  | "export_node_as_image"
  | "execute_code"
  | "join"
  | "set_corner_radius"
  | "scan_text_nodes"
  | "understand_context"
  | "clone_node"
  | "apply_translations";

// Helper function to process Figma node responses
function processFigmaNodeResponse(result: unknown): any {
  if (!result || typeof result !== "object") {
    return result;
  }

  // Check if this looks like a node response
  const resultObj = result as Record<string, unknown>;
  if ("id" in resultObj && typeof resultObj.id === "string") {
    // It appears to be a node response, log the details
    console.info(
      `Processed Figma node: ${resultObj.name || "Unknown"} (ID: ${
        resultObj.id
      })`
    );

    if ("x" in resultObj && "y" in resultObj) {
      console.debug(`Node position: (${resultObj.x}, ${resultObj.y})`);
    }

    if ("width" in resultObj && "height" in resultObj) {
      console.debug(`Node dimensions: ${resultObj.width}×${resultObj.height}`);
    }
  }

  return result;
}

// Simple function to connect to Figma WebSocket server
function connectToFigma(port: number = 3055) {
  // If already connected, do nothing
  if (ws && ws.readyState === WebSocket.OPEN) {
    console.info("Already connected to Figma");
    return;
  }

  console.info(`Connecting to Figma socket server on port ${port}...`);
  ws = new WebSocket(`ws://localhost:${port}`);

  ws.on("open", () => {
    console.info("Connected to Figma socket server");
    // Reset channel on new connection
    currentChannel = null;
  });

  ws.on("message", (data: any) => {
    try {
      const json = JSON.parse(data) as { message: FigmaResponse };
      const myResponse = json.message;
      console.debug(`Received message: ${JSON.stringify(myResponse)}`);
      console.log("myResponse", myResponse);

      // Handle response to a request
      if (
        myResponse.id &&
        pendingRequests.has(myResponse.id) &&
        myResponse.result
      ) {
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
        console.info(
          `Received broadcast message: ${JSON.stringify(myResponse)}`
        );
      }
    } catch (error) {
      console.error(
        `Error parsing message: ${
          error instanceof Error ? error.message : String(error)
        }`
      );
    }
  });

  ws.on("error", (error) => {
    console.error(`Socket error: ${error}`);
  });

  ws.on("close", () => {
    console.info("Disconnected from Figma socket server");
    ws = null;

    // Reject all pending requests
    for (const [id, request] of pendingRequests.entries()) {
      clearTimeout(request.timeout);
      request.reject(new Error("Connection closed"));
      pendingRequests.delete(id);
    }

    // Attempt to reconnect
    console.info("Attempting to reconnect in 2 seconds...");
    setTimeout(() => connectToFigma(port), 2000);
  });
}

// Function to join a channel
async function joinChannel(channelName: string): Promise<void> {
  if (!ws || ws.readyState !== WebSocket.OPEN) {
    throw new Error("Not connected to Figma");
  }

  try {
    await sendCommandToFigma("join", { channel: channelName });
    currentChannel = channelName;
    console.info(`Joined channel: ${channelName}`);
  } catch (error) {
    console.error(
      `Failed to join channel: ${
        error instanceof Error ? error.message : String(error)
      }`
    );
    throw error;
  }
}

// Function to send commands to Figma
function sendCommandToFigma(
  command: FigmaCommand,
  params: unknown = {}
): Promise<unknown> {
  return new Promise((resolve, reject) => {
    // If not connected, try to connect first
    if (!ws || ws.readyState !== WebSocket.OPEN) {
      connectToFigma();
      reject(new Error("Not connected to Figma. Attempting to connect..."));
      return;
    }

    // Check if we need a channel for this command
    const requiresChannel = command !== "join";
    if (requiresChannel && !currentChannel) {
      reject(new Error("Must join a channel before sending commands"));
      return;
    }

    const id = uuidv4();
    const request = {
      id,
      type: command === "join" ? "join" : "message",
      ...(command === "join"
        ? { channel: (params as any).channel }
        : { channel: currentChannel }),
      message: {
        id,
        command,
        params: {
          ...(params as any),
        },
      },
    };

    // Set timeout for request
    const timeout = setTimeout(() => {
      if (pendingRequests.has(id)) {
        pendingRequests.delete(id);
        console.error(`Request ${id} to Figma timed out after 30 seconds`);
        reject(new Error("Request to Figma timed out"));
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
    channel: z.string().describe("The name of the channel to join").default(""),
  },
  async ({ channel }) => {
    try {
      if (!channel) {
        // If no channel provided, ask the user for input
        return {
          content: [
            {
              type: "text",
              text: "Please provide a channel name to join:",
            },
          ],
          followUp: {
            tool: "join_channel",
            description: "Join the specified channel",
          },
        };
      }

      await joinChannel(channel);
      return {
        content: [
          {
            type: "text",
            text: `Successfully joined channel: ${channel}`,
          },
        ],
      };
    } catch (error) {
      return {
        content: [
          {
            type: "text",
            text: `Error joining channel: ${
              error instanceof Error ? error.message : String(error)
            }`,
          },
        ],
      };
    }
  }
);

// add prompt for localizing Figma designs
server.prompt(
  "localization_prompt",
  "Guide for localizing Figma designs to other languages",
  (extra) => {
    return {
      messages: [
        {
          role: "assistant",
          content: {
            type: "text",
            text: `# Figma Design Localization

I'll help you localize the Figma design to your desired language. Based on the context analysis of the design, I can provide culturally appropriate translations while preserving the original design intent.

## Localization Process

1. First, use the \`clone_node\` tool to duplicate the selected node and create a new version for localization:
   \`\`\`
   clone_node(nodeId: "your-node-id", x: 200, y: 0)
   \`\`\`

2. Then, use the \`scan_text_nodes\` tool directly on the cloned node to retrieve all text elements:
   \`\`\`
   scan_text_nodes(nodeId: "cloned-node-id")
   \`\`\`

3. Finally, apply translations to the text elements using the \`apply_translations\` tool:
   \`\`\`
   apply_translations(
     nodeId: "cloned-node-id",
     translations: [
       { nodeId: "text-node-id-1", text: "translated text 1" },
       { nodeId: "text-node-id-2", text: "translated text 2" },
       ...
     ]
   )
   \`\`\`

## Please specify:
- What target language would you like to localize to?
- Are there any specific cultural adaptations or terminology preferences I should consider?
- Would you like to maintain the same text length (important for layout constraints) or allow for natural variations?

I'll ensure the translation maintains the original meaning and purpose while being culturally appropriate for your target audience.`
          }
        }
      ],
      description: "Guide for localizing Figma designs to other languages"
    };
  }
);

// Add this right before the localize_node tool function
server.tool(
  "clone_node",
  "Clone a node in Figma",
  {
    nodeId: z.string().describe("The ID of the node to clone"),
    x: z.number().optional().describe("X position offset from the original node"),
    y: z.number().optional().describe("Y position offset from the original node"),
  },
  async ({ nodeId, x, y }) => {
    try {
      // 1. 먼저 원본 노드의 정보를 가져와서 현재 위치를 확인
      const originalNode = await sendCommandToFigma("get_node_info", { nodeId }) as any;
      
      if (!originalNode || typeof originalNode !== 'object') {
        throw new Error(`Failed to get information for original node: ${nodeId}`);
      }
      
      // 2. 원본 노드의 위치가 있는지 확인
      if (!('x' in originalNode) || !('y' in originalNode)) {
        throw new Error(`Original node does not have position information: ${nodeId}`);
      }
      
      // 3. 오프셋 적용하여 새로운 위치 계산
      const offsetX = x !== undefined ? x : 200; // 기본 오프셋은 x축으로 200px
      const offsetY = y !== undefined ? y : 0;   // 기본 오프셋은 y축으로 0px
      
      const newX = originalNode.x + offsetX;
      const newY = originalNode.y + offsetY;
      
      // 4. 새 위치로 노드 복제
      const result = await sendCommandToFigma("clone_node", {
        nodeId,
        x: newX,
        y: newY,
      });

      return {
        content: [
          {
            type: "text",
            text: JSON.stringify(result, null, 2),
          },
        ],
      };
    } catch (error) {
      return {
        content: [
          {
            type: "text",
            text: `Error cloning node: ${error instanceof Error ? error.message : String(error)}`,
          },
        ],
      };
    }
  }
);

// Handler to apply translations to text nodes
server.tool(
  "apply_translations",
  "Apply translated text to nodes in Figma",
  {
    nodeId: z.string().describe("The ID of the node containing the text nodes to translate"),
    translations: z.array(
      z.object({
        nodeId: z.string().describe("The ID of the text node"),
        text: z.string().describe("The translated text")
      })
    ).describe("Array of text node IDs and their translations"),
  },
  async ({ nodeId, translations }) => {
    try {
      if (!translations || translations.length === 0) {
        return {
          content: [
            {
              type: "text",
              text: "No translations provided",
            },
          ],
        };
      }
      
      // Use the plugin's apply_translations function directly
      const result = await sendCommandToFigma("apply_translations", {
        nodeId,
        translations
      });
      
      return {
        content: [
          {
            type: "text",
            text: JSON.stringify(result, null, 2),
          },
        ],
      };
    } catch (error) {
      return {
        content: [
          {
            type: "text",
            text: `Error applying translations: ${error instanceof Error ? error.message : String(error)}`,
          },
        ],
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
    console.warn(
      `Could not connect to Figma initially: ${
        error instanceof Error ? error.message : String(error)
      }`
    );
    console.warn("Will try to connect when the first command is sent");
  }

  // Start the MCP server with stdio transport
  const transport = new StdioServerTransport();
  await server.connect(transport);
  console.info("FigmaMCP server running on stdio");

  // Start the image server
  imageServer.listen(IMAGE_SERVER_PORT, () => {
    console.log(
      `Image server running on http://localhost:${IMAGE_SERVER_PORT}`
    );
  });
}

// Run the server
main().catch((error) => {
  console.error(
    `Error starting FigmaMCP server: ${
      error instanceof Error ? error.message : String(error)
    }`
  );
  process.exit(1);
});