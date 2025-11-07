/**
 * Production Cleaner Transform
 *
 * Transforms Component-fixed.tsx into Component-clean.tsx for production use:
 * - Removes debug attributes (data-name, data-node-id)
 * - Extracts inline font styles to CSS classes
 * - Converts arbitrary Tailwind classes to custom CSS classes
 * - Adds section comments for better readability
 *
 * This transform is OPTIONAL and runs only when --clean flag is passed.
 */

import traverse from '@babel/traverse'
import * as t from '@babel/types'

export const meta = {
  name: 'production-cleaner',
  priority: 100 // MUST RUN LAST (after all other transforms)
}

/**
 * Generate semantic class name from arbitrary color value
 */
function getColorClassName(property, color) {
  // Map common colors to semantic names
  const colorMap = {
    '#f0d9b5': 'beige',
    '#2a587c': 'blue',
    '#1a3453': 'dark-blue',
    '#a1141f': 'red',
    '#ffffff': 'white',
    '#000000': 'black',
    '#f2f4f7': 'light-gray',
    '#111111': 'dark-gray',
    '#878787': 'gray',
    '#281f26': 'purple-dark',
    '#200102': 'brown-dark'
  }

  const colorName = colorMap[color.toLowerCase()] || color.replace('#', '')
  const prefix = property === 'background-color' ? 'bg' :
                 property === 'color' ? 'text' :
                 property === 'border-color' ? 'border' : property

  return `${prefix}-custom-${colorName}`
}

/**
 * Convert arbitrary Tailwind classes to custom CSS classes
 */
function convertArbitraryClasses(className, cleanClasses) {
  let converted = className

  // Pattern 1: Colors - bg-[#xxx], text-[#xxx], border-[#xxx]
  converted = converted.replace(/\b(bg|text|border)-\[(#[0-9a-fA-F]{6})\]/g, (_match, prefix, color) => {
    const property = prefix === 'bg' ? 'background-color' :
                     prefix === 'text' ? 'color' :
                     prefix === 'border' ? 'border-color' : prefix

    const customClass = getColorClassName(property, color)

    cleanClasses.set(customClass, {
      property,
      value: color
    })

    return customClass
  })

  // Pattern 2: RGBA colors - bg-[rgba(...)]
  converted = converted.replace(/\b(bg|text|border)-\[rgba\(([^)]+)\)\]/g, (_match, prefix, rgba) => {
    const property = prefix === 'bg' ? 'background-color' :
                     prefix === 'text' ? 'color' :
                     prefix === 'border' ? 'border-color' : prefix

    const hash = rgba.replace(/[^0-9]/g, '').substring(0, 8)
    const customClass = `${prefix}-custom-rgba-${hash}`

    cleanClasses.set(customClass, {
      property,
      value: `rgba(${rgba})`
    })

    return customClass
  })

  // Pattern 3: Dimensions - w-[Xpx], h-[Xpx], gap-[Xpx], etc.
  converted = converted.replace(/\b(w|h|gap|p|px|py|pt|pb|pl|pr|m|mx|my|mt|mb|ml|mr|min-w|max-w|min-h|max-h)-\[([0-9.]+px)\]/g,
    (_match, prefix, value) => {
      const customClass = `${prefix}-custom-${value.replace('px', '').replace('.', 'dot')}`

      const propertyMap = {
        'w': 'width',
        'h': 'height',
        'gap': 'gap',
        'p': 'padding',
        'px': 'padding-left-right',
        'py': 'padding-top-bottom',
        'pt': 'padding-top',
        'pb': 'padding-bottom',
        'pl': 'padding-left',
        'pr': 'padding-right',
        'm': 'margin',
        'mx': 'margin-left-right',
        'my': 'margin-top-bottom',
        'mt': 'margin-top',
        'mb': 'margin-bottom',
        'ml': 'margin-left',
        'mr': 'margin-right',
        'min-w': 'min-width',
        'max-w': 'max-width',
        'min-h': 'min-height',
        'max-h': 'max-height'
      }

      cleanClasses.set(customClass, {
        property: propertyMap[prefix] || prefix,
        value
      })

      return customClass
    }
  )

  // Pattern 4: Other arbitrary values (inset, rounded, tracking, leading, etc.)
  const otherPatterns = [
    { regex: /\binset-\[([^\]]+)\]/g, property: 'inset' },
    { regex: /\brounded-\[([^\]]+)\]/g, property: 'border-radius' },
    { regex: /\btracking-\[([^\]]+)\]/g, property: 'letter-spacing' },
    { regex: /\bleading-\[([^\]]+)\]/g, property: 'line-height' },
    { regex: /\brotate-\[([^\]]+)\]/g, property: 'rotate' },
    { regex: /\btop-\[([^\]]+)\]/g, property: 'top' },
    { regex: /\bbottom-\[([^\]]+)\]/g, property: 'bottom' },
    { regex: /\bleft-\[([^\]]+)\]/g, property: 'left' },
    { regex: /\bright-\[([^\]]+)\]/g, property: 'right' }
  ]

  otherPatterns.forEach(({ regex, property }) => {
    converted = converted.replace(regex, (_match, value) => {
      let sanitized

      // For complex values (e.g., inset with multiple parts), use a short hash
      const parts = value.split(/[_\s]+/)
      if (parts.length > 2 || value.length > 15) {
        // Generate short hash from value
        const hash = value.split('').reduce((acc, char) => {
          return ((acc << 5) - acc + char.charCodeAt(0)) | 0
        }, 0)
        const shortHash = Math.abs(hash).toString(36).substring(0, 6)
        sanitized = shortHash
      } else {
        // For simple values, use readable name
        sanitized = value
          .replace(/%/g, 'pct')           // 4.16% → 4.16pct
          .replace(/_/g, '-')             // separator
          .replace(/\./g, 'dot')          // 4.16pct → 4dot16pct
          .replace(/[^a-z0-9-]/gi, '-')   // Clean other chars
          .replace(/--+/g, '-')           // Remove duplicate dashes
          .replace(/^-+|-+$/g, '')        // Remove leading/trailing dashes

        // Handle negative values specially (prefix with neg)
        if (value.startsWith('-') && !sanitized.startsWith('neg')) {
          sanitized = 'neg-' + sanitized
        }
      }

      const customClass = `${property.replace('inset', 'pos')}-custom-${sanitized}`

      cleanClasses.set(customClass, {
        property,
        value
      })

      return customClass
    })
  })

  return converted
}

