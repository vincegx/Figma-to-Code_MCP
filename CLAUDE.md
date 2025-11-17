# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

**MCP Figma to Code** is a tool that transforms Figma designs into pixel-perfect React + Tailwind components using the Model Context Protocol (MCP). It features a 4-phase pipeline with AST transformations, visual validation, and a modern shadcn/ui dashboard.

## Essential Commands

### Docker Environment (Primary)

```bash
# Start the application (hot reload enabled)
docker-compose up --build

# Execute commands in container
docker exec mcp-figma-v1 <command>

# View logs
docker logs -f mcp-figma-v1

# Stop containers
docker-compose down
```

### CLI Tools (Execute in Docker)

```bash
# Analyze a Figma URL
./cli/figma-analyze "https://www.figma.com/design/FILE_ID?node-id=X-Y"

# Reprocess existing export (no MCP calls)
./cli/figma-reprocess <export-id>
./cli/figma-reprocess <export-id> --clean

# Merge responsive screens
./cli/figma-merge <desktop-id> <tablet-id> <mobile-id>
```

### Development Commands

```bash
# Frontend: Vite dev server (hot reload)
npm run dev

# Backend: Express API server
npm run server

# Linting
npm run lint

# Build production bundle
npm run build
```

### Reprocessing Workflow

When you need to regenerate files without making new MCP calls (useful for testing transform changes):

```bash
# Find export ID
ls src/generated/export_figma/

# Reprocess (runs Phases 2-4: AST transforms, screenshot, reports)
./cli/figma-reprocess node-{id}-{timestamp}
./cli/figma-reprocess node-{id}-{timestamp} --clean
```

## Architecture

### 4-Phase Pipeline

**Phase 1: MCP Extraction**
- Connects to Figma Desktop via MCP (port 3845)
- Extracts metadata.xml, parent-wrapper.tsx, chunks
- Saves design tokens and screenshot
- Entry point: `scripts/figma-cli.js`

**Phase 2: AST Processing**
- Organizes images: `scripts/post-processing/organize-images.js`
- Processes each chunk through pipeline: `scripts/pipeline.js`
- Applies 14 transforms in priority order (10-100)
- Consolidates chunks → `Component-fixed.tsx/css`
- Generates clean version → `Component-clean.tsx/css`
- Optimizes with `scripts/post-processing/sync-optimizer.js`

**Phase 3: Visual Validation**
- Captures web render: `scripts/post-processing/capture-screenshot.js`
- Uses Puppeteer with Chromium at exact Figma dimensions

**Phase 4: Reports & Outputs**
- Generates metadata, analysis, and visual reports
- Located in `scripts/reporting/`
- Creates dist package: `scripts/post-processing/dist-generator.js`

### AST Transform System

Transforms are located in `scripts/transformations/` and executed in priority order (lower = earlier):

| Transform | Priority | File | Purpose |
|-----------|----------|------|---------|
| add-missing-data-names | 5 | `add-missing-data-names.js` | Adds data-name attributes |
| font-detection | 10 | `font-detection.js` | Detects and normalizes fonts |
| auto-layout | 20 | `auto-layout.js` | Fixes flexbox layouts |
| ast-cleaning | 30 | `ast-cleaning.js` | Removes duplicate/unused code |
| svg-icon-fixes | 40 | `svg-icon-fixes.js` | Optimizes SVG icons |
| svg-consolidation | 45 | `svg-consolidation.js` | Consolidates SVG styles |
| post-fixes | 50 | `post-fixes.js` | Shadows, text-transform fixes |
| position-fixes | 60 | `position-fixes.js` | Converts absolute→relative positioning |
| missing-widths | 65 | `missing-widths.js` | Adds missing width properties |
| stroke-alignment | 70 | `stroke-alignment.js` | Fixes border/stroke alignment |
| css-vars | 80 | `css-vars.js` | Extracts CSS custom properties |
| tailwind-optimizer | 90 | `tailwind-optimizer.js` | Optimizes Tailwind classes |
| production-cleaner | 100 | `production-cleaner.js` | Final cleanup for production |
| extract-props | 110 | `extract-props.js` | Extracts component props |

**All transforms execute in a single AST traversal** for performance.

### Configuration

Settings are centralized in `cli/config/settings.json`:

- **MCP settings**: Server URL, call delays
- **Generation settings**: Chunking, output modes
- **Transform toggles**: Enable/disable individual transforms
- **UI settings**: Default views, pagination
- **Docker settings**: Container name

**To modify transform behavior**, edit `cli/config/settings.json` under the `transforms` key.

### Project Structure

