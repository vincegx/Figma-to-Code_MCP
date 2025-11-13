# MCP Figma to Code Documentation

Welcome to the complete documentation for **MCP Figma to Code** - the tool that transforms your Figma designs into pixel-perfect, production-ready React + Tailwind CSS components.

## Introduction

**MCP Figma to Code** is a tool designed for React and Tailwind CSS developers who want to accelerate their development workflow by automatically converting Figma designs into production-ready code.

### Who is this tool for?

- **Frontend Developers** using React 19 + Tailwind CSS
- **Teams** looking to reduce the time between design and implementation
- **Projects** requiring pixel-perfect fidelity between mockups and web rendering
- **Designer-Developers** wanting to automate the design-to-code conversion

### The Promise

Give a Figma URL, get a functional React component with:
- **Guaranteed visual fidelity**: Web rendering matches the Figma design exactly
- **Optimized code**: 11 AST transformations for clean, maintainable code
- **Zero configuration**: Works immediately with Docker
- **Two modes**: Tailwind version (-fixed) or pure CSS (-clean) for production

### General Workflow

```
1. Design in Figma → 2. Copy URL → 3. Launch export → 4. Get React code + CSS
```

The system handles everything: extraction via MCP, AST processing, visual validation, and report generation.

## Quick Start

Install and launch your first export in under 5 minutes.

### Prerequisites

Before starting, install:
- **Docker Desktop** (version 20.10+)
- **Docker Compose** (version 2.0+)
- **Figma Desktop** (native app, not the browser)
- A **Figma Professional** account (to enable MCP Server)

![Installation](/docs/images/image02.png)

### Installation in 3 Steps

#### Step 1: Clone the project

```bash
git clone https://github.com/vincegx/Figma-to-Code.git
cd Figma-to-Code
```

#### Step 2: Enable MCP Server in Figma

1. Open **Figma Desktop** (native app, not web)
2. Go to **Settings → Integrations**
3. Enable **MCP Server** (default port: 3845)
4. Verify the server responds:

```bash
curl http://localhost:3845/mcp
# If you get a response (even error 400), it's working ✅
```

> **Note:** The MCP Server only works with Figma Desktop open.

#### Step 3: Launch the application

```bash
docker-compose up --build
```

The application starts at **http://localhost:5173**

### Your First Export (2 minutes)

