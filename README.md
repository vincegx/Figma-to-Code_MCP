# 🎨 MCP Figma to Code

> Transform your Figma designs into pixel-perfect React + Tailwind components with **100% visual fidelity**

<div align="center">

```ascii

███████╗ ██╗  ██████╗  ███╗   ███╗  █████╗        ███╗   ███╗  ██████╗██████╗
██╔════╝ ██║ ██╔════╝  ████╗ ████║ ██╔══██╗       ████╗ ████║ ██╔════╝██╔══██╗
█████╗   ██║ ██║  ███╗ ██╔████╔██║ ███████║       ██╔████╔██║ ██║     ██████╔╝
██╔══╝   ██║ ██║   ██║ ██║╚██╔╝██║ ██╔══██║       ██║╚██╔╝██║ ██║     ██╔═══╝
██║      ██║ ╚██████╔╝ ██║ ╚═╝ ██║ ██║  ██║       ██║ ╚═╝ ██║ ╚██████╗██║
╚═╝      ╚═╝  ╚═════╝  ╚═╝     ╚═╝ ╚═╝  ╚═╝       ╚═╝     ╚═╝  ╚═════╝╚═╝
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
🔴 Design       🟣 Components      🟢 Variants      🔵 Auto Layout    🟠 Tokens
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
                    Model Context Protocol
                    🎨  Figma Design  →  ⚡ AST Processing
                    ⚛️  React + Tailwind  →  📦 Production Code
                    ✨ 100% Visual Fidelity

```

```ascii
╔═══════════════════════════════════════════════════════════════════╗
║                                                                   ║
║     ┌─────────┐                                  ┌─────────┐      ║
║     │  FIGMA  │  ──── MCP Protocol ───────────>  │  REACT  │      ║
║     │ DESIGN  │                                  │   CODE  │      ║
║     └─────────┘                                  └─────────┘      ║
║          │                                            │           ║
║          │  1. Extract Design Data                    │           ║
║          │  2. AST Processing                         │           ║
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

## ⚠️ Project Status - MVP

> **This is a Minimum Viable Product (MVP)** in active development. I will continuously improve the codebase.

### 🚀 What Works Great
- ✅ Basic to complex Figma layouts
- ✅ Gradients, shadows, and blend modes
- ✅ Design token extraction
- ✅ Visual validation pipeline
- ✅ MCP integration with Claude Code

### 🔧 Known Limitations & Future Improvements
- ⚠️ Some edge cases in complex nested components
- ⚠️ Advanced Figma features (variants, auto-layout edge cases)
- ⚠️ Animation and interaction states
- ⚠️ Component library mapping

### 🤝 We Welcome Contributions!

This project is **open-source** and we'd love your help to make it better! Whether you're fixing bugs, adding features, improving documentation, or reporting issues - **all contributions are welcome**.

**Ways to contribute:**
- 🐛 Report bugs and edge cases you encounter
- 💡 Suggest new features or improvements
- 🔨 Submit pull requests with fixes or enhancements
- 📚 Improve documentation and examples
- ⭐ Star the repo if you find it useful!

**Join us in building the best Figma-to-code tool!** Check the [Contributing](#-contributing) section for more details.

---

## 🌟 Features

### 🎯 Pixel-Perfect Conversion
- **100% Visual Fidelity** - Automated visual validation ensures the generated code matches Figma designs exactly
- **Smart AST Processing** - Advanced Babel-based transformations optimize the generated code
- **Gradient & Shape Support** - Handles complex gradients, radial gradients, and custom shapes
- **Design Token Extraction** - Automatic CSS variables for colors, spacing, and typography

### 🚀 Production-Ready Output
- **React 19 + TypeScript** - Modern React components with full TypeScript support
- **Tailwind CSS** - Optimized utility classes with automatic cleanup
- **Google Fonts Integration** - Auto-detection and import of custom fonts
- **Responsive by Default** - Built-in responsive testing interface

### 📊 Comprehensive Reports
- **Visual Comparison** - Side-by-side Figma vs Web screenshots
- **Technical Analysis** - Detailed markdown documentation of all transformations
- **Interactive Dashboard** - Beautiful UI to manage and review all your conversions
- **Fidelity Metrics** - Quantified report of processing stats and fixes applied

### 🔧 Developer Experience
- **MCP Protocol** - Leverages Model Context Protocol for seamless Figma integration
- **Docker Support** - One-command setup with Docker Compose
- **Hot Reload** - Instant feedback during development
- **Chunking for Large Designs** - Automatically handles massive Figma files

---

## 📋 Table of Contents

- [Prerequisites](#-prerequisites)
- [First-Time Setup with Claude Code](#-first-time-setup-with-claude-code)
- [Quick Start](#-quick-start)
- [How It Works](#-how-it-works)
- [Usage](#-usage)
- [Architecture](#-architecture)
- [Configuration](#-configuration)
- [Examples](#-examples)
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
| **Node.js** (optional) | 18+ | For local development |
| **Claude Code** (optional) | Latest | For `/analyze-mcp` command |

### Setting Up MCP Figma Desktop

The MCP Figma Desktop server must be running on port 3845:

```bash
# Install MCP Figma Desktop
# Follow instructions at: https://developers.figma.com/docs/figma-mcp-server/local-server-installation/