```
scripts/
├── figma-cli.js                 # Main orchestrator (Phase 1)
├── pipeline.js                  # Transform executor (Phase 2)
├── config.js                    # DEPRECATED - uses settings-loader.js
├── unified-processor.js         # AST processor CLI
├── transformations/             # AST transforms (14 files)
├── post-processing/             # Phase 2-3 scripts
│   ├── organize-images.js
│   ├── sync-optimizer.js        # CSS/TSX synchronization
│   ├── component-splitter.js
│   ├── capture-screenshot.js
│   └── dist-generator.js
├── reporting/                   # Phase 4 reports
├── utils/                       # Shared utilities
│   ├── settings-loader.js       # Settings management
│   └── usage-tracker.js         # API usage tracking
├── responsive-transformations/  # Responsive merge transforms
└── responsive-pipeline.js       # Multi-screen merger

src/
├── components/
│   ├── ui/                      # shadcn/ui components (25+)
│   ├── layout/                  # MainLayout, SiteHeader, AppSidebar
│   ├── pages/                   # Dashboard, Analyze, ExportFigmas, ExportFigmaDetail
│   ├── features/                # Feature-specific components
│   └── common/                  # ThemeToggle, LanguageSwitcher
├── hooks/                       # useExportFigmas, useMcpHealth, useTheme
├── i18n/                        # Translations (en/fr)
└── generated/export_figma/      # Output directory (git-ignored)

cli/
├── figma-analyze               # Bash wrapper for analysis
├── figma-reprocess             # Bash wrapper for reprocessing
├── figma-merge                 # Bash wrapper for responsive merge
└── config/settings.json        # Central configuration

docs/
├── ARCHITECTURE.md             # Detailed architecture
├── DEVELOPMENT.md              # Developer guide
├── TRANSFORMATIONS.md          # Transform reference
├── RESPONSIVE_MERGE.md         # Multi-screen fusion
└── TROUBLESHOOTING.md          # Common issues
```

## Key Technical Details

### Docker Setup

- **Base image**: `node:20-bullseye-slim`
- **Chromium**: Pre-installed for Puppeteer (`/usr/bin/chromium`)
- **MCP connection**: Via `host.docker.internal:3845` (Figma Desktop runs on host)
- **Hot reload**: Vite HMR for frontend, volumes for source code
- **Container name**: `mcp-figma-v1`

### MCP Integration

The app connects to **Figma Desktop's MCP server** (not the web API):

- Default URL: `http://host.docker.internal:3845/mcp`
- Transport: Server-Sent Events (SSE)
- Tools used: `get_design_context`, `get_metadata`, `get_screenshot`
- Figma Desktop must be running for analysis to work

### Output Structure

Each analysis creates a timestamped folder in `src/generated/export_figma/`:

```
node-{id}-{timestamp}/
├── Component-fixed.tsx          # Tailwind version
├── Component-fixed.css
├── Component-clean.tsx          # Pure CSS version (if --clean)
├── Component-clean.css
├── Component-optimized.tsx      # Optimized version (sync-optimizer)
├── Component-optimized.css
├── chunks-fixed/                # Processed chunks
├── img/                         # Organized images
├── metadata.json                # Dashboard metadata
├── analysis.md                  # Technical report
├── report.html                  # Visual comparison
├── figma-render.png             # Reference screenshot
└── web-render.png               # Validation screenshot
```

### Responsive Merge

Combines 3 Figma screens (Desktop, Tablet, Mobile) into one responsive component:

- Pipeline: `scripts/responsive-pipeline.js`
- Transforms: `scripts/responsive-transformations/` (7 transforms)
- Output: `src/generated/responsive-screens/responsive-merger-{timestamp}/`
- Includes: `Page.tsx`, `Subcomponents/`, `puck/`, reports

Desktop-first approach with media queries at 960px (tablet) and 420px (mobile).

### API Server

Express server (`server.js`) provides:

- `/api/analyze` (POST) - Starts analysis, returns job ID
- `/api/analyze/:jobId/logs` (GET) - SSE endpoint for real-time logs
- `/api/analyze/:jobId/status` (GET) - Job status check
- Static file serving for dashboard

### Frontend Architecture

- **React 19** with TypeScript
- **shadcn/ui** components built on Radix UI primitives
- **React Router** for navigation
- **i18n** support (English/French)
- **Dark/Light mode** with system preference detection
- **Tailwind CSS** for styling

## Common Development Tasks

### Adding a New Transform

1. Create file in `scripts/transformations/your-transform.js`
2. Export `meta` object with name, priority, description
3. Export `execute(ast, context)` function
4. Import and register in `scripts/pipeline.js`
5. Add configuration in `cli/config/settings.json`
6. Test with reprocessing: `./cli/figma-reprocess <export-id>`

