# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

MCP Figma to Code - A tool that converts Figma designs into pixel-perfect React + Tailwind components using the Model Context Protocol (MCP). The system uses an adaptive processing pipeline (Simple or Chunk mode) with AST transformations to ensure visual fidelity between Figma designs and generated web components.

**Tech Stack:** React 19, TypeScript, Tailwind CSS, Vite, Express, Babel (AST), Puppeteer, Docker

## Development Commands

### Docker (Recommended)
```bash
# Start development environment (builds and starts containers)
docker-compose up --build

# Start without rebuild
docker-compose up

# Stop containers
docker-compose down

# View logs
docker logs mcp-figma-v1

# Execute commands in container
docker exec mcp-figma-v1 <command>
```

### Local Development
```bash
# Install dependencies
npm install

# Start dev server (Vite + Express API)
npm run dev

# Start API server only
npm run server

# Build production bundle
npm run build

# Preview production build
npm run preview

# Lint code
npm run lint
```

### Running Analysis

**CLI (from host):**
```bash
./cli/figma-analyze "https://www.figma.com/design/FILE_ID?node-id=X-Y"
```

**CLI (in Docker):**
```bash
docker exec mcp-figma-v1 node scripts/figma-cli.js "https://www.figma.com/design/FILE_ID?node-id=X-Y"
```

**With clean mode (generates both -fixed and -clean versions):**
```bash
docker exec mcp-figma-v1 node scripts/figma-cli.js "URL" --clean
```

**API (via dashboard):**
- Navigate to http://localhost:5173
- Paste Figma URL in the analysis form
- Click "Lancer l'analyse"

### Reprocessing Exports (Without MCP Calls)

When you need to regenerate files from an existing export without making new MCP calls to Figma:

**CLI (from host):**
```bash
# Reprocess with Tailwind version only
./cli/figma-reprocess node-8132-3793-1763118767

# Reprocess with both Tailwind + Clean versions
./cli/figma-reprocess node-8132-3793-1763118767 --clean
```

**CLI (in Docker):**
```bash
docker exec mcp-figma-v1 node scripts/figma-export-reprocess.js node-8132-3793-1763118767
docker exec mcp-figma-v1 node scripts/figma-export-reprocess.js node-8132-3793-1763118767 --clean
```

**What it does:**
- Re-runs Phase 2: AST transformations + reports generation
- Re-runs Phase 3: Web screenshot capture
- Re-runs Phase 4: Component splitting + dist package generation
- Uses existing `Component.tsx` (no MCP calls to Figma)

**Use cases:**
- Modified AST transforms and want to re-apply them
- Need to regenerate clean version with `--clean` flag
- Screenshot capture failed and you want to retry
- Update reports after modifying transform configuration

### Processing Commands

```bash
# Process a single chunk through AST pipeline
node scripts/unified-processor.js <input.tsx> <output-fixed.tsx> <metadata.xml>

# Organize images from tmp/figma-assets to test directory
node scripts/post-processing/organize-images.js <testDir>

# Capture web screenshot for visual validation
node scripts/post-processing/capture-screenshot.js <testDir> <vitePort>

# Generate reports (metadata.json, analysis.md, report.html)
node scripts/reporting/generate-metadata.js <testDir>
node scripts/reporting/generate-analysis.js <testDir>
node scripts/reporting/generate-report.js <testDir>
```

### Responsive Merge Commands

```bash
# Create responsive merge from 3 exports
node scripts/responsive-merger.js \
  --desktop 1440 node-6055-2436-1762733564 \
  --tablet 960 node-6055-2654-1762712319 \
  --mobile 420 node-6055-2872-1762733537

# Prerequisites: All 3 exports must have modular/ directory
# Run with --split-components when exporting:
./cli/figma-analyze "URL" --split-components

# Generate Puck components from responsive merge
node scripts/puck-generator.js --sourceDir <mergeDir>/Subcomponents --outputDir <mergeDir>/puck

# Generate responsive reports
node scripts/reporting/generate-responsive-report.js <mergeDir>
node scripts/reporting/generate-responsive-analysis.js <mergeDir>

# Compile responsive classes to pure CSS
node scripts/responsive-css-compiler.js <mergeDir>
```

## Code Architecture

### High-Level Pipeline

The system processes Figma designs through a 4-phase pipeline:

**Phase 1: Extraction (MCP)**
- Connect to MCP Figma Desktop server (port 3845 on host)
- Extract metadata.xml (node hierarchy)
- Extract parent-wrapper.tsx (preserves background/padding)
- Extract figma-screenshot.png (reference image)
- Extract variables.json (design tokens)
- Extract each child node as a chunk (1s delay between calls)
- Save chunks to `chunks/` directory

