# 🔨 Development Guide

> Comprehensive guide for contributing to MCP Figma to Code

## Table of Contents

- [Getting Started](#getting-started)
- [Development Workflow](#development-workflow)
- [Adding Transforms](#adding-transforms)
- [Working with the Dashboard](#working-with-the-dashboard)
- [Testing](#testing)
- [Configuration](#configuration)
- [Docker Development](#docker-development)
- [Contributing](#contributing)
- [Code Style](#code-style)

---

## Getting Started

### Prerequisites

- **Docker** + Docker Compose (recommended)
- **Node.js** 20+ (for local development)
- **Figma Desktop** with MCP server enabled
- **Git** for version control
- **VS Code** (recommended IDE)

### Initial Setup

```bash
# 1. Clone repository
git clone https://github.com/vincegx/Figma-to-Code---MCP-tools.git
cd Figma-to-Code---MCP-tools

# 2. Install dependencies
npm install

# 3. Start Docker environment
docker-compose up --build

# 4. Verify setup
curl http://localhost:5173  # Dashboard
curl http://localhost:3845/mcp  # MCP server
```

### Development Environment

**Recommended VS Code Extensions:**

```json
{
  "recommendations": [
    "dbaeumer.vscode-eslint",
    "esbenp.prettier-vscode",
    "bradlc.vscode-tailwindcss",
    "ms-azuretools.vscode-docker"
  ]
}
```

**VS Code Settings:**

```json
{
  "editor.formatOnSave": true,
  "editor.defaultFormatter": "esbenp.prettier-vscode",
  "tailwindCSS.experimental.classRegex": [
    ["cn\\(([^)]*)\\)", "[\"'`]([^\"'`]*)[\"'`]"]
  ]
}
```

---

## Development Workflow

### Local Development (Without Docker)

```bash
# Terminal 1: Start Vite dev server
npm run dev

# Terminal 2: Start API server
npm run server

# Dashboard: http://localhost:5173
# API: http://localhost:3000
```

### Docker Development (Recommended)

```bash
# Start with hot reload
docker-compose up

# View logs
docker logs -f mcp-figma-v1

# Execute commands in container
docker exec mcp-figma-v1 npm run lint
docker exec mcp-figma-v1 node scripts/figma-cli.js "URL"

# Stop containers
docker-compose down
```

### File Watching

Docker volumes are configured for hot reload:

```yaml
# docker-compose.yml
volumes:
  - ./src:/app/src              # Frontend (Vite HMR)
  - ./scripts:/app/scripts      # Scripts (restart required)
  - ./server.js:/app/server.js  # API (restart required)
```

**Frontend changes:** Instant update via Vite HMR
**Backend changes:** Restart container:

```bash
docker-compose restart
```

---

## Adding Transforms

Transforms are modular AST transformations that modify generated code.

### Transform Template

Create a new file in `scripts/transformations/`:

```javascript
// scripts/transformations/my-transform.js
import traverse from '@babel/traverse'
import * as t from '@babel/types'

export const meta = {
  name: 'my-transform',
  priority: 55  // 10 (early) → 100 (late)
}

export function execute(ast, context) {
  const startTime = Date.now()
  let itemsProcessed = 0

  traverse.default(ast, {
    // Visitor methods
    JSXElement(path) {
      // Access node
      const node = path.node

      // Check condition
      if (shouldTransform(node)) {
        // Modify AST
        transformNode(path)
        itemsProcessed++
      }
    },

    JSXAttribute(path) {
      // Another visitor
    }
  })

  // Return statistics
  return {
    itemsProcessed,
    executionTime: Date.now() - startTime,
    // ... custom stats
  }
}

// Helper functions
function shouldTransform(node) {
  // Condition logic
}

function transformNode(path) {
  // Transformation logic
}
```

### Common AST Patterns

**1. Modify JSX Attribute:**

```javascript
JSXAttribute(path) {
  if (path.node.name.name === 'className') {
    const value = path.node.value.value
    const newValue = transformClassName(value)

    path.node.value = t.stringLiteral(newValue)
  }
}
```

**2. Add JSX Attribute:**

```javascript
JSXOpeningElement(path) {
  // Check if attribute doesn't exist
  const hasAttr = path.node.attributes.some(
    attr => attr.name?.name === 'data-id'
  )

  if (!hasAttr) {
    // Add new attribute
    path.node.attributes.push(
      t.jsxAttribute(
        t.jsxIdentifier('data-id'),
        t.stringLiteral('123')
      )
    )
  }
}
```

**3. Remove JSX Attribute:**

```javascript
JSXAttribute(path) {
  if (path.node.name.name === 'data-debug') {
    path.remove()
  }
}
```

**4. Modify Style Object:**

```javascript
JSXAttribute(path) {
  if (path.node.name.name === 'style') {
    const styleObj = path.node.value.expression

    if (t.isObjectExpression(styleObj)) {
      styleObj.properties.forEach(prop => {
        if (prop.key.name === 'color') {
          prop.value = t.stringLiteral('#000000')
        }
      })
    }
  }
}
```

**5. Wrap Element:**

```javascript
JSXElement(path) {
  if (needsWrapper(path.node)) {
    const wrapper = t.jsxElement(
      t.jsxOpeningElement(t.jsxIdentifier('div'), []),
      t.jsxClosingElement(t.jsxIdentifier('div')),
      [path.node]
    )

    path.replaceWith(wrapper)
  }
}
```

### Register Transform

**1. Import in pipeline.js:**

```javascript
// scripts/pipeline.js
import * as myTransform from './transformations/my-transform.js'

const ALL_TRANSFORMS = [
  fontDetection,
  autoLayout,
  // ... existing transforms
  myTransform,  // Add here
]
```

**2. Configure in config.js:**

```javascript
// scripts/config.js
export const defaultConfig = {
  'my-transform': { enabled: true },
  // ... other transforms
}
```

### Testing Transform

```bash
# 1. Create test input file
echo 'export default function Test() { return <div>Test</div> }' > test-input.tsx

# 2. Run unified-processor
docker exec mcp-figma-v1 node scripts/unified-processor.js \
  test-input.tsx \
  test-output.tsx \
  path/to/metadata.xml

# 3. Check output
cat test-output.tsx

# 4. Test with real Figma design
./cli/figma-analyze "https://www.figma.com/design/FILE_ID?node-id=X-Y"
```

### Transform Best Practices

✅ **DO:**
- Keep transforms focused (single responsibility)
- Use meaningful variable names
- Add comments for complex logic
- Return detailed statistics
- Handle edge cases gracefully
- Test with multiple designs

❌ **DON'T:**
- Modify AST outside traverse visitors
- Assume node structure without checking
- Create circular dependencies
- Perform I/O operations in transforms
- Ignore TypeScript types

---

## Working with the Dashboard

### Component Development

**Feature-Based Structure:**

```
src/components/
├── features/
│   └── my-feature/
│       ├── MyFeature.tsx      # Main component
│       ├── MyFeatureCard.tsx  # Sub-component
│       └── useMyFeature.ts    # Custom hook
```

**Example Component:**

```typescript
// src/components/features/my-feature/MyFeature.tsx
import { useState } from 'react'
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { useMyFeature } from './useMyFeature'

export default function MyFeature() {
  const { data, loading, refetch } = useMyFeature()
  const [selected, setSelected] = useState<string | null>(null)

  if (loading) return <div>Loading...</div>

  return (
    <Card>
      <CardHeader>
        <CardTitle>My Feature</CardTitle>
      </CardHeader>
      <CardContent>
        {data.map(item => (
          <div key={item.id} onClick={() => setSelected(item.id)}>
            {item.name}
          </div>
        ))}
        <Button onClick={refetch}>Refresh</Button>
      </CardContent>
    </Card>
  )
}
```

**Custom Hook:**

```typescript
// src/components/features/my-feature/useMyFeature.ts
import { useState, useEffect } from 'react'

export function useMyFeature() {
  const [data, setData] = useState([])
  const [loading, setLoading] = useState(true)

  const fetchData = async () => {
    setLoading(true)
    try {
      const res = await fetch('/api/my-feature')
      const json = await res.json()
      setData(json)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchData()
  }, [])

  return { data, loading, refetch: fetchData }
}
```

### Adding a New Page

**1. Create page component:**

```typescript
// src/components/pages/MyPage.tsx
import { useTranslation } from '../../i18n/I18nContext'

export default function MyPage() {
  const { t } = useTranslation()

  return (
    <div className="container mx-auto p-6">
      <h1 className="text-3xl font-bold mb-6">{t('myPage.title')}</h1>
      {/* Page content */}
    </div>
  )
}
```

**2. Add route:**

```typescript
// src/App.tsx
import MyPage from './components/pages/MyPage'

function App() {
  return (
    <Routes>
      <Route path="/my-page" element={<MyPage />} />
      {/* ... other routes */}
    </Routes>
  )
}
```

**3. Add navigation:**

```typescript
// src/components/layout/AppSidebar.tsx
const menuItems = [
  { to: '/my-page', icon: Sparkles, label: 'My Page' },
  // ... other items
]
```

**4. Add translations:**

```json
// src/i18n/translations/en.json
{
  "myPage": {
    "title": "My Page",
    "description": "This is my page"
  }
}
```

### Styling with Tailwind

**Using shadcn/ui components:**

```tsx
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'

<Button variant="default" size="lg">
  Click Me
</Button>

<Card className="p-6 hover:shadow-lg transition-shadow">
  Content
</Card>
```

**Custom styles:**

```tsx
<div className="
  flex items-center justify-between
  px-4 py-2
  bg-background text-foreground
  border rounded-md
  hover:bg-accent
  dark:bg-slate-800
">
  Content
</div>
```

**Using `cn()` helper:**

```tsx
import { cn } from '@/lib/utils'

<div className={cn(
  "base-class",
  isActive && "active-class",
  variant === "primary" && "primary-class"
)}>
  Content
</div>
```

---

## Testing

### Manual Testing

**1. Test Analysis Pipeline:**

```bash
# Full pipeline test
./cli/figma-analyze "https://www.figma.com/design/FILE_ID?node-id=X-Y"

# Check outputs
ls -la src/generated/tests/node-*
```

**2. Test Individual Scripts:**

```bash
# Test image organization
docker exec mcp-figma-v1 node scripts/post-processing/organize-images.js \
  src/generated/tests/node-X-Y

# Test screenshot capture
docker exec mcp-figma-v1 node scripts/post-processing/capture-screenshot.js \
  src/generated/tests/node-X-Y 5173

# Test report generation
docker exec mcp-figma-v1 node scripts/reporting/generate-report.js \
  src/generated/tests/node-X-Y
```

**3. Test API Endpoints:**

```bash
# Health check
curl http://localhost:5173/api/mcp/health

# Usage stats
curl http://localhost:5173/api/usage

# Start analysis
curl -X POST http://localhost:5173/api/analyze \
  -H "Content-Type: application/json" \
  -d '{"figmaUrl":"https://www.figma.com/design/..."}'
```

### Testing Checklist

Before submitting a PR, verify:

- [ ] Code passes ESLint (`npm run lint`)
- [ ] Build succeeds (`npm run build`)
- [ ] Docker build succeeds (`docker-compose up --build`)
- [ ] Dashboard loads without errors
- [ ] MCP connection works
- [ ] Analysis completes successfully
- [ ] Generated components render correctly
- [ ] Screenshots are captured
- [ ] Reports are generated
- [ ] No console errors in browser

---

## Configuration

### Transform Configuration

**Enable/Disable Transforms:**

```javascript
// scripts/config.js
export const defaultConfig = {
  // Core transforms
  'font-detection': { enabled: true },
  'auto-layout': { enabled: true },
  'ast-cleaning': { enabled: true },

  // SVG transforms
  'svg-icon-fixes': { enabled: true },
  'svg-consolidation': { enabled: true },

  // Advanced transforms
  'post-fixes': { enabled: true },
  'position-fixes': { enabled: true },
  'stroke-alignment': { enabled: true },

  // Optimization
  'css-vars': { enabled: true },
  'tailwind-optimizer': { enabled: true },

  // Production
  'production-cleaner': { enabled: false },  // Disabled by default

  // Error handling
  continueOnError: false  // Stop on first error
}
```

**Per-Analysis Configuration:**

```javascript
// Override config for specific analysis
const customConfig = {
  ...defaultConfig,
  'production-cleaner': { enabled: true },
  continueOnError: true
}

runPipeline(sourceCode, context, customConfig)
```

### MCP Configuration

**MCP Parameters:**

```json
// cli/config/figma-params.json
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

### Environment Variables

Create `.env` file:

```env
# Node environment
NODE_ENV=development

# Puppeteer
PUPPETEER_EXECUTABLE_PATH=/usr/bin/chromium

# MCP Server
MCP_SERVER_HOST=host.docker.internal
MCP_SERVER_PORT=3845

# API Server
PORT=3000
VITE_PORT=5173

# Project paths (for Docker)
PROJECT_ROOT=/Users/you/path/to/project
```

---

## Docker Development

### Container Management

```bash
# Build and start
docker-compose up --build

# Start in background
docker-compose up -d

# View logs
docker logs -f mcp-figma-v1

# Stop containers
docker-compose down

# Remove volumes
docker-compose down -v

# Rebuild from scratch
docker-compose down
docker-compose build --no-cache
docker-compose up
```

### Executing Commands

```bash
# Run analysis
docker exec mcp-figma-v1 node scripts/figma-cli.js "URL"

# Install new package
docker exec mcp-figma-v1 npm install package-name

# Run linter
docker exec mcp-figma-v1 npm run lint

# Interactive shell
docker exec -it mcp-figma-v1 sh
```

### Volume Mounts

```yaml
# docker-compose.yml
volumes:
  # Hot reload (bidirectional)
  - ./src:/app/src
  - ./scripts:/app/scripts
  - ./server.js:/app/server.js

  # Shared data (host ← container)
  - ./src/generated:/app/src/generated
  - ./tmp:/app/tmp
  - ./data:/app/data

  # Prevent overwrite
  - /app/node_modules
```

### Debugging in Docker

**View container logs:**

```bash
docker logs mcp-figma-v1
```

**Inspect running container:**

```bash
docker exec -it mcp-figma-v1 sh

# Inside container
ls -la /app
ps aux
netstat -tlnp
```

**Check MCP connectivity:**

```bash
docker exec mcp-figma-v1 wget -O- http://host.docker.internal:3845/mcp
```

---

## Contributing

### Git Workflow

```bash
# 1. Create feature branch
git checkout -b feature/amazing-feature

# 2. Make changes
# ... edit files ...

# 3. Commit with conventional commits
git add .
git commit -m "feat: add amazing feature"

# Commit message format:
# feat: new feature
# fix: bug fix
# docs: documentation
# style: formatting
# refactor: code restructuring
# test: adding tests
# chore: maintenance

# 4. Push to fork
git push origin feature/amazing-feature

# 5. Open Pull Request on GitHub
```

### Pull Request Checklist

- [ ] **Tests pass** - `npm run lint` and `npm run build`
- [ ] **Docker builds** - `docker-compose up --build`
- [ ] **Documentation updated** - README, docs/, CLAUDE.md
- [ ] **Code formatted** - Consistent with existing style
- [ ] **Commits clean** - Meaningful commit messages
- [ ] **No console logs** - Remove debug statements
- [ ] **Screenshots included** - For UI changes
- [ ] **Breaking changes noted** - In PR description

### Code Review Process

1. **Automated Checks** - Linting, build verification
2. **Manual Review** - Code quality, design patterns
3. **Testing** - Verify functionality with real Figma designs
4. **Feedback** - Address comments and suggestions
5. **Approval** - Maintainer approval required
6. **Merge** - Squash and merge to main

---

## Code Style

### TypeScript

```typescript
// Use explicit types
function processNode(node: FigmaNode): ProcessedNode {
  // Implementation
}

// Use interfaces for objects
interface TestMetadata {
  nodeId: string
  nodeName: string
  timestamp: number
}

// Use type for unions
type ViewMode = 'grid' | 'list'

// Use enums sparingly
enum TransformPriority {
  EARLY = 10,
  MIDDLE = 50,
  LATE = 100
}
```

### React

```tsx
// Functional components with explicit return type
export default function MyComponent(): JSX.Element {
  return <div>Content</div>
}

// Props interface
interface MyComponentProps {
  title: string
  count?: number  // Optional
  onUpdate: (value: string) => void
}

export default function MyComponent({ title, count = 0, onUpdate }: MyComponentProps) {
  return <div onClick={() => onUpdate(title)}>{title} ({count})</div>
}
```

### File Naming

- **Components:** PascalCase - `MyComponent.tsx`
- **Hooks:** camelCase - `useMyHook.ts`
- **Utilities:** camelCase - `myUtil.ts`
- **Scripts:** kebab-case - `my-script.js`
- **Config:** kebab-case - `my-config.js`

### Imports

```typescript
// Order: External → Internal → Relative
import { useState, useEffect } from 'react'  // External
import { Button } from '@/components/ui/button'  // Internal (alias)
import { useTests } from '../../hooks/useTests'  // Relative
import './MyComponent.css'  // Styles last
```

---

## Next Steps

- See [TRANSFORMATIONS.md](TRANSFORMATIONS.md) for transform details
- See [API.md](API.md) for API documentation
- See [TROUBLESHOOTING.md](TROUBLESHOOTING.md) for common issues
- See [ARCHITECTURE.md](ARCHITECTURE.md) for system architecture
