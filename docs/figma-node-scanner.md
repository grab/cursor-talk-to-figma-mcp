# Figma 노드 스캐너 및 주석 도구 기획

## 개요

본 문서는 Talk to Figma MCP를 활용하여 Figma 디자인 노드를 스캔하고 주석을 추가하며 리포트를 생성하는 기능에 대한 기획을 담고 있습니다. 이 기능은 기존 Klever 프로젝트의 노드 스캐닝 및 주석 기능을 MCP 환경에 적용하고, 사용자와 에이전트 간의 대화를 통해 작업을 수행할 수 있게 합니다.

## 목표

- Figma 디자인 내의 노드(프레임, 컴포넌트, 컴포넌트셋, 인스턴스 등)를 스캔
- 텍스트 노드를 포함한 모든 요소에 주석 추가
- 스캔 결과를, 사용자와 에이전트 대화를 통해 Figma 내에 리포트 형태로 생성
- MCP를 통한 상호작용으로 사용자 경험 개선

## 기술 구현 방향

### 1. 명령어 정의

Talk to Figma MCP에 새로운 명령어 추가:

- `scan_node` - 선택한 노드와 그 하위 요소를 스캔
- `add_annotations` - 스캔한 노드에 주석 추가
- `generate_report` - 스캔 및 주석 데이터를 바탕으로 리포트 생성

### 2. 워크플로우

1. **노드 선택**
   - 사용자가 Figma에서 노드를 선택
   - `get_selection` 명령어로 현재 선택 정보 확인

2. **노드 스캐닝**
   - `scan_node` 명령어로 선택된 노드 내의 모든 요소 스캔
   - 텍스트 노드, 인터랙션 요소, 레이아웃 정보 등 수집

3. **주석 추가**
   - `add_annotations` 명령어로 스캔된 요소에 주석 추가
   - 텍스트 노드의 경우 텍스트 내용 분석 및 주석 생성
   - UI 요소의 역할 및 기능 파악하여 주석 생성

4. **리포트 생성**
   - `generate_report` 명령어로 스캔 및 주석 정보 기반 리포트 생성
   - 리포트는 Figma 캔버스에 새 프레임으로 생성
   - 원본 노드 이미지와 주석이 포함된 이미지 생성

5. **사용자 피드백 및 조정**
   - 생성된 리포트에 대한 사용자 피드백 수집
   - 필요시 주석 및 리포트 내용 조정

### 3. 데이터 구조

```typescript
// 스캔된 노드 정보
interface ScannedNode {
  id: string;
  name: string;
  type: string; // FRAME, COMPONENT, INSTANCE, TEXT 등
  x: number;
  y: number;
  width: number;
  height: number;
  children?: ScannedNode[];
  text?: string; // 텍스트 노드인 경우 내용
  annotations?: Annotation[];
}

// 주석 정보
interface Annotation {
  id: string;
  nodeId: string; // 주석이 달린 노드 ID
  content: string; // 주석 내용
  type: string; // 주석 유형 (설명, 피드백, 이슈 등)
  x: number;
  y: number;
}

// 리포트 정보
interface Report {
  id: string;
  title: string;
  description: string;
  nodes: ScannedNode[];
  originalImageHash: string;
  annotatedImageHash: string;
  createdAt: number;
}
```

### 4. UI 및 상호작용

- **노드 선택 확인**: 에이전트가 선택한 노드 정보를 확인하고 사용자에게 피드백
- **스캔 진행 상황**: 스캔 진행 중 상태를 사용자에게 알림
- **주석 생성 대화**: 주석 생성 과정에서 사용자와 에이전트 간 대화를 통해 컨텍스트 파악
- **리포트 생성 과정**: 리포트 생성 중 사용자에게 진행 상황 알림

## MCP 통합 구현 계획

### 1. server.ts 확장

Talk to Figma MCP 서버(server.ts)에 새로운 명령어 추가:

