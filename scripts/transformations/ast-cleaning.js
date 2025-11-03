/**
 * AST Cleaning Transformations
 *
 * Basic cleaning operations extracted from the original ast-processor.js
 * These transformations clean invalid Tailwind classes and convert text sizes
 * to standard Tailwind classes when possible.
 */

import * as t from '@babel/types'
import traverse from '@babel/traverse'

export const meta = {
  name: 'ast-cleaning',
  priority: 10 // After font-detection, before other transforms
}

// Track if root container has been processed
let rootContainerProcessed = false

/**
 * Reset the root container flag (call this before processing a new file)
 */
export function resetRootContainer() {
  rootContainerProcessed = false
}

/**
 * Add overflow-x-hidden to the root container (first div returned by component)
 * Prevents horizontal scroll caused by:
 * - Negative margins (mr-[-380px], mb-[-64px])
 * - Fixed width containers (w-[1440px])
 * - Overflowing images (w-[113.62%])
 */
export function addOverflowXHidden(path) {
  // Only process once per file
  if (rootContainerProcessed) return false

  const attributes = path.node.openingElement.attributes

  // Must be a div
  if (!t.isJSXIdentifier(path.node.openingElement.name, { name: 'div' })) return false

  // Check if this is the root container (has data-name attribute)
  const hasDataName = attributes.some(
    attr => t.isJSXAttribute(attr) && attr.name && attr.name.name === 'data-name'
  )

  // Only process if it's a root-level container
  if (!hasDataName) return false

  const classNameAttr = attributes.find(
    attr => attr.name && attr.name.name === 'className'
  )

  if (!classNameAttr || !t.isStringLiteral(classNameAttr.value)) return false

  const currentClassName = classNameAttr.value.value

  // Check if overflow-x-hidden is already present
  if (currentClassName.includes('overflow-x-hidden')) {
    rootContainerProcessed = true
    return false
  }

  // Add overflow-x-hidden to className
  const newClassName = currentClassName + ' overflow-x-hidden'
  classNameAttr.value = t.stringLiteral(newClassName)

  rootContainerProcessed = true
  return true
}

/**
 * Clean invalid Tailwind classes from className attributes
 */
export function cleanClasses(path) {
  const attributes = path.node.openingElement.attributes
  const classNameAttr = attributes.find(
    attr => attr.name && attr.name.name === 'className'
  )

  if (classNameAttr && t.isStringLiteral(classNameAttr.value)) {
    const cleaned = cleanTailwindClasses(classNameAttr.value.value)
    if (cleaned !== classNameAttr.value.value) {
      classNameAttr.value = t.stringLiteral(cleaned)
      return true // Indicates modification was made
    }
  }
  return false
}

/**
 * Convert text sizes from arbitrary values to standard Tailwind classes
 */
export function convertTextSizes(path) {
  const attributes = path.node.openingElement.attributes
  const classNameAttr = attributes.find(
    attr => attr.name && attr.name.name === 'className'
  )

  if (classNameAttr && t.isStringLiteral(classNameAttr.value)) {
    const original = classNameAttr.value.value
    const converted = convertTextSizesToStandard(original)

    if (converted !== original) {
      classNameAttr.value = t.stringLiteral(converted)
      return true
    }
  }
  return false
}

/**
 * Clean invalid Tailwind classes intelligently
 * @private
 */
