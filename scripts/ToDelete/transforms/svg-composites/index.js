/**
 * SvgComposites Transform
 *
 * Detects and merges composite SVG logos:
 * - Multiple <img> absolutely positioned → Single merged SVG file
 * - Flattens unnecessary wrapper divs
 */

import { Transform } from '../../transform-pipeline/Transform.js'
import * as svgIconFixes from '../../transformations/svg-icon-fixes.js'
import traverse from '@babel/traverse'

export default class SvgCompositesTransform extends Transform {
  name = 'svg-composites'
  priority = 15 // After ast-cleaning (10), before css-vars (30)

  async execute(ast, context) {
    const { inputDir } = context

    let svgCompositesInlined = 0
    let svgIconsFlattened = 0

    traverse.default(ast, {
      JSXElement: (path) => {
        // Try to inline SVG composites first
        if (svgIconFixes.inlineSVGComposites(path, inputDir)) {
          svgCompositesInlined++
          return
        }

        // Flatten absolute img wrappers
        if (svgIconFixes.flattenAbsoluteImgWrappers(path)) {
          svgIconsFlattened++
        }
      }
    })

    context.logger.info(`   svg-composites: Inlined ${svgCompositesInlined} composites, flattened ${svgIconsFlattened} wrappers`)

    return { svgCompositesInlined, svgIconsFlattened }
  }
}
