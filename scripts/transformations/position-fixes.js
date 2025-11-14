/**
 * Position Fixes Transform
 *
 * Converts absolute positioning to relative/flex when appropriate
 * Figma exports elements without Auto Layout as absolutely positioned
 * which breaks responsive layouts
 *
 * Known issues addressed:
 * - Elements with x, y coordinates become absolutely positioned
 * - This breaks normal document flow
 * - Should be converted to relative positioning with flex containers
 */

import traverse from '@babel/traverse'
import * as t from '@babel/types'

export const meta = {
  name: 'position-fixes',
  priority: 28 // After post-fixes, before stroke-alignment
}

/**
 * Check if element uses absolute positioning
 */
function hasAbsolutePositioning(className) {
  return className.includes('absolute')
}

/**
 * Check if element has position coordinates (left, right, top, bottom)
 */
function hasPositionCoordinates(className) {
  const classes = className.split(/\s+/)
  return classes.some(c =>
    c.startsWith('left-') ||
    c.startsWith('right-') ||
    c.startsWith('top-') ||
    c.startsWith('bottom-') ||
    c.startsWith('inset-')
  )
}

/**
 * Check if element should remain absolute
 * Some elements need to stay absolute (overlays, modals, tooltips, etc.)
 */
function shouldStayAbsolute(path) {
  const attributes = path.node.openingElement.attributes

  // Check data-name for overlay indicators
  const dataNameAttr = attributes.find(
    attr => attr.name && attr.name.name === 'data-name'
  )

  if (dataNameAttr && t.isStringLiteral(dataNameAttr.value)) {
    const dataName = dataNameAttr.value.value.toLowerCase()

    // Keep absolute for overlays, modals, tooltips, dropdowns
    if (dataName.includes('overlay') ||
        dataName.includes('modal') ||
        dataName.includes('tooltip') ||
        dataName.includes('dropdown') ||
        dataName.includes('popup') ||
        dataName.includes('floating')) {
      return true
    }
  }

  // Check for z-index (usually means intentional layering)
  const classNameAttr = attributes.find(
    attr => attr.name && attr.name.name === 'className'
  )

  if (classNameAttr && t.isStringLiteral(classNameAttr.value)) {
    if (classNameAttr.value.value.includes('z-')) {
      return true
    }
  }

  // Check if parent is relative/absolute (intentional positioning context)
  const parentPath = path.parentPath
  if (parentPath && parentPath.isJSXElement()) {
    const parentClassAttr = parentPath.node.openingElement.attributes.find(
      attr => attr.name && attr.name.name === 'className'
    )
    if (parentClassAttr) {
      // Handle both StringLiteral and JSXExpressionContainer
      let parentClasses = ''
      if (t.isStringLiteral(parentClassAttr.value)) {
        parentClasses = parentClassAttr.value.value
      } else if (t.isJSXExpressionContainer(parentClassAttr.value) &&
                 t.isIdentifier(parentClassAttr.value.expression)) {
        // className={className} - assume it might have positioning
        return true
      }

      if (parentClasses.includes('relative') || parentClasses.includes('absolute')) {
        // Parent has positioning context, might be intentional
        return true
      }
    }
  }

  return false
}

/**
 * Convert absolute positioning to relative
 */
function convertToRelative(path, stats) {
  const attributes = path.node.openingElement.attributes
  const classNameAttr = attributes.find(
    attr => attr.name && attr.name.name === 'className'
  )

  if (!classNameAttr || !t.isStringLiteral(classNameAttr.value)) {
    return false
  }

  let className = classNameAttr.value.value
  const classes = className.split(/\s+/)

  // Only process absolute positioned elements
  if (!hasAbsolutePositioning(className)) {
    return false
  }

  // Check if should stay absolute
  if (shouldStayAbsolute(path)) {
    return false
  }

  // Check if has position coordinates without inset-0
  const hasCoords = hasPositionCoordinates(className)
  const hasInset0 = classes.includes('inset-0')

  // If it has inset-0, it's probably meant to fill parent
  if (hasInset0) {
    return false
  }

  // Remove absolute and position coordinates
  let newClasses = classes.filter(c =>
    c !== 'absolute' &&
    !c.startsWith('left-') &&
    !c.startsWith('right-') &&
    !c.startsWith('top-') &&
    !c.startsWith('bottom-') &&
    !c.startsWith('inset-')
  )

  // Add relative positioning
  newClasses.push('relative')

  // If element had coordinates, log warning
  if (hasCoords) {
    console.warn(`⚠️  Converted absolute positioning to relative, coordinates removed`)
    stats.coordsRemoved++
  }

  // Update className
  const newClassName = newClasses.join(' ')
  if (newClassName !== className) {
    classNameAttr.value = t.stringLiteral(newClassName)
    stats.converted++
    return true
  }

  return false
}

