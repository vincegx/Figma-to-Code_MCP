# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

MCP Figma to Code is a Figma-to-React conversion tool that transforms Figma designs into pixel-perfect React + Tailwind CSS components with 100% visual fidelity. It uses the Model Context Protocol (MCP) to connect with Figma Desktop and applies advanced AST transformations to generate production-ready code.

## Key Technologies

- **Frontend**: React 19, TypeScript, Tailwind CSS, Vite
- **Processing**: Babel (AST transformations), Puppeteer (visual validation)
- **Integration**: MCP Protocol (Figma Desktop server on port 3845)
- **Infrastructure**: Docker, Node.js 20

## Development Commands

### Starting the Application

```bash
# Start with Docker (recommended)
docker-compose up --build

# Start locally
npm install
npm run dev

# Dashboard accessible at http://localhost:5173
```

### Running Analysis

The primary workflow is through the MCP CLI:

```bash
# From Docker container
docker exec mcp-figma-v1 node scripts/figma-cli.js "https://www.figma.com/design/FILE_ID?node-id=X-Y"

# Using the bash wrapper (checks Docker status)
./cli/figma-analyze "https://www.figma.com/design/FILE_ID?node-id=X-Y"
```

### Processing Pipeline Commands

```bash
# Run unified processor (AST transformations)
node scripts/unified-processor.js <input.tsx> <output.tsx> [metadata.xml] [figmaUrl]

# Organize images from tmp/figma-assets to test folder
node scripts/post-processing/organize-images.js <testDir> <assetsDir>

# Fix SVG CSS variables
node scripts/post-processing/fix-svg-vars.js <testDir>

# Capture web screenshot for validation
node scripts/post-processing/capture-screenshot.js <testDir> <port>

# Generate reports
node scripts/reporting/generate-metadata.js <testDir> <figmaUrl> <nodeIdHyphen>
node scripts/reporting/generate-analysis.js <testDir>
node scripts/reporting/generate-report.js <testDir>
```

### Linting and Building

```bash
npm run lint
npm run build
npm run preview
```

## Architecture

### Pipeline Flow

The conversion follows a 4-phase pipeline:

1. **PHASE 1: EXTRACTION** - Via MCP tools:
   - `get_design_context` → React + Tailwind code
   - `get_screenshot` → Figma PNG for validation
   - `get_variable_defs` → Design tokens (colors, fonts)
   - `get_metadata` → XML hierarchy

2. **PHASE 2: PROCESSING** - AST transformations:
   - `organize-images.js` → Organize assets to `img/` with Figma names
   - `unified-processor.js` → Apply 10 transforms in priority order
   - `fix-svg-vars.js` → Convert CSS variables in SVG paths

3. **PHASE 3: VALIDATION**:
   - `capture-screenshot.js` → Web render via Puppeteer
   - Visual comparison (Figma vs Web)

4. **PHASE 4: OUTPUT** - Generate files:
   - `Component-fixed.tsx` → Production component
   - `Component-fixed.css` → Extracted styles + fonts
   - `metadata.json` → Dashboard metadata
   - `analysis.md` → Technical report
   - `report.html` → Visual fidelity report

### AST Transform Pipeline

Transforms run in a single pass through `scripts/pipeline.js` in priority order:

1. **font-detection** (Priority 10) - Detect fonts, convert to inline styles
2. **auto-layout** (Priority 20) - Fix Figma auto-layout classes
3. **ast-cleaning** (Priority 30) - Remove invalid Tailwind classes
4. **svg-icon-fixes** (Priority 40) - Fix SVG structure
5. **svg-consolidation** (Priority 45) - Consolidate SVG elements
6. **post-fixes** (Priority 50) - Gradient & shape fixes
7. **position-fixes** (Priority 60) - Fix positioning issues
8. **stroke-alignment** (Priority 70) - Fix stroke alignment
9. **css-vars** (Priority 80) - Convert CSS variables to values
10. **tailwind-optimizer** (Priority 90) - Optimize Tailwind classes

Each transform exports:
- `meta` - Name and priority
- `execute(ast, context)` - Transform function returning stats

### Directory Structure

```
src/
├── components/           # Dashboard UI
│   ├── HomePage.tsx      # Test list with analysis form
│   ├── TestDetail.tsx    # 4-tab detail view (Preview, Code, Report, Technical)
│   └── AnalysisForm.tsx  # Form to trigger analysis via API
├── generated/tests/      # Generated test outputs (git-ignored)
│   └── node-{nodeId}/
│       ├── Component.tsx          # Original MCP output
│       ├── Component-fixed.tsx    # Post-processed
│       ├── Component-fixed.css    # Extracted styles
│       ├── img/                   # Organized images
│       ├── chunks/                # For large designs
│       ├── chunks-fixed/          # Processed chunks
│       ├── variables.json         # Design tokens
│       ├── metadata.xml           # Figma hierarchy
│       ├── metadata.json          # Dashboard metadata
│       ├── analysis.md            # Technical report
│       ├── report.html            # Visual report
│       ├── figma-render.png       # Figma screenshot
│       └── web-render.png         # Web screenshot
scripts/
├── figma-cli.js          # Main orchestrator (uses MCP SDK)
├── pipeline.js           # Transform pipeline executor
├── config.js             # Default configuration
├── unified-processor.js  # CLI entry for processing
├── transformations/      # Modular AST transforms
├── post-processing/      # Image organization, screenshots
├── reporting/            # Report generators
└── utils/                # Chunking utilities
cli/
├── figma-analyze         # Bash wrapper for Docker
├── figma-validate        # Validation script
└── config/
    └── figma-params.json # MCP tool parameters
```

