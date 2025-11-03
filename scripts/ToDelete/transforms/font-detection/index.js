/**
 * FontDetection Transform
 *
 * Detects and converts Figma font syntax to inline styles:
 * - font-['Poppins:Bold',sans-serif] → style={{ fontFamily: 'Poppins, sans-serif', fontWeight: 700 }}
 *
 * IMPORTANT: Must run BEFORE ast-cleaning (which removes font-[...] classes)
 */

import { Transform } from '../../transform-pipeline/Transform.js'
import traverse from '@babel/traverse'
import * as t from '@babel/types'

export default class FontDetectionTransform extends Transform {
  name = 'font-detection'
  priority = 0 // MUST RUN FIRST!

  // Font style to weight mapping
  weightMap = {
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

  async execute(ast, context) {
    const { primaryFont } = context

    if (!primaryFont) {
      context.logger.info(`   font-detection: No primary font found, skipping`)
      return { fontsConverted: 0 }
    }

    let fontsConverted = 0

    traverse.default(ast, {
      JSXElement: (path) => {
        if (this.detectAndConvertFont(path, primaryFont)) {
          fontsConverted++
        }
      }
    })

    context.logger.info(`   font-detection: Converted ${fontsConverted} font declarations`)

    return { fontsConverted }
  }

  detectAndConvertFont(path, primaryFont) {
    const attributes = path.node.openingElement.attributes
    const classNameAttr = attributes.find(
      attr => attr.name && attr.name.name === 'className'
    )

    if (!classNameAttr || !t.isStringLiteral(classNameAttr.value)) {
      return false
    }

    // Match pattern: font-['FontFamily:Style',sans-serif]
    const fontMatch = classNameAttr.value.value.match(/font-\['([^']+)',sans-serif\]/)

    if (!fontMatch) {
      return false
    }

    const fontSpec = fontMatch[1]
    const [fontFamily, fontStyle] = fontSpec.split(':')

    // Map style to weight
    const fontWeight = this.weightMap[fontStyle] || 400

    // Find existing style attribute
    const styleAttr = attributes.find(attr => attr.name && attr.name.name === 'style')

    if (styleAttr && t.isJSXExpressionContainer(styleAttr.value)) {
      // Merge into existing style object
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
        }
      }
    } else {
      // Create new style attribute
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
    }

    return true
  }
}
