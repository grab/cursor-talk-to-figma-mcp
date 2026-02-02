# Comparative Analysis: figma-edit-mcp vs arinspunk/claude-talk-to-figma-mcp

**Date:** February 1, 2026
**Analysis Scope:** Deep dive comparison of two Figma MCP server implementations
**Focus:** Identifying features for integration and architectural best practices

---

## Executive Summary

### Version Comparison
| Aspect | figma-edit-mcp (This Repo) | claude-talk-to-figma-mcp (Fork) |
|--------|---------------------------|--------------------------------|
| Version | 0.3.5 | 0.7.0 |
| Author | (Current) | Xúlio Zé |
| Total Tools | ~45 tools | ~40 tools |
| Architecture | Single server.ts (3400+ LOC) with modular handlers | Modular tool category files |
| Testing | None | Jest with unit/integration tests |
| Security Model | Scope-based with name verification | No built-in safety features |

### Strategic Position

**This Repo Strengths:**
- Comprehensive security/permission model (scope locking, name verification, read-only mode)
- Advanced features (variables, annotations, prototyping, connectors)
- Modular Figma plugin architecture (12 handlers + 7 utils)

**Fork Strengths:**
- Better coverage of basic operations (page management, text styling)
- More shape creation options (ellipse, polygon, star)
- Test infrastructure and better code organization
- DXT packaging for Claude Desktop

---

## Detailed Feature Comparison

### 1. Page Management Tools

**Status:** ❌ Missing from this repo | ✅ Present in fork

#### Tools Present in Fork
```typescript
create_page(name: string)
delete_page(pageId: string)
rename_page(pageId: string, name: string)
get_pages()
set_current_page(pageId: string)
```

**Impact:** These are fundamental Figma operations for multi-page workflows.

**Recommendation:** 🔴 **HIGH PRIORITY** - Bring over all page management tools

---

### 2. Shape Creation Tools

**Status:** ⚠️ Partially implemented here | ✅ More complete in fork

#### Currently Implemented Here
- `create_rectangle(x, y, width, height, name?, parentId?)`
- `create_frame(x, y, width, height, ...)`
- `create_text(x, y, text, ...)`

#### Missing (Available in Fork)
```typescript
create_ellipse(x, y, width, height, name?, parentId?, fillColor?, strokeColor?, strokeWeight?)
create_polygon(x, y, width, height, sides?, name?, parentId?, fillColor?, strokeColor?, strokeWeight?)
create_star(x, y, width, height, points?, innerRadius?, name?, parentId?, fillColor?, strokeColor?, strokeWeight?)
```

**Impact:** Limits design capability; designers frequently need circles and other shapes.

**Recommendation:** 🔴 **HIGH PRIORITY** - Add ellipse, polygon, and star creation

---

### 3. Text Styling & Typography Tools

**Status:** ❌ Severely limited here | ✅ Comprehensive in fork

#### Currently Implemented Here
- `set_text_content(nodeId, text)` - Basic text update only
- Limited font support

#### Missing (Available in Fork)
```typescript
set_font_name(nodeId, family, style?)
set_font_size(nodeId, fontSize)
set_font_weight(nodeId, weight) // 100-900
set_letter_spacing(nodeId, letterSpacing, unit?)
set_line_height(nodeId, lineHeight, unit?)
set_paragraph_spacing(nodeId, paragraphSpacing)
set_text_case(nodeId, textCase) // ORIGINAL/UPPER/LOWER/TITLE
set_text_decoration(nodeId, textDecoration) // NONE/UNDERLINE/STRIKETHROUGH
get_styled_text_segments(nodeId, property)
set_text_style_id(nodeId, textStyleId)
load_font_async(family, style?)
set_multiple_text_contents(nodeId, text[]) // Batch operation
```

**Impact:** Critical gap for design systems and typography-heavy work. Text is a core design element.

**Recommendation:** 🔴 **HIGH PRIORITY** - Add comprehensive text styling suite (13+ tools)

---

### 4. Node Organization Tools

**Status:** ❌ Missing from this repo | ✅ Present in fork

#### Missing Tools
```typescript
group_nodes(nodeIds: string[], name?: string)
ungroup_nodes(nodeId: string)
flatten_node(nodeId: string) // For boolean operations
insert_child(parentId: string, childId: string, index?: number) // Reparenting
```

