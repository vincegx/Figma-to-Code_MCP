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
- Navigate to preview URL (?preview=true&test={testId})
- Wait for fonts and images to load
- Capture web-render.png

**Phase 4: Output (Reports)**
- Generate metadata.json (dashboard metadata)
- Generate analysis.md (technical report with transform stats)
- Generate report.html (visual comparison: Figma vs Web)

### Directory Structure

```
scripts/
├── figma-cli.js              # Main orchestrator (MCP SDK, phases 1-4)
├── pipeline.js               # Transform pipeline executor (loads and runs transforms)
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
├── post-processing/
│   ├── organize-images.js    # Rename image hashes to Figma layer names
│   ├── fix-svg-vars.js       # Fix CSS vars in SVG path data
│   └── capture-screenshot.js # Puppeteer screenshot capture
└── reporting/
    ├── generate-metadata.js  # Dashboard metadata (nodeId, stats, timestamp)
    ├── generate-analysis.md  # Technical report (transforms, timings)
    └── generate-report.html  # Visual fidelity report (side-by-side)

src/
├── components/
│   ├── features/
│   │   ├── analysis/         # AnalysisForm (trigger analyses via API)
│   │   ├── stats/            # UsageBar (real-time API usage widget)
│   │   └── tests/            # TestCard, TestsGrid, TestsTable, PaginationControls
│   ├── pages/
│   │   ├── DashboardPage.tsx # Main dashboard with MCP status
│   │   ├── TestsPage.tsx     # Tests list (grid/list view, pagination, sorting)
│   │   ├── TestDetailPage.tsx# 4-tab detail view (Preview, Code, Report, Technical)
│   │   └── AnalyzePage.tsx   # Analysis form page
│   └── ui/                   # shadcn/ui components (Button, Card, Tabs, etc.)
├── generated/tests/          # Output directory (git-ignored)
│   └── node-{id}-{ts}/       # Each analysis creates a folder
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

**5. CSS Consolidation Strategy**
- Each chunk generates separate CSS during processing
- All chunk CSS files merged into Component-{fixed|clean}.css
- Deduplicate :root variables using Map
- Use first chunk's Google Fonts import
- Deduplicate Figma utility classes
- Remove CSS imports from individual chunks

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

### Working with the Dashboard

**Frontend stack:**
- React 19 + TypeScript + Vite
- shadcn/ui components (Radix UI + Tailwind)
- React Router (client-side routing)
- Server-Sent Events (real-time logs)

**Key components:**
- `AnalysisForm.tsx`: POST /api/analyze → jobId → SSE /api/analyze/logs/:jobId
- `TestsPage.tsx`: Lists all tests with pagination/sorting
- `TestDetailPage.tsx`: 4 tabs (Preview, Code, Report, Technical)
- `UsageBar.tsx`: GET /api/usage every 30s

**API endpoints:**
- POST /api/analyze → Start analysis (returns jobId)
- GET /api/analyze/logs/:jobId → SSE stream of logs
- GET /api/analyze/status/:jobId → Job status
- GET /api/usage → Usage statistics
- GET /api/mcp/health → MCP server health check
- DELETE /api/tests/:testId → Delete test
- GET /api/download/:testId → Download test as ZIP

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

**Reading test metadata:**
```javascript
const testDir = 'src/generated/tests/node-9-2654-1735689600'
const metadata = JSON.parse(fs.readFileSync(`${testDir}/metadata.json`, 'utf8'))
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
- All test outputs go to `src/generated/tests/node-{id}-{timestamp}/`
- Images organized with Figma layer names (not hashes)
- Chunk files use component names from metadata.xml
- CSS files always use -fixed or -clean suffix to match component

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
