import traverse from '@babel/traverse'
import * as t from '@babel/types'
import fs from 'fs'
import path from 'path'
import * as cheerio from 'cheerio'
import svgPathBbox from 'svg-path-bbox'

export const meta = {
  name: 'svg-consolidation',
  priority: 22 // After svg-icon-fixes (20), before post-fixes (25)
}

/**
 * Consolidates multiple SVG files referenced in absolute-positioned divs
 * into single consolidated SVG files
 */
export function execute(ast, context) {
  const stats = {
    groupsConsolidated: 0,
    svgsConsolidated: 0
  }

  const testDir = context.inputDir
  if (!testDir) {
    console.warn('[svg-consolidation] No inputDir in context, skipping')
    return stats
  }

  const imgDir = path.join(testDir, 'img')
  if (!fs.existsSync(imgDir)) {
    console.warn('[svg-consolidation] No img/ directory found')
    return stats
  }

  // Step 1: Build import map from AST
  const importMap = buildImportMap(ast)

  // Step 2: Find SVG groups
  const groups = findSVGGroups(ast, importMap)

  if (groups.length === 0) {
    return stats
  }

  console.log(`[svg-consolidation] Found ${groups.length} SVG groups to consolidate`)

  // Step 3: Consolidate each group
  for (const group of groups) {
    const consolidatedFile = consolidateGroup(group, testDir)
    if (consolidatedFile) {
      group.consolidatedFile = consolidatedFile
      stats.groupsConsolidated++
      stats.svgsConsolidated += group.svgElements.length
    }
  }

  // Step 4: Transform AST to use consolidated files
  transformAST(ast, groups)

  return stats
}

/**
 * Build import map from AST
 */
function buildImportMap(ast) {
  const importMap = new Map() // varName -> filename

  traverse.default(ast, {
    ImportDeclaration(path) {
      if (path.node.source.value.startsWith('./img/')) {
        const filename = path.node.source.value.replace('./img/', '')
        const specifier = path.node.specifiers[0]
        if (specifier && t.isImportDefaultSpecifier(specifier)) {
          const varName = specifier.local.name
          importMap.set(varName, filename)
        }
      }
    }
  })

  return importMap
}

/**
 * Find SVG groups (divs with 5+ SVG images)
 */
function findSVGGroups(ast, importMap) {
  const groups = []

  traverse.default(ast, {
    JSXElement(path) {
      const openingElement = path.node.openingElement
      if (openingElement.name.name !== 'div') return

      // Get data-name to help identify the group
      const dataNameAttr = openingElement.attributes.find(
        attr => attr.name && attr.name.name === 'data-name'
      )
      const containerDataName = dataNameAttr?.value?.value

      // Find <img> children at depth 1-2 only (not recursive through entire tree)
      const svgElements = []

      // Check direct children and find positioned containers with SVG images
      const checkNode = (node, depth, parentClassName, grandparentClassName) => {
        if (depth > 3) return

        if (!node.children) return

        for (const child of node.children) {
          if (!t.isJSXElement(child)) continue

          const childName = child.openingElement.name.name

          // Get this element's className
          const classNameAttr = child.openingElement.attributes.find(
            attr => attr.name && attr.name.name === 'className'
          )
          const currentClassName = classNameAttr && t.isStringLiteral(classNameAttr.value)
            ? classNameAttr.value.value
            : null

          if (childName === 'img') {
            const srcAttr = child.openingElement.attributes.find(
              attr => attr.name && attr.name.name === 'src'
            )

            if (srcAttr && t.isJSXExpressionContainer(srcAttr.value) && t.isIdentifier(srcAttr.value.expression)) {
              const varName = srcAttr.value.expression.name
              const filename = importMap.get(varName)

              if (filename && filename.endsWith('.svg')) {
                const imgDataNameAttr = child.openingElement.attributes.find(
                  attr => attr.name && attr.name.name === 'data-name'
                )
                const dataName = imgDataNameAttr?.value?.value || filename.replace('.svg', '')

                // Use grandparent's className if parent is just "inset-0", otherwise use parent
                const positionClass = (parentClassName && parentClassName.includes('inset-0'))
                  ? grandparentClassName
                  : parentClassName

                svgElements.push({
                  varName,
                  filename,
                  dataName,
                  cssPosition: positionClass
                })
              }
            }
          } else if (childName === 'div') {
            // Check if child div has its own data-name (might be processed separately)
            const childDataNameAttr = child.openingElement.attributes.find(
              attr => attr.name && attr.name.name === 'data-name'
            )
            const childDataName = childDataNameAttr?.value?.value

            // Skip child divs with data-name UNLESS it's a technical wrapper like "Vector"
            // Technical wrappers are part of the parent consolidation, not separate components
            const isTechnicalWrapper = childDataName === 'Vector' || childDataName === 'Group'

            if (childDataName && !isTechnicalWrapper) {
              continue
            }

            // Continue traversing, passing className hierarchy
            checkNode(child, depth + 1, currentClassName || parentClassName, parentClassName || grandparentClassName)
          }
        }
      }

      checkNode(path.node, 0, null, null)

      // Only consolidate groups with 5+ SVG elements
      if (svgElements.length >= 5) {
        const groupName = containerDataName
          ? containerDataName.replace(/\s+/g, '-').toLowerCase()
          : `group-${groups.length + 1}`

        // Extract container dimensions from className (e.g., w-[140px] h-[49.551px])
        let containerWidth = null
        let containerHeight = null
        const classNameAttr = openingElement.attributes.find(
          attr => attr.name && attr.name.name === 'className'
        )
        if (classNameAttr && t.isStringLiteral(classNameAttr.value)) {
          const className = classNameAttr.value.value
          const widthMatch = className.match(/w-\[(\d+(?:\.\d+)?)px\]/)
          const heightMatch = className.match(/h-\[(\d+(?:\.\d+)?)px\]/)
          if (widthMatch) containerWidth = parseFloat(widthMatch[1])
          if (heightMatch) containerHeight = parseFloat(heightMatch[1])
        }

        groups.push({
          groupName,
          containerPath: path,
          svgElements,
          containerWidth,
          containerHeight
        })
      }
    }
  })

  return groups
}

