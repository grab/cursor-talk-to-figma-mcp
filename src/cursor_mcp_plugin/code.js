// This is the main code file for the Cursor MCP Figma plugin
// It handles Figma API commands

// Plugin state
const state = {
  serverPort: 3055, // Default port
};

// Show UI
figma.showUI(__html__, { width: 350, height: 450 });

// Plugin commands from UI
figma.ui.onmessage = async (msg) => {
  switch (msg.type) {
    case "update-settings":
      updateSettings(msg);
      break;
    case "notify":
      figma.notify(msg.message);
      break;
    case "close-plugin":
      figma.closePlugin();
      break;
    case "execute-command":
      // Execute commands received from UI (which gets them from WebSocket)
      try {
        const result = await handleCommand(msg.command, msg.params);
        // Send result back to UI
        figma.ui.postMessage({
          type: "command-result",
          id: msg.id,
          result,
        });
      } catch (error) {
        figma.ui.postMessage({
          type: "command-error",
          id: msg.id,
          error: error.message || "Error executing command",
        });
      }
      break;
  }
};

// Listen for plugin commands from menu
figma.on("run", ({ command }) => {
  figma.ui.postMessage({ type: "auto-connect" });
});

// Update plugin settings
function updateSettings(settings) {
  if (settings.serverPort) {
    state.serverPort = settings.serverPort;
  }

  figma.clientStorage.setAsync("settings", {
    serverPort: state.serverPort,
  });
}

// Handle commands from UI
async function handleCommand(command, params) {
  switch (command) {
    case "get_document_info":
      return await getDocumentInfo();
    case "get_selection":
      return await getSelection();
    case "get_node_info":
      if (!params || !params.nodeId) {
        throw new Error("Missing nodeId parameter");
      }
      return await getNodeInfo(params.nodeId);
    case "create_rectangle":
      return await createRectangle(params);
    case "create_frame":
      return await createFrame(params);
    case "create_text":
      return await createText(params);
    case "set_fill_color":
      return await setFillColor(params);
    case "set_stroke_color":
      return await setStrokeColor(params);
    case "move_node":
      return await moveNode(params);
    case "resize_node":
      return await resizeNode(params);
    case "delete_node":
      return await deleteNode(params);
    case "get_styles":
      return await getStyles();
    case "get_local_components":
      return await getLocalComponents();
    // case "get_team_components":
    //   return await getTeamComponents();
    case "create_component_instance":
      return await createComponentInstance(params);
    case "export_node_as_image":
      return await exportNodeAsImage(params);
    case "export_node_as_image_to_server":
      return await exportNodeAsImageToServer(params);
    case "execute_code":
      return await executeCode(params);
    case "set_corner_radius":
      return await setCornerRadius(params);
    case "scan_text_nodes":
      return await scanTextNodes(params.nodeId);
    case "add_text_annotations":
      return await addTextAnnotations(params.nodeId, params.annotationStyle, params.includeFrames);
    default:
      throw new Error(`Unknown command: ${command}`);
  }
}

// Command implementations

async function getDocumentInfo() {
  await figma.currentPage.loadAsync();
  const page = figma.currentPage;
  return {
    name: page.name,
    id: page.id,
    type: page.type,
    children: page.children.map((node) => ({
      id: node.id,
      name: node.name,
      type: node.type,
    })),
    currentPage: {
      id: page.id,
      name: page.name,
      childCount: page.children.length,
    },
    pages: [
      {
        id: page.id,
        name: page.name,
        childCount: page.children.length,
      },
    ],
  };
}

async function getSelection() {
  return {
    selectionCount: figma.currentPage.selection.length,
    selection: figma.currentPage.selection.map((node) => ({
      id: node.id,
      name: node.name,
      type: node.type,
      visible: node.visible,
    })),
  };
}

async function getNodeInfo(nodeId) {
  const node = await figma.getNodeByIdAsync(nodeId);

  if (!node) {
    throw new Error(`Node not found with ID: ${nodeId}`);
  }

  // Base node information
  const nodeInfo = {
    id: node.id,
    name: node.name,
    type: node.type,
    visible: node.visible,
  };

  // Add position and size for SceneNode
  if ("x" in node && "y" in node) {
    nodeInfo.x = node.x;
    nodeInfo.y = node.y;
  }

  if ("width" in node && "height" in node) {
    nodeInfo.width = node.width;
    nodeInfo.height = node.height;
  }

  // Add fills for nodes with fills
  if ("fills" in node) {
    nodeInfo.fills = node.fills;
  }

  // Add strokes for nodes with strokes
  if ("strokes" in node) {
    nodeInfo.strokes = node.strokes;
    if ("strokeWeight" in node) {
      nodeInfo.strokeWeight = node.strokeWeight;
    }
  }

  // Add children for parent nodes
  if ("children" in node) {
    nodeInfo.children = node.children.map((child) => ({
      id: child.id,
      name: child.name,
      type: child.type,
    }));
  }

  // Add text-specific properties
  if (node.type === "TEXT") {
    nodeInfo.characters = node.characters;
    nodeInfo.fontSize = node.fontSize;
    nodeInfo.fontName = node.fontName;
  }

  return nodeInfo;
}

async function createRectangle(params) {
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

async function createFrame(params) {
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
  } = params || {};

  const frame = figma.createFrame();
  frame.x = x;
  frame.y = y;
  frame.resize(width, height);
  frame.name = name;

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
    parentId: frame.parent ? frame.parent.id : undefined,
  };
}