### MCP Integration

The `figma-cli.js` script connects to the Figma Desktop MCP server:

```javascript
// Connection to MCP server on host
const client = new Client({
  name: 'figma-to-code-cli',
  version: '1.0.0'
}, {
  capabilities: {}
});

const transport = new StreamableHTTPClientTransport({
  url: 'http://host.docker.internal:3845/mcp'
});
```

**Important**: The MCP Figma Desktop server must be running on port 3845 on the host machine. Docker container accesses it via `host.docker.internal`.

### Chunking System

For large designs (>25k tokens), the system automatically chunks:

1. Detects size from metadata XML
2. Extracts child nodes if needed
3. Processes each chunk with `unified-processor.js`
4. Consolidates chunks into parent component
5. Merges CSS from all chunks

Files are organized as:
- `chunks/` - Original chunk TSX files
- `chunks-fixed/` - Processed chunks
- Parent component imports and renders chunks

### Web Screenshot Capture

`capture-screenshot.js` uses Puppeteer to:
1. Launch Chromium with specific viewport dimensions
2. Navigate to preview URL with `?preview=true&test={testId}`
3. Load component-specific CSS
4. Wait for fonts and images
5. Capture PNG with matching dimensions

### Assets Management

- **MCP writes to**: `tmp/figma-assets/` (shared between host and Docker)
- **Images organized to**: `src/generated/tests/node-{id}/img/`
- **Naming**: Files renamed using Figma layer names from metadata XML

## Important Patterns

### When Processing Components

1. Always check if chunking mode is active (presence of `chunks/` directory)
2. Use metadata XML for layer names when organizing images
3. Extract CSS to separate file with Google Fonts imports
4. Preserve design tokens as CSS variables in `:root`
5. Fix CSS variables in SVG paths (they don't work in `d` attribute)

### When Adding Transforms

1. Create new transform in `scripts/transformations/`
2. Export `meta` (name, priority) and `execute` function
3. Import and add to `ALL_TRANSFORMS` in `pipeline.js`
4. Lower priority number = runs earlier
5. Return stats object with counters

### When Working with Generated Components

- Import component: `./generated/tests/{testId}/Component-fixed.tsx`
- Import CSS: `./generated/tests/{testId}/Component-fixed.css`
- Images referenced as: `./img/{figma-layer-name}.png`
- Dashboard loads components dynamically with Vite's dynamic imports

### Docker Considerations

- Docker container name: `mcp-figma-v1`
- Volumes mounted for hot reload: `src/`, `scripts/`, `cli/`
- Shared volumes: `src/generated/`, `tmp/`
- Chromium path: `/usr/bin/chromium`
- Node modules in named volume for performance

## Testing Strategy

Test files are managed in the dashboard at `http://localhost:5173`:

1. **Preview Tab** - Live component with responsive testing
2. **Code Tab** - Syntax-highlighted source code
3. **Report Tab** - HTML visual fidelity report
4. **Technical Tab** - Markdown analysis of transformations

To run a new test:
```bash
./cli/figma-analyze "https://www.figma.com/design/FILE?node-id=X-Y"
```

The dashboard automatically detects new test folders in `src/generated/tests/`.

## Common Issues

### MCP Connection Failures
- Ensure Figma Desktop app is running
- Verify MCP server on port 3845: `curl http://localhost:3845/health`
- Check Docker can reach host: `docker exec mcp-figma-v1 curl http://host.docker.internal:3845/health`

### Component Won't Render
- Check for syntax errors: `npm run lint`
- Verify CSS file exists: `ls src/generated/tests/node-{id}/Component-fixed.css`
- Check browser console for import errors
- Ensure images are in `img/` folder with correct names

### Fonts Not Loading
- Check `variables.json` has font definitions
- Verify Google Fonts import in CSS file
- Test font URL: `https://fonts.googleapis.com/css2?family={FontName}:wght@{weights}&display=swap`

### Large Files Timeout
- Chunking should be automatic
- Check metadata XML exists
- Verify child nodes detected in logs
- Manually check: `node scripts/utils/chunking.js <metadata.xml>`

## API Endpoints

The Express server (`server.js`) provides:

- `POST /api/analyze` - Start Figma analysis job
  - Body: `{ "figmaUrl": "https://..." }`
  - Returns: `{ "jobId": "job-..." }`

- `GET /api/analyze/:jobId` - Get job status and logs (SSE)
  - Streams real-time logs from figma-cli.js
  - Events: `{ type: 'log', message: '...' }`, `{ type: 'complete', result: {...} }`

Dashboard uses these endpoints in `AnalysisForm.tsx` for real-time feedback.
