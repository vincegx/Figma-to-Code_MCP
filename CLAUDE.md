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

Use the `/analyze-mcp` slash command:
```bash
/analyze-mcp https://www.figma.com/design/...?node-id=X-Y
```

This triggers the full 4-phase workflow (see .claude/commands/analyze-mcp.md for details).

**Performance:** Optimized with Write tool (84% faster than bash heredoc)
- Simple design: ~10-15s
- Complex design (chunking): ~25-40s

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
│   └── node-{nodeId}/   # Each test contains:
│       ├── Component.tsx         # Original generated component
│       ├── Component-fixed.tsx   # Post-processed component
│       ├── Component-fixed.css   # Extracted CSS (fonts, variables)
│       ├── img/                  # Images organized by Figma names
│       ├── variables.json        # Figma variables (colors, spacing, fonts)
│       ├── metadata.xml          # Design hierarchy
│       ├── metadata.json         # Test metadata for dashboard
│       ├── analysis.md           # Technical analysis report
│       ├── report.html           # Visual fidelity report
│       ├── figma-render.png      # Screenshot from Figma
│       └── web-render.png        # Screenshot from web render

scripts/
├── unified-processor.js           # Main AST processor (combines all transformations)
├── organize-images.js             # Organize images into img/ with Figma names
├── fix-svg-vars.js                # Fix CSS variables in SVG files
├── capture-web-screenshot.js      # Capture web render for validation
├── mcp-direct-save.js             # Chunking utilities for large designs
└── transformations/               # Modular AST transformations
    ├── ast-cleaning.js            # Clean invalid classes, add utilities
    ├── post-fixes.js              # Fix gradients, shapes, blend modes
    ├── css-vars.js                # Convert CSS variables to values
    ├── tailwind-optimizer.js      # Optimize Tailwind classes
    └── svg-icon-fixes.js          # Flatten and inline SVG composites
```

### Processing Pipeline (unified-processor.js)

The unified processor performs **single-pass AST traversal** with these transformations:

1. **Font Detection**: Convert `font-['FontFamily:Style']` to inline styles with fontWeight
2. **AST Cleaning**: Remove invalid classes, add `overflow-x-hidden`, fix flex sizing
3. **SVG Fixes**: Inline composite SVG logos, flatten absolute positioned image wrappers
4. **Post-Fixes**: Fix multi-stop gradients, radial gradients, shapes, verify blend modes
5. **CSS Variables**: Convert `var(--figma-var)` to actual values, optimize Tailwind
6. **Safety Net**: Regex-based catch-all for any remaining CSS vars
7. **CSS Generation**: Extract fonts (Google Fonts) + CSS custom properties to separate `.css` file

**Chunking Mode**: For large designs (>25k tokens), the processor automatically detects `chunks/` directory and processes each chunk individually, then assembles them.

### MCP Integration

Four MCP tools are called **in parallel** during extraction:

1. `mcp__figma-desktop__get_design_context` - React code + Tailwind
2. `mcp__figma-desktop__get_screenshot` - Figma screenshot (PNG)
3. `mcp__figma-desktop__get_variable_defs` - Design variables (colors, spacing, fonts)
4. `mcp__figma-desktop__get_metadata` - XML hierarchy structure

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

Tests are stored in `src/generated/tests/node-{nodeId}/` where:
- `nodeId` is from the Figma URL (e.g., `104-13741` from `node-id=104-13741`)
- **Do NOT convert** the hyphen to colon in folder names
- Conversion to colon format (`104:13741`) only happens when calling MCP tools

## Important Implementation Details

### AST Transformations

- **Single-pass traversal**: All transformations run in one AST parse (performance)
- **Order matters**: Font detection must run BEFORE cleanClasses (which removes font classes)
- **Shared state**: Clear `customCSSClasses` Map between runs to avoid memory leaks
- **Safety net**: Regex catch-all runs after AST to catch edge cases

### Chunking Large Designs

When `get_design_context` fails due to size (>25k tokens):
1. Extract child nodes: `scripts/mcp-direct-save.js extract-nodes metadata.xml`
2. Process each node **sequentially** (one at a time), save immediately
3. Assemble chunks: `scripts/mcp-direct-save.js assemble-chunks`

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