**Phase 2: Processing (AST)**
- Organize images from tmp/figma-assets → img/
- Process each chunk through unified-processor:
  - Parse React/JSX code into Abstract Syntax Tree
  - Apply 11 transforms in priority order (10-100)
  - Extract CSS for each chunk
- Consolidate chunks into Component-fixed.tsx
- Merge all chunk CSS into Component-fixed.css
- If --clean flag: generate Component-clean.tsx/css (production version)
- Fix CSS variables in SVG paths

**Phase 3: Validation (Visual)**
- Launch Puppeteer with exact dimensions from metadata.xml
- Navigate to preview URL (?export={exportId})
- Wait for fonts and images to load
- Capture web-render.png

**Phase 4: Output (Reports)**
- Generate metadata.json (dashboard metadata)
- Generate analysis.md (technical report with transform stats)
- Generate report.html (visual comparison: Figma vs Web)

### Responsive Merge Pipeline (Multi-Screen Fusion)

The system includes a **responsive merge** feature that combines 3 Figma exports (Desktop, Tablet, Mobile) into a single responsive component.

**Prerequisites:**
- 3 separate Figma exports (Desktop, Tablet, Mobile)
- Each export processed with `--split-components` flag
- Modular components with matching names across breakpoints

**Pipeline Phases:**

**Phase 1: Detection & Validation**
- Validate all 3 exports have `modular/` directory
- Detect common components across breakpoints
- Extract component order from Desktop `metadata.xml`
- Extract helper functions from Desktop `Component-clean.tsx`

**Phase 2: Component Merging (Responsive AST Pipeline)**
- Parse Desktop, Tablet, Mobile `.tsx` files into AST
- Run 7 responsive transforms in priority order (10-70):
  1. `detect-missing-elements` (Priority 10) - Find elements missing in tablet/mobile
  2. `normalize-identical-classes` (Priority 20) - Normalize className formatting
  3. `detect-class-conflicts` (Priority 30) - Detect className differences
  4. `merge-desktop-first` (Priority 40) - Merge classNames (Desktop base + overrides)
  5. `add-horizontal-scroll` (Priority 50) - Add overflow-x to prevent breaks
  6. `reset-dependent-properties` (Priority 60) - Reset conflicting properties
  7. `inject-visibility-classes` (Priority 70) - Add visibility classes
- Inject helper functions if needed
- Fix image paths (`./img/` → `../img/`)

**Phase 3: CSS Merging**
- Parse all 3 CSS files into sections (imports, :root, utilities, custom)
- Desktop styles = baseline (no media query)
- Tablet overrides = differences from Desktop (`@media (max-width: 960px)`)
- Mobile overrides = differences from Tablet (`@media (max-width: 420px)`)

**Phase 4: Page Generation**
- Merge Page structure from all 3 `Component-clean.tsx` files
- Replace `<div data-name="...">` with `<ComponentName />`
- Generate `Page.tsx` with component imports
- Generate `Page.css` with media queries
- Compile responsive classes to pure CSS (max-md:*, max-lg:*)
- Generate Puck-ready components for visual editor
- Create visual report + technical analysis

**Output Structure:**
```
responsive-merger-{timestamp}/
├── Page.tsx                      # Main page
├── Page.css                      # Consolidated CSS with media queries
├── Subcomponents/                # Responsive components
│   ├── Header.tsx
│   ├── Header.css
│   └── ...
├── img/                          # Images (from Desktop)
├── puck/                         # Puck editor components
│   ├── components/
│   ├── config.tsx
│   └── data.json
├── responsive-metadata.json      # Merge stats
├── responsive-analysis.md        # Technical report
└── responsive-report.html        # Visual comparison
```

**Key Scripts:**
- `scripts/responsive-merger.js` - Main orchestrator
- `scripts/responsive-pipeline.js` - Responsive AST transforms
- `scripts/responsive-transformations/` - Individual transforms
- `scripts/responsive-css-compiler.js` - Compile responsive classes to CSS
- `scripts/puck-generator.js` - Generate Puck components

**Dashboard Pages:**
- `ResponsiveMergesPage.tsx` - List all merges (grid/list view)
- `ResponsiveMergeDetailPage.tsx` - Merge detail with 4 tabs (Preview, Code, Report, Puck)
- `MergeDialog.tsx` - Create new merge dialog
- `PuckEditorPage.tsx` - Visual editor for merged components
- `ResponsivePreviewPage.tsx` - Responsive preview with breakpoint slider

**For complete documentation:** See [docs/RESPONSIVE_MERGE.md](docs/RESPONSIVE_MERGE.md)

### Directory Structure