/**
 * Wrap absolutely positioned siblings in a flex container
 * This helps maintain layout when converting from absolute to relative
 */
function wrapInFlexContainer(path, stats) {
  const parent = path.parent

  if (!parent || !t.isJSXElement(parent)) {
    return false
  }

  // Check if parent has multiple absolutely positioned children
  const children = parent.children.filter(child => t.isJSXElement(child))

  if (children.length < 2) {
    return false
  }

  const absoluteChildren = children.filter(child => {
    const classAttr = child.openingElement.attributes.find(
      attr => attr.name && attr.name.name === 'className'
    )
    return classAttr &&
           t.isStringLiteral(classAttr.value) &&
           classAttr.value.value.includes('absolute')
  })

  // If most children are absolute, parent should be a flex container
  if (absoluteChildren.length > children.length / 2) {
    const parentClassAttr = parent.openingElement.attributes.find(
      attr => attr.name && attr.name.name === 'className'
    )

    if (parentClassAttr && t.isStringLiteral(parentClassAttr.value)) {
      const parentClasses = parentClassAttr.value.value

      // Add flex if not already present
      if (!parentClasses.includes('flex')) {
        parentClassAttr.value = t.stringLiteral(parentClasses + ' flex flex-wrap gap-4')
        stats.flexContainersAdded++
        return true
      }
    }
  }

  return false
}

/**
 * Fix common absolute positioning patterns
 */
function fixCommonPatterns(path, stats) {
  const attributes = path.node.openingElement.attributes
  const classNameAttr = attributes.find(
    attr => attr.name && attr.name.name === 'className'
  )

  if (!classNameAttr || !t.isStringLiteral(classNameAttr.value)) {
    return false
  }

  let className = classNameAttr.value.value
  let modified = false

  // Pattern 1: absolute inset-0 → remove absolute, keep inset-0 for grid/flex children
  if (className.includes('absolute') && className.includes('inset-0')) {
    const parent = path.parent
    if (parent && t.isJSXElement(parent)) {
      const parentClassAttr = parent.openingElement.attributes.find(
        attr => attr.name && attr.name.name === 'className'
      )
      if (parentClassAttr && t.isStringLiteral(parentClassAttr.value)) {
        const parentClasses = parentClassAttr.value.value
        // If parent is grid or flex, child doesn't need absolute
        if (parentClasses.includes('grid') || parentClasses.includes('flex')) {
          className = className.replace('absolute', '').trim()
          modified = true
          stats.insetFixed++
        }
      }
    }
  }

  // Pattern 2: absolute with percentage positions → convert to margin
  const percentPositions = className.match(/(?:left|right|top|bottom)-\[[\d.]+%\]/g)
  if (percentPositions && className.includes('absolute')) {
    // Convert percentage positions to margins
    percentPositions.forEach(pos => {
      const [direction, value] = pos.split('-')
      const percent = value.slice(1, -1) // Remove [ and ]

      const marginMap = {
        'left': `ml-[${percent}]`,
        'right': `mr-[${percent}]`,
        'top': `mt-[${percent}]`,
        'bottom': `mb-[${percent}]`
      }

      className = className.replace(pos, marginMap[direction] || '')
    })

    // Remove absolute
    className = className.replace('absolute', 'relative')
    modified = true
    stats.percentageFixed++
  }

  if (modified) {
    classNameAttr.value = t.stringLiteral(className.trim())
    return true
  }

  return false
}

/**
 * Main execution function
 */
export function execute(ast, context) {
  const stats = {
    converted: 0,
    coordsRemoved: 0,
    flexContainersAdded: 0,
    insetFixed: 0,
    percentageFixed: 0
  }

  // First pass: Fix common patterns
  traverse.default(ast, {
    JSXElement(path) {
      fixCommonPatterns(path, stats)
    }
  })

  // Second pass: Convert absolute to relative
  traverse.default(ast, {
    JSXElement(path) {
      convertToRelative(path, stats)
    }
  })

  // Third pass: Add flex containers where needed
  traverse.default(ast, {
    JSXElement(path) {
      wrapInFlexContainer(path, stats)
    }
  })

  return stats
}