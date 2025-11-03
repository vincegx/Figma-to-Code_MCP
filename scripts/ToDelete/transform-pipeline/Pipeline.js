/**
 * TransformPipeline - Orchestrates execution of transforms
 *
 * Responsibilities:
 * - Load and register transforms
 * - Sort by priority
 * - Execute in order
 * - Collect stats
 * - Error handling
 */

import parser from '@babel/parser'
import generate from '@babel/generator'
import { Context } from './Context.js'

export class TransformPipeline {
  constructor(config = {}) {
    this.config = config
    this.transforms = []
  }

  /**
   * Register a transform
   *
   * @param {Transform} TransformClass - Transform class to instantiate
   * @param {Object} options - Options for the transform
   * @returns {TransformPipeline} - For chaining
   */
  use(TransformClass, options = {}) {
    const transform = new TransformClass(options)

    this.transforms.push({
      name: transform.name,
      priority: options.priority !== undefined ? options.priority : transform.priority,
      instance: transform,
      enabled: options.enabled !== false
    })

    return this
  }

  /**
   * Execute all transforms on source code
   *
   * @param {string} sourceCode - Input TypeScript/JSX code
   * @param {Object} contextData - Data for Context (variables, fonts, etc.)
   * @returns {Object} - { code: string, stats: Object, context: Context }
   */
  async execute(sourceCode, contextData = {}) {
    // 1. Parse AST
    const startTime = Date.now()
    let ast

    try {
      ast = parser.parse(sourceCode, {
        sourceType: 'module',
        plugins: ['jsx', 'typescript']
      })
    } catch (error) {
      throw new Error(`AST parsing failed: ${error.message}`)
    }

    const parseTime = Date.now() - startTime

    // 2. Create context
    const context = new Context(contextData)
    context.logger.info(`🔄 TransformPipeline: Starting execution`)
    context.logger.info(`   Parse time: ${parseTime}ms`)

    // 3. Sort transforms by priority
    const sortedTransforms = this.transforms
      .filter(t => t.enabled)
      .sort((a, b) => a.priority - b.priority)

    context.logger.info(`   Transforms to execute: ${sortedTransforms.length}`)

    // 4. Execute each transform
    const transformStartTime = Date.now()

    for (const transform of sortedTransforms) {
      const tStart = Date.now()

      try {
        const stats = await transform.instance.execute(ast, context)

        // Record stats
        context.recordStats(transform.name, {
          ...stats,
          executionTime: Date.now() - tStart,
          success: true
        })

      } catch (error) {
        const errorStats = {
          success: false,
          error: error.message,
          executionTime: Date.now() - tStart
        }

        context.recordStats(transform.name, errorStats)

        // Handle error based on config
        if (this.config.continueOnError) {
          context.logger.error(`❌ Transform "${transform.name}" failed: ${error.message}`)
          context.logger.error(`   Continuing with next transform...`)
        } else {
          throw new Error(`Transform "${transform.name}" failed: ${error.message}`)
        }
      }
    }

    const transformTime = Date.now() - transformStartTime

    // 5. Generate code
    const genStart = Date.now()
    let outputCode

    try {
      const result = generate.default(ast, {
        retainLines: false,
        compact: false,
        comments: true
      })
      outputCode = result.code
    } catch (error) {
      throw new Error(`Code generation failed: ${error.message}`)
    }

    const genTime = Date.now() - genStart

    // 6. Log summary
    const totalTime = Date.now() - startTime
    context.logger.info(`✅ TransformPipeline: Complete`)
    context.logger.info(`   Parse: ${parseTime}ms`)
    context.logger.info(`   Transforms: ${transformTime}ms`)
    context.logger.info(`   Generate: ${genTime}ms`)
    context.logger.info(`   Total: ${totalTime}ms`)

    return {
      code: outputCode,
      stats: context.getStats(),
      context: context
    }
  }

  /**
   * Get list of registered transforms
   */
  getTransforms() {
    return this.transforms.map(t => ({
      name: t.name,
      priority: t.priority,
      enabled: t.enabled
    }))
  }
}