```
scripts/
├── figma-cli.js              # Main orchestrator (MCP SDK, phases 1-4)
├── figma-export-reprocess.js # Reprocess existing exports (phases 2-4 only, no MCP)
├── responsive-merger.js      # Responsive merge orchestrator (multi-screen fusion)
├── pipeline.js               # Transform pipeline executor (loads and runs transforms)
├── responsive-pipeline.js    # Responsive transform pipeline (7 transforms)
├── unified-processor.js      # AST processor (individual chunks + consolidation)
├── config.js                 # Transform configuration (enable/disable)
├── transformations/          # AST transforms (priority 10-100)
│   ├── font-detection.js     # Priority 10: Convert font-['Font:Style'] to inline
│   ├── auto-layout.js        # Priority 20: Fix Figma auto-layout classes
│   ├── ast-cleaning.js       # Priority 30: Remove invalid Tailwind classes
│   ├── svg-icon-fixes.js     # Priority 40: Fix SVG structure/attributes
│   ├── svg-consolidation.js  # Priority 45: Consolidate nested SVGs
│   ├── post-fixes.js         # Priority 50: Gradient & shape fixes
│   ├── position-fixes.js     # Priority 60: Fix positioning issues
│   ├── stroke-alignment.js   # Priority 70: Fix stroke alignment
│   ├── css-vars.js           # Priority 80: Convert CSS vars to values
│   ├── tailwind-optimizer.js # Priority 90: Optimize arbitrary → standard
│   └── production-cleaner.js # Priority 100: Clean mode (remove debug attrs)
├── utils/
│   ├── chunking.js           # Chunk extraction & assembly logic
│   └── usage-tracker.js      # API usage monitoring (30-day history)
├── responsive-transformations/   # Responsive merge transforms (priority 10-70)
│   ├── detect-missing-elements.js     # Find missing elements in breakpoints
│   ├── normalize-identical-classes.js # Normalize className formatting
│   ├── detect-class-conflicts.js      # Detect className differences
│   ├── merge-desktop-first.js         # Merge classNames (Desktop + overrides)
│   ├── add-horizontal-scroll.js       # Add overflow-x for narrow screens
│   ├── reset-dependent-properties.js  # Reset conflicting properties
│   └── inject-visibility-classes.js   # Add visibility classes
├── responsive-css-compiler.js    # Compile responsive classes to pure CSS
├── puck-generator.js             # Generate Puck editor components
├── post-processing/
│   ├── organize-images.js    # Rename image hashes to Figma layer names
│   ├── fix-svg-vars.js       # Fix CSS vars in SVG path data
│   ├── sync-optimizer.js     # Sync CSS optimizations (Component-optimized → components/)
│   ├── component-splitter.js # Split component into modular chunks (Phase 5)
│   ├── dist-generator.js     # Generate dist/ package with organized CSS (Phase 6)
│   └── capture-screenshot.js # Puppeteer screenshot capture
└── reporting/
    ├── generate-metadata.js  # Dashboard metadata (nodeId, stats, timestamp)
    ├── generate-analysis.md  # Technical report (transforms, timings)
    ├── generate-report.html  # Visual fidelity report (side-by-side)
    ├── generate-responsive-report.js   # Responsive merge visual report
    └── generate-responsive-analysis.js # Responsive merge technical analysis

src/
├── components/
│   ├── features/
│   │   ├── analysis/         # AnalysisForm (trigger analyses via API)
│   │   ├── stats/            # UsageBar (real-time API usage widget)
│   │   ├── export_figma/     # ExportFigmaCard, ExportFigmaGrid, ExportFigmaTable, PaginationControls
│   │   └── responsive-merges/# MergeDialog, ResponsiveMergesGrid, ResponsiveMergesTable
│   ├── pages/
│   │   ├── DashboardPage.tsx # Main dashboard with MCP status
│   │   ├── ExportFigmaPage.tsx     # Export Figma list (grid/list view, pagination, sorting)
│   │   ├── ExportFigmaDetailPage.tsx# 4-tab detail view (Preview, Code, Report, Technical)
│   │   ├── AnalyzePage.tsx   # Analysis form page
│   │   ├── ResponsiveMergesPage.tsx  # Responsive merges list (grid/list view)
│   │   ├── ResponsiveMergeDetailPage.tsx # 4-tab detail (Preview, Code, Report, Puck)
│   │   ├── ResponsivePreviewPage.tsx # Responsive preview with breakpoint slider
│   │   ├── PuckEditorPage.tsx        # Puck visual editor
│   │   └── PuckRenderPage.tsx        # Puck render view
│   └── ui/                   # shadcn/ui components (Button, Card, Tabs, etc.)
├── generated/
│   ├── export_figma/         # Single-screen exports (git-ignored)
│   │   └── node-{id}-{ts}/   # Each analysis creates a folder
│       ├── Component.tsx              # Original assembled component
│       ├── Component-fixed.tsx        # Post-processed (Tailwind version)
│       ├── Component-clean.tsx        # Production version (no Tailwind)
│       ├── Component-fixed.css        # Consolidated CSS (Tailwind)
│       ├── Component-clean.css        # Production CSS (pure CSS)
│       ├── parent-wrapper.tsx         # Parent wrapper
│       ├── chunks/                    # Original chunks
│       ├── chunks-fixed/              # Processed chunks (Tailwind)
│       ├── chunks-clean/              # Production chunks (pure CSS)
│       ├── img/                       # Organized images
│       ├── metadata.xml               # Figma hierarchy
│       ├── variables.json             # Design tokens
│       ├── metadata.json              # Dashboard metadata
│       ├── analysis.md                # Technical report
│       ├── report.html                # Visual report
│       ├── figma-render.png           # Figma screenshot
│       └── web-render.png             # Web screenshot
│   └── responsive-screens/   # Responsive merges (git-ignored)
│       └── responsive-merger-{ts}/    # Each merge creates a folder
│           ├── Page.tsx               # Main page
│           ├── Page.css               # Consolidated CSS with media queries
│           ├── Subcomponents/         # Modular responsive components
│           ├── img/                   # Images (from Desktop)
│           ├── puck/                  # Puck editor components
│           ├── responsive-metadata.json # Merge stats
│           ├── responsive-analysis.md  # Technical report
│           └── responsive-report.html  # Visual comparison
└── main.tsx                  # Entry point

server.js                     # Express API server with SSE support
docker-compose.yml            # Docker configuration (port 5173, MCP access)
Dockerfile                    # Alpine Linux + Chromium + Node.js
```

