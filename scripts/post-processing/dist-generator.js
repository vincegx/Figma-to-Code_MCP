import fs from 'fs'
import pathModule from 'path'
import { toPascalCase } from '../utils/chunking.js'
import { parse } from '@babel/parser'
import traverse from '@babel/traverse'
import generate from '@babel/generator'
import { runPipeline } from '../pipeline.js'

/**
 * Remove empty CSS section comments
 * Cleans up section headers that have no content after filtering
 * @param {string} css - CSS content
 * @returns {string} CSS with empty sections removed
 */
function removeEmptyCSSectionComments(css) {
  const lines = css.split('\n')
  const result = []
  let i = 0

  while (i < lines.length) {
    const line = lines[i]

    // Check if this is a section comment (/* ===== N. ... ===== */)
    if (line.match(/\/\* ===== \d+\./)) {
      // Look ahead to see if there's any content before next section or EOF
      let hasContent = false
      let j = i + 1

      while (j < lines.length) {
        const nextLine = lines[j]

        // If we hit another section comment or end of file, stop
        if (nextLine.match(/\/\* ===== \d+\./)) {
          break
        }

        // If we find non-empty, non-comment content, section has content
        if (nextLine.trim() && !nextLine.match(/^\/\*/)) {
          hasContent = true
          break
        }

        j++
      }

      // Only keep section comment if it has content
      if (hasContent) {
        result.push(line)
      }
      // else: skip this section comment (it's empty)
    } else {
      result.push(line)
    }

    i++
  }

  // Clean up excessive blank lines (more than 2 consecutive)
  return result.join('\n').replace(/\n{3,}/g, '\n\n')
}

/**
 * Reorganize component CSS by preserving existing sections
 * Generic approach: detects sections by comments, reorganizes in logical order
 * @param {string} css - CSS content
 * @param {string} componentName - Component name for header comment
 * @returns {string} Reorganized CSS
 */
function reorganizeComponentCSS(css, componentName) {
  const lines = css.split('\n')

  // Sections to extract
  const sections = {
    header: `/* Auto-generated scoped CSS for ${componentName} */\n`,
    imports: [],
    root: [],
    utilities: [],
    fonts: [],
    colors: [],
    dimensions: [],
    spacing: [],
    typography: [],
    layout: [],
    other: []  // Catch-all for unmapped sections
  }

  let currentSectionName = null
  let currentSectionBuffer = []
  let inRoot = false

  // Section mapping: comment text → section name
  const sectionMap = {
    'Figma-specific utility': 'utilities',
    'utility': 'utilities',
    'Utilities': 'utilities',
    'Font': 'fonts',
    'Fonts': 'fonts',
    'Color': 'colors',
    'Colors': 'colors',
    'Dimension': 'dimensions',
    'Dimensions': 'dimensions',
    'Spacing': 'spacing',
    'Typography': 'typography',
    'Layout': 'layout',
    'Other Custom': 'layout',  // Section 7 maps to Layout
    'Figma Variable': 'layout'  // Section 8 maps to Layout
  }

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i]

    // Detect @import
    if (line.startsWith('@import')) {
      sections.imports.push(line)
      continue
    }

    // Detect :root
    if (line.startsWith(':root')) {
      inRoot = true
      sections.root.push(line)
      continue
    }

    // Inside :root
    if (inRoot) {
      sections.root.push(line)
      if (line.includes('}') && !line.includes('{')) {
        inRoot = false
      }
      continue
    }

    // Skip old header comments
    if (line.match(/^\/\* Auto-generated scoped CSS/)) {
      continue
    }

    // Detect section comment
    const sectionMatch = line.match(/^\/\* (.*?) \*\//)
    if (sectionMatch) {
      const commentText = sectionMatch[1]

      // Save previous section buffer
      if (currentSectionName && currentSectionBuffer.length > 0) {
        sections[currentSectionName].push(...currentSectionBuffer)
        currentSectionBuffer = []
      }

      // Map comment to section
      let mappedSection = null
      for (const [key, value] of Object.entries(sectionMap)) {
        if (commentText.includes(key)) {
          mappedSection = value
          break
        }
      }

      currentSectionName = mappedSection || 'other'
      continue
    }

    // Add line to current section buffer
    if (currentSectionName) {
      currentSectionBuffer.push(line)
    }
  }

  // Save final buffer
  if (currentSectionName && currentSectionBuffer.length > 0) {
    sections[currentSectionName].push(...currentSectionBuffer)
  }

  // Build final CSS in logical order
  let result = [sections.header]

  if (sections.imports.length > 0) {
    result.push(...sections.imports, '')
  }

  if (sections.root.length > 0) {
    result.push(...sections.root, '')
  }

  // Define output order with section headers
  const outputSections = [
    { name: 'utilities', header: '/* Utilities */' },
    { name: 'fonts', header: '/* Fonts */' },
    { name: 'colors', header: '/* Colors */' },
    { name: 'dimensions', header: '/* Dimensions */' },
    { name: 'spacing', header: '/* Spacing */' },
    { name: 'typography', header: '/* Typography */' },
    { name: 'layout', header: '/* Layout */' },
    { name: 'other', header: '/* Other */' }
  ]

  for (const { name, header } of outputSections) {
    if (sections[name].length > 0) {
      result.push(header)
      result.push(...sections[name])
      result.push('')  // Add spacing after each section
    }
  }

  // Clean up excessive blank lines
  return result.join('\n').replace(/\n{3,}/g, '\n\n').trim() + '\n'
}

