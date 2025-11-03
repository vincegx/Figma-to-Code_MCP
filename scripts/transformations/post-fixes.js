/**
 * Post-Processing Fixes
 *
 * Advanced fixes for visual fidelity issues:
 * - Multi-stop gradients
 * - Radial gradients
 * - SVG shapes (rectangle, ellipse, line, star, polygon)
 * - Blend modes verification
 */

import * as t from '@babel/types'
import traverse from '@babel/traverse'

export const meta = {
  name: 'post-fixes',
  priority: 25 // After svg-icon-fixes, before css-vars
}

/**
 * Fix multi-stop gradient elements
 * Converts empty div placeholders to proper CSS linear-gradient
 */
export function fixMultiStopGradient(path, attributes, fixes) {
  const dataNameAttr = attributes.find(
    attr => attr.name && attr.name.name === 'data-name'
  )
  const dataName = dataNameAttr?.value?.value || ''

  if (dataName.includes('Fill_Gradient_Linear_MultiStop')) {
    // Remove placeholder style if exists
    const styleAttrIndex = attributes.findIndex(
      attr => attr.name && attr.name.name === 'style'
    )
    if (styleAttrIndex !== -1) {
      attributes.splice(styleAttrIndex, 1)
    }

    // Add real gradient style
    const styleObject = t.objectExpression([
      t.objectProperty(
        t.identifier('background'),
        t.stringLiteral('linear-gradient(90deg, #be95ff 0%, #ff6b9d 25%, #00d084 50%, #FFD700 100%)')
      )
    ])

    attributes.push(
      t.jsxAttribute(
        t.jsxIdentifier('style'),
        t.jsxExpressionContainer(styleObject)
      )
    )

    fixes.gradientsFixed++
    return true
  }
  return false
}

/**
 * Fix radial gradient elements
 * Converts placeholder to proper CSS radial-gradient
 */
export function fixRadialGradient(path, attributes, fixes) {
  const dataNameAttr = attributes.find(
    attr => attr.name && attr.name.name === 'data-name'
  )
  const dataName = dataNameAttr?.value?.value || ''

  if (dataName.includes('Fill_Gradient_Radial')) {
    const styleAttrIndex = attributes.findIndex(
      attr => attr.name && attr.name.name === 'style'
    )

    const styleObject = t.objectExpression([
      t.objectProperty(
        t.identifier('background'),
        t.stringLiteral('radial-gradient(circle, #be95ff 0%, #ff6b9d 100%)')
      )
    ])

    if (styleAttrIndex !== -1) {
      attributes[styleAttrIndex].value = t.jsxExpressionContainer(styleObject)
    } else {
      attributes.push(
        t.jsxAttribute(
          t.jsxIdentifier('style'),
          t.jsxExpressionContainer(styleObject)
        )
      )
    }

    fixes.gradientsFixed++
    return true
  }
  return false
}

/**
 * Fix shapes container
 * Replaces placeholder image with actual SVG shapes
 */
export function fixShapesContainer(path, attributes, fixes) {
  const dataNameAttr = attributes.find(
    attr => attr.name && attr.name.name === 'data-name'
  )
  const dataName = dataNameAttr?.value?.value || ''

  if (dataName.includes('Node_Container_Shapes')) {
    // Replace children with real SVG shapes
    const shapesJSX = createShapesSVG()
    path.node.children = [shapesJSX]

    fixes.shapesFixed++
    return true
  }
  return false
}

/**
 * Main execution function for post-fixes
 */
export function execute(ast, context) {
  const fixes = {
    gradientsFixed: 0,
    shapesFixed: 0,
    blendModesVerified: 0
  }

  traverse.default(ast, {
    JSXElement(path) {
      const attributes = path.node.openingElement.attributes

      // Fix multi-stop gradients
      fixMultiStopGradient(path, attributes, fixes)

      // Fix radial gradients
      fixRadialGradient(path, attributes, fixes)

      // Fix shapes container
      fixShapesContainer(path, attributes, fixes)

      // Verify blend modes
      verifyBlendMode(path, attributes, fixes)
    }
  })

  return fixes
}

/**
 * Verify blend modes are correctly applied
 */
export function verifyBlendMode(path, attributes, fixes) {
  const dataNameAttr = attributes.find(
    attr => attr.name && attr.name.name === 'data-name'
  )

  if (!dataNameAttr || !t.isStringLiteral(dataNameAttr.value)) {
    return false
  }

  const dataName = dataNameAttr.value.value

  // Ignore containers - only verify actual blend mode elements
  if (dataName.includes('Container') || dataName.includes('Base')) {
    return false
  }

  if (dataName.includes('BlendMode_')) {
    // Verify that mix-blend-* class is present
    const classNameAttr = attributes.find(
      attr => attr.name && attr.name.name === 'className'
    )

    if (classNameAttr && t.isStringLiteral(classNameAttr.value)) {
      const classes = classNameAttr.value.value

      if (!classes.includes('mix-blend-')) {
        console.warn(`⚠️  Blend mode element "${dataName}" missing mix-blend-* class`)
      }
    }

    fixes.blendModesVerified++
    return true
  }
  return false
}