/**
 * Parse CSS positioning classes and calculate transform
 */
function parsePositionAndTransform(cssPosition, containerWidth, containerHeight, svgViewBox) {
  if (!cssPosition || !containerWidth || !containerHeight || !svgViewBox) {
    return null
  }

  const [vbX, vbY, vbW, vbH] = svgViewBox.split(' ').map(Number)

  // Parse inset-[top right bottom left] or individual positions
  const insetMatch = cssPosition.match(/inset-\[([^\]]+)\]/)
  let top = 0, right = 0, bottom = 0, left = 0

  if (insetMatch) {
    const values = insetMatch[1].split('_').map(v => parseFloat(v))
    ;[top, right, bottom, left] = values
  } else {
    // Parse individual left/right/top/bottom
    const leftMatch = cssPosition.match(/left-\[([^\]]+)\]/)
    const rightMatch = cssPosition.match(/right-\[([^\]]+)\]/)
    const topMatch = cssPosition.match(/top-\[([^\]]+)\]/)
    const bottomMatch = cssPosition.match(/bottom-\[([^\]]+)\]/)

    if (leftMatch) left = parseFloat(leftMatch[1])
    if (rightMatch) right = parseFloat(rightMatch[1])
    if (topMatch) top = parseFloat(topMatch[1])
    if (bottomMatch) bottom = parseFloat(bottomMatch[1])
  }

  // Calculate absolute position
  const x = (left / 100) * containerWidth
  const y = (top / 100) * containerHeight
  const elementWidth = ((100 - left - right) / 100) * containerWidth
  const elementHeight = ((100 - top - bottom) / 100) * containerHeight

  // Calculate scale
  const scaleX = elementWidth / vbW
  const scaleY = elementHeight / vbH

  return {
    x,
    y,
    scaleX,
    scaleY
  }
}

/**
 * Consolidate SVG paths from multiple files into one
 */
