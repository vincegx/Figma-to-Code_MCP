#!/usr/bin/env node
/**
 * UNIFIED PROCESSOR - Simple pipeline-based transformation system
 *
 * Processes Figma-generated React components through AST transformations.
 *
 * Usage:
 *   node scripts/unified-processor.js <input.tsx> <output.tsx> [metadata.xml] [figmaUrl]
 */

import fs from 'fs'
import path from 'path'
import { execSync } from 'child_process'

// Import simple pipeline
import { runPipeline } from './pipeline.js'
import { defaultConfig } from './config.js'

// Import helper modules
import * as cssVars from './transformations/css-vars.js'

// ═══════════════════════════════════════════════════════════════
// CLI ARGUMENTS
// ═══════════════════════════════════════════════════════════════

const inputFile = process.argv[2]
const outputFile = process.argv[3]
const metadataXmlPath = process.argv[4]
const figmaUrl = process.argv[5]

if (!inputFile || !outputFile) {
  console.error('Usage: node unified-processor.js <input.tsx> <output.tsx> [metadata.xml] [figmaUrl]')
  process.exit(1)
}

// ═══════════════════════════════════════════════════════════════
// DETECT CHUNKING MODE
// ═══════════════════════════════════════════════════════════════

const inputDir = path.dirname(inputFile)
const testDir = inputFile.includes('/chunks/') ? path.dirname(inputDir) : inputDir
const chunksDir = path.join(testDir, 'chunks')

const isChunkingMode = fs.existsSync(chunksDir) && !inputFile.includes('/chunks/')

console.log(`🔍 Mode: ${isChunkingMode ? 'CHUNKING' : 'NORMAL'}`)

if (isChunkingMode) {
  console.log('   Detected chunks/ directory - will process chunks individually')

  const chunksFixedDir = path.join(testDir, 'chunks-fixed')

  if (!fs.existsSync(chunksFixedDir)) {
    fs.mkdirSync(chunksFixedDir, { recursive: true })
    console.log(`   Created ${chunksFixedDir}`)
  }

  const chunkFiles = fs.readdirSync(chunksDir)
    .filter(f => f.endsWith('.tsx'))
    .map(f => ({
      name: f,
      path: path.join(chunksDir, f),
      outputPath: path.join(chunksFixedDir, f)
    }))

  console.log(`   Found ${chunkFiles.length} chunks to process`)

  // Process each chunk
  for (const chunk of chunkFiles) {
    console.log(`\n   📦 Processing ${chunk.name}...`)
    try {
      execSync(
        `node scripts/unified-processor.js "${chunk.path}" "${chunk.outputPath}" "${metadataXmlPath || ''}"`,
        {
          cwd: path.join(path.dirname(new URL(import.meta.url).pathname), '..'),
          stdio: 'inherit'
        }
      )
    } catch (error) {
      console.error(`   ❌ Failed to process ${chunk.name}: ${error.message}`)
      process.exit(1)
    }
  }

  // Generate Component-fixed.tsx with imports
  console.log(`\n   📝 Generating ${outputFile} with imports...`)

  const toPascalCase = (name) => {
    return name.charAt(0).toUpperCase() + name.slice(1)
  }

  const imports = chunkFiles.map(chunk => {
    const fileName = path.basename(chunk.name, '.tsx')
    const componentName = toPascalCase(fileName)
    return `import ${componentName} from './chunks-fixed/${fileName}';`
  }).join('\n')

  const componentCalls = chunkFiles.map(chunk => {
    const fileName = path.basename(chunk.name, '.tsx')
    const componentName = toPascalCase(fileName)
    return `      <${componentName} />`
  }).join('\n')

  const componentCode = fs.readFileSync(inputFile, 'utf-8')
  const componentNameMatch = componentCode.match(/export default function (\w+)/)
  const componentName = componentNameMatch ? componentNameMatch[1] : 'Component'

  const finalCode = `import React from 'react';
${imports}

export default function ${componentName}() {
  return (
    <div className="w-full">
${componentCalls}
    </div>
  );
}
`

  fs.writeFileSync(outputFile, finalCode, 'utf-8')
  console.log(`   ✅ Generated ${outputFile}`)
  console.log(`\n✅ Chunking mode complete - processed ${chunkFiles.length} chunks`)

  process.exit(0)
}

// ═══════════════════════════════════════════════════════════════
// NORMAL MODE: Process single file with pipeline
// ═══════════════════════════════════════════════════════════════

console.log('🚀 Unified Processor - Starting...')
console.log(`   Input:  ${inputFile}`)
console.log(`   Output: ${outputFile}`)