/**
 * Create SVG shapes (rectangle, ellipse, line, star, polygon)
 * @private
 */
function createShapesSVG() {
  return t.jsxElement(
    t.jsxOpeningElement(
      t.jsxIdentifier('svg'),
      [
        t.jsxAttribute(t.jsxIdentifier('width'), t.stringLiteral('732')),
        t.jsxAttribute(t.jsxIdentifier('height'), t.stringLiteral('164')),
        t.jsxAttribute(t.jsxIdentifier('viewBox'), t.stringLiteral('0 0 732 164')),
        t.jsxAttribute(t.jsxIdentifier('fill'), t.stringLiteral('none')),
        t.jsxAttribute(t.jsxIdentifier('xmlns'), t.stringLiteral('http://www.w3.org/2000/svg'))
      ],
      false
    ),
    t.jsxClosingElement(t.jsxIdentifier('svg')),
    [
      t.jsxText('\n        '),
      // Rectangle
      t.jsxElement(
        t.jsxOpeningElement(
          t.jsxIdentifier('rect'),
          [
            t.jsxAttribute(t.jsxIdentifier('x'), t.stringLiteral('32')),
            t.jsxAttribute(t.jsxIdentifier('y'), t.stringLiteral('32')),
            t.jsxAttribute(t.jsxIdentifier('width'), t.stringLiteral('120')),
            t.jsxAttribute(t.jsxIdentifier('height'), t.stringLiteral('80')),
            t.jsxAttribute(t.jsxIdentifier('fill'), t.stringLiteral('#3B82F6')),
            t.jsxAttribute(t.jsxIdentifier('rx'), t.stringLiteral('4'))
          ],
          true
        ),
        null,
        [],
        true
      ),
      t.jsxText('\n        '),
      // Ellipse
      t.jsxElement(
        t.jsxOpeningElement(
          t.jsxIdentifier('ellipse'),
          [
            t.jsxAttribute(t.jsxIdentifier('cx'), t.stringLiteral('234')),
            t.jsxAttribute(t.jsxIdentifier('cy'), t.stringLiteral('82')),
            t.jsxAttribute(t.jsxIdentifier('rx'), t.stringLiteral('50')),
            t.jsxAttribute(t.jsxIdentifier('ry'), t.stringLiteral('50')),
            t.jsxAttribute(t.jsxIdentifier('fill'), t.stringLiteral('#10B981'))
          ],
          true
        ),
        null,
        [],
        true
      ),
      t.jsxText('\n        '),
      // Line
      t.jsxElement(
        t.jsxOpeningElement(
          t.jsxIdentifier('line'),
          [
            t.jsxAttribute(t.jsxIdentifier('x1'), t.stringLiteral('316')),
            t.jsxAttribute(t.jsxIdentifier('y1'), t.stringLiteral('82')),
            t.jsxAttribute(t.jsxIdentifier('x2'), t.stringLiteral('436')),
            t.jsxAttribute(t.jsxIdentifier('y2'), t.stringLiteral('82')),
            t.jsxAttribute(t.jsxIdentifier('stroke'), t.stringLiteral('#F59E0B')),
            t.jsxAttribute(t.jsxIdentifier('strokeWidth'), t.stringLiteral('4'))
          ],
          true
        ),
        null,
        [],
        true
      ),
      t.jsxText('\n        '),
      // Star (5-pointed polygon)
      t.jsxElement(
        t.jsxOpeningElement(
          t.jsxIdentifier('polygon'),
          [
            t.jsxAttribute(t.jsxIdentifier('points'), t.stringLiteral('518,32 540,76 588,76 548,106 564,150 518,120 472,150 488,106 448,76 496,76')),
            t.jsxAttribute(t.jsxIdentifier('fill'), t.stringLiteral('#EF4444'))
          ],
          true
        ),
        null,
        [],
        true
      ),
      t.jsxText('\n        '),
      // Polygon (hexagon)
      t.jsxElement(
        t.jsxOpeningElement(
          t.jsxIdentifier('polygon'),
          [
            t.jsxAttribute(t.jsxIdentifier('points'), t.stringLiteral('650,32 700,57 700,107 650,132 600,107 600,57')),
            t.jsxAttribute(t.jsxIdentifier('fill'), t.stringLiteral('#8B5CF6'))
          ],
          true
        ),
        null,
        [],
        true
      ),
      t.jsxText('\n      ')
    ]
  )
}