function consolidateGroup(group, testDir) {
  const imgDir = path.join(testDir, 'img')
  // Use valid JS identifier: group-1 → group1
  const safeGroupName = group.groupName.replace(/-/g, '')
  const consolidatedFilename = `${safeGroupName}.svg`
  const consolidatedPath = path.join(imgDir, consolidatedFilename)

  const svgGroups = []

  // Extract paths from each SVG file with transform info
  for (const svg of group.svgElements) {
    const svgPath = path.join(imgDir, svg.filename)
    if (!fs.existsSync(svgPath)) {
      console.warn(`[svg-consolidation] SVG not found: ${svg.filename}`)
      continue
    }

    const content = fs.readFileSync(svgPath, 'utf-8')
    const $ = cheerio.load(content, { xmlMode: true })
    const $svg = $('svg')

    // Extract viewBox
    const viewBox = $svg.attr('viewBox')

    // Calculate transform if position info available
    const transform = parsePositionAndTransform(
      svg.cssPosition,
      group.containerWidth,
      group.containerHeight,
      viewBox
    )

    // Extract all <path> elements for this SVG
    const paths = []
    $('path').each((_, pathEl) => {
      const d = $(pathEl).attr('d')
      if (d) {
        paths.push({
          d,
          fill: $(pathEl).attr('fill') || 'currentColor',
          stroke: $(pathEl).attr('stroke'),
          strokeWidth: $(pathEl).attr('stroke-width'),
          opacity: $(pathEl).attr('opacity')
        })
      }
    })

    if (paths.length > 0) {
      svgGroups.push({
        paths,
        transform,
        dataName: svg.dataName
      })
    }
  }

  if (svgGroups.length === 0) {
    console.warn(`[svg-consolidation] No SVG groups found for ${group.groupName}`)
    return null
  }

  // Create consolidated SVG with container dimensions
  const width = group.containerWidth || 100
  const height = group.containerHeight || 100
  const viewBox = `0 0 ${width} ${height}`

  console.log(`[svg-consolidation] Creating ${consolidatedFilename} with ${svgGroups.length} SVG groups`)

  let svgContent = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="${viewBox}" width="${width}" height="${height}">\n`

  let totalPaths = 0
  for (const svgGroup of svgGroups) {
    // Create group with transform if available
    if (svgGroup.transform) {
      const { x, y, scaleX, scaleY } = svgGroup.transform
      svgContent += `  <g transform="translate(${x.toFixed(3)}, ${y.toFixed(3)}) scale(${scaleX.toFixed(3)}, ${scaleY.toFixed(3)})">\n`
    } else {
      svgContent += `  <g>\n`
    }

    // Add all paths for this SVG
    for (const p of svgGroup.paths) {
      svgContent += `    <path d="${p.d}"`
      if (p.fill) svgContent += ` fill="${p.fill}"`
      if (p.stroke) svgContent += ` stroke="${p.stroke}"`
      if (p.strokeWidth) svgContent += ` stroke-width="${p.strokeWidth}"`
      if (p.opacity) svgContent += ` opacity="${p.opacity}"`
      svgContent += ' />\n'
      totalPaths++
    }

    svgContent += `  </g>\n`
  }

  svgContent += '</svg>'

  fs.writeFileSync(consolidatedPath, svgContent)
  console.log(`[svg-consolidation] Created ${consolidatedFilename} with ${svgGroups.length} groups (${totalPaths} paths)`)

  return consolidatedFilename
}

/**
 * Transform AST to use consolidated SVG files
 */
function transformAST(ast, groups) {
  // Step 1: Collect old imports to remove
  const varNamesToRemove = new Set()
  for (const group of groups) {
    for (const svg of group.svgElements) {
      varNamesToRemove.add(svg.varName)
    }
  }

  // Step 2: Collect existing import names to avoid collisions
  const existingImportNames = new Set()
  traverse.default(ast, {
    ImportDeclaration(path) {
      const specifier = path.node.specifiers[0]
      if (specifier && t.isImportDefaultSpecifier(specifier)) {
        existingImportNames.add(specifier.local.name)
      }
    }
  })

  // Step 3: Add new imports and remove old ones
  traverse.default(ast, {
    Program(path) {
      const imports = path.get('body').filter(p => p.isImportDeclaration())
      const lastImportIndex = imports.length > 0 ? imports[imports.length - 1].key : -1

      // Add new imports for consolidated files
      for (const group of groups) {
        if (group.consolidatedFile) {
          // Use valid JS identifier: group1 instead of group-1
          const safeGroupName = group.groupName.replace(/-/g, '')
          let baseImportVarName = `img${safeGroupName.charAt(0).toUpperCase()}${safeGroupName.slice(1)}`

          // Avoid naming collisions
          let importVarName = baseImportVarName
          let suffix = 1
          while (existingImportNames.has(importVarName)) {
            importVarName = `${baseImportVarName}${suffix}`
            suffix++
          }
          existingImportNames.add(importVarName)

          const newImport = t.importDeclaration(
            [t.importDefaultSpecifier(t.identifier(importVarName))],
            t.stringLiteral(`./img/${group.consolidatedFile}`)
          )
          if (lastImportIndex >= 0) {
            path.get(`body.${lastImportIndex}`).insertAfter(newImport)
          } else {
            path.unshiftContainer('body', newImport)
          }

          // Store for later use
          group.importVarName = importVarName
        }
      }

      // Remove old imports
      for (const importPath of imports) {
        const source = importPath.node.source.value
        if (source.startsWith('./img/')) {
          const specifier = importPath.node.specifiers[0]
          if (specifier && t.isImportDefaultSpecifier(specifier)) {
            const varName = specifier.local.name
            if (varNamesToRemove.has(varName)) {
              importPath.remove()
            }
          }
        }
      }
    }
  })

  // Step 3: Replace container children with single <img> for consolidated SVG
  for (const group of groups) {
    if (!group.consolidatedFile || !group.importVarName) continue

    const containerPath = group.containerPath

    // Create single <img> element for consolidated SVG
    const newImg = t.jsxElement(
      t.jsxOpeningElement(
        t.jsxIdentifier('img'),
        [
          t.jsxAttribute(t.jsxIdentifier('src'), t.jsxExpressionContainer(t.identifier(group.importVarName))),
          t.jsxAttribute(t.jsxIdentifier('alt'), t.stringLiteral(group.groupName)),
          t.jsxAttribute(t.jsxIdentifier('className'), t.stringLiteral('block max-w-none size-full'))
        ],
        true
      ),
      null,
      [],
      true
    )

    // Replace ALL children with single img (keep container attributes)
    containerPath.node.children = [newImg]
  }
}