1. Open a Figma file containing a component or frame
2. Select the element to export
3. Right-click → **Copy/Paste as → Copy link**
4. Verify the URL contains `?node-id=X-Y`
5. In the dashboard (http://localhost:5173), go to **Export Figma**
6. Paste the URL and click **Launch export**
7. Follow the real-time logs
8. Once complete, click **View details** to see the result

**Result:** You now have a React component with Tailwind CSS ready to use!

## Dashboard Interface

The dashboard is organized into 5 main sections accessible via the left sidebar.

![Dashboard](/docs/images/image01.png)

### Main Navigation

#### Dashboard (home page)
- **Overview**: Global statistics (exports, merges, transformations)
- **Recent Activity**: Timeline of recent exports and merges
- **Quick Actions**: Buttons to launch a new export or merge
- **Charts**: Activity evolution, top exports, transformation breakdown

#### Export Figma
- **Export list**: All your Figma exports with sorting and pagination
- **Two views**: Grid (cards with preview) or List (detailed table)
- **Actions**: View details, Open preview, Delete
- **Stats**: For each export: number of nodes, images, fonts, fixes applied

#### Responsive Merges
- **Merge list**: Responsive components created by merging Desktop/Tablet/Mobile
- **Actions**: View preview, Edit with Puck, Delete
- **Stats**: Number of merged components, any errors

#### Settings
- **MCP Connection**: Server URL, delay between calls
- **Code Generation**: Default mode (Fixed, Clean, Both), chunking
- **Directories**: Output paths
- **API Limits**: Alert thresholds (warning, critical, danger)
- **Transforms**: Enable/disable individual AST transformations

#### Documentation
- **Sticky navigation**: Quick access to sections
- **Bilingual content**: FR/EN based on your preferences
- **Search**: Via left navigation (auto-scroll)

### API Usage Bar (top)

The colored bar at the top of the dashboard shows your daily Figma token consumption:
- **Green (SAFE)**: < 50% of daily limit
- **Yellow (WARNING)**: 50-75%
- **Orange (CRITICAL)**: 75-90%
- **Red (DANGER)**: > 90%

Hover over it to see:
- Tokens used today
- MCP call breakdown (get_design_context, get_metadata, etc.)
- Min/typical/max credit estimates
- Last 7 days history

> **Daily limit**: ~1,200,000 tokens/day (Figma Professional plan)

## Export Figma

The main feature: convert a Figma design into a React component.

![Figma exports list](/docs/images/image02.png)

### Complete Workflow

#### 1. Get the Figma URL

In Figma Desktop:
1. **Select** the frame, component, or group to export
2. **Right-click** → Copy/Paste as → **Copy link**
3. The URL should look like:

```
https://www.figma.com/design/FILE_KEY?node-id=123-456
```

The `node-id` parameter is **required**. Accepted format: `123-456` or `123:456`

![Figma export form](/docs/images/image03.png)

#### 2. Launch the export

1. Go to the **Export Figma** page in the dashboard
2. Paste the URL in the form at the top
3. Click **Launch export**
4. A real-time log stream displays:

```
🚀 Extraction phase starting...
● Connecting to MCP server...
✓ MCP connected successfully
● Extracting metadata.xml...
✓ Metadata extracted (45 nodes)
● Extracting design context (chunk 1/5)...
...
✓ Export completed in 23s
```

5. Once complete, the new export appears in the list

#### 3. Explore the results

Click **View details** to access the detail page with 3 tabs:

![Export detail page](/docs/images/image04.png)

##### Preview Tab
- **Visual preview**: The component rendered in an iframe
- **Responsive presets**: Native, Mobile (375px), Tablet (768px), Desktop (1440px), Large (1920px)
- **Custom slider**: Test any width
- **DevTools**: Inspect Tailwind classes with F12

![Preview tab](/docs/images/image05.png)

##### Code Tab
- **File navigation**: Tree of all generated files
- **Versions**: Component-fixed.tsx (Tailwind) and Component-clean.tsx (pure CSS)
- **Chunks**: If complex design, see split components
- **Syntax highlighting**: Colored code with react-syntax-highlighter
- **Copy button**: Copy code in one click

![Code tab](/docs/images/image07.png)

##### Report Tab
- **Visual comparison**: Figma screenshot vs Web render side-by-side
- **Fidelity metrics**: Visual difference analysis
- **Technical report**: analysis.md file with transformation details

![Report tab](/docs/images/image06.png)

### Processing Modes

The system automatically adapts to design complexity:

#### Simple Mode
For small, valid components (< 50 nodes):
- Only 4 MCP calls
- Direct processing of complete code
- Fast and efficient

#### Chunk Mode
For complex designs (> 50 nodes or invalid code):
- Parent wrapper extraction (preserves layout)
- Split into chunks (1 chunk = 1 direct child)
- Independent processing of each chunk
- Final assembly with imports
- Consolidated and deduplicated CSS

> The mode is chosen automatically. You don't need to do anything.

## Responsive Merge

Create a responsive component by merging 3 exports for Desktop, Tablet, and Mobile.

![Responsive merges list](/docs/images/image08.png)

### Principle

The system analyzes CSS class differences between the 3 versions and automatically generates media queries:

```css
/* Desktop-first approach */
.container { width: 1200px; } /* Desktop by default */

@media (max-width: 1024px) {
  .container { width: 768px; } /* Tablet */
}

@media (max-width: 768px) {
  .container { width: 100%; } /* Mobile */
}
```

### Workflow

#### 1. Create the 3 Figma exports

In Figma, create 3 separate frames for the same component:
- **Desktop**: 1440px width (or your desktop breakpoint)
- **Tablet**: 768px width
- **Mobile**: 375px width

Export each via the **Export Figma** page (see previous section).

![Grid/List view modes](/docs/images/image09.png)

> **Tip:** Name your frames consistently (e.g., "HomePage-Desktop", "HomePage-Tablet", "HomePage-Mobile")

#### 2. Launch the merge

1. Go to **Responsive Merges**
2. Click **New Merge**
3. A modal opens with 3 selectors:
   - **Desktop**: Select your Desktop export
   - **Tablet**: Select your Tablet export
   - **Mobile**: Select your Mobile export
4. Click **Launch merge**
5. Follow the progress (real-time logs)

![Responsive merge popup](/docs/images/image10.png)

#### 3. Result

Once the merge is complete, you get:
- **A single component** with automatic media queries
- **Optimized breakpoints**: 1024px and 768px (configurable)
- **Consolidated CSS**: Deduplicated and optimized
- **Merge report**: Details of detected differences

![Merge detail page](/docs/images/image11.png)

### Using the merged component

The component automatically adapts to screen width:

```tsx
import HomePage from './HomePage-responsive.tsx'

function App() {
  return <HomePage /> // Automatically adapts Desktop/Tablet/Mobile
}
```

### Editing with Puck (optional)

Click **Edit with Puck** to:
- Visually edit the component
- Adjust breakpoints
- Modify CSS classes
- Export the result

## Documentation

This documentation is accessible directly in the dashboard with sticky navigation and bilingual support (FR/EN).

![Documentation page](/docs/images/image12.png)

### Features

- **Sticky Navigation**: Left sidebar with automatic scrolling to active section
- **Bilingual Content**: Switch between French and English based on your preferences
- **Code Examples**: Copy code snippets with one click
- **Search**: Navigate quickly via left navigation
- **Markdown Rendering**: Full GitHub Flavored Markdown support with syntax highlighting

The documentation is generated from Markdown files and automatically synced with the application interface.

## Generated Files

Each export creates a folder `src/generated/export_figma/node-{id}-{timestamp}/` with many files. Here's their purpose.

### Folder Structure

```
node-9-2654-1735689600/
├── Component-fixed.tsx       # Tailwind CSS version
├── Component-fixed.css       # Tailwind styles
├── Component-clean.tsx       # Pure CSS version (production)
├── Component-clean.css       # Optimized CSS styles
├── parent-wrapper.tsx        # Parent wrapper (Chunk Mode only)
├── chunks/                   # Original chunks (Chunk Mode)
│   ├── Header.tsx
│   ├── Content.tsx
│   └── Footer.tsx
├── chunks-fixed/             # Processed Tailwind chunks
├── chunks-clean/             # Processed pure CSS chunks
├── img/                      # Extracted images
│   ├── logo.png
│   ├── hero-image.jpg
│   └── icon-menu.svg
├── metadata.xml              # Figma hierarchy (nodes)
├── variables.json            # Design tokens (fonts, colors)
├── metadata.json             # Dashboard metadata
├── analysis.md               # Technical report (transformations)
├── report.html               # Visual report (Figma vs Web)
├── figma-render.png          # Figma screenshot
└── web-render.png            # Web screenshot
```

### Main Files

#### Component-fixed.tsx
**Usage:** Projects using Tailwind CSS

- Uses Tailwind classes (`flex`, `bg-white`, `text-lg`)
- Uses arbitrary values (`bg-[#f0d9b5]`, `w-[480px]`)
- Includes debug attributes (`data-name`, `data-node-id`)
- Requires Tailwind config with safelist (see CSS)

#### Component-clean.tsx
**Usage:** Production without Tailwind dependencies

- Pure CSS with custom classes (`.bg-custom-beige`, `.w-custom-480`)
- No debug attributes
- Copy/paste ready: works anywhere
- Ideal for integration in non-Tailwind projects

#### Component-fixed.css / Component-clean.css

CSS files contain:
- **CSS Variables** (`:root`): Colors, spacing, fonts
- **Google Fonts import**: Automatic loading of used fonts
- **Figma utility classes**: Helper classes generated by Figma
- **Custom classes**: For -clean.css, all custom classes

**Main difference:**
- `-fixed.css`: Requires Tailwind config with safelist for arbitrary values
- `-clean.css`: Standalone, no dependencies

### Metadata Files

#### metadata.xml
Complete Figma node hierarchy in XML format:

```xml
<node id="9:2654" name="HomePage" type="FRAME" width="1440" height="900">
  <node id="9:2655" name="Header" type="FRAME" width="1440" height="80">
    <node id="9:2656" name="Logo" type="INSTANCE" />
  </node>
</node>
```

Used for:
- Chunking (split by direct children)
- Image organization (rename by layer name)
- Technical reports

#### variables.json
Design tokens extracted from Figma:

```json
{
  "fonts": {
    "primary": "Inter",
    "secondary": "Roboto"
  },
  "colors": {
    "primary": "#0066cc",
    "background": "#ffffff"
  }
}
```

#### metadata.json
Metadata displayed in dashboard:

```json
{
  "exportId": "node-9-2654-1735689600",
  "nodeId": "9:2654",
  "nodeName": "HomePage",
  "timestamp": 1735689600000,
  "stats": {
    "totalNodes": 145,
    "imagesOrganized": 12,
    "executionTime": 23
  }
}
```

### Report Files

#### analysis.md
Technical report of applied AST transformations:

- Statistics per transformation (items processed, execution time)
- Warnings and errors
- Applied optimizations
- Recommendations

#### report.html
Visual report comparing Figma vs Web:

- Side-by-side screenshots
- Difference metrics
- Divergence areas (if detected)

## Architecture

Understanding how the system works under the hood.

### Overview

The system relies on a **4-phase pipeline** that converts a Figma design into optimized React code:

```
Phase 1: Extraction (MCP) → Phase 2: Processing (AST) → Phase 3: Validation → Phase 4: Reports
```

![Configuration](/docs/images/image03.png)

Each phase has a specific role and can function independently.

### Phase 1: Extraction (MCP)

**Objective:** Retrieve all design data from Figma Desktop

**Technology:** Model Context Protocol (MCP) - A protocol for exchanging rich contexts between applications

**Process:**

1. **Connect to MCP Server**
   - MCP server runs in Figma Desktop (port 3845)
   - Connection via HTTP transport from Docker
   - URL: `http://host.docker.internal:3845/mcp`

2. **Extract metadata**
   - Call `get_metadata(nodeId)` → `metadata.xml`
   - Contains complete node hierarchy
   - Used to decide mode (Simple or Chunk)

3. **Extract code**
   - **Simple Mode**: 1 call `get_design_context(nodeId, forceCode: true)`
   - **Chunk Mode**: 1 call for parent + N calls for children
   - 1 second delay between each call (Figma rate limiting)

4. **Extract assets**
   - Images: `get_design_context` with `dirForAssetWrites`
   - Figma screenshot: `get_screenshot(nodeId)`
   - Variables: `get_variable_defs(nodeId)`

**Result:** Folder with raw React code + assets + metadata

### Phase 2: Processing (AST)

**Objective:** Transform raw code into optimized, valid code

**Technology:** Abstract Syntax Tree (AST) via Babel

**Process:**

1. **Parsing**
   - React/JSX code is parsed into AST (syntax tree)
   - AST represents code as manipulable objects

2. **Transformations**
   - 11 transformations applied in priority order
   - Each transform modifies AST in place
   - Single AST traversal for all transforms (performance)

3. **Generation**
   - Modified AST converted to React code
   - CSS extracted and consolidated
   - Two outputs: -fixed (Tailwind) and -clean (pure CSS)

4. **Image organization**
   - Images renamed by layer names (not hashes)
   - Copy from `tmp/figma-assets` to `img/`
   - Update imports in code

**Result:** Optimized code + CSS + organized images

### Phase 3: Validation (Visual)

**Objective:** Verify visual fidelity Figma vs Web

**Technology:** Puppeteer + Chromium

**Process:**

1. **Launch browser**
   - Puppeteer launches Chromium in headless mode
   - Exact design dimensions (from metadata.xml)

2. **Navigate and render**
   - Load preview URL
   - Wait for fonts loading (Google Fonts)
   - Wait for images loading

3. **Capture screenshot**
   - Screenshot at 1:1 scale
   - PNG format for pixel-perfect comparison

**Result:** `web-render.png` for comparison with `figma-render.png`

### Phase 4: Output (Reports)

**Objective:** Generate reports and metadata

**Process:**

1. **metadata.json**: Dashboard metadata (stats, timestamp)
2. **analysis.md**: Technical report of transformations
3. **report.html**: Visual report with side-by-side screenshots

**Result:** Reports viewable in Report tab

### Processing Modes

#### Simple Mode

**When:** Small, valid design (React code generated by Figma is correct)

**Pipeline:**
```
1. get_design_context(nodeId) → Component.tsx
2. AST processing on Component.tsx → Component-fixed.tsx + Component-clean.tsx
3. Screenshots + Reports
```

**MCP calls:** 4 (metadata, design_context, screenshot, variables)

#### Chunk Mode

**When:** Complex design (> 50 nodes) or invalid code

**Pipeline:**
```
1. get_metadata(nodeId) → List of direct children
2. get_design_context(parentNodeId) → parent-wrapper.tsx
3. For each child: get_design_context(childNodeId) → chunks/Child.tsx
4. AST processing on each chunk → chunks-fixed/, chunks-clean/
5. Assembly: Import chunks in parent
6. CSS consolidation: Merge all CSS
7. Screenshots + Reports
```

**MCP calls:** 5 + N (N = number of direct children)

**Advantages:**
- Handles complex designs without timeout
- Allows parallel chunk processing
- Consolidated and deduplicated CSS
- More maintainable code (logical split)

## AST Transformations

The 11 transformations applied during AST processing, in priority order.

### Why AST Transformations?

Code generated by Figma (via MCP) is often:
- **Verbose**: Redundant Tailwind classes
- **Invalid**: Non-standard CSS properties
- **Not optimized**: Inline font definitions, nested SVGs
- **Hard to maintain**: No logical split

AST transformations solve these issues by modifying code in a **structured** and **predictable** way.

### Transformation List

#### 1. Font Detection (Priority 10)
**Role:** Convert custom font classes to inline styles

**Example:**
```tsx
// Before
<div className="font-['Inter:wght@400']">Text</div>

// After
<div style={{ fontFamily: 'Inter', fontWeight: 400 }}>Text</div>
```

**Why:** Avoids invalid Tailwind classes, simplifies CSS

#### 2. Auto Layout (Priority 20)
**Role:** Fix Figma auto-layout classes

**Example:**
```tsx
// Before
<div className="flex-col items-start justify-start gap-4">

// After
<div className="flex flex-col items-start justify-start gap-4">
```

**Why:** Figma sometimes forgets the base `flex`

#### 3. AST Cleaning (Priority 30)
**Role:** Remove invalid Tailwind classes

**Example:**
```tsx
// Before
<div className="flex mix-blend-normal opacity-[1]">

// After
<div className="flex">
```

**Why:** `mix-blend-normal` and `opacity-[1]` are useless

#### 4. SVG Icon Fixes (Priority 40)
**Role:** Fix SVG structure (fill, stroke, attributes)

**Example:**
```tsx
// Before
<svg fill="none">
  <path fill="black" stroke="red" />
</svg>

// After
<svg>
  <path fill="black" />
</svg>
```

**Why:** Avoids fill/stroke conflicts, simplifies rendering

#### 5. SVG Consolidation (Priority 45)
**Role:** Consolidate nested SVGs

**Example:**
```tsx
// Before
<svg><svg><path /></svg></svg>

// After
<svg><path /></svg>
```

**Why:** Reduces complexity, improves performance

#### 6. Post Fixes (Priority 50)
**Role:** Fix gradients and complex shapes

**Example:**
```tsx
// Fixes linearGradient IDs
// Fixes border-radius with clip-path
```

**Why:** Ensures correct rendering of visual effects

#### 7. Position Fixes (Priority 60)
**Role:** Fix positioning issues

**Example:**
```tsx
// Before
<div className="absolute left-[-10px]"> // Off-screen

// After
<div className="absolute left-0">
```

**Why:** Avoids off-viewport elements

#### 8. Stroke Alignment (Priority 70)
**Role:** Fix stroke alignment (inside, outside, center)

**Example:**
```tsx
// Before (stroke outside not supported)
<div style={{ strokeAlign: 'outside' }}>

// After (box-shadow simulation)
<div style={{ boxShadow: '0 0 0 2px currentColor' }}>
```

**Why:** CSS doesn't natively support stroke alignment

#### 9. CSS Variables (Priority 80)
**Role:** Convert CSS variables to actual values

**Example:**
```tsx
// Before
<div style={{ color: 'var(--primary-color)' }}>

// After
<div style={{ color: '#0066cc' }}>
```

**Why:** Simplifies CSS, avoids variable dependencies

#### 10. Tailwind Optimizer (Priority 90)
**Role:** Optimize arbitrary values to standard classes

**Example:**
```tsx
// Before
<div className="w-[100%] h-[100vh] bg-[#ffffff]">

// After
<div className="w-full h-screen bg-white">
```

**Why:** More readable code, smaller CSS bundle

#### 11. Production Cleaner (Priority 100)
**Role:** Clean for production (-clean mode only)

**Example:**
```tsx
// Before
<div data-name="Header" data-node-id="9:2654" className="flex">

// After (-clean)
<div className="flex">
```

**Why:** Reduces HTML size, removes debug attributes

### Transform Configuration

You can enable/disable each transformation in **Settings → Transforms**:

```json
{
  "transforms": {
    "font-detection": { "enabled": true },
    "auto-layout": { "enabled": true },
    "ast-cleaning": { "enabled": true },
    // ...
  },
  "continueOnError": true // Continue even if a transform fails
}
```

## API Reference

All available REST and Server-Sent Events endpoints.

### Base URL

```
http://localhost:5173/api
```

### Endpoints

#### POST /api/analyze

Launch a new Figma analysis.

**Request:**
```bash
curl -X POST http://localhost:5173/api/analyze \
  -H "Content-Type: application/json" \
  -d '{"figmaUrl": "https://www.figma.com/design/FILE?node-id=9-2654"}'
```

**Body:**
```json
{
  "figmaUrl": "https://www.figma.com/design/FILE_KEY?node-id=123-456"
}
```

**Response:**
```json
{
  "jobId": "abc123def456",
  "status": "pending"
}
```

**Possible errors:**
- `400`: Invalid URL (missing node-id or incorrect format)
- `500`: Server error (MCP inaccessible, etc.)

---

#### GET /api/analyze/logs/:jobId

SSE (Server-Sent Events) stream to follow logs in real-time.

**Request:**
```javascript
const eventSource = new EventSource('/api/analyze/logs/abc123def456')

eventSource.onmessage = (event) => {
  const data = JSON.parse(event.data)
  console.log(data.type, data.message)
}
```

**Response (stream):**
```
data: {"type": "log", "message": "🚀 Extraction phase starting..."}
data: {"type": "log", "message": "● Connecting to MCP server..."}
data: {"type": "progress", "step": 1, "total": 4}
data: {"type": "log", "message": "✓ MCP connected successfully"}
data: {"type": "complete", "exportId": "node-9-2654-1735689600"}
```

**Message types:**
- `log`: Standard log message
- `progress`: Progress (step/total)
- `complete`: Export completed successfully
- `error`: Fatal error

---

#### GET /api/analyze/status/:jobId

Job status (SSE alternative).

**Request:**
```bash
curl http://localhost:5173/api/analyze/status/abc123def456
```

**Response:**
```json
{
  "jobId": "abc123def456",
  "status": "running", // pending | running | completed | failed
  "progress": {
    "current": 2,
    "total": 4
  },
  "exportId": null // or "node-9-2654-1735689600" if completed
}
```

---

#### GET /api/export_figma

List all Figma exports.

**Request:**
```bash
curl http://localhost:5173/api/export_figma
```

**Response:**
```json
[
  {
    "exportId": "node-9-2654-1735689600",
    "nodeId": "9:2654",
    "nodeName": "HomePage",
    "layerName": "HomePage",
    "timestamp": 1735689600000,
    "stats": {
      "totalNodes": 145,
      "imagesOrganized": 12,
      "fontsUsed": 3,
      "totalFixes": 87,
      "executionTime": 23
    },
    "thumbnailPath": "/src/generated/export_figma/node-9-2654-1735689600/figma-render.png"
  }
]
```

---

#### GET /api/export_figma/:exportId

Specific export details.

**Request:**
```bash
curl http://localhost:5173/api/export_figma/node-9-2654-1735689600
```

**Response:** Same format as GET /api/export_figma but for a single export

---

#### DELETE /api/export_figma/:exportId

Delete an export and all its files.

**Request:**
```bash
curl -X DELETE http://localhost:5173/api/export_figma/node-9-2654-1735689600
```

**Response:**
```json
{
  "success": true,
  "message": "Export deleted successfully"
}
```

---

#### GET /api/usage

Figma API usage statistics (MCP tokens).

**Request:**
```bash
curl http://localhost:5173/api/usage
```

**Response:**
```json
{
  "today": {
    "date": "2025-01-01",
    "tokensUsed": 45230,
    "apiCalls": 12,
    "breakdown": {
      "get_design_context": 8,
      "get_metadata": 2,
      "get_screenshot": 1,
      "get_variable_defs": 1
    }
  },
  "historical": [
    { "date": "2024-12-31", "tokensUsed": 32100, "apiCalls": 9 },
    { "date": "2024-12-30", "tokensUsed": 28900, "apiCalls": 7 }
  ],
  "status": {
    "level": "SAFE", // SAFE | GOOD | WARNING | CRITICAL | DANGER
    "percentage": 3.7,
    "message": "Normal usage",
    "estimatedCredits": {
      "min": 0.02,
      "typical": 0.05,
      "max": 0.15
    }
  }
}
```

**Notes:**
- `tokensUsed`: Actual measurement from MCP responses
- `historical`: Last 30 days maximum
- Daily limit: ~1,200,000 tokens (Professional plan)

---

#### GET /api/mcp/health

MCP server health check.

**Request:**
```bash
curl http://localhost:5173/api/mcp/health
```

**Response:**
```json
{
  "status": "connected", // connected | disconnected
  "url": "http://host.docker.internal:3845/mcp",
  "timestamp": 1735689600000
}
```

---

#### GET /api/download/:exportId

Download export as ZIP.

**Request:**
```bash
curl -O http://localhost:5173/api/download/node-9-2654-1735689600
# Downloads node-9-2654-1735689600.zip
```

**Response:** ZIP file containing all export files

---

### Workflow Integration

Example: Node.js script to launch export and wait for result

```javascript
const fetch = require('node-fetch')

async function exportFigma(figmaUrl) {
  // 1. Launch export
  const res = await fetch('http://localhost:5173/api/analyze', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ figmaUrl })
  })
  const { jobId } = await res.json()

  // 2. Follow logs (SSE)
  const eventSource = new EventSource(`http://localhost:5173/api/analyze/logs/${jobId}`)

  return new Promise((resolve, reject) => {
    eventSource.onmessage = (event) => {
      const data = JSON.parse(event.data)

      if (data.type === 'complete') {
        eventSource.close()
        resolve(data.exportId)
      } else if (data.type === 'error') {
        eventSource.close()
        reject(new Error(data.message))
      } else {
        console.log(data.message) // Log progress
      }
    }
  })
}