/**
 * Extract parent component name from Component-clean.tsx
 * @param {string} exportDir - Export directory path
 * @returns {string} Parent component function name
 */
function getParentComponentNameFromSource(exportDir) {
  const cleanPath = pathModule.join(exportDir, 'Component-clean.tsx')

  if (!fs.existsSync(cleanPath)) {
    throw new Error(`Component-clean.tsx not found in ${exportDir}`)
  }

  const content = fs.readFileSync(cleanPath, 'utf8')
  // Updated regex to support function signatures with props after Phase 2
  const match = content.match(/export default function (\w+)\(/)

  if (!match) {
    throw new Error('Could not extract component name from Component-clean.tsx')
  }

  return match[1]  // Returns actual function name (e.g., "Widget01Mobile")
}

/**
 * Generate Docker configuration files for dist/ package
 * @param {string} distDir - dist/ directory path
 * @param {object} config - Configuration
 */
async function generateDockerConfig(distDir, config) {
  const { componentName } = config

  // 1. Generate package.json
  const packageJson = {
    name: componentName.toLowerCase().replace(/\s+/g, '-'),
    version: '1.0.0',
    type: 'module',
    scripts: {
      dev: 'vite',
      build: 'vite build',
      preview: 'vite preview'
    },
    dependencies: {
      react: '^19.0.0',
      'react-dom': '^19.0.0'
    },
    devDependencies: {
      '@types/react': '^19.0.0',
      '@types/react-dom': '^19.0.0',
      '@vitejs/plugin-react': '^4.3.4',
      typescript: '^5.6.3',
      vite: '^6.0.1',
      tailwindcss: '^3.4.1',
      autoprefixer: '^10.4.17',
      postcss: '^8.4.33'
    }
  }

  fs.writeFileSync(
    pathModule.join(distDir, 'package.json'),
    JSON.stringify(packageJson, null, 2)
  )

  // 2. Generate docker-compose.yml
  const dockerCompose = `services:
  app:
    build: .
    ports:
      - "3000:3000"
    volumes:
      - ./components:/app/components
      - ./assets:/app/assets
      - ./tokens:/app/tokens
      - ./src:/app/src
      - ./Page.tsx:/app/Page.tsx
      - ./Page.css:/app/Page.css
      - ./index.html:/app/index.html
      - ./vite.config.js:/app/vite.config.js
      - ./tailwind.config.js:/app/tailwind.config.js
      - ./postcss.config.js:/app/postcss.config.js
    environment:
      - NODE_ENV=development
    command: npm run dev
`

  fs.writeFileSync(pathModule.join(distDir, 'docker-compose.yml'), dockerCompose)

  // 3. Generate Dockerfile
  const dockerfile = `FROM node:20-alpine

WORKDIR /app

# Copy package files
COPY package.json ./

# Install dependencies
RUN npm install

# Copy application files
COPY . .

# Expose port 3000
EXPOSE 3000

# Start development server
CMD ["npm", "run", "dev"]
`

  fs.writeFileSync(pathModule.join(distDir, 'Dockerfile'), dockerfile)

  // 4. Generate vite.config.js
  const viteConfig = `import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  server: {
    host: '0.0.0.0',
    port: 3000,
    strictPort: true
  }
})
`

  fs.writeFileSync(pathModule.join(distDir, 'vite.config.js'), viteConfig)

  // 5. Generate index.html
  const indexHtml = `<!doctype html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>${componentName}</title>
  </head>
  <body>
    <div id="root"></div>
    <script type="module" src="/src/main.tsx"></script>
  </body>
</html>
`

  fs.writeFileSync(pathModule.join(distDir, 'index.html'), indexHtml)

  // 6. Generate src/main.tsx
  const mainTsx = `import React from 'react'
import { createRoot } from 'react-dom/client'
import Page from '../Page'
import '../Page.css'

const root = createRoot(document.getElementById('root')!)
root.render(
  <React.StrictMode>
    <Page />
  </React.StrictMode>
)
`

  fs.writeFileSync(pathModule.join(distDir, 'src/main.tsx'), mainTsx)

  // 7. Generate .gitignore
  const gitignore = `# Dependencies
node_modules/

# Build output
dist/

# Environment
.env
.env.local

# IDE
.vscode/
.idea/

# OS
.DS_Store
Thumbs.db

# Logs
*.log
npm-debug.log*
`

  fs.writeFileSync(pathModule.join(distDir, '.gitignore'), gitignore)

  // 8. Generate tailwind.config.js
  const tailwindConfig = `/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./Page.tsx",
    "./components/**/*.{js,ts,jsx,tsx}",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {},
  },
  plugins: [],
}
`

  fs.writeFileSync(pathModule.join(distDir, 'tailwind.config.js'), tailwindConfig)

  // 9. Generate postcss.config.js
  const postcssConfig = `export default {
  plugins: {
    tailwindcss: {},
    autoprefixer: {},
  },
}
`

  fs.writeFileSync(pathModule.join(distDir, 'postcss.config.js'), postcssConfig)

  console.log(`    ✓ Generated Docker configuration (9 files)`)
}

/**
 * Generate developer-ready dist/ package
 * @param {string} exportDir - Export directory path
 * @param {object} config - Configuration
 * @param {string} config.type - 'single' | 'responsive'
 * @param {string} config.componentName - Main component name
 * @param {object} config.breakpoints - Responsive breakpoints (optional)
 */
export async function generateDist(exportDir, config) {
  const distDir = pathModule.join(exportDir, 'dist')
  const { type, componentName, breakpoints } = config

  console.log(`  Creating dist/ structure...`)

  // 1. Create directory structure
  await createDistStructure(distDir)

  // 2. Copy components/ → dist/components/ (subcomponents only)
  const sourceComponents = pathModule.join(exportDir, 'components')
  const extractedComponents = await copyComponents(sourceComponents, distDir, config)

  // 3. Generate or copy Page.tsx
  if (type === 'single') {
    // Generate Page.tsx from parent component with imports
    await generatePageFile(exportDir, distDir, config, extractedComponents)
  } else {
    // Copy existing Page.tsx for responsive merges
    copyPageFile(exportDir, distDir)
  }

  // 4. Copy assets
  await copyAssets(exportDir, distDir)

  // 5. Generate design tokens
  await generateDesignTokens(exportDir, distDir, config)

  // 6. Generate README
  await generateReadmeWrapper(exportDir, distDir, config)

  // 7. Generate Docker configuration
  await generateDockerConfig(distDir, config)

  console.log(`  ✅ dist/ package created`)
}

function createDistStructure(distDir) {
  // Clean dist directory if it exists
  if (fs.existsSync(distDir)) {
    fs.rmSync(distDir, { recursive: true, force: true })
  }

  // Create fresh structure
  const dirs = ['components', 'assets/img', 'tokens', 'src']
  for (const dir of dirs) {
    fs.mkdirSync(pathModule.join(distDir, dir), { recursive: true })
  }
}

async function copyComponents(sourceDir, distDir, config) {
  if (!fs.existsSync(sourceDir)) {
    throw new Error(`components/ directory not found at ${sourceDir}`)
  }

  const files = fs.readdirSync(sourceDir)
  const componentFiles = files.filter(f => f.endsWith('.tsx') || f.endsWith('.css'))

  // Get parent component name (to exclude it for single exports)
  const parentComponentName = config.type === 'single'
    ? getParentComponentNameFromSource(sourceDir.replace('/components', ''))
    : null

  const extractedComponents = []
  let copiedCount = 0

  for (const file of componentFiles) {
    // Skip image-manifest.json (metadata file)
    if (file === 'image-manifest.json') {
      continue
    }

    // Skip parent component for single exports (will be transformed into Page.tsx)
    if (parentComponentName && file.startsWith(parentComponentName + '.')) {
      console.log(`    ⏩ Skipping parent component: ${file} (will generate Page.tsx)`)
      continue
    }

    // Track extracted component names (only .tsx files)
    if (file.endsWith('.tsx')) {
      extractedComponents.push(file.replace('.tsx', ''))
    }

    let content = fs.readFileSync(pathModule.join(sourceDir, file), 'utf8')

    // Extract props for .tsx files (only if they don't already have props from Figma)
    if (file.endsWith('.tsx')) {
      const componentName = file.replace('.tsx', '')

      // Check if component already has props (from Figma variants)
      const hasExistingProps = content.match(new RegExp(`}: ${componentName}Props\\)`))

      if (hasExistingProps) {
        // Skip extract-props, just add missing interface from Component-clean.tsx
        if (!content.includes(`interface ${componentName}Props`) && !content.includes(`type ${componentName}Props`)) {
          const cleanTsxPath = pathModule.join(sourceDir.replace('/components', ''), 'Component-clean.tsx')
          if (fs.existsSync(cleanTsxPath)) {
            const cleanContent = fs.readFileSync(cleanTsxPath, 'utf8')
            // Match full type/interface declaration including all props
            const interfaceMatch = cleanContent.match(new RegExp(`(type ${componentName}Props\\s*=\\s*\\{[\\s\\S]*?\\};|interface ${componentName}Props\\s*\\{[\\s\\S]*?\\})`, 'm'))
            if (interfaceMatch) {
              // Add interface after imports
              content = content.replace(
                /(import .*\n)+/,
                `$&\n${interfaceMatch[0]}\n`
              )
              console.log(`    ✅ ${file} - interface added from Figma`)
            }
          }
        }
      } else {
        // No existing props - run extract-props
        const pipelineConfig = { 'extract-props': { enabled: true } }
        try {
          const result = await runPipeline(content, { componentName }, pipelineConfig)
          content = result.code
          const stats = result.context.stats['extract-props']
          if (stats && stats.propsExtracted > 0) {
            console.log(`    ✅ ${file} - ${stats.propsExtracted} props extracted`)
          }
        } catch (error) {
          console.log(`    ⚠️  ${file} - props extraction skipped: ${error.message}`)
        }
      }

      // THEN fix import paths: ./img/ → ../assets/img/
      // Use replacement function to preserve quote style
      content = content.replace(/from (["'])(\.\/img\/)([^"']+)\1/g, (match, quote, path, file) => {
        return `from ${quote}../assets/img/${file}${quote}`
      })
      content = content.replace(/from (["'])(\.\.\/img\/)([^"']+)\1/g, (match, quote, path, file) => {
        return `from ${quote}../assets/img/${file}${quote}`
      })

      fs.writeFileSync(pathModule.join(distDir, 'components', file), content)
      copiedCount++
    }

    // Copy CSS files (already optimized by sync-optimizer) and reorganize
    if (file.endsWith('.css')) {
      let cssContent = fs.readFileSync(pathModule.join(sourceDir, file), 'utf8')
      const componentName = file.replace('.css', '')

      // Reorganize CSS by category
      cssContent = reorganizeComponentCSS(cssContent, componentName)

      fs.writeFileSync(pathModule.join(distDir, 'components', file), cssContent)
      copiedCount++
    }
  }

  console.log(`    ✓ Copied ${copiedCount} reusable component files`)
  return extractedComponents
}

/**
 * Generate Page.tsx for single exports (transform parent component)
 */
async function generatePageFile(exportDir, distDir, config, extractedComponents) {
  const parentComponentName = getParentComponentNameFromSource(exportDir)

  // ALWAYS use Component-clean.tsx as source (parent is never split into components/)
  const parentTsxPath = pathModule.join(exportDir, 'Component-clean.tsx')
  const parentCssPath = pathModule.join(exportDir, 'Component-clean.css')

  if (!fs.existsSync(parentTsxPath)) {
    console.log(`    ⚠️  Component-clean.tsx not found`)
    return
  }

  const parentCode = fs.readFileSync(parentTsxPath, 'utf8')

  // Transform parent component → Page.tsx with imports
  const pageCode = transformToPageComponent(parentCode, parentComponentName, extractedComponents, exportDir)

  // Fix import paths: ./img/ → ./assets/img/
  // Use replacement function to preserve quote style
  let fixedPageCode = pageCode
    .replace(/from (["'])(\.\/img\/)([^"']+)\1/g, (match, quote, path, file) => {
      return `from ${quote}./assets/img/${file}${quote}`
    })
    .replace(/from (["'])(\.\.\/img\/)([^"']+)\1/g, (match, quote, path, file) => {
      return `from ${quote}./assets/img/${file}${quote}`
    })

  // Save to dist root (not dist/components/)
  fs.writeFileSync(pathModule.join(distDir, 'Page.tsx'), fixedPageCode)

  // Generate Page.css scopé + optimized
  if (fs.existsSync(parentCssPath)) {
    const fullCSS = fs.readFileSync(parentCssPath, 'utf8')
    const pageCode = fs.readFileSync(pathModule.join(distDir, 'Page.tsx'), 'utf8')

    // Import optimizer functions
    const { extractUsedClasses, filterCSSByClasses, optimizeCSS } = await import('./css-optimizer.js')

    // 1. Extract classes used in Page.tsx
    const usedClasses = extractUsedClasses(pageCode)

    // 2. Filter Component-clean.css to only keep used classes
    let scopedCSS = filterCSSByClasses(fullCSS, usedClasses)

    // 3. Optimize the scoped CSS
    scopedCSS = optimizeCSS(scopedCSS, {
      roundDecimals: true,
      mapVariables: true,
      convertTailwind: true
    })

    // 4. Generate @import statements for extracted components
    const componentImports = extractedComponents
      .map(name => `@import './components/${name}.css';`)
      .join('\n')

    // 5. Prepend Tailwind directives for Docker builds
    const tailwindDirectives = `/* Tailwind CSS directives */
@tailwind base;
@tailwind components;
@tailwind utilities;

`

    // 6. Combine: Tailwind + imports + scoped optimized CSS
    let finalCSS = tailwindDirectives + componentImports + '\n\n' + scopedCSS

    // 7. Clean up empty section comments
    finalCSS = removeEmptyCSSectionComments(finalCSS)

    fs.writeFileSync(pathModule.join(distDir, 'Page.css'), finalCSS)

    console.log(`    ✓ Page.css - scoped and optimized (${usedClasses.size} classes)`)
  }

  console.log(`    ✓ Generated Page.tsx with ${extractedComponents.length} component imports`)
}

/**
 * Transform parent component to Page component with imports
 * Replaces div[data-name] with component calls (reuses responsive-merger logic)
 */
function transformToPageComponent(sourceCode, parentName, extractedComponents, exportDir) {
  // Parse source code into AST
  const ast = parse(sourceCode, {
    sourceType: 'module',
    plugins: ['jsx', 'typescript']
  })

  const componentsToImport = new Set()

  // Load component-mapping.json (node-id → component name)
  const mappingPath = pathModule.join(exportDir, 'components', 'component-mapping.json')
  let componentMapping = {}

  if (fs.existsSync(mappingPath)) {
    componentMapping = JSON.parse(fs.readFileSync(mappingPath, 'utf8'))
    console.log(`    ✓ Loaded component-mapping.json (${Object.keys(componentMapping).length} components)`)
  } else {
    console.log(`    ⚠️  component-mapping.json not found, using fallback data-name matching`)
  }

  // Build fallback mapping: data-name (case-insensitive) → component name
  const dataNameMap = new Map()
  for (const componentName of extractedComponents) {
    dataNameMap.set(componentName.toLowerCase(), componentName)
  }

  // STEP 1: Remove function declarations that were extracted as components
  traverse.default(ast, {
    FunctionDeclaration(path) {
      const functionName = path.node.id?.name
      if (functionName && extractedComponents.includes(functionName)) {
        path.remove()
        console.log(`    🗑️  Removed duplicate function: ${functionName}`)
      }
    }
  })

  // STEP 2: Traverse and replace div[data-name] with component calls
  traverse.default(ast, {
    JSXElement(path) {
      const openingElement = path.node.openingElement

      // Check if component is in extractedComponents (needs import)
      if (openingElement.name.type === 'JSXIdentifier') {
        const componentName = openingElement.name.name
        if (extractedComponents.includes(componentName)) {
          componentsToImport.add(componentName)
        }
      }

      // Check if it's a div with data-node-id attribute (replace with component)
      if (openingElement.name.type === 'JSXIdentifier' && openingElement.name.name === 'div') {
        const dataNodeIdAttr = openingElement.attributes.find(
          attr => attr.type === 'JSXAttribute' &&
                  attr.name?.name === 'data-node-id' &&
                  attr.value?.type === 'StringLiteral'
        )

        const dataNameAttr = openingElement.attributes.find(
          attr => attr.type === 'JSXAttribute' &&
                  attr.name?.name === 'data-name' &&
                  attr.value?.type === 'StringLiteral'
        )

        let componentName = null
        let matchMethod = null

        // PRIORITY 1: Match by data-node-id via component-mapping.json
        if (dataNodeIdAttr) {
          const nodeId = dataNodeIdAttr.value.value
          componentName = componentMapping[nodeId]
          if (componentName) {
            matchMethod = 'node-id'
          }
        }

        // PRIORITY 2: Fallback to data-name matching
        if (!componentName && dataNameAttr) {
          const dataName = dataNameAttr.value.value
          const pascalDataName = toPascalCase(dataName)
          componentName = dataNameMap.get(pascalDataName.toLowerCase())
          if (componentName) {
            matchMethod = 'data-name'
          }
        }

        // Replace div with component if match found
        if (componentName && extractedComponents.includes(componentName)) {
          componentsToImport.add(componentName)

          path.replaceWith({
            type: 'JSXElement',
            openingElement: {
              type: 'JSXOpeningElement',
              name: { type: 'JSXIdentifier', name: componentName },
              attributes: [],
              selfClosing: true
            },
            closingElement: null,
            children: []
          })

          const dataNameValue = dataNameAttr?.value?.value || 'unknown'
          console.log(`    🔄 Replaced data-name="${dataNameValue}" with <${componentName} /> (matched by ${matchMethod})`)
        }
      }
    }
  })

  // STEP 3: NOW collect helpers used in the MODIFIED AST
  const usedHelpers = new Set()
  traverse.default(ast, {
    FunctionDeclaration(path) {
      const functionName = path.node.id?.name
      if (functionName === 'Page' || functionName === parentName) {
        // Find all JSX components used in this function
        path.traverse({
          JSXOpeningElement(innerPath) {
            if (innerPath.node.name.type === 'JSXIdentifier') {
              usedHelpers.add(innerPath.node.name.name)
            }
          }
        })
      }
    }
  })

  // STEP 4: Remove unused helper functions
  traverse.default(ast, {
    FunctionDeclaration(path) {
      const functionName = path.node.id?.name
      if (!functionName) return

      // Keep Page function
      if (functionName === 'Page' || functionName === parentName) return

      // Remove if not used in Page function
      if (!usedHelpers.has(functionName)) {
        path.remove()
        console.log(`    🗑️  Removed unused helper: ${functionName}`)
      }
    }
  })

  // STEP 4.5: Remove orphan TypeScript types (belong to extracted components)
  traverse.default(ast, {
    TSTypeAliasDeclaration(path) {
      const typeName = path.node.id.name
      // Remove types that match extracted component names (ComponentNameProps)
      if (typeName.endsWith('Props')) {
        const componentName = typeName.replace(/Props$/, '')
        if (extractedComponents.includes(componentName)) {
          path.remove()
          console.log(`    🗑️  Removed orphan type: ${typeName} (belongs to ${componentName})`)
        }
      }
    },
    TSInterfaceDeclaration(path) {
      const interfaceName = path.node.id.name
      // Remove interfaces that match extracted component names (ComponentNameProps)
      if (interfaceName.endsWith('Props')) {
        const componentName = interfaceName.replace(/Props$/, '')
        if (extractedComponents.includes(componentName)) {
          path.remove()
          console.log(`    🗑️  Removed orphan interface: ${interfaceName} (belongs to ${componentName})`)
        }
      }
    }
  })

  // STEP 5: Find images still used in Page.tsx (after component extraction)
  const usedImages = new Set()

  // Only traverse the JSX return statement, not imports
  traverse.default(ast, {
    ReturnStatement(path) {
      const jsx = path.node.argument
      if (!jsx) return

      // Convert JSX to string to search for image references
      const jsxCode = generate.default(jsx).code

      // Pattern 1: src={imgVariableName}
      const srcRegex = /src=\{(\w+)\}/g
      let match
      while ((match = srcRegex.exec(jsxCode)) !== null) {
        usedImages.add(match[1])
      }

      // Pattern 2: url('${imgVariableName}') or url("${imgVariableName}")
      const urlRegex = /url\(['"`]\$\{(\w+)\}['"`]\)/g
      while ((match = urlRegex.exec(jsxCode)) !== null) {
        usedImages.add(match[1])
      }

      // Pattern 3: Any ${imgVar} in template literals (for maskImage, backgroundImage, etc.)
      const templateRegex = /\$\{(\w+)\}/g
      while ((match = templateRegex.exec(jsxCode)) !== null) {
        const varName = match[1]
        // Only add if it looks like an image variable
        if (varName.startsWith('img') ||
            varName.toLowerCase().includes('image') ||
            varName.toLowerCase().includes('icon') ||
            varName.toLowerCase().includes('logo') ||
            varName.toLowerCase().includes('picture')) {
          usedImages.add(varName)
        }
      }
    }
  })

  // STEP 6: Remove only UNUSED image imports (images moved to extracted components)
  // Keep images that are still used in Page.tsx JSX
  traverse.default(ast, {
    ImportDeclaration(path) {
      const source = path.node.source.value
      // Check if it's an image import
      if (source.match(/\.(png|jpg|jpeg|svg|gif|webp)$/i)) {
        const importName = path.node.specifiers[0]?.local?.name
        // Only remove if NOT used in Page.tsx
        if (!usedImages.has(importName)) {
          path.remove()
          console.log(`    🗑️  Removed image import: ${importName} (belongs to component)`)
        } else {
          console.log(`    ✅ Kept image import: ${importName} (used in Page.tsx)`)
        }
      }
    }
  })

  // Generate transformed code
  const output = generate.default(ast, { retainLines: false, compact: false })
  let finalCode = output.code

  // Add component imports after React import with header comment
  const imports = Array.from(componentsToImport)
    .map(name => `import ${name} from './components/${name}';`)
    .join('\n')

  const header = `/**
 * Page Component
 * Main page orchestrating all subcomponents
 * Generated from Figma design - Developer-ready export
 */
`

  finalCode = finalCode.replace(
    /import React from ['"]react['"];/,
    `${header}import React from 'react';\nimport './Page.css';\n\n// ========================================\n// Component Imports\n// ========================================\n\n${imports}`
  )

  // Remove CSS imports (already added above as './Page.css')
  // Remove parent function name CSS
  finalCode = finalCode.replace(`import './${parentName}.css';`, '')
  finalCode = finalCode.replace(`import "./${parentName}.css";`, '')
  // Remove Component-clean.css (always present in source)
  finalCode = finalCode.replace(`import './Component-clean.css';`, '')
  finalCode = finalCode.replace(`import "./Component-clean.css";`, '')

  // Remove orphan "// Image imports" comments (when no images remain)
  finalCode = finalCode.replace(/\/\/ Image imports\s*\n/g, '')

  // Rename main function to Page with comment
  finalCode = finalCode.replace(
    /export default function \w+\(\)/,
    '\n// ========================================\n// Main Page Component\n// ========================================\n\nexport default function Page()'
  )

  // Clean up excessive blank lines
  finalCode = finalCode.replace(/\n{3,}/g, '\n\n')

  return finalCode
}

function copyPageFile(exportDir, distDir) {
  // Copy Page.tsx and Page.css for responsive merges
  const pageTsx = pathModule.join(exportDir, 'Page.tsx')
  const pageCss = pathModule.join(exportDir, 'Page.css')

  if (fs.existsSync(pageTsx)) {
    let content = fs.readFileSync(pageTsx, 'utf8')
    // Save to dist root (not dist/components/)
    fs.writeFileSync(pathModule.join(distDir, 'Page.tsx'), content)
  }

  if (fs.existsSync(pageCss)) {
    let content = fs.readFileSync(pageCss, 'utf8')

    // Prepend Tailwind directives for Docker builds
    const tailwindDirectives = `/* Tailwind CSS directives */
@tailwind base;
@tailwind components;
@tailwind utilities;

`
    content = tailwindDirectives + content

    // Save to dist root (not dist/components/)
    fs.writeFileSync(pathModule.join(distDir, 'Page.css'), content)
  }

  console.log(`    ✓ Copied Page.tsx and Page.css`)
}

function copyAssets(exportDir, distDir) {
  const imgSource = pathModule.join(exportDir, 'img')
  if (fs.existsSync(imgSource)) {
    // Recursive copy using cpSync (Node 16.7+)
    fs.cpSync(imgSource, pathModule.join(distDir, 'assets/img'), { recursive: true })
    const count = fs.readdirSync(imgSource).length
    console.log(`    ✓ Copied ${count} images`)
  }
}

async function generateDesignTokens(exportDir, distDir, config) {
  let variablesPath = pathModule.join(exportDir, 'variables.json')

  // For responsive merges, get variables.json from Desktop export
  if (config.type === 'responsive') {
    const metadataPath = pathModule.join(exportDir, 'responsive-metadata.json')
    if (fs.existsSync(metadataPath)) {
      const metadata = JSON.parse(fs.readFileSync(metadataPath, 'utf8'))
      const desktopTestId = metadata.breakpoints?.desktop?.testId

      if (desktopTestId) {
        const desktopVariablesPath = pathModule.join(
          exportDir,
          '..',
          '..',
          'export_figma',
          desktopTestId,
          'variables.json'
        )

        if (fs.existsSync(desktopVariablesPath)) {
          variablesPath = desktopVariablesPath
        }
      }
    }
  }

  if (!fs.existsSync(variablesPath)) {
    console.log(`    ⚠️  variables.json not found, skipping tokens`)
    return
  }

  const { generateTokens } = await import('./generate-design-tokens.js')
  generateTokens(variablesPath, pathModule.join(distDir, 'tokens'))
  console.log(`    ✓ Generated design tokens (3 formats)`)
}

async function generateReadmeWrapper(exportDir, distDir, config) {
  const { generateReadme } = await import('../reporting/generate-readme.js')
  const metadataPath = pathModule.join(exportDir, 'metadata.json')

  let metadata = {}
  if (fs.existsSync(metadataPath)) {
    metadata = JSON.parse(fs.readFileSync(metadataPath, 'utf8'))
  } else {
    // For responsive merges, might not have metadata.json at root
    metadata = {
      nodeName: config.componentName,
      timestamp: Date.now()
    }
  }

  generateReadme(distDir, metadata, config)
  console.log(`    ✓ Generated README.md`)
}
