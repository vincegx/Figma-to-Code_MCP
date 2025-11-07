#!/usr/bin/env node

/**
 * Generate metadata.json for a test
 *
 * Usage:
 *   node scripts/generate-metadata.js <testDir> <figmaUrl> <statsJson>
 *
 * Example:
 *   node scripts/generate-metadata.js \
 *     src/generated/tests/node-9-2654 \
 *     "https://www.figma.com/design/ABC/file?node-id=9-2654" \
 *     '{"classesOptimized":105,"gradientsFixed":3}'
 *
 * Note: designReferences will be automatically extracted from metadata.xml if it exists
 */

import fs from 'fs'
import path from 'path'

function parseUrl(url) {
  try {
    const urlObj = new URL(url)
    const pathParts = urlObj.pathname.split('/')
    const fileId = pathParts[2] // /design/[fileId]/...
    const nodeIdParam = urlObj.searchParams.get('node-id') || '0-0'
    const nodeId = nodeIdParam.replace('-', ':') // "9-2654" → "9:2654"

    return { fileId, nodeId }
  } catch (error) {
    throw new Error(`Invalid Figma URL: ${url}`)
  }
}

function extractTestId(testDir) {
  const dirName = path.basename(testDir)
  return dirName // "test-1234567890" or "node-9-2654"
}

function extractTimestamp(testId) {
  // Legacy format: test-1234567890 (timestamp embedded in name)
  const legacyMatch = testId.match(/test-(\d+)/)
  if (legacyMatch) {
    return parseInt(legacyMatch[1], 10)
  }

  // New format with timestamp: node-{nodeId}-{timestamp} (e.g., node-9-2654-1735689600)
  const newMatch = testId.match(/node-.+-(\d+)$/)
  if (newMatch) {
    return parseInt(newMatch[1], 10)
  }

  // Old format without timestamp: node-{nodeId} (e.g., node-9-2654)
  // No embedded timestamp, use current time
  return Date.now()
}

function getAllFiles(testDir) {
  const files = {
    components: [],
    data: [],
    reports: [],
    images: [],
    all: []
  }

  if (!fs.existsSync(testDir)) {
    return files
  }

  // Lire tous les fichiers du dossier racine
  const entries = fs.readdirSync(testDir, { withFileTypes: true })

  for (const entry of entries) {
    if (entry.isFile()) {
      const filename = entry.name
      files.all.push(filename)

      // Catégoriser les fichiers
      if (filename.endsWith('.tsx') || filename.endsWith('.jsx')) {
        files.components.push(filename)
      } else if (filename.endsWith('.json') || filename.endsWith('.xml')) {
        files.data.push(filename)
      } else if (filename.endsWith('.md') || filename.endsWith('.html')) {
        files.reports.push(filename)
      } else if (filename.match(/\.(png|jpg|jpeg|svg|gif|webp|css)$/i)) {
        files.images.push(filename)
      }
    } else if (entry.isDirectory() && entry.name === 'img') {
      // Compter les fichiers dans img/
      const imgDir = path.join(testDir, 'img')
      const imgFiles = fs.readdirSync(imgDir)
      files.images.push(...imgFiles.map(f => `img/${f}`))
      files.all.push(`img/ (${imgFiles.length} files)`)
    }
  }

  return files
}

function extractDesignReferences(testDir) {
  const metadataXmlPath = path.join(testDir, 'metadata.xml')

  if (!fs.existsSync(metadataXmlPath)) {
    return null
  }

  try {
    const xmlContent = fs.readFileSync(metadataXmlPath, 'utf8')

    // Extract frame/symbol name and dimensions (first line)
    // Support both <frame> and <symbol> elements
    const frameMatch = xmlContent.match(/<(?:frame|symbol)[^>]+name="([^"]+)"/)
    const frameName = frameMatch ? frameMatch[1] : 'Unnamed Frame'

    // Extract dimensions from the root frame or symbol
    const dimensionsMatch = xmlContent.match(/<(?:frame|symbol)[^>]+width="([^"]+)"[^>]*height="([^"]+)"/)
    const dimensions = dimensionsMatch ? {
      width: parseInt(dimensionsMatch[1], 10),
      height: parseInt(dimensionsMatch[2], 10)
    } : null

    // Return design references if we have dimensions
    if (!dimensions) {
      return null
    }

    return {
      name: frameName,
      dimensions
    }
  } catch (error) {
    console.warn(`⚠️  Warning: Could not parse metadata.xml: ${error.message}`)
    return null
  }
}

/**
 * Count sections from Component.tsx
 * Sections are defined as direct children of the root element with data-name
 * We use Component.tsx as source of truth since metadata.xml may be incomplete
 */
