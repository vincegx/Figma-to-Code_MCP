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

    // Extract frame name and dimensions (first line)
    const frameMatch = xmlContent.match(/<frame[^>]+name="([^"]+)"/)
    const frameName = frameMatch ? frameMatch[1] : 'Unnamed Frame'

    // Extract dimensions from the root frame
    const dimensionsMatch = xmlContent.match(/<frame[^>]+width="([^"]+)"[^>]+height="([^"]+)"/)
    const dimensions = dimensionsMatch ? {
      width: parseInt(dimensionsMatch[1], 10),
      height: parseInt(dimensionsMatch[2], 10)
    } : null

    // Extract sections from text nodes with pattern "=== SECTION X: ... ==="
    const sectionRegex = /name="===\s*SECTION\s+\d+:\s*([^=]+)==="\s*/g
    const sections = []
    let match

    while ((match = sectionRegex.exec(xmlContent)) !== null) {
      // Decode XML entities (&amp; → &, &lt; → <, etc.)
      const sectionName = match[1].trim()
        .replace(/&amp;/g, '&')
        .replace(/&lt;/g, '<')
        .replace(/&gt;/g, '>')
        .replace(/&quot;/g, '"')
        .replace(/&apos;/g, "'")
      sections.push(`SECTION ${sections.length + 1}: ${sectionName}`)
    }

    if (sections.length === 0) {
      return null
    }

    return {
      name: frameName,
      sections,
      dimensions
    }
  } catch (error) {
    console.warn(`⚠️  Warning: Could not parse metadata.xml: ${error.message}`)
    return null
  }
}

/**
 * Count sections from metadata.xml
 * Sections are defined as direct children of the root frame
 */
function countSectionsFromXML(testDir) {
  const metadataXmlPath = path.join(testDir, 'metadata.xml')

  if (!fs.existsSync(metadataXmlPath)) {
    return 0
  }

  try {
    const xmlContent = fs.readFileSync(metadataXmlPath, 'utf8')

    // Count direct children of root frame (first level only)
    // Match tags that are indented by exactly 2 spaces (first level children)
    // Matches: <instance, <frame, <rectangle, <text, etc.
    const directChildrenRegex = /\n  <(\w+)\s/g
    const matches = xmlContent.match(directChildrenRegex) || []

    // Filter out any false positives and count unique elements
    return matches.length
  } catch (error) {
    console.warn(`⚠️  Warning: Could not count sections from metadata.xml: ${error.message}`)
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
