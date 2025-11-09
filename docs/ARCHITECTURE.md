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
│   │   │   ├── TestsPage.tsx        # Tests grid/list
│   │   │   └── TestDetailPage.tsx   # 4-tab detail view
│   │   ├── features/                # Feature-based components
│   │   │   ├── analysis/
│   │   │   │   └── AnalysisForm.tsx # Form + SSE logs
│   │   │   ├── tests/
│   │   │   │   ├── TestCard.tsx     # Grid item
│   │   │   │   ├── TestsGrid.tsx    # Grid layout
│   │   │   │   ├── TestsTable.tsx   # Table layout
│   │   │   │   ├── ControlsBar.tsx  # View/sort controls
│   │   │   │   └── PaginationControls.tsx
│   │   │   └── stats/
│   │   │       └── UsageBar.tsx     # API usage widget
│   │   └── common/                  # Shared components
│   │       ├── ThemeToggle.tsx      # Dark/light theme
│   │       └── LanguageSwitcher.tsx # i18n switcher
│   ├── 📁 hooks/                    # React hooks
│   │   ├── useTests.ts              # Tests data fetching
│   │   ├── useMcpHealth.ts          # MCP health check
│   │   └── useTheme.ts              # Theme management
│   ├── 📁 i18n/                     # Internationalization
│   │   ├── I18nContext.tsx          # i18n provider
│   │   └── translations/
│   │       ├── en.json
│   │       └── fr.json
│   ├── 📁 lib/                      # Utilities
│   │   └── utils.ts                 # cn() helper, etc.
│   ├── 📁 generated/tests/          # Output directory (git-ignored)
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
   - `TestsPage` (container) fetches data
   - `TestsGrid` (presentation) renders UI

3. **Custom Hooks**
   - `useTests()` - Test data fetching
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
│   └── DELETE /api/tests/:testId
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

## CSS Consolidation

### Strategy

When processing chunks, CSS is consolidated using this approach:

1. **Per-Chunk CSS**
   - Each chunk generates separate CSS during processing
   - Saved as `chunks-fixed/{name}.css`

2. **Merging Process**
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

3. **Deduplication Rules**
   - `:root` variables: Last value wins (Map)
   - Utility classes: Exact match deduplication (Set)
   - Google Fonts: Use first chunk's import

4. **Output**
   ```css
   /* Component-fixed.css */
   @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;600&display=swap');

   :root {
     --colors-primary: #7C3AED;    /* Deduplicated */
     --spacing-lg: 32px;           /* From chunk 1 */
     --spacing-xl: 64px;           /* From chunk 2 */
   }

   .content-start { align-content: flex-start; }  /* Deduplicated */
   ```

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

**Challenge:** Vite's HMR system watches all files in `src/` by default. When Figma analyses complete, new files are created in `src/generated/tests/`, triggering full page reloads that lose analysis logs.

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
│  import.meta.glob()        fetch('/api/tests')             │
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
- **useTests hook:** Fetches data via API, exposes `reload()` function
- **Component tree:** Passes `onRefresh` callback from TestsPage → TestsGrid/TestsTable → TestCard
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
