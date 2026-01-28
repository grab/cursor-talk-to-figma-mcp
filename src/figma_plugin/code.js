(() => {
  // src/figma_plugin/utils/progressUtils.js
  function generateCommandId() {
    return "cmd_" + Math.random().toString(36).substring(2, 15) + Math.random().toString(36).substring(2, 15);
  }
  function sendProgressUpdate(commandId, commandType, status, progress, totalItems, processedItems, message, payload = null) {
    const update = {
      type: "command_progress",
      commandId,
      commandType,
      status,
      progress,
      totalItems,
      processedItems,
      message,
      timestamp: Date.now()
    };
    if (payload) {
      if (payload.currentChunk !== void 0 && payload.totalChunks !== void 0) {
        update.currentChunk = payload.currentChunk;
        update.totalChunks = payload.totalChunks;
        update.chunkSize = payload.chunkSize;
      }
      update.payload = payload;
    }
    figma.ui.postMessage(update);
    console.log(`Progress update: ${status} - ${progress}% - ${message}`);
    return update;
  }

  // src/figma_plugin/utils/colorUtils.js
  function rgbaToHex(color) {
    var r = Math.round(color.r * 255);
    var g = Math.round(color.g * 255);
    var b = Math.round(color.b * 255);
    var a = color.a !== void 0 ? Math.round(color.a * 255) : 255;
    if (a === 255) {
      return "#" + [r, g, b].map((x) => {
        return x.toString(16).padStart(2, "0");
      }).join("");
    }
    return "#" + [r, g, b, a].map((x) => {
      return x.toString(16).padStart(2, "0");
    }).join("");
  }

  // src/figma_plugin/utils/nodeUtils.js
  function filterFigmaNode(node) {
    if (node.type === "VECTOR") {
      return null;
    }
    var filtered = {
      id: node.id,
      name: node.name,
      type: node.type
    };
    if (node.fills && node.fills.length > 0) {
      filtered.fills = node.fills.map((fill) => {
        var processedFill = Object.assign({}, fill);
        delete processedFill.boundVariables;
        delete processedFill.imageRef;
        if (processedFill.gradientStops) {
          processedFill.gradientStops = processedFill.gradientStops.map(
            (stop) => {
              var processedStop = Object.assign({}, stop);
              if (processedStop.color) {
                processedStop.color = rgbaToHex(processedStop.color);
              }
              delete processedStop.boundVariables;
              return processedStop;
            }
          );
        }
        if (processedFill.color) {
          processedFill.color = rgbaToHex(processedFill.color);
        }
        return processedFill;
      });
    }
    if (node.strokes && node.strokes.length > 0) {
      filtered.strokes = node.strokes.map((stroke) => {
        var processedStroke = Object.assign({}, stroke);
        delete processedStroke.boundVariables;
        if (processedStroke.color) {
          processedStroke.color = rgbaToHex(processedStroke.color);
        }
        return processedStroke;
      });
    }
    if (node.cornerRadius !== void 0) {
      filtered.cornerRadius = node.cornerRadius;
    }
    if (node.absoluteBoundingBox) {
      filtered.absoluteBoundingBox = node.absoluteBoundingBox;
    }
    if (node.characters) {
      filtered.characters = node.characters;
    }
    if (node.style) {
      filtered.style = {
        fontFamily: node.style.fontFamily,
        fontStyle: node.style.fontStyle,
        fontWeight: node.style.fontWeight,
        fontSize: node.style.fontSize,
        textAlignHorizontal: node.style.textAlignHorizontal,
        letterSpacing: node.style.letterSpacing,
        lineHeightPx: node.style.lineHeightPx
      };
    }
    if (node.children) {
      filtered.children = node.children.map((child) => {
        return filterFigmaNode(child);
      }).filter((child) => {
        return child !== null;
      });
    }
    return filtered;
  }
  async function collectNodesToProcess(node, parentPath = [], depth = 0, nodesToProcess = []) {
    if (node.visible === false) return;
    const nodePath = [...parentPath, node.name || `Unnamed ${node.type}`];
    nodesToProcess.push({
      node,
      parentPath: nodePath,
      depth
    });
    if ("children" in node) {
      for (const child of node.children) {
        await collectNodesToProcess(child, nodePath, depth + 1, nodesToProcess);
      }
    }
  }

  // src/figma_plugin/handlers/nodeReaders.js
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
        type: node.type
      })),
      currentPage: {
        id: page.id,
        name: page.name,
        childCount: page.children.length
      },
      pages: [
        {
          id: page.id,
          name: page.name,
          childCount: page.children.length
        }
      ]
    };
  }
  async function getSelection() {
    return {
      selectionCount: figma.currentPage.selection.length,
      selection: figma.currentPage.selection.map((node) => ({
        id: node.id,
        name: node.name,
        type: node.type,
        visible: node.visible
      }))
    };
  }
  async function getNodesInfo(nodeIds) {
    try {
      const nodes = await Promise.all(
        nodeIds.map((id) => figma.getNodeByIdAsync(id))
      );
      const validNodes = nodes.filter((node) => node !== null);
      const responses = await Promise.all(
        validNodes.map(async (node) => {
          const response = await node.exportAsync({
            format: "JSON_REST_V1"
          });
          return {
            nodeId: node.id,
            document: filterFigmaNode(response.document)
          };
        })
      );
      return responses;
    } catch (error) {
      throw new Error(`Error getting nodes info: ${error.message}`);
    }
  }
  async function readMyDesign() {
    try {
      const nodes = await Promise.all(
        figma.currentPage.selection.map((node) => figma.getNodeByIdAsync(node.id))
      );
      const validNodes = nodes.filter((node) => node !== null);
      const responses = await Promise.all(
        validNodes.map(async (node) => {
          const response = await node.exportAsync({
            format: "JSON_REST_V1"
          });
          return {
            nodeId: node.id,
            document: filterFigmaNode(response.document)
          };
        })
      );
      return responses;
    } catch (error) {
      throw new Error(`Error getting nodes info: ${error.message}`);
    }
  }

  // src/figma_plugin/utils/helpers.js
  function uniqBy(arr, predicate) {
    const cb = typeof predicate === "function" ? predicate : (o) => o[predicate];
    return [
      ...arr.reduce((map, item) => {
        const key = item === null || item === void 0 ? item : cb(item);
        map.has(key) || map.set(key, item);
        return map;
      }, /* @__PURE__ */ new Map()).values()
    ];
  }
  function delay(ms) {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }

  // src/figma_plugin/utils/textUtils.js
  var getDelimiterPos = (str, delimiter, startIdx = 0, endIdx = str.length) => {
    const indices = [];
    let temp = startIdx;
    for (let i = startIdx; i < endIdx; i++) {
      if (str[i] === delimiter && i + startIdx !== endIdx && temp !== i + startIdx) {
        indices.push([temp, i + startIdx]);
        temp = i + startIdx + 1;
      }
    }
    temp !== endIdx && indices.push([temp, endIdx]);
    return indices.filter(Boolean);
  };
  var buildLinearOrder = (node) => {
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
            const spacesRangeFont2 = node.getRangeFontName(
              spacesRangeStart,
              spacesRangeStart[0]
            );
            fontTree.push({
              start: spacesRangeStart,
              delimiter: " ",
              family: spacesRangeFont2.family,
              style: spacesRangeFont2.style
            });
          } else {
            fontTree.push({
              start: spacesRangeStart,
              delimiter: " ",
              family: spacesRangeFont.family,
              style: spacesRangeFont.style
            });
          }
        });
      } else {
        fontTree.push({
          start: newLinesRangeStart,
          delimiter: "\n",
          family: newLinesRangeFont.family,
          style: newLinesRangeFont.style
        });
      }
    });
    return fontTree.sort((a, b) => +a.start - +b.start).map(({ family, style, delimiter }) => ({ family, style, delimiter }));
  };
  var setCharacters = async (node, characters, options) => {
    const fallbackFont = options && options.fallbackFont || {
      family: "Inter",
      style: "Regular"
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
            style
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
          style: node.fontName.style
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
  var setCharactersWithStrictMatchFont = async (node, characters, fallbackFont) => {
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
          style
        };
        await figma.loadFontAsync(matchedFont);
        return node.setRangeFontName(Number(start), Number(end), matchedFont);
      })
    );
    return true;
  };
  var setCharactersWithSmartMatchFont = async (node, characters, fallbackFont) => {
    const rangeTree = buildLinearOrder(node);
    const fontsToLoad = uniqBy(
      rangeTree,
      ({ family, style }) => `${family}::${style}`
    ).map(({ family, style }) => ({
      family,
      style
    }));
    await Promise.all([...fontsToLoad, fallbackFont].map(figma.loadFontAsync));
    node.fontName = fallbackFont;
    node.characters = characters;
    let prevPos = 0;
    rangeTree.forEach(({ family, style, delimiter }) => {
      if (prevPos < node.characters.length) {
        const delimeterPos = node.characters.indexOf(delimiter, prevPos);
        const endPos = delimeterPos > prevPos ? delimeterPos : node.characters.length;
        const matchedFont = {
          family,
          style
        };
        node.setRangeFontName(prevPos, endPos, matchedFont);
        prevPos = endPos + 1;
      }
    });
    return true;
  };

  // src/figma_plugin/handlers/nodeCreators.js
  async function createRectangle(params) {
    const {
      x = 0,
      y = 0,
      width = 100,
      height = 100,
      name = "Rectangle",
      parentId
    } = params || {};
    const rect = figma.createRectangle();
    rect.x = x;
    rect.y = y;
    rect.resize(width, height);
    rect.name = name;
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
      parentId: rect.parent ? rect.parent.id : void 0
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
      layoutMode = "NONE",
      layoutWrap = "NO_WRAP",
      paddingTop = 10,
      paddingRight = 10,
      paddingBottom = 10,
      paddingLeft = 10,
      primaryAxisAlignItems = "MIN",
      counterAxisAlignItems = "MIN",
      layoutSizingHorizontal = "FIXED",
      layoutSizingVertical = "FIXED",
      itemSpacing = 0
    } = params || {};
    const frame = figma.createFrame();
    frame.x = x;
    frame.y = y;
    frame.resize(width, height);
    frame.name = name;
    if (layoutMode !== "NONE") {
      frame.layoutMode = layoutMode;
      frame.layoutWrap = layoutWrap;
      frame.paddingTop = paddingTop;
      frame.paddingRight = paddingRight;
      frame.paddingBottom = paddingBottom;
      frame.paddingLeft = paddingLeft;
      frame.primaryAxisAlignItems = primaryAxisAlignItems;
      frame.counterAxisAlignItems = counterAxisAlignItems;
      frame.layoutSizingHorizontal = layoutSizingHorizontal;
      frame.layoutSizingVertical = layoutSizingVertical;
      frame.itemSpacing = itemSpacing;
    }
    if (fillColor) {
      const paintStyle = {
        type: "SOLID",
        color: {
          r: parseFloat(fillColor.r) || 0,
          g: parseFloat(fillColor.g) || 0,
          b: parseFloat(fillColor.b) || 0
        },
        opacity: parseFloat(fillColor.a) || 1
      };
      frame.fills = [paintStyle];
    }
    if (strokeColor) {
      const strokeStyle = {
        type: "SOLID",
        color: {
          r: parseFloat(strokeColor.r) || 0,
          g: parseFloat(strokeColor.g) || 0,
          b: parseFloat(strokeColor.b) || 0
        },
        opacity: parseFloat(strokeColor.a) || 1
      };
      frame.strokes = [strokeStyle];
    }
    if (strokeWeight !== void 0) {
      frame.strokeWeight = strokeWeight;
    }
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
      layoutMode: frame.layoutMode,
      layoutWrap: frame.layoutWrap,
      parentId: frame.parent ? frame.parent.id : void 0
    };
  }
  function getFontStyle(weight) {
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
  }
  async function createText(params) {
    const {
      x = 0,
      y = 0,
      text = "Text",
      fontSize = 14,
      fontWeight = 400,
      fontColor = { r: 0, g: 0, b: 0, a: 1 },
      // Default to black
      name = "",
      parentId
    } = params || {};
    const textNode = figma.createText();
    textNode.x = x;
    textNode.y = y;
    textNode.name = name || text;
    try {
      await figma.loadFontAsync({
        family: "Inter",
        style: getFontStyle(fontWeight)
      });
      textNode.fontName = { family: "Inter", style: getFontStyle(fontWeight) };
      textNode.fontSize = parseInt(fontSize);
    } catch (error) {
      console.error("Error setting font size", error);
    }
    setCharacters(textNode, text);
    const paintStyle = {
      type: "SOLID",
      color: {
        r: parseFloat(fontColor.r) || 0,
        g: parseFloat(fontColor.g) || 0,
        b: parseFloat(fontColor.b) || 0
      },
      opacity: parseFloat(fontColor.a) || 1
    };
    textNode.fills = [paintStyle];
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
      fontWeight,
      fontColor,
      fontName: textNode.fontName,
      fills: textNode.fills,
      parentId: textNode.parent ? textNode.parent.id : void 0
    };
  }
  async function cloneNode(params) {
    const { nodeId, x, y } = params || {};
    if (!nodeId) {
      throw new Error("Missing nodeId parameter");
    }
    const node = await figma.getNodeByIdAsync(nodeId);
    if (!node) {
      throw new Error(`Node not found with ID: ${nodeId}`);
    }
    const clone = node.clone();
    if (x !== void 0 && y !== void 0) {
      if (!("x" in clone) || !("y" in clone)) {
        throw new Error(`Cloned node does not support position: ${nodeId}`);
      }
      clone.x = x;
      clone.y = y;
    }
    if (node.parent) {
      node.parent.appendChild(clone);
    } else {
      figma.currentPage.appendChild(clone);
    }
    return {
      id: clone.id,
      name: clone.name,
      x: "x" in clone ? clone.x : void 0,
      y: "y" in clone ? clone.y : void 0,
      width: "width" in clone ? clone.width : void 0,
      height: "height" in clone ? clone.height : void 0
    };
  }

  // src/figma_plugin/handlers/nodeModifiers.js
  async function moveNode(params) {
    const { nodeId, x, y } = params || {};
    if (!nodeId) {
      throw new Error("Missing nodeId parameter");
    }
    if (x === void 0 || y === void 0) {
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
      y: node.y
    };
  }
  async function resizeNode(params) {
    const { nodeId, width, height } = params || {};
    if (!nodeId) {
      throw new Error("Missing nodeId parameter");
    }
    if (width === void 0 || height === void 0) {
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
      height: node.height
    };
  }
  async function deleteMultipleNodes(params) {
    const { nodeIds } = params || {};
    const commandId = generateCommandId();
    if (!nodeIds || !Array.isArray(nodeIds) || nodeIds.length === 0) {
      const errorMsg = "Missing or invalid nodeIds parameter";
      sendProgressUpdate(
        commandId,
        "delete_multiple_nodes",
        "error",
        0,
        0,
        0,
        errorMsg,
        { error: errorMsg }
      );
      throw new Error(errorMsg);
    }
    console.log(`Starting deletion of ${nodeIds.length} nodes`);
    sendProgressUpdate(
      commandId,
      "delete_multiple_nodes",
      "started",
      0,
      nodeIds.length,
      0,
      `Starting deletion of ${nodeIds.length} nodes`,
      { totalNodes: nodeIds.length }
    );
    const results = [];
    let successCount = 0;
    let failureCount = 0;
    const CHUNK_SIZE = 5;
    const chunks = [];
    for (let i = 0; i < nodeIds.length; i += CHUNK_SIZE) {
      chunks.push(nodeIds.slice(i, i + CHUNK_SIZE));
    }
    console.log(`Split ${nodeIds.length} deletions into ${chunks.length} chunks`);
    sendProgressUpdate(
      commandId,
      "delete_multiple_nodes",
      "in_progress",
      5,
      nodeIds.length,
      0,
      `Preparing to delete ${nodeIds.length} nodes using ${chunks.length} chunks`,
      {
        totalNodes: nodeIds.length,
        chunks: chunks.length,
        chunkSize: CHUNK_SIZE
      }
    );
    for (let chunkIndex = 0; chunkIndex < chunks.length; chunkIndex++) {
      const chunk = chunks[chunkIndex];
      console.log(
        `Processing chunk ${chunkIndex + 1}/${chunks.length} with ${chunk.length} nodes`
      );
      sendProgressUpdate(
        commandId,
        "delete_multiple_nodes",
        "in_progress",
        Math.round(5 + chunkIndex / chunks.length * 90),
        nodeIds.length,
        successCount + failureCount,
        `Processing deletion chunk ${chunkIndex + 1}/${chunks.length}`,
        {
          currentChunk: chunkIndex + 1,
          totalChunks: chunks.length,
          successCount,
          failureCount
        }
      );
      const chunkPromises = chunk.map(async (nodeId) => {
        try {
          const node = await figma.getNodeByIdAsync(nodeId);
          if (!node) {
            console.error(`Node not found: ${nodeId}`);
            return {
              success: false,
              nodeId,
              error: `Node not found: ${nodeId}`
            };
          }
          const nodeInfo = {
            id: node.id,
            name: node.name,
            type: node.type
          };
          node.remove();
          console.log(`Successfully deleted node: ${nodeId}`);
          return {
            success: true,
            nodeId,
            nodeInfo
          };
        } catch (error) {
          console.error(`Error deleting node ${nodeId}: ${error.message}`);
          return {
            success: false,
            nodeId,
            error: error.message
          };
        }
      });
      const chunkResults = await Promise.all(chunkPromises);
      chunkResults.forEach((result) => {
        if (result.success) {
          successCount++;
        } else {
          failureCount++;
        }
        results.push(result);
      });
      sendProgressUpdate(
        commandId,
        "delete_multiple_nodes",
        "in_progress",
        Math.round(5 + (chunkIndex + 1) / chunks.length * 90),
        nodeIds.length,
        successCount + failureCount,
        `Completed chunk ${chunkIndex + 1}/${chunks.length}. ${successCount} successful, ${failureCount} failed so far.`,
        {
          currentChunk: chunkIndex + 1,
          totalChunks: chunks.length,
          successCount,
          failureCount,
          chunkResults
        }
      );
      if (chunkIndex < chunks.length - 1) {
        console.log("Pausing between chunks...");
        await delay(1e3);
      }
    }
    console.log(
      `Deletion complete: ${successCount} successful, ${failureCount} failed`
    );
    sendProgressUpdate(
      commandId,
      "delete_multiple_nodes",
      "completed",
      100,
      nodeIds.length,
      successCount + failureCount,
      `Node deletion complete: ${successCount} successful, ${failureCount} failed`,
      {
        totalNodes: nodeIds.length,
        nodesDeleted: successCount,
        nodesFailed: failureCount,
        completedInChunks: chunks.length,
        results
      }
    );
    return {
      success: successCount > 0,
      nodesDeleted: successCount,
      nodesFailed: failureCount,
      totalNodes: nodeIds.length,
      results,
      completedInChunks: chunks.length,
      commandId
    };
  }
  async function setSelections(params) {
    if (!params || !params.nodeIds || !Array.isArray(params.nodeIds)) {
      throw new Error("Missing or invalid nodeIds parameter");
    }
    if (params.nodeIds.length === 0) {
      throw new Error("nodeIds array cannot be empty");
    }
    const nodes = [];
    const notFoundIds = [];
    for (const nodeId of params.nodeIds) {
      const node = await figma.getNodeByIdAsync(nodeId);
      if (node) {
        nodes.push(node);
      } else {
        notFoundIds.push(nodeId);
      }
    }
    if (nodes.length === 0) {
      throw new Error(`No valid nodes found for the provided IDs: ${params.nodeIds.join(", ")}`);
    }
    figma.currentPage.selection = nodes;
    figma.viewport.scrollAndZoomIntoView(nodes);
    const selectedNodes = nodes.map((node) => ({
      name: node.name,
      id: node.id
    }));
    return {
      success: true,
      count: nodes.length,
      selectedNodes,
      notFoundIds,
      message: `Selected ${nodes.length} nodes${notFoundIds.length > 0 ? ` (${notFoundIds.length} not found)` : ""}`
    };
  }
  async function setNodeName(params) {
    const { nodeId, name } = params || {};
    if (!nodeId) {
      throw new Error("Missing nodeId parameter");
    }
    if (name === void 0) {
      throw new Error("Missing name parameter");
    }
    const node = await figma.getNodeByIdAsync(nodeId);
    if (!node) {
      throw new Error(`Node not found with ID: ${nodeId}`);
    }
    const oldName = node.name;
    node.name = name;
    return {
      id: node.id,
      name: node.name,
      oldName
    };
  }

  // src/figma_plugin/handlers/stylingHandlers.js
  async function setFillColor(params) {
    console.log("setFillColor", params);
    const {
      nodeId,
      color: { r, g, b, a }
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
    const rgbColor = {
      r: parseFloat(r) || 0,
      g: parseFloat(g) || 0,
      b: parseFloat(b) || 0,
      a: parseFloat(a) || 1
    };
    const paintStyle = {
      type: "SOLID",
      color: {
        r: parseFloat(rgbColor.r),
        g: parseFloat(rgbColor.g),
        b: parseFloat(rgbColor.b)
      },
      opacity: parseFloat(rgbColor.a)
    };
    console.log("paintStyle", paintStyle);
    node.fills = [paintStyle];
    return {
      id: node.id,
      name: node.name,
      fills: [paintStyle]
    };
  }
  async function setStrokeColor(params) {
    const {
      nodeId,
      color: { r, g, b, a },
      weight = 1
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
    const rgbColor = {
      r: r !== void 0 ? r : 0,
      g: g !== void 0 ? g : 0,
      b: b !== void 0 ? b : 0,
      a: a !== void 0 ? a : 1
    };
    const paintStyle = {
      type: "SOLID",
      color: {
        r: rgbColor.r,
        g: rgbColor.g,
        b: rgbColor.b
      },
      opacity: rgbColor.a
    };
    node.strokes = [paintStyle];
    if ("strokeWeight" in node) {
      node.strokeWeight = weight;
    }
    return {
      id: node.id,
      name: node.name,
      strokes: node.strokes,
      strokeWeight: "strokeWeight" in node ? node.strokeWeight : void 0
    };
  }
  async function setCornerRadius(params) {
    const { nodeId, radius, corners } = params || {};
    if (!nodeId) {
      throw new Error("Missing nodeId parameter");
    }
    if (radius === void 0) {
      throw new Error("Missing radius parameter");
    }
    const node = await figma.getNodeByIdAsync(nodeId);
    if (!node) {
      throw new Error(`Node not found with ID: ${nodeId}`);
    }
    if (!("cornerRadius" in node)) {
      throw new Error(`Node does not support corner radius: ${nodeId}`);
    }
    if (corners && Array.isArray(corners) && corners.length === 4) {
      if ("topLeftRadius" in node) {
        if (corners[0]) node.topLeftRadius = radius;
        if (corners[1]) node.topRightRadius = radius;
        if (corners[2]) node.bottomRightRadius = radius;
        if (corners[3]) node.bottomLeftRadius = radius;
      } else {
        node.cornerRadius = radius;
      }
    } else {
      node.cornerRadius = radius;
    }
    return {
      id: node.id,
      name: node.name,
      cornerRadius: "cornerRadius" in node ? node.cornerRadius : void 0,
      topLeftRadius: "topLeftRadius" in node ? node.topLeftRadius : void 0,
      topRightRadius: "topRightRadius" in node ? node.topRightRadius : void 0,
      bottomRightRadius: "bottomRightRadius" in node ? node.bottomRightRadius : void 0,
      bottomLeftRadius: "bottomLeftRadius" in node ? node.bottomLeftRadius : void 0
    };
  }

  // src/figma_plugin/handlers/layoutHandlers.js
  async function setLayoutMode(params) {
    const { nodeId, layoutMode = "NONE", layoutWrap = "NO_WRAP" } = params || {};
    const node = await figma.getNodeByIdAsync(nodeId);
    if (!node) {
      throw new Error(`Node with ID ${nodeId} not found`);
    }
    if (node.type !== "FRAME" && node.type !== "COMPONENT" && node.type !== "COMPONENT_SET" && node.type !== "INSTANCE") {
      throw new Error(`Node type ${node.type} does not support layoutMode`);
    }
    node.layoutMode = layoutMode;
    if (layoutMode !== "NONE") {
      node.layoutWrap = layoutWrap;
    }
    return {
      id: node.id,
      name: node.name,
      layoutMode: node.layoutMode,
      layoutWrap: node.layoutWrap
    };
  }
  async function setPadding(params) {
    const { nodeId, paddingTop, paddingRight, paddingBottom, paddingLeft } = params || {};
    const node = await figma.getNodeByIdAsync(nodeId);
    if (!node) {
      throw new Error(`Node with ID ${nodeId} not found`);
    }
    if (node.type !== "FRAME" && node.type !== "COMPONENT" && node.type !== "COMPONENT_SET" && node.type !== "INSTANCE") {
      throw new Error(`Node type ${node.type} does not support padding`);
    }
    if (node.layoutMode === "NONE") {
      throw new Error(
        "Padding can only be set on auto-layout frames (layoutMode must not be NONE)"
      );
    }
    if (paddingTop !== void 0) node.paddingTop = paddingTop;
    if (paddingRight !== void 0) node.paddingRight = paddingRight;
    if (paddingBottom !== void 0) node.paddingBottom = paddingBottom;
    if (paddingLeft !== void 0) node.paddingLeft = paddingLeft;
    return {
      id: node.id,
      name: node.name,
      paddingTop: node.paddingTop,
      paddingRight: node.paddingRight,
      paddingBottom: node.paddingBottom,
      paddingLeft: node.paddingLeft
    };
  }
  async function setAxisAlign(params) {
    const { nodeId, primaryAxisAlignItems, counterAxisAlignItems } = params || {};
    const node = await figma.getNodeByIdAsync(nodeId);
    if (!node) {
      throw new Error(`Node with ID ${nodeId} not found`);
    }
    if (node.type !== "FRAME" && node.type !== "COMPONENT" && node.type !== "COMPONENT_SET" && node.type !== "INSTANCE") {
      throw new Error(`Node type ${node.type} does not support axis alignment`);
    }
    if (node.layoutMode === "NONE") {
      throw new Error(
        "Axis alignment can only be set on auto-layout frames (layoutMode must not be NONE)"
      );
    }
    if (primaryAxisAlignItems !== void 0) {
      if (!["MIN", "MAX", "CENTER", "SPACE_BETWEEN"].includes(primaryAxisAlignItems)) {
        throw new Error(
          "Invalid primaryAxisAlignItems value. Must be one of: MIN, MAX, CENTER, SPACE_BETWEEN"
        );
      }
      node.primaryAxisAlignItems = primaryAxisAlignItems;
    }
    if (counterAxisAlignItems !== void 0) {
      if (!["MIN", "MAX", "CENTER", "BASELINE"].includes(counterAxisAlignItems)) {
        throw new Error(
          "Invalid counterAxisAlignItems value. Must be one of: MIN, MAX, CENTER, BASELINE"
        );
      }
      if (counterAxisAlignItems === "BASELINE" && node.layoutMode !== "HORIZONTAL") {
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
      layoutMode: node.layoutMode
    };
  }
  async function setLayoutSizing(params) {
    const { nodeId, layoutSizingHorizontal, layoutSizingVertical } = params || {};
    const node = await figma.getNodeByIdAsync(nodeId);
    if (!node) {
      throw new Error(`Node with ID ${nodeId} not found`);
    }
    if (node.type !== "FRAME" && node.type !== "COMPONENT" && node.type !== "COMPONENT_SET" && node.type !== "INSTANCE") {
      throw new Error(`Node type ${node.type} does not support layout sizing`);
    }
    if (node.layoutMode === "NONE") {
      throw new Error(
        "Layout sizing can only be set on auto-layout frames (layoutMode must not be NONE)"
      );
    }
    if (layoutSizingHorizontal !== void 0) {
      if (!["FIXED", "HUG", "FILL"].includes(layoutSizingHorizontal)) {
        throw new Error(
          "Invalid layoutSizingHorizontal value. Must be one of: FIXED, HUG, FILL"
        );
      }
      if (layoutSizingHorizontal === "HUG" && !["FRAME", "TEXT"].includes(node.type)) {
        throw new Error(
          "HUG sizing is only valid on auto-layout frames and text nodes"
        );
      }
      if (layoutSizingHorizontal === "FILL" && (!node.parent || node.parent.layoutMode === "NONE")) {
        throw new Error("FILL sizing is only valid on auto-layout children");
      }
      node.layoutSizingHorizontal = layoutSizingHorizontal;
    }
    if (layoutSizingVertical !== void 0) {
      if (!["FIXED", "HUG", "FILL"].includes(layoutSizingVertical)) {
        throw new Error(
          "Invalid layoutSizingVertical value. Must be one of: FIXED, HUG, FILL"
        );
      }
      if (layoutSizingVertical === "HUG" && !["FRAME", "TEXT"].includes(node.type)) {
        throw new Error(
          "HUG sizing is only valid on auto-layout frames and text nodes"
        );
      }
      if (layoutSizingVertical === "FILL" && (!node.parent || node.parent.layoutMode === "NONE")) {
        throw new Error("FILL sizing is only valid on auto-layout children");
      }
      node.layoutSizingVertical = layoutSizingVertical;
    }
    return {
      id: node.id,
      name: node.name,
      layoutSizingHorizontal: node.layoutSizingHorizontal,
      layoutSizingVertical: node.layoutSizingVertical,
      layoutMode: node.layoutMode
    };
  }
  async function setItemSpacing(params) {
    const { nodeId, itemSpacing, counterAxisSpacing } = params || {};
    if (itemSpacing === void 0 && counterAxisSpacing === void 0) {
      throw new Error("At least one of itemSpacing or counterAxisSpacing must be provided");
    }
    const node = await figma.getNodeByIdAsync(nodeId);
    if (!node) {
      throw new Error(`Node with ID ${nodeId} not found`);
    }
    if (node.type !== "FRAME" && node.type !== "COMPONENT" && node.type !== "COMPONENT_SET" && node.type !== "INSTANCE") {
      throw new Error(`Node type ${node.type} does not support item spacing`);
    }
    if (node.layoutMode === "NONE") {
      throw new Error(
        "Item spacing can only be set on auto-layout frames (layoutMode must not be NONE)"
      );
    }
    if (itemSpacing !== void 0) {
      if (typeof itemSpacing !== "number") {
        throw new Error("Item spacing must be a number");
      }
      node.itemSpacing = itemSpacing;
    }
    if (counterAxisSpacing !== void 0) {
      if (typeof counterAxisSpacing !== "number") {
        throw new Error("Counter axis spacing must be a number");
      }
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
      itemSpacing: node.itemSpacing || void 0,
      counterAxisSpacing: node.counterAxisSpacing || void 0,
      layoutMode: node.layoutMode,
      layoutWrap: node.layoutWrap
    };
  }

  // src/figma_plugin/utils/exportUtils.js
  function customBase64Encode(bytes) {
    const chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/";
    let base64 = "";
    const byteLength = bytes.byteLength;
    const byteRemainder = byteLength % 3;
    const mainLength = byteLength - byteRemainder;
    let a, b, c, d;
    let chunk;
    for (let i = 0; i < mainLength; i = i + 3) {
      chunk = bytes[i] << 16 | bytes[i + 1] << 8 | bytes[i + 2];
      a = (chunk & 16515072) >> 18;
      b = (chunk & 258048) >> 12;
      c = (chunk & 4032) >> 6;
      d = chunk & 63;
      base64 += chars[a] + chars[b] + chars[c] + chars[d];
    }
    if (byteRemainder === 1) {
      chunk = bytes[mainLength];
      a = (chunk & 252) >> 2;
      b = (chunk & 3) << 4;
      base64 += chars[a] + chars[b] + "==";
    } else if (byteRemainder === 2) {
      chunk = bytes[mainLength] << 8 | bytes[mainLength + 1];
      a = (chunk & 64512) >> 10;
      b = (chunk & 1008) >> 4;
      c = (chunk & 15) << 2;
      base64 += chars[a] + chars[b] + chars[c] + "=";
    }
    return base64;
  }

  // src/figma_plugin/handlers/componentHandlers.js
  async function getStyles() {
    const styles = {
      colors: await figma.getLocalPaintStylesAsync(),
      texts: await figma.getLocalTextStylesAsync(),
      effects: await figma.getLocalEffectStylesAsync(),
      grids: await figma.getLocalGridStylesAsync()
    };
    return {
      colors: styles.colors.map((style) => ({
        id: style.id,
        name: style.name,
        key: style.key,
        paint: style.paints[0]
      })),
      texts: styles.texts.map((style) => ({
        id: style.id,
        name: style.name,
        key: style.key,
        fontSize: style.fontSize,
        fontName: style.fontName
      })),
      effects: styles.effects.map((style) => ({
        id: style.id,
        name: style.name,
        key: style.key
      })),
      grids: styles.grids.map((style) => ({
        id: style.id,
        name: style.name,
        key: style.key
      }))
    };
  }
  async function getLocalComponents() {
    await figma.loadAllPagesAsync();
    const components = figma.root.findAllWithCriteria({
      types: ["COMPONENT"]
    });
    return {
      count: components.length,
      components: components.map((component) => ({
        id: component.id,
        name: component.name,
        key: "key" in component ? component.key : null
      }))
    };
  }
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
        componentId: instance.componentId
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
        format,
        constraint: { type: "SCALE", value: scale }
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
      const base64 = customBase64Encode(bytes);
      return {
        nodeId,
        format,
        scale,
        mimeType,
        imageData: base64
      };
    } catch (error) {
      throw new Error(`Error exporting node as image: ${error.message}`);
    }
  }
  async function getInstanceOverrides(instanceNode = null) {
    console.log("=== getInstanceOverrides called ===");
    let sourceInstance = null;
    if (instanceNode) {
      console.log("Using provided instance node");
      if (instanceNode.type !== "INSTANCE") {
        console.error("Provided node is not an instance");
        figma.notify("Provided node is not a component instance");
        return { success: false, message: "Provided node is not a component instance" };
      }
      sourceInstance = instanceNode;
    } else {
      console.log("No node provided, using current selection");
      const selection = figma.currentPage.selection;
      if (selection.length === 0) {
        console.log("No nodes selected");
        figma.notify("Please select at least one instance");
        return { success: false, message: "No nodes selected" };
      }
      const instances = selection.filter((node) => node.type === "INSTANCE");
      if (instances.length === 0) {
        console.log("No instances found in selection");
        figma.notify("Please select at least one component instance");
        return { success: false, message: "No instances found in selection" };
      }
      sourceInstance = instances[0];
    }
    try {
      console.log(`Getting instance information:`);
      console.log(sourceInstance);
      const overrides = sourceInstance.overrides || [];
      console.log(`  Raw Overrides:`, overrides);
      const mainComponent = await sourceInstance.getMainComponentAsync();
      if (!mainComponent) {
        console.error("Failed to get main component");
        figma.notify("Failed to get main component");
        return { success: false, message: "Failed to get main component" };
      }
      const returnData = {
        success: true,
        message: `Got component information from "${sourceInstance.name}" for overrides.length: ${overrides.length}`,
        sourceInstanceId: sourceInstance.id,
        mainComponentId: mainComponent.id,
        overridesCount: overrides.length
      };
      console.log("Data to return to MCP server:", returnData);
      figma.notify(`Got component information from "${sourceInstance.name}"`);
      return returnData;
    } catch (error) {
      console.error("Error in getInstanceOverrides:", error);
      figma.notify(`Error: ${error.message}`);
      return {
        success: false,
        message: `Error: ${error.message}`
      };
    }
  }
  async function getValidTargetInstances(targetNodeIds) {
    let targetInstances = [];
    if (Array.isArray(targetNodeIds)) {
      if (targetNodeIds.length === 0) {
        return { success: false, message: "No instances provided" };
      }
      for (const targetNodeId of targetNodeIds) {
        const targetNode = await figma.getNodeByIdAsync(targetNodeId);
        if (targetNode && targetNode.type === "INSTANCE") {
          targetInstances.push(targetNode);
        }
      }
      if (targetInstances.length === 0) {
        return { success: false, message: "No valid instances provided" };
      }
    } else {
      return { success: false, message: "Invalid target node IDs provided" };
    }
    return { success: true, message: "Valid target instances provided", targetInstances };
  }
  async function getSourceInstanceData(sourceInstanceId) {
    if (!sourceInstanceId) {
      return { success: false, message: "Missing source instance ID" };
    }
    const sourceInstance = await figma.getNodeByIdAsync(sourceInstanceId);
    if (!sourceInstance) {
      return {
        success: false,
        message: "Source instance not found. The original instance may have been deleted."
      };
    }
    if (sourceInstance.type !== "INSTANCE") {
      return {
        success: false,
        message: "Source node is not a component instance."
      };
    }
    const mainComponent = await sourceInstance.getMainComponentAsync();
    if (!mainComponent) {
      return {
        success: false,
        message: "Failed to get main component from source instance."
      };
    }
    return {
      success: true,
      sourceInstance,
      mainComponent,
      overrides: sourceInstance.overrides || []
    };
  }
  async function setInstanceOverrides(targetInstances, sourceResult) {
    try {
      const { sourceInstance, mainComponent, overrides } = sourceResult;
      console.log(`Processing ${targetInstances.length} instances with ${overrides.length} overrides`);
      console.log(`Source instance: ${sourceInstance.id}, Main component: ${mainComponent.id}`);
      console.log(`Overrides:`, overrides);
      const results = [];
      let totalAppliedCount = 0;
      for (const targetInstance of targetInstances) {
        try {
          try {
            targetInstance.swapComponent(mainComponent);
            console.log(`Swapped component for instance "${targetInstance.name}"`);
          } catch (error) {
            console.error(`Error swapping component for instance "${targetInstance.name}":`, error);
            results.push({
              success: false,
              instanceId: targetInstance.id,
              instanceName: targetInstance.name,
              message: `Error: ${error.message}`
            });
          }
          let appliedCount = 0;
          for (const override of overrides) {
            if (!override.id || !override.overriddenFields || override.overriddenFields.length === 0) {
              continue;
            }
            const overrideNodeId = override.id.replace(sourceInstance.id, targetInstance.id);
            const overrideNode = await figma.getNodeByIdAsync(overrideNodeId);
            if (!overrideNode) {
              console.log(`Override node not found: ${overrideNodeId}`);
              continue;
            }
            const sourceNode = await figma.getNodeByIdAsync(override.id);
            if (!sourceNode) {
              console.log(`Source node not found: ${override.id}`);
              continue;
            }
            let fieldApplied = false;
            for (const field of override.overriddenFields) {
              try {
                if (field === "componentProperties") {
                  if (sourceNode.componentProperties && overrideNode.componentProperties) {
                    const properties = {};
                    for (const key in sourceNode.componentProperties) {
                      properties[key] = sourceNode.componentProperties[key].value;
                    }
                    overrideNode.setProperties(properties);
                    fieldApplied = true;
                  }
                } else if (field === "characters" && overrideNode.type === "TEXT") {
                  await figma.loadFontAsync(overrideNode.fontName);
                  overrideNode.characters = sourceNode.characters;
                  fieldApplied = true;
                } else if (field in overrideNode) {
                  overrideNode[field] = sourceNode[field];
                  fieldApplied = true;
                }
              } catch (fieldError) {
                console.error(`Error applying field ${field}:`, fieldError);
              }
            }
            if (fieldApplied) {
              appliedCount++;
            }
          }
          if (appliedCount > 0) {
            totalAppliedCount += appliedCount;
            results.push({
              success: true,
              instanceId: targetInstance.id,
              instanceName: targetInstance.name,
              appliedCount
            });
            console.log(`Applied ${appliedCount} overrides to "${targetInstance.name}"`);
          } else {
            results.push({
              success: false,
              instanceId: targetInstance.id,
              instanceName: targetInstance.name,
              message: "No overrides were applied"
            });
          }
        } catch (instanceError) {
          console.error(`Error processing instance "${targetInstance.name}":`, instanceError);
          results.push({
            success: false,
            instanceId: targetInstance.id,
            instanceName: targetInstance.name,
            message: `Error: ${instanceError.message}`
          });
        }
      }
      if (totalAppliedCount > 0) {
        const instanceCount = results.filter((r) => r.success).length;
        const message = `Applied ${totalAppliedCount} overrides to ${instanceCount} instances`;
        figma.notify(message);
        return {
          success: true,
          message,
          totalCount: totalAppliedCount,
          results
        };
      } else {
        const message = "No overrides applied to any instance";
        figma.notify(message);
        return { success: false, message, results };
      }
    } catch (error) {
      console.error("Error in setInstanceOverrides:", error);
      const message = `Error: ${error.message}`;
      figma.notify(message);
      return { success: false, message };
    }
  }

  // src/figma_plugin/handlers/connectorHandlers.js
  async function getReactions(nodeIds) {
    try {
      let getNodePath = function(node) {
        const path = [];
        let current = node;
        while (current && current.parent) {
          path.unshift(current.name);
          current = current.parent;
        }
        return path.join(" > ");
      };
      const commandId = generateCommandId();
      sendProgressUpdate(
        commandId,
        "get_reactions",
        "started",
        0,
        nodeIds.length,
        0,
        `Starting deep search for reactions in ${nodeIds.length} nodes and their children`
      );
      async function findNodesWithReactions(node, processedNodes = /* @__PURE__ */ new Set(), depth = 0, results = []) {
        if (processedNodes.has(node.id)) {
          return results;
        }
        processedNodes.add(node.id);
        let filteredReactions = [];
        if (node.reactions && node.reactions.length > 0) {
          filteredReactions = node.reactions.filter((r) => {
            if (r.action && r.action.navigation === "CHANGE_TO") return false;
            if (Array.isArray(r.actions)) {
              return !r.actions.some((a) => a.navigation === "CHANGE_TO");
            }
            return true;
          });
        }
        const hasFilteredReactions = filteredReactions.length > 0;
        if (hasFilteredReactions) {
          results.push({
            id: node.id,
            name: node.name,
            type: node.type,
            depth,
            hasReactions: true,
            reactions: filteredReactions,
            path: getNodePath(node)
          });
        }
        if (node.children) {
          for (const child of node.children) {
            await findNodesWithReactions(child, processedNodes, depth + 1, results);
          }
        }
        return results;
      }
      let allResults = [];
      let processedCount = 0;
      const totalCount = nodeIds.length;
      for (let i = 0; i < nodeIds.length; i++) {
        try {
          const nodeId = nodeIds[i];
          const node = await figma.getNodeByIdAsync(nodeId);
          if (!node) {
            processedCount++;
            sendProgressUpdate(
              commandId,
              "get_reactions",
              "in_progress",
              processedCount / totalCount,
              totalCount,
              processedCount,
              `Node not found: ${nodeId}`
            );
            continue;
          }
          const processedNodes = /* @__PURE__ */ new Set();
          const nodeResults = await findNodesWithReactions(node, processedNodes);
          allResults = allResults.concat(nodeResults);
          processedCount++;
          sendProgressUpdate(
            commandId,
            "get_reactions",
            "in_progress",
            processedCount / totalCount,
            totalCount,
            processedCount,
            `Processed node ${processedCount}/${totalCount}, found ${nodeResults.length} nodes with reactions`
          );
        } catch (error) {
          processedCount++;
          sendProgressUpdate(
            commandId,
            "get_reactions",
            "in_progress",
            processedCount / totalCount,
            totalCount,
            processedCount,
            `Error processing node: ${error.message}`
          );
        }
      }
      sendProgressUpdate(
        commandId,
        "get_reactions",
        "completed",
        1,
        totalCount,
        totalCount,
        `Completed deep search: found ${allResults.length} nodes with reactions.`
      );
      return {
        nodesCount: nodeIds.length,
        nodesWithReactions: allResults.length,
        nodes: allResults
      };
    } catch (error) {
      throw new Error(`Failed to get reactions: ${error.message}`);
    }
  }
  async function setDefaultConnector(params) {
    const { connectorId } = params || {};
    if (connectorId) {
      const node = await figma.getNodeByIdAsync(connectorId);
      if (!node) {
        throw new Error(`Connector node not found with ID: ${connectorId}`);
      }
      if (node.type !== "CONNECTOR") {
        throw new Error(`Node is not a connector: ${connectorId}`);
      }
      await figma.clientStorage.setAsync("defaultConnectorId", connectorId);
      return {
        success: true,
        message: `Default connector set to: ${connectorId}`,
        connectorId
      };
    } else {
      try {
        const existingConnectorId = await figma.clientStorage.getAsync("defaultConnectorId");
        if (existingConnectorId) {
          try {
            const existingConnector = await figma.getNodeByIdAsync(existingConnectorId);
            if (existingConnector && existingConnector.type === "CONNECTOR") {
              return {
                success: true,
                message: `Default connector is already set to: ${existingConnectorId}`,
                connectorId: existingConnectorId,
                exists: true
              };
            } else {
              console.log(`Stored connector ID ${existingConnectorId} is no longer valid, finding a new connector...`);
            }
          } catch (error) {
            console.log(`Error finding stored connector: ${error.message}. Will try to set a new one.`);
          }
        }
      } catch (error) {
        console.log(`Error checking for existing connector: ${error.message}`);
      }
      try {
        const currentPageConnectors = figma.currentPage.findAllWithCriteria({ types: ["CONNECTOR"] });
        if (currentPageConnectors && currentPageConnectors.length > 0) {
          const foundConnector = currentPageConnectors[0];
          const autoFoundId = foundConnector.id;
          await figma.clientStorage.setAsync("defaultConnectorId", autoFoundId);
          return {
            success: true,
            message: `Automatically found and set default connector to: ${autoFoundId}`,
            connectorId: autoFoundId,
            autoSelected: true
          };
        } else {
          throw new Error("No connector found in the current page. Please create a connector in Figma first or specify a connector ID.");
        }
      } catch (error) {
        throw new Error(`Failed to find a connector: ${error.message}`);
      }
    }
  }
  async function createCursorNode(targetNodeId) {
    const svgString = `<svg width="48" height="48" viewBox="0 0 48 48" fill="none" xmlns="http://www.w3.org/2000/svg">
    <path d="M16 8V35.2419L22 28.4315L27 39.7823C27 39.7823 28.3526 40.2722 29 39.7823C29.6474 39.2924 30.2913 38.3057 30 37.5121C28.6247 33.7654 25 26.1613 25 26.1613H32L16 8Z" fill="#202125" />
  </svg>`;
    try {
      const targetNode = await figma.getNodeByIdAsync(targetNodeId);
      if (!targetNode) throw new Error("Target node not found");
      let parentNodeId = targetNodeId.includes(";") ? targetNodeId.split(";")[0] : targetNodeId;
      if (!parentNodeId) throw new Error("Could not determine parent node ID");
      let parentNode = await figma.getNodeByIdAsync(parentNodeId);
      if (!parentNode) throw new Error("Parent node not found");
      if (parentNode.type === "INSTANCE" || parentNode.type === "COMPONENT" || parentNode.type === "COMPONENT_SET") {
        parentNode = parentNode.parent;
        if (!parentNode) throw new Error("Parent node not found");
      }
      const importedNode = await figma.createNodeFromSvg(svgString);
      if (!importedNode || !importedNode.id) {
        throw new Error("Failed to create imported cursor node");
      }
      importedNode.name = "TTF_Connector / Mouse Cursor";
      importedNode.resize(48, 48);
      const cursorNode = importedNode.findOne((node) => node.type === "VECTOR");
      if (cursorNode) {
        cursorNode.fills = [{
          type: "SOLID",
          color: { r: 0, g: 0, b: 0 },
          opacity: 1
        }];
        cursorNode.strokes = [{
          type: "SOLID",
          color: { r: 1, g: 1, b: 1 },
          opacity: 1
        }];
        cursorNode.strokeWeight = 2;
        cursorNode.strokeAlign = "OUTSIDE";
        cursorNode.effects = [{
          type: "DROP_SHADOW",
          color: { r: 0, g: 0, b: 0, a: 0.3 },
          offset: { x: 1, y: 1 },
          radius: 2,
          spread: 0,
          visible: true,
          blendMode: "NORMAL"
        }];
      }
      parentNode.appendChild(importedNode);
      if ("layoutMode" in parentNode && parentNode.layoutMode !== "NONE") {
        importedNode.layoutPositioning = "ABSOLUTE";
      }
      if (targetNode.absoluteBoundingBox && parentNode.absoluteBoundingBox) {
        console.log("targetNode.absoluteBoundingBox", targetNode.absoluteBoundingBox);
        console.log("parentNode.absoluteBoundingBox", parentNode.absoluteBoundingBox);
        importedNode.x = targetNode.absoluteBoundingBox.x - parentNode.absoluteBoundingBox.x + targetNode.absoluteBoundingBox.width / 2 - 48 / 2;
        importedNode.y = targetNode.absoluteBoundingBox.y - parentNode.absoluteBoundingBox.y + targetNode.absoluteBoundingBox.height / 2 - 48 / 2;
      } else if ("x" in targetNode && "y" in targetNode && "width" in targetNode && "height" in targetNode) {
        console.log("targetNode.x/y/width/height", targetNode.x, targetNode.y, targetNode.width, targetNode.height);
        importedNode.x = targetNode.x + targetNode.width / 2 - 48 / 2;
        importedNode.y = targetNode.y + targetNode.height / 2 - 48 / 2;
      } else {
        if ("x" in targetNode && "y" in targetNode) {
          console.log("Fallback to targetNode x/y");
          importedNode.x = targetNode.x;
          importedNode.y = targetNode.y;
        } else {
          console.log("Fallback to (0,0)");
          importedNode.x = 0;
          importedNode.y = 0;
        }
      }
      console.log("importedNode", importedNode);
      return { id: importedNode.id, node: importedNode };
    } catch (error) {
      console.error("Error creating cursor from SVG:", error);
      return { id: null, node: null, error: error.message };
    }
  }
  async function createConnections(params) {
    if (!params || !params.connections || !Array.isArray(params.connections)) {
      throw new Error("Missing or invalid connections parameter");
    }
    const { connections } = params;
    const commandId = generateCommandId();
    sendProgressUpdate(
      commandId,
      "create_connections",
      "started",
      0,
      connections.length,
      0,
      `Starting to create ${connections.length} connections`
    );
    const defaultConnectorId = await figma.clientStorage.getAsync("defaultConnectorId");
    if (!defaultConnectorId) {
      throw new Error('No default connector set. Please try one of the following options to create connections:\n1. Create a connector in FigJam and copy/paste it to your current page, then run the "set_default_connector" command.\n2. Select an existing connector on the current page, then run the "set_default_connector" command.');
    }
    const defaultConnector = await figma.getNodeByIdAsync(defaultConnectorId);
    if (!defaultConnector) {
      throw new Error(`Default connector not found with ID: ${defaultConnectorId}`);
    }
    if (defaultConnector.type !== "CONNECTOR") {
      throw new Error(`Node is not a connector: ${defaultConnectorId}`);
    }
    const results = [];
    let processedCount = 0;
    const totalCount = connections.length;
    for (let i = 0; i < connections.length; i++) {
      try {
        const { startNodeId: originalStartId, endNodeId: originalEndId, text } = connections[i];
        let startId = originalStartId;
        let endId = originalEndId;
        if (startId.includes(";")) {
          console.log(`Nested start node detected: ${startId}. Creating cursor node.`);
          const cursorResult = await createCursorNode(startId);
          if (!cursorResult || !cursorResult.id) {
            throw new Error(`Failed to create cursor node for nested start node: ${startId}`);
          }
          startId = cursorResult.id;
        }
        const startNode = await figma.getNodeByIdAsync(startId);
        if (!startNode) throw new Error(`Start node not found with ID: ${startId}`);
        if (endId.includes(";")) {
          console.log(`Nested end node detected: ${endId}. Creating cursor node.`);
          const cursorResult = await createCursorNode(endId);
          if (!cursorResult || !cursorResult.id) {
            throw new Error(`Failed to create cursor node for nested end node: ${endId}`);
          }
          endId = cursorResult.id;
        }
        const endNode = await figma.getNodeByIdAsync(endId);
        if (!endNode) throw new Error(`End node not found with ID: ${endId}`);
        const clonedConnector = defaultConnector.clone();
        clonedConnector.name = `TTF_Connector/${startNode.id}/${endNode.id}`;
        clonedConnector.connectorStart = {
          endpointNodeId: startId,
          magnet: "AUTO"
        };
        clonedConnector.connectorEnd = {
          endpointNodeId: endId,
          magnet: "AUTO"
        };
        if (text) {
          try {
            try {
              if (defaultConnector.text && defaultConnector.text.fontName) {
                const fontName = defaultConnector.text.fontName;
                await figma.loadFontAsync(fontName);
                clonedConnector.text.fontName = fontName;
              } else {
                await figma.loadFontAsync({ family: "Inter", style: "Regular" });
              }
            } catch (fontError) {
              try {
                await figma.loadFontAsync({ family: "Inter", style: "Medium" });
              } catch (mediumFontError) {
                try {
                  await figma.loadFontAsync({ family: "System", style: "Regular" });
                } catch (systemFontError) {
                  throw new Error(`Failed to load any font: ${fontError.message}`);
                }
              }
            }
            clonedConnector.text.characters = text;
          } catch (textError) {
            console.error("Error setting text:", textError);
            results.push({
              id: clonedConnector.id,
              startNodeId: originalStartId,
              endNodeId: originalEndId,
              text: "",
              textError: textError.message
            });
            continue;
          }
        }
        results.push({
          id: clonedConnector.id,
          originalStartNodeId: originalStartId,
          originalEndNodeId: originalEndId,
          usedStartNodeId: startId,
          // ID actually used for connection
          usedEndNodeId: endId,
          // ID actually used for connection
          text: text || ""
        });
        processedCount++;
        sendProgressUpdate(
          commandId,
          "create_connections",
          "in_progress",
          processedCount / totalCount,
          totalCount,
          processedCount,
          `Created connection ${processedCount}/${totalCount}`
        );
      } catch (error) {
        console.error("Error creating connection", error);
        processedCount++;
        sendProgressUpdate(
          commandId,
          "create_connections",
          "in_progress",
          processedCount / totalCount,
          totalCount,
          processedCount,
          `Error creating connection: ${error.message}`
        );
        results.push({
          error: error.message,
          connectionInfo: connections[i]
        });
      }
    }
    sendProgressUpdate(
      commandId,
      "create_connections",
      "completed",
      1,
      totalCount,
      totalCount,
      `Completed creating ${results.length} connections`
    );
    return {
      success: true,
      count: results.length,
      connections: results
    };
  }

  // src/figma_plugin/handlers/textHandlers.js
  async function scanTextNodes(params) {
    console.log(`Starting to scan text nodes from node ID: ${params.nodeId}`);
    const {
      nodeId,
      useChunking = true,
      chunkSize = 10,
      commandId = generateCommandId()
    } = params || {};
    const node = await figma.getNodeByIdAsync(nodeId);
    if (!node) {
      console.error(`Node with ID ${nodeId} not found`);
      sendProgressUpdate(
        commandId,
        "scan_text_nodes",
        "error",
        0,
        0,
        0,
        `Node with ID ${nodeId} not found`,
        { error: `Node not found: ${nodeId}` }
      );
      throw new Error(`Node with ID ${nodeId} not found`);
    }
    if (!useChunking) {
      const textNodes = [];
      try {
        sendProgressUpdate(
          commandId,
          "scan_text_nodes",
          "started",
          0,
          1,
          // Not known yet how many nodes there are
          0,
          `Starting scan of node "${node.name || nodeId}" without chunking`,
          null
        );
        await findTextNodes(node, [], 0, textNodes);
        sendProgressUpdate(
          commandId,
          "scan_text_nodes",
          "completed",
          100,
          textNodes.length,
          textNodes.length,
          `Scan complete. Found ${textNodes.length} text nodes.`,
          { textNodes }
        );
        return {
          success: true,
          message: `Scanned ${textNodes.length} text nodes.`,
          count: textNodes.length,
          textNodes,
          commandId
        };
      } catch (error) {
        console.error("Error scanning text nodes:", error);
        sendProgressUpdate(
          commandId,
          "scan_text_nodes",
          "error",
          0,
          0,
          0,
          `Error scanning text nodes: ${error.message}`,
          { error: error.message }
        );
        throw new Error(`Error scanning text nodes: ${error.message}`);
      }
    }
    console.log(`Using chunked scanning with chunk size: ${chunkSize}`);
    const nodesToProcess = [];
    sendProgressUpdate(
      commandId,
      "scan_text_nodes",
      "started",
      0,
      0,
      // Not known yet how many nodes there are
      0,
      `Starting chunked scan of node "${node.name || nodeId}"`,
      { chunkSize }
    );
    await collectNodesToProcess(node, [], 0, nodesToProcess);
    const totalNodes = nodesToProcess.length;
    console.log(`Found ${totalNodes} total nodes to process`);
    const totalChunks = Math.ceil(totalNodes / chunkSize);
    console.log(`Will process in ${totalChunks} chunks`);
    sendProgressUpdate(
      commandId,
      "scan_text_nodes",
      "in_progress",
      5,
      // 5% progress for collection phase
      totalNodes,
      0,
      `Found ${totalNodes} nodes to scan. Will process in ${totalChunks} chunks.`,
      {
        totalNodes,
        totalChunks,
        chunkSize
      }
    );
    const allTextNodes = [];
    let processedNodes = 0;
    let chunksProcessed = 0;
    for (let i = 0; i < totalNodes; i += chunkSize) {
      const chunkEnd = Math.min(i + chunkSize, totalNodes);
      console.log(
        `Processing chunk ${chunksProcessed + 1}/${totalChunks} (nodes ${i} to ${chunkEnd - 1})`
      );
      sendProgressUpdate(
        commandId,
        "scan_text_nodes",
        "in_progress",
        Math.round(5 + chunksProcessed / totalChunks * 90),
        // 5-95% for processing
        totalNodes,
        processedNodes,
        `Processing chunk ${chunksProcessed + 1}/${totalChunks}`,
        {
          currentChunk: chunksProcessed + 1,
          totalChunks,
          textNodesFound: allTextNodes.length
        }
      );
      const chunkNodes = nodesToProcess.slice(i, chunkEnd);
      const chunkTextNodes = [];
      for (const nodeInfo of chunkNodes) {
        if (nodeInfo.node.type === "TEXT") {
          try {
            const textNodeInfo = await processTextNode(
              nodeInfo.node,
              nodeInfo.parentPath,
              nodeInfo.depth
            );
            if (textNodeInfo) {
              chunkTextNodes.push(textNodeInfo);
            }
          } catch (error) {
            console.error(`Error processing text node: ${error.message}`);
          }
        }
        await delay(5);
      }
      allTextNodes.push(...chunkTextNodes);
      processedNodes += chunkNodes.length;
      chunksProcessed++;
      sendProgressUpdate(
        commandId,
        "scan_text_nodes",
        "in_progress",
        Math.round(5 + chunksProcessed / totalChunks * 90),
        // 5-95% for processing
        totalNodes,
        processedNodes,
        `Processed chunk ${chunksProcessed}/${totalChunks}. Found ${allTextNodes.length} text nodes so far.`,
        {
          currentChunk: chunksProcessed,
          totalChunks,
          processedNodes,
          textNodesFound: allTextNodes.length,
          chunkResult: chunkTextNodes
        }
      );
      if (i + chunkSize < totalNodes) {
        await delay(50);
      }
    }
    sendProgressUpdate(
      commandId,
      "scan_text_nodes",
      "completed",
      100,
      totalNodes,
      processedNodes,
      `Scan complete. Found ${allTextNodes.length} text nodes.`,
      {
        textNodes: allTextNodes,
        processedNodes,
        chunks: chunksProcessed
      }
    );
    return {
      success: true,
      message: `Chunked scan complete. Found ${allTextNodes.length} text nodes.`,
      totalNodes: allTextNodes.length,
      processedNodes,
      chunks: chunksProcessed,
      textNodes: allTextNodes,
      commandId
    };
  }
  async function processTextNode(node, parentPath, depth) {
    if (node.type !== "TEXT") return null;
    try {
      let fontFamily = "";
      let fontStyle = "";
      if (node.fontName) {
        if (typeof node.fontName === "object") {
          if ("family" in node.fontName) fontFamily = node.fontName.family;
          if ("style" in node.fontName) fontStyle = node.fontName.style;
        }
      }
      const safeTextNode = {
        id: node.id,
        name: node.name || "Text",
        type: node.type,
        characters: node.characters,
        fontSize: typeof node.fontSize === "number" ? node.fontSize : 0,
        fontFamily,
        fontStyle,
        x: typeof node.x === "number" ? node.x : 0,
        y: typeof node.y === "number" ? node.y : 0,
        width: typeof node.width === "number" ? node.width : 0,
        height: typeof node.height === "number" ? node.height : 0,
        path: parentPath.join(" > "),
        depth
      };
      return safeTextNode;
    } catch (nodeErr) {
      console.error("Error processing text node:", nodeErr);
      return null;
    }
  }
  async function findTextNodes(node, parentPath = [], depth = 0, textNodes = []) {
    if (node.visible === false) return;
    const nodePath = [...parentPath, node.name || `Unnamed ${node.type}`];
    if (node.type === "TEXT") {
      try {
        let fontFamily = "";
        let fontStyle = "";
        if (node.fontName) {
          if (typeof node.fontName === "object") {
            if ("family" in node.fontName) fontFamily = node.fontName.family;
            if ("style" in node.fontName) fontStyle = node.fontName.style;
          }
        }
        const safeTextNode = {
          id: node.id,
          name: node.name || "Text",
          type: node.type,
          characters: node.characters,
          fontSize: typeof node.fontSize === "number" ? node.fontSize : 0,
          fontFamily,
          fontStyle,
          x: typeof node.x === "number" ? node.x : 0,
          y: typeof node.y === "number" ? node.y : 0,
          width: typeof node.width === "number" ? node.width : 0,
          height: typeof node.height === "number" ? node.height : 0,
          path: nodePath.join(" > "),
          depth
        };
        textNodes.push(safeTextNode);
      } catch (nodeErr) {
        console.error("Error processing text node:", nodeErr);
      }
    }
    if ("children" in node) {
      for (const child of node.children) {
        await findTextNodes(child, nodePath, depth + 1, textNodes);
      }
    }
  }
  async function setTextContent(params) {
    const { nodeId, text } = params || {};
    if (!nodeId) {
      throw new Error("Missing nodeId parameter");
    }
    const node = await figma.getNodeByIdAsync(nodeId);
    if (!node) {
      throw new Error(`Node not found with ID: ${nodeId}`);
    }
    if (node.type !== "TEXT") {
      throw new Error(`Node is not a text node: ${nodeId} (type: ${node.type})`);
    }
    await setCharacters(node, text);
    return {
      success: true,
      nodeId,
      text
    };
  }
  async function setMultipleTextContents(params) {
    const { nodeId, text } = params || {};
    const commandId = params.commandId || generateCommandId();
    if (!nodeId || !text || !Array.isArray(text)) {
      const errorMsg = "Missing required parameters: nodeId and text array";
      sendProgressUpdate(
        commandId,
        "set_multiple_text_contents",
        "error",
        0,
        0,
        0,
        errorMsg,
        { error: errorMsg }
      );
      throw new Error(errorMsg);
    }
    console.log(
      `Starting text replacement for node: ${nodeId} with ${text.length} text replacements`
    );
    sendProgressUpdate(
      commandId,
      "set_multiple_text_contents",
      "started",
      0,
      text.length,
      0,
      `Starting text replacement for ${text.length} nodes`,
      { totalReplacements: text.length }
    );
    const results = [];
    let successCount = 0;
    let failureCount = 0;
    const CHUNK_SIZE = 5;
    const chunks = [];
    for (let i = 0; i < text.length; i += CHUNK_SIZE) {
      chunks.push(text.slice(i, i + CHUNK_SIZE));
    }
    console.log(`Split ${text.length} replacements into ${chunks.length} chunks`);
    sendProgressUpdate(
      commandId,
      "set_multiple_text_contents",
      "in_progress",
      5,
      // 5% progress for planning phase
      text.length,
      0,
      `Preparing to replace text in ${text.length} nodes using ${chunks.length} chunks`,
      {
        totalReplacements: text.length,
        chunks: chunks.length,
        chunkSize: CHUNK_SIZE
      }
    );
    for (let chunkIndex = 0; chunkIndex < chunks.length; chunkIndex++) {
      const chunk = chunks[chunkIndex];
      console.log(
        `Processing chunk ${chunkIndex + 1}/${chunks.length} with ${chunk.length} replacements`
      );
      sendProgressUpdate(
        commandId,
        "set_multiple_text_contents",
        "in_progress",
        Math.round(5 + chunkIndex / chunks.length * 90),
        // 5-95% for processing
        text.length,
        successCount + failureCount,
        `Processing text replacements chunk ${chunkIndex + 1}/${chunks.length}`,
        {
          currentChunk: chunkIndex + 1,
          totalChunks: chunks.length,
          successCount,
          failureCount
        }
      );
      const chunkPromises = chunk.map(async (replacement) => {
        if (!replacement.nodeId || replacement.text === void 0) {
          console.error(`Missing nodeId or text for replacement`);
          return {
            success: false,
            nodeId: replacement.nodeId || "unknown",
            error: "Missing nodeId or text in replacement entry"
          };
        }
        try {
          console.log(
            `Attempting to replace text in node: ${replacement.nodeId}`
          );
          const textNode = await figma.getNodeByIdAsync(replacement.nodeId);
          if (!textNode) {
            console.error(`Text node not found: ${replacement.nodeId}`);
            return {
              success: false,
              nodeId: replacement.nodeId,
              error: `Node not found: ${replacement.nodeId}`
            };
          }
          if (textNode.type !== "TEXT") {
            console.error(
              `Node is not a text node: ${replacement.nodeId} (type: ${textNode.type})`
            );
            return {
              success: false,
              nodeId: replacement.nodeId,
              error: `Node is not a text node: ${replacement.nodeId} (type: ${textNode.type})`
            };
          }
          const originalText = textNode.characters;
          console.log(`Original text: "${originalText}"`);
          console.log(`Will translate to: "${replacement.text}"`);
          await setTextContent({
            nodeId: replacement.nodeId,
            text: replacement.text
          });
          console.log(
            `Successfully replaced text in node: ${replacement.nodeId}`
          );
          return {
            success: true,
            nodeId: replacement.nodeId,
            originalText,
            translatedText: replacement.text
          };
        } catch (error) {
          console.error(
            `Error replacing text in node ${replacement.nodeId}: ${error.message}`
          );
          return {
            success: false,
            nodeId: replacement.nodeId,
            error: `Error applying replacement: ${error.message}`
          };
        }
      });
      const chunkResults = await Promise.all(chunkPromises);
      chunkResults.forEach((result) => {
        if (result.success) {
          successCount++;
        } else {
          failureCount++;
        }
        results.push(result);
      });
      sendProgressUpdate(
        commandId,
        "set_multiple_text_contents",
        "in_progress",
        Math.round(5 + (chunkIndex + 1) / chunks.length * 90),
        // 5-95% for processing
        text.length,
        successCount + failureCount,
        `Completed chunk ${chunkIndex + 1}/${chunks.length}. ${successCount} successful, ${failureCount} failed so far.`,
        {
          currentChunk: chunkIndex + 1,
          totalChunks: chunks.length,
          successCount,
          failureCount,
          chunkResults
        }
      );
      if (chunkIndex < chunks.length - 1) {
        console.log("Pausing between chunks to avoid overloading Figma...");
        await delay(1e3);
      }
    }
    console.log(
      `Replacement complete: ${successCount} successful, ${failureCount} failed`
    );
    sendProgressUpdate(
      commandId,
      "set_multiple_text_contents",
      "completed",
      100,
      text.length,
      successCount + failureCount,
      `Text replacement complete: ${successCount} successful, ${failureCount} failed`,
      {
        totalReplacements: text.length,
        replacementsApplied: successCount,
        replacementsFailed: failureCount,
        completedInChunks: chunks.length,
        results
      }
    );
    return {
      success: successCount > 0,
      nodeId,
      replacementsApplied: successCount,
      replacementsFailed: failureCount,
      totalReplacements: text.length,
      results,
      completedInChunks: chunks.length,
      commandId
    };
  }

  // src/figma_plugin/handlers/annotationHandlers.js
  async function getAnnotations(params) {
    try {
      const { nodeId, includeCategories = true } = params;
      let categoriesMap = {};
      if (includeCategories) {
        const categories = await figma.annotations.getAnnotationCategoriesAsync();
        categoriesMap = categories.reduce((map, category) => {
          map[category.id] = {
            id: category.id,
            label: category.label,
            color: category.color,
            isPreset: category.isPreset
          };
          return map;
        }, {});
      }
      if (nodeId) {
        const node = await figma.getNodeByIdAsync(nodeId);
        if (!node) {
          throw new Error(`Node not found: ${nodeId}`);
        }
        if (!("annotations" in node)) {
          throw new Error(`Node type ${node.type} does not support annotations`);
        }
        const mergedAnnotations = [];
        const collect = async (n) => {
          if ("annotations" in n && n.annotations && n.annotations.length > 0) {
            for (const a of n.annotations) {
              mergedAnnotations.push({ nodeId: n.id, annotation: a });
            }
          }
          if ("children" in n) {
            for (const child of n.children) {
              await collect(child);
            }
          }
        };
        await collect(node);
        const result = {
          nodeId: node.id,
          name: node.name,
          annotations: mergedAnnotations
        };
        if (includeCategories) {
          result.categories = Object.values(categoriesMap);
        }
        return result;
      } else {
        const annotations = [];
        const processNode = async (node) => {
          if ("annotations" in node && node.annotations && node.annotations.length > 0) {
            annotations.push({
              nodeId: node.id,
              name: node.name,
              annotations: node.annotations
            });
          }
          if ("children" in node) {
            for (const child of node.children) {
              await processNode(child);
            }
          }
        };
        await processNode(figma.currentPage);
        const result = {
          annotatedNodes: annotations
        };
        if (includeCategories) {
          result.categories = Object.values(categoriesMap);
        }
        return result;
      }
    } catch (error) {
      console.error("Error in getAnnotations:", error);
      throw error;
    }
  }
  async function scanNodesByTypes(params) {
    console.log(`Starting to scan nodes by types from node ID: ${params.nodeId}`);
    const { nodeId, types = [] } = params || {};
    if (!types || types.length === 0) {
      throw new Error("No types specified to search for");
    }
    const node = await figma.getNodeByIdAsync(nodeId);
    if (!node) {
      throw new Error(`Node with ID ${nodeId} not found`);
    }
    const matchingNodes = [];
    const commandId = generateCommandId();
    sendProgressUpdate(
      commandId,
      "scan_nodes_by_types",
      "started",
      0,
      1,
      0,
      `Starting scan of node "${node.name || nodeId}" for types: ${types.join(
        ", "
      )}`,
      null
    );
    await findNodesByTypes(node, types, matchingNodes);
    sendProgressUpdate(
      commandId,
      "scan_nodes_by_types",
      "completed",
      100,
      matchingNodes.length,
      matchingNodes.length,
      `Scan complete. Found ${matchingNodes.length} matching nodes.`,
      { matchingNodes }
    );
    return {
      success: true,
      message: `Found ${matchingNodes.length} matching nodes.`,
      count: matchingNodes.length,
      matchingNodes,
      searchedTypes: types
    };
  }
  async function findNodesByTypes(node, types, matchingNodes = []) {
    if (node.visible === false) return;
    if (types.includes(node.type)) {
      matchingNodes.push({
        id: node.id,
        name: node.name || `Unnamed ${node.type}`,
        type: node.type,
        // Basic bounding box info
        bbox: {
          x: typeof node.x === "number" ? node.x : 0,
          y: typeof node.y === "number" ? node.y : 0,
          width: typeof node.width === "number" ? node.width : 0,
          height: typeof node.height === "number" ? node.height : 0
        }
      });
    }
    if ("children" in node) {
      for (const child of node.children) {
        await findNodesByTypes(child, types, matchingNodes);
      }
    }
  }
  async function setAnnotation(params) {
    const { nodeId, labelMarkdown, categoryId, properties } = params || {};
    if (!nodeId) {
      return { success: false, error: "Missing nodeId parameter" };
    }
    if (!labelMarkdown) {
      return { success: false, error: "Missing labelMarkdown parameter" };
    }
    try {
      const node = await figma.getNodeByIdAsync(nodeId);
      if (!node) {
        return { success: false, error: `Node not found: ${nodeId}` };
      }
      if (!("annotations" in node)) {
        return { success: false, error: `Node type ${node.type} does not support annotations` };
      }
      const annotationObj = {
        label: {
          type: "MARKDOWN",
          content: labelMarkdown
        }
      };
      if (categoryId) {
        annotationObj.categoryId = categoryId;
      }
      if (properties && Array.isArray(properties)) {
        annotationObj.properties = properties;
      }
      const existingAnnotations = node.annotations || [];
      node.annotations = [...existingAnnotations, annotationObj];
      return {
        success: true,
        nodeId,
        annotationCount: node.annotations.length
      };
    } catch (error) {
      console.error("Error in setAnnotation:", error);
      return { success: false, error: error.message };
    }
  }
  async function setMultipleAnnotations(params) {
    console.log("=== setMultipleAnnotations Debug Start ===");
    console.log("Input params:", JSON.stringify(params, null, 2));
    const { nodeId, annotations } = params;
    if (!annotations || annotations.length === 0) {
      console.error("Validation failed: No annotations provided");
      return { success: false, error: "No annotations provided" };
    }
    console.log(
      `Processing ${annotations.length} annotations for node ${nodeId}`
    );
    const results = [];
    let successCount = 0;
    let failureCount = 0;
    for (let i = 0; i < annotations.length; i++) {
      const annotation = annotations[i];
      console.log(
        `
Processing annotation ${i + 1}/${annotations.length}:`,
        JSON.stringify(annotation, null, 2)
      );
      try {
        console.log("Calling setAnnotation with params:", {
          nodeId: annotation.nodeId,
          labelMarkdown: annotation.labelMarkdown,
          categoryId: annotation.categoryId,
          properties: annotation.properties
        });
        const result = await setAnnotation({
          nodeId: annotation.nodeId,
          labelMarkdown: annotation.labelMarkdown,
          categoryId: annotation.categoryId,
          properties: annotation.properties
        });
        console.log("setAnnotation result:", JSON.stringify(result, null, 2));
        if (result.success) {
          successCount++;
          results.push({ success: true, nodeId: annotation.nodeId });
          console.log(`\u2713 Annotation ${i + 1} applied successfully`);
        } else {
          failureCount++;
          results.push({
            success: false,
            nodeId: annotation.nodeId,
            error: result.error
          });
          console.error(`\u2717 Annotation ${i + 1} failed:`, result.error);
        }
      } catch (error) {
        failureCount++;
        const errorResult = {
          success: false,
          nodeId: annotation.nodeId,
          error: error.message
        };
        results.push(errorResult);
        console.error(`\u2717 Annotation ${i + 1} failed with error:`, error);
        console.error("Error details:", {
          message: error.message,
          stack: error.stack
        });
      }
    }
    const summary = {
      success: successCount > 0,
      annotationsApplied: successCount,
      annotationsFailed: failureCount,
      totalAnnotations: annotations.length,
      results
    };
    console.log("\n=== setMultipleAnnotations Summary ===");
    console.log(JSON.stringify(summary, null, 2));
    console.log("=== setMultipleAnnotations Debug End ===");
    return summary;
  }

  // src/figma_plugin/handlers/variableHandlers.js
  async function getVariables(params) {
    const { variableId } = params || {};
    try {
      if (variableId) {
        const variable = await figma.variables.getVariableByIdAsync(variableId);
        if (!variable) {
          return null;
        }
        const collection = await figma.variables.getVariableCollectionByIdAsync(
          variable.variableCollectionId
        );
        return {
          id: variable.id,
          name: variable.name,
          key: variable.key,
          type: variable.resolvedType,
          // COLOR, FLOAT, STRING, BOOLEAN
          description: variable.description,
          collectionId: variable.variableCollectionId,
          collectionName: collection ? collection.name : "Unknown",
          remote: variable.remote,
          scopes: variable.scopes,
          valuesByMode: variable.valuesByMode
          // { modeId: value }
        };
      }
      const collections = await figma.variables.getLocalVariableCollectionsAsync();
      const variables = await figma.variables.getLocalVariablesAsync();
      const mappedCollections = collections.map((c) => ({
        id: c.id,
        name: c.name,
        key: c.key,
        modes: c.modes,
        // [{ modeId, name }, ...]
        defaultModeId: c.defaultModeId,
        remote: c.remote,
        variableIds: c.variableIds
      }));
      const mappedVariables = variables.map((v) => ({
        id: v.id,
        name: v.name,
        key: v.key,
        type: v.resolvedType,
        collectionId: v.variableCollectionId,
        valuesByMode: v.valuesByMode,
        description: v.description
      }));
      return {
        collections: mappedCollections,
        variables: mappedVariables
      };
    } catch (err) {
      throw new Error(`Error getting variables: ${err.message}`);
    }
  }
  async function getNodeVariables(params) {
    const { nodeId } = params || {};
    if (!nodeId) {
      throw new Error("Missing nodeId parameter");
    }
    const node = await figma.getNodeByIdAsync(nodeId);
    if (!node) {
      throw new Error(`Node not found with ID: ${nodeId}`);
    }
    const boundVariables = node.boundVariables || {};
    const explicitVariableModes = node.explicitVariableModes || {};
    const resolvedModes = {};
    if (Object.keys(explicitVariableModes).length > 0) {
      try {
        const collections = await Promise.all(
          Object.keys(explicitVariableModes).map((id) => figma.variables.getVariableCollectionByIdAsync(id))
        );
        collections.forEach((collection) => {
          if (collection) {
            const modeId = explicitVariableModes[collection.id];
            const mode = collection.modes.find((m) => m.modeId === modeId);
            resolvedModes[collection.id] = {
              collectionName: collection.name,
              modeId,
              modeName: mode ? mode.name : "Unknown Mode"
            };
          }
        });
      } catch (e) {
      }
    }
    const resolvedBindings = {};
    for (const [field, alias] of Object.entries(boundVariables)) {
      if (alias && alias.id) {
        try {
          const v = await figma.variables.getVariableByIdAsync(alias.id);
          resolvedBindings[field] = {
            variableId: alias.id,
            variableName: v ? v.name : "Unknown Variable"
          };
        } catch (e) {
          resolvedBindings[field] = alias;
        }
      } else {
        resolvedBindings[field] = alias;
      }
    }
    return {
      nodeId: node.id,
      name: node.name,
      boundVariables: resolvedBindings,
      // enriched with names where possible
      rawBoundVariables: boundVariables,
      // raw data
      explicitVariableModes,
      resolvedExplicitModes: resolvedModes
    };
  }
  async function setBoundVariable(params) {
    const { nodeId, field, variableId, collectionId, modeId } = params || {};
    if (!nodeId) {
      throw new Error("Missing nodeId parameter");
    }
    const node = await figma.getNodeByIdAsync(nodeId);
    if (!node) {
      throw new Error(`Node not found with ID: ${nodeId}`);
    }
    if (collectionId !== void 0) {
      if (modeId === void 0) {
        throw new Error("Missing modeId when setting collection mode");
      }
      try {
        await node.setExplicitVariableModeForCollection(collectionId, modeId);
        return { success: true, message: `Set mode ${modeId} for collection ${collectionId}` };
      } catch (e) {
        throw new Error(`Failed to set explicit variable mode: ${e.message}`);
      }
    }
    if (field) {
      try {
        if (variableId) {
          const variable = await figma.variables.getVariableByIdAsync(variableId);
          if (!variable) throw new Error(`Variable ${variableId} not found`);
          node.setBoundVariable(field, variable);
          return { success: true, message: `Bound ${field} to variable ${variable.name}` };
        } else {
          node.setBoundVariable(field, null);
          return { success: true, message: `Unbound variable from ${field}` };
        }
      } catch (e) {
        throw new Error(`Failed to set bound variable: ${e.message}`);
      }
    }
    throw new Error("Must provide either (field + variableId) or (collectionId + modeId)");
  }

  // src/figma_plugin/src/main.js
  var state = {
    serverPort: 3055
    // Default port
  };
  figma.showUI(__html__, { width: 350, height: 450 });
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
        try {
          const result = await handleCommand(msg.command, msg.params);
          figma.ui.postMessage({
            type: "command-result",
            id: msg.id,
            result
          });
        } catch (error) {
          figma.ui.postMessage({
            type: "command-error",
            id: msg.id,
            error: error.message || "Error executing command"
          });
        }
        break;
    }
  };
  figma.on("run", ({ command }) => {
    figma.ui.postMessage({ type: "auto-connect" });
  });
  function updateSettings(settings) {
    if (settings.serverPort) {
      state.serverPort = settings.serverPort;
    }
    figma.clientStorage.setAsync("settings", {
      serverPort: state.serverPort
    });
  }
  async function handleCommand(command, params) {
    switch (command) {
      case "get_document_info":
        return await getDocumentInfo();
      case "get_selection":
        return await getSelection();
      case "get_nodes_info":
        if (!params || !params.nodeIds || !Array.isArray(params.nodeIds)) {
          throw new Error("Missing or invalid nodeIds parameter");
        }
        return await getNodesInfo(params.nodeIds);
      case "read_my_design":
        return await readMyDesign();
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
      case "delete_multiple_nodes":
        return await deleteMultipleNodes(params);
      case "get_styles":
        return await getStyles();
      case "get_local_components":
        return await getLocalComponents();
      case "create_component_instance":
        return await createComponentInstance(params);
      case "export_node_as_image":
        return await exportNodeAsImage(params);
      case "set_corner_radius":
        return await setCornerRadius(params);
      case "clone_node":
        return await cloneNode(params);
      case "scan_text_nodes":
        return await scanTextNodes(params);
      case "set_multiple_text_contents":
        return await setMultipleTextContents(params);
      case "get_annotations":
        return await getAnnotations(params);
      case "scan_nodes_by_types":
        return await scanNodesByTypes(params);
      case "set_multiple_annotations":
        return await setMultipleAnnotations(params);
      case "get_instance_overrides":
        if (params && params.instanceNodeId) {
          const instanceNode = await figma.getNodeByIdAsync(params.instanceNodeId);
          if (!instanceNode) {
            throw new Error(`Instance node not found with ID: ${params.instanceNodeId}`);
          }
          return await getInstanceOverrides(instanceNode);
        }
        return await getInstanceOverrides();
      case "set_instance_overrides":
        if (params && params.targetNodeIds) {
          if (!Array.isArray(params.targetNodeIds)) {
            throw new Error("targetNodeIds must be an array");
          }
          const targetNodes = await getValidTargetInstances(params.targetNodeIds);
          if (!targetNodes.success) {
            figma.notify(targetNodes.message);
            return { success: false, message: targetNodes.message };
          }
          if (params.sourceInstanceId) {
            let sourceInstanceData = null;
            sourceInstanceData = await getSourceInstanceData(params.sourceInstanceId);
            if (!sourceInstanceData.success) {
              figma.notify(sourceInstanceData.message);
              return { success: false, message: sourceInstanceData.message };
            }
            return await setInstanceOverrides(targetNodes.targetInstances, sourceInstanceData);
          } else {
            throw new Error("Missing sourceInstanceId parameter");
          }
        }
        throw new Error("Missing targetNodeIds parameter");
      case "set_layout_mode":
        return await setLayoutMode(params);
      case "set_padding":
        return await setPadding(params);
      case "set_axis_align":
        return await setAxisAlign(params);
      case "set_layout_sizing":
        return await setLayoutSizing(params);
      case "set_item_spacing":
        return await setItemSpacing(params);
      case "get_reactions":
        if (!params || !params.nodeIds || !Array.isArray(params.nodeIds)) {
          throw new Error("Missing or invalid nodeIds parameter");
        }
        return await getReactions(params.nodeIds);
      case "set_default_connector":
        return await setDefaultConnector(params);
      case "create_connections":
        return await createConnections(params);
      case "set_selections":
        return await setSelections(params);
      case "set_node_name":
        return await setNodeName(params);
      case "get_variables":
        return await getVariables(params);
      case "get_node_variables":
        return await getNodeVariables(params);
      case "set_bound_variable":
        return await setBoundVariable(params);
      default:
        throw new Error(`Unknown command: ${command}`);
    }
  }
})();