// Usage
exportFigma('https://www.figma.com/design/FILE?node-id=9-2654')
  .then(exportId => console.log('Export completed:', exportId))
  .catch(err => console.error('Error:', err))
```

## Advanced Configuration

Customize system behavior via Settings or environment variables.

### Settings Page

Accessible via sidebar, the Settings page allows configuration:

#### MCP Tab

**MCP Server URL**
- Docker: `http://host.docker.internal:3845/mcp`
- Local: `http://127.0.0.1:3845/mcp`

**Delay between MCP calls**
- Min: 1000ms (Figma rate limiting)
- Recommended: 1500ms to avoid 429 errors

#### Generation Tab

**Default generation mode**
- `Fixed only`: Only generates Component-fixed.tsx (Tailwind)
- `Clean only`: Only generates Component-clean.tsx (pure CSS)
- `Both`: Generates both versions (recommended)

**Chunking**
- `Enabled`: Forces Chunk mode for all designs
- `Disabled`: Automatic mode (Simple or Chunk based on complexity)

#### Directories Tab

**Tests output directory**
- Path: `src/generated/export_figma`
- Changes export output folder

**Temporary assets directory**
- Path: `tmp/figma-assets`
- Temporary image storage before organization

#### API Tab

**Daily limit**
- Default: 1,200,000 tokens/day (Figma Professional)
- Adjust according to your Figma plan