**Impact:** Basic Figma operations; needed for restructuring designs.

**Recommendation:** 🔴 **HIGH PRIORITY** - Bring over all node organization tools

---

### 5. Variables System

**Status:** ✅ Comprehensive here | ❌ Missing from fork

#### Implemented Here
```typescript
get_variables()
get_node_variables(nodeId)
set_bound_variable(nodeId, nodeName, field, variableId?)
manage_variables(action, collectionId?, variableId?, name?, type?, value?)
```

**Impact:** Variables are essential for design systems and responsive design.

**Analysis:** This is a **competitive advantage** of this repo. Fork lacks this entirely.

**Recommendation:** ✅ Keep and protect this feature

---

### 6. Security & Scope System

**Status:** ✅ Implemented here (Unique) | ❌ Completely missing from fork

#### Implemented Here
- **Scope Locking:** Restricts write operations to specific page/frame
- **Name Verification:** All write operations verify `nodeName`/`parentNodeName` matching
- **Read-Only Mode:** Supports sessions without edit permissions
- **Permission Checks:** Every command validates scope access before execution

#### Error Handling Examples
```
READ_ONLY_MODE: No write operations allowed
OUTSIDE_SCOPE: Node not in editable scope
PARENT_OUTSIDE_SCOPE: Creation parent not in scope
NAME_MISMATCH: Node name doesn't match ID
PARENT_NAME_MISMATCH: Parent name mismatch
```

**Impact:** Critical for safety, especially in collaborative or untrusted environments.

**Analysis:** This is a **major differentiator** and architectural advantage.

**Recommendation:** 🟢 **CRITICAL** - Keep and strengthen this security model

---

### 7. Annotations System

**Status:** ✅ Implemented here | ❌ Missing from fork

#### Implemented Here
```typescript
get_annotations(nodeId)
set_multiple_annotations(nodeId, annotations[])
```

**Impact:** Design collaboration and documentation features.

**Recommendation:** ✅ Keep this feature; fork users lose this capability

---

### 8. Prototyping & Connectors

**Status:** ✅ Implemented here | ❌ Missing from fork

#### Implemented Here
```typescript
get_reactions(nodeIds[])
set_default_connector(connectorId)
create_connections(connections[])
```

**Impact:** Enables interactive prototype creation.

**Recommendation:** ✅ Keep this feature; valuable for prototyping workflows

---

### 9. Component Management

#### Currently Implemented Here
```typescript
get_local_components()
get_component_instance_overrides(instanceId)
set_instance_overrides(sourceInstanceId, targetNodes[])
create_component_instance(componentKey, x, y)
create_component(nodeId, nodeName)
```

#### Fork Additional Features
```typescript
get_remote_components() // Team library access
create_component_set(componentIds[], name?) // Variants
create_component_from_node(nodeId, name?) // Alternative naming
```

**Analysis:**
- This repo has more advanced instance override support
- Fork adds team library and variant support
- Both have gaps

**Recommendation:** 🟡 **MEDIUM PRIORITY** - Consider adding `get_remote_components()` and `create_component_set()`

---

### 10. Auto-Layout & Styling

#### This Repo (More Granular)
```typescript
set_layout_mode(nodeId, layoutMode, layoutWrap)
set_padding(nodeId, paddingTop, paddingRight, paddingBottom, paddingLeft)
set_axis_align(nodeId, primaryAxisAlignItems, counterAxisAlignItems)
set_layout_sizing(nodeId, layoutSizingHorizontal, layoutSizingVertical)
set_item_spacing(nodeId, itemSpacing, counterAxisSpacing?)
```

#### Fork (Unified)
```typescript
set_auto_layout(nodeId, layoutMode, padding, itemSpacing, alignment, layoutWrap, strokesIncludedInLayout)
```

**Analysis:** This repo offers finer control; fork simplifies with combined operation.

**Recommendation:** ✅ Keep current approach; more flexible for complex layouts

---

### 11. Style Management

#### Implemented Here
```typescript
get_styles()
create_style(type, name, properties, description?)
apply_style(nodeId, nodeName, styleId, styleType)
```

#### Fork Features
```typescript
set_text_style_id(nodeId, textStyleId)
set_effect_style_id(nodeId, effectStyleId)
```

**Analysis:** Both approaches work; fork's are more direct.

**Recommendation:** ⚪ **OPTIONAL** - Fork's direct style setters could complement current implementation