# Start the server
# The server should be accessible at http://localhost:3845
```

---

## 🎯 First-Time Setup with Claude Code

**If you're setting up this repository for the first time**, follow these steps to use the powerful `/analyze-mcp` command with Claude Code.

### 1. Install Claude Code

Claude Code is Anthropic's official CLI for Claude that enables seamless integration with this project.

```bash
# Install Claude Code
npm install -g @anthropic-ai/claude-code

# Or with Homebrew (macOS/Linux)
brew install claude-code
```

📚 **Full installation guide**: [Claude Code Documentation](https://docs.claude.com/en/docs/claude-code)

### 2. Launch Claude Code

You should launch Claude Code in this repository directory:

```bash
# Navigate to the project root
cd /path/to/mcp-figma-to-code

# Launch Claude Code
claude
```

Claude Code will start an interactive session in your terminal. You can now chat with Claude and use slash commands.

### 3. Configure MCP Server

Before using the `/analyze-mcp` command, you need to add the Figma MCP server to Claude Code.

#### Check if MCP Server is Already Configured

```bash
# Inside Claude Code, list configured MCP servers
claude mcp list
```

#### Add Figma Desktop MCP Server (if not present)

If you don't see `figma-desktop` in the list, add it:

```bash
# Add the Figma Desktop MCP server
claude mcp add --transport http figma-desktop http://127.0.0.1:3845/mcp
```

This connects Claude Code to the Figma MCP server running on your local machine (port 3845).

📚 **Learn more about MCP**: [Figma MCP Server Documentation](https://developers.figma.com/docs/figma-mcp-server/local-server-installation/)

### 4. Verify MCP Connection

Once configured, Claude Code will display the connection status:

```
✓ MCP Connected: figma-desktop
```

If you see `❌ MCP Disconnected`, ensure:
- The Figma Desktop app is running
- The MCP server is running on port 3845
- No firewall is blocking localhost connections

### 5. Use the `/analyze-mcp` Command

Now you're ready to analyze Figma designs! 🎉

```bash
# In Claude Code, use the slash command
/analyze-mcp https://www.figma.com/design/YOUR_FILE_ID?node-id=X-Y
```

**What happens next:**
1. 🎨 **Phase 1: Extraction** - Claude fetches design data, screenshot, variables, and metadata from Figma via MCP
2. ⚙️ **Phase 2: Processing** - Organizes images, applies AST transformations, fixes CSS variables
3. ✅ **Phase 3: Validation** - Captures web screenshot and compares with Figma design
4. 📦 **Phase 4: Output** - Generates React component, CSS file, reports, and metadata

### Example Workflow

```bash
# 1. Launch Claude Code in the project directory
cd /path/to/mcp-figma-to-code
claude