**Alert thresholds**
- Warning: 50% (orange)
- Critical: 75% (red)
- Danger: 90% (dark red)

#### UI Tab

**Default view**
- Grid: Grid view with cards
- List: Table view

**Items per page**
- Options: 10, 20, 50, 100

**Screenshot format**
- PNG: Lossless (default)
- JPG: Compressed (lighter)

**Quality**
- 50-100% (if JPG)

#### Docker Tab

**Container name**
- Default: `mcp-figma-v1`
- Changes Docker container name

#### Transforms Tab

List of 11 AST transformations with on/off toggle for each.

**Continue on error**
- `Enabled`: Continue processing even if a transform fails
- `Disabled`: Stop on first failure

### Environment Variables

Configurable in `.env` or `docker-compose.yml`:

```bash
# MCP Server
MCP_SERVER_PORT=3845
MCP_SERVER_URL=http://host.docker.internal:3845/mcp

# Puppeteer
PUPPETEER_EXECUTABLE_PATH=/usr/bin/chromium
PUPPETEER_HEADLESS=true

# Project
PROJECT_ROOT=/Users/your-user/path/to/project
NODE_ENV=development

# API
API_PORT=5173
VITE_API_URL=http://localhost:5173
```

**PROJECT_ROOT**: Absolute project path (important for MCP asset writes)

