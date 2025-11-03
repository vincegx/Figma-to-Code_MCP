/**
 * Tailwind Optimizer
 *
 * Converts arbitrary Tailwind values to standard classes when possible:
 * - gap-[8px] → gap-2
 * - w-[100px] → w-24
 * - rounded-[4px] → rounded
 *
 * Extracted from post-processor-fix.js (lines 355-404)
 */

import traverse from '@babel/traverse'
import * as t from '@babel/types'

export const meta = {
  name: 'tailwind-optimizer',
  priority: 40 // Must run LAST (after all other transforms)
}

/**
 * Main execution function for Tailwind optimizer
 */
export function execute(ast, context) {
  let classesOptimized = 0

  traverse.default(ast, {
    JSXElement(path) {
      const attributes = path.node.openingElement.attributes
      const classNameAttr = attributes.find(
        attr => attr.name && attr.name.name === 'className'
      )

      if (classNameAttr && t.isStringLiteral(classNameAttr.value)) {
        const original = classNameAttr.value.value
        const optimized = optimizeTailwindClasses(original)

        if (optimized !== original) {
          classNameAttr.value = t.stringLiteral(optimized)
          classesOptimized++
        }
      }
    }
  })

  return { classesOptimized }
}

/**
 * Optimize Tailwind classes: arbitrary → standard when possible
 */
export function optimizeTailwindClasses(classString) {
  let optimized = classString

  // Map of conversions: arbitrary → standard Tailwind
  const conversions = {
    // ═══════════════════════════════════════════════════════════
    // WIDTHS (common values)
    // ═══════════════════════════════════════════════════════════
    'w-\\[96px\\]': 'w-24',   // 96px = 24 * 4px
    'w-\\[100px\\]': 'w-24',  // Close enough
    'w-\\[192px\\]': 'w-48',  // 192px = 48 * 4px
    'w-\\[200px\\]': 'w-48',  // Close enough
    'w-\\[288px\\]': 'w-72',  // 288px = 72 * 4px
    'w-\\[300px\\]': 'w-72',  // Close enough
    'w-\\[384px\\]': 'w-96',  // 384px = 96 * 4px
    'w-\\[400px\\]': 'w-96',  // Close enough

    // ═══════════════════════════════════════════════════════════
    // HEIGHTS (common values)
    // ═══════════════════════════════════════════════════════════
    'h-\\[96px\\]': 'h-24',
    'h-\\[100px\\]': 'h-24',
    'h-\\[192px\\]': 'h-48',
    'h-\\[200px\\]': 'h-48',
    'h-\\[288px\\]': 'h-72',
    'h-\\[300px\\]': 'h-72',
    'h-\\[384px\\]': 'h-96',
    'h-\\[400px\\]': 'h-96',

    // ═══════════════════════════════════════════════════════════
    // GAPS (spacing scale: 4px base)
    // ═══════════════════════════════════════════════════════════
    'gap-\\[4px\\]': 'gap-1',    // 4px
    'gap-\\[8px\\]': 'gap-2',    // 8px
    'gap-\\[12px\\]': 'gap-3',   // 12px
    'gap-\\[16px\\]': 'gap-4',   // 16px
    'gap-\\[20px\\]': 'gap-5',   // 20px
    'gap-\\[24px\\]': 'gap-6',   // 24px
    'gap-\\[28px\\]': 'gap-7',   // 28px
    'gap-\\[32px\\]': 'gap-8',   // 32px
    'gap-\\[40px\\]': 'gap-10',  // 40px
    'gap-\\[48px\\]': 'gap-12',  // 48px
    'gap-\\[64px\\]': 'gap-16',  // 64px

    // ═══════════════════════════════════════════════════════════
    // PADDING (all sides)
    // ═══════════════════════════════════════════════════════════
    'p-\\[4px\\]': 'p-1',
    'p-\\[8px\\]': 'p-2',
    'p-\\[12px\\]': 'p-3',
    'p-\\[16px\\]': 'p-4',
    'p-\\[20px\\]': 'p-5',
    'p-\\[24px\\]': 'p-6',
    'p-\\[32px\\]': 'p-8',
    'p-\\[40px\\]': 'p-10',
    'p-\\[48px\\]': 'p-12',

    // Horizontal padding
    'px-\\[4px\\]': 'px-1',
    'px-\\[8px\\]': 'px-2',
    'px-\\[12px\\]': 'px-3',
    'px-\\[16px\\]': 'px-4',
    'px-\\[20px\\]': 'px-5',
    'px-\\[24px\\]': 'px-6',
    'px-\\[32px\\]': 'px-8',

    // Vertical padding
    'py-\\[4px\\]': 'py-1',
    'py-\\[8px\\]': 'py-2',
    'py-\\[12px\\]': 'py-3',
    'py-\\[16px\\]': 'py-4',
    'py-\\[20px\\]': 'py-5',
    'py-\\[24px\\]': 'py-6',
    'py-\\[32px\\]': 'py-8',

    // ═══════════════════════════════════════════════════════════
    // MARGIN
    // ═══════════════════════════════════════════════════════════
    'm-\\[4px\\]': 'm-1',
    'm-\\[8px\\]': 'm-2',
    'm-\\[12px\\]': 'm-3',
    'm-\\[16px\\]': 'm-4',
    'm-\\[20px\\]': 'm-5',
    'm-\\[24px\\]': 'm-6',
    'm-\\[32px\\]': 'm-8',

    // ═══════════════════════════════════════════════════════════
    // BORDER RADIUS
    // ═══════════════════════════════════════════════════════════
    'rounded-\\[2px\\]': 'rounded-sm',     // 2px
    'rounded-\\[4px\\]': 'rounded',        // 4px
    'rounded-\\[6px\\]': 'rounded-md',     // 6px
    'rounded-\\[8px\\]': 'rounded-lg',     // 8px
    'rounded-\\[12px\\]': 'rounded-xl',    // 12px
    'rounded-\\[16px\\]': 'rounded-2xl',   // 16px
    'rounded-\\[24px\\]': 'rounded-3xl',   // 24px
    'rounded-\\[9999px\\]': 'rounded-full', // Circle

    // ═══════════════════════════════════════════════════════════
    // SQUARE SIZES (w-[X] h-[X] → size-X when both present)
    // ═══════════════════════════════════════════════════════════
    'w-\\[16px\\]\\s+h-\\[16px\\]': 'size-4',
    'w-\\[20px\\]\\s+h-\\[20px\\]': 'size-5',
    'w-\\[24px\\]\\s+h-\\[24px\\]': 'size-6',
    'w-\\[32px\\]\\s+h-\\[32px\\]': 'size-8',
    'w-\\[40px\\]\\s+h-\\[40px\\]': 'size-10',
    'w-\\[48px\\]\\s+h-\\[48px\\]': 'size-12',
    'w-\\[64px\\]\\s+h-\\[64px\\]': 'size-16',
    'w-\\[80px\\]\\s+h-\\[80px\\]': 'size-20',
    'w-\\[96px\\]\\s+h-\\[96px\\]': 'size-24',
    'w-\\[100px\\]\\s+h-\\[100px\\]': 'size-24'
  }

  // Apply all conversions
  for (const [pattern, replacement] of Object.entries(conversions)) {
    const regex = new RegExp(pattern, 'g')
    optimized = optimized.replace(regex, replacement)
  }

  // Clean up multiple spaces
  optimized = optimized.replace(/\s+/g, ' ').trim()

  return optimized
}