# 2. Analyze a Figma design
> /analyze-mcp https://www.figma.com/design/ABC123?node-id=104-13741

# Claude will process the design and generate:
# ✅ src/generated/tests/node-104-13741/Component-fixed.tsx
# ✅ src/generated/tests/node-104-13741/Component-fixed.css
# ✅ src/generated/tests/node-104-13741/img/ (organized images)
# ✅ src/generated/tests/node-104-13741/metadata.json
# ✅ src/generated/tests/node-104-13741/analysis.md
# ✅ src/generated/tests/node-104-13741/report.html
# ✅ src/generated/tests/node-104-13741/figma-render.png
# ✅ src/generated/tests/node-104-13741/web-render.png

# 3. View the result in the dashboard
# Open http://localhost:5173 (if Docker is running)
```

### Alternative: Natural Language Commands

You can also use natural language instead of the slash command:

```bash
> Analyze this Figma URL: https://www.figma.com/design/ABC123?node-id=104-13741
```

Claude will automatically detect the Figma URL and trigger the `/analyze-mcp` workflow.

---

## 🚀 Quick Start

### Option 1: Docker (Recommended)

```bash
# 1. Clone the repository
git clone https://github.com/vincegx/Figma-to-Code---MCP-tools.git
cd Figma-to-Code---MCP-tools

# 2. Start the application
docker-compose up --build

# 3. Open your browser
# http://localhost:5173
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

---

## 🎯 How It Works

```ascii
┌─────────────────────────────────────────────────────────────────┐
│                    FIGMA TO CODE PIPELINE                       │
└─────────────────────────────────────────────────────────────────┘

    ┌─────────────┐
    │   PHASE 1   │  EXTRACTION MCP SERVER (Local MCP)
    │  📥 Figma   │
    └──────┬──────┘
           │
           ├─► get_design_context    → React + Tailwind Code
           ├─► get_screenshot        → Figma PNG (validation)
           ├─► get_variable_defs     → Design Tokens (colors, fonts)
           └─► get_metadata          → XML Hierarchy
           │
           ▼
    ┌─────────────┐
    │   PHASE 2   │  PROCESSING
    │  ⚙️  AST    │
    └──────┬──────┘
           │
           ├─► organize-images       → img/ folder with Figma names
           ├─► unified-processor     → AST transformations
           │   ├─ Font detection    → Convert to inline styles
           │   ├─ Class cleaning    → Remove invalid Tailwind
           │   ├─ SVG fixes         → Flatten & inline composites
           │   ├─ Gradient fixes    → Multi-stop & radial gradients
           │   ├─ CSS variables     → Convert var(--x) to values
           │   └─ Tailwind optimize → Arbitrary → Standard classes
           └─► fix-svg-vars         → Fix SVG CSS variables
           │
           ▼
    ┌─────────────┐
    │   PHASE 3   │  VALIDATION
    │  ✅ Visual  │
    └──────┬──────┘
           │
           ├─► capture-web-screenshot → Web render PNG
           ├─► visual-comparison      → Figma vs Web
           └─► apply-fixes            → Corrections if needed
           │
           ▼
    ┌─────────────┐
    │   PHASE 4   │  OUTPUT
    │  📦 Files   │
    └──────┬──────┘
           │
           ├─► Component-fixed.tsx    → Production-ready component
           ├─► Component-fixed.css    → Fonts + CSS variables
           ├─► metadata.json          → Test metadata
           ├─► analysis.md            → Technical report
           └─► report.html            → Visual fidelity report
```

### 🔬 Processing Details

#### 1. **Single-Pass AST Traversal**
Instead of parsing the code multiple times, all transformations run in **one pass** for optimal performance:

- Font detection (before class cleaning)
- Class cleaning & optimization
- SVG structure fixes
- Gradient & shape corrections
- CSS variable conversion
- Tailwind optimization

#### 2. **Smart Chunking**
For large Figma designs (>25k tokens), the system automatically:
- Detects child nodes from metadata
- Processes each chunk sequentially
- Assembles chunks into a parent component