### Docker Configuration

#### docker-compose.yml

```yaml
services:
  app:
    container_name: mcp-figma-v1
    build: .
    ports:
      - "5173:5173"
    volumes:
      - ./src:/app/src
      - ./scripts:/app/scripts
      - ./server.js:/app/server.js
      - ./src/generated:/app/src/generated
      - ./tmp:/app/tmp
      - ./data:/app/data
    extra_hosts:
      - "host.docker.internal:host-gateway"
    environment:
      - PROJECT_ROOT=/Users/your-user/path/to/project
      - PUPPETEER_EXECUTABLE_PATH=/usr/bin/chromium
```

**Important volumes:**
- `./src/generated`: Export outputs (persistence)
- `./tmp`: Temporary MCP assets
- `./data`: Usage tracking (30 days)

**extra_hosts:** Allows access to host MCP Server via `host.docker.internal`

#### Dockerfile

```dockerfile
FROM node:20-alpine

# Install Chromium for Puppeteer
RUN apk add --no-cache chromium

WORKDIR /app
COPY package*.json ./
RUN npm install
COPY . .

EXPOSE 5173
CMD ["npm", "run", "dev"]
```

### Tailwind Configuration (for using -fixed.tsx)

If using Component-fixed.tsx in your project:

```javascript
// tailwind.config.js
module.exports = {
  content: [
    './src/**/*.{js,ts,jsx,tsx}',
    './src/generated/export_figma/**/*.tsx' // Important!
  ],
  safelist: [
    // Safelist for arbitrary values (or use JIT mode)
    { pattern: /^(w|h|top|left|right|bottom)-\[.+\]$/ },
    { pattern: /^(bg|text|border)-\[.+\]$/ }
  ],
  theme: {
    extend: {}
  }
}
```

