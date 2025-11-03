/**
 * AstCleaning Transform
 *
 * Basic cleaning operations:
 * - Add overflow-x-hidden to root container
 * - Add w-full to flex items with basis-0 grow
 * - Remove invalid Tailwind classes
 * - Convert text sizes to standard Tailwind
 */

import { Transform } from '../../transform-pipeline/Transform.js'
import * as astCleaning from '../../transformations/ast-cleaning.js'
import traverse from '@babel/traverse'

export default class AstCleaningTransform extends Transform {
  name = 'ast-cleaning'
  priority = 10 // After font-detection (0), before others

  async execute(ast, context) {
    // Reset state using context
    context.rootContainerProcessed = false

    let classesOptimized = 0
    let textSizesConverted = 0

    traverse.default(ast, {
      // Detect sections (analysis)
      JSXText: (path) => {
        astCleaning.detectSection(path, context.analysis)
      },

      // Main transformations
      JSXElement: (path) => {
        // Add overflow-x-hidden to root
        if (!context.rootContainerProcessed && astCleaning.addOverflowXHidden(path)) {
          context.rootContainerProcessed = true
          classesOptimized++
        }

        // Add w-full to flex items
        if (astCleaning.addWidthToFlexGrow(path)) {
          classesOptimized++
        }

        // Clean invalid classes
        if (astCleaning.cleanClasses(path)) {
          classesOptimized++
        }

        // Convert text sizes
        if (astCleaning.convertTextSizes(path)) {
          textSizesConverted++
        }

        // Count nodes for analysis
        astCleaning.countNode(path, context.analysis)
      }
    })

    context.logger.info(`   ast-cleaning: Optimized ${classesOptimized} classes, converted ${textSizesConverted} text sizes`)

    return { classesOptimized, textSizesConverted }
  }
}
