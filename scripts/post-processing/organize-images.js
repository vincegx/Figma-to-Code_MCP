#!/usr/bin/env node
/**
 * Organize Images - Move, rename, and organize images before unified-processor
 *
 * IMPORTANT: This script runs BEFORE unified-processor.js to prepare images.
 *
 * This script:
 * 1. Creates an img/ subfolder in the test directory
 * 2. Moves all image files (PNG, SVG) to img/
 * 3. Renames hash-based filenames with Figma layer names:
 *    - SHA1 hash → descriptive names (frame-1008.png, image.png, vector.svg)
 * 4. Updates all image paths in Component.tsx:
 *    - Absolute paths → ./img/filename
 *    - Relative paths (./) → ./img/filename
 * 5. Converts const declarations to ES6 imports
 *
 * After this, unified-processor.js generates metadata.json and reports with correct names.
 *
 * Usage:
 *   node scripts/organize-images.js <test-directory> <component-file>
 *
 * Example:
 *   node scripts/organize-images.js \
 *     src/generated/export_figma/test-123 \
 *     src/generated/export_figma/test-123/Component.tsx
 */

import fs from 'fs'
import path from 'path'

// ═══════════════════════════════════════════════════════════════
// HELPER FUNCTIONS
// ═══════════════════════════════════════════════════════════════

/**
 * Check if a variable name is a valid JavaScript identifier
 */
function isValidIdentifier(name) {
  // Must start with letter, underscore, or dollar sign
  // Can contain letters, numbers, underscore, dollar sign
  return /^[a-zA-Z_$][a-zA-Z0-9_$]*$/.test(name)
}

/**
 * Sanitize variable names to be valid JavaScript identifiers
 * - Remove/replace invalid characters (=, spaces, -, etc.)
 * - Ensure starts with letter or underscore
 * - Only sanitize if name is invalid
 */
function sanitizeVariableName(varName) {
  // If already valid, return as-is
  if (isValidIdentifier(varName)) {
    return varName
  }

  // Replace invalid characters with underscore
  // Valid chars: letters, numbers, underscore, dollar sign
  // Invalid chars: =, -, spaces, etc.
  let sanitized = varName
    .replace(/[^a-zA-Z0-9_$]/g, '_')  // Replace invalid chars with underscore
    .replace(/_+/g, '_')              // Collapse multiple underscores
    .replace(/^_+|_+$/g, '')          // Remove leading/trailing underscores

  // Ensure starts with valid character (letter, underscore, or $)
  if (sanitized && !/^[a-zA-Z_$]/.test(sanitized)) {
    sanitized = 'img_' + sanitized
  }

  // Ensure non-empty
  if (!sanitized) {
    sanitized = 'imgImage'
  }

  return sanitized
}

/**
 * Parse metadata.xml to extract nodeId → layerName mapping for image nodes
 * @param {string} metadataPath - Path to metadata.xml
 * @returns {Map<string, string>} Map of nodeId to layerName
 */
function parseMetadataForImageNodes(metadataPath) {
  if (!fs.existsSync(metadataPath)) {
    console.warn('   ⚠️  metadata.xml not found, skipping semantic naming')
    return new Map()
  }

  const xmlContent = fs.readFileSync(metadataPath, 'utf8')
  const nodeToLayer = new Map()

  // Match all XML tags that could contain images:
  // <image id="X" name="..." />
  // <rectangle id="Y" name="..." /> (can have image fills)
  // <vector id="Z" name="..." />
  // <rounded-rectangle id="W" name="..." />
  const tagPattern = /<(image|rectangle|vector|rounded-rectangle|ellipse|frame|instance)\s+id="([^"]+)"\s+name="([^"]+)"/g

  let match
  while ((match = tagPattern.exec(xmlContent)) !== null) {
    const nodeId = match[2]
    const layerName = match[3]
    nodeToLayer.set(nodeId, layerName)
  }

  return nodeToLayer
}

/**
 * Parse TSX code to extract varName → layerName mapping via data-name attributes
 * Since <img> tags don't have data-node-id, we look for parent <div> with data-name
 * @param {string} tsxCode - TSX source code
 * @returns {Map<string, string>} Map of varName to layerName (directly from data-name)
 */
function extractImageVarToNodeMapping(tsxCode) {
  const varToName = new Map()

  // Pattern: Find <div data-name="..." ...> ... <img src={varName} /> ... </div>
  // We'll match the div and extract both data-name and the img varName
  // Simpler pattern: <div[^>]*data-name="([^"]+)"[^>]*>.*?<img[^>]*src=\{(\w+)\}
  const divImgPattern = /<div[^>]*data-name="([^"]+)"[^>]*>.*?<img[^>]*src=\{(\w+)\}[^>]*>/gs

  let match
  while ((match = divImgPattern.exec(tsxCode)) !== null) {
    const layerName = match[1]
    const varName = match[2]

    // Only map if we don't already have this varName (first occurrence wins)
    if (!varToName.has(varName)) {
      varToName.set(varName, layerName)
    }
  }

  // Also try reverse pattern: <img> before data-name in same context
  // Reset regex index
  tsxCode.matchAll(/<img[^>]*src=\{(\w+)\}[^>]*>.*?<div[^>]*data-name="([^"]+)"/gs)

  return varToName
}