**Note:** -clean.tsx mode doesn't require any Tailwind configuration.

## Troubleshooting

Solutions to common problems.

### MCP Server not accessible

**Symptoms:**
- "MCP Server connection failed" error
- Timeout during extraction
- Dashboard shows "MCP Disconnected" (red dot)

**Solutions:**

1. **Check Figma Desktop is open**
   ```bash
   # MCP Server only works if Figma Desktop is running
   ps aux | grep Figma
   ```

2. **Enable MCP Server in Figma**
   - Open Figma Desktop
   - Settings → Integrations → MCP Server → ON
   - Default port: 3845

3. **Test connection**
   ```bash
   curl http://localhost:3845/mcp
   # If response (even 400), server responds ✅
   ```

4. **Check port**
   ```bash
   lsof -i :3845
   # Should show Figma or nothing (not something else)
   ```

5. **Firewall**
   - Allow localhost connections on port 3845
   - macOS: System Preferences → Security → Firewall

6. **Restart Figma Desktop**
   - Quit completely (Cmd+Q)
   - Relaunch application

---

### Images not displaying

**Symptoms:**
- Broken images (🖼️ icon)
- Incorrect import paths in code
- Empty `img/` folder

**Solutions:**

1. **Check images were extracted**
   ```bash
   ls tmp/figma-assets/
   # Should contain .png, .jpg, .svg files
   ```

