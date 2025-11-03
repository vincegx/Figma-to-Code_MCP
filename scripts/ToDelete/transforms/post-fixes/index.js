/**
 * PostFixes Transform
 *
 * Advanced fixes for visual fidelity:
 * - Multi-stop gradients
 * - Radial gradients
 * - SVG shapes (rectangle, ellipse, star, polygon)
 * - Blend modes verification
 */

import { Transform } from '../../transform-pipeline/Transform.js'
import * as postFixes from '../../transformations/post-fixes.js'
import traverse from '@babel/traverse'

export default class PostFixesTransform extends Transform {
  name = 'post-fixes'
  priority = 20 // After ast-cleaning (10), before css-vars (30)

  async execute(ast, context) {
    let gradientsFixed = 0
    let shapesFixed = 0
    let blendModesVerified = 0

    traverse.default(ast, {
      JSXElement: (path) => {
        const attributes = path.node.openingElement.attributes
        const fixes = {
          gradientsFixed: 0,
          shapesFixed: 0,
          blendModesVerified: 0
        }

        // Fix multi-stop gradients
        postFixes.fixMultiStopGradient(path, attributes, fixes)

        // Fix radial gradients
        postFixes.fixRadialGradient(path, attributes, fixes)

        // Fix shapes container
        postFixes.fixShapesContainer(path, attributes, fixes)

        // Verify blend modes
        postFixes.verifyBlendMode(path, attributes, fixes)

        gradientsFixed += fixes.gradientsFixed
        shapesFixed += fixes.shapesFixed
        blendModesVerified += fixes.blendModesVerified
      }
    })

    context.logger.info(`   post-fixes: Fixed ${gradientsFixed} gradients, ${shapesFixed} shapes, verified ${blendModesVerified} blend modes`)

    return { gradientsFixed, shapesFixed, blendModesVerified }
  }
}