/**
 * Convert Figma layer name to valid JavaScript variable name (camelCase)
 * @param {string} layerName - Figma layer name (e.g., "Google Logo", "image 8", "MASK SCREEN (2556 X 1179)")
 * @returns {string} camelCase variable name (e.g., "googleLogo", "image8", "maskScreen")
 */
function layerNameToVarName(layerName) {
  let varName = layerName
    .replace(/\([^)]+\)/g, '')        // Remove parentheses: "(2556 X 1179)" → ""
    .replace(/[^a-zA-Z0-9]/g, ' ')    // Replace special chars with space
    .trim()
    .split(/\s+/)
    .filter(word => word.length > 0)
    .map((word, i) => {
      // First word: lowercase, rest: capitalize
      if (i === 0) {
        return word.toLowerCase()
      }
      return word.charAt(0).toUpperCase() + word.slice(1).toLowerCase()
    })
    .join('')

  // Ensure starts with letter, not digit (e.g., "09iphone" → "img09iphone")
  if (varName && /^\d/.test(varName)) {
    varName = 'img' + varName
  }

  return varName
}

/**
 * Create complete semantic image mapping: varName → { layerName, semanticName }
 * Extracts layer names directly from data-name attributes in TSX code
 * Ensures semantic names are unique by appending numbers if needed
 * @param {string} metadataPath - Path to metadata.xml (unused, kept for compatibility)
 * @param {string[]} tsxFiles - Array of TSX file paths to process
 * @returns {Map<string, object>} Semantic mapping
 */
function createSemanticImageMapping(metadataPath, tsxFiles) {
  const mapping = new Map()
  const usedNames = new Set()  // Track used semantic names to ensure uniqueness

  for (const file of tsxFiles) {
    const code = fs.readFileSync(file, 'utf8')
    const varToName = extractImageVarToNodeMapping(code)

    for (const [varName, layerName] of varToName) {
      // Skip generic/non-descriptive names
      if (!layerName || layerName.trim() === '') {
        continue
      }

      let semanticName = layerNameToVarName(layerName)

      // Ensure uniqueness: if name already used, append number
      if (usedNames.has(semanticName)) {
        let counter = 2
        let uniqueName = `${semanticName}${counter}`
        while (usedNames.has(uniqueName)) {
          counter++
          uniqueName = `${semanticName}${counter}`
        }
        semanticName = uniqueName
      }

      // Only add if semantic name is different and meaningful
      if (semanticName && semanticName !== varName) {
        mapping.set(varName, {
          layerName,
          semanticName
        })
        usedNames.add(semanticName)
      }
    }
  }

  return mapping
}

// ═══════════════════════════════════════════════════════════════
// CLI ARGUMENTS
// ═══════════════════════════════════════════════════════════════

const testDir = process.argv[2]
const componentFile = process.argv[3]