2. **Re-run organize-images**
   ```bash
   docker exec mcp-figma-v1 node scripts/post-processing/organize-images.js \
     src/generated/export_figma/node-X-Y-TIMESTAMP
   ```

3. **Check metadata.xml**
   - Open `metadata.xml`
   - Verify image nodes have `name` attribute
   - If `name` is empty, renaming fails

4. **Check permissions**
   ```bash
   # In Docker
   docker exec mcp-figma-v1 ls -la tmp/figma-assets
   docker exec mcp-figma-v1 ls -la src/generated/export_figma/node-X-Y-T/img
   ```

5. **Import paths**
   - Imports should be relative: `./img/logo.png`
   - No absolute paths: `/app/src/generated/...`

---

### Fonts not loading

**Symptoms:**
- Text displayed with fallback font (Arial, Times)
- Console: "Failed to load font"

**Solutions:**

1. **Check variables.json**
   ```bash
   cat src/generated/export_figma/node-X-Y-T/variables.json
   # Should contain "fonts" key with Google Fonts
   ```

2. **Check CSS import**
   ```css
   /* At top of CSS file */
   @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;700&display=swap');
   ```

3. **Internet connection**
   - Google Fonts requires connection
   - Test: `curl https://fonts.googleapis.com`

4. **Custom fonts (non-Google Fonts)**
   - If custom font, won't load automatically
   - Manually add @font-face in CSS

5. **Browser cache**
   - Clear cache (Cmd+Shift+R)
   - Or open in private browsing

---

### Generated code not faithful to design

**Symptoms:**
- Incorrect spacing
- Different colors
- Broken layout

**Solutions:**

1. **Check report.html**
   ```bash
   open src/generated/export_figma/node-X-Y-T/report.html
   # Visual Figma vs Web comparison
   ```

2. **Read analysis.md**
   ```bash
   cat src/generated/export_figma/node-X-Y-T/analysis.md
   # See which transformations failed
   ```

3. **Unsupported properties**
   - Advanced blend modes (multiply, screen, overlay)
   - Complex effects (multiple inner shadows)
   - Stroke alignment (inside, outside)

   → These CSS properties don't exist or are limited

4. **Disable certain transformations**
   - Go to Settings → Transforms
   - Disable problematic transforms
   - Re-run export

5. **Use Component-clean.tsx**
   - -clean version may have different (sometimes better) rendering
   - Test both versions

---

### Token limit reached

**Symptoms:**
- "Rate limit exceeded" error
- Red usage bar (> 90%)
- Exports failing with 429 error

**Solutions:**

1. **Check usage bar**
   - Hover over top bar
   - See tokens used today

2. **Prefer small components**
   - Export isolated components (not entire pages)
   - Simple component = ~5,000-10,000 tokens
   - Full page = ~50,000-200,000 tokens

3. **Use chunking**
   - Chunk mode optimizes MCP calls
   - Splits large designs into small pieces

