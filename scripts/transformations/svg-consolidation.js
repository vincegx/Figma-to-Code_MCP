import traverse from '@babel/traverse'
import * as t from '@babel/types'
import fs from 'fs'
import path from 'path'
import * as cheerio from 'cheerio'

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

      // Check direct children and grandchildren only
      const checkNode = (node, depth) => {
        if (depth > 2) return // Max 2 levels deep

        if (!node.children) return

        for (const child of node.children) {
          if (!t.isJSXElement(child)) continue

          const childName = child.openingElement.name.name

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

                svgElements.push({
                  varName,
                  filename,
                  dataName
                })
              }
            }
          } else if (childName === 'div') {
            // Continue one more level for divs
            checkNode(child, depth + 1)
          }
        }
      }

      checkNode(path.node, 0)

      // Only consolidate groups with 5+ SVG elements
      if (svgElements.length >= 5) {
        const groupName = containerDataName
          ? containerDataName.replace(/\s+/g, '-').toLowerCase()
          : `group-${groups.length + 1}`

        groups.push({
          groupName,
          containerPath: path,
          svgElements
        })
      }
    }
  })

  return groups
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

  let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity
  const paths = []

  // Extract paths from each SVG file
  for (const svg of group.svgElements) {
    const svgPath = path.join(imgDir, svg.filename)
    if (!fs.existsSync(svgPath)) {
      console.warn(`[svg-consolidation] SVG not found: ${svg.filename}`)
      continue
    }

    const content = fs.readFileSync(svgPath, 'utf-8')
    const $ = cheerio.load(content, { xmlMode: true })
    const $svg = $('svg')

    // Extract viewBox or dimensions
    const viewBox = $svg.attr('viewBox')
    let vbX = 0, vbY = 0, vbW = 0, vbH = 0
    if (viewBox) {
      [vbX, vbY, vbW, vbH] = viewBox.split(' ').map(Number)
    } else {
      vbW = parseFloat($svg.attr('width') || 0)
      vbH = parseFloat($svg.attr('height') || 0)
    }

    // Extract all <path> elements
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

    // Update bounding box
    minX = Math.min(minX, vbX)
    minY = Math.min(minY, vbY)
    maxX = Math.max(maxX, vbX + vbW)
    maxY = Math.max(maxY, vbY + vbH)
  }

  if (paths.length === 0) {
    console.warn(`[svg-consolidation] No paths found in group ${group.groupName}`)
    return null
  }

  // Create consolidated SVG
  const width = maxX - minX
  const height = maxY - minY
  const viewBox = `${minX} ${minY} ${width} ${height}`

  let svgContent = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="${viewBox}" width="${width}" height="${height}">\n`
  for (const p of paths) {
    svgContent += `  <path d="${p.d}"`
    if (p.fill) svgContent += ` fill="${p.fill}"`
    if (p.stroke) svgContent += ` stroke="${p.stroke}"`
    if (p.strokeWidth) svgContent += ` stroke-width="${p.strokeWidth}"`
    if (p.opacity) svgContent += ` opacity="${p.opacity}"`
    svgContent += ' />\n'
  }
  svgContent += '</svg>'

  fs.writeFileSync(consolidatedPath, svgContent)
  console.log(`[svg-consolidation] Created ${consolidatedFilename} with ${paths.length} paths`)

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