let sourceCode
try {
  sourceCode = fs.readFileSync(inputFile, 'utf8')
} catch (error) {
  console.error(`❌ Error reading input file: ${error.message}`)
  process.exit(1)
}

if (metadataXmlPath && fs.existsSync(metadataXmlPath)) {
  console.log(`   Metadata: ${metadataXmlPath}`)
}

// ═══════════════════════════════════════════════════════════════
// PREPARE CONTEXT DATA
// ═══════════════════════════════════════════════════════════════

const variablesPath = `${testDir}/variables.json`
let primaryFont = null
let googleFontsUrl = null
const cssVariables = {}

if (fs.existsSync(variablesPath)) {
  try {
    const variables = JSON.parse(fs.readFileSync(variablesPath, 'utf-8'))
    const fontPattern = /Font\(family:\s*"([^"]+)",\s*style:\s*(\w+),\s*size:\s*([\d.]+),\s*weight:\s*(\d+)/g
    const fontsMap = new Map()

    for (const [key, value] of Object.entries(variables)) {
      // Extract fonts
      if (typeof value === 'string' && value.startsWith('Font(')) {
        const match = fontPattern.exec(value)
        if (match) {
          const [, family, , , weight] = match
          if (!fontsMap.has(family)) {
            fontsMap.set(family, new Set())
          }
          fontsMap.get(family).add(parseInt(weight))
        }
        fontPattern.lastIndex = 0
      } else if (typeof value === 'string' && !value.startsWith('Font(')) {
        // Convert Figma variable names to CSS custom property names
        const cssVarName = '--' + key.toLowerCase().replace(/\//g, '-').replace(/\s+/g, '-')

        // Add 'px' unit to numeric values
        let cssValue = value
        if (/^\d+(\.\d+)?$/.test(value) && !cssVarName.includes('color')) {
          cssValue = `${value}px`
        }

        cssVariables[cssVarName] = cssValue
      }
    }

    if (fontsMap.size > 0) {
      primaryFont = Array.from(fontsMap.keys())[0]
      const googleFontsUrls = []
      for (const [family, weights] of fontsMap) {
        const weightsStr = Array.from(weights).sort((a, b) => a - b).join(';')
        const familyParam = family.replace(/ /g, '+')
        googleFontsUrls.push(`family=${familyParam}:wght@${weightsStr}`)
      }
      googleFontsUrl = `https://fonts.googleapis.com/css2?${googleFontsUrls.join('&')}&display=swap`
      console.log(`   Font detected: ${primaryFont} (${Array.from(fontsMap.get(primaryFont)).join(', ')})`)
    }

    console.log(`   CSS variables extracted: ${Object.keys(cssVariables).length}`)
  } catch (error) {
    console.log(`   ⚠️  Could not parse variables.json: ${error.message}`)
  }
}

// ═══════════════════════════════════════════════════════════════
// EXECUTE PIPELINE
// ═══════════════════════════════════════════════════════════════

console.log('\n🔄 Running transform pipeline...')

let result
try {
  result = await runPipeline(sourceCode, {
    primaryFont,
    googleFontsUrl,
    cssVariables,
    inputDir,
    metadataXmlPath,
    analysis: {
      sections: [],
      totalNodes: 0,
      imagesCount: 0
    }
  }, defaultConfig)
} catch (error) {
  console.error(`❌ Pipeline execution failed: ${error.message}`)
  console.error(error.stack)
  process.exit(1)
}

let outputCode = result.code
const context = result.context

console.log(`\n✅ Pipeline complete in ${result.totalTime}ms`)
console.log('\n📊 Transform Stats:')
for (const [transformName, stats] of Object.entries(context.stats)) {
  console.log(`   ${transformName}: ${stats.executionTime}ms`)

  // Log specific stats
  const details = []
  if (stats.fontsConverted) details.push(`${stats.fontsConverted} fonts`)
  if (stats.classesFixed) details.push(`${stats.classesFixed} classes`)
  if (stats.varsConverted) details.push(`${stats.varsConverted} vars`)
  if (stats.customClassesGenerated) details.push(`${stats.customClassesGenerated} custom classes`)
  if (stats.wrappersFlattened) details.push(`${stats.wrappersFlattened} wrappers flattened`)
  if (stats.compositesInlined) details.push(`${stats.compositesInlined} composites inlined`)
  if (stats.gradientsFixed) details.push(`${stats.gradientsFixed} gradients`)
  if (stats.classesOptimized) details.push(`${stats.classesOptimized} optimized`)

  if (details.length > 0) {
    console.log(`      → ${details.join(', ')}`)
  }
}

