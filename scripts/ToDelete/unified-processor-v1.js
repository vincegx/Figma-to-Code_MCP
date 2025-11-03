#!/usr/bin/env node
/**
 * UNIFIED PROCESSOR - One-pass AST transformation for 100% fidelity
 *
 * This script combines the logic of:
 * - ast-processor.js (basic cleaning)
 * - post-processor-fix.js (gradients, shapes, blend modes)
 * - fix-css-vars-simple.js (CSS variables conversion)
 *
 * Benefits of unified approach:
 * - Parse AST only ONCE (50% faster)
 * - Single traversal with all transformations
 * - No intermediate files (Component-ast.tsx eliminated)
 * - Modular code organization (transformations/ folder)
 * - Built-in safety net for CSS vars
 *
 * Usage:
 *   node scripts/unified-processor.js <input.tsx> <output.tsx> [metadata.xml]
 *
 * Example:
 *   node scripts/unified-processor.js \
 *     src/generated/tests/test-123/Component.tsx \
 *     src/generated/tests/test-123/Component-fixed.tsx \
 *     src/generated/tests/test-123/metadata.xml
 */

import fs from 'fs'
import path from 'path'
import { execSync } from 'child_process'
import parser from '@babel/parser'
import traverse from '@babel/traverse'
import generate from '@babel/generator'
import * as t from '@babel/types'

// Import transformation modules
import * as astCleaning from './transformations/ast-cleaning.js'
import * as postFixes from './transformations/post-fixes.js'
import * as cssVars from './transformations/css-vars.js'
import { customCSSClasses } from './transformations/css-vars.js'
import * as tailwindOptimizer from './transformations/tailwind-optimizer.js'
import * as svgIconFixes from './transformations/svg-icon-fixes.js'

// ═══════════════════════════════════════════════════════════════
// CLI ARGUMENTS
// ═══════════════════════════════════════════════════════════════

const inputFile = process.argv[2]
const outputFile = process.argv[3]
const metadataXmlPath = process.argv[4]
const figmaUrl = process.argv[5] // Optional: Figma URL for automatic metadata/analysis generation

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

// Only enable chunking mode if:
// 1. chunks/ exists
// 2. Input file is NOT already inside chunks/ (prevents recursion)
const isChunkingMode = fs.existsSync(chunksDir) && !inputFile.includes('/chunks/')

console.log(`🔍 Mode: ${isChunkingMode ? 'CHUNKING' : 'NORMAL'}`)

if (isChunkingMode) {
  console.log('   Detected chunks/ directory - will process chunks individually')

  // ═══════════════════════════════════════════════════════════════
  // CHUNKING MODE: Process each chunk separately
  // ═══════════════════════════════════════════════════════════════

  const chunksFixedDir = path.join(testDir, 'chunks-fixed')

  // Create chunks-fixed directory
  if (!fs.existsSync(chunksFixedDir)) {
    fs.mkdirSync(chunksFixedDir, { recursive: true })
    console.log(`   Created ${chunksFixedDir}`)
  }

  // Get all chunk files
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
      // Call unified processor recursively for each chunk
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

  // Generate Component-fixed.tsx with imports to chunks-fixed/
  console.log(`\n   📝 Generating ${outputFile} with imports...`)

  // Helper: Convert filename to PascalCase component name (banner1 → Banner1)
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

  // Read Component.tsx to get component name
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

  // Generate metadata, analysis & report with basic stats
  if (figmaUrl) {
    console.log('\n📋 Generating metadata.json, analysis.md and report.html...')

    const processingStats = JSON.stringify({
      totalNodes: chunkFiles.length,
      sectionsDetected: chunkFiles.length,
      imagesCount: 0,
      classesOptimized: 0,
      textSizesConverted: 0,
      gradientsFixed: 0,
      shapesFixed: 0,
      blendModesVerified: 0,
      cssVarsConverted: 0,
      customClassesGenerated: 0,
      svgIconsFlattened: 0,
      svgCompositesInlined: 0,
      chunkingMode: true,
      chunksProcessed: chunkFiles.length
    })

    try {
      execSync(
        `node scripts/generate-metadata.js "${testDir}" "${figmaUrl}" '${processingStats}'`,
        {
          cwd: path.join(path.dirname(new URL(import.meta.url).pathname), '..'),
          stdio: 'inherit'
        }
      )
      console.log('✅ metadata.json generated')
    } catch (error) {
      console.warn(`⚠️  Could not generate metadata.json: ${error.message}`)
    }

    try {
      execSync(
        `node scripts/generate-analysis.js "${testDir}" "${figmaUrl}" '${processingStats}'`,
        {
          cwd: path.join(path.dirname(new URL(import.meta.url).pathname), '..'),
          stdio: 'inherit'
        }
      )
      console.log('✅ analysis.md generated')
    } catch (error) {
      console.warn(`⚠️  Could not generate analysis.md: ${error.message}`)
    }

    try {
      execSync(
        `node scripts/generate-report.js "${testDir}" '${processingStats}'`,
        {
          cwd: path.join(path.dirname(new URL(import.meta.url).pathname), '..'),
          stdio: 'inherit'
        }
      )
      console.log('✅ report.html generated')
    } catch (error) {
      console.warn(`⚠️  Could not generate report.html: ${error.message}`)
    }
  }

  process.exit(0)
}