4. **Wait 24h**
   - Limit resets daily (UTC)
   - Plan important exports

5. **Upgrade Figma plan**
   - Professional plan: ~1,200,000 tokens/day
   - Organization plan: higher limits
   - Contact Figma for details

---

### Docker won't start

**Symptoms:**
- `docker-compose up` fails
- Container crashes immediately
- "port already in use" error

**Solutions:**

1. **Check logs**
   ```bash
   docker logs mcp-figma-v1
   # Read errors
   ```

2. **Port 5173 in use**
   ```bash
   lsof -i :5173
   kill -9 <PID>
   # Or change port in docker-compose.yml
   ```

3. **Complete rebuild**
   ```bash
   docker-compose down
   docker system prune -a  # ⚠️ Deletes everything (images, volumes, cache)
   docker-compose up --build
   ```

4. **File permissions**
   ```bash
   # Verify Docker has folder access
   chmod -R 755 src/ scripts/ tmp/ data/
   ```

5. **Chromium missing**
   ```bash
   # If "Chromium not found" error
   docker exec mcp-figma-v1 which chromium
   # Should show: /usr/bin/chromium
   ```

6. **NPM install fails**
   ```bash
   # If missing dependencies
   docker exec mcp-figma-v1 npm install
   ```

---

### Preview not displaying

**Symptoms:**
- Empty iframe in Preview tab
- "Component not found" error

**Solutions:**

1. **Check file exists**
   ```bash
   ls src/generated/export_figma/node-X-Y-T/Component-fixed.tsx
   ```

2. **React compilation error**
   - Open DevTools console (F12)
   - Look for compilation errors
   - Often: missing import, syntax error

3. **Restart Vite**
   ```bash
   docker-compose restart
   # Forces Vite to recompile
   ```

4. **Clear Vite cache**
   ```bash
   docker exec mcp-figma-v1 rm -rf node_modules/.vite
   docker-compose restart
   ```

---

### SSE logs not displaying

**Symptoms:**
- Analysis page stays blank
- No logs after "Launch export"

**Solutions:**

1. **Check console**
   - F12 → Console
   - EventSource error?

2. **Proxy/VPN**
   - Some proxies block SSE
   - Temporarily disable

3. **Browser compatibility**
   - SSE works on modern Chrome, Firefox, Safari
   - Avoid IE11

4. **Test manually**
   ```bash
   curl -N http://localhost:5173/api/analyze/logs/<jobId>
   # Should stream logs
   ```

## FAQ

### Frequently Asked Questions

#### What's the difference between -fixed and -clean?

- **-fixed.tsx**: Uses Tailwind CSS (classes `flex`, `bg-white`, etc.) + arbitrary values (`bg-[#f0d9b5]`). Requires Tailwind config with safelist. Ideal for Tailwind projects.
- **-clean.tsx**: Pure CSS with custom classes (`.bg-custom-beige`). No dependencies. Copy/paste ready. Ideal for production or non-Tailwind projects.

#### Can I use the code without Tailwind?

Yes, use **Component-clean.tsx** + **Component-clean.css**. No Tailwind dependency required.

#### Are components responsive?

Not by default. One Figma export = one fixed width. For responsive, use **Responsive Merge** (merge Desktop/Tablet/Mobile).

#### How much does an export cost in tokens?

Depends on complexity:
- Small component (10-20 nodes): ~5,000-10,000 tokens
- Medium component (50 nodes): ~20,000-40,000 tokens
- Full page (200+ nodes): ~100,000-300,000 tokens

Check usage bar at top of dashboard.

#### Can I export entire Design Systems?

Yes, but in pieces. Export each component separately to avoid timeouts and token limits.

#### Is the code production-ready?

The **-clean** version is production-ready (pure CSS, no debug attrs). The **-fixed** version is ideal for development/prototyping with Tailwind.

#### Can I modify the generated code?

Yes, it's standard React code. Modify as you wish. Code has no external dependencies (except images).

#### Are Figma animations exported?

No. Animations (transitions, auto-animate) aren't supported. You'll need to recreate them with CSS or Framer Motion.

#### Can I export variants?

Figma variants aren't directly supported. Export each variant separately, then manually create a React component with props.

#### How to debug a failed export?

1. Check real-time logs (SSE)
2. Read `analysis.md` to see applied transformations
3. Check `report.html` for visual differences
4. Look at Docker logs: `docker logs mcp-figma-v1`

#### Does it work with Figma Browser?

No, only **Figma Desktop**. MCP Server is only available in the native app.

#### Can I export to Vue.js or Angular?

No, the system generates **React** only. But CSS can be reused in any framework.

#### Are Figma plugins taken into account?

No. Only visible design (layers, styles, images) is exported. Plugin data isn't accessible via MCP.

#### Can I automate exports (CI/CD)?

Yes, via REST API. See **API Reference** section for integration examples. Note: requires Figma Desktop running on the machine.

---

## Support

For questions or issues:

- **Documentation**: Re-read Troubleshooting and FAQ sections
- **Logs**: Check `docker logs mcp-figma-v1` and `analysis.md` files
- **GitHub Issues**: [github.com/your-repo/issues](https://github.com/your-repo/issues)

---

**Version**: 1.0.0
**Last updated**: January 2025
**License**: MIT