// ═══════════════════════════════════════════════════════════════
// SAFETY NET: Catch-all regex for remaining CSS vars
// ═══════════════════════════════════════════════════════════════

console.log('\n🛡️  Applying safety net (CSS vars catch-all)...')

const safetyNet = cssVars.applySafetyNetRegex(outputCode)
outputCode = safetyNet.code

if (safetyNet.varsFound > 0) {
  if (safetyNet.varsFixed > 0) {
    console.log(`   ⚠️  Safety net caught ${safetyNet.varsFixed} CSS vars that escaped pipeline`)
  } else {
    console.log(`   ✅ All CSS vars already converted by pipeline`)
  }
}

// Update context with final customCSSClasses from safety net
if (!context.customCSSClasses) {
  context.customCSSClasses = new Map()
}

// Merge safety net results
for (const [key, value] of cssVars.customCSSClasses.entries()) {
  context.customCSSClasses.set(key, value)
}

if (context.customCSSClasses.size > 0) {
  console.log(`   ✅ Total custom CSS classes: ${context.customCSSClasses.size}`)
}

// ═══════════════════════════════════════════════════════════════
// CREATE SEPARATE CSS FILE
// ═══════════════════════════════════════════════════════════════

const cssFilePath = outputFile.replace(/\.tsx$/, '.css')
let cssContent = `/* Auto-generated design tokens from Figma */\n`

// Add Google Fonts import
if (primaryFont && googleFontsUrl) {
  cssContent += `@import url('${googleFontsUrl}');\n`
}

// Add CSS custom properties
if (Object.keys(cssVariables).length > 0) {
  cssContent += `\n:root {\n`

  const categories = {}
  for (const [varName, value] of Object.entries(cssVariables)) {
    const category = varName.split('-')[1]
    if (!categories[category]) {
      categories[category] = []
    }
    categories[category].push([varName, value])
  }

  for (const [category, vars] of Object.entries(categories)) {
    cssContent += `  /* ${category.charAt(0).toUpperCase() + category.slice(1)} */\n`
    for (const [varName, value] of vars) {
      cssContent += `  ${varName}: ${value};\n`
    }
    cssContent += `\n`
  }

  cssContent += `}\n`
}

// Add Figma-specific utility classes
cssContent += `\n/* Figma-specific utility classes */\n`
cssContent += `.content-start {\n  align-content: flex-start;\n}\n`
cssContent += `.content-end {\n  align-content: flex-end;\n}\n`

// Add custom CSS classes
if (context.customCSSClasses && context.customCSSClasses.size > 0) {
  cssContent += `\n/* Custom classes for Figma variables */\n`

  for (const [className, { property, variable, fallback }] of context.customCSSClasses) {
    if (Array.isArray(property)) {
      cssContent += `.${className} {\n`
      for (const prop of property) {
        cssContent += `  ${prop}: var(${variable}, ${fallback});\n`
      }
      cssContent += `}\n`
    } else {
      cssContent += `.${className} { ${property}: var(${variable}, ${fallback}); }\n`
    }
  }
}

try {
  fs.writeFileSync(cssFilePath, cssContent, 'utf8')
  console.log(`\n✅ Created CSS file: ${cssFilePath}`)
  if (primaryFont) {
    console.log(`   Font: ${primaryFont}`)
  }
  if (Object.keys(cssVariables).length > 0) {
    console.log(`   CSS custom properties: ${Object.keys(cssVariables).length}`)
  }
  if (context.customCSSClasses && context.customCSSClasses.size > 0) {
    console.log(`   Custom CSS classes: ${context.customCSSClasses.size}`)
  }
} catch (error) {
  console.error(`❌ Error writing CSS file: ${error.message}`)
}

// Add React and CSS imports
const cssImportPath = `./${path.basename(cssFilePath)}`
const imports = `import React from 'react';\nimport '${cssImportPath}';\n`
outputCode = imports + outputCode
console.log(`   ✅ Added imports to component: React + ${cssImportPath}`)

// ═══════════════════════════════════════════════════════════════
// WRITE OUTPUT
// ═══════════════════════════════════════════════════════════════

try {
  fs.writeFileSync(outputFile, outputCode, 'utf8')
} catch (error) {
  console.error(`❌ Error writing output file: ${error.message}`)
  process.exit(1)
}

console.log(`\n💾 Output saved: ${outputFile}`)
console.log('✅ Unified processing complete!')

process.exit(0)
