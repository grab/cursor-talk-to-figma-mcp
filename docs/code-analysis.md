# Talk to Figma MCP 및 Klever 코드베이스 분석

## 1. Talk to Figma MCP 구조 분석

### 1.1. 프로젝트 구조

Talk to Figma MCP는 크게 세 가지 주요 구성 요소로 이루어져 있습니다:

1. **MCP 서버** (`src/talk_to_figma_mcp/server.ts`)
   - Model Context Protocol 서버 구현
   - Figma와의 통신을 위한 도구 정의
   - WebSocket 연결 관리

2. **WebSocket 서버** (`src/socket.ts`)
   - Figma 플러그인과 MCP 서버 간의 통신 중개
   - 채널 기반 통신 관리
   - 메시지 라우팅

3. **Figma 플러그인** (`src/cursor_mcp_plugin/`)
   - `code.js`: Figma API 호출 및 명령 처리
   - `ui.html`: 플러그인 UI 및 WebSocket 연결 관리

### 1.2. 통신 흐름

Talk to Figma MCP의 통신 흐름은 다음과 같습니다:

```
Cursor AI -- MCP 서버 -- WebSocket 서버 -- Figma 플러그인 -- Figma API
```

1. Cursor AI에서 사용자가 명령을 입력
2. MCP 서버가 명령을 받아 WebSocket 서버로 전달
3. WebSocket 서버가 적절한 채널을 통해 Figma 플러그인으로 전달
4. Figma 플러그인이 Figma API를 호출하여 작업 수행
5. 결과가 역순으로 Cursor AI에 전달

### 1.3. 주요 MCP 도구

현재 구현된 주요 MCP 도구들:

- `get_document_info`: 현재 Figma 문서 정보 조회
- `get_selection`: 현재 선택된 요소 정보 조회
- `get_node_info`: 특정 노드 정보 조회
- `create_rectangle`, `create_frame`, `create_text`: 요소 생성
- `set_fill_color`, `set_stroke_color`: 스타일 설정
- `move_node`, `resize_node`, `delete_node`: 요소 조작
- `get_styles`, `get_local_components`: 스타일 및 컴포넌트 조회
- `join_channel`: Figma와의 통신 채널 연결

## 2. Klever 코드베이스 분석

### 2.1. 프로젝트 구조

Klever는 Figma 플러그인으로, 주요 구성 요소는 다음과 같습니다:

1. **플러그인 코어** (`src/plugin/`)
   - `controller.ts`: 핵심 로직 및 Figma UI와의 통신 관리
   - `utils/FigmaUtils.ts`: Figma API 래핑 및 유틸리티 함수
   - `api.tsx`: AI 모델 API 통신
   - `Models.ts`: 데이터 모델 정의
   - `config.ts`: 설정 관리

2. **UI 구성 요소** (`src/app/`)
   - React 기반 UI 컴포넌트

### 2.2. 주요 기능 분석

Klever의 핵심 기능:

1. **노드 스캐닝 및 분석**
   - `createElemList()`: 노드 계층 구조 순회 및 UI 요소 추출
   - 텍스트 요소, 프레임, 컴포넌트 등 식별

2. **AI 기반 보고서 생성**
   - `generateReport()`: AI 모델을 활용한 분석 보고서 생성
   - `generateReportResult()`: 분석 결과를 Figma 캔버스에 시각화

3. **주석 및 시각화**
   - `createBoundingBox()`, `createTouchPoint()`: 요소 강조 표시
   - `createTextFrame()`: 설명 텍스트 생성
   - `createSpeechBubble()`: 주석 말풍선 생성

## 3. 통합 포인트 및 구현 방향

### 3.1. 공통 기능 및 차이점

**공통점**:
- Figma API 활용
- 노드 조작 및 정보 수집
- 프레임 생성 및 관리

**차이점**:
- Talk to Figma MCP: 커맨드 기반 양방향 통신
- Klever: 단방향 플러그인 통신 및 AI 모델 통합

### 3.2. 통합 접근법

다음 기능들을 Talk to Figma MCP에 통합할 수 있습니다:

1. **노드 스캐닝 기능**
   - `src/plugin/utils/FigmaUtils.ts`의 `createElemList()` 함수 활용
   - Talk to Figma MCP의 `scan_node` 도구로 구현

2. **주석 생성 기능**
   - `createTextFrame()`, `createSpeechBubble()` 등의 함수 활용
   - `add_annotations` 도구로 구현

3. **보고서 생성 기능**
   - `createTaskFrameWithNameAndDesc()`, `createAnatomyFrame()` 등 활용
   - `generate_report` 도구로 구현

### 3.3. 코드 이식 전략

1. **노드 스캐닝 로직**:
   ```typescript
   // FigmaUtils.ts의 createElemList 함수를 server.ts의 scan_node 도구에 통합
   server.tool(
     "scan_node",
     "Scan selected node and its children",
     {
       nodeId: z.string().describe("ID of the node to scan")
     },
     async ({ nodeId }) => {
       try {
         // 이 부분에서 createElemList 로직 호출
         const result = await sendCommandToFigma('scan_node', { nodeId });
         return { 
           content: [{ type: "text", text: JSON.stringify(result, null, 2) }]
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
   ```

2. **주석 및 보고서 생성 로직**:
   - Klever의 관련 함수를 code.js에 추가
   - MCP 도구를 통해 호출되도록 연결

## 4. 구현 우선순위 및 로드맵

### 4.1. 1단계: 노드 스캐닝 기능

- `scan_node` 도구 구현
- 기존 `get_node_info` 확장
- 재귀적 노드 탐색 추가

### 4.2. 2단계: 주석 생성 기능

- `add_annotations` 도구 구현
- 주석 생성 유틸리티 함수 포팅
- 텍스트 요소 자동 주석 기능

### 4.3. 3단계: 보고서 생성 기능

- `generate_report` 도구 구현
- 보고서 템플릿 통합
- 이미지 관리 기능 추가

### 4.4. 4단계: 대화형 인터페이스 개선

- 사용자-에이전트 상호작용 시나리오 구현
- 상태 관리 및 피드백 메커니즘 추가

## 5. 결론

Talk to Figma MCP와 Klever 프로젝트의 통합은 기술적으로 가능하며, 핵심 기능을 재사용하면서 MCP 환경에 맞게 재구성할 수 있습니다. 

Klever의 노드 스캐닝 및 주석 생성 기능과 Talk to Figma MCP의 대화형 인터페이스를 결합함으로써 더 강력하고 직관적인 디자인 분석 도구를 제공할 수 있을 것입니다. 