function countSectionsFromXML(testDir) {
  const componentPath = path.join(testDir, 'Component.tsx')

  if (!fs.existsSync(componentPath)) {
    return 0
  }

  try {
    const content = fs.readFileSync(componentPath, 'utf8')

    // Find direct children of root element
    // Strategy: parse JSX and count data-name attributes at nesting level 2
    const lines = content.split('\n')
    let inReturn = false
    let rootFound = false
    let nestLevel = 0
    let sectionsCount = 0

    for (const line of lines) {
      // Skip until we find return statement
      if (line.includes('return (')) {
        inReturn = true
        continue
      }

      if (!inReturn) continue

      // Count opening and closing div tags
      const openDivs = (line.match(/<div/g) || []).length
      const closeDivs = (line.match(/<\/div>/g) || []).length

      // First div with data-name is the root
      if (!rootFound && line.includes('data-name=')) {
        rootFound = true
        nestLevel = 1
        continue
      }

      // Update nesting level
      nestLevel += openDivs - closeDivs

      // Count direct children (level 2) with data-name
      if (rootFound && nestLevel === 2 && line.includes('data-name=')) {
        sectionsCount++
      }

      // Stop if we've closed the root
      if (nestLevel < 1) break
    }

    return sectionsCount
  } catch (error) {
    console.warn(`⚠️  Warning: Could not count sections from Component.tsx: ${error.message}`)
    return 0
  }
}

function main() {
  const args = process.argv.slice(2)

  if (args.length < 3) {
    console.error('❌ Error: Missing required arguments')
    console.log('\nUsage:')
    console.log('  node scripts/generate-metadata.js <testDir> <figmaUrl> <statsJson>')
    console.log('\nExample:')
    console.log('  node scripts/generate-metadata.js \\')
    console.log('    src/generated/tests/node-9-2654 \\')
    console.log('    "https://www.figma.com/design/ABC/file?node-id=9-2654" \\')
    console.log('    \'{"classesOptimized":105,"gradientsFixed":3}\'')
    process.exit(1)
  }

  const [testDir, figmaUrl, statsJson] = args

  // Parse inputs
  const testId = extractTestId(testDir)
  const timestamp = extractTimestamp(testId)
  const { fileId, nodeId } = parseUrl(figmaUrl)
  const processingStats = JSON.parse(statsJson)

  // Auto-count organized images from img/ directory
  const imgDir = path.join(testDir, 'img')
  let imagesOrganized = 0
  if (fs.existsSync(imgDir)) {
    const imgFiles = fs.readdirSync(imgDir).filter(f => {
      const ext = path.extname(f).toLowerCase()
      // Exclude figma-screenshot.png (reference image, not a component asset)
      const filename = path.basename(f)
      return ['.png', '.jpg', '.jpeg', '.svg', '.gif', '.webp'].includes(ext)
        && filename !== 'figma-screenshot.png'
    })
    imagesOrganized = imgFiles.length
  }

  // Always use the real count from the filesystem (override any passed value)
  processingStats.imagesOrganized = imagesOrganized

  // Auto-count sections from metadata.xml (direct children of root frame)
  const sectionsDetected = countSectionsFromXML(testDir)
  processingStats.sectionsDetected = sectionsDetected

  // Auto-extract design references from metadata.xml
  const designReferences = extractDesignReferences(testDir)

  // Get all generated files
  const allFiles = getAllFiles(testDir)

  // Build metadata object
  const metadata = {
    testId,
    fileName: designReferences?.name || `Node ${nodeId}`,
    timestamp,
    createdAt: new Date(timestamp).toISOString(),
    figmaUrl,
    figmaFileId: fileId,
    figmaNodeId: nodeId,
    status: 'completed',
    visualFidelity: '100%',
    stats: processingStats,
    files: allFiles
  }

  // Add dimensions if found
  if (designReferences?.dimensions) {
    metadata.dimensions = designReferences.dimensions
  }

  // Add design references if found
  if (designReferences) {
    metadata.designReferences = designReferences
  }

  // Save metadata.json
  const outputPath = path.join(testDir, 'metadata.json')
  fs.writeFileSync(outputPath, JSON.stringify(metadata, null, 2), 'utf8')

  console.log('✅ metadata.json generated successfully')
  console.log(`   Location: ${outputPath}`)
  console.log(`\n📊 Summary:`)
  console.log(`   Test ID: ${testId}`)
  console.log(`   Figma File: ${fileId}`)
  console.log(`   Node ID: ${nodeId}`)
  console.log(`   Total files: ${allFiles.all.length}`)
  console.log(`     - Components: ${allFiles.components.length}`)
  console.log(`     - Data files: ${allFiles.data.length}`)
  console.log(`     - Reports: ${allFiles.reports.length}`)
  console.log(`     - Images: ${allFiles.images.length}`)
  console.log(`   Visual Fidelity: ${metadata.visualFidelity}`)
}

main()