/**
 * Extract inline font styles to CSS classes
 */
function extractFontStyles(path, fontClasses) {
  const attributes = path.node.openingElement.attributes
  const styleAttr = attributes.find(attr => attr.name && attr.name.name === 'style')

  if (!styleAttr || !t.isJSXExpressionContainer(styleAttr.value)) return null

  const expression = styleAttr.value.expression
  if (!t.isObjectExpression(expression)) return null

  let fontFamily = null
  let fontWeight = null

  // Extract fontFamily and fontWeight
  const remainingProps = expression.properties.filter(prop => {
    if (!t.isObjectProperty(prop) || !t.isIdentifier(prop.key)) return true

    if (prop.key.name === 'fontFamily' && t.isStringLiteral(prop.value)) {
      fontFamily = prop.value.value.replace(', sans-serif', '').trim()
      return false // Remove from style
    }

    if (prop.key.name === 'fontWeight' && t.isNumericLiteral(prop.value)) {
      fontWeight = prop.value.value
      return false // Remove from style
    }

    return true // Keep other properties
  })

  // If we found font properties, create a CSS class
  if (fontFamily && fontWeight) {
    const fontSlug = fontFamily.toLowerCase().replace(/\s+/g, '-')
    const className = `font-${fontSlug}-${fontWeight}`

    fontClasses.set(className, {
      fontFamily,
      fontWeight
    })

    // Update or remove style attribute
    if (remainingProps.length > 0) {
      expression.properties = remainingProps
    } else {
      // Remove empty style attribute
      const styleIndex = attributes.findIndex(attr => attr.name && attr.name.name === 'style')
      attributes.splice(styleIndex, 1)
    }

    return className
  }

  return null
}

/**
 * Main execution function
 */
export function execute(ast, context) {
  // Skip if not in clean mode
  if (!context.cleanMode) {
    return {
      dataAttrsRemoved: 0,
      inlineStylesExtracted: 0,
      arbitraryClassesConverted: 0,
      commentsAdded: 0,
      skipped: true
    }
  }

  let dataAttrsRemoved = 0
  let inlineStylesExtracted = 0
  let arbitraryClassesConverted = 0

  // Maps to store generated CSS classes
  const fontClasses = new Map()
  const cleanClasses = new Map()

  // Pass 1: Process all transformations
  traverse.default(ast, {
    JSXElement(path) {
      const attributes = path.node.openingElement.attributes

      // Transform 1: Remove debug attributes
      const initialLength = attributes.length
      path.node.openingElement.attributes = attributes.filter(attr => {
        if (!attr.name) return true
        const name = attr.name.name
        return name !== 'data-name' && name !== 'data-node-id'
      })
      dataAttrsRemoved += initialLength - path.node.openingElement.attributes.length

      // Transform 2: Extract inline font styles
      const fontClass = extractFontStyles(path, fontClasses)
      if (fontClass) {
        const classNameAttr = path.node.openingElement.attributes.find(
          attr => attr.name && attr.name.name === 'className'
        )
        if (classNameAttr && t.isStringLiteral(classNameAttr.value)) {
          classNameAttr.value.value = `${classNameAttr.value.value} ${fontClass}`.trim()
        } else {
          path.node.openingElement.attributes.push(
            t.jsxAttribute(t.jsxIdentifier('className'), t.stringLiteral(fontClass))
          )
        }
        inlineStylesExtracted++
      }

      // Transform 3: Convert arbitrary Tailwind classes
      const classNameAttr = path.node.openingElement.attributes.find(
        attr => attr.name && attr.name.name === 'className'
      )
      if (classNameAttr && t.isStringLiteral(classNameAttr.value)) {
        const original = classNameAttr.value.value
        const converted = convertArbitraryClasses(original, cleanClasses)
        if (converted !== original) {
          classNameAttr.value.value = converted
          arbitraryClassesConverted++
        }
      }
    }
  })

  // Store all generated classes in context
  if (!context.customCSSClasses) {
    context.customCSSClasses = new Map()
  }

  // Add font classes
  for (const [className, { fontFamily, fontWeight }] of fontClasses) {
    context.customCSSClasses.set(className, {
      type: 'font',
      fontFamily,
      fontWeight
    })
  }

  // Add clean classes (colors, dimensions, etc.)
  for (const [className, { property, value }] of cleanClasses) {
    context.customCSSClasses.set(className, {
      type: 'clean',
      property,
      value
    })
  }

  return {
    dataAttrsRemoved,
    inlineStylesExtracted,
    arbitraryClassesConverted,
    fontClassesGenerated: fontClasses.size,
    cleanClassesGenerated: cleanClasses.size
  }
}
