# Figma UX Writing MCP 전략 문서

## 1. 프로젝트 개요

이 프로젝트는 `Cursor Talk To Figma Plugin`을 기반으로 하여 Figma에서 UX 라이팅 작업을 위한 Model Context Protocol(MCP) 기반 대화형 인터페이스를 구현하는 것이 목표입니다. 기존 Klever 프로젝트의 기능을 활용하여 Figma 화면의 노드들을 스캔하고, 텍스트 노드를 식별하여 주석을 추가하며, AI 에이전트와의 대화를 통해 텍스트 콘텐츠를 최적화하고 로컬라이징하는 기능을 제공합니다.

## 2. 핵심 기능

1. **노드 스캐닝 및 텍스트 추출**
   - Figma 디자인 내의 모든 텍스트 노드를 식별하고 추출
   - 텍스트 계층 구조 및 관계 분석

2. **텍스트 주석 및 분석**
   - 추출된 텍스트에 자동 주석 추가
   - 텍스트 성격, 목적, 맥락 분석

3. **UX 라이팅 최적화**
   - AI 에이전트와 대화를 통한 텍스트 개선 제안
   - 일관성, 명확성, 간결성 측면에서 텍스트 평가

4. **콘텐츠 로컬라이징**
   - 다국어 번역 및 문화적 맥락 조정
   - 로컬라이징 후 레이아웃 영향 분석

5. **대화형 인터페이스**
   - 사용자-에이전트 간 자연스러운 대화를 통한 작업 수행
   - 맥락을 유지한 연속적인 텍스트 개선 세션

## 3. 구현 단계

### 3.1. 1단계: 노드 스캐닝 및 텍스트 추출 (1-2주)

1. **스캐닝 도구 구현**
   - `scan_text_nodes` MCP 도구 개발
   - Figma API를 사용한 재귀적 노드 탐색 구현
   - 텍스트 노드 필터링 및 메타데이터 수집

2. **텍스트 노드 시각화**
   - 스캔된 텍스트 노드 하이라이팅 기능
   - 텍스트 계층 구조 시각화

3. **텍스트 컨텍스트 추출**
   - 텍스트 주변 요소 분석
   - 화면 내 텍스트 위치 및 역할 파악

### 3.2. 2단계: 텍스트 주석 및 분석 (1-2주)

1. **자동 주석 시스템**
   - `add_text_annotations` MCP 도구 개발
   - 텍스트 특성 기반 자동 주석 생성

2. **텍스트 분석 기능**
   - `analyze_ux_text` MCP 도구 개발
   - 텍스트 품질, 일관성, 접근성 평가

3. **주석 시각화**
   - Figma 내 주석 프레임 생성
   - 텍스트-주석 연결 시각화

### 3.3. 3단계: UX 라이팅 최적화 (2-3주)

1. **대화형 최적화 인터페이스**
   - `optimize_ux_text` MCP 도구 개발
   - 사용자-에이전트 대화를 통한 텍스트 개선

2. **텍스트 개선 제안 시스템**
   - AI 기반 텍스트 개선 제안 생성
   - 개선 이유 및 근거 제공

3. **일괄 텍스트 업데이트**
   - `update_text_nodes` MCP 도구 개발
   - 텍스트 노드 값을 일괄 업데이트하는 기능

### 3.4. 4단계: 콘텐츠 로컬라이징 (2-3주)

1. **다국어 번역 시스템**
   - `localize_text` MCP 도구 개발
   - 다양한 언어로 텍스트 번역 기능

2. **로컬라이징 영향 분석**
   - `analyze_localization_impact` MCP 도구 개발
   - 번역 후 텍스트 길이 변화에 따른 레이아웃 영향 분석

3. **로컬라이징 리포트**
   - 로컬라이징 결과 시각화
   - 언어별 텍스트 비교 및 검토 기능

### 3.5. 5단계: 대화형 인터페이스 개선 (1-2주)

1. **대화 컨텍스트 관리**
   - 대화 세션 상태 관리
   - 이전 대화 참조 및 연속성 유지

2. **사용자 피드백 시스템**
   - 텍스트 변경 승인/거부 메커니즘
   - 변경 이력 관리

3. **일괄 작업 기능**
   - 여러 텍스트 노드 동시 처리
   - 프로젝트 수준의 일관성 관리

## 4. 기술 구현 접근법

### 4.1. MCP 도구 확장

```typescript
// server.ts에 새로운 MCP 도구 추가
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

// 텍스트 최적화 도구
server.tool(
  "optimize_ux_text",
  "Optimize UX writing for selected text nodes",
  {
    nodeId: z.string().describe("ID of the text node to optimize"),
    context: z.string().optional().describe("Context or instructions for optimization"),
    targetAudience: z.string().optional().describe("Target audience information")
  },
  async ({ nodeId, context, targetAudience }) => {
    try {
      const result = await sendCommandToFigma('optimize_ux_text', { 
        nodeId, 
        context: context || "",
        targetAudience: targetAudience || ""
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
    contextNotes: z.string().optional().describe("Context notes for localization")
  },
  async ({ nodeId, languages, contextNotes }) => {
    try {
      const result = await sendCommandToFigma('localize_text', { 
        nodeId, 
        languages,
        contextNotes: contextNotes || ""
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
```

