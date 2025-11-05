# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

**MCP Figma to Code V1** - A dashboard application that analyzes Figma designs via Model Context Protocol (MCP) and generates React + Tailwind components with 100% visual fidelity.

The system extracts design data from Figma, processes it through an AST-based transformation pipeline, and generates production-ready React components with comprehensive validation reports.

## Prerequisites

- **MCP Figma Desktop** server running on port 3845 (on host machine)
- **Docker** and **Docker Compose** installed
- Node.js environment for local development (optional)

## Common Commands

### Docker Workflow (Recommended)

```bash
# Start the application
docker-compose up --build

# Access the dashboard
# http://localhost:5173

# Stop the container
docker-compose down

# Execute commands inside container
docker exec mcp-figma-v1 <command>
```

### Local Development (Alternative)

```bash
# Install dependencies
npm install

# Start development server
npm run dev

# Build for production
npm build

# Lint code
npm run lint

# Preview production build
npm run preview
```

### Analyzing Figma Designs

**Option 1: Slash Command** (recommended in Claude Code)
```bash
/analyze-mcp https://www.figma.com/design/...?node-id=X-Y
```

**Option 2: Direct CLI**
```bash
./cli/figma-analyze "https://www.figma.com/design/...?node-id=X-Y"
```

**Full Workflow** (see .claude/commands/analyze-mcp.md):
1. **Phase 1**: MCP extraction (health check → parallel extraction → save files)
2. **Phase 2**: Post-processing (organize images → unified processor → fix SVG vars)
3. **Phase 3**: Validation (screenshot capture → visual comparison)
4. **Phase 4**: Reporting (metadata.json → analysis.md → report.html)

**Performance:** Optimized with Write tool (84% faster than bash heredoc)
- Simple design: ~10-15s
- Complex design (chunking): ~25-40s

**Error Handling:**
- Health check runs before any extraction
- Chunk validation prevents corrupted files
- Actionable error messages with recovery steps
- Early exit on rate limits with user prompt

## Architecture

### High-Level Flow

1. **Extraction** (Phase 1): MCP tools retrieve design data from Figma (design context, screenshots, variables, metadata)
2. **Processing** (Phase 2): AST-based transformations fix and optimize the generated code
3. **Validation** (Phase 3): Visual comparison between Figma screenshot and web render
4. **Output**: React component + CSS + metadata + analysis reports

### Key Directories

```
src/
├── components/           # React UI components for the dashboard
│   ├── HomePage.tsx     # Test list view
│   └── TestDetail.tsx   # Test detail with 4 tabs (Preview, Code, Report, Technical)
├── generated/tests/     # Generated test outputs (one folder per analysis)
│   └── node-{nodeId}-{timestamp}/   # Each test contains (e.g., node-104-13741-1735689600):
│       ├── Component.tsx         # Original generated component
│       ├── Component-fixed.tsx   # Post-processed component
│       ├── Component-fixed.css   # Extracted CSS (fonts, variables)
│       ├── parent-wrapper.tsx    # Parent wrapper (for chunking: preserves bg, padding, data-*)
│       ├── chunks/               # Child node chunks (only in chunking mode)
│       ├── chunks-fixed/         # Processed chunks (only in chunking mode)
│       ├── img/                  # Images organized by Figma names
│       ├── variables.json        # Figma variables (colors, spacing, fonts)
│       ├── metadata.xml          # Design hierarchy
│       ├── metadata.json         # Test metadata for dashboard
│       ├── analysis.md           # Technical analysis report
│       ├── report.html           # Visual fidelity report
│       ├── figma-render.png      # Screenshot from Figma
│       └── web-render.png        # Screenshot from web render

scripts/
├── figma-cli.js                   # Core MCP extraction orchestrator (health check, validation, chunking)
├── unified-processor.js           # Main entry point (CLI, CSS generation, safety net)
├── pipeline.js                    # Simple transform orchestrator (92 lines)
├── config.js                      # Transform configuration (enable/disable)
│
├── transformations/               # AST transformations (1 file = 1 transform)
│   ├── font-detection.js          # Priority 0: Convert font-[...] to inline styles + fontPostScriptName
│   ├── auto-layout.js             # Priority 5: Fix missing gap, alignments, sizing (NEW)
│   ├── ast-cleaning.js            # Priority 10: Clean invalid classes, add utilities
│   ├── svg-icon-fixes.js          # Priority 20: Flatten and inline SVG composites
│   ├── post-fixes.js              # Priority 25: Fix gradients, blend modes, shadows, text-transform
│   ├── position-fixes.js          # Priority 28: Convert absolute to relative (NEW)
│   ├── stroke-alignment.js        # Priority 29: Handle INSIDE/OUTSIDE strokes (NEW)
│   ├── css-vars.js                # Priority 30: Convert CSS variables to values
│   └── tailwind-optimizer.js      # Priority 40: Optimize Tailwind (runs last)
│
├── post-processing/               # Pre/post-processing scripts
│   ├── organize-images.js         # Organize images (pre-unified-processor)
│   ├── fix-svg-vars.js            # Fix CSS vars in SVG (post-unified-processor)
│   └── capture-screenshot.js      # Screenshot validation
│
├── reporting/                     # Report generation
│   ├── generate-metadata.js       # Generate metadata.json
│   ├── generate-analysis.js       # Generate analysis.md
│   └── generate-report.js         # Generate report.html
│
└── utils/                         # Utilities
    └── chunking.js                # Chunking for large designs (extract/assemble)
```