Example structure:
```javascript
export const meta = {
  name: 'your-transform',
  priority: 55, // Execute between post-fixes (50) and position-fixes (60)
  description: 'What your transform does'
}

export function execute(ast, context) {
  // Implement transformation
  return { changes: 0 } // Stats object
}
```

### Modifying Transform Configuration

Edit `cli/config/settings.json`:

```json
{
  "transforms": {
    "your-transform": {
      "enabled": true,
      "customOption": true
    }
  }
}
```

### Testing Changes

```bash
# 1. Analyze a Figma URL (creates initial export)
./cli/figma-analyze "https://www.figma.com/design/..."

# 2. Modify transform code

# 3. Reprocess without MCP calls (faster iteration)
./cli/figma-reprocess node-{id}-{timestamp}

# 4. View results in dashboard
# http://localhost:5173/export_figma/node-{id}-{timestamp}
```

### Debugging

```bash
# Check MCP connection
curl http://localhost:3845/mcp

# View container logs
docker logs -f mcp-figma-v1

# Execute node scripts directly
docker exec mcp-figma-v1 node scripts/pipeline.js

# Check lint errors
docker exec mcp-figma-v1 npm run lint
```

### Vite HMR Configuration

The app ignores non-code files in `src/generated/` to prevent page reloads during analysis (see `vite.config.js`). This allows the `/analyze` page logs to remain visible while files are being generated.

## Important Constraints

### Docker-Only Features

These features **only work inside Docker**:

- MCP connection (uses `host.docker.internal`)
- Puppeteer screenshot capture (requires Chromium)
- Full analysis pipeline

Local `npm install` is optional and only provides IDE support (IntelliSense, linting).

### Puppeteer Configuration

- **Executable**: `/usr/bin/chromium` (set in Dockerfile)
- **Skip download**: Configured in `.npmrc` (`PUPPETEER_SKIP_DOWNLOAD=true`)
- **Legacy peer deps**: Required for React 19 compatibility

### Git-Ignored Directories

- `src/generated/export_figma/` - Analysis outputs
- `src/generated/responsive-screens/` - Responsive merge outputs
- `tmp/` - Temporary assets during processing
- `data/figma-usage.json` - API usage tracking

### MCP Call Delays

To avoid rate limiting, the system adds delays between MCP calls:

- Default delay: 1000ms (configurable in `settings.json`)
- Min delay: 500ms
- Max delay: 5000ms

## Documentation References

Comprehensive guides are available in `/docs`:

- **ARCHITECTURE.md** - Detailed system architecture, 4-phase pipeline, component structure
- **DEVELOPMENT.md** - Developer guide, adding transforms, testing strategy
- **TRANSFORMATIONS.md** - Complete AST transform reference with examples
- **RESPONSIVE_MERGE.md** - Multi-screen fusion, responsive pipeline, Puck integration
- **TROUBLESHOOTING.md** - Common issues and solutions
- **API.md** - REST API & SSE endpoints documentation

## Environment Variables

```bash
# Puppeteer
PUPPETEER_EXECUTABLE_PATH=/usr/bin/chromium
PUPPETEER_SKIP_CHROMIUM_DOWNLOAD=true

# MCP Server
MCP_SERVER_HOST=host.docker.internal
MCP_SERVER_PORT=3845

# API Server
PORT=5173

# Development
NODE_ENV=development
PROJECT_ROOT=${PWD}
```

## Tech Stack Summary

**Frontend**: React 19, TypeScript, Vite, shadcn/ui, Tailwind CSS, React Router, Recharts
**Backend**: Node.js 20+, Express, Babel (AST), Puppeteer, MCP SDK
**Infrastructure**: Docker, Docker Compose, Alpine Linux, Chromium

## Performance Notes

- **Simple designs**: ~10-15s
- **Complex designs**: ~25-40s (with chunking)
- **Transform pipeline**: Single-pass AST traversal
- **Reprocessing**: Faster (skips Phase 1 MCP calls)
- **Hot reload**: Instant frontend updates via Vite HMR

## Common Pitfalls

1. **MCP not connected**: Ensure Figma Desktop is running and MCP server is on port 3845
2. **Images not appearing**: Run `organize-images.js` script
3. **Transform not running**: Check `settings.json` has `enabled: true`
4. **Puppeteer fails**: Container must have Chromium installed (verify Dockerfile)
5. **Reprocessing fails**: Ensure `Component.tsx` exists in export folder
6. **Dashboard not updating**: Check Vite watch config for ignored patterns