---

### 12. MCP Prompts

**Status:** ❌ Not implemented here | ✅ Implemented in fork

#### Prompts Registered in Fork
```typescript
design_strategy
  - Description: "Best practices for working with Figma designs"
  - Content: Guidelines on document structure, naming, layout, hierarchy

read_design_strategy
  - Description: "Best practices for reading Figma designs"
  - Content: How to analyze designs effectively

text_replacement_strategy
  - Description: "Systematic approach for replacing text in Figma designs"
  - Content: Strategic methodology for text updates
```

**Impact:** Low - these are guidance/documentation features, not functional tools.

**Recommendation:** 🟡 **LOW PRIORITY** - Nice to have; can be added later

---

### 13. Testing Infrastructure

**Status:** ❌ Not implemented here | ✅ Implemented in fork

#### Fork Test Structure
```
tests/
├── fixtures/          # Test data and mocks
├── integration/       # End-to-end tests
├── unit/utils/        # Utility function tests
└── setup.ts           # Configuration
```

#### Configuration
- Jest with TypeScript support
- Coverage reporting
- Integration test capabilities
- Scripts: `test`, `test:watch`, `test:coverage`, `test:integration`

**Impact:** Code quality and maintainability.

**Recommendation:** 🔴 **HIGH PRIORITY** - Implement Jest test suite

---

### 14. DXT Packaging

**Status:** ❌ Not implemented here | ✅ Implemented in fork

#### Fork's Implementation
```json
{
  "schemaVersion": "0.1",
  "mcpServers": {
    "claude-talk-to-figma-mcp": {
      "command": "node",
      "args": ["dist/talk_to_figma_mcp/server.cjs"],
      "env": { "NODE_ENV": "production" }
    }
  }
}
```

Script: `build:dxt` for packaging `.dxt` files for Claude Desktop

**Impact:** Easier installation for Claude Desktop users.

**Recommendation:** 🟡 **MEDIUM PRIORITY** - Add manifest.json and build script for distribution

---

## Architectural Analysis

### Code Organization

#### This Repo
```
src/
├── mcp_server/
│   └── server.ts (3400+ lines)
├── figma_plugin/
│   ├── src/main.js
│   ├── handlers/        (12 modular files)
│   │   ├── nodeReaders.js
│   │   ├── nodeCreators.js
│   │   ├── nodeModifiers.js
│   │   ├── stylingHandlers.js
│   │   ├── layoutHandlers.js
│   │   ├── componentHandlers.js
│   │   ├── connectorHandlers.js
│   │   ├── textHandlers.js
│   │   ├── annotationHandlers.js
│   │   ├── styleHandlers.js
│   │   ├── variableHandlers.js
│   │   └── vectorHandlers.js
│   └── utils/           (7 modular files)
└── socket.ts
```

**Strengths:**
- ✅ Figma plugin is well-modularized
- ✅ Clear separation of concerns
- ✅ Easy to find and update specific functionality

**Weaknesses:**
- ❌ Server.ts is monolithic (3400+ lines)
- ❌ No test infrastructure

#### Fork
```
src/talk_to_figma_mcp/
├── server.ts
├── tools/
│   ├── creation-tools.ts
│   ├── document-tools.ts
│   ├── modification-tools.ts
│   ├── component-tools.ts
│   ├── text-tools.ts
│   └── index.ts
├── types/
│   ├── color.ts
│   └── index.ts
├── utils/
│   ├── defaults.ts
│   ├── figma-helpers.ts
│   ├── logger.ts
│   └── websocket.ts
├── prompts/
│   └── index.ts
└── config/
```

**Strengths:**
- ✅ Server code organized by tool category
- ✅ Separate types directory
- ✅ Test infrastructure
- ✅ Cleaner module separation

**Weaknesses:**
- ❌ Figma plugin is bundled as single code.js (less maintainable)

### Recommendation

**Adopt a hybrid approach:**
1. Keep figma_plugin modular structure (advantage over fork)
2. Consider refactoring server.ts into tool category files (adoption from fork)
3. Add Jest test infrastructure (from fork)

---

## Feature Priority Matrix

### 🔴 HIGH PRIORITY (Brings major functionality gaps)