### 4.2. Figma 플러그인 코드 확장

```javascript
// Figma 플러그인 코드에 새 핸들러 추가
async function scanTextNodes(nodeId) {
  const node = await figma.getNodeByIdAsync(nodeId);
  if (!node) {
    throw new Error(`Node not found with ID: ${nodeId}`);
  }
  
  const textNodes = [];
  
  // 재귀적으로 텍스트 노드 찾기
  async function findTextNodes(node, parentPath = []) {
    const currentPath = [...parentPath, node.name];
    
    if (node.type === 'TEXT') {
      textNodes.push({
        id: node.id,
        name: node.name,
        characters: node.characters,
        path: currentPath.join(' > '),
        x: node.x,
        y: node.y,
        width: node.width,
        height: node.height,
        fontSize: node.fontSize,
        fontName: node.fontName
      });
    }
    
    // 자식 노드 탐색
    if ('children' in node) {
      for (const child of node.children) {
        await findTextNodes(child, currentPath);
      }
    }
  }
  
  await findTextNodes(node);
  return textNodes;
}

// UX 텍스트 최적화 핸들러
async function optimizeUXText(nodeId, context, targetAudience) {
  const node = await figma.getNodeByIdAsync(nodeId);
  if (!node) {
    throw new Error(`Node not found with ID: ${nodeId}`);
  }
  
  if (node.type !== 'TEXT') {
    throw new Error(`Node with ID ${nodeId} is not a text node`);
  }
  
  const originalText = node.characters;
  
  // 여기서는 실제 AI 최적화를 호출하겠지만, 데모를 위한 간단한 구현
  const optimizedText = `[최적화] ${originalText}`; // 실제 구현에서는 AI 기반 최적화 로직으로 대체
  
  // 텍스트 노드 업데이트
  node.characters = optimizedText;
  
  return {
    id: node.id,
    originalText,
    optimizedText,
    context,
    targetAudience
  };
}

// 로컬라이징 핸들러
async function localizeText(nodeId, languages, contextNotes) {
  const node = await figma.getNodeByIdAsync(nodeId);
  if (!node) {
    throw new Error(`Node not found with ID: ${nodeId}`);
  }
  
  if (node.type !== 'TEXT') {
    throw new Error(`Node with ID ${nodeId} is not a text node`);
  }
  
  const originalText = node.characters;
  
  // 로컬라이징 결과를 시각화할 프레임 생성
  const localizationFrame = figma.createFrame();
  localizationFrame.name = `Localization: ${node.name}`;
  localizationFrame.x = node.x + node.width + 100;
  localizationFrame.y = node.y;
  localizationFrame.resize(300, (languages.length + 1) * 50);
  
  // 원본 텍스트 표시
  const originalTextNode = figma.createText();
  localizationFrame.appendChild(originalTextNode);
  originalTextNode.characters = `Original: ${originalText}`;
  originalTextNode.y = 10;
  originalTextNode.x = 10;
  
  // 각 언어별 번역 (데모용 간단 구현)
  const localizations = {};
  
  languages.forEach((language, index) => {
    // 실제로는 API를 통한 번역 구현
    const localizedText = `[${language}] ${originalText}`;
    localizations[language] = localizedText;
    
    // 번역된 텍스트 시각화
    const localizedTextNode = figma.createText();
    localizationFrame.appendChild(localizedTextNode);
    localizedTextNode.characters = `${language}: ${localizedText}`;
    localizedTextNode.y = (index + 1) * 50 + 10;
    localizedTextNode.x = 10;
  });
  
  return {
    id: node.id,
    originalText,
    localizations,
    localizationFrameId: localizationFrame.id
  };
}

// 명령어 핸들러에 새 명령어 추가
handleCommand(command, params) {
  switch (command) {
    // 기존 명령어들...
    
    case "scan_text_nodes":
      return await scanTextNodes(params.nodeId);
    
    case "optimize_ux_text":
      return await optimizeUXText(params.nodeId, params.context, params.targetAudience);
    
    case "localize_text":
      return await localizeText(params.nodeId, params.languages, params.contextNotes);
    
    default:
      throw new Error(`Unknown command: ${command}`);
  }
}
```

## 5. 사용자 시나리오

### 시나리오 1: 텍스트 스캔 및 분석

