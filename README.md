# 🎨 MCP Figma to Code

> Transform your Figma designs into pixel-perfect React + Tailwind components with **100% visual fidelity**

<div align="center">

```ascii
╔═══════════════════════════════════════════════════════════════════╗
║                                                                   ║
║     ┌─────────┐                                  ┌─────────┐      ║
║     │  FIGMA  │  ──── MCP Protocol ───────────>  │  REACT  │      ║
║     │ DESIGN  │                                  │   CODE  │      ║
║     └─────────┘                                  └─────────┘      ║
║          │  1. Extract via MCP (Chunk Mode)           │           ║
║          │  2. AST Processing Pipeline                │           ║
║          │  3. Visual Validation                      │           ║
║          └────────── 100% Fidelity ─────────────────> ┘           ║
║                                                                   ║
╚═══════════════════════════════════════════════════════════════════╝
```

[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
[![React](https://img.shields.io/badge/React-19-61DAFB?logo=react)](https://reactjs.org/)
[![TypeScript](https://img.shields.io/badge/TypeScript-5-3178C6?logo=typescript)](https://www.typescriptlang.org/)
[![Tailwind CSS](https://img.shields.io/badge/Tailwind-3-38B2AC?logo=tailwind-css)](https://tailwindcss.com/)
[![Docker](https://img.shields.io/badge/Docker-Ready-2496ED?logo=docker)](https://www.docker.com/)

[Features](#-features) • [Quick Start](#-quick-start) • [How It Works](#-how-it-works) • [Documentation](#-documentation) • [Examples](#-examples)

</div>

---

## 📸 Interface Preview

![Dashboard Interface](docs/images/image01.png)
*Interactive dashboard with test management, pagination, and real-time MCP status monitoring*

---

## ⚠️ Project Status - MVP

> **This is a Minimum Viable Product (MVP)** in active development. I will continuously improve the codebase.

### 🚀 What Works Great
- ✅ Complex Figma layouts with automatic chunking
- ✅ Gradients, shadows, blend modes, and stroke alignment
- ✅ Design token extraction (colors, fonts, spacing)
- ✅ Visual validation pipeline with Puppeteer
- ✅ Interactive dashboard with pagination and filtering
- ✅ MCP integration with real-time status monitoring

### 🔧 Known Limitations & Future Improvements
- ⚠️ Some edge cases in deeply nested components
- ⚠️ Advanced Figma features (component variants)
- ⚠️ Animation and interaction states
- ⚠️ Component library mapping

### 🤝 Contributions Welcome!

This project is **open-source** and I'd love your help to make it better! Whether you're fixing bugs, adding features, improving documentation, or reporting issues - **all contributions are welcome**.

**Ways to contribute:**
- 🐛 Report bugs and edge cases you encounter
- 💡 Suggest new features or improvements
- 🔨 Submit pull requests with fixes or enhancements
- 📚 Improve documentation and examples
- ⭐ Star the repo if you find it useful!

**Join me in building the best Figma-to-code tool!** Check the [Contributing](#-contributing) section for more details.

---

## 🌟 Features

### 🎯 Pixel-Perfect Conversion
- **100% Visual Fidelity** - Automated visual validation ensures generated code matches Figma exactly
- **Smart Chunking System** - Automatically splits large designs into manageable pieces
- **Advanced AST Processing** - 10 specialized Babel transforms optimize the generated code
- **Gradient & Shape Support** - Handles complex gradients, radial gradients, and custom shapes
- **Design Token Extraction** - Automatic CSS variables for colors, spacing, and typography

### 🚀 Production-Ready Output
- **React 19 + TypeScript** - Modern React components with full TypeScript support
- **Tailwind CSS** - Optimized utility classes with automatic cleanup
- **Google Fonts Integration** - Auto-detection and import of custom fonts with weights
- **Responsive Testing** - Built-in responsive testing interface with presets and custom widths

### 📊 Comprehensive Dashboard
- **Interactive UI** - Beautiful dashboard to manage and review all conversions
- **Pagination & Sorting** - Grid/List view with sorting by date or name
- **4-Tab Detail View** - Preview, Code (with chunks), Report, Technical Analysis
- **Real-Time MCP Status** - Visual indicator for MCP server connection
- **API Usage Monitoring** - Real-time tracking of Figma API credit estimates (Professional plan)
- **Test Management** - Delete tests, open previews, view in Figma

### 🔧 Developer Experience
- **MCP Protocol** - Leverages Model Context Protocol for seamless Figma integration
- **Docker Support** - One-command setup with Docker Compose
- **Hot Reload** - Instant feedback during development
- **Automatic Chunking** - Handles massive Figma files automatically
- **CLI + API** - Both command-line and web API for analysis

---

## 📋 Table of Contents

- [Prerequisites](#-prerequisites)
- [Quick Start](#-quick-start)
- [How It Works](#-how-it-works)
- [Usage](#-usage)
- [Architecture](#-architecture)
- [Configuration](#-configuration)
- [Troubleshooting](#-troubleshooting)
- [Contributing](#-contributing)
- [License](#-license)

---

## 🔧 Prerequisites

Before you begin, ensure you have the following installed:

| Tool | Version | Purpose |
|------|---------|---------|
| **Docker** | Latest | Container runtime (recommended) |
| **Docker Compose** | Latest | Container orchestration |
| **MCP Figma Desktop** | Latest | Figma integration server |
| **Node.js** (optional) | 20+ | For local development |

### Setting Up MCP Figma Desktop

The MCP Figma Desktop server must be running on port 3845:

```bash
# Install MCP Figma Desktop
# Follow instructions at: https://developers.figma.com/docs/figma-mcp-server/

# Start the server (it should be accessible at http://localhost:3845)
# Make sure Figma Desktop app is running
```

---

## 🚀 Quick Start

### Option 1: Docker (Recommended)

```bash
# 1. Clone the repository
git clone https://github.com/vincegx/Figma-to-Code---MCP-tools.git
cd Figma-to-Code---MCP-tools

# 2. Install dependencies (creates node_modules folder)
npm install

# 3. Build and start Docker containers
docker-compose up --build

# 4. Open your browser
# http://localhost:5173
```

**What happens during installation:**
- ✅ Installs ~619 npm packages (202MB)
- ✅ Builds Docker image with Chromium for screenshots
- ✅ Creates Docker volumes for hot reload and generated files
- ✅ Starts container with MCP connectivity to host (port 3845)
- ✅ Dashboard accessible at http://localhost:5173
- ✅ Backend API running at http://localhost:5173/api

**Verify installation:**
```bash
# Check container is running
docker ps | grep mcp-figma

# Check logs
docker logs mcp-figma-v1

# Test CLI tool
docker exec mcp-figma-v1 /app/cli/figma-analyze
```

That's it! 🎉 The dashboard is now running.

### Option 2: Local Development

```bash
# 1. Clone the repository
git clone https://github.com/vincegx/Figma-to-Code---MCP-tools.git
cd Figma-to-Code---MCP-tools

# 2. Install dependencies
npm install

# 3. Start the dev server
npm run dev

# 4. Open your browser
# http://localhost:5173
```

**Note:** Local development requires:
- Node.js 20+
- Chromium/Chrome installed for screenshot capture
- MCP Figma Desktop server running on port 3845

### 🔍 Verify MCP Connection

After installation, verify the MCP server connection:

```bash
# From host (macOS)
curl http://localhost:3845/mcp

# From Docker container
docker exec mcp-figma-v1 wget -O- http://host.docker.internal:3845/mcp
```

You should see a response (even if it's a 400 error - that means the server is responding).

### 📁 Important Directories

After installation, these directories are created:

```
.
├── src/generated/          # Generated test outputs (git-ignored)
│   └── tests/
│       └── node-{id}/     # Each test has its own folder
├── tmp/                    # Temporary assets from MCP
│   └── figma-assets/      # Images downloaded by MCP Desktop
├── data/                   # Usage tracking data
│   └── figma-usage.json   # API call counts & credit estimates (30-day retention)
└── node_modules/          # Dependencies (202MB)
```

### ⚠️ Troubleshooting Installation

**Port 5173 already in use:**
```bash
# Change port in docker-compose.yml
ports:
  - "5174:5173"  # Use 5174 instead
```

**Container name conflict:**
```bash
# Change container name in docker-compose.yml
container_name: mcp-figma-custom-name
```

**MCP connection failed:**
- Ensure Figma Desktop app is running
- Verify MCP server is on port 3845: `curl http://localhost:3845/mcp`
- Check firewall settings allow Docker to access host

---

## 🎯 How It Works

The conversion follows a **systematic chunk-based pipeline** in 4 phases:

```ascii
┌─────────────────────────────────────────────────────────────────┐
│                    FIGMA TO CODE PIPELINE                       │
│                   (Systematic Chunk Mode)                       │
└─────────────────────────────────────────────────────────────────┘

    ┌─────────────┐
    │   PHASE 1   │  EXTRACTION (MCP Server)
    │  📥 Figma   │
    └──────┬──────┘
           │
           ├─► get_metadata          → XML hierarchy
           ├─► get_screenshot        → Figma PNG (reference)
           ├─► get_variable_defs     → Design tokens (colors, fonts)
           ├─► get_design_context    → Parent wrapper
           └─► For each child node:
               ├─ get_design_context → Chunk TSX
               └─ Wait 1s (rate limit)
           │
           ▼
    ┌─────────────┐
    │   PHASE 2   │  PROCESSING
    │  ⚙️  AST    │
    └──────┬──────┘
           │
           ├─► organize-images       → img/ folder with Figma names
           ├─► For each chunk:
           │   ├─ unified-processor  → Apply 10 AST transforms
           │   └─ Extract CSS        → Chunk-specific CSS
           ├─► Consolidate chunks    → Component-fixed.tsx
           ├─► Merge CSS             → Component-fixed.css
           └─► fix-svg-vars          → Fix CSS vars in SVG paths
           │
           ▼
    ┌─────────────┐
    │   PHASE 3   │  VALIDATION
    │  ✅ Visual  │
    └──────┬──────┘
           │
           ├─► capture-screenshot    → Web render PNG
           └─► Visual comparison     → Figma vs Web
           │
           ▼
    ┌─────────────┐
    │   PHASE 4   │  OUTPUT
    │  📦 Files   │
    └──────┬──────┘
           │
           ├─► Component-fixed.tsx    → Production component
           ├─► Component-fixed.css    → Consolidated CSS + fonts
           ├─► chunks-fixed/          → Processed chunks
           ├─► img/                   → Organized images
           ├─► metadata.json          → Dashboard metadata
           ├─► analysis.md            → Technical report
           ├─► report.html            → Visual fidelity report
           ├─► figma-render.png       → Reference screenshot
           └─► web-render.png         → Web screenshot
```

### 🔬 Processing Details

#### 1. **Systematic Chunk Mode**
All designs are processed in chunk mode for consistency:
- Parent wrapper extracted to preserve background/padding
- Child nodes extracted from metadata.xml
- Each chunk processed with `get_design_context` (1s delay between calls)
- If no children, the root node is processed as a single chunk
- Chunks assembled into parent component with proper imports

#### 2. **Single-Pass AST Pipeline**
10 transforms run in a single traversal for optimal performance:

| Priority | Transform | Purpose |
|----------|-----------|---------|
| 10 | **font-detection** | Convert `font-['Font:Style']` to inline styles |
| 20 | **auto-layout** | Fix Figma auto-layout classes |
| 30 | **ast-cleaning** | Remove invalid Tailwind classes |
| 40 | **svg-icon-fixes** | Fix SVG structure and attributes |
| 45 | **svg-consolidation** | Consolidate nested SVG elements |
| 50 | **post-fixes** | Gradient & shape fixes |
| 60 | **position-fixes** | Fix positioning issues |
| 70 | **stroke-alignment** | Fix stroke alignment |
| 80 | **css-vars** | Convert CSS variables to values |
| 90 | **tailwind-optimizer** | Optimize arbitrary → standard classes |

#### 3. **CSS Consolidation**
- Each chunk generates its own CSS during processing
- All chunk CSS files are merged into single `Component-fixed.css`
- Deduplicates `:root` variables and custom classes
- Preserves Google Fonts import from first chunk
- Removes CSS imports from individual chunks

#### 4. **Visual Validation**
Ensures 100% fidelity by:
- Capturing Figma's official screenshot (via MCP)
- Rendering the component in Puppeteer with exact dimensions
- Visual side-by-side comparison in report.html
- Automatic dimension detection from metadata.xml

---

## 💻 Usage

### Method 1: Dashboard Web UI (Recommended) ⭐

The easiest way to use this tool is through the **web dashboard**:

#### 1. Start the Application

```bash
# Using Docker
docker-compose up

# The dashboard will be available at:
http://localhost:5173
```

#### 2. Check MCP Connection

Look for the status indicator in the top-left:
- **🟢 MCP Connected** - Ready to analyze
- **🔴 MCP Disconnected** - Check Figma Desktop is running

#### 3. Launch an Analysis

Use the analysis form at the top of the homepage:
1. Paste your Figma URL (format: `https://www.figma.com/design/FILE_ID?node-id=X-Y`)
2. Click "Lancer l'analyse"
3. Watch real-time logs in the modal
4. When complete, your test appears in the dashboard

#### 4. View Results

Click on any test card to see:

**🎨 Preview Tab** - Live component with responsive testing (320px → 1920px)

![Preview Tab](docs/images/image02.png)
*Interactive preview with responsive testing sliders and presets*

**💻 Code Tab** - Navigate between all files (Component, CSS, chunks)

![Code Tab](docs/images/image04.png)
*Syntax-highlighted code view with file navigation between components and chunks*

**📊 Report Tab** - Visual fidelity report with Figma vs Web comparison

![Report Tab](docs/images/image03.png)
*Visual comparison between Figma design and generated web component*

**🔧 Technical Tab** - Detailed analysis of all transformations

#### 5. Manage Tests

- **Preview** - Open in new window with `?preview=true`
- **Delete** - Remove test from dashboard
- **Figma** - Open original design in Figma
- **Pagination** - Navigate through tests (6, 9, 12, 18, or 24 per page)
- **Sorting** - Sort by date or name (ascending/descending)
- **View Mode** - Switch between Grid and List view

#### 6. Monitor API Usage 📊

The dashboard includes a real-time **Usage Bar** that tracks your Figma API consumption:

**Visual Indicator with Progress Bar:**
- 🟢 **SAFE** (<10%) - Plenty of quota remaining
- 🟢 **GOOD** (10-50%) - Moderate usage
- 🟡 **WARNING** (50-80%) - High usage
- 🟠 **CRITICAL** (80-95%) - Near limit
- 🔴 **DANGER** (>95%) - Likely exceeded limit

**Hover for Detailed Tooltip:**
- **Credit Estimates** - Min, Typical, Max ranges
- **API Call Breakdown** - Calls per MCP tool (get_design_context, get_screenshot, etc.)
- **7-Day History** - Visual chart of daily usage
- **Today's Stats** - Total calls and analyses count

**Important Notes:**
- ⚠️ **Estimates Only** - Credit consumption is calculated based on conservative estimates from Figma documentation
- 📊 **Professional Plan** - Configured for Figma Professional plan (1,200,000 credits/day)
- 🔢 **Actual vs Estimate** - Real credit usage may vary; these are approximations to help you monitor activity
- 📁 **Data Storage** - Usage tracked in `data/figma-usage.json` (30-day retention, auto-cleanup)
- 🔄 **Auto-Refresh** - Updates every 30 seconds

**Credit Estimates per Tool:**
```javascript
get_metadata:        50-100 credits
get_variable_defs:   50-100 credits
get_design_context:  50-5,000 credits (varies by complexity)
get_screenshot:      200-500 credits
```

**Why Estimates?**
Figma doesn't provide real-time credit consumption via API. Our system tracks exact call counts and applies conservative estimates based on documented ranges. Large designs with `get_design_context` can vary significantly (50 to 5,000 credits per call).

### Method 2: CLI (Direct Container) 🔧

Execute analysis directly in the Docker container:

```bash
# Run analysis
docker exec mcp-figma-v1 node scripts/figma-cli.js \
  "https://www.figma.com/design/FILE_ID?node-id=X-Y"

# The script will:
# 1. Connect to MCP server
# 2. Extract design data (chunks mode)
# 3. Process each chunk with AST pipeline
# 4. Consolidate and generate reports
# 5. Capture web screenshot

# Output location:
# src/generated/tests/node-X-Y-TIMESTAMP/
```

### Method 3: Bash Wrapper (Host) 📝

Use the bash wrapper from your host machine:

```bash
# From project root
./cli/figma-analyze "https://www.figma.com/design/FILE_ID?node-id=X-Y"

# The wrapper:
# - Checks if Docker is running
# - Executes figma-cli.js in container
# - Shows progress and results
```

### What You Get

After analysis completes, each test folder contains:

```
src/generated/tests/node-9-2654-1735689600/
├── Component.tsx              # Original assembled component
├── Component-fixed.tsx        # Post-processed production component
├── Component-fixed.css        # Consolidated CSS with fonts + variables
├── parent-wrapper.tsx         # Original parent wrapper
├── img/                       # Images organized with Figma names
│   ├── image-layer-name-1.png
│   └── image-layer-name-2.svg
├── chunks/                    # Original chunks
│   ├── Header.tsx
│   └── Footer.tsx
├── chunks-fixed/              # Processed chunks
│   ├── Header.tsx
│   ├── Header.css
│   ├── Footer.tsx
│   └── Footer.css
├── variables.json             # Design tokens from Figma
├── metadata.xml               # Figma hierarchy
├── metadata.json              # Dashboard metadata
├── analysis.md                # Technical report
├── report.html                # Visual fidelity report
├── figma-render.png           # Figma screenshot (reference)
└── web-render.png             # Web screenshot (validation)
```

---

## 🏗️ Architecture

### Project Structure

```
mcp-figma-to-code/
├── 📁 src/
│   ├── 📁 components/          # Dashboard UI components
│   │   ├── HomePage.tsx        # Test list with pagination & sorting
│   │   ├── TestDetail.tsx      # 4-tab detail view (Preview, Code, Report, Technical)
│   │   ├── AnalysisForm.tsx    # Form to trigger analysis via API
│   │   └── UsageBar.tsx        # Real-time API usage monitoring widget
│   ├── 📁 generated/tests/     # Generated outputs (git-ignored)
│   │   └── node-{nodeId}-{ts}/ # One folder per analysis
│   │       ├── Component.tsx            # Original assembled
│   │       ├── Component-fixed.tsx      # Post-processed
│   │       ├── Component-fixed.css      # Consolidated CSS
│   │       ├── parent-wrapper.tsx       # Parent wrapper
│   │       ├── 📁 img/                  # Organized images
│   │       ├── 📁 chunks/               # Original chunks
│   │       ├── 📁 chunks-fixed/         # Processed chunks
│   │       ├── variables.json           # Design tokens
│   │       ├── metadata.xml             # Figma hierarchy
│   │       ├── metadata.json            # Dashboard metadata
│   │       ├── analysis.md              # Technical report
│   │       ├── report.html              # Visual report
│   │       ├── figma-render.png         # Figma screenshot
│   │       └── web-render.png           # Web screenshot
│   ├── App.tsx
│   └── main.tsx
├── 📁 scripts/                 # Processing pipeline
│   ├── figma-cli.js            # Main orchestrator (MCP SDK)
│   ├── pipeline.js             # Transform pipeline executor
│   ├── config.js               # Default configuration
│   ├── unified-processor.js    # CLI entry for processing
│   ├── 📁 transformations/     # Modular AST transforms (10)
│   │   ├── font-detection.js
│   │   ├── auto-layout.js
│   │   ├── ast-cleaning.js
│   │   ├── svg-icon-fixes.js
│   │   ├── svg-consolidation.js
│   │   ├── post-fixes.js
│   │   ├── position-fixes.js
│   │   ├── stroke-alignment.js
│   │   ├── css-vars.js
│   │   └── tailwind-optimizer.js
│   ├── 📁 post-processing/     # Image & screenshot processing
│   │   ├── organize-images.js
│   │   ├── fix-svg-vars.js
│   │   └── capture-screenshot.js
│   ├── 📁 reporting/           # Report generators
│   │   ├── generate-metadata.js
│   │   ├── generate-analysis.js
│   │   └── generate-report.js
│   └── 📁 utils/               # Utilities
│       ├── chunking.js         # Chunk extraction & assembly
│       └── usage-tracker.js    # API usage monitoring (30-day history)
├── 📁 cli/                     # Bash wrappers
│   ├── figma-analyze           # Main wrapper
│   ├── figma-validate          # Validation script
│   └── 📁 config/
│       └── figma-params.json   # MCP tool parameters
├── 📁 data/                    # Usage tracking data (git-ignored)
│   └── figma-usage.json        # API call counts & credit estimates (30-day retention)
├── server.js                   # Express API server with SSE support
├── docker-compose.yml
├── Dockerfile
├── package.json
├── CLAUDE.md                   # AI assistant guidance
└── README.md                   # This file
```

### Tech Stack

| Layer | Technology |
|-------|------------|
| **Frontend** | React 19, TypeScript, Tailwind CSS, Vite |
| **Processing** | Babel (AST), Puppeteer (screenshots) |
| **Integration** | MCP Protocol, Figma Desktop API |
| **Backend** | Express (API), Server-Sent Events (SSE) |
| **Infrastructure** | Docker, Docker Compose, Alpine Linux |
| **Code Quality** | ESLint, React Hooks Linting |

### Key Components

#### figma-cli.js - Main Orchestrator

The core script that orchestrates the entire pipeline:

```javascript
// Phase 0: Preparation
- Create test directory (node-X-Y-TIMESTAMP)
- Clean assets directory (tmp/figma-assets)

// Phase 1: Extraction (Systematic Chunk Mode)
- Connect to MCP server (http://host.docker.internal:3845/mcp)
- Get metadata.xml (node hierarchy)
- Get parent-wrapper.tsx (preserve background/padding)
- Get figma-screenshot.png
- Get variables.json
- Extract child nodes from metadata.xml
- For each node: get_design_context (wait 1s between calls)
- Save chunks to chunks/ directory
- Assemble Component.tsx from chunks

// Phase 2: Post-Processing
- Organize images (tmp/figma-assets → img/)
- Run unified-processor on each chunk:
  * Apply 10 AST transforms
  * Extract CSS for each chunk
- Consolidate chunks into Component-fixed.tsx
- Merge all CSS into Component-fixed.css
- Remove CSS imports from individual chunks
- Fix CSS vars in SVG paths

// Phase 3: Capture Web Render
- Launch Puppeteer with exact dimensions from metadata.xml
- Navigate to preview URL (?preview=true&test={testId})
- Wait for fonts and images to load
- Capture web-render.png

// Phase 4: Generate Reports
- metadata.json (dashboard metadata)
- analysis.md (technical report)
- report.html (visual comparison)
```

#### unified-processor.js - AST Processor

Handles both individual chunks and chunking mode:

```javascript
// Detect mode
if (chunks/ directory exists && not processing a chunk) {
  // CHUNKING MODE
  - Process each chunk individually
  - Generate Component-fixed.tsx with imports
  - Consolidate CSS from all chunks
  - Remove CSS imports from chunks
  - Aggregate stats from all chunks
} else {
  // INDIVIDUAL CHUNK MODE
  - Parse AST with Babel
  - Run transform pipeline (10 transforms in priority order)
  - Apply safety net (catch-all regex for CSS vars)
  - Generate separate CSS file
  - Add React + CSS imports
  - Save stats to .stats.json (for aggregation)
}

// Always generate reports (metadata.json, analysis.md, report.html)
```

#### Dashboard API - Express Server

```javascript
// API Endpoints
POST /api/analyze
- Body: { figmaUrl: "https://..." }
- Spawns figma-cli.js child process
- Returns: { jobId: "job-..." }

GET /api/analyze/:jobId
- Server-Sent Events (SSE)
- Streams real-time logs from figma-cli.js
- Events: { type: 'log', message: '...' }
- Complete: { type: 'complete', result: {...} }

GET /api/mcp/health
- Checks MCP server connection
- Returns: 200 (connected) or 503 (disconnected)

GET /api/usage
- Retrieves Figma API usage statistics
- Returns: { today: {...}, historical: [...], status: {...} }
- Includes: exact call counts, credit estimates, 7-day history
- Auto-refreshes every 30 seconds in dashboard

DELETE /api/tests/:testId
- Deletes test directory
- Returns: 200 (success) or 404 (not found)
```

### MCP Integration

The system connects to Figma Desktop MCP server:

```javascript
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StreamableHTTPClientTransport } from '@modelcontextprotocol/sdk/client/streamableHttp.js';

const transport = new StreamableHTTPClientTransport({
  url: 'http://host.docker.internal:3845/mcp'
});

const client = new Client({
  name: 'figma-cli',
  version: '1.0.0'
}, { capabilities: {} });

await client.connect(transport);

// Available MCP tools:
// - get_design_context (nodeId, forceCode: true)
// - get_screenshot (nodeId)
// - get_variable_defs (nodeId)
// - get_metadata (nodeId)
```

**Important**:
- MCP server must be running on port 3845 on host
- Docker container accesses it via `host.docker.internal`
- Requires Figma Desktop app to be open and logged in
- 1 second delay between `get_design_context` calls to avoid rate limits

### Transform Pipeline

All transforms implement this interface:

```javascript
export const meta = {
  name: 'transform-name',
  priority: 50  // Lower = runs earlier
}

export function execute(ast, context) {
  // Modify AST in place
  traverse(ast, {
    JSXElement(path) {
      // Your transformation logic
    }
  })

  // Return stats
  return {
    itemsProcessed: 42,
    executionTime: Date.now() - start
  }
}
```

Transforms run in a **single pass** through the AST for performance:

1. Parse code → AST
2. Sort transforms by priority
3. Execute each transform on the same AST
4. Generate code from modified AST

### Chunking System

**Systematic Chunk Mode** (always enabled):

```javascript
// 1. Extract metadata
const metadata = await mcp.get_metadata(nodeId)
fs.writeFileSync('metadata.xml', metadata)

// 2. Extract child nodes
const nodes = chunking.extractNodes('metadata.xml')
// Returns: [{ id: '9:2654', name: 'Header' }, ...]

// 3. Get parent wrapper
const wrapper = await mcp.get_design_context(nodeId, { forceCode: true })
fs.writeFileSync('parent-wrapper.tsx', wrapper)

// 4. For each child node
for (const node of nodes) {
  const chunk = await mcp.get_design_context(node.id, { forceCode: true })
  fs.writeFileSync(`chunks/${node.name}.tsx`, chunk)
  await sleep(1000) // Rate limit
}

// 5. Assemble
chunking.assembleChunks(testDir, 'Component', chunkFiles)
// Generates Component.tsx with imports:
// import Header from './chunks-fixed/Header';
// <Header />
```

---

## ⚙️ Configuration

### Environment Variables

Create a `.env` file (optional):

```env
# Development
NODE_ENV=development

# Puppeteer
PUPPETEER_EXECUTABLE_PATH=/usr/bin/chromium

# MCP Server (if different from default)
MCP_SERVER_HOST=host.docker.internal
MCP_SERVER_PORT=3845

# API Server
PORT=3000
```

### Docker Configuration

The `docker-compose.yml` uses:
- **Port 5173**: Dashboard access
- **Port 3000**: API server
- **Volumes**: Hot reload for `src/`, `scripts/`, `cli/`
- **Shared volumes**: `src/generated/`, `tmp/`
- **extra_hosts**: Access to MCP server via `host.docker.internal`

### MCP Tool Parameters

Customize MCP tool behavior in `cli/config/figma-params.json`:

```json
{
  "mcpServer": {
    "url": "http://host.docker.internal:3845/mcp"
  },
  "commonParams": {
    "renderImages": true,
    "dirForAssetWrites": "/app/tmp/figma-assets",
    "includeComponentSetNames": false,
    "respectTextAutoResize": true,
    "respectFillStyleID": true,
    "forceCode": true
  },
  "directories": {
    "testsOutput": "src/generated/tests"
  },
  "docker": {
    "vitePort": 5173
  }
}
```

### Transform Configuration

Enable/disable transforms in `scripts/config.js`:

```javascript
export const defaultConfig = {
  // Transform toggles
  'font-detection': { enabled: true },
  'auto-layout': { enabled: true },
  'ast-cleaning': { enabled: true },
  'svg-icon-fixes': { enabled: true },
  'svg-consolidation': { enabled: true },
  'post-fixes': { enabled: true },
  'position-fixes': { enabled: true },
  'stroke-alignment': { enabled: true },
  'css-vars': { enabled: true },
  'tailwind-optimizer': { enabled: true },

  // Error handling
  continueOnError: false
}
```

---

## 📸 Examples

### Input: Figma Design
```
https://www.figma.com/design/ABC123?node-id=104-13741
```

### Output: React Component

**Component-fixed.tsx**
```tsx
import React from 'react';
import './Component-fixed.css';
import Header from './chunks-fixed/Header';
import Footer from './chunks-fixed/Footer';

export default function HomePage() {
  return (
    <div className="flex min-h-screen w-full flex-col items-start bg-white">
      <Header />
      <main className="flex flex-1 flex-col items-center gap-8 px-12 py-16">
        <h1 className="text-5xl font-bold text-gray-900">
          Welcome to Our Product
        </h1>
        <p className="text-lg text-gray-600 max-w-2xl text-center">
          Build amazing experiences with pixel-perfect designs
        </p>
      </main>
      <Footer />
    </div>
  );
}
```

**Component-fixed.css**
```css
/* Auto-generated design tokens from Figma (consolidated from 2 chunks) */
@import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;600;700&display=swap');

:root {
  /* Colors */
  --colors-primary: #7C3AED;
  --colors-gray-900: #111827;
  --colors-gray-600: #4B5563;

  /* Spacing */
  --spacing-lg: 32px;
  --spacing-xl: 64px;
}

/* Figma-specific utility classes */
.content-start {
  align-content: flex-start;
}

/* Custom classes for Figma variables (consolidated) */
.bg-primary { background-color: var(--colors-primary, #7C3AED); }
```

**chunks-fixed/Header.tsx**
```tsx
import React from 'react';

export default function Header() {
  return (
    <header className="flex w-full items-center justify-between px-12 py-6 bg-white border-b border-gray-200">
      <div className="text-2xl font-bold text-gray-900">Logo</div>
      <nav className="flex gap-6">
        <a href="#" className="text-gray-600 hover:text-gray-900">Home</a>
        <a href="#" className="text-gray-600 hover:text-gray-900">About</a>
      </nav>
    </header>
  );
}
```

### Dashboard Preview

```ascii
┌──────────────────────────────────────────────────────────────┐
│  🎨 Figma Code Exporter          🟢 MCP Connected  📄 12 tests│
├──────────────────────────────────────────────────────────────┤
│                                                              │
│  ┌──────────────────────────────────────────────┐           │
│  │  📝 Nouvelle analyse                         │           │
│  │  [https://www.figma.com/design/...]         │           │
│  │  [Lancer l'analyse]                          │           │
│  └──────────────────────────────────────────────┘           │
│                                                              │
│  Vue: [Grid] [List]  Trier: [Date ▼]  Par page: [9]       │
│                                                              │
│  ┌───────────┐  ┌───────────┐  ┌───────────┐               │
│  │ 🎨        │  │ 🎨        │  │ 🎨        │               │
│  │ Hero      │  │ Pricing   │  │ Footer    │               │
│  │ Section   │  │ Cards     │  │ Component │               │
│  │           │  │           │  │           │               │
│  │ #9-2654   │  │ #104-871  │  │ #50-123   │               │
│  │           │  │           │  │           │               │
│  │ 📦 245    │  │ 📦 189    │  │ 📦 156    │               │
│  │ 🖼️ 12     │  │ 🖼️ 8      │  │ 🖼️ 6      │               │
│  │ ⚡ 87     │  │ ⚡ 52     │  │ ⚡ 43     │               │
│  │           │  │           │  │           │               │
│  │ [Preview] │  │ [Preview] │  │ [Preview] │               │
│  │ [🗑️]     │  │ [🗑️]     │  │ [🗑️]     │               │
│  │ [Détails →]│ │ [Détails →]│ │ [Détails →]│             │
│  └───────────┘  └───────────┘  └───────────┘               │
│                                                              │
│  ◄ 1 [2] 3 4 ►   Affichage de 1 à 9 sur 12 tests          │
└──────────────────────────────────────────────────────────────┘
```

**Test Detail View:**

```ascii
┌──────────────────────────────────────────────────────────────┐
│  ← Hero Section  #9-2654                [Preview] [Figma]    │
│  📦 245 nodes  🖼️ 12 images  ⚡ 87 fixes                    │
├──────────────────────────────────────────────────────────────┤
│  [🎨 Preview] [💻 Code] [📊 Rapport] [🔧 Technical]        │
├──────────────────────────────────────────────────────────────┤
│                                                              │
│  Test Responsive    [🎯 Native] [📱 Mobile] [💻 Desktop]   │
│  ▓▓▓▓▓▓▓▓▓▓░░░░░░░░░░  1200px                              │
│                                                              │
│  ┌────────────────────────────────────────────────┐         │
│  │  [Component rendered at 1200px width]          │         │
│  │                                                │         │
│  │  Welcome to Our Product                        │         │
│  │  Build amazing experiences...                  │         │
│  │                                                │         │
│  └────────────────────────────────────────────────┘         │
│                                                              │
│  💡 Tips:                                                   │
│  • Use slider or presets to test different screen sizes     │
│  • Inspect with DevTools (F12) to see Tailwind classes      │
│  • Compare with original Figma design                        │
└──────────────────────────────────────────────────────────────┘
```

---

## 🐛 Troubleshooting

### MCP Server Not Connected

**Problem**: 🔴 MCP Disconnected in dashboard

**Solution**:
```bash
# 1. Check Figma Desktop is running
# 2. Check MCP server is accessible
curl http://localhost:3845/health

# 3. From Docker container
docker exec mcp-figma-v1 curl http://host.docker.internal:3845/health

# 4. Check Figma Desktop logs for MCP server status
```

### Analysis Fails with Rate Limit

**Problem**: `Rate limit exceeded` or `Try again later`

**Solution**:
- Wait 2-5 minutes before retrying
- Figma API has rate limits per account
- The system waits 1s between chunk extractions, but overall API quota may be hit
- Check your Figma account status

### Docker Container Won't Start

**Problem**: `Error: Cannot connect to the Docker daemon`

**Solution**:
```bash
# 1. Start Docker Desktop
# 2. Verify Docker is running
docker ps

# 3. Rebuild and restart
docker-compose down
docker-compose up --build
```

### Component Won't Load in Dashboard

**Problem**: `Error loading component` in Preview tab

**Solution**:
```bash
# 1. Check file exists
ls src/generated/tests/node-9-2654-1735689600/Component-fixed.tsx

# 2. Check for syntax errors
docker exec mcp-figma-v1 npm run lint

# 3. Check browser console for import errors (F12)

# 4. Verify CSS file exists
ls src/generated/tests/node-9-2654-1735689600/Component-fixed.css
```

### Images Not Appearing

**Problem**: Images show as broken in preview

**Solution**:
```bash
# 1. Check img/ directory
ls src/generated/tests/node-9-2654-1735689600/img/

# 2. Verify images were organized
# Should see files named with Figma layer names, not hashes

# 3. Check metadata.xml has layer names
cat src/generated/tests/node-9-2654-1735689600/metadata.xml | grep name=

# 4. Re-run image organization
docker exec mcp-figma-v1 node scripts/post-processing/organize-images.js \
  src/generated/tests/node-9-2654-1735689600
```

### Fonts Not Loading

**Problem**: Custom fonts don't appear in web render

**Solution**:
```bash
# 1. Check variables.json for font definitions
cat src/generated/tests/node-9-2654-1735689600/variables.json | grep Font

# 2. Check CSS file has Google Fonts import
head -n 5 src/generated/tests/node-9-2654-1735689600/Component-fixed.css

# 3. Verify Google Fonts URL is accessible
curl "https://fonts.googleapis.com/css2?family=Inter:wght@400;600&display=swap"

# 4. Check browser DevTools Network tab for font loading
```

### Chunks Not Consolidating

**Problem**: Component-fixed.tsx doesn't import chunks

**Solution**:
```bash
# 1. Check chunks/ directory exists and has files
ls src/generated/tests/node-9-2654-1735689600/chunks/

# 2. Check chunks-fixed/ was created
ls src/generated/tests/node-9-2654-1735689600/chunks-fixed/

# 3. Verify metadata.xml has child nodes
cat src/generated/tests/node-9-2654-1735689600/metadata.xml

# 4. Re-run processing
docker exec mcp-figma-v1 node scripts/unified-processor.js \
  src/generated/tests/node-9-2654-1735689600/Component.tsx \
  src/generated/tests/node-9-2654-1735689600/Component-fixed.tsx \
  src/generated/tests/node-9-2654-1735689600/metadata.xml
```

### Web Screenshot Not Captured

**Problem**: web-render.png is missing

**Solution**:
```bash
# 1. Check Puppeteer is installed in Docker
docker exec mcp-figma-v1 which chromium

# 2. Manually capture screenshot
docker exec mcp-figma-v1 node scripts/post-processing/capture-screenshot.js \
  src/generated/tests/node-9-2654-1735689600 5173

# 3. Check dashboard is accessible from container
docker exec mcp-figma-v1 curl http://localhost:5173

# 4. Check for Puppeteer errors in container logs
docker logs mcp-figma-v1
```

---

## 🤝 Contributing

Contributions are welcome! Here's how you can help:

### Reporting Bugs

1. Check if the issue already exists
2. Create a new issue with:
   - Clear description
   - Steps to reproduce
   - Expected vs actual behavior
   - Figma URL (if possible)
   - Screenshots of error/output

### Suggesting Features

1. Open an issue with the `enhancement` label
2. Describe the feature and use case
3. Explain why it would be valuable
4. Provide examples if applicable

### Submitting Pull Requests

```bash
# 1. Fork the repository
# 2. Create a feature branch
git checkout -b feature/amazing-feature

# 3. Make your changes
# 4. Test thoroughly
npm run lint
npm run build
docker-compose up --build

# 5. Test with real Figma designs
./cli/figma-analyze "https://www.figma.com/design/..."

# 6. Commit with clear messages
git commit -m "feat: add amazing feature"

# 7. Push to your fork
git push origin feature/amazing-feature

# 8. Open a Pull Request
```

### Development Guidelines

- Follow the existing code style (ESLint)
- Add comments for complex logic
- Update documentation for new features
- Test with multiple Figma designs (simple & complex)
- Ensure Docker build succeeds
- Update CLAUDE.md if adding new transforms or architecture changes

### Adding a New Transform

1. Create transform in `scripts/transformations/your-transform.js`
2. Export `meta` (name, priority) and `execute` function
3. Import and add to `ALL_TRANSFORMS` in `scripts/pipeline.js`
4. Test with multiple Figma designs
5. Update documentation

Example:

```javascript
// scripts/transformations/my-transform.js
import traverse from '@babel/traverse';

export const meta = {
  name: 'my-transform',
  priority: 55  // Between post-fixes (50) and position-fixes (60)
};

export function execute(ast, context) {
  let itemsProcessed = 0;

  traverse.default(ast, {
    JSXElement(path) {
      // Your transformation logic
      itemsProcessed++;
    }
  });

  return { itemsProcessed };
}
```

---

## 📚 Documentation

- **[CLAUDE.md](./CLAUDE.md)** - Guidance for AI assistants working with this codebase
- **[MCP Protocol](https://github.com/anthropics/mcp)** - Model Context Protocol documentation
- **[Figma API](https://www.figma.com/developers/api)** - Figma REST API reference
- **[Babel AST](https://babeljs.io/docs/en/babel-parser)** - AST parsing documentation
- **[Tailwind CSS](https://tailwindcss.com/docs)** - Tailwind utility classes
- **[Puppeteer](https://pptr.dev/)** - Headless browser automation

---

## 🎓 Learn More

### How the Systematic Chunk Mode Works

Every design is processed in chunk mode for consistency:

1. **Metadata Extraction**: Parse `metadata.xml` to find child nodes
2. **Parent Wrapper**: Extract parent wrapper to preserve background/padding
3. **Chunk Extraction**: For each child node, call `get_design_context` (wait 1s between calls)
4. **Individual Processing**: Each chunk goes through the full AST pipeline
5. **Consolidation**: Chunks assembled into parent component with imports
6. **CSS Merging**: All chunk CSS files merged into single consolidated CSS

Benefits:
- **Consistency**: Same process for all designs (no mode switching)
- **Scalability**: Handles designs of any size
- **Maintainability**: Single code path to maintain
- **Rate Limit Friendly**: 1s delay between API calls

### How AST Processing Works

The unified processor uses Babel to:

1. **Parse** React/JSX code into an Abstract Syntax Tree
2. **Sort** transforms by priority (10 → 90)
3. **Traverse** the tree once (performance optimization)
4. **Apply** all transformations during the single pass
5. **Generate** optimized code from the modified AST

Example transformation:

```javascript
// font-detection.js
traverse(ast, {
  JSXAttribute(path) {
    if (path.node.name.name === 'className') {
      const value = getClassNameValue(path)

      // Detect: font-['Inter:Bold']
      const fontMatch = /font-\['([^:]+):([^']+)'\]/.exec(value)
      if (fontMatch) {
        const [, family, style] = fontMatch

        // Convert to inline style
        addStyleAttribute(path.parentPath, {
          fontFamily: family,
          fontWeight: style === 'Bold' ? '700' : '400'
        })

        // Remove from className
        removeFromClassName(path, fontMatch[0])
      }
    }
  }
})
```

### Why MCP?

The Model Context Protocol enables:

- **Direct Figma Access**: No API keys or authentication needed
- **Rich Context**: Get design hierarchy, variables, and screenshots
- **Type Safety**: Structured data extraction with schema validation
- **Real-time**: Connect to live Figma Desktop session
- **Chunking Support**: Incremental extraction for large files

MCP Tools Used:

```javascript
// 1. Design hierarchy
await mcp.get_metadata({ nodeId: '9:2654' })
// Returns: XML with complete node tree

// 2. React code generation
await mcp.get_design_context({
  nodeId: '9:2654',
  renderImages: true,
  forceCode: true
})
// Returns: React + Tailwind code

// 3. Screenshot
await mcp.get_screenshot({ nodeId: '9:2654' })
// Returns: PNG image data

// 4. Design tokens
await mcp.get_variable_defs({ nodeId: '9:2654' })
// Returns: Colors, fonts, spacing variables
```

### CSS Consolidation Strategy

The system merges CSS from multiple chunks:

1. **Per-Chunk CSS**: Each chunk generates its own CSS during processing
2. **Deduplication**: Merge `:root` variables (use Map to dedupe)
3. **Font Import**: Use first chunk's Google Fonts import
4. **Utility Classes**: Deduplicate Figma-specific utilities
5. **Custom Classes**: Deduplicate custom CSS variable classes
6. **Single Output**: Write to `Component-fixed.css`
7. **Cleanup**: Remove CSS imports from individual chunks

Example:

```javascript
// Chunk 1 CSS
:root { --colors-primary: #7C3AED; }
.bg-primary { background: var(--colors-primary); }

// Chunk 2 CSS
:root { --colors-primary: #7C3AED; --colors-secondary: #3B82F6; }
.bg-primary { background: var(--colors-primary); }

// Consolidated CSS
:root {
  --colors-primary: #7C3AED;      // Deduplicated
  --colors-secondary: #3B82F6;    // Added
}
.bg-primary { background: var(--colors-primary); }  // Deduplicated
```

---

## 📄 License

This project is licensed under the **MIT License** - see the [LICENSE](LICENSE) file for details.

```
MIT License

Copyright (c) 2025 MCP Figma to Code Contributors

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all
copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
SOFTWARE.
```

---

## 🙏 Acknowledgments

- **Anthropic** - For the Model Context Protocol and Claude
- **Figma** - For the amazing design tool and MCP server
- **React Team** - For React 19
- **Tailwind Labs** - For Tailwind CSS
- **Babel Team** - For the AST tooling
- **Puppeteer Team** - For headless browser automation
- **All Contributors** - Thank you! 🎉

---

## 📞 Support

- 🐛 **Issues**: [GitHub Issues](https://github.com/vincegx/Figma-to-Code---MCP-tools/issues)
- 💬 **Discussions**: [GitHub Discussions](https://github.com/vincegx/Figma-to-Code---MCP-tools/discussions)
- 📧 **Email**: [Your contact email]

---

<div align="center">

**[⬆ Back to Top](#-mcp-figma-to-code)**

Made with ❤️ by Vince

⭐ **Star this repo** if you find it useful!

</div>
