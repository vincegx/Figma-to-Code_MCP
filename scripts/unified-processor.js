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

// CHUNKING MODE: Process each chunk individually, then consolidate
if (isChunkingMode) {
  console.log('🔍 Mode: CHUNKING')
  console.log('   Will process chunks individually and consolidate CSS')

  // Helper: Convert filename to valid PascalCase component name
  const toPascalCase = (name) => {
    // Remove spaces and special chars, keep alphanumeric
    let cleaned = name.replace(/[^a-zA-Z0-9]/g, '')

    // If starts with number, prefix with "Chunk"
    if (/^\d/.test(cleaned)) {
      cleaned = 'Chunk' + cleaned
    }

    // Ensure first letter is uppercase
    return cleaned.charAt(0).toUpperCase() + cleaned.slice(1)
  }

  const chunksFixedDir = path.join(testDir, 'chunks-fixed')

  if (!fs.existsSync(chunksFixedDir)) {
    fs.mkdirSync(chunksFixedDir, { recursive: true })
    console.log(`   Created ${chunksFixedDir}`)
  }

  const chunkFiles = fs.readdirSync(chunksDir)
    .filter(f => f.endsWith('.tsx'))
    .map(f => {
      const baseName = path.basename(f, '.tsx')
      const normalizedName = toPascalCase(baseName)
      return {
        name: f,
        normalizedName: normalizedName,
        path: path.join(chunksDir, f),
        outputPath: path.join(chunksFixedDir, `${normalizedName}.tsx`)
      }
    })

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

  const imports = chunkFiles.map(chunk => {
    return `import ${chunk.normalizedName} from './chunks-fixed/${chunk.normalizedName}';`
  }).join('\n')

  const componentCalls = chunkFiles.map(chunk => {
    return `      <${chunk.normalizedName} />`
  }).join('\n')

  const componentCode = fs.readFileSync(inputFile, 'utf-8')
  const componentNameMatch = componentCode.match(/export default function (\w+)/)
  const componentName = componentNameMatch ? componentNameMatch[1] : 'Component'

  // Extract parent wrapper from parent-wrapper.tsx to preserve background/padding
  let wrapperDiv = '<div className="w-full">'; // fallback
  try {
    const parentWrapperPath = path.join(path.dirname(inputFile), 'parent-wrapper.tsx');
    if (fs.existsSync(parentWrapperPath)) {
      const parentWrapper = fs.readFileSync(parentWrapperPath, 'utf-8');
      // Extract the opening div tag with all its classes and attributes (including multi-line)
      const divMatch = parentWrapper.match(/<div[\s\S]+?>/);
      if (divMatch) {
        wrapperDiv = divMatch[0];
        console.log(`   ✅ Using parent wrapper with all attributes (${wrapperDiv.length} chars)`);
      }
    }
  } catch (error) {
    console.log(`   ⚠️  Could not read parent wrapper, using default`);
  }

  const finalCode = `import React from 'react';
${imports}

export default function ${componentName}() {
  return (
    ${wrapperDiv}
${componentCalls}
    </div>
  );
}
`

  fs.writeFileSync(outputFile, finalCode, 'utf-8')
  console.log(`   ✅ Generated ${outputFile}`)

  // ═══════════════════════════════════════════════════════════════
  // CONSOLIDATE CSS FROM ALL CHUNKS
  // ═══════════════════════════════════════════════════════════════

  console.log(`\n   📝 Consolidating CSS from ${chunkFiles.length} chunks...`)

  const cssFilePath = outputFile.replace(/\.tsx$/, '.css')

  // Strategy: Read first chunk CSS and use it as base (it contains everything)
  // If multiple chunks exist, merge by collecting unique CSS sections
  let consolidatedCss = null
  let cssStats = { variables: 0, customClasses: 0, fonts: null }

  // Collect all CSS content from chunks
  const allCssContent = []
  for (const chunk of chunkFiles) {
    const chunkCssPath = chunk.outputPath.replace(/\.tsx$/, '.css')

    if (!fs.existsSync(chunkCssPath)) {
      console.log(`   ⚠️  CSS not found for ${chunk.normalizedName}, skipping`)
      continue
    }

    const chunkCss = fs.readFileSync(chunkCssPath, 'utf-8')
    allCssContent.push(chunkCss)
  }

  if (allCssContent.length === 0) {
    console.log(`   ⚠️  No CSS files found, skipping CSS consolidation`)
  } else if (allCssContent.length === 1) {
    // Single chunk: just copy the CSS as-is with updated header
    consolidatedCss = allCssContent[0].replace(
      /^\/\* Auto-generated design tokens from Figma \*\//,
      `/* Auto-generated design tokens from Figma (consolidated from ${chunkFiles.length} chunks) */`
    ).replace(
      /\/\* Custom classes for Figma variables \*\//,
      '/* Custom classes for Figma variables (consolidated) */'
    )

    // Extract stats for logging
    const varMatches = consolidatedCss.match(/--[a-z0-9-]+:/g)
    const classMatches = consolidatedCss.match(/^\.[a-z0-9_-]+\s*\{/gm)
    const fontMatch = consolidatedCss.match(/@import url\('([^']+)'\);/)

    cssStats.variables = varMatches ? varMatches.length : 0
    cssStats.customClasses = classMatches ? classMatches.length : 0
    cssStats.fonts = fontMatch ? fontMatch[1].match(/family=([^:&]+)/)?.[1] : null
  } else {
    // Multiple chunks: merge CSS by deduplicating sections
    const mergedSections = {
      fontImport: null,
      rootVars: new Map(),
      utilityClasses: new Set(),
      customClasses: new Map()
    }

    for (const css of allCssContent) {
      // Extract font import (take first one)
      if (!mergedSections.fontImport) {
        const fontMatch = css.match(/@import url\('([^']+)'\);/)
        if (fontMatch) mergedSections.fontImport = fontMatch[0]
      }

      // Extract :root variables
      const rootMatch = css.match(/:root\s*\{([^}]+)\}/s)
      if (rootMatch) {
        const varPattern = /(--[a-z0-9-]+):\s*([^;]+);/g
        let varMatch
        while ((varMatch = varPattern.exec(rootMatch[1])) !== null) {
          mergedSections.rootVars.set(varMatch[1].trim(), varMatch[2].trim())
        }
      }

      // Extract utility classes (content-start, content-end)
      const utilityMatch = css.match(/\/\* Figma-specific utility classes \*\/\n([\s\S]*?)(?=\n\/\* Custom classes|$)/)
      if (utilityMatch) {
        mergedSections.utilityClasses.add(utilityMatch[1].trim())
      }

      // Extract custom classes section (preserve multi-line formatting)
      const customMatch = css.match(/\/\* Custom classes for Figma variables.*?\*\/\n([\s\S]*?)$/)
      if (customMatch) {
        const classesSection = customMatch[1]
        // Split by class definition (. at start of line)
        const classPattern = /^(\.[a-z0-9_-]+\s*\{[\s\S]*?\})/gm
        let classMatch
        while ((classMatch = classPattern.exec(classesSection)) !== null) {
          const classDef = classMatch[1].trim()
          const className = classDef.match(/^\.([a-z0-9_-]+)/)[1]
          mergedSections.customClasses.set(className, classDef)
        }
      }
    }

    // Build consolidated CSS
    consolidatedCss = `/* Auto-generated design tokens from Figma (consolidated from ${chunkFiles.length} chunks) */\n`

    if (mergedSections.fontImport) {
      consolidatedCss += mergedSections.fontImport + '\n'
    }

    if (mergedSections.rootVars.size > 0) {
      consolidatedCss += '\n:root {\n  /*  */\n'
      for (const [varName, value] of mergedSections.rootVars) {
        consolidatedCss += `  ${varName}: ${value};\n`
      }
      consolidatedCss += '\n}\n'
    }

    if (mergedSections.utilityClasses.size > 0) {
      consolidatedCss += '\n/* Figma-specific utility classes */\n'
      consolidatedCss += Array.from(mergedSections.utilityClasses).join('\n') + '\n'
    }

    if (mergedSections.customClasses.size > 0) {
      consolidatedCss += '\n/* Custom classes for Figma variables (consolidated) */\n'
      for (const classDef of mergedSections.customClasses.values()) {
        consolidatedCss += classDef + '\n'
      }
    }

    cssStats.variables = mergedSections.rootVars.size
    cssStats.customClasses = mergedSections.customClasses.size
    cssStats.fonts = mergedSections.fontImport ? mergedSections.fontImport.match(/family=([^:&]+)/)?.[1] : null
  }

  // Write consolidated CSS
  if (consolidatedCss) {
    fs.writeFileSync(cssFilePath, consolidatedCss, 'utf8')
    console.log(`   ✅ Created consolidated CSS: ${cssFilePath}`)
    console.log(`      - CSS variables: ${cssStats.variables}`)
    console.log(`      - Custom classes: ${cssStats.customClasses}`)
    if (cssStats.fonts) {
      console.log(`      - Google Fonts: ${cssStats.fonts}`)
    }
  }

  // Remove CSS imports from individual chunks
  console.log(`\n   🧹 Removing CSS imports from chunks...`)
  for (const chunk of chunkFiles) {
    const chunkTsxPath = chunk.outputPath
    if (fs.existsSync(chunkTsxPath)) {
      let chunkCode = fs.readFileSync(chunkTsxPath, 'utf-8')
      // Remove CSS import line
      chunkCode = chunkCode.replace(/^import\s+['"]\.\/[^'"]+\.css['"];?\s*\n/m, '')
      fs.writeFileSync(chunkTsxPath, chunkCode, 'utf-8')
    }
  }
  console.log(`   ✅ Removed CSS imports from ${chunkFiles.length} chunks`)

  // Add CSS import to Component-fixed.tsx
  const cssImportPath = `./${path.basename(cssFilePath)}`
  const finalCodeWithCSS = `import React from 'react';\nimport '${cssImportPath}';\n${imports}\n\nexport default function ${componentName}() {\n  return (\n    ${wrapperDiv}\n${componentCalls}\n    </div>\n  );\n}\n`

  fs.writeFileSync(outputFile, finalCodeWithCSS, 'utf-8')
  console.log(`   ✅ Added CSS import to ${path.basename(outputFile)}`)

  console.log(`\n✅ Chunking mode complete - processed ${chunkFiles.length} chunks`)

  // Initialize minimal context for report generation
  var context = {
    analysis: {
      sections: [],
      totalNodes: 0,
      imagesCount: 0
    },
    stats: {},
    customCSSClasses: new Map()
  }

  // Initialize safetyNet for report generation
  var safetyNet = { varsFixed: 0, varsFound: 0, code: '' }

  // Don't exit - continue to reports generation
} else {
// ═══════════════════════════════════════════════════════════════
// INDIVIDUAL CHUNK MODE: Process single chunk file with pipeline
// ═══════════════════════════════════════════════════════════════

console.log('🔍 Mode: INDIVIDUAL CHUNK')
console.log('🚀 Processing chunk with pipeline...')
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

// Pre-count nodes and images (simple regex-based counting)
const totalNodes = (sourceCode.match(/<\w+/g) || []).length  // Count all JSX opening tags

// Count images: Option B - Count files in img/ directory
const imgDir = path.join(inputDir, 'img')
let imagesCount = 0

if (fs.existsSync(imgDir)) {
  // Primary method: count actual image files on disk
  const imgFiles = fs.readdirSync(imgDir)
  imagesCount = imgFiles.filter(f => /\.(png|jpg|jpeg|svg|gif|webp)$/i.test(f)).length
  console.log(`   Images in img/ directory: ${imagesCount}`)
} else {
  // Fallback: count const declarations if img/ doesn't exist yet
  const constImages = (sourceCode.match(/^const\s+\w+\s*=\s*["'].*\.(png|jpg|jpeg|svg|gif|webp)["'];?$/gm) || []).length
  const imgTags = (sourceCode.match(/<img\s/g) || []).length
  imagesCount = constImages + imgTags
  console.log(`   Images via const declarations: ${constImages}, img tags: ${imgTags}`)
}

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
      totalNodes,
      imagesCount
    }
  }, defaultConfig)
} catch (error) {
  console.error(`❌ Pipeline execution failed: ${error.message}`)
  console.error(error.stack)
  process.exit(1)
}