### Key Architectural Concepts

**1. Adaptive Processing Modes**
- **Simple Mode** - For small, valid designs (4 MCP calls total)
  - Direct processing of full component code
  - No chunking required
- **Chunk Mode** - For large/complex designs (5+N MCP calls)
  - Parent wrapper extracted first (preserves layout context)
  - Child nodes extracted from metadata.xml
  - Each chunk processed individually with full AST pipeline
  - Chunks assembled into parent component with imports
  - CSS from all chunks merged into single file
- Mode automatically selected based on code validity and size

**2. Single-Pass AST Pipeline**
- Parse code once → AST
- Sort transforms by priority (10 → 100)
- Execute all transforms in one traversal (performance)
- Generate optimized code from modified AST
- Extract CSS during processing
- All transforms implement: `{ meta: { name, priority }, execute(ast, context) }`

**3. Dual Output Modes**
- **Component-fixed.tsx/css**: Tailwind-based (requires safelist config)
  - Uses Tailwind utilities (`flex`, `bg-white`)
  - Uses arbitrary values (`bg-[#f0d9b5]`, `w-[480px]`)
  - Includes debug attributes (`data-name`, `data-node-id`)
  - Best for Tailwind projects

- **Component-clean.tsx/css**: Production-ready (zero dependencies)
  - Pure CSS classes (`.bg-custom-beige`, `.w-custom-480`)
  - No debug attributes
  - Works anywhere (copy/paste ready)
  - Generated when --clean flag is used

**4. MCP Integration**
- Connects to Figma Desktop MCP server via HTTP transport
- Host: `host.docker.internal:3845` (Docker) or `localhost:3845` (host)
- Tools used:
  - `get_metadata(nodeId)` → XML hierarchy
  - `get_design_context(nodeId, forceCode: true)` → React/Tailwind code
  - `get_screenshot(nodeId)` → PNG image
  - `get_variable_defs(nodeId)` → Design tokens
- 1 second delay between `get_design_context` calls (rate limiting)

**5. CSS Processing Pipeline (6 Phases)**

The CSS pipeline processes styles through 6 distinct phases:

**Phase 1: Chunk Processing**
- Input: `chunks/*.tsx` (raw Figma output)
- Process: Apply AST transforms → Extract CSS
- Output: `chunks-fixed/*.css` (individual component CSS with optimizations)

**Phase 2: Consolidation**
- Input: `chunks-fixed/*.css` (multiple files)
- Process: Merge all CSS, deduplicate `:root` variables, combine utilities
- Uses Map for variables (last value wins), Set for utilities (exact match)
- Output: `Component-fixed.css` (single consolidated file)

**Phase 3: Clean Generation**
- Input: `Component-fixed.tsx/css` (Tailwind version with debug attrs)
- Process: Remove `data-name`/`data-node-id` attributes, convert Tailwind → pure CSS classes
- Output: `Component-clean.tsx/css` (production-ready, no dependencies)

**Phase 4: Optimization** *(NEW - Jan 2025)*
- Input: `Component-clean.tsx/css` (unoptimized)
- Process: `sync-optimizer.js` transforms both TSX + CSS with **same transformMap**:
  - Map color classes: `bg-custom-9dffb9` → `bg-brand`
  - Map spacing: `px-custom-80` → `px-20` (Tailwind equivalents ±2px tolerance)
  - Round decimals: `h-custom-29dot268` → `h-custom-29`
