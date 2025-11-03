/**
 * TailwindOptimizer Transform
 *
 * Converts arbitrary Tailwind values to standard classes when possible:
 * - gap-[8px] → gap-2
 * - w-[96px] → w-24
 * - rounded-[4px] → rounded
 */

import { Transform } from '../../transform-pipeline/Transform.js'
import { optimizeTailwindClasses } from '../../transformations/tailwind-optimizer.js'
import traverse from '@babel/traverse'
import * as t from '@babel/types'

export default class TailwindOptimizerTransform extends Transform {
  name = 'tailwind-optimizer'
  priority = 40 // Run AFTER css-vars (30)

  async execute(ast, context) {
    let classesOptimized = 0

    traverse.default(ast, {
      JSXElement: (path) => {
        const classNameAttr = this.getClassNameAttr(path)
        if (!classNameAttr || !t.isStringLiteral(classNameAttr.value)) {
          return
        }

        const original = classNameAttr.value.value
        const optimized = optimizeTailwindClasses(original)

        if (optimized !== original) {
          classNameAttr.value = t.stringLiteral(optimized)
          classesOptimized++
        }
      }
    })

    context.logger.info(`   tailwind-optimizer: Optimized ${classesOptimized} classes`)

    return { classesOptimized }
  }
}