if (!testDir) {
  console.error('Usage: node organize-images.js <test-directory> [component-file]')
  console.error('\nExample:')
  console.error('  node scripts/organize-images.js src/generated/export_figma/test-123')
  console.error('\nAuto-detects chunking mode:')
  console.error('  - If chunks/ exists: processes all chunks/*.tsx')
  console.error('  - Otherwise: processes Component.tsx or specified file')
  console.error('\nIMPORTANT: Run this BEFORE unified-processor.js')
  process.exit(1)
}

// Validate testDir
if (!fs.existsSync(testDir)) {
  console.error(`❌ Test directory not found: ${testDir}`)
  process.exit(1)
}

// Detect mode
const chunksDir = path.join(testDir, 'chunks')
const isChunkingMode = fs.existsSync(chunksDir)

let filesToProcess = []

if (isChunkingMode) {
  // Chunking mode: process all chunks/*.tsx
  const chunkFiles = fs.readdirSync(chunksDir)
    .filter(f => f.endsWith('.tsx'))
    .map(f => path.join(chunksDir, f))

  if (chunkFiles.length === 0) {
    console.error(`❌ No .tsx files found in ${chunksDir}`)
    process.exit(1)
  }

  filesToProcess = chunkFiles
  console.log('📁 Organizing images (CHUNKING MODE)...')
  console.log(`   Test directory: ${testDir}`)
  console.log(`   Processing ${chunkFiles.length} chunk files`)
} else {
  // Normal mode: process Component.tsx or specified file
  const targetFile = componentFile || path.join(testDir, 'Component.tsx')

  if (!fs.existsSync(targetFile)) {
    console.error(`❌ Component file not found: ${targetFile}`)
    process.exit(1)
  }

  filesToProcess = [targetFile]
  console.log('📁 Organizing images (NORMAL MODE)...')
  console.log(`   Test directory: ${testDir}`)
  console.log(`   Component file: ${targetFile}`)
}

// ═══════════════════════════════════════════════════════════════
// STEP 1: Create img/ subfolder
// ═══════════════════════════════════════════════════════════════

const imgDir = path.join(testDir, 'img')

if (!fs.existsSync(imgDir)) {
  fs.mkdirSync(imgDir, { recursive: true })
  console.log('✅ Created img/ directory')
} else {
  console.log('ℹ️  img/ directory already exists')
}

// ═══════════════════════════════════════════════════════════════
// STEP 2: Find and move all image files
// ═══════════════════════════════════════════════════════════════

const imageExtensions = ['.png', '.jpg', '.jpeg', '.svg', '.gif', '.webp']
const files = fs.readdirSync(testDir)

const imagesToMove = files.filter(file => {
  const ext = path.extname(file).toLowerCase()
  const isImage = imageExtensions.includes(ext)
  const isInRoot = fs.statSync(path.join(testDir, file)).isFile()
  return isImage && isInRoot
})

console.log(`\n📦 Found ${imagesToMove.length} image files to organize:`)

const movedFiles = []

for (const imageFile of imagesToMove) {
  const sourcePath = path.join(testDir, imageFile)
  const destPath = path.join(imgDir, imageFile)

  try {
    // Move file (or copy if cross-device)
    fs.renameSync(sourcePath, destPath)
    movedFiles.push(imageFile)
    console.log(`   ✅ Moved: ${imageFile}`)
  } catch (error) {
    // Fallback: copy + delete if rename fails (cross-device)
    try {
      fs.copyFileSync(sourcePath, destPath)
      fs.unlinkSync(sourcePath)
      movedFiles.push(imageFile)
      console.log(`   ✅ Moved: ${imageFile} (via copy)`)
    } catch (copyError) {
      console.error(`   ❌ Failed to move ${imageFile}: ${copyError.message}`)
    }
  }
}

if (movedFiles.length === 0) {
  console.log('\nℹ️  No images to move (already organized or no images found)')
  // Continue to update paths and convert to imports even if no files were moved
}

// ═══════════════════════════════════════════════════════════════
// STEP 3: Update paths in all component files
// ═══════════════════════════════════════════════════════════════

console.log('\n🔧 Updating image paths in component files...')

let totalPathsUpdated = 0

// Get the test directory name from the full path
const testDirName = path.basename(testDir)