function cleanTailwindClasses(classString) {
  let cleaned = classString

  // Remove invalid font syntax
  cleaned = cleaned.replace(/font-\['[^']+',sans-serif\]\s*/g, '')

  // NOTE: size-full is VALID in Tailwind v3.3+ (width: 100%; height: 100%)
  // DO NOT convert it - it has different behavior than w-full h-full with object-cover!

  // NOTE: content-stretch, content-start, content-end are Figma-specific classes
  // We keep them and generate corresponding CSS in the .css file
  // content-stretch → width: 100%
  // content-start → align-content: flex-start
  // content-end → align-content: flex-end

  // Remove text-nowrap whitespace-pre (problematic for responsive)
  cleaned = cleaned.replace(/\btext-nowrap\s+whitespace-pre\b/g, '')

  // Clean up multiple spaces
  cleaned = cleaned.replace(/\s+/g, ' ').trim()

  return cleaned
}

/**
 * Convert text sizes from arbitrary to standard Tailwind classes
 * @private
 */
function convertTextSizesToStandard(classString) {
  let converted = classString

  // Map of text size conversions (arbitrary → standard)
  const textSizeMap = {
    'text-\\[64px\\]': 'text-6xl',
    'text-\\[48px\\]': 'text-5xl',
    'text-\\[36px\\]': 'text-4xl',
    'text-\\[32px\\]': 'text-3xl',
    'text-\\[24px\\]': 'text-2xl',
    'text-\\[20px\\]': 'text-xl',
    'text-\\[18px\\]': 'text-lg',
    'text-\\[16px\\]': 'text-base',
    'text-\\[14px\\]': 'text-sm',
    'text-\\[12px\\]': 'text-xs'
  }

  // Apply conversions
  for (const [pattern, replacement] of Object.entries(textSizeMap)) {
    const regex = new RegExp(pattern, 'g')
    converted = converted.replace(regex, replacement)
  }

  // NOTE: size-* is VALID in Tailwind v3.3+ - do NOT convert it!
  // (Previously: size-[XXXpx] → w-[XXXpx] h-[XXXpx] which broke layouts)

  return converted
}

/**
 * Detect sections in JSX text nodes
 * Used for analysis and reporting
 */
export function detectSection(path, analysis) {
  const text = path.node.value.trim()
  if (text.match(/===\s*SECTION\s+\d+:/)) {
    const sectionName = text.replace(/=/g, '').trim()
    analysis.sections.push(sectionName)
    return true
  }
  return false
}

/**
 * Count nodes with data-node-id attribute
 * Used for statistics
 */
export function countNode(path, analysis) {
  if (path.node.openingElement.attributes.find(
    attr => attr.name && attr.name.name === 'data-node-id'
  )) {
    analysis.totalNodes++
    return true
  }
  return false
}

/**
 * Main execution function for AST cleaning
 */
export function execute(ast, context) {
  let stats = {
    classesFixed: 0,
    overflowAdded: false,
    textSizesConverted: 0,
    widthsAdded: 0,
    sectionsDetected: 0,
    nodesAnalyzed: 0
  }

  // Reset root container flag
  resetRootContainer()

  traverse.default(ast, {
    JSXElement(path) {
      // Add overflow-x-hidden to root container
      if (addOverflowXHidden(path)) {
        stats.overflowAdded = true
      }

      // Clean invalid classes
      if (cleanClasses(path)) {
        stats.classesFixed++
      }

      // Convert text sizes
      if (convertTextSizes(path)) {
        stats.textSizesConverted++
      }

      // Add width to flex grow items
      if (addWidthToFlexGrow(path)) {
        stats.widthsAdded++
      }

      // Count nodes
      if (countNode(path, context.analysis || {})) {
        stats.nodesAnalyzed++
      }
    },

    JSXText(path) {
      // Detect sections
      if (detectSection(path, context.analysis || {})) {
        stats.sectionsDetected++
      }
    }
  })

  return stats
}

/**
 * Add w-full to flex items with basis-0 grow that don't have explicit width
 * Fixes issue where flex items don't grow correctly (especially with negative margins)
 */
export function addWidthToFlexGrow(path) {
  const attributes = path.node.openingElement.attributes
  const classNameAttr = attributes.find(
    attr => attr.name && attr.name.name === 'className'
  )

  if (!classNameAttr || !t.isStringLiteral(classNameAttr.value)) return false

  const className = classNameAttr.value.value
  const classes = className.split(/\s+/)

  // Must have 'basis-0' and 'grow'
  const hasBasis0 = classes.some(c => c === 'basis-0' || c.startsWith('basis-0'))
  const hasGrow = classes.includes('grow')

  if (!hasBasis0 || !hasGrow) return false

  // Must NOT already have explicit width (w-, min-w-, max-w-)
  // EXCEPT min-w-px which is just a Figma technical value (min-width: 1px)
  const hasWidth = classes.some(c =>
    c.startsWith('w-') ||
    (c.startsWith('min-w-') && c !== 'min-w-px') ||
    c.startsWith('max-w-')
  )

  if (hasWidth) return false

  // NOTE: Elements with negative margins (carousel pattern) NEED w-full!
  // Example: parent has pr-[380px] (content = 492px), child1 w-[469px], child2 basis-0 grow
  // Without w-full: child2 = 492 - 469 = 23px (WRONG!)
  // With w-full: child2 = 100% of parent width, then mr-[-380px] makes it overflow correctly

  // Add w-full
  classNameAttr.value = t.stringLiteral(className + ' w-full')
  return true
}