let outputCode = result.code
context = result.context

console.log(`\n✅ Pipeline complete in ${result.totalTime}ms`)

// Analysis stats
console.log('\n📊 Analysis:')
console.log(`   Sections detected: ${context.analysis.sections?.length || 0}`)
console.log(`   Total nodes: ${context.analysis.totalNodes || 0}`)
console.log(`   Images count: ${context.analysis.imagesCount || 0}`)

// Transform stats
console.log('\n🔧 Transform Stats:')
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
  if (stats.shapesFixed) details.push(`${stats.shapesFixed} shapes`)
  if (stats.blendModesVerified) details.push(`${stats.blendModesVerified} blend modes`)
  if (stats.classesOptimized) details.push(`${stats.classesOptimized} optimized`)

  if (details.length > 0) {
    console.log(`      → ${details.join(', ')}`)
  }
}

// ═══════════════════════════════════════════════════════════════
// SAFETY NET: Catch-all regex for remaining CSS vars
// ═══════════════════════════════════════════════════════════════

console.log('\n🛡️  Applying safety net (CSS vars catch-all)...')

safetyNet = cssVars.applySafetyNetRegex(outputCode)
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
} // End of else block (normal mode)

// ═══════════════════════════════════════════════════════════════
// GENERATE REPORTS (metadata.json, analysis.md, report.html)
// ═══════════════════════════════════════════════════════════════

