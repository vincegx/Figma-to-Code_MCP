# 🏗️ Architecture Guide

> Comprehensive architecture documentation for MCP Figma to Code

## Table of Contents

- [Overview](#overview)
- [Tech Stack](#tech-stack)
- [Project Structure](#project-structure)
- [4-Phase Pipeline](#4-phase-pipeline)
- [Component Architecture](#component-architecture)
- [MCP Integration](#mcp-integration)
- [Transform System](#transform-system)
- [CSS Consolidation](#css-consolidation)
- [Visual Validation](#visual-validation)
- [Dashboard Architecture](#dashboard-architecture)

---

## Overview

MCP Figma to Code uses an **adaptive processing pipeline** with AST transformations to convert Figma designs into production-ready React components.

### Design Principles

1. **Adaptive Processing** - Automatic mode selection (Simple or Chunk) based on design complexity
2. **Performance** - Single-pass AST traversal, parallel processing where possible
3. **Visual Fidelity** - Automated validation ensures pixel-perfect output
4. **Modularity** - Transforms are independent, composable modules
5. **Developer Experience** - Clear separation of concerns, TypeScript types

---

## Tech Stack

### Frontend

| Technology | Version | Purpose |
|------------|---------|---------|
| **React** | 19 | UI framework with latest features |
| **TypeScript** | 5.x | Type safety & developer experience |
| **Vite** | Latest | Fast build tool with HMR |
| **shadcn/ui** | Latest | UI component library (Radix primitives) |
| **Tailwind CSS** | 3.x | Utility-first CSS framework |
| **React Router** | 6.x | Client-side routing |
| **Recharts** | Latest | Chart components for analytics |
| **Lucide React** | Latest | Icon library |

### Backend

| Technology | Version | Purpose |
|------------|---------|---------|
| **Node.js** | 20+ | JavaScript runtime |
| **Express** | 4.x | Web server for API endpoints |
| **Server-Sent Events** | Native | Real-time log streaming |
| **Babel** | 7.x | AST parsing & code generation |
| **Puppeteer** | Latest | Screenshot capture |
| **MCP SDK** | Latest | Figma Desktop integration |

### Infrastructure

| Technology | Purpose |
|------------|---------|
| **Docker** | Containerization for consistent environment |
| **Docker Compose** | Multi-container orchestration |
| **Alpine Linux** | Lightweight base image |
| **Chromium** | Headless browser for Puppeteer |

---

## Project Structure

```
mcp-figma-to-code/
├── 📁 src/                          # Frontend application
│   ├── 📁 components/
│   │   ├── ui/                      # shadcn/ui components (25+ components)
│   │   │   ├── button.tsx
│   │   │   ├── card.tsx
│   │   │   ├── tabs.tsx
│   │   │   ├── sidebar.tsx
│   │   │   └── ...
│   │   ├── layout/                  # Layout components
│   │   │   ├── MainLayout.tsx       # Root layout with sidebar
│   │   │   ├── SiteHeader.tsx       # Header with breadcrumb
│   │   │   └── AppSidebar.tsx       # Navigation sidebar
│   │   ├── pages/                   # Page components
│   │   │   ├── DashboardPage.tsx    # KPIs & analytics
│   │   │   ├── AnalyzePage.tsx      # Analysis form
│   │   │   ├── ExportFigmasPage.tsx        # Tests grid/list
│   │   │   └── ExportFigmaDetailPage.tsx   # 4-tab detail view
│   │   ├── features/                # Feature-based components
│   │   │   ├── analysis/
│   │   │   │   └── AnalysisForm.tsx # Form + SSE logs
│   │   │   ├── tests/
│   │   │   │   ├── ExportFigmaCard.tsx     # Grid item
│   │   │   │   ├── ExportFigmasGrid.tsx    # Grid layout
│   │   │   │   ├── ExportFigmasTable.tsx   # Table layout
│   │   │   │   ├── ControlsBar.tsx  # View/sort controls
│   │   │   │   └── PaginationControls.tsx
│   │   │   └── stats/
│   │   │       └── UsageBar.tsx     # API usage widget
│   │   └── common/                  # Shared components
│   │       ├── ThemeToggle.tsx      # Dark/light theme
│   │       └── LanguageSwitcher.tsx # i18n switcher
│   ├── 📁 hooks/                    # React hooks
│   │   ├── useExportFigmas.ts              # Tests data fetching
│   │   ├── useMcpHealth.ts          # MCP health check
│   │   └── useTheme.ts              # Theme management
│   ├── 📁 i18n/                     # Internationalization
│   │   ├── I18nContext.tsx          # i18n provider
│   │   └── translations/
│   │       ├── en.json
│   │       └── fr.json
│   ├── 📁 lib/                      # Utilities
│   │   └── utils.ts                 # cn() helper, etc.
│   ├── 📁 generated/export_figma/          # Output directory (git-ignored)
│   │   └── node-{id}-{ts}/          # Each test folder
│   ├── App.tsx                      # Root component
│   └── main.tsx                     # Entry point
│
├── 📁 scripts/                      # Processing pipeline
│   ├── figma-cli.js                 # Main orchestrator
│   ├── pipeline.js                  # Transform executor
│   ├── config.js                    # Transform configuration
│   ├── unified-processor.js         # AST processor CLI
│   ├── 📁 transformations/          # AST transforms (11 total)
│   │   ├── font-detection.js        # Priority 10
│   │   ├── auto-layout.js           # Priority 20
│   │   ├── ast-cleaning.js          # Priority 30
│   │   ├── svg-icon-fixes.js        # Priority 40
│   │   ├── svg-consolidation.js     # Priority 45
│   │   ├── post-fixes.js            # Priority 50
│   │   ├── position-fixes.js        # Priority 60
│   │   ├── stroke-alignment.js      # Priority 70
│   │   ├── css-vars.js              # Priority 80
│   │   ├── tailwind-optimizer.js    # Priority 90
│   │   └── production-cleaner.js    # Priority 100
│   ├── 📁 post-processing/
│   │   ├── organize-images.js       # Image renaming
│   │   ├── fix-svg-vars.js          # SVG variable fixes
│   │   ├── sync-optimizer.js        # CSS/TSX synchronization (Phase 4 - NEW Jan 2025)
│   │   ├── component-splitter.js    # Component splitting (Phase 5)
│   │   ├── dist-generator.js        # Dist package generation (Phase 6)
│   │   └── capture-screenshot.js    # Puppeteer capture
│   ├── 📁 reporting/
│   │   ├── generate-metadata.js     # Dashboard metadata
│   │   ├── generate-analysis.js     # Technical report
│   │   └── generate-report.js       # Visual HTML report
│   └── 📁 utils/
│       ├── chunking.js              # Chunk extraction/assembly
│       └── usage-tracker.js         # API usage tracking
│
├── 📁 cli/                          # CLI tools
│   ├── figma-analyze                # Bash wrapper
│   └── config/
│       └── figma-params.json        # MCP parameters
│
├── 📁 data/                         # Usage tracking (git-ignored)
│   └── figma-usage.json             # 30-day history
│
├── 📁 docs/                         # Documentation
│   ├── ARCHITECTURE.md              # This file
│   ├── DEVELOPMENT.md               # Developer guide
│   ├── TRANSFORMATIONS.md           # Transform reference
│   ├── TROUBLESHOOTING.md           # Issue resolution
│   ├── API.md                       # API documentation
│   └── images/                      # Screenshots
│
├── server.js                        # Express API server
├── docker-compose.yml               # Docker configuration
├── Dockerfile                       # Alpine + Chromium
├── package.json                     # Dependencies
├── CLAUDE.md                        # AI assistant guide
└── README.md                        # Main documentation
```

---

## 4-Phase Pipeline

The conversion pipeline consists of 4 sequential phases:

### Phase 1: Extraction (MCP)

**Purpose:** Extract design data from Figma via MCP protocol

**Two Modes (Automatically Selected):**

#### Simple Mode (4 MCP calls)
Used when design is small and code is valid:
1. Connect to MCP server
2. `get_metadata(nodeId)` → metadata.xml
3. `get_design_context(nodeId)` → Component.tsx (full code)
4. `get_screenshot(nodeId)` → figma-render.png
5. `get_variable_defs(nodeId)` → variables.json

#### Chunk Mode (5+N MCP calls)
Used when design is large or code invalid:
1. Connect to MCP server
2. `get_metadata(nodeId)` → metadata.xml
3. Parse XML to extract child nodes
4. `get_design_context(nodeId)` → parent-wrapper.tsx
5. `get_screenshot(nodeId)` → figma-render.png
6. `get_variable_defs(nodeId)` → variables.json
7. For each child node (N):
   - `get_design_context(childId)` → chunks/{name}.tsx
   - Wait 1 second (rate limiting)

**Output:**
```
test-dir/
├── metadata.xml
├── parent-wrapper.tsx
├── figma-render.png
├── variables.json
└── chunks/
    ├── Header.tsx
    └── Footer.tsx
```

**Rate Limiting:**
- 1 second delay between `get_design_context` calls
- Prevents hitting Figma API rate limits
- Implemented in `figma-cli.js` with `sleep(1000)`

### Phase 2: Processing (AST)

**Purpose:** Transform and optimize code using AST

**Steps:**
1. **Organize Images**
   - Move from `tmp/figma-assets/` to `test-dir/img/`
   - Rename from hash to Figma layer name (using metadata.xml)

2. **Process Each Chunk**
   - Parse React/JSX to AST with `@babel/parser`
   - Load enabled transforms from `config.js`
   - Sort transforms by priority (10 → 100)
   - Execute all transforms in single traversal
   - Extract CSS during processing
   - Generate optimized code
   - Save to `chunks-fixed/{name}.tsx` + `.css`

3. **Consolidate Chunks**
   - Generate `Component-fixed.tsx` with imports:
     ```tsx
     import Header from './chunks-fixed/Header'
     import Footer from './chunks-fixed/Footer'
     ```
   - Merge all chunk CSS into `Component-fixed.css`
   - Deduplicate `:root` variables and utility classes

4. **Fix SVG Variables**
   - Replace CSS variables in SVG `<path>` data
   - Ensures SVGs render correctly

**Output:**
```
test-dir/
├── Component-fixed.tsx     # Consolidated component
├── Component-fixed.css     # Merged CSS
├── chunks-fixed/
│   ├── Header.tsx
│   ├── Header.css
│   ├── Footer.tsx
│   └── Footer.css
└── img/
    ├── logo.png
    └── hero-bg.jpg
```

### Phase 3: Validation (Visual)

**Purpose:** Capture web screenshot for comparison

**Steps:**
1. Launch Puppeteer with Chromium
2. Read dimensions from `metadata.xml` (width × height)
3. Navigate to preview URL: `http://localhost:5173?preview=true&test={testId}`
4. Wait for:
   - Google Fonts to load
   - Images to load
   - React hydration
5. Capture screenshot at exact dimensions
6. Save as `web-render.png`

**Output:**
```
test-dir/
├── figma-render.png   # Reference (from Figma)
└── web-render.png     # Generated (from web)
```

### Phase 4: Output (Reports)

**Purpose:** Generate metadata and reports

**Generated Files:**

1. **metadata.json** - Dashboard metadata
   ```json
   {
     "nodeId": "9:2654",
     "nodeName": "Hero Section",
     "timestamp": 1735689600,
     "stats": {
       "totalNodes": 245,
       "imagesOrganized": 12,
       "totalFixes": 87,
       "executionTime": 2345
     }
   }
   ```

2. **analysis.md** - Technical report
   - Transform statistics
   - Execution times
   - Items processed per transform

3. **report.html** - Visual comparison
   - Side-by-side: Figma vs Web
   - Embedded images
   - Responsive iframe

---

## Responsive Merge Pipeline

**Multi-Screen Fusion System** - Combines 3 Figma exports (Desktop, Tablet, Mobile) into a single responsive component.

### Overview

The Responsive Merge feature extends the standard pipeline with a specialized **responsive transformation pipeline** that intelligently merges three complete screen designs while preserving visual fidelity across all breakpoints.

```
Desktop Export (1440px) ──┐
                          ├──> Responsive Merger ──> Page.tsx + Subcomponents/
Tablet Export (960px)   ──┤         ↓
                          │    Responsive Pipeline (7 transforms)
Mobile Export (420px)   ──┘         ↓
                                Pure CSS Media Queries
```

### Pipeline Phases

#### Phase 1: Detection & Validation
```javascript
// 1. Validate all 3 exports have modular/ directory
validateBreakpoint(desktop.id, 'Desktop', 1440)
validateBreakpoint(tablet.id, 'Tablet', 960)
validateBreakpoint(mobile.id, 'Mobile', 420)

// 2. Detect common components across breakpoints
const common = detectCommonComponents(desktop, tablet, mobile)
// → Only components present in all 3 breakpoints

// 3. Get component order from Desktop metadata.xml
const order = await getComponentOrder(desktop.testDir, common)
// → Preserves visual hierarchy from Figma

// 4. Extract helper functions from Desktop
const helpers = extractHelperFunctions(desktop.testDir, order)
// → Shared utilities like formatCurrency(), IconComponent, etc.
```

#### Phase 2: Component Merging (AST Pipeline)

For each common component:

```javascript
// 1. Parse all 3 TSX files
const desktopAST = parse(desktopTSX)
const tabletAST = parse(tabletTSX)
const mobileAST = parse(mobileTSX)

// 2. Run Responsive Pipeline (7 transforms)
const context = await runResponsivePipeline(
  desktopAST,
  tabletAST,
  mobileAST,
  { desktop: 1440, tablet: 960, mobile: 420 },
  config
)

// 3. Generate merged code
const mergedCode = generate(context.desktopAST)

// 4. Inject helpers if needed
const usedHelpers = findUsedHelpers(mergedCode, helpers)
const finalCode = injectHelpersIntoComponent(mergedCode, usedHelpers, helpers)

// 5. Fix image paths: ./img/ → ../img/
finalCode = finalCode.replace(/from ["']\.\/img\//g, 'from "../img/')
```

#### Phase 3: CSS Merging

```javascript
// 1. Parse all 3 CSS files into sections
const desktopSections = parseCSSIntoSections(desktopCSS)
const tabletSections = parseCSSIntoSections(tabletCSS)
const mobileSections = parseCSSIntoSections(mobileCSS)

// 2. Merge :root variables (deduplicate)
const rootVars = mergeRootVariables([
  desktopSections.root,
  tabletSections.root,
  mobileSections.root
])

// 3. Desktop styles (baseline, no media query)
merged += desktopSections.customClasses

// 4. Tablet overrides (calculate differences)
const tabletDiff = getClassDifferences(
  desktopSections.customClasses,
  tabletSections.customClasses
)
merged += `@media (max-width: 960px) {\n${tabletDiff}\n}`

// 5. Mobile overrides (calculate differences from tablet)
const mobileDiff = getClassDifferences(
  tabletSections.customClasses,
  mobileSections.customClasses
)
merged += `@media (max-width: 420px) {\n${mobileDiff}\n}`
```

#### Phase 4: Page Generation

```javascript
// 1. Merge Page structure from all 3 Component-clean.tsx files
const pageResult = await mergeTSXStructure(
  desktopComponentClean,
  tabletComponentClean,
  mobileComponentClean,
  breakpoints
)

// 2. Replace <div data-name="..."> with <ComponentName />
// Desktop Component-clean.tsx:
// <div data-name="title section">...</div>
// → Becomes: <Titlesection />

// 3. Generate Page.css with component imports
const pageCSS = `
  @import './Subcomponents/Header.css';
  @import './Subcomponents/Hero.css';
  /* ... parent container CSS ... */
  /* ... compiled responsive classes ... */
`

// 4. Compile responsive classes to pure CSS
const compiledCSS = compileResponsiveClasses(outputDir)
// max-md:w-80 → .max-md-w-custom-80 { width: 20rem; }
```

### Responsive Transforms (Priority Order)

| Priority | Transform | Purpose |
|----------|-----------|---------|
| **10** | `detect-missing-elements` | Find elements missing in tablet/mobile (e.g., desktop-only sidebar) |
| **20** | `normalize-identical-classes` | Normalize className formatting across breakpoints |
| **30** | `detect-class-conflicts` | Detect className differences using data-name or position matching |
| **40** | `merge-desktop-first` | Merge classNames (Desktop base + Tablet/Mobile overrides) |
| **50** | `add-horizontal-scroll` | Add `overflow-x: auto` to prevent layout breaks on narrow screens |
| **60** | `reset-dependent-properties` | Reset conflicting properties (width, height, flex-basis) |
| **70** | `inject-visibility-classes` | Add visibility classes (max-md:hidden, max-lg:block) |

**Transform Implementation:**

```javascript
// scripts/responsive-transformations/detect-class-conflicts.js
export const meta = {
  name: 'detect-class-conflicts',
  priority: 30
}

export function execute(desktopAST, tabletAST, mobileAST, context) {
  const conflicts = []

  // 1. Match elements by data-name attribute
  const desktopElements = findAllJSXElements(desktopAST)
  const tabletElements = findAllJSXElements(tabletAST)
  const mobileElements = findAllJSXElements(mobileAST)

  for (const desktopEl of desktopElements) {
    const dataName = getDataName(desktopEl)
    const tabletEl = tabletElements.find(el => getDataName(el) === dataName)
    const mobileEl = mobileElements.find(el => getDataName(el) === dataName)

    if (tabletEl && mobileEl) {
      const desktopClasses = getClassName(desktopEl)
      const tabletClasses = getClassName(tabletEl)
      const mobileClasses = getClassName(mobileEl)

      if (desktopClasses !== tabletClasses || tabletClasses !== mobileClasses) {
        conflicts.push({ dataName, desktopClasses, tabletClasses, mobileClasses })
      }
    }
  }

  return {
    elementsWithConflicts: conflicts.length,
    totalConflicts: conflicts.reduce((sum, c) => sum + diffCount(c), 0),
    matchedByDataName: conflicts.filter(c => c.dataName).length,
    matchedByPosition: conflicts.filter(c => !c.dataName).length
  }
}
```

### Output Structure

```
responsive-merger-{timestamp}/
├── Page.tsx                      # Main page with all imports
├── Page.css                      # Consolidated CSS with media queries
├── Subcomponents/                # Modular responsive components
│   ├── Header.tsx                # Desktop-first with responsive classes
│   ├── Header.css                # Media queries for tablet/mobile
│   ├── Hero.tsx
│   ├── Hero.css
│   └── Footer.tsx
│   └── Footer.css
├── img/                          # Images from Desktop export
├── puck/                         # Visual editor components
│   ├── components/               # Puck-wrapped components
│   ├── config.tsx                # Puck configuration
│   └── data.json                 # Initial Puck data
├── responsive-metadata.json      # Merge stats & transformation details
├── responsive-analysis.md        # Technical analysis report
└── responsive-report.html        # Visual comparison (Desktop/Tablet/Mobile)
```

### Puck Integration

**Puck** is a visual editor for React. The merge generates Puck-ready components:

```javascript
// puck/config.tsx
import { Config } from '@measured/puck'
import Header from './components/Header'
import Hero from './components/Hero'

export const config: Config = {
  components: {
    Header: {
      fields: {
        title: { type: 'text' },
        logo: { type: 'text' }
      },
      render: ({ title, logo }) => <Header title={title} logo={logo} />
    },
    Hero: { /* ... */ }
  }
}
```

**Usage:**
1. Navigate to Responsive Merge detail page
2. Open "Puck Editor" tab
3. Drag/drop components, edit props
4. Save changes to `puck/data.json`

### API Endpoints

```javascript
// Create responsive merge
POST /api/responsive-merges
Body: {
  desktop: { size: '1440', exportId: 'node-xxx' },
  tablet: { size: '960', exportId: 'node-yyy' },
  mobile: { size: '420', exportId: 'node-zzz' }
}

// Stream merge logs (SSE)
GET /api/responsive-merges/logs/:jobId

// Get merge data
GET /api/responsive-merges/:mergeId/data

// Puck endpoints
GET /api/responsive-merges/:mergeId/puck-config
GET /api/responsive-merges/:mergeId/puck-data
POST /api/responsive-merges/:mergeId/puck-save

// Download merge as ZIP
GET /api/responsive-merges/:mergeId/download
```

### Performance Optimizations

1. **Parallel Processing** - Components merged in parallel where possible
2. **CSS Deduplication** - Only differences included in media queries
3. **Helper Caching** - Helper functions extracted once, reused across components
4. **Incremental CSS Compilation** - Only responsive classes compiled, not full CSS

### For More Details

See [Responsive Merge Guide](RESPONSIVE_MERGE.md) for complete documentation.

---

## Component Architecture

### Frontend (Dashboard)

**Feature-Based Organization:**

```
components/
├── ui/              # Primitive components (shadcn/ui)
├── layout/          # App-level layout
├── pages/           # Route-level pages
├── features/        # Domain features
│   ├── analysis/
│   ├── tests/
│   └── stats/
└── common/          # Shared utilities
```

**Key Patterns:**

1. **Composition over Inheritance**
   - Small, focused components
   - Compose complex UIs from primitives

2. **Container/Presentation Split**
   - `ExportFigmasPage` (container) fetches data
   - `ExportFigmasGrid` (presentation) renders UI

3. **Custom Hooks**
   - `useExportFigmas()` - Test data fetching
   - `useMcpHealth()` - Health check polling
   - `useTheme()` - Theme management

4. **Type Safety**
   - Explicit TypeScript interfaces
   - Props validation
   - Return type annotations

### Backend (Server)

**API Structure:**

```
server.js
├── Static file serving (Vite dist)
├── API Routes (/api/*)
│   ├── POST /api/analyze
│   ├── GET /api/analyze/logs/:jobId (SSE)
│   ├── GET /api/mcp/health
│   ├── GET /api/usage
│   └── DELETE /api/export_figma/:testId
└── SPA fallback (index.html)
```

**Patterns:**

1. **Job Management**
   - Each analysis = unique job ID
   - Child process spawned for isolation
   - Logs streamed via SSE

2. **Error Handling**
   - Try/catch with meaningful messages
   - HTTP status codes
   - Error response format: `{ error: string }`

3. **CORS**
   - Enabled for development
   - Configured for production

---

## MCP Integration

### Connection Setup

```javascript
import { Client } from '@modelcontextprotocol/sdk/client/index.js'
import { StreamableHTTPClientTransport } from '@modelcontextprotocol/sdk/client/streamableHttp.js'

// Create transport
const transport = new StreamableHTTPClientTransport({
  url: process.env.MCP_URL || 'http://host.docker.internal:3845/mcp'
})

// Create client
const client = new Client({
  name: 'figma-cli',
  version: '1.0.0'
}, {
  capabilities: {}
})

// Connect
await client.connect(transport)
```

### Available Tools

#### 1. get_metadata

**Purpose:** Get node hierarchy as XML

**Parameters:**
```javascript
{ nodeId: '9:2654' }
```

**Returns:** XML string
```xml
<node id="9:2654" name="Hero Section" type="FRAME">
  <node id="9:2655" name="Header" type="FRAME" />
  <node id="9:2656" name="Content" type="FRAME" />
</node>
```

#### 2. get_design_context

**Purpose:** Generate React code for node

**Parameters:**
```javascript
{
  nodeId: '9:2654',
  forceCode: true,
  renderImages: true,
  dirForAssetWrites: '/app/tmp/figma-assets'
}
```

**Returns:** React/TSX string

#### 3. get_screenshot

**Purpose:** Capture Figma screenshot

**Parameters:**
```javascript
{ nodeId: '9:2654' }
```

**Returns:** Base64 PNG data

#### 4. get_variable_defs

**Purpose:** Extract design tokens

**Parameters:**
```javascript
{ nodeId: '9:2654' }
```

**Returns:** JSON with colors, fonts, spacing

### Rate Limiting Strategy

```javascript
// Extract chunks with 1s delay
for (const node of nodes) {
  const chunk = await client.callTool({
    name: 'get_design_context',
    arguments: { nodeId: node.id, forceCode: true }
  })

  await new Promise(resolve => setTimeout(resolve, 1000))
}
```

---

## Transform System

### Transform Interface

All transforms implement this contract:

```javascript
export const meta = {
  name: 'transform-name',
  priority: 50  // 10 (early) → 100 (late)
}

export function execute(ast, context) {
  // Modify AST in place
  let itemsProcessed = 0

  traverse(ast, {
    JSXElement(path) {
      // Transform logic
      itemsProcessed++
    }
  })

  return {
    itemsProcessed,
    executionTime: Date.now() - startTime,
    // ... custom stats
  }
}
```

### Pipeline Execution

```javascript
// pipeline.js
export async function runPipeline(sourceCode, context, config) {
  // 1. Parse code to AST
  const ast = parser.parse(sourceCode, {
    sourceType: 'module',
    plugins: ['jsx', 'typescript']
  })

  // 2. Load and sort transforms
  const transforms = loadTransforms(config)
  transforms.sort((a, b) => a.meta.priority - b.meta.priority)

  // 3. Execute all transforms
  const stats = {}
  for (const transform of transforms) {
    stats[transform.meta.name] = transform.execute(ast, context)
  }

  // 4. Generate code
  const { code } = generate(ast)

  // 5. Extract CSS
  const css = extractCSS(ast, context)

  return { code, css, stats }
}
```

### Priority System

| Priority | Phase | Purpose |
|----------|-------|---------|
| 10 | Font Detection | Convert `font-['Font:Style']` to inline |
| 20 | Auto Layout | Fix Figma auto-layout classes |
| 30 | AST Cleaning | Remove invalid Tailwind |
| 40 | SVG Icon Fixes | Fix SVG structure |
| 45 | SVG Consolidation | Merge nested SVGs |
| 50 | Post Fixes | Gradients, shapes |
| 60 | Position Fixes | Positioning issues |
| 70 | Stroke Alignment | Stroke alignment |
| 80 | CSS Variables | Convert to values |
| 90 | Tailwind Optimizer | Arbitrary → standard |
| 100 | Production Cleaner | Remove debug attrs |

---

## CSS Processing Pipeline

### Overview

The system processes CSS through **6 distinct phases** to transform raw Figma output into optimized, production-ready stylesheets.

```
Phase 1: Chunk Processing
    ↓ (chunks-fixed/*.css)
Phase 2: Consolidation
    ↓ (Component-fixed.css)
Phase 3: Clean Generation
    ↓ (Component-clean.css)
Phase 4: Optimization ⭐ NEW
    ↓ (Component-optimized.css)
Phase 5: Component Splitting
    ↓ (components/*.css)
Phase 6: Dist Generation
    ↓ (dist/components/*.css)
```

### Phase 1: Chunk Processing

**Purpose:** Extract CSS from individual React components during AST transformation.

**Input:** `chunks/*.tsx` (raw Figma output)

**Process:**
- Parse TSX to AST
- Apply 11 AST transforms (priority 10-100)
- Extract CSS classes during traversal
- Generate component-specific CSS

**Output:** `chunks-fixed/*.css` (one CSS file per component)

**Example:**
```css
/* chunks-fixed/Header.css */
@import url('https://fonts.googleapis.com/css2?family=Inter:wght@400&display=swap');

:root {
  --brand: #9DFFB9;
  --black-700: #282828;
}

.bg-brand { background-color: var(--brand); }
.h-custom-918 { height: 918px; }
.px-20 { padding-left: 80px; padding-right: 80px; }
```

---

### Phase 2: Consolidation

**Purpose:** Merge all chunk CSS files into a single consolidated stylesheet.

**Input:** `chunks-fixed/*.css` (multiple files)

**Process:**
```javascript
function consolidateCSS(chunkCSSFiles) {
  const rootVars = new Map()  // Deduplicate :root
  const utilClasses = new Set()  // Deduplicate utilities
  let googleFonts = ''  // From first chunk

  for (const cssFile of chunkCSSFiles) {
    const css = fs.readFileSync(cssFile, 'utf8')

    // Extract Google Fonts import
    if (!googleFonts) {
      googleFonts = extractGoogleFonts(css)
    }

    // Extract :root variables
    const vars = extractRootVars(css)
    for (const [key, value] of vars) {
      rootVars.set(key, value)
    }

    // Extract utility classes
    const utils = extractUtilClasses(css)
    utils.forEach(u => utilClasses.add(u))
  }

  // Assemble final CSS
  return [
    googleFonts,
    generateRootVars(rootVars),
    ...utilClasses
  ].join('\n')
}
```

**Deduplication Rules:**
- `:root` variables: Last value wins (Map)
- Utility classes: Exact match deduplication (Set)
- Google Fonts: Use first chunk's import

**Output:** `Component-fixed.css` (single consolidated file)

```css
/* Component-fixed.css */
@import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;600&display=swap');

:root {
  --brand: #9DFFB9;          /* Deduplicated */
  --black-700: #282828;      /* From chunk 1 */
  --white: #FFFFFF;          /* From chunk 2 */
}

.content-start { align-content: flex-start; }  /* Deduplicated */
.bg-brand { background-color: var(--brand); }
.h-custom-918 { height: 918px; }
```

---

### Phase 3: Clean Generation

**Purpose:** Generate production-ready version without Tailwind dependencies or debug attributes.

**Input:** `Component-fixed.tsx/css` (Tailwind version with debug attrs)

**Process:**
- Remove `data-name` and `data-node-id` attributes from TSX
- Convert Tailwind utility classes to pure CSS classes
- Remove debug comments

**Output:** `Component-clean.tsx/css` (production-ready, zero dependencies)

**Comparison:**
```jsx
// Component-fixed.tsx (Tailwind version)
<div data-name="Header" data-node-id="9:2654" className="flex items-center">

// Component-clean.tsx (production version)
<div className="header-container">
```

```css
/* Component-clean.css */
.header-container {
  display: flex;
  align-items: center;
}
```

---

### Phase 4: Optimization ⭐ NEW (Jan 2025)

**Purpose:** Optimize CSS class names and synchronize with TSX to prevent desynchronization.

**Script:** `scripts/post-processing/sync-optimizer.js`

**Input:** `Component-clean.tsx/css` (unoptimized)

**Process:**

1. **Build Transform Map** - Analyze CSS to detect all optimizations:
   ```javascript
   const transformMap = new Map([
     // Color mappings (from :root variables)
     ['bg-custom-9dffb9', 'bg-brand'],
     ['text-custom-282828', 'text-black-700'],

     // Spacing mappings (Tailwind equivalents ±2px tolerance)
     ['px-custom-80', 'px-20'],    // 80px → 20 * 4px
     ['gap-custom-32', 'gap-8'],   // 32px → 8 * 4px

     // Decimal rounding
     ['h-custom-29dot268', 'h-custom-29'],
     ['w-custom-654dot12', 'w-custom-654']
   ])
   ```

2. **Transform CSS** - Apply map to CSS class definitions:
   ```css
   /* Before */
   .bg-custom-9dffb9 { background-color: var(--brand); }
   .px-custom-80 { padding-left: 80px; padding-right: 80px; }

   /* After */
   .bg-brand { background-color: var(--brand); }
   .px-20 { padding-left: 80px; padding-right: 80px; }
   ```

3. **Transform TSX** - Apply **SAME map** to TSX classNames (synchronization!):
   ```jsx
   // Before
   <div className="bg-custom-9dffb9 px-custom-80">

   // After
   <div className="bg-brand px-20">
   ```

4. **Validate Sync** - Ensure all TSX classes exist in CSS:
   ```javascript
   const validation = validateSync(optimizedTSX, optimizedCSS, transformMap)
   // Returns: { tsxClasses: 145, cssClasses: 142, missingClasses: [] }
   ```

**Output:** `Component-optimized.tsx/css` (synchronized, optimized)

**Why This Matters:**

❌ **Previous approach:** CSS optimized separately from TSX → class name mismatch → broken styling

✅ **New approach:** Single transformMap applied to both files → guaranteed synchronization

**Transformations Applied:**
- **Color mapping** - `bg-custom-9dffb9` → `bg-brand` (uses :root variables)
- **Spacing mapping** - `px-custom-80` → `px-20` (Tailwind equivalents with ±2px tolerance)
- **Decimal rounding** - `h-custom-29dot268` → `h-custom-29`
- **Value optimization** - Round decimal values in CSS properties

---

### Phase 5: Component Splitting

**Purpose:** Split monolithic component into modular chunks for responsive merging.

**Script:** `scripts/post-processing/component-splitter.js`

**Input:** `Component-optimized.tsx/css`

**Process:**

1. **Extract Components:**
   - React function components (except main component)
   - Direct children of "Container"
   - Semantic sections (Header, Footer, *Section, *Overview, *Actions)

2. **Filter CSS Per Component:**
   - Extract only classes used by each component
   - Parse TSX to find all className attributes
   - Filter CSS to matching classes only

3. **Buffer Save Fix** *(Bug Fix - Jan 2025)*:
   ```javascript
   // Problem: Last CSS rule lost during filtering
   for (const line of lines) {
     if (line.startsWith('.')) {
       if (currentRule.length > 0) {
         filteredLines.push(...currentRule)
       }
       currentRule = [line]
     } else {
       currentRule.push(line)
     }
   }
   // ❌ Loop ends - last currentRule never saved!

   // FIX (lines 628-631): Save final buffer
   if (keepCurrentRule && currentRule.length > 0) {
     filteredLines.push(...currentRule);
   }
   ```

**Output:** `components/*.tsx` + `*.css` (modular files)

```
components/
├── Header.tsx + Header.css       (only Header-specific classes)
├── Hero.tsx + Hero.css           (only Hero-specific classes)
└── Footer.tsx + Footer.css       (only Footer-specific classes)
```

**Example Bug Fixed:**
```css
/* Before Fix (Footer.css) */
.border-w-0-0-1 { border-width: 0 0 1px 0; }
.border-w-0-1-1-0 { border-width: 0 1px 1px 0; }
.border-w-2-0-0 { ... }  ← LOST (last rule)

/* After Fix (Footer.css) */
.border-w-0-0-1 { border-width: 0 0 1px 0; }
.border-w-0-1-1-0 { border-width: 0 1px 1px 0; }
.border-w-2-0-0 { border-width: 2px 0 0 0; }  ✅ PRESERVED
```

---

### Phase 6: Dist Generation

**Purpose:** Generate production-ready dist/ package with organized CSS.

**Script:** `scripts/post-processing/dist-generator.js`

**Input:** `components/*.tsx` + `*.css`

**Process:**

1. **Copy TSX Files** - Copy to `dist/components/`

2. **Reorganize CSS** - Generic section-based approach *(Rewritten Jan 2025)*:

   **Old Approach (REMOVED):**
   ```javascript
   // ❌ Hardcoded prefix rules
   if (className.startsWith('bg-') || className.startsWith('text-')) {
     currentSection = 'colors'
   }
   // Problem: border-w-* misclassified as Colors
   ```

   **New Approach:**
   ```javascript
   // ✅ Section detection by comments
   const sectionMap = {
     'Figma-specific utility': 'utilities',
     'Font': 'fonts',
     'Color': 'colors',
     'Dimension': 'dimensions',
     'Spacing': 'spacing',
     'Typography': 'typography',
     'Layout': 'layout',
     'Figma Variable': 'layout',  // Maps to Layout
     'Other Custom': 'layout'      // Maps to Layout
   }

   // Detect section by comment header
   for (const line of lines) {
     if (line.match(/^\/\* (.*?) \*\/$/)) {
       const commentText = match[1]
       currentSection = findMappedSection(commentText, sectionMap)
     }
     currentSectionBuffer.push(line)
   }

   // Output sections in logical order
   // Header → Imports → :root → Utilities → Fonts → Colors →
   // Dimensions → Spacing → Typography → Layout → Other
   ```

   **Benefits:**
   - No edge cases (doesn't re-categorize individual classes)
   - Flexible (easy to add new section mappings)
   - Preserves all classes without categorization failures

3. **Generate Page.tsx** - Import all components

4. **Copy Images** - Copy to `dist/img/`

**Output:** `dist/` (copy-paste ready for production)

```
dist/
├── Page.tsx                # Imports all components
├── Page.css                # Page-level styles
├── components/
│   ├── Header.tsx
│   ├── Header.css          # Organized with logical sections
│   ├── Hero.tsx
│   ├── Hero.css
│   ├── Footer.tsx
│   └── Footer.css
└── img/
    ├── logo.png
    └── hero-bg.jpg
```

**Example Organized CSS:**
```css
/* dist/components/Header.css */

/* Auto-generated scoped CSS for Header */

@import url('https://fonts.googleapis.com/css2?family=Inter:wght@400&display=swap');

:root {
  --brand: #9DFFB9;
  --black-700: #282828;
}

/* Utilities */
.content-start { align-content: flex-start; }

/* Fonts */
.font-inter-400 { font-family: "Inter", sans-serif; font-weight: 400; }

/* Colors */
.bg-brand { background-color: var(--brand); }
.text-black-700 { color: var(--black-700); }

/* Dimensions */
.h-custom-918 { height: 918px; }
.w-custom-1280 { width: 1280px; }

/* Spacing */
.px-20 { padding-left: 80px; padding-right: 80px; }

/* Typography */
.line-height-custom-46px { line-height: 46px; }
.letter-spacing-custom-neg-2px { letter-spacing: -2px; }

/* Layout */
.border-w-2-0-0 { border-width: 2px 0 0 0; }
.top-custom-calc-50pct-0dot3px { top: calc(50%); }
```

---

### Performance Optimizations

- **Single-pass AST** - Phase 1: All transforms execute in one traversal
- **Synchronization** - Phase 4: Single transformMap prevents TSX/CSS desync
- **Deduplication** - Phase 2: Map for :root variables, Set for utilities
- **Scoped CSS** - Phase 5: Each component gets only its used classes
- **Buffer Management** - Phase 5: Proper flushing prevents data loss

---

## Visual Validation

### Puppeteer Screenshot Capture

```javascript
// capture-screenshot.js
import puppeteer from 'puppeteer'

export async function captureScreenshot(testDir, vitePort) {
  // 1. Read dimensions from metadata.xml
  const { width, height } = extractDimensions(`${testDir}/metadata.xml`)

  // 2. Launch browser
  const browser = await puppeteer.launch({
    executablePath: '/usr/bin/chromium',
    args: ['--no-sandbox', '--disable-dev-shm-usage']
  })

  const page = await browser.newPage()
  await page.setViewport({ width, height })

  // 3. Navigate to preview
  const testId = path.basename(testDir)
  await page.goto(`http://localhost:${vitePort}?preview=true&test=${testId}`)

  // 4. Wait for assets
  await page.waitForFunction(() => {
    // Check fonts loaded
    const fonts = document.fonts
    if (fonts.status !== 'loaded') return false

    // Check images loaded
    const images = document.querySelectorAll('img')
    return Array.from(images).every(img => img.complete)
  }, { timeout: 10000 })

  // 5. Capture screenshot
  await page.screenshot({
    path: `${testDir}/web-render.png`,
    fullPage: false
  })

  await browser.close()
}
```

### Comparison Report

Generated HTML includes:

```html
<!-- report.html -->
<!DOCTYPE html>
<html>
<head>
  <title>Visual Fidelity Report</title>
  <style>
    .comparison {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 20px;
    }
  </style>
</head>
<body>
  <h1>Figma vs Web Comparison</h1>
  <div class="comparison">
    <div>
      <h2>Figma (Reference)</h2>
      <img src="figma-render.png" />
    </div>
    <div>
      <h2>Web (Generated)</h2>
      <img src="web-render.png" />
    </div>
  </div>
</body>
</html>
```

---

## Dashboard Architecture

### HMR & File Watching Strategy

**Challenge:** Vite's HMR system watches all files in `src/` by default. When Figma analyses complete, new files are created in `src/generated/export_figma/`, triggering full page reloads that lose analysis logs.

**Solution:** Selective file watching that separates code transformation from data loading.

```
┌─────────────────────────────────────────────────────────────┐
│                    Vite File Watching                       │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│  ✅ Watched (.tsx/.jsx)      ❌ Ignored (non-code)         │
│  - Vite transforms           - No HMR trigger              │
│  - Dynamic imports work      - No page reload              │
│                                                             │
│  Component.tsx               report.html                   │
│  chunks-fixed/*.tsx          *.png, *.jpg, *.svg           │
│                              metadata.json, metadata.xml    │
│                              *.md, *.css                    │
│                                                             │
└─────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────┐
│                    Data Loading Strategy                    │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│  ❌ Don't Use              ✅ Use Instead                   │
│                                                             │
│  import.meta.glob()        fetch('/api/export_figma')             │
│  - Creates file deps       - No file dependency            │
│  - Triggers HMR            - Manual refresh control        │
│                                                             │
│  window.location.reload()  onRefresh() callback            │
│  - Forces full reload      - Controlled refresh            │
│  - Loses component state   - Preserves state               │
│                                                             │
└─────────────────────────────────────────────────────────────┘
```

**Implementation Details:**

- **vite.config.js:** `watch.ignored` prevents HMR on non-code files
- **useExportFigmas hook:** Fetches data via API, exposes `reload()` function
- **Component tree:** Passes `onRefresh` callback from ExportFigmasPage → ExportFigmasGrid/ExportFigmasTable → ExportFigmaCard
- **DELETE handler:** Calls `onRefresh()` instead of `window.location.reload()`

**Benefits:**

1. **No reload during analysis** - Logs remain visible on `/analyze` page
2. **Dynamic imports work** - Vite transforms `.tsx/.jsx` files as needed
3. **DELETE refreshes properly** - Callback triggers API fetch, bypassing Vite cache
4. **Better UX** - No full page reload, faster, preserves scroll position

### State Management

**No Redux/Context - Local State Only**

- `useState` for component state
- `useEffect` for side effects
- Custom hooks for shared logic
- React Router for navigation state

### Data Flow

```
User Action
    ↓
Event Handler
    ↓
API Call (fetch)
    ↓
Response
    ↓
State Update (useState)
    ↓
Re-render
```

### Real-Time Updates

**Server-Sent Events (SSE):**

```javascript
// AnalysisForm.tsx
const eventSource = new EventSource(`/api/analyze/logs/${jobId}`)

eventSource.onmessage = (event) => {
  const data = JSON.parse(event.data)

  if (data.type === 'log') {
    setLogs(prev => [...prev, data.message])
  } else if (data.type === 'complete') {
    setStatus('completed')
    eventSource.close()
  }
}
```

### Theme System

**CSS Variables + localStorage:**

```typescript
// useTheme.ts
export function useTheme() {
  const [theme, setTheme] = useState<'light' | 'dark'>('light')

  useEffect(() => {
    // Load from localStorage
    const saved = localStorage.getItem('theme')
    setTheme(saved || 'light')
  }, [])

  const toggleTheme = () => {
    const newTheme = theme === 'light' ? 'dark' : 'light'
    setTheme(newTheme)
    localStorage.setItem('theme', newTheme)
    document.documentElement.classList.toggle('dark')
  }

  return { theme, toggleTheme }
}
```

### i18n System

**Context-based translations:**

```typescript
// I18nContext.tsx
export const I18nProvider = ({ children }) => {
  const [locale, setLocale] = useState('en')

  const t = (key: string) => {
    return translations[locale][key] || key
  }

  return (
    <I18nContext.Provider value={{ locale, setLocale, t }}>
      {children}
    </I18nContext.Provider>
  )
}
```

---

## Performance Considerations

### AST Processing

- **Single-pass traversal** - All transforms execute in one pass
- **Lazy loading** - Transforms loaded on demand
- **Caching** - AST parsed once, reused for all transforms

### Dashboard

- **Code splitting** - React Router lazy loading
- **Pagination** - Limit tests per page (6, 9, 12, 18, 24)
- **Image optimization** - Lazy loading with IntersectionObserver
- **Memoization** - `useMemo` for expensive calculations
- **Selective file watching** - Vite HMR ignores non-code files in `src/generated/` to prevent page reloads during analysis

### Docker

- **Volume mounts** - Hot reload without rebuild
- **Multi-stage build** - Optimized production image
- **Alpine Linux** - Minimal base image (~5MB)

---

## Security

### Input Validation

- Figma URL validation (regex)
- Node ID sanitization
- File path validation (prevent traversal)

### Docker Isolation

- Non-root user
- Read-only file system (where possible)
- Limited network access

### API Security

- Rate limiting (planned)
- CORS configuration
- Input sanitization

---

## Next Steps

- See [DEVELOPMENT.md](DEVELOPMENT.md) for developer guide
- See [TRANSFORMATIONS.md](TRANSFORMATIONS.md) for transform details
- See [API.md](API.md) for API documentation
