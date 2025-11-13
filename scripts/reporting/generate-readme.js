import fs from 'fs'
import path from 'path'

/**
 * Generate README.md for dist/ package
 * @param {string} distDir - dist/ directory path
 * @param {object} metadata - Metadata from export
 * @param {object} config - Configuration
 */
export function generateReadme(distDir, metadata, config) {
  const { type, componentName, breakpoints } = config

  let readme = `# ${metadata.nodeName || componentName}

Generated from Figma on ${new Date(metadata.timestamp).toLocaleString()}

## Docker Quick Start (Recommended)

The fastest way to preview this component:

\`\`\`bash
# 1. Navigate to the dist/ folder
cd dist/

# 2. Start Docker container (installs dependencies and starts dev server)
docker compose up

# 3. Open in browser
# http://localhost:3000
\`\`\`

The container includes:
- ✅ React 19 + TypeScript
- ✅ Vite dev server with hot reload
- ✅ All dependencies pre-configured
- ✅ Ready to customize and extend

To stop: Press \`Ctrl+C\` or run \`docker compose down\`

**Prerequisites**: Docker and Docker Compose installed on your system

---

## Manual Setup

### 1. Copy files to your project
\`\`\`bash
cp -r components/ your-project/src/components/
cp -r assets/ your-project/public/
cp tokens/variables.css your-project/src/styles/
\`\`\`

### 2. Import design tokens
\`\`\`tsx
// In your main CSS or App.tsx
import './styles/variables.css'
\`\`\`

### 3. Use components
\`\`\`tsx
`

  // Component import examples (individual components, not Page)
  const componentsDir = path.join(distDir, 'components')
  const files = fs.readdirSync(componentsDir)
  const components = files
    .filter(f => f.endsWith('.tsx') && f !== 'Page.tsx')
    .map(f => f.replace('.tsx', ''))
    .slice(0, 3) // Show first 3 components as examples

  // Use actual component names or fallback to generic examples
  const exampleComponents = components.length > 0 ? components : ['Header', 'Footer']

  readme += `import ${exampleComponents[0]} from './components/${exampleComponents[0]}'\n`
  if (exampleComponents[1]) {
    readme += `import ${exampleComponents[1]} from './components/${exampleComponents[1]}'\n`
  }
  readme += `\n`
  readme += `function App() {\n`
  readme += `  return (\n`
  readme += `    <div>\n`
  readme += `      <${exampleComponents[0]} />\n`
  readme += `      {/* Your content */}\n`
  if (exampleComponents[1]) {
    readme += `      <${exampleComponents[1]} />\n`
  }
  readme += `    </div>\n`
  readme += `  )\n`
  readme += `}\n`
  readme += `\`\`\`\n\n`

  // List all components
  readme += `## Components\n\n`
  const allComponents = files.filter(f => f.endsWith('.tsx')).map(f => f.replace('.tsx', ''))

  // Separate parent component (layout example) from reusable components
  const parentComponent = type === 'single'
    ? allComponents.find(c => c === componentName || c.includes(componentName.replace(/\s+/g, '')))
    : allComponents.find(c => c === 'Page')

  const reusableComponents = allComponents.filter(c => c !== parentComponent)

  // Show parent component first as layout example
  if (parentComponent) {
    readme += `### Layout Example\n\n`
    readme += `- **${parentComponent}** - Complete layout showing how to assemble components with proper CSS wrappers\n`
    readme += `  \`\`\`tsx\n`
    readme += `  import ${parentComponent} from './${parentComponent}'\n`
    readme += `  \`\`\`\n\n`
  }

  // Show reusable components
  if (reusableComponents.length > 0) {
    readme += `### Reusable Components\n\n`
    for (const comp of reusableComponents) {
      readme += `- **${comp}** - \`import ${comp} from './components/${comp}'\`\n`
    }
  }

  // Design tokens section
  readme += `\n## Design Tokens

Available in \`tokens/\`:
- \`variables.css\` - CSS custom properties
- \`tokens.ts\` - TypeScript constants
- \`tailwind.config.js\` - Tailwind theme extension

### Usage
\`\`\`css
/* Use CSS variables */
.my-element {
  color: var(--color-accent);
  background: var(--color-primary);
}
\`\`\`

\`\`\`tsx
/* Use TypeScript constants */
import { colors } from './tokens/tokens'

const myColor = colors.accent
\`\`\`

## Customization

### Change colors
Edit \`tokens/variables.css\`:
\`\`\`css
:root {
  --color-accent: #YOUR_COLOR;
}
\`\`\`
`

  // Add responsive breakpoints section if needed
  if (type === 'responsive' && breakpoints) {
    readme += `\n## Responsive Breakpoints

This export includes responsive components with media queries:
- **Desktop**: ${breakpoints.desktop}px and above
- **Tablet**: ${breakpoints.tablet}px to ${breakpoints.desktop - 1}px
- **Mobile**: ${breakpoints.mobile}px and below

Components automatically adapt to screen size using CSS media queries.

### Example responsive styles
\`\`\`css
/* Desktop (default) */
.header { padding: 2rem; }

/* Tablet */
@media (max-width: ${breakpoints.tablet}px) {
  .header { padding: 1.5rem; }
}

/* Mobile */
@media (max-width: ${breakpoints.mobile}px) {
  .header { padding: 1rem; }
}
\`\`\`
`
  }

  // Deployment section
  readme += `\n## Deploy

### Vercel
\`\`\`bash
npm install vercel -g
vercel
\`\`\`

### Netlify
\`\`\`bash
npm install netlify-cli -g
netlify deploy
\`\`\`

## Troubleshooting

### Port 3000 already in use
If port 3000 is already taken, modify \`docker-compose.yml\`:
\`\`\`yaml
ports:
  - "3001:3000"  # Use port 3001 on host instead
\`\`\`

### Images not loading
Make sure the \`assets/\` folder is in the same directory as your components.

### Fonts not rendering
Check that \`tokens/variables.css\` is imported in your main CSS file.

## Support

For technical details, refer to the analysis in \`../analysis.md\`
`

  fs.writeFileSync(path.join(distDir, 'README.md'), readme)
}
