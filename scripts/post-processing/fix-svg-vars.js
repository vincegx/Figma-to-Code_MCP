#!/usr/bin/env node
/**
 * Fix SVG Issues
 *
 * Figma MCP generates SVGs with multiple issues that break rendering:
 * 1. CSS variables: fill="var(--fill-0, white)" → fill="white"
 * 2. Destructive attributes that distort the SVG:
 *    - preserveAspectRatio="none" → removed (breaks proportions)
 *    - width="100%" height="100%" → removed (breaks sizing, viewBox is enough)
 *    - overflow="visible" → removed (can cause overlaps)
 *
 * This script fixes both issues in a single pass.
 *
 * Usage:
 *   node scripts/fix-svg-vars.js <directory>
 *
 * Example:
 *   node scripts/fix-svg-vars.js src/generated/tests/test-123/img
 */

import fs from 'fs'
import path from 'path'

const directory = process.argv[2]

if (!directory) {
  console.error('Usage: node fix-svg-vars.js <directory>')
  process.exit(1)
}

if (!fs.existsSync(directory)) {
  console.error(`❌ Directory not found: ${directory}`)
  process.exit(1)
}

console.log('🔧 Fixing SVG issues (CSS vars + destructive attributes)...')
console.log(`   Directory: ${directory}`)

// Get all SVG files
const files = fs.readdirSync(directory).filter(file => file.endsWith('.svg'))

if (files.length === 0) {
  console.log('ℹ️  No SVG files found')
  process.exit(0)
}

console.log(`\n📦 Found ${files.length} SVG files`)

let fixedCount = 0
let totalCSSVarsFixed = 0
let totalAttributesFixed = 0

for (const file of files) {
  const filePath = path.join(directory, file)
  let content = fs.readFileSync(filePath, 'utf8')
  let modified = false
  let cssVarsFixed = 0
  let attributesFixed = 0

  // ═══ FIX 1: CSS Variables ═══
  const varsBefore = (content.match(/var\(--[^)]+\)/g) || []).length

  if (varsBefore > 0) {
    // Replace all patterns: var(--anything, fallback) → fallback
    content = content.replace(/var\(--[^,]+,\s*([^)]+)\)/g, (_match, fallback) => {
      return fallback.trim()
    })

    const varsAfter = (content.match(/var\(--[^)]+\)/g) || []).length
    cssVarsFixed = varsBefore - varsAfter

    if (cssVarsFixed > 0) {
      modified = true
      totalCSSVarsFixed += cssVarsFixed
    }
  }

  // ═══ FIX 2: Destructive Attributes ═══

  // Remove preserveAspectRatio="none" (keeps SVG proportions)
  if (content.includes('preserveAspectRatio="none"')) {
    content = content.replace(/\spreserveAspectRatio="none"/g, '')
    modified = true
    attributesFixed++
  }

  // Remove width="100%" and height="100%" (let viewBox handle sizing)
  if (content.includes('width="100%"')) {
    content = content.replace(/\swidth="100%"/g, '')
    modified = true
    attributesFixed++
  }
  if (content.includes('height="100%"')) {
    content = content.replace(/\sheight="100%"/g, '')
    modified = true
    attributesFixed++
  }

  // Remove overflow="visible" (can cause issues)
  if (content.includes('overflow="visible"')) {
    content = content.replace(/\soverflow="visible"/g, '')
    modified = true
    attributesFixed++
  }

  // ═══ SAVE IF MODIFIED ═══
  if (modified) {
    fs.writeFileSync(filePath, content, 'utf8')

    const fixes = []
    if (cssVarsFixed > 0) fixes.push(`${cssVarsFixed} CSS vars`)
    if (attributesFixed > 0) fixes.push(`${attributesFixed} attributes`)

    console.log(`   ✅ Fixed ${file} (${fixes.join(', ')})`)
    fixedCount++
    totalAttributesFixed += attributesFixed
  }
}

console.log(`\n✅ Fixed ${fixedCount} SVG files`)
if (totalCSSVarsFixed > 0) {
  console.log(`   CSS variables replaced: ${totalCSSVarsFixed}`)
}
if (totalAttributesFixed > 0) {
  console.log(`   Destructive attributes removed: ${totalAttributesFixed}`)
}
console.log(`   SVGs now use proper viewBox scaling with correct proportions! 🎨`)