```
사용자: "이 화면에 있는 모든 텍스트를 스캔하고 분석해줘."

Agent: (Figma에서 현재 선택된 프레임 확인) "현재 선택된 'Login Screen' 프레임을 스캔할게요. 잠시만 기다려주세요."

Agent: (스캔 완료 후) "스캔이 완료되었습니다. 총 8개의 텍스트 요소를 발견했어요:
1. 'Welcome Back' - 제목
2. 'Sign in to continue' - 부제목
3. 'Email' - 입력 레이블
4. 'Password' - 입력 레이블
5. 'Forgot Password?' - 링크
6. 'Sign In' - 버튼
7. 'Don't have an account?' - 안내 텍스트
8. 'Sign Up' - 링크

텍스트 분석 결과, 이 화면은 로그인 기능을 제공하고 있으며 사용자 친화적인 구조를 갖추고 있습니다. 'Forgot Password?' 링크는 사용자 경험을 개선하는 좋은 요소입니다. 어떤 텍스트를 최적화하고 싶으신가요?"

사용자: "'Welcome Back'과 'Sign in to continue' 메시지를 좀 더 친근하게 만들어줘."

Agent: "네, 더 친근한 톤으로 변경해 볼게요. 제안된 변경사항입니다:
1. 'Welcome Back' → 'Hello Again!'
2. 'Sign in to continue' → 'Great to see you! Sign in to continue'

이 변경사항을 적용할까요?"

사용자: "좋아, 적용해줘."

Agent: (변경 적용 후) "텍스트가 업데이트되었습니다. 다른 최적화가 필요하신가요?"
```

### 시나리오 2: 국제화 및 로컬라이징

```
사용자: "이 앱의 온보딩 화면 텍스트를 한국어, 일본어, 중국어로 번역해줘."

Agent: (현재 선택된 프레임 확인) "현재 선택된 'Onboarding' 프레임의 텍스트를 한국어, 일본어, 중국어로 번역하겠습니다. 번역 작업을 시작할게요."

Agent: (번역 완료 후) "번역이 완료되었습니다. 각 언어별 번역 결과를 Figma에 시각화했습니다. 원본 화면 옆에 번역 결과 프레임이 생성되었어요.

몇 가지 주의할 점이 있습니다:
1. 한국어와 일본어 번역의 경우, 일부 텍스트가 원본보다 약 30% 길어졌습니다. 버튼 내 텍스트가 잘릴 수 있으니 확인이 필요합니다.
2. 중국어 번역은 원본보다 짧아져서 레이아웃에 여백이 생길 수 있습니다.

번역 결과를 검토하시고 추가 수정이 필요하신지 알려주세요."

사용자: "한국어 번역에서 'Start your journey'를 '여정을 시작하세요' 대신 '시작하기'로 더 간결하게 바꿔줘."

Agent: "네, 한국어 번역을 수정했습니다. 'Start your journey'의 번역을 '여정을 시작하세요'에서 '시작하기'로 변경했습니다. 버튼 크기에 더 적합해 보입니다. 다른 수정이 필요하신가요?"
```

## 6. 구현 로드맵

### 6.1. 1주차: 프로젝트 설정 및 기본 스캐닝 기능

- MCP 서버에 기본 텍스트 스캐닝 도구 추가
- Figma 플러그인 코드에 텍스트 노드 스캐닝 핸들러 구현
- 간단한 텍스트 노드 시각화 기능 개발

### 6.2. 2-3주차: 텍스트 분석 및 주석 기능

- 텍스트 분석 알고리즘 구현
- 자동 주석 생성 기능 개발
- 분석 결과 시각화 도구 구현

### 6.3. 4-5주차: UX 라이팅 최적화 기능

- 텍스트 최적화 제안 시스템 개발
- 대화형 최적화 인터페이스 구현
- 텍스트 업데이트 기능 구현

### 6.4. 6-7주차: 로컬라이징 기능

- 다국어 번역 시스템 통합
- 로컬라이징 영향 분석 도구 개발
- 로컬라이징 결과 시각화 기능 구현

### 6.5. 8주차: 통합 및 테스트

- 모든 기능 통합 및 테스트
- 사용자 피드백 반영
- 최종 성능 최적화

## 7. 결론

Figma UX Writing MCP 프로젝트는 Figma에서의 UX 라이팅 및 콘텐츠 디자인 과정을 혁신적으로 개선할 수 있는 잠재력을 갖고 있습니다. Talk to Figma MCP의 대화형 인터페이스와 Klever의 노드 스캐닝 및 주석 기능을 결합함으로써, 디자이너와 콘텐츠 작성자 간의 협업을 강화하고, 일관된 고품질 UX 텍스트를 쉽게 생성 및 관리할 수 있게 될 것입니다.

이 프로젝트는 단순한 텍스트 편집을 넘어, AI 기반 콘텐츠 최적화와 국제화를 위한 효율적인 워크플로우를 제공함으로써, Figma 플랫폼 내에서 완결된 UX 라이팅 솔루션을 구축하는 것을 목표로 합니다. 