if (figmaUrl) {
  console.log('\n📊 Generating reports...')

  // Collect all stats from context (merge all transformation stats)
  const allStats = {
    // Analysis stats (from context)
    totalNodes: context.analysis.totalNodes || 0,
    sectionsDetected: context.analysis.sections?.length || 0,
    imagesOrganized: context.analysis.imagesCount || 0
  }

  // Merge all transformation stats
  for (const [_transformName, stats] of Object.entries(context.stats)) {
    Object.assign(allStats, stats)
  }

  // Add safety net stats
  if (safetyNet.varsFixed > 0) {
    allStats.cssVarsConverted = (allStats.cssVarsConverted || 0) + safetyNet.varsFixed
  }

  // Add custom CSS classes count
  if (context.customCSSClasses && context.customCSSClasses.size > 0) {
    allStats.customClassesGenerated = context.customCSSClasses.size
  }

  // Calculate total fixes for dashboard display
  allStats.totalFixes =
    (allStats.fontsConverted || 0) +
    (allStats.classesFixed || 0) +
    (allStats.wrappersFlattened || 0) +
    (allStats.compositesInlined || 0) +
    (allStats.gradientsFixed || 0) +
    (allStats.shapesFixed || 0) +
    (allStats.varsConverted || 0) +
    (allStats.classesOptimized || 0)

  const statsJson = JSON.stringify(allStats)

  try {
    // Generate metadata.json
    execSync(
      `node scripts/reporting/generate-metadata.js "${testDir}" "${figmaUrl}" '${statsJson}'`,
      {
        cwd: path.join(path.dirname(new URL(import.meta.url).pathname), '..'),
        stdio: 'inherit'
      }
    )

    // Generate analysis.md
    execSync(
      `node scripts/reporting/generate-analysis.js "${testDir}" "${figmaUrl}" '${statsJson}'`,
      {
        cwd: path.join(path.dirname(new URL(import.meta.url).pathname), '..'),
        stdio: 'inherit'
      }
    )

    // Generate report.html
    execSync(
      `node scripts/reporting/generate-report.js "${testDir}" '${statsJson}'`,
      {
        cwd: path.join(path.dirname(new URL(import.meta.url).pathname), '..'),
        stdio: 'inherit'
      }
    )
  } catch (error) {
    console.error(`❌ Error generating reports: ${error.message}`)
  }
} else {
  console.log('\n⚠️  Skipping reports generation (no Figma URL provided)')
}

console.log('\n✅ Unified processing complete!')

process.exit(0)