async function createText(params) {
  const {
    x = 0,
    y = 0,
    text = "Text",
    fontSize = 14,
    fontWeight = 400,
    fontColor = { r: 0, g: 0, b: 0, a: 1 }, // Default to black
    name = "Text",
    parentId,
  } = params || {};

  // Map common font weights to Figma font styles
  const getFontStyle = (weight) => {
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
  };

  const textNode = figma.createText();
  textNode.x = x;
  textNode.y = y;
  textNode.name = name;
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

async function setFillColor(params) {
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

async function setStrokeColor(params) {
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

async function moveNode(params) {
  const { nodeId, x, y } = params || {};

  if (!nodeId) {
    throw new Error("Missing nodeId parameter");
  }

  if (x === undefined || y === undefined) {
    throw new Error("Missing x or y parameters");
  }

  const node = await figma.getNodeByIdAsync(nodeId);
  if (!node) {
    throw new Error(`Node not found with ID: ${nodeId}`);
  }

  if (!("x" in node) || !("y" in node)) {
    throw new Error(`Node does not support position: ${nodeId}`);
  }

  node.x = x;
  node.y = y;

  return {
    id: node.id,
    name: node.name,
    x: node.x,
    y: node.y,
  };
}

async function resizeNode(params) {
  const { nodeId, width, height } = params || {};

  if (!nodeId) {
    throw new Error("Missing nodeId parameter");
  }

  if (width === undefined || height === undefined) {
    throw new Error("Missing width or height parameters");
  }

  const node = await figma.getNodeByIdAsync(nodeId);
  if (!node) {
    throw new Error(`Node not found with ID: ${nodeId}`);
  }

  if (!("resize" in node)) {
    throw new Error(`Node does not support resizing: ${nodeId}`);
  }

  node.resize(width, height);

  return {
    id: node.id,
    name: node.name,
    width: node.width,
    height: node.height,
  };
}

async function deleteNode(params) {
  const { nodeId } = params || {};

  if (!nodeId) {
    throw new Error("Missing nodeId parameter");
  }

  const node = await figma.getNodeByIdAsync(nodeId);
  if (!node) {
    throw new Error(`Node not found with ID: ${nodeId}`);
  }

  // Save node info before deleting
  const nodeInfo = {
    id: node.id,
    name: node.name,
    type: node.type,
  };

  node.remove();

  return nodeInfo;
}

async function getStyles() {
  const styles = {
    colors: await figma.getLocalPaintStylesAsync(),
    texts: await figma.getLocalTextStylesAsync(),
    effects: await figma.getLocalEffectStylesAsync(),
    grids: await figma.getLocalGridStylesAsync(),
  };

  return {
    colors: styles.colors.map((style) => ({
      id: style.id,
      name: style.name,
      key: style.key,
      paint: style.paints[0],
    })),
    texts: styles.texts.map((style) => ({
      id: style.id,
      name: style.name,
      key: style.key,
      fontSize: style.fontSize,
      fontName: style.fontName,
    })),
    effects: styles.effects.map((style) => ({
      id: style.id,
      name: style.name,
      key: style.key,
    })),
    grids: styles.grids.map((style) => ({
      id: style.id,
      name: style.name,
      key: style.key,
    })),
  };
}

async function getLocalComponents() {
  await figma.loadAllPagesAsync();

  const components = figma.root.findAllWithCriteria({
    types: ["COMPONENT"],
  });

  return {
    count: components.length,
    components: components.map((component) => ({
      id: component.id,
      name: component.name,
      key: "key" in component ? component.key : null,
    })),
  };
}

// async function getTeamComponents() {
//   try {
//     const teamComponents =
//       await figma.teamLibrary.getAvailableComponentsAsync();

//     return {
//       count: teamComponents.length,
//       components: teamComponents.map((component) => ({
//         key: component.key,
//         name: component.name,
//         description: component.description,
//         libraryName: component.libraryName,
//       })),
//     };
//   } catch (error) {
//     throw new Error(`Error getting team components: ${error.message}`);
//   }
// }

async function createComponentInstance(params) {
  const { componentKey, x = 0, y = 0 } = params || {};

  if (!componentKey) {
    throw new Error("Missing componentKey parameter");
  }

  try {
    const component = await figma.importComponentByKeyAsync(componentKey);
    const instance = component.createInstance();

    instance.x = x;
    instance.y = y;

    figma.currentPage.appendChild(instance);

    return {
      id: instance.id,
      name: instance.name,
      x: instance.x,
      y: instance.y,
      width: instance.width,
      height: instance.height,
      componentId: instance.componentId,
    };
  } catch (error) {
    throw new Error(`Error creating component instance: ${error.message}`);
  }
}

async function exportNodeAsImage(params) {
  const { nodeId, scale = 1 } = params || {};

  const format = "PNG";

  if (!nodeId) {
    throw new Error("Missing nodeId parameter");
  }

  const node = await figma.getNodeByIdAsync(nodeId);
  if (!node) {
    throw new Error(`Node not found with ID: ${nodeId}`);
  }

  if (!("exportAsync" in node)) {
    throw new Error(`Node does not support exporting: ${nodeId}`);
  }

  try {
    const settings = {
      format: format,
      constraint: { type: "SCALE", value: scale },
    };

    const bytes = await node.exportAsync(settings);

    let mimeType;
    switch (format) {
      case "PNG":
        mimeType = "image/png";
        break;
      case "JPG":
        mimeType = "image/jpeg";
        break;
      case "SVG":
        mimeType = "image/svg+xml";
        break;
      case "PDF":
        mimeType = "application/pdf";
        break;
      default:
        mimeType = "application/octet-stream";
    }

    // Proper way to convert Uint8Array to base64
    const base64 = customBase64Encode(bytes);
    // const imageData = `data:${mimeType};base64,${base64}`;

    return {
      nodeId,
      format,
      scale,
      mimeType,
      imageData: base64,
    };
  } catch (error) {
    throw new Error(`Error exporting node as image: ${error.message}`);
  }
}

// 서버에 이미지 업로드 함수로 이름 변경 및 기능 수정
async function exportNodeAsImageToServer(params) {
  const { nodeId, format = "PNG", scale = 1 } = params || {};
  
  if (!nodeId) {
    throw new Error("Missing nodeId parameter");
  }

  console.log(`[SERVER] Starting image export and upload for node ${nodeId} with format ${format} at scale ${scale}`);

  try {
    const node = await figma.getNodeByIdAsync(nodeId);
    if (!node) {
      console.error(`[SERVER] Node not found with ID: ${nodeId}`);
      throw new Error(`Node not found with ID: ${nodeId}`);
    }
  
    if (!("exportAsync" in node)) {
      console.error(`[SERVER] Node does not support exporting: ${nodeId}`);
      throw new Error(`Node does not support exporting: ${nodeId}`);
    }

    const settings = {
      format: format,
      constraint: { type: "SCALE", value: scale },
    };

    console.log(`[SERVER] Exporting node with settings:`, settings);
    
    // 내보내기 수행
    const bytes = await node.exportAsync(settings);
    console.log(`[SERVER] Successfully exported ${bytes.length} bytes`);

    // MIME 타입 설정
    let mimeType;
    switch (format) {
      case "PNG":
        mimeType = "image/png";
        break;
      case "JPG":
        mimeType = "image/jpeg";
        break;
      case "SVG":
        mimeType = "image/svg+xml";
        break;
      case "PDF":
        mimeType = "application/pdf";
        break;
      default:
        mimeType = "application/octet-stream";
    }

    // UI를 통해 서버에 업로드
    console.log(`[SERVER] Sending to UI for upload to server...`);
    
    // UI가 열려있지 않으면 열기
    if (!figma.ui) {
      // 작은 창으로 열어두기 (사용자에게 보이지 않게)
      figma.showUI(__html__, { visible: false, width: 10, height: 10 });
    }
    
    // UI를 통한 업로드 요청 및 응답을 기다리기 위한 프로미스
    return new Promise((resolve, reject) => {
      // 요청 ID 생성
      const messageId = Date.now().toString();
      
      // 메시지 핸들러 등록
      const messageHandler = (msg) => {
        // 현재 요청에 대한 응답인지 확인
        if (msg.messageId !== messageId) return;
        
        // 완료 메시지인 경우
        if (msg.type === 'upload-complete' && msg.success) {
          figma.ui.off('message', messageHandler);
          console.log(`[SERVER] Upload completed via UI, imageId: ${msg.imageId}`);
          
          resolve({
            nodeId,
            format,
            scale,
            mimeType,
            success: true,
            imageId: msg.imageId,
            imageUrl: msg.imageUrl
          });
        } 
        // 에러 메시지인 경우
        else if (msg.type === 'upload-error') {
          figma.ui.off('message', messageHandler);
          console.error(`[SERVER] Upload failed via UI: ${msg.error}`);
          
          reject(new Error(`Error uploading image via UI: ${msg.error}`));
        }
      };
      
      // 메시지 이벤트 핸들러 등록
      figma.ui.on('message', messageHandler);
      
      // UI에 업로드 요청 전송
      figma.ui.postMessage({
        type: 'upload-image',
        bytes: Array.from(bytes), // ArrayBuffer를 배열로 변환하여 전송
        mimeType: mimeType,
        format: format,
        nodeId: nodeId, // 노드 ID 추가 (파일명 생성에 활용)
        nodeName: node.name || 'image', // 노드 이름 추가 (파일명 생성에 활용)
        messageId: messageId
      });
      
      // 타임아웃 설정 (30초)
      setTimeout(() => {
        figma.ui.off('message', messageHandler);
        reject(new Error('Upload timeout via UI after 30 seconds'));
      }, 30000);
    });
  } catch (error) {
    console.error(`[SERVER] Error exporting node as image:`, error);
    throw new Error(`Error exporting node to server: ${error.message}`);
  }
}

async function executeCode(params) {
  const { code } = params || {};

  if (!code) {
    throw new Error("Missing code parameter");
  }

  try {
    // Execute the provided code
    // Note: This is potentially unsafe, but matches the Blender MCP functionality
    const executeFn = new Function(
      "figma",
      "selection",
      `
      try {
        const result = (async () => {
          ${code}
        })();
        return result;
      } catch (error) {
        throw new Error('Error executing code: ' + error.message);
      }
    `
    );

    const result = await executeFn(figma, figma.currentPage.selection);
    return { result };
  } catch (error) {
    throw new Error(`Error executing code: ${error.message}`);
  }
}

async function setCornerRadius(params) {
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

// Initialize settings on load
(async function initializePlugin() {
  try {
    const savedSettings = await figma.clientStorage.getAsync("settings");
    if (savedSettings) {
      if (savedSettings.serverPort) {
        state.serverPort = savedSettings.serverPort;
      }
    }

    // Send initial settings to UI
    figma.ui.postMessage({
      type: "init-settings",
      settings: {
        serverPort: state.serverPort,
      },
    });
  } catch (error) {
    console.error("Error loading settings:", error);
  }
})();

function uniqBy(arr, predicate) {
  const cb = typeof predicate === "function" ? predicate : (o) => o[predicate];
  return [
    ...arr
      .reduce((map, item) => {
        const key = item === null || item === undefined ? item : cb(item);

        map.has(key) || map.set(key, item);

        return map;
      }, new Map())
      .values(),
  ];
}
const setCharacters = async (node, characters, options) => {
  const fallbackFont = (options && options.fallbackFont) || {
    family: "Inter",
    style: "Regular",
  };
  try {
    if (node.fontName === figma.mixed) {
      if (options && options.smartStrategy === "prevail") {
        const fontHashTree = {};
        for (let i = 1; i < node.characters.length; i++) {
          const charFont = node.getRangeFontName(i - 1, i);
          const key = `${charFont.family}::${charFont.style}`;
          fontHashTree[key] = fontHashTree[key] ? fontHashTree[key] + 1 : 1;
        }
        const prevailedTreeItem = Object.entries(fontHashTree).sort(
          (a, b) => b[1] - a[1]
        )[0];
        const [family, style] = prevailedTreeItem[0].split("::");
        const prevailedFont = {
          family,
          style,
        };
        await figma.loadFontAsync(prevailedFont);
        node.fontName = prevailedFont;
      } else if (options && options.smartStrategy === "strict") {
        return setCharactersWithStrictMatchFont(node, characters, fallbackFont);
      } else if (options && options.smartStrategy === "experimental") {
        return setCharactersWithSmartMatchFont(node, characters, fallbackFont);
      } else {
        const firstCharFont = node.getRangeFontName(0, 1);
        await figma.loadFontAsync(firstCharFont);
        node.fontName = firstCharFont;
      }
    } else {
      await figma.loadFontAsync({
        family: node.fontName.family,
        style: node.fontName.style,
      });
    }
  } catch (err) {
    console.warn(
      `Failed to load "${node.fontName["family"]} ${node.fontName["style"]}" font and replaced with fallback "${fallbackFont.family} ${fallbackFont.style}"`,
      err
    );
    await figma.loadFontAsync(fallbackFont);
    node.fontName = fallbackFont;
  }
  try {
    node.characters = characters;
    return true;
  } catch (err) {
    console.warn(`Failed to set characters. Skipped.`, err);
    return false;
  }
};

const setCharactersWithStrictMatchFont = async (
  node,
  characters,
  fallbackFont
) => {
  const fontHashTree = {};
  for (let i = 1; i < node.characters.length; i++) {
    const startIdx = i - 1;
    const startCharFont = node.getRangeFontName(startIdx, i);
    const startCharFontVal = `${startCharFont.family}::${startCharFont.style}`;
    while (i < node.characters.length) {
      i++;
      const charFont = node.getRangeFontName(i - 1, i);
      if (startCharFontVal !== `${charFont.family}::${charFont.style}`) {
        break;
      }
    }
    fontHashTree[`${startIdx}_${i}`] = startCharFontVal;
  }
  await figma.loadFontAsync(fallbackFont);
  node.fontName = fallbackFont;
  node.characters = characters;
  console.log(fontHashTree);
  await Promise.all(
    Object.keys(fontHashTree).map(async (range) => {
      console.log(range, fontHashTree[range]);
      const [start, end] = range.split("_");
      const [family, style] = fontHashTree[range].split("::");
      const matchedFont = {
        family,
        style,
      };
      await figma.loadFontAsync(matchedFont);
      return node.setRangeFontName(Number(start), Number(end), matchedFont);
    })
  );
  return true;
};

const getDelimiterPos = (str, delimiter, startIdx = 0, endIdx = str.length) => {
  const indices = [];
  let temp = startIdx;
  for (let i = startIdx; i < endIdx; i++) {
    if (
      str[i] === delimiter &&
      i + startIdx !== endIdx &&
      temp !== i + startIdx
    ) {
      indices.push([temp, i + startIdx]);
      temp = i + startIdx + 1;
    }
  }
  temp !== endIdx && indices.push([temp, endIdx]);
  return indices.filter(Boolean);
};

const buildLinearOrder = (node) => {
  const fontTree = [];
  const newLinesPos = getDelimiterPos(node.characters, "\n");
  newLinesPos.forEach(([newLinesRangeStart, newLinesRangeEnd], n) => {
    const newLinesRangeFont = node.getRangeFontName(
      newLinesRangeStart,
      newLinesRangeEnd
    );
    if (newLinesRangeFont === figma.mixed) {
      const spacesPos = getDelimiterPos(
        node.characters,
        " ",
        newLinesRangeStart,
        newLinesRangeEnd
      );
      spacesPos.forEach(([spacesRangeStart, spacesRangeEnd], s) => {
        const spacesRangeFont = node.getRangeFontName(
          spacesRangeStart,
          spacesRangeEnd
        );
        if (spacesRangeFont === figma.mixed) {
          const spacesRangeFont = node.getRangeFontName(
            spacesRangeStart,
            spacesRangeStart[0]
          );
          fontTree.push({
            start: spacesRangeStart,
            delimiter: " ",
            family: spacesRangeFont.family,
            style: spacesRangeFont.style,
          });
        } else {
          fontTree.push({
            start: spacesRangeStart,
            delimiter: " ",
            family: spacesRangeFont.family,
            style: spacesRangeFont.style,
          });
        }
      });
    } else {
      fontTree.push({
        start: newLinesRangeStart,
        delimiter: "\n",
        family: newLinesRangeFont.family,
        style: newLinesRangeFont.style,
      });
    }
  });
  return fontTree
    .sort((a, b) => +a.start - +b.start)
    .map(({ family, style, delimiter }) => ({ family, style, delimiter }));
};

const setCharactersWithSmartMatchFont = async (
  node,
  characters,
  fallbackFont
) => {
  const rangeTree = buildLinearOrder(node);
  const fontsToLoad = uniqBy(
    rangeTree,
    ({ family, style }) => `${family}::${style}`
  ).map(({ family, style }) => ({
    family,
    style,
  }));

  await Promise.all([...fontsToLoad, fallbackFont].map(figma.loadFontAsync));

  node.fontName = fallbackFont;
  node.characters = characters;

  let prevPos = 0;
  rangeTree.forEach(({ family, style, delimiter }) => {
    if (prevPos < node.characters.length) {
      const delimeterPos = node.characters.indexOf(delimiter, prevPos);
      const endPos =
        delimeterPos > prevPos ? delimeterPos : node.characters.length;
      const matchedFont = {
        family,
        style,
      };
      node.setRangeFontName(prevPos, endPos, matchedFont);
      prevPos = endPos + 1;
    }
  });
  return true;
};

// 텍스트 노드 스캐닝 함수 수정
async function scanTextNodes(nodeId) {
  console.log(`Starting to scan text nodes from node ID: ${nodeId}`);
  // 이 부분을 수정: getNodeById 대신 getNodeByIdAsync 사용
  const node = await figma.getNodeByIdAsync(nodeId);
  
  if (!node) {
    console.error(`Node with ID ${nodeId} not found`);
    throw new Error(`Node with ID ${nodeId} not found`);
  }

  const textNodes = [];
  
  async function findTextNodes(node, parentPath = [], depth = 0) {
    // Skip invisible nodes
    if (node.visible === false) return;
    
    // Get the path to this node including its name
    const nodePath = [...parentPath, node.name || `Unnamed ${node.type}`];
    
    if (node.type === 'TEXT') {
      const safeFont = {};
      
      // Safely extract font information to avoid Symbol serialization issues
      if (node.fontName) {
        if (typeof node.fontName === 'object') {
          if ('family' in node.fontName) safeFont.family = node.fontName.family;
          if ('style' in node.fontName) safeFont.style = node.fontName.style;
        }
      }
      
      // Create a safe representation of the text node
      const safeTextNode = {
        id: node.id,
        name: node.name,
        type: node.type,
        characters: node.characters,
        fontSize: node.fontSize,
        fontName: safeFont,
        x: node.x,
        y: node.y,
        width: node.width,
        height: node.height,
        path: nodePath.join(' > '),
        depth: depth
      };
      
      // Add a visual feedback - highlight the text temporarily
      const originalFills = [...node.fills];
      node.fills = [{
        type: 'SOLID',
        color: { r: 1, g: 0.5, b: 0 },
        opacity: 0.3
      }];
      
      // Reset highlight after a short delay
      setTimeout(() => {
        node.fills = originalFills;
      }, 500);
      
      textNodes.push(safeTextNode);
    }
    
    // Recursively process children of container nodes
    if ('children' in node) {
      for (const child of node.children) {
        await findTextNodes(child, nodePath, depth + 1);
      }
    }
  }
  
  try {
    await findTextNodes(node);
    
    // 터미널에 출력을 위한 포맷팅
    const limitedNodes = textNodes.length > 100 ? textNodes.slice(0, 100) : textNodes;
    
    console.log('\n===== TEXT NODES SCAN RESULTS =====');
    console.log(`Total text nodes found: ${textNodes.length}`);
    if (textNodes.length > 100) {
      console.log(`Showing first 100 nodes only`);
    }
    
    // JSON으로 출력
    console.log('\nDETAILED RESULTS:');
    console.log(JSON.stringify(limitedNodes, null, 2));
    
    // 간단한 요약 테이블 출력
    console.log('\nSUMMARY:');
    console.log('ID | Name | Text | Path');
    console.log('--------------------------------------------------');
    limitedNodes.forEach(node => {
      const truncatedText = node.characters.length > 30 
        ? node.characters.substring(0, 27) + '...' 
        : node.characters;
      const truncatedPath = node.path.length > 40
        ? '...' + node.path.substring(node.path.length - 37)
        : node.path;
      console.log(`${node.id} | ${node.name || 'Unnamed'} | ${truncatedText} | ${truncatedPath}`);
    });
    console.log('===== END OF SCAN RESULTS =====\n');
    
    // 성공적으로 실행되었음을 클라이언트에 알림
    return {
      success: true,
      message: `Scanned ${textNodes.length} text nodes. See terminal for detailed results.`,
      count: textNodes.length
    };
  } catch (error) {
    console.error('Error scanning text nodes:', error);
    throw new Error(`Error scanning text nodes: ${error.message}`);
  }
}

// 텍스트 주석 추가 함수
async function addTextAnnotations(nodeId, annotationStyle = 'speech_bubble', includeFrames = false) {
  console.log(`Starting to add annotations to node ID: ${nodeId} with style: ${annotationStyle}`);
  
  // 노드 가져오기
  const node = await figma.getNodeByIdAsync(nodeId);
  
  if (!node) {
    console.error(`Node with ID ${nodeId} not found`);
    throw new Error(`Node with ID ${nodeId} not found`);
  }
  
  // 어노테이션 추가 결과 저장
  const annotations = [];
  const textNodesFound = [];
  
  // 재귀적으로 텍스트 노드 찾기
  async function findTextNodes(node, parentPath = []) {
    // 보이지 않는 노드는 건너뛰기
    if (node.visible === false) return;
    
    // 이 노드까지의 경로 가져오기
    const nodePath = [...parentPath, node.name || `Unnamed ${node.type}`];
    
    if (node.type === 'TEXT') {
      // 안전하게 텍스트 노드 정보 저장
      const safeTextNode = {
        id: node.id,
        name: node.name || 'Unnamed Text',
        characters: node.characters || '',
        x: node.x,
        y: node.y,
        width: node.width || 0,
        height: node.height || 0,
        path: nodePath.join(' > ')
      };
      
      // undefined 체크 추가
      if (safeTextNode.characters && safeTextNode.characters.length > 0) {
        textNodesFound.push(safeTextNode);
      } else {
        console.log(`Skipping empty text node: ${safeTextNode.name}`);
      }
    }
    
    // 컨테이너 노드의 자식 노드 재귀적으로 처리
    if ('children' in node && node.children) {
      for (const child of node.children) {
        await findTextNodes(child, nodePath);
      }
    }
  }
  
  try {
    // 텍스트 노드 찾기
    await findTextNodes(node);
    
    console.log(`Found ${textNodesFound.length} text nodes for annotation`);
    
    // 텍스트 노드가 없으면 조기 종료
    if (textNodesFound.length === 0) {
      return {
        success: false,
        message: 'No text nodes found to annotate',
        count: 0
      };
    }
    
    // 어노테이션 추가하기
    for (const textNode of textNodesFound) {
      try {
        console.log(`Adding annotation to: ${textNode.name}`);
        
        // 어노테이션 스타일에 따라 다른 방식으로 추가
        let annotation;
        
        // 텍스트 내용 검사 (안전하게)
        const textContent = textNode.characters || '';
        
        switch (annotationStyle) {
          case 'speech_bubble':
            // 스피치 버블 프레임 생성
            annotation = figma.createFrame();
            annotation.name = `Annotation: ${textNode.name}`;
            annotation.x = textNode.x + textNode.width + 20;
            annotation.y = textNode.y;
            annotation.fills = [{ type: 'SOLID', color: { r: 1, g: 0.95, b: 0.8 } }];
            annotation.cornerRadius = 8;
            
            // 말풍선 모양 만들기
            const bubble = figma.createPolygon();
            bubble.name = 'Pointer';
            bubble.x = -10;
            bubble.y = 10;
            bubble.rotation = -90;
            bubble.fills = [{ type: 'SOLID', color: { r: 1, g: 0.95, b: 0.8 } }];
            annotation.appendChild(bubble);
            
            // 어노테이션 텍스트 추가
            const annotationText = figma.createText();
            annotationText.characters = `"${textContent.substring(0, 50)}${textContent.length > 50 ? '...' : ''}"`;
            annotationText.fontSize = 12;
            annotationText.x = 10;
            annotationText.y = 10;
            annotation.appendChild(annotationText);
            annotation.resize(Math.max(textContent.length * 7, 100), 50);
            break;
            
          case 'side_note':
            // 사이드 노트 프레임 생성
            annotation = figma.createFrame();
            annotation.name = `Note: ${textNode.name}`;
            annotation.x = textNode.x;
            annotation.y = textNode.y - 50;
            annotation.fills = [{ type: 'SOLID', color: { r: 0.9, g: 0.9, b: 1 } }];
            annotation.strokeWeight = 1;
            annotation.strokes = [{ type: 'SOLID', color: { r: 0.5, g: 0.5, b: 0.8 } }];
            
            // 어노테이션 텍스트 추가
            const noteText = figma.createText();
            noteText.characters = `Note: ${textContent.substring(0, 50)}${textContent.length > 50 ? '...' : ''}`;
            noteText.fontSize = 11;
            noteText.x = 8;
            noteText.y = 8;
            annotation.appendChild(noteText);
            annotation.resize(Math.max(textContent.length * 6, 150), 40);
            break;
            
          case 'highlight':
          default:
            // 하이라이트 효과는 별도의 프레임 없이 직접 적용
            const textNodeRef = figma.getNodeById(textNode.id);
            if (textNodeRef) {
              // 원래 fills 저장
              const originalFills = textNodeRef.fills || [];
              // 하이라이트 적용
              textNodeRef.fills = [
                { type: 'SOLID', color: { r: 1, g: 0.9, b: 0.4 }, opacity: 0.3 },
                ...originalFills
              ];
              
              annotation = textNodeRef;
            }
            break;
        }
        
        if (annotation) {
          annotations.push({
            id: annotation.id,
            type: annotationStyle,
            relatedTextNodeId: textNode.id,
            name: annotation.name
          });
        }
      } catch (error) {
        console.error(`Error adding annotation to ${textNode.name}:`, error);
      }
    }
    
    console.log(`Successfully added ${annotations.length} annotations`);
    
    // 리포트 프레임 생성 (선택 사항)
    if (includeFrames) {
      try {
        const reportFrame = figma.createFrame();
        reportFrame.name = `Annotations Report: ${node.name}`;
        reportFrame.x = node.x + node.width + 100;
        reportFrame.y = node.y;
        reportFrame.resize(400, 600);
        reportFrame.fills = [{ type: 'SOLID', color: { r: 1, g: 1, b: 1 } }];
        
        const reportTitle = figma.createText();
        reportTitle.characters = `Annotations for "${node.name}"`;
        reportTitle.fontSize = 16;
        reportTitle.x = 20;
        reportTitle.y = 20;
        reportFrame.appendChild(reportTitle);
        
        const reportDescription = figma.createText();
        reportDescription.characters = `${textNodesFound.length} text elements found\n${annotations.length} annotations created`;
        reportDescription.fontSize = 12;
        reportDescription.x = 20;
        reportDescription.y = 50;
        reportFrame.appendChild(reportDescription);
        
        // 보고서에 각 텍스트 요소 목록 추가
        const listStartY = 100;
        let currentY = listStartY;
        
        for (let i = 0; i < Math.min(textNodesFound.length, 20); i++) {
          const textItem = textNodesFound[i];
          const listItem = figma.createText();
          const displayText = textItem.characters || "";
          listItem.characters = `${i + 1}. "${displayText.substring(0, 30)}${displayText.length > 30 ? '...' : ''}"`;
          listItem.fontSize = 11;
          listItem.x = 20;
          listItem.y = currentY;
          reportFrame.appendChild(listItem);
          
          currentY += 25;
        }
        
        // 목록이 잘렸으면 표시
        if (textNodesFound.length > 20) {
          const moreText = figma.createText();
          moreText.characters = `... and ${textNodesFound.length - 20} more text elements`;
          moreText.fontSize = 11;
          moreText.x = 20;
          moreText.y = currentY + 10;
          reportFrame.appendChild(moreText);
        }
        
        console.log('Created annotations report frame');
      } catch (error) {
        console.error('Error creating report frame:', error);
      }
    }
    
    // 결과 반환
    return {
      success: true,
      message: `Added ${annotations.length} annotations to ${textNodesFound.length} text nodes`,
      count: annotations.length,
      textNodesCount: textNodesFound.length
    };
    
  } catch (error) {
    console.error('Error in addTextAnnotations:', error);
    throw new Error(`Error adding annotations: ${error.message}`);
  }
}

// UX 텍스트 분석 함수
async function analyzeUXText(nodeId, criteria = ["clarity", "consistency", "tone", "action-oriented", "accessibility"]) {
  const node = await figma.getNodeByIdAsync(nodeId);
  if (!node) {
    throw new Error(`Node not found with ID: ${nodeId}`);
  }
  
  // 텍스트 노드 찾기 (재사용)
  const scanResult = await scanTextNodes(nodeId);
  const textNodes = scanResult.textNodes;
  
  if (textNodes.length === 0) {
    return {
      success: false,
      message: "No text nodes found in the selected element",
      analysisResults: []
    };
  }
  
  // 간단한 분석 수행 (실제로는 더 복잡한 알고리즘 사용 가능)
  const analysisResults = [];
  
  for (const textNode of textNodes) {
    const nodeAnalysis = {
      id: textNode.id,
      name: textNode.name,
      text: textNode.characters,
      analysis: {}
    };
    
    // 기준별 분석
    if (criteria.includes("clarity")) {
      nodeAnalysis.analysis.clarity = analyzeClarity(textNode.characters);
    }
    
    if (criteria.includes("consistency")) {
      nodeAnalysis.analysis.consistency = analyzeConsistency(textNode.characters, textNodes);
    }
    
    if (criteria.includes("tone")) {
      nodeAnalysis.analysis.tone = analyzeTone(textNode.characters);
    }
    
    if (criteria.includes("action-oriented")) {
      nodeAnalysis.analysis.actionOriented = analyzeActionOrientation(textNode.characters);
    }
    
    if (criteria.includes("accessibility")) {
      nodeAnalysis.analysis.accessibility = analyzeAccessibility(textNode.characters, textNode.fontSize);
    }
    
    analysisResults.push(nodeAnalysis);
  }
  
  // 전체 결과 요약
  const summary = {
    totalTexts: textNodes.length,
    criteriaAnalyzed: criteria,
    overallScore: calculateOverallScore(analysisResults),
    recommendations: generateRecommendations(analysisResults)
  };
  
  return {
    success: true,
    message: `Analyzed ${textNodes.length} text nodes with ${criteria.length} criteria`,
    summary: summary,
    analysisResults: analysisResults
  };
}

// UX 리포트 생성 함수
async function generateUXReport(params) {
  const { nodeId, reportTitle = "UX Writing Analysis Report", includeScreenshots = true, reportStyle = "detailed", position = { x: 100, y: 100 } } = params;
  
  const node = await figma.getNodeByIdAsync(nodeId);
  if (!node) {
    throw new Error(`Node not found with ID: ${nodeId}`);
  }
  
  // 텍스트 분석 (재사용)
  const analysis = await analyzeUXText(nodeId);
  
  if (!analysis.success) {
    return {
      success: false,
      message: analysis.message
    };
  }
  
  // 리포트 프레임 생성
  const reportFrame = figma.createFrame();
  reportFrame.name = reportTitle;
  reportFrame.x = position.x;
  reportFrame.y = position.y;
  
  // 스타일 설정
  reportFrame.fills = [{
    type: "SOLID",
    color: { r: 1, g: 1, b: 1 }
  }];
  
  reportFrame.strokes = [{
    type: "SOLID",
    color: { r: 0.9, g: 0.9, b: 0.9 }
  }];
  
  reportFrame.strokeWeight = 1;
  reportFrame.cornerRadius = 8;
  
  // 리포트 내용 추가
  await createReportContent(reportFrame, analysis, node, reportStyle, includeScreenshots);
  
  return {
    success: true,
    message: `Generated UX Writing report with ${analysis.analysisResults.length} text nodes analyzed`,
    reportFrameId: reportFrame.id
  };
}

// 리포트 내용 생성 헬퍼 함수
async function createReportContent(reportFrame, analysis, sourceNode, style, includeScreenshots) {
  // 폰트 로드
  await figma.loadFontAsync({ family: "Inter", style: "Bold" });
  await figma.loadFontAsync({ family: "Inter", style: "Regular" });
  await figma.loadFontAsync({ family: "Inter", style: "Medium" });
  
  let currentY = 30;
  const padding = 40;
  const width = style === "minimal" ? 600 : 800;
  
  // 제목
  const titleText = figma.createText();
  reportFrame.appendChild(titleText);
  titleText.characters = reportFrame.name;
  titleText.fontSize = 24;
  titleText.fontName = { family: "Inter", style: "Bold" };
  titleText.x = padding;
  titleText.y = currentY;
  
  currentY += titleText.height + 20;
  
  // 요약 정보
  const summaryText = figma.createText();
  reportFrame.appendChild(summaryText);
  summaryText.characters = `Analysis of "${sourceNode.name}" (${sourceNode.type})\n` +
    `Total text elements: ${analysis.summary.totalTexts}\n` +
    `Overall UX writing score: ${analysis.summary.overallScore}/10`;
  summaryText.fontSize = 14;
  summaryText.fontName = { family: "Inter", style: "Regular" };
  summaryText.x = padding;
  summaryText.y = currentY;
  
  currentY += summaryText.height + 30;
  
  // 스크린샷 (옵션)
  if (includeScreenshots) {
    try {
      // 노드 이미지 생성 (png로)
      const bytes = await sourceNode.exportAsync({
        format: 'PNG',
        constraint: { type: 'SCALE', value: 0.5 }
      });
      
      // 이미지 프레임으로 표시
      const imageFrame = figma.createFrame();
      reportFrame.appendChild(imageFrame);
      imageFrame.name = "Screenshot";
      imageFrame.x = padding;
      imageFrame.y = currentY;
      imageFrame.resize(width - (padding * 2), 200);
      imageFrame.fills = [];
      
      const caption = figma.createText();
      reportFrame.appendChild(caption);
      caption.characters = "Screenshot of analyzed element";
      caption.fontSize = 12;
      caption.fontName = { family: "Inter", style: "Regular" };
      caption.x = padding;
      caption.y = currentY + 210;
      
      currentY += 240;
    } catch (error) {
      console.error("Error creating screenshot:", error);
    }
  }
  
  // 권장 사항
  const recommendationsTitle = figma.createText();
  reportFrame.appendChild(recommendationsTitle);
  recommendationsTitle.characters = "Recommendations";
  recommendationsTitle.fontSize = 18;
  recommendationsTitle.fontName = { family: "Inter", style: "Bold" };
  recommendationsTitle.x = padding;
  recommendationsTitle.y = currentY;
  
  currentY += recommendationsTitle.height + 10;
  
  const recommendationsText = figma.createText();
  reportFrame.appendChild(recommendationsText);
  recommendationsText.characters = analysis.summary.recommendations.join("\n• ");
  recommendationsText.characters = "• " + recommendationsText.characters;
  recommendationsText.fontSize = 14;
  recommendationsText.fontName = { family: "Inter", style: "Regular" };
  recommendationsText.x = padding;
  recommendationsText.y = currentY;
  
  currentY += recommendationsText.height + 30;
  
  // 상세 분석 (스타일에 따라 다름)
  if (style !== "minimal") {
    const detailsTitle = figma.createText();
    reportFrame.appendChild(detailsTitle);
    detailsTitle.characters = "Detailed Analysis";
    detailsTitle.fontSize = 18;
    detailsTitle.fontName = { family: "Inter", style: "Bold" };
    detailsTitle.x = padding;
    detailsTitle.y = currentY;
    
    currentY += detailsTitle.height + 15;
    
    // 분석 결과 표시 (최대 10개까지만)
    const maxItems = style === "detailed" ? 10 : 5;
    const itemsToShow = analysis.analysisResults.slice(0, maxItems);
    
    for (const item of itemsToShow) {
      const itemFrame = figma.createFrame();
      reportFrame.appendChild(itemFrame);
      itemFrame.name = `Analysis: ${item.name}`;
      itemFrame.x = padding;
      itemFrame.y = currentY;
      itemFrame.fills = [{
        type: "SOLID",
        color: { r: 0.98, g: 0.98, b: 0.98 }
      }];
      itemFrame.cornerRadius = 4;
      
      let itemY = 15;
      
      // 텍스트 내용
      const textContent = figma.createText();
      itemFrame.appendChild(textContent);
      textContent.characters = `"${item.text}"`;
      textContent.fontSize = 14;
      textContent.fontName = { family: "Inter", style: "Medium" };
      textContent.x = 15;
      textContent.y = itemY;
      
      itemY += textContent.height + 10;
      
      // 분석 점수 표시
      for (const [criteriaKey, criteriaValue] of Object.entries(item.analysis)) {
        const criteriaText = figma.createText();
        itemFrame.appendChild(criteriaText);
        criteriaText.characters = `${capitalizeFirstLetter(criteriaKey)}: ${criteriaValue.score}/10 - ${criteriaValue.note}`;
        criteriaText.fontSize = 12;
        criteriaText.fontName = { family: "Inter", style: "Regular" };
        criteriaText.x = 15;
        criteriaText.y = itemY;
        
        itemY += criteriaText.height + 5;
      }
      
      // 프레임 크기 조정
      itemFrame.resize(width - (padding * 2), itemY + 15);
      
      currentY += itemFrame.height + 15;
    }
  }
  
  // 추가 정보 (visual 스타일인 경우)
  if (style === "visual") {
    // 여기에 차트나 그래프 등 추가 가능
  }
  
  // 리포트 프레임 크기 조정
  reportFrame.resize(width, currentY + padding);
}

// 텍스트 분석 헬퍼 함수들
function analyzeClarity(text) {
  // 실제로는 더 복잡한 알고리즘 사용 가능
  const score = calculateClarityScore(text);
  
  return {
    score: score,
    note: getClarityNote(score)
  };
}

function analyzeConsistency(text, allTexts) {
  // 유사한 텍스트 노드와 비교
  const score = calculateConsistencyScore(text, allTexts);
  
  return {
    score: score,
    note: getConsistencyNote(score)
  };
}

function analyzeTone(text) {
  const score = calculateToneScore(text);
  
  return {
    score: score,
    note: getToneNote(score)
  };
}

function analyzeActionOrientation(text) {
  const score = calculateActionScore(text);
  
  return {
    score: score,
    note: getActionNote(score)
  };
}

function analyzeAccessibility(text, fontSize) {
  const score = calculateAccessibilityScore(text, fontSize);
  
  return {
    score: score,
    note: getAccessibilityNote(score, fontSize)
  };
}

function calculateClarityScore(text) {
  // 단어 길이, 문장 길이 등 기준으로 점수 계산
  const wordCount = text.split(/\s+/).length;
  const sentenceCount = text.split(/[.!?]+/).filter(Boolean).length || 1;
  const avgWordsPerSentence = wordCount / sentenceCount;
  
  // 이상적인 문장은 단어가 너무 많지 않아야 함 (가독성)
  // 10점 만점에 점수 반환
  if (avgWordsPerSentence <= 8) return 10;
  if (avgWordsPerSentence <= 12) return 8;
  if (avgWordsPerSentence <= 15) return 6;
  if (avgWordsPerSentence <= 20) return 4;
  return 2;
}

function getClarityNote(score) {
  if (score >= 9) return "Excellent clarity, very easy to understand";
  if (score >= 7) return "Good clarity, easy to understand";
  if (score >= 5) return "Moderate clarity, could be simplified";
  if (score >= 3) return "Limited clarity, consider simplifying";
  return "Poor clarity, difficult to understand";
}

function calculateConsistencyScore(text, allTexts) {
  // 실제로는 더 복잡한 일관성 검사 사용
  // 여기서는 간단한 구현만 제공
  return 8; // 예시 점수
}

function getConsistencyNote(score) {
  if (score >= 9) return "Perfectly consistent with other text elements";
  if (score >= 7) return "Good consistency with other UI text";
  if (score >= 5) return "Moderate consistency, some terms could be standardized";
  if (score >= 3) return "Limited consistency, consider standardizing terminology";
  return "Poor consistency, significant terminology variations";
}

function calculateToneScore(text) {
  // 실제로는 더 복잡한 톤 분석 사용
  // 여기서는 간단한 구현만 제공
  return 7; // 예시 점수
}

function getToneNote(score) {
  if (score >= 9) return "Perfect tone for the context";
  if (score >= 7) return "Good tone, appropriate for the context";
  if (score >= 5) return "Acceptable tone, slight adjustments recommended";
  if (score >= 3) return "Tone needs improvement for this context";
  return "Inappropriate tone for this context";
}

function calculateActionScore(text) {
  // 행동 지향적 문구인지 확인
  const actionVerbs = ["click", "tap", "select", "choose", "enter", "type", "submit", "confirm", "cancel", "save"];
  const lowerText = text.toLowerCase();
  
  // 행동 동사 포함 여부 확인
  const hasActionVerb = actionVerbs.some(verb => lowerText.includes(verb));
  
  // 명령형 문장인지 확인 (첫 단어가 동사)
  const firstWord = lowerText.split(/\s+/)[0];
  const startsWithVerb = actionVerbs.includes(firstWord);
  
  if (startsWithVerb) return 10;
  if (hasActionVerb) return 8;
  return 5;
}

function getActionNote(score) {
  if (score >= 9) return "Excellent action-oriented language";
  if (score >= 7) return "Good action-oriented language";
  if (score >= 5) return "Could be more action-oriented";
  return "Not action-oriented, consider revising";
}

function calculateAccessibilityScore(text, fontSize) {
  // 접근성 점수 계산 (글꼴 크기, 텍스트 길이 등 고려)
  let score = 10;
  
  // 글꼴 크기가 너무 작으면 감점
  if (fontSize < 12) score -= 3;
  if (fontSize < 10) score -= 3;
  
  // 텍스트가 너무 길면 감점
  if (text.length > 100) score -= 2;
  if (text.length > 200) score -= 2;
  
  // 올 대문자 텍스트는 감점
  if (text === text.toUpperCase() && text.length > 5) score -= 3;
  
  return Math.max(1, score);
}

function getAccessibilityNote(score, fontSize) {
  let note = "";
  
  if (fontSize < 12) {
    note = "Font size may be too small for good readability";
  } else if (score >= 9) {
    note = "Excellent accessibility";
  } else if (score >= 7) {
    note = "Good accessibility";
  } else if (score >= 5) {
    note = "Average accessibility, consider improvements";
  } else {
    note = "Poor accessibility, needs improvement";
  }
  
  return note;
}

function capitalizeFirstLetter(string) {
  return string.charAt(0).toUpperCase() + string.slice(1);
}

function calculateOverallScore(analysisResults) {
  if (analysisResults.length === 0) return 0;
  
  let totalScore = 0;
  let totalCriteria = 0;
  
  for (const result of analysisResults) {
    for (const criteria of Object.values(result.analysis)) {
      totalScore += criteria.score;
      totalCriteria++;
    }
  }
  
  return totalCriteria > 0 ? Math.round((totalScore / totalCriteria) * 10) / 10 : 0;
}

function generateRecommendations(analysisResults) {
  const recommendations = [];
  const issues = {
    clarity: false,
    consistency: false,
    tone: false,
    actionOriented: false,
    accessibility: false,
    fontSize: false
  };
  
  // 문제점 식별
  for (const result of analysisResults) {
    for (const [key, value] of Object.entries(result.analysis)) {
      if (value.score < 6) {
        issues[key] = true;
        
        // 특정 문제에 대한 구체적인 권장사항
        if (key === "clarity" && !recommendations.includes("Simplify long and complex sentences")) {
          recommendations.push("Simplify long and complex sentences");
        }
        
        if (key === "consistency" && !recommendations.includes("Standardize terminology across UI elements")) {
          recommendations.push("Standardize terminology across UI elements");
        }
        
        if (key === "tone" && !recommendations.includes("Adjust tone for more user-friendly experience")) {
          recommendations.push("Adjust tone for more user-friendly experience");
        }
        
        if (key === "actionOriented" && !recommendations.includes("Use action verbs and clear instructions for buttons and links")) {
          recommendations.push("Use action verbs and clear instructions for buttons and links");
        }
        
        if (key === "accessibility" && !recommendations.includes("Improve text readability with proper sizing and formatting")) {
          recommendations.push("Improve text readability with proper sizing and formatting");
        }
      }
      
      // 글꼴 크기 문제
      if (key === "accessibility" && value.note.includes("font size")) {
        issues.fontSize = true;
        if (!recommendations.includes("Increase font size for better readability (minimum 12px recommended)")) {
          recommendations.push("Increase font size for better readability (minimum 12px recommended)");
        }
      }
    }
  }
  
  // 일반적인 권장사항 추가
  if (recommendations.length === 0) {
    recommendations.push("UX writing is generally good, continue maintaining current standards");
  }
  
  if (recommendations.length < 3) {
    recommendations.push("Consider A/B testing your UX text for performance improvements");
  }
  
  return recommendations;
}

// UX 텍스트 최적화 함수
async function optimizeUXText(params) {
  const { nodeId, optimizationType = "clarity", customInstructions = "", applyChanges = true } = params;
  
  const node = await figma.getNodeByIdAsync(nodeId);
  if (!node) {
    throw new Error(`Node not found with ID: ${nodeId}`);
  }
  
  if (node.type !== 'TEXT') {
    throw new Error(`Node with ID ${nodeId} is not a text node`);
  }
  
  const originalText = node.characters;
  let optimizedText = "";
  
  // 최적화 유형에 따른 텍스트 개선
  switch (optimizationType) {
    case "clarity":
      optimizedText = optimizeForClarity(originalText);
      break;
    case "conciseness":
      optimizedText = optimizeForConciseness(originalText);
      break;
    case "friendliness":
      optimizedText = optimizeForFriendliness(originalText);
      break;
    case "technical":
      optimizedText = optimizeForTechnical(originalText);
      break;
    case "persuasive":
      optimizedText = optimizeForPersuasive(originalText);
      break;
    default:
      optimizedText = optimizeForClarity(originalText);
  }
  
  // 사용자 지정 지침 반영 (실제로는 API 호출 또는 더 복잡한 로직을 사용할 수 있음)
  if (customInstructions) {
    // 예시로 간단한 접두사 추가
    optimizedText = `${optimizedText} ${customInstructions}`;
  }
  
  // 변경사항 적용 (옵션)
  if (applyChanges) {
    // 기존 스타일 보존을 위해 로드
    await figma.loadFontAsync(node.fontName);
    node.characters = optimizedText;
  }
  
  return {
    success: true,
    nodeId: node.id,
    originalText: originalText,
    optimizedText: optimizedText,
    optimizationType: optimizationType,
    changes: applyChanges ? "applied" : "suggested"
  };
}

// 텍스트 최적화 헬퍼 함수들
function optimizeForClarity(text) {
  // 예시 구현 (실제로는 더 복잡한 알고리즘 사용)
  // 텍스트를 보다 명확하게 만드는 간단한 규칙 적용
  let result = text;
  
  // 능동태로 변경, 간결한 어휘 사용 등
  result = result.replace(/you are able to/gi, 'you can');
  result = result.replace(/in order to/gi, 'to');
  result = result.replace(/utilize/gi, 'use');
  result = result.replace(/implement/gi, 'add');
  
  return result;
}

function optimizeForConciseness(text) {
  // 예시 구현
  let result = text;
  
  // 불필요한 단어 제거, 간결한 표현으로 변경
  result = result.replace(/at this point in time/gi, 'now');
  result = result.replace(/in the event that/gi, 'if');
  result = result.replace(/due to the fact that/gi, 'because');
  result = result.replace(/for the purpose of/gi, 'for');
  
  return result;
}

function optimizeForFriendliness(text) {
  // 예시 구현
  let result = text;
  
  // 친근한 표현으로 변경
  if (!/thank|thanks/i.test(result)) {
    result = result.replace(/\.$/, '. Thanks!');
  }
  
  result = result.replace(/^error:/i, "Oops!");
  result = result.replace(/is required$/i, "is needed");
  
  return result;
}

function optimizeForTechnical(text) {
  // 예시 구현
  let result = text;
  
  // 전문적인 어휘 사용
  result = result.replace(/show/gi, 'display');
  result = result.replace(/use/gi, 'utilize');
  result = result.replace(/check/gi, 'verify');
  
  return result;
}

function optimizeForPersuasive(text) {
  // 예시 구현
  let result = text;
  
  // 설득력 있는 표현 추가
  if (!/now|today/i.test(result)) {
    result += " Start now!";
  }
  
  result = result.replace(/^sign up/i, "Join thousands of users");
  result = result.replace(/^buy/i, "Get exclusive access to");
  
  return result;
}

function translateText(text, language) {
  // 예시 구현 (실제로는 번역 API 호출)
  // 여기서는 간단한 예시 번역만 제공
  
  const translations = {
    "ko": {
      "Hello": "안녕하세요",
      "Sign In": "로그인",
      "Sign Up": "회원가입",
      "Submit": "제출",
      "Cancel": "취소",
      "Continue": "계속하기",
      "Welcome": "환영합니다",
      "Settings": "설정",
      "Profile": "프로필",
      "Password": "비밀번호",
      "Email": "이메일",
      "Username": "사용자 이름",
      "Forgot Password?": "비밀번호를 잊으셨나요?",
      "Back": "뒤로",
      "Next": "다음"
    },
    "ja": {
      "Hello": "こんにちは",
      "Sign In": "サインイン",
      "Sign Up": "サインアップ",
      "Submit": "提出",
      "Cancel": "キャンセル",
      "Continue": "続ける",
      "Welcome": "ようこそ",
      "Settings": "設定",
      "Profile": "プロフィール",
      "Password": "パスワード",
      "Email": "メールアドレス",
      "Username": "ユーザー名",
      "Forgot Password?": "パスワードをお忘れですか？",
      "Back": "戻る",
      "Next": "次へ"
    },
    "zh": {
      "Hello": "你好",
      "Sign In": "登录",
      "Sign Up": "注册",
      "Submit": "提交",
      "Cancel": "取消",
      "Continue": "继续",
      "Welcome": "欢迎",
      "Settings": "设置",
      "Profile": "个人资料",
      "Password": "密码",
      "Email": "电子邮件",
      "Username": "用户名",
      "Forgot Password?": "忘记密码？",
      "Back": "返回",
      "Next": "下一步"
    },
    "es": {
      "Hello": "Hola",
      "Sign In": "Iniciar sesión",
      "Sign Up": "Registrarse",
      "Submit": "Enviar",
      "Cancel": "Cancelar",
      "Continue": "Continuar",
      "Welcome": "Bienvenido",
      "Settings": "Configuración",
      "Profile": "Perfil",
      "Password": "Contraseña",
      "Email": "Correo electrónico",
      "Username": "Nombre de usuario",
      "Forgot Password?": "¿Olvidó su contraseña?",
      "Back": "Atrás",
      "Next": "Siguiente"
    },
    "fr": {
      "Hello": "Bonjour",
      "Sign In": "Se connecter",
      "Sign Up": "S'inscrire",
      "Submit": "Soumettre",
      "Cancel": "Annuler",
      "Continue": "Continuer",
      "Welcome": "Bienvenue",
      "Settings": "Paramètres",
      "Profile": "Profil",
      "Password": "Mot de passe",
      "Email": "Courriel",
      "Username": "Nom d'utilisateur",
      "Forgot Password?": "Mot de passe oublié ?",
      "Back": "Retour",
      "Next": "Suivant"
    }
  };
  
  // 번역 사전에 있는 언어인지 확인
  if (!translations[language]) {
    // 지원되지 않는 언어는 원문에 언어 코드 접두사 추가
    return `[${language}] ${text}`;
  }
  
  // 단어 단위로 텍스트 분할
  const words = text.split(/(\s+)/);
  let translatedText = "";
  
  // 단어별로 번역
  for (const word of words) {
    if (/\s+/.test(word)) {
      // 공백 유지
      translatedText += word;
    } else {
      // 사전에 있는 단어인지 확인
      const translatedWord = translations[language][word];
      if (translatedWord) {
        translatedText += translatedWord;
      } else {
        // 사전에 없는 단어는 그대로 유지
        translatedText += word;
      }
    }
  }
  
  // 번역 사전에 정확히 일치하는 전체 문장이 있는지 확인
  if (translations[language][text]) {
    return translations[language][text];
  }
  
  return translatedText || `[${language}] ${text}`;
}

// 로컬라이징 함수
async function localizeText(params) {
  const { nodeId, languages, createVisualFrame = true, adaptLayout = false } = params;
  
  if (!languages || languages.length === 0) {
    throw new Error("No languages specified for localization");
  }
  
  const node = await figma.getNodeByIdAsync(nodeId);
  if (!node) {
    throw new Error(`Node not found with ID: ${nodeId}`);
  }
  
  let textNodes = [];
  
  // 단일 텍스트 노드인 경우
  if (node.type === 'TEXT') {
    textNodes = [node];
  } 
  // 그룹/프레임 등에서 텍스트 노드 찾기
  else if ('children' in node) {
    const scanResult = await scanTextNodes(nodeId);
    textNodes = await Promise.all(scanResult.textNodes.map(t => figma.getNodeByIdAsync(t.id)));
    textNodes = textNodes.filter(Boolean);
  }
  
  if (textNodes.length === 0) {
    throw new Error("No text nodes found for localization");
  }
  
  const localizationResults = [];
  let visualizationFrame = null;
  
  // 로컬라이징 결과 시각화 프레임 생성
  if (createVisualFrame) {
    visualizationFrame = figma.createFrame();
    visualizationFrame.name = `Localization: ${node.name}`;
    visualizationFrame.x = node.x + (node.width ? node.width + 50 : 300);
    visualizationFrame.y = node.y;
    
    const titleText = figma.createText();
    await figma.loadFontAsync({ family: "Inter", style: "Bold" });
    visualizationFrame.appendChild(titleText);
    titleText.characters = "Localization Results";
    titleText.fontSize = 16;
    titleText.x = 16;
    titleText.y = 16;
  }
  
  let currentY = createVisualFrame ? 50 : 0;
  let maxWidth = 0;
  
  // 각 텍스트 노드에 대해 번역 수행
  for (let i = 0; i < textNodes.length; i++) {
    const textNode = textNodes[i];
    const originalText = textNode.characters;
    
    const translationsTable = {};
    const translations = {};
    
    // 각 언어로 번역 (실제로는 API 호출)
    for (const language of languages) {
      const translatedText = translateText(originalText, language);
      translations[language] = translatedText;
      
      // 시각화 프레임에 번역 추가
      if (createVisualFrame && visualizationFrame) {
        const rowFrame = figma.createFrame();
        visualizationFrame.appendChild(rowFrame);
        rowFrame.name = `Row: ${language}`;
        rowFrame.x = 16;
        rowFrame.y = currentY;
        rowFrame.fills = i % 2 === 0 ? [{ type: "SOLID", color: { r: 0.98, g: 0.98, b: 0.98 } }] : [];
        
        // 언어 라벨
        const langLabel = figma.createText();
        await figma.loadFontAsync({ family: "Inter", style: "Medium" });
        rowFrame.appendChild(langLabel);
        langLabel.characters = language;
        langLabel.fontSize = 14;
        langLabel.x = 10;
        langLabel.y = 10;
        
        // 번역 결과
        const translationText = figma.createText();
        await figma.loadFontAsync({ family: "Inter", style: "Regular" });
        rowFrame.appendChild(translationText);
        translationText.characters = translatedText;
        translationText.fontSize = 14;
        translationText.x = 100;
        translationText.y = 10;
        
        const rowWidth = 120 + translationText.width;
        rowFrame.resize(Math.max(rowWidth, 300), langLabel.height + 20);
        maxWidth = Math.max(maxWidth, rowFrame.width);
        
        currentY += rowFrame.height + 4;
        
        // 레이아웃 영향 표시
        const lengthDiff = ((translatedText.length - originalText.length) / originalText.length) * 100;
        if (Math.abs(lengthDiff) > 15) {
          const warningText = figma.createText();
          await figma.loadFontAsync({ family: "Inter", style: "Regular" });
          rowFrame.appendChild(warningText);
          warningText.characters = lengthDiff > 0 ? 
            `⚠️ ${Math.round(lengthDiff)}% longer than original` : 
            `📏 ${Math.round(-lengthDiff)}% shorter than original`;
          warningText.fontSize = 12;
          warningText.x = 100;
          warningText.y = langLabel.height + 15;
          
          rowFrame.resize(rowFrame.width, rowFrame.height + warningText.height + 10);
          currentY += warningText.height + 10;
        }
      }
    }
    
    // 적응형 레이아웃 적용 (옵션)
    if (adaptLayout) {
      // 가장 긴 번역을 기준으로 크기 조정
      // 실제로는 더 복잡한 레이아웃 조정 로직 필요
    }
    
    localizationResults.push({
      nodeId: textNode.id,
      nodeName: textNode.name,
      originalText: originalText,
      translations: translations
    });
  }
  
  // 시각화 프레임 크기 조정
  if (createVisualFrame && visualizationFrame) {
    visualizationFrame.resize(maxWidth + 32, currentY + 16);
  }
  
  return {
    success: true,
    message: `Localized ${textNodes.length} text nodes into ${languages.length} languages`,
    localizationResults: localizationResults,
    visualizationFrameId: visualizationFrame ? visualizationFrame.id : null
  };
}

// Base64 인코딩을 위한 헬퍼 함수
function customBase64Encode(bytes) {
  const CHUNK_SIZE = 1024; // 한 번에 처리할 바이트 수
  let binary = '';
  
  // 작은 청크로 나누어 처리하여 메모리 효율성 향상
  for (let i = 0; i < bytes.length; i += CHUNK_SIZE) {
    const end = Math.min(i + CHUNK_SIZE, bytes.length);
    for (let j = i; j < end; j++) {
      binary += String.fromCharCode(bytes[j]);
    }
  }
  
  // Base64 변환
  try {
    // Browser environment
    return btoa(binary);
  } catch (e) {
    // Node.js environment 또는 btoa가 없는 경우
    try {
      return Buffer.from(binary, 'binary').toString('base64');
    } catch (e2) {
      console.error('Base64 인코딩 실패:', e2);
      throw new Error('Base64 인코딩에 실패했습니다');
    }
  }
}