| Feature | Category | Effort | Value | Notes |
|---------|----------|--------|-------|-------|
| Page Management | Document | Low | High | Essential for multi-page work |
| Text Styling Suite | Typography | Medium | High | Critical for design systems |
| Node Organization | Structure | Low | High | Basic Figma operations |
| Test Infrastructure | DevOps | Medium | High | Improves code quality |
| Additional Shapes | Creation | Low | Medium | Complete shape toolkit |

**Expected Impact:** 50% improvement in tool coverage for essential operations

### 🟡 MEDIUM PRIORITY (Nice-to-have or optional)

| Feature | Category | Effort | Value | Notes |
|---------|----------|--------|-------|-------|
| Remote Components | Components | Low | Medium | Team library access |
| Component Sets | Components | Medium | Low | Variant support |
| DXT Packaging | Distribution | Low | Medium | Better Claude Desktop UX |
| Direct Style Setters | Styling | Low | Low | Nice convenience |
| MCP Prompts | Guidance | Low | Low | Documentation feature |

**Expected Impact:** 20% improvement in convenience and distribution

### 🟢 CRITICAL (Already excellent here - keep!)

| Feature | Category | Status | Notes |
|---------|----------|--------|-------|
| Security/Scope System | Authorization | ✅ Unique | Major differentiator |
| Variables System | Design Systems | ✅ Complete | Fork lacks entirely |
| Annotations | Collaboration | ✅ Good | Fork lacks |
| Prototyping/Connectors | Interactive | ✅ Good | Fork lacks |
| Plugin Modularization | Architecture | ✅ Better | Better than fork |

---

## Implementation Roadmap

### Phase 1: Essential Gaps (Weeks 1-2)
1. **Page Management Tools** (4 tools)
   - `create_page`, `delete_page`, `rename_page`, `get_pages`, `set_current_page`

2. **Text Styling Tools** (13 tools)
   - Font management, typography controls, text transformations

3. **Node Organization** (4 tools)
   - `group_nodes`, `ungroup_nodes`, `flatten_node`, `insert_child`

4. **Additional Shapes** (3 tools)
   - `create_ellipse`, `create_polygon`, `create_star`

### Phase 2: Quality & Testing (Weeks 3-4)
1. Jest Test Infrastructure
   - Unit tests for utilities
   - Integration tests for major features

2. Code Organization
   - Consider refactoring server.ts into tool category files

### Phase 3: Polish & Distribution (Week 5)
1. DXT Packaging (manifest.json, build script)
2. MCP Prompts (optional)
3. Remote Components support
4. Component Sets/Variants

---

## Code Architecture Insights

### WebSocket Message Flow (Both Implementations Use This)

```
AI Assistant
    ↓ (stdio protocol)
MCP Server (server.ts)
    ↓ (WebSocket bridge)
WebSocket Server (socket.ts)
    ↓ (PostMessage API)
Figma Plugin
    ↓ (Figma API)
Figma UI
```

**Key Difference:** This repo's security checks happen at plugin level; fork has none.

### Security Model - This Repo Only

```
Request → MCP Server → WebSocket → Figma Plugin
                                   ├─ Check Scope Access
                                   ├─ Verify Node Names
                                   ├─ Validate Permissions
                                   └─ Execute → Figma API
```

**Value:** Prevents unauthorized modifications; enables safer delegation

---

## Risk Assessment

### Integration Risks (Bringing in Fork Features)

| Risk | Likelihood | Impact | Mitigation |
|------|-----------|--------|-----------|
| Breaking scope system | Medium | High | Test thoroughly; wrap with scope checks |
| Losing security advantage | Low | High | Never remove scope validation |
| Plugin complexity | Low | Medium | Keep handler modular approach |
| Test coverage gaps | Medium | Medium | Add tests alongside features |

### Non-Integration Risks (Current State)

| Risk | Likelihood | Impact | Mitigation |
|------|-----------|--------|-----------|
| Users switching to fork | Medium | High | Add missing features ASAP |
| Server.ts becomes unmaintainable | High | Medium | Refactor into tool categories |
| No test safety net | High | Medium | Implement Jest suite |

---

## Competitive Analysis

### Why Users Might Prefer Fork

1. Page management (deal-breaker for multi-page designs)
2. Text styling (critical for typography work)
3. Better code organization
4. Test coverage and stability

### Why Users Should Choose This Repo

