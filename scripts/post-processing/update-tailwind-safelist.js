#!/usr/bin/env node

/**
 * Update Tailwind safelist with arbitrary color classes from generated test
 * Only modifies tailwind.config.js if new classes are detected
 */

import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)
const ROOT_DIR = path.resolve(__dirname, '../..')

/**
 * Extract ALL arbitrary value classes from a TSX file
 * Matches: bg-[#...], text-[#...], h-[700px], w-[50%], gap-[80px], etc.
 */
function extractArbitraryColorClasses(tsxContent) {
  const classes = new Set()

  // Pattern: any-class-[arbitrary-value]
  // Matches: bg-[#hex], h-[700px], w-[50%], gap-[80px], text-[rgba(...)], etc.
  // This catches ALL arbitrary values in square brackets
  const arbitraryPattern = /[\w-]+-\[[^\]]+\]/g

  let match

  while ((match = arbitraryPattern.exec(tsxContent)) !== null) {
    const className = match[0]

    // Skip if it's a font-family class (handled separately by font-detection)
    if (className.startsWith('font-[')) {
      continue
    }

    // Skip if it contains JavaScript expressions (like calc, var, etc.)
    // These need to be evaluated at runtime, not safelisted
    if (className.includes('calc(') || className.includes('var(')) {
      continue
    }

    classes.add(className)
  }

  return Array.from(classes).sort()
}

/**
 * Extract current safelist from tailwind.config.js
 */
function getCurrentSafelist(configPath) {
  if (!fs.existsSync(configPath)) {
    return []
  }

  const configContent = fs.readFileSync(configPath, 'utf-8')

  // Find safelist array - look for standalone safelist (not in theme)
  // Pattern: safelist: [ ... ],
  const safelistMatch = configContent.match(/\n\s*safelist:\s*\[([\s\S]*?)\],?\s*\n/m)
  if (!safelistMatch) {
    return []
  }

  const safelistContent = safelistMatch[1]

  // Extract quoted strings
  const items = []
  const stringPattern = /['"]([^'"]+)['"]/g
  let match

  while ((match = stringPattern.exec(safelistContent)) !== null) {
    items.push(match[1])
  }

  return items
}

/**
 * Update tailwind.config.js with new safelist classes
 */
function updateTailwindConfig(configPath, newClasses) {
  let configContent = fs.readFileSync(configPath, 'utf-8')

  // Check if safelist exists
  if (!configContent.match(/\n\s*safelist:\s*\[/)) {
    // Add safelist after theme section
    const safelistSection = `  safelist: [\n    ${newClasses.map(c => `'${c}'`).join(',\n    ')}\n  ],\n`

    // Insert after closing of theme object
    configContent = configContent.replace(
      /(theme:\s*{[\s\S]*?}\s*,?\s*\n\s*},)/m,
      `$1\n${safelistSection}`
    )
  } else {
    // Replace existing safelist completely
    const safelistArray = `safelist: [\n    ${newClasses.map(c => `'${c}'`).join(',\n    ')}\n  ]`

    configContent = configContent.replace(
      /\n\s*safelist:\s*\[[\s\S]*?\],?\s*\n/m,
      `\n  ${safelistArray},\n`
    )
  }

  fs.writeFileSync(configPath, configContent, 'utf-8')
}

/**
 * Save classes to test's metadata.json
 */
function saveClassesToMetadata(testDir, classes) {
  const metadataPath = path.join(testDir, 'metadata.json')

  if (!fs.existsSync(metadataPath)) {
    return
  }

  try {
    const metadata = JSON.parse(fs.readFileSync(metadataPath, 'utf-8'))
    metadata.tailwindClasses = classes.sort()
    fs.writeFileSync(metadataPath, JSON.stringify(metadata, null, 2), 'utf-8')
  } catch (err) {
    console.warn(`   ⚠️  Could not save classes to metadata.json: ${err.message}`)
  }
}

/**
 * Main function
 */
export function updateSafelistForTest(testDir) {
  const componentPath = path.join(testDir, 'Component-fixed.tsx')
  const configPath = path.join(ROOT_DIR, 'tailwind.config.js')

  if (!fs.existsSync(componentPath)) {
    console.log(`   ⚠️  Component-fixed.tsx not found in ${testDir}`)
    return { updated: false }
  }

  // Extract classes from new test
  const tsxContent = fs.readFileSync(componentPath, 'utf-8')
  const newClasses = extractArbitraryColorClasses(tsxContent)

  if (newClasses.length === 0) {
    console.log(`   ℹ️  No arbitrary value classes found in test`)
    return { updated: false, classes: [] }
  }

  // Save classes to this test's metadata.json
  saveClassesToMetadata(testDir, newClasses)

  // Get current safelist
  const currentSafelist = getCurrentSafelist(configPath)

  // Check if all new classes are already in safelist
  const missingClasses = newClasses.filter(c => !currentSafelist.includes(c))

  if (missingClasses.length === 0) {
    console.log(`   ✅ All arbitrary value classes already in safelist (${newClasses.length} classes)`)
    return { updated: false, classes: newClasses }
  }

  // Merge and sort
  const allClasses = [...new Set([...currentSafelist, ...newClasses])].sort()

  // Update config
  updateTailwindConfig(configPath, allClasses)

  console.log(`   ✅ Tailwind safelist updated:`)
  console.log(`      - Previous: ${currentSafelist.length} classes`)
  console.log(`      - New: ${missingClasses.length} classes added`)
  console.log(`      - Total: ${allClasses.length} classes`)
  console.log(`      - Added: ${missingClasses.join(', ')}`)

  return {
    updated: true,
    classes: allClasses,
    added: missingClasses
  }
}

// CLI usage
if (import.meta.url === `file://${process.argv[1]}`) {
  const testDir = process.argv[2]

  if (!testDir) {
    console.error('Usage: node update-tailwind-safelist.js <testDir>')
    process.exit(1)
  }

  const result = updateSafelistForTest(testDir)
  process.exit(result.updated ? 0 : 1)
}