for (const file of filesToProcess) {
  let componentCode = fs.readFileSync(file, 'utf-8')
  let pathsUpdated = 0

  // Pattern 1: Absolute paths → relative to img/
  // In chunking mode: chunks/X.tsx needs ../img/
  // In normal mode: Component.tsx needs ./img/
  const imgRelativePath = isChunkingMode ? '../img/' : './img/'

  // Example: /Users/username/.../test-123/image.png → ./img/image.png or ../img/image.png
  const absolutePathRegex = new RegExp(
    `["\`]/[^"\`]*/${testDirName}/([^/"\`]+\\.(png|jpg|jpeg|svg|gif|webp))["\`]`,
    'gi'
  )

  componentCode = componentCode.replace(absolutePathRegex, (match, filename) => {
    pathsUpdated++
    const quote = match[0]
    return `${quote}${imgRelativePath}${filename}${quote}`
  })

  // Pattern 2: Relative paths (./) → ./img/ or ../img/
  // Example: "./image.png" → "./img/image.png" or "../img/image.png"
  // But NOT: "./img/image.png" → "./img/img/image.png"
  const relativePathRegex = /["'`]\.\/(?!img\/)([^/"'`]+\.(png|jpg|jpeg|svg|gif|webp))["'`]/gi

  componentCode = componentCode.replace(relativePathRegex, (match, filename) => {
    pathsUpdated++
    const quote = match[0]
    return `${quote}${imgRelativePath}${filename}${quote}`
  })

  // Write updated code back
  fs.writeFileSync(file, componentCode, 'utf-8')

  totalPathsUpdated += pathsUpdated
  console.log(`   ✅ ${path.basename(file)}: ${pathsUpdated} paths updated`)
}

console.log(`✅ Total: ${totalPathsUpdated} image path references updated`)

// ═══════════════════════════════════════════════════════════════
// STEP 4: Rename images based on Figma variable names
// ═══════════════════════════════════════════════════════════════

console.log('\n🏷️  Renaming images with Figma layer names...')

// Create semantic mapping from metadata.xml
const metadataPath = path.join(testDir, 'metadata.xml')
const semanticMapping = createSemanticImageMapping(metadataPath, filesToProcess)

if (semanticMapping.size > 0) {
  console.log(`   ✅ Created semantic mapping for ${semanticMapping.size} images from metadata.xml`)
  // Log some examples
  const examples = Array.from(semanticMapping.entries()).slice(0, 3)
  for (const [varName, info] of examples) {
    console.log(`      ${varName} → ${info.semanticName} (from "${info.layerName}")`)
  }
} else {
  console.log(`   ⚠️  No semantic mappings created (will use generic names)`)
}

// Collect all image declarations from all files
const allImageDeclarations = []

for (const file of filesToProcess) {
  const componentCode = fs.readFileSync(file, 'utf-8')

  // Pattern 1: const imgXXX = "./img/file.ext" OR const imgXXX = "/full/path/file.ext"
  const imageConstPattern = /^const\s+(img\w*)\s*=\s*["'`]([^"'`]+\.(?:png|jpg|jpeg|svg|gif|webp))["'`];?$/gm

  let importMatch
  while ((importMatch = imageConstPattern.exec(componentCode)) !== null) {
    const varName = importMatch[1]      // imgFrame1008, imgImage, imgVector
    const imagePath = importMatch[2]    // ./img/hash.svg or /full/path/hash.svg

    allImageDeclarations.push({
      file,
      original: importMatch[0],
      varName,
      imagePath
    })
  }

  // Pattern 2: ES6 imports - import imgXXX from "./img/file.ext"
  const imageImportPattern = /^import\s+(img\w*)\s+from\s+["'`]([^"'`]+\.(?:png|jpg|jpeg|svg|gif|webp))["'`];?$/gm

  while ((importMatch = imageImportPattern.exec(componentCode)) !== null) {
    const varName = importMatch[1]      // img, img1, img2, imgFrame1008
    const imagePath = importMatch[2]    // ./img/hash.svg or /full/path/hash.svg

    allImageDeclarations.push({
      file,
      original: importMatch[0],
      varName,
      imagePath
    })
  }
}

console.log(`   Found ${allImageDeclarations.length} image declarations (const + ES6 imports) across all files`)

// Deduplicate by hash filename (multiple chunks can use same images)
const uniqueDeclarations = new Map()
for (const decl of allImageDeclarations) {
  const oldFilename = path.basename(decl.imagePath)
  if (!uniqueDeclarations.has(oldFilename)) {
    uniqueDeclarations.set(oldFilename, decl)
  }
}

console.log(`   Unique images: ${uniqueDeclarations.size} (${allImageDeclarations.length - uniqueDeclarations.size} shared across chunks)`)

// Map to track renames: { oldFilename: newFilename }
const renameMap = new Map()
let renamedCount = 0

if (uniqueDeclarations.size > 0) {
  for (const decl of uniqueDeclarations.values()) {
    // Extract old filename from path (handle both relative and absolute paths)
    const oldFilename = path.basename(decl.imagePath)
    const ext = path.extname(oldFilename)

    // Check if it's a hash-based filename (SHA1 = 40 chars hex)
    const isHashFilename = /^[a-f0-9]{40}\.(png|jpg|jpeg|svg|gif|webp)$/i.test(oldFilename)

    if (!isHashFilename) {
      // Already has a descriptive name, skip
      continue
    }

    // Check if we have a semantic mapping for this variable
    const semantic = semanticMapping.get(decl.varName)

    let newBasename
    if (semantic && semantic.semanticName) {
      // Use semantic name from Figma layer
      // "Google Logo" → googleLogo
      // "image 8" → image8
      newBasename = semantic.semanticName
    } else {
      // Fallback: Convert generic variable name to kebab-case filename
      // imgFrame1008 → frame-1008
      // imgImage → image
      // imgVector → vector
      // img1 → img-1
      newBasename = decl.varName
        .replace(/^img/, '') // Remove 'img' prefix
        .replace(/([a-z])([A-Z])/g, '$1-$2') // camelCase → kebab-case
        .replace(/([a-zA-Z])(\d)/g, '$1-$2') // letter+number → letter-number
        .toLowerCase()

      // Handle edge case: if result is empty (varName was just 'img'), use 'img'
      if (!newBasename) {
        newBasename = 'img'
      }
    }

    const newFilename = newBasename + ext
    const oldPath = path.join(imgDir, oldFilename)

    // Handle naming conflicts (check before verifying oldPath existence)
    let finalNewFilename = newFilename
    let finalNewPath = path.join(imgDir, finalNewFilename)
    let counter = 2

    while (fs.existsSync(finalNewPath) && finalNewPath !== oldPath) {
      const nameWithoutExt = newBasename + `-${counter}`
      finalNewFilename = nameWithoutExt + ext
      finalNewPath = path.join(imgDir, finalNewFilename)
      counter++
    }

    // Check if old file exists
    if (!fs.existsSync(oldPath)) {
      console.warn(`   ⚠️  Image not downloaded by MCP: ${oldFilename}`)
      continue
    }

    // Rename the file
    try {
      fs.renameSync(oldPath, finalNewPath)
      renameMap.set(oldFilename, finalNewFilename)
      renamedCount++
      console.log(`   ✅ ${oldFilename} → ${finalNewFilename}`)
    } catch (error) {
      console.warn(`   ⚠️  Could not rename ${oldFilename}: ${error.message}`)
    }
  }
}

console.log(`   Renamed ${renamedCount} / ${uniqueDeclarations.size} unique images`)

// ═══════════════════════════════════════════════════════════════
// STEP 5: Convert const declarations to ES6 imports
// ═══════════════════════════════════════════════════════════════

console.log('\n🔄 Converting to ES6 imports...')

if (allImageDeclarations.length > 0) {
  // Group declarations by file
  const declsByFile = new Map()
  for (const decl of allImageDeclarations) {
    if (!declsByFile.has(decl.file)) {
      declsByFile.set(decl.file, [])
    }
    declsByFile.get(decl.file).push(decl)
  }

  // Process each file
  let totalImportsConverted = 0

  for (const [file, decls] of declsByFile.entries()) {
    let componentCode = fs.readFileSync(file, 'utf-8')

    // Remove old const declarations
    for (const decl of decls) {
      componentCode = componentCode.replace(decl.original, '')
    }

    // Clean up empty lines
    componentCode = componentCode.replace(/\n{3,}/g, '\n\n')

    // Build variable rename map: oldVarName → newVarName
    const varRenameMap = new Map()
    for (const decl of decls) {
      const semantic = semanticMapping.get(decl.varName)
      if (semantic && semantic.semanticName) {
        varRenameMap.set(decl.varName, semantic.semanticName)
      }
    }

    // Replace variable usages in JSX (src={oldName} → src={newName})
    if (varRenameMap.size > 0) {
      for (const [oldName, newName] of varRenameMap) {
        // Pattern: src={oldName} → src={newName}
        const srcPattern = new RegExp(`\\bsrc=\\{${oldName}\\}`, 'g')
        componentCode = componentCode.replace(srcPattern, `src={${newName}}`)
      }
    }

    // Generate import statements with updated paths and semantic names
    const imgRelativePath = isChunkingMode ? '../img/' : './img/'
    const importStatements = decls.map(decl => {
      const oldFilename = path.basename(decl.imagePath)
      const newFilename = renameMap.get(oldFilename) || oldFilename
      const newPath = `${imgRelativePath}${newFilename}`

      // Use semantic name if available, otherwise sanitize original varName
      const semantic = semanticMapping.get(decl.varName)
      let finalVarName

      if (semantic && semantic.semanticName) {
        // Use semantic name from Figma layer
        finalVarName = semantic.semanticName
      } else {
        // Fallback to sanitized original name
        finalVarName = sanitizeVariableName(decl.varName)
      }

      return `import ${finalVarName} from "${newPath}";`
    }).join('\n')

    // Find insertion position (after existing imports, or at the top)
    const lines = componentCode.split('\n')
    let insertPosition = 0
    let foundImports = false
    let hasImageImportsComment = false

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i].trim()

      // Check if "// Image imports" already exists
      if (line === '// Image imports') {
        hasImageImportsComment = true
      }

      // Only consider actual import statements, NOT export statements
      if (line.startsWith('import ')) {
        insertPosition = i + 1
        foundImports = true
      } else if (foundImports && line && !line.startsWith('//') && !line.startsWith('/*')) {
        // Stop after imports section
        break
      }
    }

    // Insert imports at the determined position
    if (hasImageImportsComment) {
      // Comment already exists, just add imports without duplicate comment
      lines.splice(insertPosition, 0, importStatements)
    } else {
      // No comment yet, add it with imports
      lines.splice(insertPosition, 0, '', '// Image imports', importStatements, '')
    }
    componentCode = lines.join('\n')

    // Write final code
    fs.writeFileSync(file, componentCode, 'utf-8')

    totalImportsConverted += decls.length
    console.log(`   ✅ ${path.basename(file)}: ${decls.length} ES6 imports`)
  }

  console.log(`✅ Total: ${totalImportsConverted} const declarations converted to ES6 imports`)
}

// ═══════════════════════════════════════════════════════════════
// SUMMARY
// ═══════════════════════════════════════════════════════════════

console.log('\n📊 Summary:')
console.log(`   Mode: ${isChunkingMode ? 'CHUNKING' : 'NORMAL'}`)
console.log(`   Files processed: ${filesToProcess.length}`)
console.log(`   Images moved: ${movedFiles.length}`)
console.log(`   Unique images: ${uniqueDeclarations.size}${allImageDeclarations.length > uniqueDeclarations.size ? ` (${allImageDeclarations.length - uniqueDeclarations.size} shared)` : ''}`)
console.log(`   Images renamed: ${renamedCount}`)
console.log(`   Paths updated: ${totalPathsUpdated}`)
console.log(`   Total imports: ${allImageDeclarations.length}`)
console.log(`   Location: ${imgDir}`)
console.log('\n✅ Image organization complete!')
console.log('💡 Images now use descriptive names from Figma and ES6 imports!')
console.log('📌 Next step: Run unified-processor.js to generate Component-fixed.tsx + metadata + report')

process.exit(0)