- Output: `Component-optimized.tsx/css` (synchronized, optimized classes)
- **Key:** Uses single transformMap for both files to prevent TSX/CSS desynchronization

**Phase 5: Component Splitting** (if `--split-components` flag)
- Input: `Component-optimized.tsx/css`
- Process: `component-splitter.js`:
  - Extract React function components
  - Extract semantic sections (Header, Footer, *Section, *Overview, *Actions)
  - Filter CSS per component (only used classes)
  - **Buffer save fix** (lines 628-631): Flush final buffer to prevent last CSS rule loss
- Output: `components/*.tsx` + `*.css` (modular files for responsive merge)

**Phase 6: Dist Package Generation** (if `--split-components` flag)
- Input: `components/*.tsx` + `*.css`
- Process: `dist-generator.js`:
  - Copy TSX files to `dist/components/`
  - **Reorganize CSS** via `reorganizeComponentCSS()` (generic section-based approach)
  - Generate `dist/Page.tsx` with component imports
  - Copy images to `dist/img/`
- Output: `dist/` package (copy-paste ready for production)

**Key Features:**
- **Synchronization** - Phase 4 ensures TSX + CSS classes match via shared transformMap
- **Buffer Management** - Phase 5 saves final buffer (prevents last rule loss, fixed border-w-* bug)
- **Generic Organization** - Phase 6 uses section-based reorganization (no hardcoded class prefixes)

**6. Usage Tracking**
- Tracks all MCP tool calls in data/figma-usage.json
- Stores token counts from MCP responses (actual measurements)
- 30-day retention with auto-cleanup
- Calculates % of daily limit (1,200,000 tokens for Professional plan)
- Provides status levels: SAFE, GOOD, WARNING, CRITICAL, DANGER
- Accessible via GET /api/usage endpoint

## Working with the Codebase

### Adding a New Transform

1. Create file in `scripts/transformations/your-transform.js`
2. Implement the interface:
   ```javascript
   export const meta = {
     name: 'your-transform',
     priority: 55  // Choose appropriate priority (10-100)
   }

   export function execute(ast, context) {
     // Modify AST in place using Babel traverse
     // Return stats: { itemsProcessed, executionTime, ... }
   }
   ```
3. Import in `scripts/pipeline.js` and add to `ALL_TRANSFORMS`
4. Test with: `node scripts/unified-processor.js <input> <output> <metadata>`
5. Configure in `scripts/config.js` (enable/disable)

### Modifying the Processing Pipeline

**Entry point:** `scripts/figma-cli.js` (main orchestrator)
- Phase 1 (lines ~200-400): MCP extraction
- Phase 2 (lines ~400-600): AST processing loop
- Phase 3 (lines ~600-700): Visual validation
- Phase 4 (lines ~700-800): Report generation

**AST processing:** `scripts/unified-processor.js`
- Detects processing mode:
  - **Simple mode**: chunks/ directory absent → process Component.tsx directly
  - **Chunk mode**: chunks/ directory present → process each chunk, then consolidate
- Always generates reports regardless of mode

**Transform pipeline:** `scripts/pipeline.js`
- `runPipeline(sourceCode, contextData, config)` → { code, css, stats }
- Loads transforms, sorts by priority, executes in order
- Shares context between transforms (stats, analysis data)

### Working with CSS Organization

#### CSS Processing Pipeline

