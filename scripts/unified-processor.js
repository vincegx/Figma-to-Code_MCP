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
const cleanMode = process.argv[6] === '--clean'

if (!inputFile || !outputFile) {
  console.error('Usage: node unified-processor.js <input.tsx> <output.tsx> [metadata.xml] [figmaUrl] [--clean]')
  process.exit(1)
}

if (cleanMode) {
  console.log('🧹 Clean mode enabled - generating production-ready version\n')
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

  // ═══════════════════════════════════════════════════════════════
  // AGGREGATE STATS FROM ALL CHUNKS
  // ═══════════════════════════════════════════════════════════════

  console.log(`\n📊 Aggregating stats from ${chunkFiles.length} chunks...`)

  const aggregatedStats = {
    analysis: {
      sections: [],
      totalNodes: 0,
      imagesCount: 0
    },
    stats: {},
    safetyNet: {
      varsFixed: 0,
      varsFound: 0
    },
    customCSSClassesCount: 0
  }

  // Read all .stats.json files
  for (const chunk of chunkFiles) {
    const statsPath = chunk.outputPath.replace(/\.tsx$/, '.stats.json')

    if (!fs.existsSync(statsPath)) {
      console.log(`   ⚠️  Stats file not found for ${chunk.normalizedName}`)
      continue
    }

    try {
      const chunkStats = JSON.parse(fs.readFileSync(statsPath, 'utf-8'))

      // Aggregate analysis
      aggregatedStats.analysis.totalNodes += chunkStats.analysis?.totalNodes || 0
      aggregatedStats.analysis.imagesCount += chunkStats.analysis?.imagesCount || 0
      if (chunkStats.analysis?.sections) {
        aggregatedStats.analysis.sections.push(...chunkStats.analysis.sections)
      }

      // Aggregate transformation stats
      for (const [transformName, transformStats] of Object.entries(chunkStats.stats || {})) {
        if (!aggregatedStats.stats[transformName]) {
          aggregatedStats.stats[transformName] = {}
        }

        // Sum up all numeric properties
        for (const [key, value] of Object.entries(transformStats)) {
          if (typeof value === 'number') {
            aggregatedStats.stats[transformName][key] =
              (aggregatedStats.stats[transformName][key] || 0) + value
          }
        }
      }

      // Aggregate safety net stats
      aggregatedStats.safetyNet.varsFixed += chunkStats.safetyNet?.varsFixed || 0
      aggregatedStats.safetyNet.varsFound += chunkStats.safetyNet?.varsFound || 0

      // Aggregate custom CSS classes count
      aggregatedStats.customCSSClassesCount += chunkStats.customCSSClassesCount || 0

    } catch (error) {
      console.log(`   ⚠️  Error reading stats from ${chunk.normalizedName}: ${error.message}`)
    }
  }

  console.log(`   ✅ Aggregated stats from ${chunkFiles.length} chunks`)
  console.log(`      - Total nodes: ${aggregatedStats.analysis.totalNodes}`)
  console.log(`      - Images: ${aggregatedStats.analysis.imagesCount}`)
  console.log(`      - Sections: ${aggregatedStats.analysis.sections.length}`)
  console.log(`      - Custom CSS classes: ${aggregatedStats.customCSSClassesCount}`)

  // Use aggregated stats for report generation
  var context = {
    analysis: aggregatedStats.analysis,
    stats: aggregatedStats.stats,
    customCSSClasses: new Map()
  }

  var safetyNet = {
    varsFixed: aggregatedStats.safetyNet.varsFixed,
    varsFound: aggregatedStats.safetyNet.varsFound,
    code: ''
  }

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
        const cssVarName = '--' + key.toLowerCase().replace(/\//g, '-').replace(/\s+/g, '-').replace(/\(/g, '_').replace(/\)/g, '')

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

// Prepare pipeline config
let pipelineConfig = { ...defaultConfig }

// NEVER extract props in source files (Component-fixed.tsx, Component-clean.tsx)
// Props are ONLY extracted in dist/ via dist-generator.js
pipelineConfig['extract-props'] = { enabled: false }

// Parse metadata.xml to extract Figma instance names
// This helps extract-props distinguish between instance screenshots and real images
let instanceNames = []
if (metadataXmlPath && fs.existsSync(metadataXmlPath)) {
  try {
    const metadataContent = fs.readFileSync(metadataXmlPath, 'utf8')
    // Extract instance names: <instance id="..." name="SideMenu" .../>
    const instanceMatches = metadataContent.matchAll(/<instance[^>]+name="([^"]+)"/g)
    instanceNames = Array.from(instanceMatches, m => m[1])

    if (instanceNames.length > 0) {
      console.log(`   Found ${instanceNames.length} Figma instances: ${instanceNames.join(', ')}`)
    }
  } catch (error) {
    console.warn(`   ⚠️  Could not parse metadata.xml: ${error.message}`)
  }
}

let result
try {
  result = await runPipeline(sourceCode, {
    primaryFont,
    googleFontsUrl,
    cssVariables,
    inputDir,
    metadataXmlPath,
    cleanMode,
    keepDataName: true, // Keep data-name attributes for responsive merging
    metadata: {
      instances: instanceNames // Pass instance names to transformations
    },
    analysis: {
      sections: [],
      totalNodes,
      imagesCount
    }
  }, pipelineConfig)
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

// Use fonts from context (updated by font-detection transform) or fallback to initial detection
const finalPrimaryFont = context.primaryFont || primaryFont
const finalGoogleFontsUrl = context.googleFontsUrl || googleFontsUrl

// Add Google Fonts import
if (finalPrimaryFont && finalGoogleFontsUrl) {
  cssContent += `@import url('${finalGoogleFontsUrl}');\n`
  console.log(`   ✅ Google Fonts import added: ${finalPrimaryFont}`)
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
  if (cleanMode) {
    // Clean mode: organize CSS with semantic sections
    const fontClasses = new Map()
    const colorClasses = new Map()
    const dimensionClasses = new Map()
    const spacingClasses = new Map()
    const maskClasses = new Map()
    const otherClasses = new Map()
    const figmaVarClasses = new Map()

    // Categorize classes
    for (const [className, classData] of context.customCSSClasses) {
      const { type, fontFamily, fontWeight, property, value, rules} = classData

      if (type === 'font') {
        fontClasses.set(className, { fontFamily, fontWeight })
      } else if (type === 'mask') {
        maskClasses.set(className, { rules })
      } else if (type === 'clean') {
        if (property === 'background-color' || property === 'color' || property === 'border-color') {
          colorClasses.set(className, { property, value })
        } else if (property === 'width' || property === 'height' || property === 'min-width' || property === 'max-width' || property === 'min-height' || property === 'max-height') {
          dimensionClasses.set(className, { property, value })
        } else if (property === 'padding' || property === 'margin' || property === 'gap' || property.includes('padding') || property.includes('margin')) {
          spacingClasses.set(className, { property, value })
        } else {
          otherClasses.set(className, { property, value })
        }
      } else {
        // Figma variable classes (old format)
        figmaVarClasses.set(className, classData)
      }
    }

    // Generate organized CSS
    if (fontClasses.size > 0) {
      cssContent += `\n/* ===== 3. Font Combinations (Extracted from inline styles) ===== */\n`
      for (const [className, { fontFamily, fontWeight }] of fontClasses) {
        cssContent += `.${className} {\n`
        cssContent += `  font-family: "${fontFamily}", sans-serif;\n`
        cssContent += `  font-weight: ${fontWeight};\n`
        cssContent += `}\n\n`
      }
    }

    if (maskClasses.size > 0) {
      cssContent += `\n/* ===== 3.5. Mask Classes (for masked images) ===== */\n`
      for (const [className, { rules }] of maskClasses) {
        cssContent += `.${className} {\n`
        for (const { property, value } of rules) {
          cssContent += `  ${property}: ${value};\n`
        }
        cssContent += `}\n\n`
      }
    }

    if (colorClasses.size > 0) {
      cssContent += `\n/* ===== 4. Custom Color Classes ===== */\n`
      for (const [className, { property, value }] of colorClasses) {
        cssContent += `.${className} { ${property}: ${value}; }\n`
      }
    }

    if (dimensionClasses.size > 0) {
      cssContent += `\n\n/* ===== 5. Custom Dimension Classes ===== */\n`
      for (const [className, { property, value }] of dimensionClasses) {
        cssContent += `.${className} { ${property}: ${value}; }\n`
      }
    }

    if (spacingClasses.size > 0) {
      cssContent += `\n\n/* ===== 6. Custom Spacing Classes ===== */\n`
      for (const [className, { property, value }] of spacingClasses) {
        if (property === 'padding-left-right') {
          cssContent += `.${className} {\n  padding-left: ${value};\n  padding-right: ${value};\n}\n\n`
        } else if (property === 'padding-top-bottom') {
          cssContent += `.${className} {\n  padding-top: ${value};\n  padding-bottom: ${value};\n}\n\n`
        } else if (property === 'margin-left-right') {
          cssContent += `.${className} {\n  margin-left: ${value};\n  margin-right: ${value};\n}\n\n`
        } else if (property === 'margin-top-bottom') {
          cssContent += `.${className} {\n  margin-top: ${value};\n  margin-bottom: ${value};\n}\n\n`
        } else {
          cssContent += `.${className} { ${property}: ${value}; }\n`
        }
      }
    }

    if (otherClasses.size > 0) {
      cssContent += `\n\n/* ===== 7. Other Custom Classes ===== */\n`
      for (const [className, { property, value }] of otherClasses) {
        // Fix Figma-style underscores in values (e.g., inset: 4.16%_7.813%) → valid CSS spaces
        const cleanValue = value.replace(/_/g, ' ')
        cssContent += `.${className} { ${property}: ${cleanValue}; }\n`
      }
    }

    if (figmaVarClasses.size > 0) {
      cssContent += `\n\n/* ===== 8. Figma Variable Classes (Design System) ===== */\n`
      for (const [className, classData] of figmaVarClasses) {
        const { property, variable, fallback, value } = classData
        if (Array.isArray(property)) {
          cssContent += `.${className} {\n`
          for (const prop of property) {
            if (value) {
              cssContent += `  ${prop}: ${value};\n`
            } else {
              cssContent += `  ${prop}: var(${variable}, ${fallback});\n`
            }
          }
          cssContent += `}\n`
        } else {
          if (value) {
            cssContent += `.${className} { ${property}: ${value}; }\n`
          } else {
            cssContent += `.${className} { ${property}: var(${variable}, ${fallback}); }\n`
          }
        }
      }
    }
  } else {
    // Standard mode: keep existing format
    cssContent += `\n/* Custom classes for Figma variables */\n`

    for (const [className, classData] of context.customCSSClasses) {
      const { property, variable, fallback, value } = classData

      if (Array.isArray(property)) {
        // Multi-property case (e.g., px, py)
        cssContent += `.${className} {\n`
        for (const prop of property) {
          if (value) {
            // Direct value (e.g., border-width)
            cssContent += `  ${prop}: ${value};\n`
          } else {
            // CSS variable with fallback
            cssContent += `  ${prop}: var(${variable}, ${fallback});\n`
          }
        }
        cssContent += `}\n`
      } else {
        // Single property case
        if (value) {
          // Direct value (e.g., border-width: 0px 0px 2px)
          cssContent += `.${className} { ${property}: ${value}; }\n`
        } else {
          // CSS variable with fallback
          cssContent += `.${className} { ${property}: var(${variable}, ${fallback}); }\n`
        }
      }
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

// Save stats to JSON file (for chunking mode aggregation)
if (inputFile.includes('/chunks/')) {
  const statsFilePath = outputFile.replace(/\.tsx$/, '.stats.json')
  const statsToSave = {
    analysis: context.analysis,
    stats: context.stats,
    safetyNet: {
      varsFixed: safetyNet.varsFixed,
      varsFound: safetyNet.varsFound
    },
    customCSSClassesCount: context.customCSSClasses ? context.customCSSClasses.size : 0
  }
  fs.writeFileSync(statsFilePath, JSON.stringify(statsToSave, null, 2), 'utf-8')
  console.log(`📊 Saved stats: ${path.basename(statsFilePath)}`)
}

// ═══════════════════════════════════════════════════════════════
// UPDATE TAILWIND SAFELIST WITH ARBITRARY VALUE CLASSES
// (colors, heights, widths, gaps, etc.)
// ═══════════════════════════════════════════════════════════════

// Only update safelist for actual test directories (not temp files or chunks)
if (!inputFile.includes('/chunks/') && outputFile.includes('/generated/export_figma/')) {
  console.log('\n🎨 Updating Tailwind safelist...')
  try {
    const { updateSafelistForTest } = await import('./post-processing/update-tailwind-safelist.js')
    const testDir = path.dirname(outputFile)
    const result = updateSafelistForTest(testDir)

    if (!result.updated) {
      console.log(`   ℹ️  No safelist update needed (${result.classes.length} classes already present)`)
    }
  } catch (error) {
    console.error(`   ⚠️  Could not update safelist: ${error.message}`)
  }
}

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

// PHASE 1: Component splitting (optional)
if (process.argv.includes('--split-components')) {
  console.log('\n🔪 Splitting components into modular chunks...')

  try {
    const { splitComponent } = await import('./post-processing/component-splitter.js')
    await splitComponent(testDir)
  } catch (error) {
    console.error(`❌ Error splitting components: ${error.message}`)
    // Non-blocking: continue even if splitting fails
  }
}

process.exit(0)
