/**
 * Simple Transform Pipeline
 *
 * Loads transforms and executes them in priority order
 */

import parser from '@babel/parser'
import generate from '@babel/generator'

// Import all transforms
import * as fontDetection from './transformations/font-detection.js'
import * as autoLayout from './transformations/auto-layout.js'
import * as astCleaning from './transformations/ast-cleaning.js'
import * as svgIconFixes from './transformations/svg-icon-fixes.js'
import * as svgConsolidation from './transformations/svg-consolidation.js'
import * as postFixes from './transformations/post-fixes.js'
import * as positionFixes from './transformations/position-fixes.js'
import * as strokeAlignment from './transformations/stroke-alignment.js'
import * as cssVars from './transformations/css-vars.js'
import * as tailwindOptimizer from './transformations/tailwind-optimizer.js'
import * as productionCleaner from './transformations/production-cleaner.js'
import * as extractProps from './transformations/extract-props.js'

// Register all transforms
const ALL_TRANSFORMS = [
  fontDetection,
  autoLayout,
  astCleaning,
  svgIconFixes,
  svgConsolidation,
  postFixes,
  positionFixes,
  strokeAlignment,
  cssVars,
  tailwindOptimizer,
  productionCleaner,
  extractProps
]

/**
 * Execute transform pipeline
 */
export async function runPipeline(sourceCode, contextData = {}, config = {}) {
  const startTime = Date.now()

  // Parse AST
  let ast
  try {
    ast = parser.parse(sourceCode, {
      sourceType: 'module',
      plugins: ['jsx', 'typescript']
    })
  } catch (error) {
    throw new Error(`AST parsing failed: ${error.message}`)
  }

  // Create context with shared state
  const context = {
    ...contextData,
    stats: {},
    rootContainerProcessed: false,
    customCSSClasses: new Map(),
    analysis: {
      sections: [],
      totalNodes: 0,
      imagesCount: 0
    }
  }

  // Sort transforms by priority
  const transforms = ALL_TRANSFORMS
    .filter(t => config[t.meta.name]?.enabled !== false)
    .sort((a, b) => a.meta.priority - b.meta.priority)

  // Execute each transform
  for (const transform of transforms) {
    const tStart = Date.now()

    try {
      const stats = transform.execute(ast, context)
      context.stats[transform.meta.name] = {
        ...stats,
        executionTime: Date.now() - tStart
      }
    } catch (error) {
      console.error(`❌ Transform "${transform.meta.name}" failed: ${error.message}`)
      if (!config.continueOnError) throw error
    }
  }

  // Generate code
  const result = generate.default(ast, {
    retainLines: false,
    compact: false,
    comments: true,
    jsescOption: {
      quotes: 'double'  // Force double quotes for consistency
    }
  })

  // Prepend TypeScript interface if props were extracted
  let finalCode = result.code
  if (context.propsExtraction && context.propsExtraction.interface) {
    finalCode = context.propsExtraction.interface + finalCode
  }

  return {
    code: finalCode,
    context,
    totalTime: Date.now() - startTime
  }
}

/**
 * Get list of available transforms
 */
export function getAvailableTransforms() {
  return ALL_TRANSFORMS.map(t => ({
    name: t.meta.name,
    priority: t.meta.priority
  }))
}