The system processes CSS through 6 distinct phases (see [Key Architectural Concepts](#key-architectural-concepts) → CSS Processing Pipeline for details):

1. **Chunk Processing** - Individual component CSS extraction
2. **Consolidation** - Merge + deduplicate
3. **Clean Generation** - Remove debug attrs, pure CSS
4. **Optimization** - sync-optimizer.js (color/spacing mapping, decimal rounding)
5. **Component Splitting** - Modular files with scoped CSS
6. **Dist Generation** - Organized CSS for production

#### sync-optimizer.js (Phase 4 - NEW Jan 2025)

**Purpose:** Synchronize CSS optimizations between TSX and CSS files to prevent class name mismatches.

**Problem Solved:**
In previous versions, CSS classes were optimized (`bg-custom-9dffb9` → `bg-brand`) but TSX files still referenced old class names, causing styling to break.

**Solution:**
Build a single `transformMap` by analyzing CSS, then apply **same map** to both TSX and CSS:

```javascript
// 1. Build transform map from CSS
const transformMap = await buildTransformMap(cssCode)
// Map: bg-custom-9dffb9 → bg-brand, px-custom-80 → px-20, etc.

// 2. Transform CSS with map
let optimizedCSS = await transformCSS(cssCode, transformMap)

// 3. Transform TSX with SAME map (synchronization!)
let optimizedTSX = await transformTSX(tsxCode, transformMap)

// 4. Validate: ensure TSX classes exist in CSS
const validation = validateSync(optimizedTSX, optimizedCSS, transformMap)
```

**Transformations Applied:**
- **Color mapping** - `bg-custom-9dffb9` → `bg-brand` (uses :root variables)
- **Spacing mapping** - `px-custom-80` → `px-20` (Tailwind equivalents with ±2px tolerance)
- **Decimal rounding** - `h-custom-29dot268` → `h-custom-29`

**Files:**
- Input: `Component-clean.tsx/css`
- Output: `Component-optimized.tsx/css`
- Script: `scripts/post-processing/sync-optimizer.js`

#### dist-generator.js - CSS Reorganization (Phase 6)

**Purpose:** Organize component CSS files in dist/ package with logical section ordering.

**Generic Section-Based Approach** *(Rewritten Jan 2025)*

The `reorganizeComponentCSS()` function uses a **generic section detection** strategy instead of hardcoded class-prefix rules:

**How it works:**
```javascript
// 1. Detect sections by comment headers
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

// 2. Parse CSS line by line
for (const line of lines) {
  // Detect section comment: /* Color Classes */
  if (line.match(/^\/\* (.*?) \*\/$/)) {
    const commentText = match[1]
    currentSection = findMappedSection(commentText, sectionMap)
  }

  // Buffer lines under current section
  currentSectionBuffer.push(line)
}

// 3. Output sections in logical order
// Header → Imports → :root → Utilities → Fonts → Colors →
// Dimensions → Spacing → Typography → Layout → Other
```

**Why This Approach?**

❌ **Old approach (strict class-prefix categorization):**
- Problem: `border-w-2-0-0` misclassified as "Colors" (starts with `border-`)
- Fragile: Many edge cases, hard to maintain

✅ **New approach (generic section detection):**
- Detects existing sections by comment headers
- Maps sections to logical categories
- **Preserves all classes** without re-categorization
- No edge cases (doesn't parse individual class names)

**Example Output:**
```css
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

**Files:**
- Input: `components/*.css`
- Output: `dist/components/*.css` (reorganized)
- Script: `scripts/post-processing/dist-generator.js` (lines 62-207)

#### component-splitter.js - Buffer Management (Phase 5)

**Bug Fix (Jan 2025):** Last CSS rule in file was lost during `filterCSSClasses()`.

**Problem:**
```css
/* Before Fix */
.border-w-0-0-1 { border-width: 0 0 1px 0; }
.border-w-0-1-1-0 { border-width: 0 1px 1px 0; }
.border-w-2-0-0 { border-width: 2px 0 0 0; }  ← LOST (last rule not saved)
```

**Root Cause:**
```javascript
// filterCSSClasses() loop
for (const line of lines) {
  if (line.startsWith('.')) {
    // Save previous buffer
    if (currentRule.length > 0) {
      filteredLines.push(...currentRule)
    }
    currentRule = [line]
  } else {
    currentRule.push(line)
  }
}
// ❌ Loop ends here - last currentRule never saved!
```

**Fix (lines 628-631):**
```javascript
// Save any remaining buffer (last rule in file)
if (keepCurrentRule && currentRule.length > 0) {
  filteredLines.push(...currentRule);
}

return filteredLines.join('\n');
```

**Result:** All CSS rules now preserved, including last rule (`border-w-2-0-0` no longer lost).

**Files:**
- Script: `scripts/post-processing/component-splitter.js` (lines 628-631)

### Working with the Dashboard

**Frontend stack:**
- React 19 + TypeScript + Vite
- shadcn/ui components (Radix UI + Tailwind)
- React Router (client-side routing)
- Server-Sent Events (real-time logs)

#### HMR Configuration

**Important:** Vite is configured with selective file watching to prevent page reloads during analysis:

```javascript
// vite.config.js
server: {
  watch: {
    ignored: [
      '**/src/generated/**/*.html',
      '**/src/generated/**/*.png',
      '**/src/generated/**/*.jpg',
      '**/src/generated/**/*.svg',
      '**/src/generated/**/*.json',
      '**/src/generated/**/*.xml',
      '**/src/generated/**/*.md',
      '**/src/generated/**/*.css',
    ]
  }
}
```

**Why This Matters:**

- **Problem:** When Figma analyses complete, new files are created in `src/generated/export_figma/`. Vite's HMR detects these and triggers a full page reload, losing all analysis logs on `/analyze` page.
- **Solution:** Ignore non-code files (HTML, images, JSON, CSS) to prevent HMR triggers.
- **Critical:** `.tsx` and `.jsx` files are NOT ignored - Vite must watch and transform them for dynamic imports to work.

**Architecture:**

- **Data Loading:** Components use `fetch('/api/export_figma')` instead of `import.meta.glob` to avoid file dependencies.
- **Refresh Mechanism:** DELETE operations call `onRefresh()` callback instead of `window.location.reload()`.
- **Component Chain:** ExportFigmaPage → ExportFigmaGrid/ExportFigmaTable → ExportFigmaCard all pass `reload()` function via `onRefresh` prop.

**When modifying dashboard code:**
- Never add `.tsx` or `.jsx` to `watch.ignored`
- Use API endpoints for data fetching, not file system imports
- Use callback props (`onRefresh`) for refresh operations, not `window.location.reload()`

**Key components:**
- `AnalysisForm.tsx`: POST /api/analyze → jobId → SSE /api/analyze/logs/:jobId
- `ExportFigmaPage.tsx`: Lists all exports with pagination/sorting
- `ExportFigmaDetailPage.tsx`: 4 tabs (Preview, Code, Report, Technical)
- `UsageBar.tsx`: GET /api/usage every 30s

**API endpoints:**
- POST /api/analyze → Start analysis (returns jobId)
- GET /api/analyze/logs/:jobId → SSE stream of logs
- GET /api/analyze/status/:jobId → Job status
- GET /api/usage → Usage statistics
- GET /api/mcp/health → MCP server health check
- DELETE /api/export_figma/:exportId → Delete export
- GET /api/download/:exportId → Download export as ZIP
- POST /api/responsive-merges → Create responsive merge
- GET /api/responsive-merges → List all merges
- GET /api/responsive-merges/logs/:jobId → SSE stream of merge logs
- GET /api/responsive-merges/:mergeId/data → Get merge metadata + analysis
- GET /api/responsive-merges/:mergeId/puck-config → Get Puck configuration
- GET /api/responsive-merges/:mergeId/puck-data → Get Puck data
- POST /api/responsive-merges/:mergeId/puck-save → Save Puck data
- DELETE /api/responsive-merges/:mergeId → Delete merge
- GET /api/responsive-merges/:mergeId/download → Download merge as ZIP

### Docker Environment

**Container name:** `mcp-figma-v1`
**Base image:** Alpine Linux
**Installed:** Node.js 20, Chromium (for Puppeteer)

**Port mapping:**
- Host 5173 → Container 5173 (Vite dev server + API)

**Volume mounts:**
- `./src:/app/src` (hot reload)
- `./scripts:/app/scripts` (hot reload)
- `./server.js:/app/server.js` (hot reload)
- `./src/generated:/app/src/generated` (shared outputs)
- `./tmp:/app/tmp` (MCP assets)
- `./data:/app/data` (usage tracking)

**MCP access:**
- `extra_hosts: host.docker.internal:host-gateway`
- MCP server runs on host at port 3845
- Container accesses via `http://host.docker.internal:3845/mcp`

**Environment variables:**
- `PROJECT_ROOT`: Absolute path on host (for MCP asset writes)
- `PUPPETEER_EXECUTABLE_PATH`: /usr/bin/chromium
- `MCP_SERVER_PORT`: 3845

### Common Patterns

**Reading export metadata:**
```javascript
const exportDir = 'src/generated/export_figma/node-9-2654-1735689600'
const metadata = JSON.parse(fs.readFileSync(`${exportDir}/metadata.json`, 'utf8'))
// metadata: { nodeId, nodeName, timestamp, stats: { totalNodes, imagesCount, ... } }
```

**Running transforms:**
```javascript
import { runPipeline } from './pipeline.js'

const sourceCode = fs.readFileSync('Component.tsx', 'utf8')
const result = await runPipeline(sourceCode, { testDir, metadataPath }, config)
// result: { code, css, stats, analysis }

fs.writeFileSync('Component-fixed.tsx', result.code)
fs.writeFileSync('Component-fixed.css', result.css)
```

**Connecting to MCP:**
```javascript
import { Client } from '@modelcontextprotocol/sdk/client/index.js'
import { StreamableHTTPClientTransport } from '@modelcontextprotocol/sdk/client/streamableHttp.js'

const transport = new StreamableHTTPClientTransport({
  url: 'http://host.docker.internal:3845/mcp'
})

const client = new Client({ name: 'figma-cli', version: '1.0.0' }, { capabilities: {} })
await client.connect(transport)

const result = await client.callTool({
  name: 'get_design_context',
  arguments: { nodeId: '9:2654', forceCode: true }
})
```

**Tracking MCP usage:**
```javascript
import { UsageTracker } from './utils/usage-tracker.js'

const tracker = new UsageTracker()
await tracker.trackCall('get_design_context', { tokens: 1234 }) // Use actual token count from response
const usage = tracker.getUsage() // { today: { ... }, historical: [...], status: { ... } }
```

**Creating responsive merge:**
```javascript
// API call
const response = await fetch('/api/responsive-merges', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    desktop: { size: '1440', exportId: 'node-6055-2436-1762733564' },
    tablet: { size: '960', exportId: 'node-6055-2654-1762712319' },
    mobile: { size: '420', exportId: 'node-6055-2872-1762733537' }
  })
})

const { jobId, mergeId } = await response.json()

// Stream logs via SSE
const eventSource = new EventSource(`/api/responsive-merges/logs/${jobId}`)
eventSource.onmessage = (event) => {
  const data = JSON.parse(event.data)
  if (data.type === 'log') console.log(data.message)
  if (data.type === 'done') {
    console.log('Merge completed:', data.success)
    eventSource.close()
  }
}
```

**Loading responsive merge data:**
```javascript
const mergeId = 'responsive-merger-1736762400000'
const response = await fetch(`/api/responsive-merges/${mergeId}/data`)
const { metadata, analysis } = await response.json()

// metadata: { breakpoints, components, transformations, ... }
// analysis: "# Responsive Merge Analysis\n..."
```

## Important Notes

### MCP Server Requirements
- Figma Desktop app must be running
- MCP server must be accessible on port 3845
- From Docker: `host.docker.internal:3845`
- From host: `localhost:3845`
- Verify connection: `curl http://localhost:3845/mcp` (even 400 error means server responds)

### Rate Limiting
- 1 second delay between `get_design_context` calls (enforced in figma-cli.js)
- Figma API has account-level rate limits (Professional plan: 1,200,000 tokens/day)
- Usage tracking provides estimates based on actual token measurements

### File Paths
- All export outputs go to `src/generated/export_figma/node-{id}-{timestamp}/`
- Images organized with Figma layer names (not hashes)
- Chunk files use component names from metadata.xml
- CSS files always use -fixed or -clean suffix to match component

### Vite HMR Configuration
- Vite is configured to ignore non-code files in `src/generated/` to prevent page reloads during analysis (see [vite.config.js:8-22](vite.config.js#L8-L22))
- **Critical:** `.tsx` and `.jsx` files are NOT ignored - Vite must watch and transform them for dynamic imports
- Components use `fetch('/api/export_figma')` instead of `import.meta.glob` to avoid file dependencies
- DELETE operations use `onRefresh()` callback instead of `window.location.reload()` for proper refresh
- See "Working with the Dashboard" section for full architecture details

### Testing
- Always test transforms with real Figma designs
- Use both simple and complex designs
- Verify visual fidelity in report.html
- Check both -fixed (Tailwind) and -clean (production) outputs
- Monitor usage tracking to avoid hitting API limits

### Troubleshooting
- **MCP connection failed**: Check Figma Desktop is running, verify port 3845
- **Images not appearing**: Run `organize-images.js`, check metadata.xml has layer names
- **Fonts not loading**: Check variables.json, verify Google Fonts import in CSS
- **Chunks not consolidating**: Only applies in Chunk Mode; check if design triggered chunking (large/complex), verify chunks/ directory exists and metadata.xml structure
- **Screenshot failed**: Check Puppeteer/Chromium installed, verify preview URL accessible
- **Usage tracking issues**: Check data/figma-usage.json exists and is valid JSON
- **CSS classes missing in components/**: Classes exist in Component-optimized.css but not in components/*.css. This was a bug fixed in Jan 2025 - ensure you're using latest version with sync-optimizer.js
- **Last CSS rule missing in dist/ files**: Fixed in Jan 2025 (component-splitter.js lines 628-631). Update to latest version or manually add buffer save after filterCSSClasses() loop
- **TSX/CSS class name mismatch**: Component styled incorrectly after optimization. Caused by desynchronization between TSX and CSS. Run sync-optimizer.js to apply same transformMap to both files
- **border-w-* classes misclassified**: Fixed in Jan 2025 (dist-generator.js). Update to generic section-based reorganizeComponentCSS() instead of strict prefix categorization
- **Overlay elements losing absolute positioning**: Fixed in Jan 2025 (position-fixes.js lines 296-330). Update to version with parent aria-hidden detection
- **Responsive merge: "Missing modular/ directory"**: Export was not split. Re-export with `--split-components` flag
- **Responsive merge: "No common components found"**: Component names don't match across breakpoints. Ensure Figma layer names are identical
- **Responsive merge: "Invalid breakpoint order"**: Breakpoint widths must be descending (Desktop > Tablet > Mobile)
- **Responsive merge: CSS classes not compiling**: Check `responsive-css-compiler.js` is running, verify `Page.css` includes compiled classes
- **Responsive merge: Puck editor not loading**: Check `puck/config.tsx` exists and `puck/data.json` is valid JSON
- **Responsive merge: Images not loading in subcomponents**: Images copied from Desktop only, subcomponents use `../img/` path
