/**
 * CssVars Transform
 *
 * Converts Figma CSS variables to custom CSS classes:
 * - p-[var(--margin/r,32px)] → p-margin-r (+ generates .p-margin-r CSS class)
 *
 * IMPORTANT: Must run BEFORE tailwind-optimizer
 */

import { Transform } from '../../transform-pipeline/Transform.js'
import * as cssVars from '../../transformations/css-vars.js'
import * as tailwindOptimizer from '../../transformations/tailwind-optimizer.js'
import traverse from '@babel/traverse'
import * as t from '@babel/types'

export default class CssVarsTransform extends Transform {
  name = 'css-vars'
  priority = 30 // After ast-cleaning (10), before tailwind-optimizer (40)

  async execute(ast, context) {
    // Use context.customCSSClasses instead of global
    // Note: cssVars module still uses global Map, we'll sync after
    let classesWithVarsConverted = 0

    traverse.default(ast, {
      JSXElement: (path) => {
        const classNameAttr = this.getClassNameAttr(path)
        if (!classNameAttr || !t.isStringLiteral(classNameAttr.value)) {
          return
        }

        const original = classNameAttr.value.value

        // Convert CSS vars (generates entries in global customCSSClasses Map)
        const withoutVars = cssVars.convertCSSVarsInClass(original)

        // Optimize Tailwind (arbitrary → standard when possible)
        const optimized = tailwindOptimizer.optimizeTailwindClasses(withoutVars)

        // Update className if it changed
        if (optimized !== original) {
          classNameAttr.value = t.stringLiteral(optimized)
          classesWithVarsConverted++
        }
      }
    })

    // Sync global customCSSClasses to context
    context.customCSSClasses = new Map(cssVars.customCSSClasses)

    context.logger.info(`   css-vars: Converted ${classesWithVarsConverted} classes, generated ${context.customCSSClasses.size} custom CSS classes`)

    return {
      cssVarsConverted: classesWithVarsConverted,
      customClassesGenerated: context.customCSSClasses.size
    }
  }
}
