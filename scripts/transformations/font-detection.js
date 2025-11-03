/**
 * Font Detection Transform
 *
 * Converts Figma font syntax to inline styles:
 * font-['Poppins:Bold'] → style={{ fontFamily: 'Poppins', fontWeight: 700 }}
 */

import traverse from '@babel/traverse'
import * as t from '@babel/types'

export const meta = {
  name: 'font-detection',
  priority: 0 // MUST RUN FIRST (before ast-cleaning removes font-[...] classes)
}

const WEIGHT_MAP = {
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

export function execute(ast, context) {
  const { primaryFont } = context

  if (!primaryFont) return { fontsConverted: 0 }

  let fontsConverted = 0

  traverse.default(ast, {
    JSXElement(path) {
      const attributes = path.node.openingElement.attributes
      const classNameAttr = attributes.find(attr => attr.name && attr.name.name === 'className')

      if (!classNameAttr || !t.isStringLiteral(classNameAttr.value)) return

      const fontMatch = classNameAttr.value.value.match(/font-\['([^']+)',sans-serif\]/)
      if (!fontMatch) return

      const [fontFamily, fontStyle] = fontMatch[1].split(':')
      const fontWeight = WEIGHT_MAP[fontStyle] || 400

      const styleAttr = attributes.find(attr => attr.name && attr.name.name === 'style')

      if (styleAttr && t.isJSXExpressionContainer(styleAttr.value)) {
        const expression = styleAttr.value.expression
        if (t.isObjectExpression(expression)) {
          const hasFontFamily = expression.properties.some(
            prop => t.isObjectProperty(prop) && t.isIdentifier(prop.key) && prop.key.name === 'fontFamily'
          )
          if (!hasFontFamily) {
            expression.properties.unshift(
              t.objectProperty(t.identifier('fontWeight'), t.numericLiteral(fontWeight)),
              t.objectProperty(t.identifier('fontFamily'), t.stringLiteral(`${fontFamily}, sans-serif`))
            )
          }
        }
      } else {
        const styleObj = t.objectExpression([
          t.objectProperty(t.identifier('fontFamily'), t.stringLiteral(`${fontFamily}, sans-serif`)),
          t.objectProperty(t.identifier('fontWeight'), t.numericLiteral(fontWeight))
        ])
        path.node.openingElement.attributes.push(
          t.jsxAttribute(t.jsxIdentifier('style'), t.jsxExpressionContainer(styleObj))
        )
      }

      fontsConverted++
    }
  })

  return { fontsConverted }
}