// ═══════════════════════════════════════════════════════════════
// NORMAL MODE: Process single file
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

// Read metadata XML if available (for advanced fixes)
if (metadataXmlPath && fs.existsSync(metadataXmlPath)) {
  console.log(`   Metadata: ${metadataXmlPath}`)
}

// Read variables.json if available (for font extraction + CSS vars)
// Use testDir to ensure we read from test root, not chunks/ subdirectory
const variablesPath = `${testDir}/variables.json`
let primaryFont = null
let googleFontsUrl = null
const cssVariables = {} // Will store all CSS custom properties

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
        // "Colors/White" → --colors-white
        // "Margin/R" → --margin-r
        const cssVarName = '--' + key.toLowerCase().replace(/\//g, '-').replace(/\s+/g, '-')

        // Add 'px' unit to numeric values without units (except colors)
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
// CLEAR SHARED STATE
// ═══════════════════════════════════════════════════════════════

// Clear the custom CSS classes Map (shared between imports)
customCSSClasses.clear()

// Reset root container flag (for overflow-x-hidden detection)
astCleaning.resetRootContainer()

// ═══════════════════════════════════════════════════════════════
// PARSE AST (ONCE!)
// ═══════════════════════════════════════════════════════════════

let ast
try {
  ast = parser.parse(sourceCode, {
    sourceType: 'module',
    plugins: ['jsx', 'typescript']
  })
} catch (error) {
  console.error(`❌ AST parsing failed: ${error.message}`)
  process.exit(1)
}

// ═══════════════════════════════════════════════════════════════
// ANALYSIS & FIXES TRACKING
// ═══════════════════════════════════════════════════════════════

const analysis = {
  sections: [],
  totalNodes: 0,
  imagesCount: 0
}

const fixes = {
  // AST cleaning
  classesOptimized: 0,
  textSizesConverted: 0,

  // Post fixes
  gradientsFixed: 0,
  shapesFixed: 0,
  blendModesVerified: 0,

  // SVG icon fixes
  svgIconsFlattened: 0,

  // CSS vars (will be counted in safety net)
  cssVarsConverted: 0,
  customClassesGenerated: 0
}

// ═══════════════════════════════════════════════════════════════
// SINGLE AST TRAVERSAL - ALL TRANSFORMATIONS
// ═══════════════════════════════════════════════════════════════

console.log('🔄 Processing AST (single pass)...')

traverse.default(ast, {
  // ─────────────────────────────────────────────────────────────
  // JSXText: Detect sections for analysis
  // ─────────────────────────────────────────────────────────────
  JSXText(path) {
    astCleaning.detectSection(path, analysis)
  },

  // ─────────────────────────────────────────────────────────────
  // JSXElement: Main transformation logic
  // ─────────────────────────────────────────────────────────────
  JSXElement(path) {
    const attributes = path.node.openingElement.attributes

    // Count images
    if (t.isJSXIdentifier(path.node.openingElement.name, { name: 'img' })) {
      analysis.imagesCount++
    }

    // ═══════════════════════════════════════════════════════════
    // PHASE 0: FONT DETECTION (MUST be done BEFORE cleanClasses!)
    // ═══════════════════════════════════════════════════════════

    // Detect and convert font-['Poppins:XXX'] to inline style BEFORE cleanClasses removes it
    const classNameAttr = attributes.find(
      attr => attr.name && attr.name.name === 'className'
    )

    if (classNameAttr && t.isStringLiteral(classNameAttr.value) && primaryFont) {
      const fontMatch = classNameAttr.value.value.match(/font-\['([^']+)',sans-serif\]/)

      if (fontMatch) {
        const fontSpec = fontMatch[1]
        const [fontFamily, fontStyle] = fontSpec.split(':')

        // Map Figma font styles to CSS font-weight
        const weightMap = {
          'Thin': 100,
          'ExtraLight': 200,
          'Light': 300,
          'Regular': 400,
          'Medium': 500,
          'SemiBold': 600,
          'Bold': 700,
          'ExtraBold': 800,
          'Black': 900
        }
        const fontWeight = weightMap[fontStyle] || 400

        // Add fontFamily and fontWeight to inline style
        const styleAttr = attributes.find(attr => attr.name && attr.name.name === 'style')

        if (styleAttr && t.isJSXExpressionContainer(styleAttr.value)) {
          // Existing style object - merge fontFamily and fontWeight into it
          const expression = styleAttr.value.expression
          if (t.isObjectExpression(expression)) {
            const hasFontFamily = expression.properties.some(
              prop => t.isObjectProperty(prop) && t.isIdentifier(prop.key) && prop.key.name === 'fontFamily'
            )
            if (!hasFontFamily) {
              expression.properties.unshift(
                t.objectProperty(
                  t.identifier('fontWeight'),
                  t.numericLiteral(fontWeight)
                ),
                t.objectProperty(
                  t.identifier('fontFamily'),
                  t.stringLiteral(`${fontFamily}, sans-serif`)
                )
              )
              fixes.classesOptimized++
            }
          }
        } else {
          // No existing style - create new style attribute with fontFamily and fontWeight
          const styleObj = t.objectExpression([
            t.objectProperty(
              t.identifier('fontFamily'),
              t.stringLiteral(`${fontFamily}, sans-serif`)
            ),
            t.objectProperty(
              t.identifier('fontWeight'),
              t.numericLiteral(fontWeight)
            )
          ])
          const jsxExpr = t.jsxExpressionContainer(styleObj)
          const newStyleAttr = t.jsxAttribute(t.jsxIdentifier('style'), jsxExpr)
          path.node.openingElement.attributes.push(newStyleAttr)
          fixes.classesOptimized++
        }
      }
    }

    // ═══════════════════════════════════════════════════════════
    // PHASE 1: AST CLEANING (Basic operations)
    // ═══════════════════════════════════════════════════════════

    // Add overflow-x-hidden to root container (prevents horizontal scroll)
    if (astCleaning.addOverflowXHidden(path)) {
      fixes.classesOptimized++
    }

    // Add w-full to flex items with basis-0 grow (fixes sizing issues)
    if (astCleaning.addWidthToFlexGrow(path)) {
      fixes.classesOptimized++
    }

    // Clean invalid Tailwind classes (this will remove font-['...'])
    if (astCleaning.cleanClasses(path)) {
      fixes.classesOptimized++
    }

    // Convert text sizes to standard Tailwind
    if (astCleaning.convertTextSizes(path)) {
      fixes.textSizesConverted++
    }

    // Count nodes for statistics
    astCleaning.countNode(path, analysis)

    // ═══════════════════════════════════════════════════════════
    // PHASE 1.5: SVG COMPOSITE LOGO INLINING
    // ═══════════════════════════════════════════════════════════

    // Inline composite SVG logos (3+ img with absolute+inset → single <svg>)
    // Fixes: <div><img absolute /><img absolute />...</div> → <svg><path /><path />...</svg>
    if (svgIconFixes.inlineSVGComposites(path, inputDir)) {
      fixes.svgCompositesInlined = (fixes.svgCompositesInlined || 0) + 1
    }

    // ═══════════════════════════════════════════════════════════
    // PHASE 1.6: SVG ICON STRUCTURE FIXES
    // ═══════════════════════════════════════════════════════════

    // Flatten absolute positioned divs without dimensions containing only img
    // Fixes: <div absolute inset-[X%]><img size-full /></div> → <img absolute inset-[X%] />
    if (svgIconFixes.flattenAbsoluteImgWrappers(path)) {
      fixes.svgIconsFlattened++
    }

    // ═══════════════════════════════════════════════════════════
    // PHASE 2: POST-PROCESSING FIXES (Advanced visual fidelity)
    // ═══════════════════════════════════════════════════════════

    // Fix multi-stop gradients
    postFixes.fixMultiStopGradient(path, attributes, fixes)

    // Fix radial gradients
    postFixes.fixRadialGradient(path, attributes, fixes)

    // Fix shapes container
    postFixes.fixShapesContainer(path, attributes, fixes)

    // Verify blend modes
    postFixes.verifyBlendMode(path, attributes, fixes)

    // ═══════════════════════════════════════════════════════════
    // PHASE 3: CSS VARIABLES CONVERSION
    // ═══════════════════════════════════════════════════════════

    if (classNameAttr && t.isStringLiteral(classNameAttr.value)) {
      const original = classNameAttr.value.value

      // Convert CSS vars (var(--colors/white, #fff) → actual values)
      const withoutVars = cssVars.convertCSSVarsInClass(original)

      // Optimize Tailwind (arbitrary → standard when possible)
      const optimized = tailwindOptimizer.optimizeTailwindClasses(withoutVars)

      // Update className if it changed
      if (optimized !== original) {
        classNameAttr.value = t.stringLiteral(optimized)
        fixes.classesOptimized++
      }
    }
  }
})

// ═══════════════════════════════════════════════════════════════
// GENERATE CODE
// ═══════════════════════════════════════════════════════════════

console.log('📝 Generating code...')

let outputCode
try {
  const result = generate.default(ast, {
    retainLines: false,
    compact: false,
    comments: true
  })
  outputCode = result.code
} catch (error) {
  console.error(`❌ Code generation failed: ${error.message}`)
  process.exit(1)
}

// ═══════════════════════════════════════════════════════════════
// SAFETY NET: Catch-all regex for remaining CSS vars
// ═══════════════════════════════════════════════════════════════

console.log('🛡️  Applying safety net (CSS vars catch-all)...')

const safetyNet = cssVars.applySafetyNetRegex(outputCode)
outputCode = safetyNet.code
fixes.cssVarsConverted = safetyNet.varsFixed
fixes.customClassesGenerated = customCSSClasses.size

if (safetyNet.varsFound > 0) {
  if (safetyNet.varsFixed > 0) {
    console.log(`   ⚠️  Safety net caught ${safetyNet.varsFixed} CSS vars that escaped AST processing`)
  } else {
    console.log(`   ✅ All CSS vars already converted by AST processing`)
  }
}

if (customCSSClasses.size > 0) {
  console.log(`   ✅ Generated ${customCSSClasses.size} custom CSS classes using variables`)
}

// ═══════════════════════════════════════════════════════════════
// CREATE SEPARATE CSS FILE FOR FONTS
// ═══════════════════════════════════════════════════════════════

// ═══════════════════════════════════════════════════════════════
// CREATE CSS FILE WITH FONTS + CSS CUSTOM PROPERTIES
// ═══════════════════════════════════════════════════════════════

const cssFilePath = outputFile.replace(/\.tsx$/, '.css')
let cssContent = `/* Auto-generated design tokens from Figma */\n`

// Add Google Fonts import if detected
if (primaryFont && googleFontsUrl) {
  cssContent += `@import url('${googleFontsUrl}');\n`
}

// Add CSS custom properties
if (Object.keys(cssVariables).length > 0) {
  cssContent += `\n:root {\n`

  // Group variables by category
  const categories = {}
  for (const [varName, value] of Object.entries(cssVariables)) {
    const category = varName.split('-')[1] // --colors-white → colors
    if (!categories[category]) {
      categories[category] = []
    }
    categories[category].push([varName, value])
  }

  // Write variables grouped by category
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
// NOTE: content-stretch is a Figma internal class that should NOT generate CSS!
// When Figma wants 100% width, it adds w-full alongside content-stretch
// When content-stretch appears with shrink-0 only, it means intrinsic sizing
cssContent += `.content-start {\n`
cssContent += `  align-content: flex-start;\n`
cssContent += `}\n`
cssContent += `.content-end {\n`
cssContent += `  align-content: flex-end;\n`
cssContent += `}\n`

// Add custom CSS classes that use the variables
if (customCSSClasses.size > 0) {
  cssContent += `\n/* Custom classes for Figma variables */\n`

  for (const [className, { property, variable, fallback }] of customCSSClasses) {
    // Handle properties that are arrays (like px, py, mx, my)
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
  if (customCSSClasses.size > 0) {
    console.log(`   Custom CSS classes: ${customCSSClasses.size}`)
  }
} catch (error) {
  console.error(`❌ Error writing CSS file: ${error.message}`)
}

// Add React and CSS imports at the top of the component
const cssImportPath = `./${cssFilePath.split('/').pop()}`
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

// ═══════════════════════════════════════════════════════════════
// REPORT
// ═══════════════════════════════════════════════════════════════

console.log('\n✅ Unified processing complete!')
console.log('\n📊 Analysis:')
console.log(`   Sections detected: ${analysis.sections.length}`)
console.log(`   Total nodes: ${analysis.totalNodes}`)

console.log('\n🔧 Fixes applied:')
console.log(`   Classes optimized: ${fixes.classesOptimized}`)
console.log(`   Text sizes converted: ${fixes.textSizesConverted}`)
console.log(`   Gradients fixed: ${fixes.gradientsFixed}`)
console.log(`   Shapes fixed: ${fixes.shapesFixed}`)
console.log(`   Blend modes verified: ${fixes.blendModesVerified}`)
console.log(`   SVG composites inlined: ${fixes.svgCompositesInlined || 0}`)
console.log(`   SVG icons flattened: ${fixes.svgIconsFlattened}`)
console.log(`   CSS vars converted: ${fixes.cssVarsConverted} (via safety net)`)
console.log(`   Custom CSS classes: ${fixes.customClassesGenerated}`)

console.log(`\n💾 Output saved: ${outputFile}`)

// ═══════════════════════════════════════════════════════════════
// GENERATE METADATA, ANALYSIS & REPORT (AUTOMATIC)
// ═══════════════════════════════════════════════════════════════

try {
  // testDir is already defined at the top (line 62)

  // Build processing stats JSON
  const processingStats = JSON.stringify({
    totalNodes: analysis.totalNodes,
    sectionsDetected: analysis.sections.length,
    imagesCount: analysis.imagesCount,
    classesOptimized: fixes.classesOptimized,
    textSizesConverted: fixes.textSizesConverted,
    gradientsFixed: fixes.gradientsFixed,
    shapesFixed: fixes.shapesFixed,
    blendModesVerified: fixes.blendModesVerified,
    cssVarsConverted: fixes.cssVarsConverted,
    customClassesGenerated: fixes.customClassesGenerated,
    svgIconsFlattened: fixes.svgIconsFlattened,
    svgCompositesInlined: fixes.svgCompositesInlined || 0
  })

  // ═══════════════════════════════════════════════════════════════
  // 1. GENERATE METADATA.JSON (FIRST - needed by report.html)
  // ═══════════════════════════════════════════════════════════════

  if (figmaUrl) {
    console.log('\n📋 Generating metadata.json...')
    try {
      execSync(
        `node scripts/generate-metadata.js "${testDir}" "${figmaUrl}" '${processingStats}'`,
        {
          cwd: path.join(path.dirname(new URL(import.meta.url).pathname), '..'),
          stdio: 'inherit'
        }
      )
      console.log('✅ metadata.json generated successfully')
    } catch (error) {
      console.warn(`⚠️  Could not generate metadata.json: ${error.message}`)
    }

    // ═══════════════════════════════════════════════════════════════
    // 2. GENERATE ANALYSIS.MD (SECOND)
    // ═══════════════════════════════════════════════════════════════

    console.log('\n📝 Generating analysis.md...')
    try {
      execSync(
        `node scripts/generate-analysis.js "${testDir}" "${figmaUrl}" '${processingStats}'`,
        {
          cwd: path.join(path.dirname(new URL(import.meta.url).pathname), '..'),
          stdio: 'inherit'
        }
      )
      console.log('✅ analysis.md generated successfully')
    } catch (error) {
      console.warn(`⚠️  Could not generate analysis.md: ${error.message}`)
    }

    // ═══════════════════════════════════════════════════════════════
    // 3. GENERATE HTML REPORT (THIRD - reads metadata.json for assets)
    // ═══════════════════════════════════════════════════════════════

    console.log('\n📊 Generating HTML report...')
    try {
      execSync(
        `node scripts/generate-report.js "${testDir}" '${processingStats}'`,
        {
          cwd: path.join(path.dirname(new URL(import.meta.url).pathname), '..'),
          stdio: 'inherit'
        }
      )
      console.log('✅ HTML report generated successfully')
    } catch (error) {
      console.warn(`⚠️  Could not generate HTML report: ${error.message}`)
    }
  } else {
    console.log('\n💡 Tip: Pass Figma URL as 5th argument to auto-generate metadata.json, analysis.md and report.html')
  }

} catch (error) {
  console.warn(`⚠️  Could not generate reports: ${error.message}`)
  console.warn('   (This is not critical - component generation succeeded)')
}

// Exit with success
process.exit(0)