### Processing Pipeline (Simple Architecture)

**Single-pass AST traversal** orchestrated by [pipeline.js](scripts/pipeline.js):

1. **Parse AST** (Babel parser)
2. **Sort transforms** by priority (0 → 40)
3. **Execute each transform**:
   - Priority 0: `font-detection` (enhanced with fontPostScriptName)
   - Priority 5: `auto-layout` (fix missing gap, alignments - NEW, disabled by default)
   - Priority 10: `ast-cleaning` (clean invalid classes)
   - Priority 20: `svg-icon-fixes` (flatten and inline SVG)
   - Priority 25: `post-fixes` (gradients, shadows, text-transform)
   - Priority 28: `position-fixes` (absolute → relative - NEW, disabled by default)
   - Priority 29: `stroke-alignment` (INSIDE/OUTSIDE - NEW, disabled by default)
   - Priority 30: `css-vars` (convert variables)
   - Priority 40: `tailwind-optimizer` (optimize classes)
4. **Generate code** (Babel generator)
5. **Safety net** (regex catch-all for remaining CSS vars)
6. **CSS generation** (fonts + variables + custom classes)

**Chunking Mode**: For large designs (>25k tokens), automatically detects `chunks/` directory and processes each chunk individually, then assembles them.

**Adding a new transformation:**
1. Create `scripts/transformations/ma-regle.js`:
```javascript
import traverse from '@babel/traverse'
import * as t from '@babel/types'

export const meta = {
  name: 'ma-regle',
  priority: 35  // Between css-vars (30) and tailwind (40)
}

export function execute(ast, context) {
  let count = 0
  traverse.default(ast, {
    JSXElement(path) {
      // Your transformations here
      count++
    }
  })
  return { count }
}
```
2. Import in [pipeline.js:16](scripts/pipeline.js#L16): `import * as maRegle from './transformations/ma-regle.js'`
3. Add to `ALL_TRANSFORMS` array

That's it! No classes, no wrappers, just functions.

### MCP Integration

**Core Extraction Flow** (scripts/figma-cli.js):

1. **Health Check** (startup):
   - Test MCP server with minimal call
   - Detect rate limits, unauthorized errors
   - Exit early if server unavailable

2. **Parallel Extraction** (4 tools called simultaneously):
   - `get_design_context` - React code + Tailwind → Component.tsx
   - `get_screenshot` - Figma screenshot → figma-render.png
   - `get_variable_defs` - Design variables → variables.json
   - `get_metadata` - XML hierarchy → metadata.xml

3. **Chunking Mode** (if design too large):
   - Extract parent node → parent-wrapper.tsx
   - Extract child nodes sequentially → chunks/*.tsx
   - Validate each chunk before writing
   - Assemble chunks with parent wrapper

### Dashboard Application

React SPA with three main views:
- **HomePage**: Lists all analyzed tests with metadata cards
- **TestDetail**: Four tabs for each test:
  - Preview: Live React component with responsive testing
  - Code: Syntax-highlighted source code
  - Report: Embedded HTML fidelity report
  - Technical Analysis: Markdown technical documentation

### Visual Validation

The validation step ensures 100% fidelity:
1. Capture Figma screenshot (from MCP)
2. Capture web render screenshot (Puppeteer)
3. Compare visually (colors, spacing, fonts, gradients, shadows, etc.)
4. Apply fixes if needed

## Test Naming Convention

Tests are stored in `src/generated/tests/node-{nodeId}-{timestamp}/` where:
- `nodeId` is from the Figma URL (e.g., `104-13741` from `node-id=104-13741`)
- `timestamp` is a Unix timestamp (e.g., `1735689600`) to ensure uniqueness
- Example: `node-104-13741-1735689600`
- **Do NOT convert** the hyphen to colon in folder names for nodeId
- Conversion to colon format (`104:13741`) only happens when calling MCP tools
- Each test has a unique folder, even when analyzing the same Figma node multiple times

## Important Implementation Details

### AST Transformations

- **Simple architecture**: 11 files total (9 transformations + pipeline.js + config.js + unified-processor.js)
- **Single-pass traversal**: All transformations run in one AST parse (performance: ~33-40ms)
- **Priority-based execution**: Transforms run in order: 0 (font-detection) → 40 (tailwind-optimizer)
- **Order matters**: Font detection (priority 0) MUST run BEFORE ast-cleaning (priority 10) which removes font-[...] classes
- **Shared state**: Context object passed to all transforms, `customCSSClasses` Map cleared between runs
- **Safety net**: Regex catch-all runs after pipeline to catch edge cases
- **Each transform**: Simple pattern with `export const meta = { name, priority }` + `export function execute(ast, context)`

**New Transformations (v2.0):**
- **auto-layout.js**: Fixes missing Figma Auto Layout properties (gap, alignments, sizing)
- **position-fixes.js**: Converts absolute positioning to relative/flex for responsive layouts
- **stroke-alignment.js**: Handles INSIDE/OUTSIDE stroke alignment (CSS workarounds)
- **Enhanced font-detection**: Now parses fontPostScriptName and textStyleId for accurate weights
- **Enhanced post-fixes**: Added shadow fixes (order, spread, visibility) and text-transform

**Enable/Disable Transformations:**
Edit `scripts/config.js` to control which transformations run:
```javascript
'auto-layout': { enabled: true },      // Enable to fix Auto Layout issues
'position-fixes': { enabled: true },   // Enable to fix absolute positioning
'stroke-alignment': { enabled: true }  // Enable to fix stroke alignment
```

### Chunking Large Designs

When `get_design_context` fails due to size (>25k tokens):
1. Extract child nodes: `scripts/mcp-direct-save.js extract-nodes metadata.xml`
2. Process each node **sequentially** (one at a time), save immediately
3. Assemble chunks: `scripts/mcp-direct-save.js assemble-chunks`

**Chunking Mode Features (v2.1):**
- **Parent Wrapper Extraction**: `get_design_context` called on parent node to preserve background, padding, and all attributes
- **CSS Consolidation**: Merges CSS from all chunks, preserving multi-line class definitions
- **Chunk Validation**: Detects API errors before writing files (rate limits, unauthorized, etc.)
- **Multi-line Regex**: Uses `[\s\S]+?` to capture multi-line div attributes and CSS classes

### MCP Health Check & Validation

**Health Check** (figma-cli.js:105-134):
- Runs at startup before any MCP tool calls
- Tests server with minimal `get_variable_defs` call
- Detects "rate limit", "unauthorized", "forbidden" errors
- Exits with helpful message if server is down or rate-limited
- User prompt: "Open Figma Desktop App"

**Chunk Validation** (figma-cli.js:265-290):
- Validates each `get_design_context` response before writing to file
- Error patterns: `/rate limit exceeded/i`, `/unauthorized/i`, `/not found/i`, etc.
- Verifies response looks like React code (`import`, `export`, `function`)
- Prevents corrupted chunk files from breaking AST parsing
- Fails fast with clear error message and recovery instructions

**Why It Matters:**
- Prevents cascading failures from MCP server errors
- Saves time by detecting issues early (before post-processing)
- Provides actionable error messages to the user
- Ensures all chunk files contain valid React code

### Parent Wrapper Preservation

**Problem**: In chunking mode, parent node's background, padding, and metadata were lost.

**Solution** (figma-cli.js:229-238, unified-processor.js:119-134, chunking.js:97-112):
1. Call `get_design_context` on parent node → save to `parent-wrapper.tsx`
2. Extract opening `<div>` tag with regex: `/<div[\s\S]+?>/`
3. Use extracted wrapper in `Component-fixed.tsx` instead of `<div className="w-full">`

**Result:**
```tsx
// Before
<div className="w-full">
  <ImageText />
</div>

// After
<div className="bg-[#f0d9b5] box-border content-stretch flex flex-col items-start px-0 py-[40px] relative size-full" data-name="Home" data-node-id="168:14226">
  <ImageText />
</div>
```

**Captured Attributes:**
- `className`: All Tailwind classes (background, padding, layout, sizing)
- `data-name`: Figma layer name
- `data-node-id`: Figma node ID
- Multi-line attributes supported

### CSS Consolidation Strategy

**Single Chunk** (unified-processor.js:169-181):
- Direct copy of chunk CSS with updated header
- Preserves all formatting and structure
- ~76 lines, 29+ custom classes

**Multiple Chunks** (unified-processor.js:183-267):
- Merge by deduplicating sections:
  - Font imports (take first)
  - `:root` variables (merge unique)
  - Utility classes (`.content-start`, `.content-end`)
  - Custom classes (`.gap-margin-m`, `.px-display-container`)
- Multi-line class regex: `/^(\.[a-z0-9_-]+\s*\{[\s\S]*?\})/gm`
- Preserves CSS property formatting (indent, multi-line)

**Example Multi-line Class:**
```css
.px-display-container {
  padding-left: var(--display-container, 32px);
  padding-right: var(--display-container, 32px);
}
```

**Stats Logged:**
- CSS variables: 11
- Custom classes: 29
- Font families: "Poppins"

### Docker Networking

- Container uses `extra_hosts` to access MCP server on host via `host.docker.internal`
- Volumes mounted for hot reload (`src/`, `scripts/`) and generated files (`src/generated/`)
- Puppeteer configured with Chromium in Alpine Linux

### Slash Command

The `/analyze-mcp` command (in `.claude/commands/analyze-mcp.md`) orchestrates the full workflow:
- Phase 1: MCP extraction + save files
- Phase 2: Post-processing (organize images, unified processor, fix SVG vars, validation)
- Checklist ensures all steps completed

## Development Workflow

When modifying the codebase:

1. **Dashboard changes** (src/components/): Hot reload works automatically in Docker
2. **Script changes** (scripts/): Restart container or re-run command
3. **Transformations** (scripts/transformations/): Modify and test with unified-processor.js
4. **New tests**: Use `/analyze-mcp` command with Figma URL

## Generated Files Structure

Each test generates a complete package:
- Component code (original + fixed)
- Styling (CSS file with fonts + variables)
- Assets (organized images)
- Metadata (JSON, XML)
- Reports (Markdown technical analysis + HTML visual report)
- Validation (Figma screenshot + web screenshot)

All generated files in `src/generated/tests/` are Git-ignored and accessible from both Docker and host.