#### 3. **Visual Validation**
Ensures 100% fidelity by:
- Capturing Figma's official screenshot
- Rendering the component in Puppeteer
- Visual side-by-side comparison
- Automatic or manual corrections

---

## 💻 Usage

### Method 1: Claude Code Slash Command (Recommended) ⭐

**This is the easiest and most powerful way to use this tool.**

#### Prerequisites
1. Complete the [First-Time Setup with Claude Code](#-first-time-setup-with-claude-code)
2. Ensure Docker is running: `docker-compose up` (in a separate terminal)
3. Make sure the Figma Desktop app is running with MCP server on port 3845

#### Using the `/analyze-mcp` Command

Once you're in Claude Code (launched with `claude` in the project directory), simply run:

```bash
# Slash command method (recommended)
/analyze-mcp https://www.figma.com/design/YOUR_FILE?node-id=X-Y
```

**Or use natural language:**
```bash
# Natural language method
> Analyze this Figma design: https://www.figma.com/design/YOUR_FILE?node-id=X-Y
```

#### What Happens During Analysis

Claude Code will automatically:

1. **🔌 Connect to MCP** - Verifies connection to Figma Desktop MCP server
2. **📥 Extract Design** (Phase 1) - Fetches React code, screenshot, variables, and metadata via MCP
3. **⚙️ Process Code** (Phase 2) - Organizes images, runs AST transformations, fixes CSS variables
4. **✅ Validate** (Phase 3) - Captures web screenshot and compares with Figma design
5. **📦 Generate Output** (Phase 4) - Creates all files and reports

#### What You Get

After analysis completes, you'll have a complete test folder with:

- ✅ **Component-fixed.tsx** - Production-ready React component
- ✅ **Component-fixed.css** - Optimized CSS with Google Fonts + design tokens
- ✅ **img/** folder - All images organized with Figma layer names
- ✅ **metadata.json** - Test metadata for dashboard
- ✅ **analysis.md** - Technical documentation (transformations applied)
- ✅ **report.html** - Visual fidelity report with metrics
- ✅ **figma-render.png** - Figma screenshot (reference)
- ✅ **web-render.png** - Web screenshot (validation)

#### Viewing the Result

Once the analysis is complete, open the dashboard:

```bash
# The dashboard should already be running (docker-compose up)
# Open in your browser:
http://localhost:5173
```

Click on your test to see:
- 🎨 **Preview Tab** - Live component with responsive testing
- 💻 **Code Tab** - Syntax-highlighted source code
- 📊 **Report Tab** - HTML fidelity report
- 🔧 **Technical Tab** - Detailed analysis markdown

### Method 2: CLI (Advanced)

Execute the processing pipeline manually:

```bash
# Inside Docker container
docker exec mcp-figma-v1 node scripts/unified-processor.js \
  src/generated/tests/node-{nodeId}/Component.tsx \
  src/generated/tests/node-{nodeId}/Component-fixed.tsx \
  src/generated/tests/node-{nodeId}/metadata.xml \
  "https://figma.com/design/..."

# Capture web screenshot
docker exec mcp-figma-v1 node scripts/capture-web-screenshot.js \
  src/generated/tests/node-{nodeId} 5173
```

---

## 🏗️ Architecture

### Project Structure

```
mcp-figma-to-code/
├── 📁 src/
│   ├── 📁 components/          # Dashboard UI components
│   │   ├── HomePage.tsx        # Test list view
│   │   └── TestDetail.tsx      # Test detail with 4 tabs
│   ├── 📁 generated/tests/     # Generated outputs (git-ignored)
│   │   └── node-{nodeId}/      # One folder per analysis
│   │       ├── Component.tsx            # Original generated
│   │       ├── Component-fixed.tsx      # Post-processed
│   │       ├── Component-fixed.css      # Extracted styles
│   │       ├── 📁 img/                  # Organized images
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
│   ├── unified-processor.js            # Main AST processor
│   ├── organize-images.js              # Image organization
│   ├── fix-svg-vars.js                 # SVG variable fixes
│   ├── capture-web-screenshot.js       # Web screenshot capture
│   ├── mcp-direct-save.js              # Chunking utilities
│   └── 📁 transformations/             # Modular AST transforms
│       ├── ast-cleaning.js             # Class cleanup
│       ├── post-fixes.js               # Gradient/shape fixes
│       ├── css-vars.js                 # CSS variable conversion
│       ├── tailwind-optimizer.js       # Tailwind optimization
│       └── svg-icon-fixes.js           # SVG structure fixes
├── 📁 .claude/                 # Claude Code integration
│   └── 📁 commands/
│       └── analyze-mcp.md              # /analyze-mcp command
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
| **Integration** | MCP Protocol, Figma API |
| **Infrastructure** | Docker, Docker Compose, Alpine Linux |
| **Code Quality** | ESLint, React Hooks Linting |

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
```

### Docker Configuration

The `docker-compose.yml` uses:
- **Port 5173**: Dashboard access
- **Volumes**: Hot reload for `src/` and `scripts/`
- **extra_hosts**: Access to MCP server on host via `host.docker.internal`

### Customizing Transformations

Modify transformations in `scripts/transformations/`:

```javascript
// Example: Add custom class optimization
// scripts/transformations/ast-cleaning.js

export function customOptimization(path) {
  // Your AST transformation logic
  const className = getClassNameAttribute(path)
  if (className.includes('my-pattern')) {
    // Apply fix
    return true
  }
  return false
}
```

---

## 📸 Examples

### Input: Figma Design
```
https://www.figma.com/design/ABC123?node-id=104-13741
```

### Output: React Component
```tsx
import React from 'react';
import './Component-fixed.css';

export default function HeroSection() {
  return (
    <div className="flex flex-col items-center gap-8 px-12 py-16">
      <h1 className="text-5xl font-bold text-gray-900">
        Welcome to Our Product
      </h1>
      <p className="text-lg text-gray-600 max-w-2xl text-center">
        Build amazing experiences with pixel-perfect designs
      </p>
      <button className="px-6 py-3 bg-purple-600 text-white rounded-lg
                         hover:bg-purple-700 transition-colors">
        Get Started
      </button>
    </div>
  );
}
```

### Output: CSS File
```css
/* Auto-generated design tokens from Figma */
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
```

### Dashboard Preview

```ascii
┌──────────────────────────────────────────────────────────────┐
│  🎨 MCP Figma Analyzer                    ✓ MCP Connected   │
├──────────────────────────────────────────────────────────────┤
│                                                              │
│  💡 Comment lancer une nouvelle analyse                      │
│  Option 1: /analyze-mcp URL_FIGMA                           │
│  Option 2: "Analyse cette URL Figma : URL"                  │
│                                                              │
│  ┌───────────┐  ┌───────────┐  ┌───────────┐               │
│  │ 🎨        │  │ 🎨        │  │ 🎨        │               │
│  │ Hero      │  │ Pricing   │  │ Footer    │               │
│  │ Section   │  │ Cards     │  │ Component │               │
│  │           │  │           │  │           │               │
│  │ 📦 245    │  │ 📦 189    │  │ 📦 156    │               │
│  │ 🖼️ 12     │  │ 🖼️ 8      │  │ 🖼️ 6      │               │
│  │           │  │           │  │           │               │
│  │ [Détails] │  │ [Détails] │  │ [Détails] │               │
│  └───────────┘  └───────────┘  └───────────┘               │
└──────────────────────────────────────────────────────────────┘
```

---

## 🐛 Troubleshooting

### MCP Server Not Found

**Problem**: `❌ MCP Disconnected`

**Solution**:
```bash
# Check if MCP server is running
curl http://localhost:3845/health

# Restart MCP Figma Desktop server
# Follow the MCP Figma Desktop documentation
```

### Docker Container Won't Start

**Problem**: `Error: Cannot connect to the Docker daemon`

**Solution**:
```bash
# Start Docker Desktop
# Then retry:
docker-compose up --build
```

### Component Won't Load in Dashboard

**Problem**: `Error loading component`

**Solution**:
```bash
# Check if the component file exists
ls src/generated/tests/node-{nodeId}/Component-fixed.tsx

# Check for syntax errors
docker exec mcp-figma-v1 npm run lint
```

### Large Figma Files Timeout

**Problem**: `get_design_context` fails with >25k tokens

**Solution**: The system automatically handles this with chunking. If it fails:
```bash
# Manually extract chunks
docker exec mcp-figma-v1 node scripts/mcp-direct-save.js \
  extract-nodes src/generated/tests/node-{nodeId}/metadata.xml
```

### Fonts Not Loading

**Problem**: Custom fonts don't appear in the web render

**Solution**:
```bash
# Check variables.json for font definitions
cat src/generated/tests/node-{nodeId}/variables.json

# Check generated CSS file
cat src/generated/tests/node-{nodeId}/Component-fixed.css

# Verify Google Fonts import in CSS
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
   - Screenshots if applicable

### Suggesting Features

1. Open an issue with the `enhancement` label
2. Describe the feature and use case
3. Explain why it would be valuable

### Submitting Pull Requests

```bash
# 1. Fork the repository
# 2. Create a feature branch
git checkout -b feature/amazing-feature

# 3. Make your changes
# 4. Test thoroughly
npm run lint
npm run build

# 5. Commit with clear messages
git commit -m "Add amazing feature"

# 6. Push to your fork
git push origin feature/amazing-feature

# 7. Open a Pull Request
```

### Development Guidelines

- Follow the existing code style
- Add comments for complex logic
- Update documentation for new features
- Test with multiple Figma designs
- Ensure Docker build succeeds

---

## 📚 Documentation

- **[CLAUDE.md](./CLAUDE.md)** - Guidance for AI assistants working with this codebase
- **[MCP Protocol](https://github.com/anthropics/mcp)** - Model Context Protocol documentation
- **[Figma API](https://www.figma.com/developers/api)** - Figma REST API reference
- **[Babel AST](https://babeljs.io/docs/en/babel-parser)** - AST parsing documentation
- **[Tailwind CSS](https://tailwindcss.com/docs)** - Tailwind utility classes

---

## 🎓 Learn More

### How AST Processing Works

The unified processor uses Babel to:
1. Parse React/JSX code into an Abstract Syntax Tree
2. Traverse the tree once (performance optimization)
3. Apply multiple transformations during the single pass
4. Generate optimized code from the modified AST

```javascript
// Example transformation
traverse(ast, {
  JSXElement(path) {
    // Find className attribute
    // Detect patterns (e.g., font-['Poppins:Bold'])
    // Transform to inline styles
    // Optimize Tailwind classes
  }
})
```

### Why MCP?

The Model Context Protocol enables:
- **Direct Figma Access**: No API keys or authentication needed
- **Rich Context**: Get design hierarchy, variables, and screenshots
- **AI Integration**: Works seamlessly with Claude Code
- **Type Safety**: Structured data extraction

---

## 📄 License

This project is licensed under the **MIT License** - see the [LICENSE](LICENSE) file for details.

```
MIT License

Copyright (c) 2025 MCP Figma to Code Contributors

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction...
```

---

## 🙏 Acknowledgments

- **Anthropic** - For the Model Context Protocol and Claude Code
- **Figma** - For the amazing design tool and API
- **React Team** - For React 19
- **Tailwind Labs** - For Tailwind CSS
- **Babel Team** - For the AST tooling
- **All Contributors** - Thank you! 🎉

---

## 📞 Support

- 🐛 **Issues**: [GitHub Issues](https://github.com/vincegx/Figma-to-Code---MCP-tools/issues)
- 💬 **Discussions**: [GitHub Discussions](https://github.com/vincegx/Figma-to-Code---MCP-tools/discussions)

---

<div align="center">

**[⬆ Back to Top](#-mcp-figma-to-code)**

Made with ❤️ by the MCP Figma to Code team

⭐ **Star this repo** if you find it useful!

</div>
