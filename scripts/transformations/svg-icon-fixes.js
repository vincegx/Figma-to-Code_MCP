/**
 * SVG Icon Fixes
 *
 * Figma MCP génère des structures d'icônes SVG problématiques:
 *
 * PROBLÈME 1: Wrappers absolus sans dimensions
 * <div className="size-[32px]">
 *   <div className="absolute inset-[4.688%]">  ← `absolute` + `inset` mais PAS de w-/h-
 *     <img className="size-full" />            ← 100% de quoi? → Pas de dimensions calculées → 0×0
 *   </div>
 * </div>
 *
 * SOLUTION 1: Flatten les wrappers
 * <div className="size-[32px]">
 *   <img className="absolute inset-[4.688%]" />  ← `inset` définit la zone directement
 * </div>
 *
 * PROBLÈME 2: Logos composites (14 <img> superposés)
 * <div className="h-[70.787px] w-48">
 *   <img src="logo.svg" className="absolute bottom-0 left-0 right-[64.64%] top-0 size-full" />
 *   <img src="logo.svg" className="absolute bottom-[44.03%] left-[86.28%] ..." />
 *   <!-- ... 12 autres IMG vers le même SVG avec inset différents -->
 * </div>
 *
 * SOLUTION 2: Inline le SVG complet
 * <svg className="h-[70.787px] w-48" viewBox="0 0 200 71">
 *   <path d="..." /> <!-- Tous les paths du SVG original -->
 * </svg>
 */

import * as t from '@babel/types'
import traverse from '@babel/traverse'
import fs from 'fs'
import { join as pathJoin } from 'path'

export const meta = {
  name: 'svg-icon-fixes',
  priority: 20 // After ast-cleaning, before post-fixes
}

/**
 * Main execution function for SVG icon fixes
 */
export function execute(ast, context) {
  const stats = {
    wrappersFlattened: 0,
    compositesInlined: 0 // Désactivé - maintenant géré par consolidate-svg-groups.js
  }

  // Traverse: flatten wrappers only
  // NOTE: inlineSVGComposites est désactivé car maintenant géré par
  // scripts/post-processing/consolidate-svg-groups.js qui s'exécute AVANT unified-processor
  traverse.default(ast, {
    JSXElement(path) {
      if (flattenAbsoluteImgWrappers(path)) {
        stats.wrappersFlattened++
      }
    }
  })

  // inlineSVGComposites: DÉSACTIVÉ
  // Raison: Géré par consolidate-svg-groups.js en post-processing
  // traverse.default(ast, {
  //   JSXElement(path) {
  //     if (inlineSVGComposites(path, inputDir)) {
  //       stats.compositesInlined++
  //     }
  //   }
  // })

  return stats
}

/**
 * Flatten absolute positioned divs without explicit dimensions that contain only an img
 *
 * @param {object} path - JSX element path
 * @returns {boolean} - True if transformation was applied
 */
export function flattenAbsoluteImgWrappers(path) {
  const node = path.node

  // Must be a JSX element
  if (!t.isJSXElement(node)) return false

  // Must be a div
  const openingElement = node.openingElement
  if (!t.isJSXIdentifier(openingElement.name, { name: 'div' })) return false

  // Get className
  const divClassName = getClassNameValue(node)
  if (!divClassName) return false

  // Must have 'absolute' in className
  if (!divClassName.includes('absolute')) return false

  // Must NOT have explicit dimensions (w-, h-, size-, min-w-, max-w-, min-h-, max-h-)
  const classes = divClassName.split(/\s+/)
  const hasDimensions = classes.some(c =>
    c.startsWith('w-') ||
    c.startsWith('h-') ||
    c.startsWith('size-') ||
    c.startsWith('min-w-') ||
    c.startsWith('max-w-') ||
    c.startsWith('min-h-') ||
    c.startsWith('max-h-')
  )
  if (hasDimensions) return false

  // Must NOT have overflow-hidden or overflow-clip (these are intentional clipping containers)
  const hasOverflow = classes.some(c =>
    c === 'overflow-hidden' ||
    c === 'overflow-clip' ||
    c.startsWith('overflow-x-') ||
    c.startsWith('overflow-y-')
  )
  if (hasOverflow) return false

  // Must have exactly one JSX child element
  const children = node.children.filter(child =>
    t.isJSXElement(child) || t.isJSXExpressionContainer(child)
  )
  if (children.length !== 1) return false

  const child = children[0]
  if (!t.isJSXElement(child)) return false

  // Child must be an img
  if (!t.isJSXIdentifier(child.openingElement.name, { name: 'img' })) return false

  // ✅ Pattern matched! Apply transformation

  // Get existing img classes
  const imgClassName = getClassNameValue(child) || ''
  const imgClasses = imgClassName.split(/\s+/).filter(Boolean)

  // NOTE: Keep size-full! It's needed with inset positioning for correct dimensions
  // (Previously we removed it but that broke SVG icon sizing)

  // Combine div classes + img classes
  const newImgClasses = [...classes, ...imgClasses]
    .filter(Boolean)
    .join(' ')

  // Update img className
  setClassNameValue(child, newImgClasses)

  // Copy data-name and data-node-id from div to img
  const divDataName = getAttributeValue(node, 'data-name')
  const divNodeId = getAttributeValue(node, 'data-node-id')
  if (divDataName) {
    setAttributeValue(child, 'data-name', divDataName)
  }
  if (divNodeId) {
    setAttributeValue(child, 'data-node-id', divNodeId)
  }

  // Replace the entire div wrapper with just the img
  path.replaceWith(child)

  return true
}