1. **Security/scope system** (no competition in fork)
2. Variables and design systems support
3. Annotations and collaboration features
4. Prototyping/connectors
5. Better plugin modularization
6. Advanced component instance override handling

### Recommended Messaging

> "All the advanced features you need for design systems and collaboration, with enterprise-grade security and scope controls. Plus the essential tools for page management and text styling."

---

## Conclusion

### Summary Score

| Aspect | This Repo | Fork | Winner |
|--------|-----------|------|--------|
| Feature Coverage | 45 tools | 40 tools | This repo |
| Security | ⭐⭐⭐⭐⭐ | ⭐☆☆☆☆ | This repo |
| Design System Support | ⭐⭐⭐⭐☆ | ⭐⭐☆☆☆ | This repo |
| Basic Tools Completeness | ⭐⭐⭐☆☆ | ⭐⭐⭐⭐☆ | Fork |
| Code Organization | ⭐⭐⭐⭐☆ | ⭐⭐⭐⭐⭐ | Fork |
| Test Coverage | ⭐☆☆☆☆ | ⭐⭐⭐☆☆ | Fork |

### Strategic Path Forward

**This repo is the stronger foundation.** It has:
- Better security architecture
- Better design system support
- Better plugin organization
- More unique features

**To become the clear winner, prioritize:**
1. **Add missing essential tools** (pages, text, shapes, grouping) → Closes feature gap
2. **Implement test infrastructure** → Ensures quality
3. **Refactor server.ts** → Improves maintainability
4. **Add DXT packaging** → Better distribution

**Expected timeline:** 4-5 weeks to implement all high-priority items.

**Result:** A tool that's strictly better than the fork in every dimension.

---

## Appendix: Complete Tool Inventory

### Tools in This Repo (45 total)

**Readers (8):**
- get_document_info, get_nodes_info, scan_text_nodes, scan_nodes_by_types

**Creators (5):**
- create_rectangle, create_frame, create_text, clone_node, create_node_from_svg

**Modifiers (7):**
- move_node, resize_node, delete_multiple_nodes, set_node_name, set_selections

**Styling (4):**
- set_fill_color, set_stroke_color, set_corner_radius, set_effects

**Layout (5):**
- set_layout_mode, set_padding, set_axis_align, set_layout_sizing, set_item_spacing

**Components (6):**
- get_local_components, create_component, create_component_instance, get_instance_overrides, set_instance_overrides

**Connectors (3):**
- get_reactions, set_default_connector, create_connections

**Annotations (2):**
- get_annotations, set_multiple_annotations

**Styles (2):**
- get_styles, create_style, apply_style

**Variables (4):**
- get_variables, get_node_variables, set_bound_variable, manage_variables

**Export (1):**
- export_node_as_image

**Integration (1):**
- join_channel

### Tools in Fork (40 total)

**Document (10):**
- get_document_info, get_selection, get_node_info, get_nodes_info, get_styles, get_local_components, get_remote_components, scan_text_nodes, join_channel, export_node_as_image

**Page Management (5):**
- create_page, delete_page, rename_page, get_pages, set_current_page

**Creation (11):**
- create_rectangle, create_frame, create_text, create_ellipse, create_polygon, create_star, group_nodes, ungroup_nodes, clone_node, flatten_node, insert_child

**Component (3):**
- create_component_instance, create_component_from_node, create_component_set

**Modification (6):**
- set_fill_color, set_stroke_color, move_node, resize_node, delete_node, set_corner_radius

**Layout (1):**
- set_auto_layout

**Styling (2):**
- set_effects, set_effect_style_id

**Text (13):**
- set_text_content, set_multiple_text_contents, set_font_name, set_font_size, set_font_weight, set_letter_spacing, set_line_height, set_paragraph_spacing, set_text_case, set_text_decoration, get_styled_text_segments, set_text_style_id, load_font_async

**Rename (1):**
- rename_node

### Missing in Each

**This Repo Missing (from Fork):**
- Page management (5 tools)
- Ellipse, polygon, star (3 tools)
- Group/ungroup/flatten (3 tools)
- Comprehensive text styling (13 tools)
- Remote components (1 tool)

**Fork Missing (from This Repo):**
- Variables system (4 tools)
- Annotations (2 tools)
- Prototyping/connectors (3 tools)
- Advanced instance overrides (2 tools)
- Comprehensive layout controls (5 tools)

---

**End of Analysis Document**