```typescript
// 노드 스캔 명령어
server.tool(
  "scan_node",
  "Scan selected node and its children",
  {
    nodeId: z.string().describe("ID of the node to scan")
  },
  async ({ nodeId }) => {
    try {
      const result = await sendCommandToFigma('scan_node', { nodeId });
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
            text: `Error scanning node: ${error instanceof Error ? error.message : String(error)}`
          }
        ]
      };
    }
  }
);

// 주석 추가 명령어
server.tool(
  "add_annotations",
  "Add annotations to scanned nodes",
  {
    nodeId: z.string().describe("ID of the scanned node"),
    annotations: z.array(z.object({
      nodeId: z.string(),
      content: z.string(),
      type: z.string()
    })).optional().describe("Optional predefined annotations")
  },
  async ({ nodeId, annotations }) => {
    try {
      const result = await sendCommandToFigma('add_annotations', { nodeId, annotations });
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
            text: `Error adding annotations: ${error instanceof Error ? error.message : String(error)}`
          }
        ]
      };
    }
  }
);

// 리포트 생성 명령어
server.tool(
  "generate_report",
  "Generate report based on scanned and annotated nodes",
  {
    nodeId: z.string().describe("ID of the scanned and annotated node"),
    title: z.string().describe("Report title"),
    description: z.string().optional().describe("Report description")
  },
  async ({ nodeId, title, description }) => {
    try {
      const result = await sendCommandToFigma('generate_report', { nodeId, title, description });
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
            text: `Error generating report: ${error instanceof Error ? error.message : String(error)}`
          }
        ]
      };
    }
  }
);
```

### 2. Figma 플러그인 코드 확장

code.js 파일에 새로운 핸들러 추가:

```javascript
// 노드 스캔 핸들러
async function scanNode(nodeId) {
  const node = await figma.getNodeByIdAsync(nodeId);
  if (!node) {
    throw new Error(`Node not found with ID: ${nodeId}`);
  }
  
  return await scanNodeRecursively(node);
}

// 노드 재귀적 스캔
async function scanNodeRecursively(node, result = []) {
  // 노드 기본 정보 추출
  const nodeInfo = {
    id: node.id,
    name: node.name,
    type: node.type,
    x: 'x' in node ? node.x : undefined,
    y: 'y' in node ? node.y : undefined,
    width: 'width' in node ? node.width : undefined,
    height: 'height' in node ? node.height : undefined,
  };
  
  // 텍스트 노드인 경우 텍스트 내용 추가
  if (node.type === 'TEXT') {
    nodeInfo.text = node.characters;
  }
  
  result.push(nodeInfo);
  
  // 자식 노드가 있는 경우 재귀적으로 스캔
  if ('children' in node) {
    nodeInfo.children = [];
    for (const child of node.children) {
      await scanNodeRecursively(child, nodeInfo.children);
    }
  }
  
  return result;
}

// 주석 추가 핸들러
async function addAnnotations(nodeId, annotations = []) {
  const node = await figma.getNodeByIdAsync(nodeId);
  if (!node) {
    throw new Error(`Node not found with ID: ${nodeId}`);
  }
  
  // 스캔된 노드 정보 가져오기
  const scannedNodes = await scanNode(nodeId);
  
  // 사전 정의된 주석이 없다면 AI 기반으로 주석 생성
  if (annotations.length === 0) {
    annotations = await generateAIAnnotations(scannedNodes);
  }
  
  // 주석 정보 추가
  const annotatedNodes = addAnnotationsToNodes(scannedNodes, annotations);
  
  return annotatedNodes;
}

// 리포트 생성 핸들러
async function generateReport(nodeId, title, description = "") {
  const node = await figma.getNodeByIdAsync(nodeId);
  if (!node) {
    throw new Error(`Node not found with ID: ${nodeId}`);
  }
  
  // 노드 스캔 및 주석 정보 가져오기
  const annotatedNodes = await addAnnotations(nodeId);
  
  // 리포트 프레임 생성
  const reportFrame = createReportFrame(title, description);
  
  // 원본 이미지 추가
  const originalImage = await addNodeImageToReportFrame(node, reportFrame, "Original");
  
  // 주석이 추가된 이미지 생성 및 추가
  const annotatedImage = await createAnnotatedImage(node, annotatedNodes, reportFrame);
  
  // 리포트 정보 반환
  return {
    id: reportFrame.id,
    title,
    description,
    nodeId,
    originalImageId: originalImage.id,
    annotatedImageId: annotatedImage.id
  };
}

// 핸들러 등록
// handleCommand 함수에 새 명령어 추가
switch (command) {
  // 기존 명령어들...
  
  case "scan_node":
    return await scanNode(params.nodeId);
  
  case "add_annotations":
    return await addAnnotations(params.nodeId, params.annotations);
  
  case "generate_report":
    return await generateReport(params.nodeId, params.title, params.description);
  
  default:
    throw new Error(`Unknown command: ${command}`);
}
```