/**
 * Get className attribute value from JSX element
 */
function getClassNameValue(jsxElement) {
  if (!t.isJSXElement(jsxElement)) return null

  const attr = jsxElement.openingElement.attributes.find(
    attr => t.isJSXAttribute(attr) &&
            t.isJSXIdentifier(attr.name, { name: 'className' })
  )

  if (!attr) return null

  if (t.isStringLiteral(attr.value)) {
    return attr.value.value
  }

  return null
}

/**
 * Set className attribute value on JSX element
 */
function setClassNameValue(jsxElement, value) {
  if (!t.isJSXElement(jsxElement)) return

  const attrs = jsxElement.openingElement.attributes
  const classNameAttr = attrs.find(
    attr => t.isJSXAttribute(attr) &&
            t.isJSXIdentifier(attr.name, { name: 'className' })
  )

  if (classNameAttr) {
    classNameAttr.value = t.stringLiteral(value)
  } else {
    attrs.push(
      t.jsxAttribute(
        t.jsxIdentifier('className'),
        t.stringLiteral(value)
      )
    )
  }
}

/**
 * Get any attribute value from JSX element
 */
function getAttributeValue(jsxElement, attrName) {
  if (!t.isJSXElement(jsxElement)) return null

  const attr = jsxElement.openingElement.attributes.find(
    attr => t.isJSXAttribute(attr) &&
            t.isJSXIdentifier(attr.name, { name: attrName })
  )

  if (!attr) return null

  if (t.isStringLiteral(attr.value)) {
    return attr.value.value
  }

  return null
}

/**
 * Set any attribute value on JSX element
 */
function setAttributeValue(jsxElement, attrName, value) {
  if (!t.isJSXElement(jsxElement)) return

  const attrs = jsxElement.openingElement.attributes
  const attr = attrs.find(
    attr => t.isJSXAttribute(attr) &&
            t.isJSXIdentifier(attr.name, { name: attrName })
  )

  if (attr) {
    attr.value = t.stringLiteral(value)
  } else {
    attrs.push(
      t.jsxAttribute(
        t.jsxIdentifier(attrName),
        t.stringLiteral(value)
      )
    )
  }
}

/**
 * Inline SVG composites - Replace multiple positioned <img> with a single <svg>
 *
 * Détecte les logos composites (3+ images SVG avec absolute + inset positioning)
 * et les remplace par un seul SVG inline avec tous les paths
 *
 * @param {object} path - JSX element path
 * @param {string} inputDir - Directory containing component (to resolve SVG paths)
 * @returns {boolean} - True if transformation was applied
 */
