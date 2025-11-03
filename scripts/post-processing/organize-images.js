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
 *     src/generated/tests/test-123 \
 *     src/generated/tests/test-123/Component.tsx
 */

import fs from 'fs'
import path from 'path'

// ═══════════════════════════════════════════════════════════════
// CLI ARGUMENTS
// ═══════════════════════════════════════════════════════════════

const testDir = process.argv[2]
const componentFile = process.argv[3]

if (!testDir) {
  console.error('Usage: node organize-images.js <test-directory> [component-file]')
  console.error('\nExample:')
  console.error('  node scripts/organize-images.js src/generated/tests/test-123')
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

// Map to track renames: { oldFilename: newFilename }
const renameMap = new Map()
let renamedCount = 0

if (allImageDeclarations.length > 0) {
  for (const decl of allImageDeclarations) {
    // Extract old filename from path (handle both relative and absolute paths)
    const oldFilename = path.basename(decl.imagePath)
    const ext = path.extname(oldFilename)

    // Check if it's a hash-based filename (SHA1 = 40 chars hex)
    const isHashFilename = /^[a-f0-9]{40}\.(png|jpg|jpeg|svg|gif|webp)$/i.test(oldFilename)

    if (!isHashFilename) {
      // Already has a descriptive name, skip
      continue
    }

    // Convert Figma variable name to kebab-case filename
    // imgFrame1008 → frame-1008
    // imgImage → image
    // imgVector → vector
    // img1 → img-1
    let newBasename = decl.varName
      .replace(/^img/, '') // Remove 'img' prefix
      .replace(/([a-z])([A-Z])/g, '$1-$2') // camelCase → kebab-case
      .replace(/([a-zA-Z])(\d)/g, '$1-$2') // letter+number → letter-number
      .toLowerCase()

    // Handle edge case: if result is empty (varName was just 'img'), use 'img'
    if (!newBasename) {
      newBasename = 'img'
    }

    const newFilename = newBasename + ext
    const oldPath = path.join(imgDir, oldFilename)

    // Check if old file exists
    if (!fs.existsSync(oldPath)) {
      console.warn(`   ⚠️  File not found: ${oldFilename}`)
      continue
    }

    // Handle naming conflicts
    let finalNewFilename = newFilename
    let finalNewPath = path.join(imgDir, finalNewFilename)
    let counter = 2

    while (fs.existsSync(finalNewPath) && finalNewPath !== oldPath) {
      const nameWithoutExt = newBasename + `-${counter}`
      finalNewFilename = nameWithoutExt + ext
      finalNewPath = path.join(imgDir, finalNewFilename)
      counter++
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

console.log(`   Renamed ${renamedCount} / ${allImageDeclarations.length} images`)

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

    // Generate import statements with updated paths
    const imgRelativePath = isChunkingMode ? '../img/' : './img/'
    const importStatements = decls.map(decl => {
      const oldFilename = path.basename(decl.imagePath)
      const newFilename = renameMap.get(oldFilename) || oldFilename
      const newPath = `${imgRelativePath}${newFilename}`
      return `import ${decl.varName} from "${newPath}";`
    }).join('\n')

    // Find insertion position (after existing imports, or at the top)
    const lines = componentCode.split('\n')
    let insertPosition = 0
    let foundImports = false

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i].trim()
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
    lines.splice(insertPosition, 0, '', '// Image imports', importStatements, '')
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
console.log(`   Images renamed: ${renamedCount}`)
console.log(`   Paths updated: ${totalPathsUpdated}`)
console.log(`   ES6 imports: ${allImageDeclarations.length}`)
console.log(`   Location: ${imgDir}`)
console.log('\n✅ Image organization complete!')
console.log('💡 Images now use descriptive names from Figma and ES6 imports!')
console.log('📌 Next step: Run unified-processor.js to generate Component-fixed.tsx + metadata + report')

process.exit(0)