## 사용자 시나리오

### 시나리오 1: 기본 노드 스캔 및 리포트 생성

1. 사용자: "Figma에서 이 프레임을 스캔하고 주석을 추가한 다음 리포트를 생성해줘."
2. 에이전트: "선택된 프레임을 스캔해 볼게요. 스캔하려는 프레임의 ID를 알려주세요."
3. 사용자: (Figma에서 프레임 선택)
4. 에이전트: (선택된 프레임 정보 확인) "프레임 'Dashboard'를 선택하셨네요. 이 프레임을 스캔하고 주석을 추가할게요."
5. 에이전트: (스캔 명령 실행 후) "프레임 스캔이 완료되었습니다. 총 15개의 요소가 발견되었고, 그 중 7개의 텍스트 요소를 분석했습니다."
6. 에이전트: "텍스트 요소에 주석을 추가하는 중입니다. 다음과 같은 주석을 추가했습니다: ..."
7. 에이전트: "리포트를 생성하겠습니다. 리포트 제목을 알려주세요."
8. 사용자: "Dashboard UI 분석"
9. 에이전트: "리포트를 생성 중입니다... 완료되었습니다. Figma 캔버스에 'Dashboard UI 분석' 리포트가 생성되었습니다."

### 시나리오 2: 특정 요소에 대한 심층 분석

1. 사용자: "이 로그인 컴포넌트에서 텍스트 요소들이 접근성 기준을 충족하는지 분석해줘."
2. 에이전트: "로그인 컴포넌트를 스캔하고 텍스트 요소의 접근성을 분석할게요."
3. 에이전트: (스캔 및 분석 후) "로그인 컴포넌트에서 3개의 텍스트 요소를 발견했습니다. 분석 결과, 'Password' 레이블의 대비율이 WCAG AA 기준을 충족하지 못합니다. 대비율을 4.5:1 이상으로 높이는 것이 좋겠습니다."
4. 사용자: "분석 결과를 리포트로 만들어줘."
5. 에이전트: "접근성 분석 결과를 포함한 리포트를 생성하겠습니다..."

## 구현 단계

1. **기초 기능 구현** - 기본적인 노드 스캔 및 정보 추출 기능
2. **주석 생성 기능** - AI 기반 주석 자동 생성 기능
3. **리포트 생성 기능** - 스캔 및 주석 정보 기반 시각적 리포트 생성
4. **대화형 인터페이스** - 에이전트와 사용자 간 대화를 통한 작업 진행
5. **리포트 템플릿** - 다양한 유형의 리포트 템플릿 추가

## 결론

Talk to Figma MCP를 기반으로 Klever 프로젝트의 노드 스캔 및 주석 기능을 통합하여, 사용자와 에이전트 간 대화를 통해 Figma 디자인을 분석하고 개선할 수 있는 도구를 제공합니다. 이를 통해 디자이너와 개발자 간의 소통을 원활히 하고, UI/UX 품질을 높이는 데 기여할 수 있을 것입니다. 