export function inlineSVGComposites(path, inputDir) {
  const node = path.node

  if (!t.isJSXElement(node)) return false
  if (!t.isJSXIdentifier(node.openingElement.name, { name: 'div' })) return false

  // Get all positioned children (track both wrapper and positioning info)
  const imgChildren = []
  for (const child of node.children) {
    if (!t.isJSXElement(child)) continue

    // Case 1: Direct <img> child with absolute positioning
    if (t.isJSXIdentifier(child.openingElement.name, { name: 'img' })) {
      const srcAttr = child.openingElement.attributes.find(
        attr => t.isJSXAttribute(attr) && t.isJSXIdentifier(attr.name, { name: 'src' })
      )
      if (srcAttr && t.isJSXExpressionContainer(srcAttr.value)) {
        const imgClassName = getClassNameValue(child) || ''
        if (imgClassName.includes('absolute')) {
          imgChildren.push({ img: child, wrapperClasses: imgClassName })
        }
      }
    }

    // Case 2: <div> wrapper with absolute positioning containing <img>
    if (t.isJSXIdentifier(child.openingElement.name, { name: 'div' })) {
      const divChildren = child.children.filter(c => t.isJSXElement(c))
      if (divChildren.length === 1 && t.isJSXIdentifier(divChildren[0].openingElement.name, { name: 'img' })) {
        const img = divChildren[0]
        const srcAttr = img.openingElement.attributes.find(
          attr => t.isJSXAttribute(attr) && t.isJSXIdentifier(attr.name, { name: 'src' })
        )
        if (srcAttr && t.isJSXExpressionContainer(srcAttr.value)) {
          const divClassName = getClassNameValue(child) || ''
          if (divClassName.includes('absolute')) {
            imgChildren.push({ img: img, wrapperClasses: divClassName })
          }
        }
      }
    }
  }

  // Debug: log detection
  const containerName = getAttributeValue(node, 'data-name')
  if (containerName === 'logo' || containerName === 'Logo') {
    console.log(`   🔍 Logo container detected: ${imgChildren.length} absolute img children found`)
  }

  // Must have 3+ SVG images to be a composite logo
  if (imgChildren.length < 3) {
    // Debug: Log when we have a logo container but not enough images
    const containerName = getAttributeValue(node, 'data-name')
    if (containerName === 'logo' || containerName === 'Logo') {
      console.log(`   ⚠️  Logo container "${containerName}" found with only ${imgChildren.length} images (need 3+)`)
    }
    return false
  }

  // Check all images have absolute + inset positioning (check wrapper classes)
  let allAbsolute = true
  for (let i = 0; i < imgChildren.length; i++) {
    const { wrapperClasses } = imgChildren[i]
    if (!wrapperClasses) {
      if (containerName === 'logo') console.log(`   ⚠️  Logo img ${i+1}: No wrapper classes`)
      allAbsolute = false
      break
    }

    const classes = wrapperClasses.split(/\s+/)
    const hasAbsolute = classes.includes('absolute')
    // Accept any top-/bottom-/left-/right-/inset- value (arbitrary or standard)
    const hasInset = classes.some(c =>
      c.startsWith('top-') || c.startsWith('bottom-') ||
      c.startsWith('left-') || c.startsWith('right-') || c.startsWith('inset-')
    )

    if (!(hasAbsolute && hasInset)) {
      if (containerName === 'logo') {
        console.log(`   ⚠️  Logo img ${i+1}: absolute=${hasAbsolute}, inset=${hasInset}`)
        console.log(`        Classes: ${wrapperClasses}`)
      }
      allAbsolute = false
      break
    }
  }

  if (!allAbsolute) {
    if (containerName === 'logo' || containerName === 'Logo') {
      console.log(`   ⚠️  Logo: Not all ${imgChildren.length} images have absolute+inset positioning`)
    }
    return false
  }

  // ✅ Pattern matched! This is a composite SVG logo
  console.log(`   ✅ Logo composite detected: ${imgChildren.length} images`)

  // Get container dimensions
  const containerClassName = getClassNameValue(node) || ''
  const containerClasses = containerClassName.split(/\s+/)

  const width = containerClasses.find(c => c.startsWith('w-'))
  const height = containerClasses.find(c => c.startsWith('h-'))

  if (!width || !height) {
    console.log(`   ⚠️  Logo: No dimensions found in container`)
    return false
  }

  // Get data attributes
  const dataName = getAttributeValue(node, 'data-name') || 'logo'
  const dataNodeId = getAttributeValue(node, 'data-node-id')

  // Collect all SVG paths from source files
  const allPaths = []
  let svgViewBox = null
  let svgWidth = null
  let svgHeight = null

  for (let i = 0; i < imgChildren.length; i++) {
    const { img } = imgChildren[i]

    // Get src attribute
    const srcAttr = img.openingElement.attributes.find(
      attr => t.isJSXAttribute(attr) && t.isJSXIdentifier(attr.name, { name: 'src' })
    )

    if (!srcAttr || !t.isJSXExpressionContainer(srcAttr.value)) {
      console.log(`   🐛 IMG ${i+1}: No src attr or not expression container`)
      continue
    }

    const srcIdentifier = srcAttr.value.expression
    if (!t.isIdentifier(srcIdentifier)) {
      console.log(`   🐛 IMG ${i+1}: src is not identifier`)
      continue
    }

    console.log(`   🐛 IMG ${i+1}: Looking for import of "${srcIdentifier.name}"`)

    // Find import path
    const importPath = findImportPathInProgram(path, srcIdentifier.name)
    if (!importPath) {
      console.log(`   🐛 IMG ${i+1}: Import path not found for "${srcIdentifier.name}"`)
      continue
    }

    console.log(`   🐛 IMG ${i+1}: Import path: ${importPath}`)

    // Read SVG file
    const svgFilePath = pathJoin(inputDir, importPath)
    if (!fs.existsSync(svgFilePath)) {
      console.log(`   ⚠️  SVG not found: ${svgFilePath}`)
      continue
    }

    try {
      const svgContent = fs.readFileSync(svgFilePath, 'utf8')

      // Extract viewBox, width, height (from first SVG only)
      if (!svgViewBox) {
        const viewBoxMatch = svgContent.match(/viewBox="([^"]+)"/)
        if (viewBoxMatch) svgViewBox = viewBoxMatch[1]

        const widthMatch = svgContent.match(/width="([^"]+)"/)
        if (widthMatch) svgWidth = widthMatch[1]

        const heightMatch = svgContent.match(/height="([^"]+)"/)
        if (heightMatch) svgHeight = heightMatch[1]
      }

      // Extract all paths (handle both <path.../> and <path...></path>)
      const pathRegex = /<path[^>]*\/>/g
      let match
      while ((match = pathRegex.exec(svgContent)) !== null) {
        allPaths.push(match[0])
      }
    } catch (error) {
      console.log(`   ⚠️  Error reading ${svgFilePath}: ${error.message}`)
    }
  }

  if (allPaths.length === 0) {
    console.log(`   ⚠️  No paths found in SVG sources`)
    return false
  }

  console.log(`   📦 Collected ${allPaths.length} paths from ${imgChildren.length} SVG files`)

  // Create merged SVG file
  const svgFileName = `${dataName}.svg`
  const svgFilePath = pathJoin(inputDir, svgFileName)

  const mergedSVG = `<svg xmlns="http://www.w3.org/2000/svg"${svgWidth ? ` width="${svgWidth}"` : ''}${svgHeight ? ` height="${svgHeight}"` : ''}${svgViewBox ? ` viewBox="${svgViewBox}"` : ''} fill="none">
  ${allPaths.join('\n  ')}
</svg>`

  fs.writeFileSync(svgFilePath, mergedSVG, 'utf8')
  console.log(`   ✅ Created merged SVG: ${svgFileName}`)

  // Create <img> element to replace the composite
  const imgAttrs = [
    t.jsxAttribute(t.jsxIdentifier('src'), t.jsxExpressionContainer(
      t.identifier(dataName + 'Svg')
    )),
    t.jsxAttribute(t.jsxIdentifier('alt'), t.stringLiteral(dataName)),
    t.jsxAttribute(t.jsxIdentifier('className'), t.stringLiteral(`${width} ${height}`))
  ]

  if (dataNodeId) {
    imgAttrs.push(t.jsxAttribute(t.jsxIdentifier('data-node-id'), t.stringLiteral(dataNodeId)))
  }

  const imgElement = t.jsxElement(
    t.jsxOpeningElement(t.jsxIdentifier('img'), imgAttrs, true),
    null,
    [],
    true
  )

  // Add import for the SVG at the top of the file
  let programPath = path
  while (programPath && !t.isProgram(programPath.node)) {
    programPath = programPath.parentPath
  }

  if (programPath) {
    const importDecl = t.importDeclaration(
      [t.importDefaultSpecifier(t.identifier(dataName + 'Svg'))],
      t.stringLiteral(`./${svgFileName}`)
    )
    programPath.node.body.unshift(importDecl)
  }

  // Replace the entire composite div with the simple img
  path.replaceWith(imgElement)

  return true
}

/**
 * Find import path for an identifier in the program scope
 */
function findImportPathInProgram(astPath, importName) {
  let programPath = astPath
  while (programPath && !t.isProgram(programPath.node)) {
    programPath = programPath.parentPath
  }

  if (!programPath) return null

  const importDecl = programPath.node.body.find(node => {
    if (!t.isImportDeclaration(node)) return false
    return node.specifiers.some(spec =>
      t.isImportDefaultSpecifier(spec) && spec.local.name === importName
    )
  })

  return importDecl ? importDecl.source.value : null
}
