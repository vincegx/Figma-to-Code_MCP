#!/usr/bin/env node

/**
 * ===============================================
 * CONSOLIDATION DES SVG ÉCLATÉS (FIGMA ISSUE)
 * ===============================================
 *
 * Problème:
 * Figma importe les SVG en les éclatant en multiples paths positionnés en absolu.
 * Ex: "Virgin logo" → 32 fichiers SVG (path58.svg, path59.svg...) avec absolute + inset
 *
 * Solution:
 * 1. Parse Component.tsx (AST) → Map imports et data-name
 * 2. Parse metadata.xml → Trouve les groupes SVG éclatés
 * 3. Parse /img/*.svg → Extrait les <path> de chaque fichier
 * 4. Consolide → Crée un seul SVG propre avec tous les paths
 * 5. Sauvegarde → /img/{group-name}-consolidated.svg
 * 6. Update → Crée Component-fixed.tsx avec référence au nouveau SVG
 *
 * Usage:
 *   node scripts/post-processing/consolidate-svg-groups.js <test-dir>
 *
 * Example:
 *   node scripts/post-processing/consolidate-svg-groups.js src/generated/tests/node-119-15308-1762203586
 */

import fs from 'fs'
import path from 'path'
import parser from '@babel/parser'
import traverse from '@babel/traverse'
import generate from '@babel/generator'
import * as t from '@babel/types'
import * as cheerio from 'cheerio'

// Configuration
const CONFIG = {
  componentFile: 'Component.tsx',
  metadataFile: 'metadata.xml',
  imageDir: 'img',
  outputComponent: 'Component-fixed.tsx',
  minPathsThreshold: 5 // Minimum de paths pour considérer un groupe comme "éclaté"
}

/**
 * Parse Component.tsx avec Babel AST pour créer les maps de correspondance
 */
function buildMapsFromAST(tsxContent) {
  console.log(`\n[ÉTAPE 1] Parse de ${CONFIG.componentFile} (AST Babel)...`)

  const ast = parser.parse(tsxContent, {
    sourceType: 'module',
    plugins: ['jsx', 'typescript']
  })

  const importMap = new Map() // 'imgPath58' -> 'path58.svg'
  const dataNameMap = new Map() // 'path58' -> 'imgPath58'

  // Collecte des imports SVG
  traverse.default(ast, {
    ImportDeclaration(path) {
      const source = path.node.source.value
      if (source.endsWith('.svg')) {
        const defaultSpecifier = path.node.specifiers.find(spec =>
          t.isImportDefaultSpecifier(spec)
        )
        if (defaultSpecifier) {
          const varName = defaultSpecifier.local.name
          const fileName = source.split('/').pop()
          importMap.set(varName, fileName)
        }
      }
    }
  })

  // Collecte des liens data-name -> src (SEULEMENT pour les SVG)
  // Cherche les <div data-name="pathXX"> contenant <img src={imgPathXX} />
  traverse.default(ast, {
    JSXElement(path) {
      const openingElement = path.node.openingElement
      if (!t.isJSXIdentifier(openingElement.name, { name: 'div' })) return

      // Cherche data-name sur le div
      const dataNameAttr = openingElement.attributes.find(
        attr =>
          t.isJSXAttribute(attr) &&
          t.isJSXIdentifier(attr.name, { name: 'data-name' }) &&
          t.isStringLiteral(attr.value)
      )

      if (!dataNameAttr) return

      const dataName = dataNameAttr.value.value

      // Cherche un enfant <img> avec src pointant vers un SVG
      const children = path.node.children.filter(child => t.isJSXElement(child))

      for (const child of children) {
        if (!t.isJSXIdentifier(child.openingElement.name, { name: 'img' })) continue

        const srcAttr = child.openingElement.attributes.find(
          attr =>
            t.isJSXAttribute(attr) &&
            t.isJSXIdentifier(attr.name, { name: 'src' }) &&
            t.isJSXExpressionContainer(attr.value)
        )

        if (srcAttr) {
          const srcExpression = srcAttr.value.expression
          if (t.isIdentifier(srcExpression)) {
            const varName = srcExpression.name
            // IMPORTANT: Ne mappe que si c'est un import SVG (pas PNG/JPG/etc)
            if (importMap.has(varName)) {
              const fileName = importMap.get(varName)
              if (fileName.endsWith('.svg')) {
                dataNameMap.set(dataName, varName)
                break // On a trouvé le mapping, on passe au div suivant
              }
            }
          }
        }
      }
    }
  })

  console.log(`  ✅ ${importMap.size} imports SVG trouvés`)
  console.log(`  ✅ ${dataNameMap.size} liens data-name → src trouvés`)

  return { importMap, dataNameMap, ast }
}

/**
 * Parse Component.tsx AST pour trouver les groupes SVG éclatés
 * (divs contenant plusieurs img SVG)
 */
function findGroupsFromAST(ast, importMap) {
  console.log(`\n[ÉTAPE 2] Recherche des groupes SVG éclatés dans le Component.tsx...`)

  const groups = []

  traverse.default(ast, {
    JSXElement(path) {
      const openingElement = path.node.openingElement
      if (!t.isJSXIdentifier(openingElement.name, { name: 'div' })) return

      // Cherche data-name et data-node-id
      const dataNameAttr = openingElement.attributes.find(
        attr =>
          t.isJSXAttribute(attr) &&
          t.isJSXIdentifier(attr.name, { name: 'data-name' }) &&
          t.isStringLiteral(attr.value)
      )

      const nodeIdAttr = openingElement.attributes.find(
        attr =>
          t.isJSXAttribute(attr) &&
          t.isJSXIdentifier(attr.name, { name: 'data-node-id' }) &&
          t.isStringLiteral(attr.value)
      )

      if (!dataNameAttr || !nodeIdAttr) return

      const dataName = dataNameAttr.value.value
      const nodeId = nodeIdAttr.value.value

      // Collecte tous les <img> SVG descendants (récursif)
      const svgImages = []

      function collectSVGImages(node) {
        if (!node.children) return

        for (const child of node.children) {
          if (!t.isJSXElement(child)) continue

          // Si c'est une img, vérifie si c'est un SVG
          if (t.isJSXIdentifier(child.openingElement.name, { name: 'img' })) {
            const srcAttr = child.openingElement.attributes.find(
              attr =>
                t.isJSXAttribute(attr) &&
                t.isJSXIdentifier(attr.name, { name: 'src' }) &&
                t.isJSXExpressionContainer(attr.value)
            )

            if (srcAttr && t.isIdentifier(srcAttr.value.expression)) {
              const varName = srcAttr.value.expression.name
              // Vérifie que c'est un SVG (pas PNG/JPG)
              if (importMap.has(varName)) {
                const fileName = importMap.get(varName)
                if (fileName.endsWith('.svg')) {
                  svgImages.push({ varName, fileName })
                }
              }
            }
          }

          // Continue récursivement
          collectSVGImages(child)
        }
      }

      collectSVGImages(path.node)

      // Si on a trouvé suffisamment d'images SVG, c'est un groupe éclaté
      if (svgImages.length >= CONFIG.minPathsThreshold) {
        const groupName = dataName.replace(/\s+/g, '-').toLowerCase()
        console.log(
          `  🎯 Groupe SVG éclaté trouvé: "${dataName}" (${svgImages.length} images)`
        )

        groups.push({
          originalName: dataName,
          name: groupName,
          nodeId: nodeId,
          width: null, // À récupérer du metadata.xml si besoin
          height: null,
          svgImages: svgImages // Liste des {varName, fileName}
        })
      }
    }
  })

  console.log(`  ✅ ${groups.length} groupe(s) SVG éclaté(s) trouvé(s)`)

  return groups
}

/**
 * Consolide un groupe SVG (extrait les paths et crée le fichier consolidé)
 */
function consolidateGroup(group, testDir) {
  console.log(`\n[ÉTAPE 3] Consolidation du groupe "${group.originalName}"...`)

  const imgDir = path.join(testDir, CONFIG.imageDir)
  let allPaths = []
  let viewBox = null
  let svgWidth = group.width
  let svgHeight = group.height

  // Parse chaque fichier SVG dans l'ordre
  for (const svgImage of group.svgImages) {
    const { fileName } = svgImage

    const svgFilePath = path.join(imgDir, fileName)
    if (!fs.existsSync(svgFilePath)) {
      console.warn(`  ⚠️  Fichier ${fileName} n'existe pas`)
      continue
    }

    try {
      const svgContent = fs.readFileSync(svgFilePath, 'utf-8')
      const $ = cheerio.load(svgContent, { xmlMode: true })

      // Extrait le viewBox du premier SVG si disponible
      if (!viewBox) {
        const svgEl = $('svg')
        const vb = svgEl.attr('viewBox')
        if (vb) {
          viewBox = vb
          // Parse viewBox pour extraire width/height si manquants
          const [, , vbW, vbH] = vb.split(' ').map(parseFloat)
          if (!svgWidth) svgWidth = Math.round(vbW)
          if (!svgHeight) svgHeight = Math.round(vbH)
        }
      }

      // Extrait tous les <path>
      const paths = $('path')
      paths.each((i, elem) => {
        allPaths.push($.html(elem))
      })
    } catch (error) {
      console.warn(`  ⚠️  Erreur lors de la lecture de ${fileName}:`, error.message)
    }
  }

  if (allPaths.length === 0) {
    console.log(`  ❌ Aucun path trouvé pour "${group.originalName}"`)
    return null
  }

  // Crée le SVG consolidé
  const consolidatedFileName = `${group.name}-consolidated.svg`
  const viewBoxAttr = viewBox || `0 0 ${svgWidth || 100} ${svgHeight || 100}`
  const widthAttr = svgWidth || 100
  const heightAttr = svgHeight || 100

  const svgContent = `<svg xmlns="http://www.w3.org/2000/svg" width="${widthAttr}" height="${heightAttr}" viewBox="${viewBoxAttr}" fill="none">
${allPaths.map(p => `  ${p}`).join('\n')}
</svg>`

  const outputPath = path.join(imgDir, consolidatedFileName)
  fs.writeFileSync(outputPath, svgContent, 'utf-8')

  console.log(`  ✅ ${allPaths.length} paths assemblés`)
  console.log(`  ✅ Sauvegardé: ${consolidatedFileName}`)

  return {
    fileName: consolidatedFileName,
    width: widthAttr,
    height: heightAttr,
    pathCount: allPaths.length
  }
}

/**
 * Met à jour Component.tsx pour créer Component-fixed.tsx
 */
function updateComponentTSX(
  ast,
  groups,
  consolidatedFiles,
  testDir
) {
  console.log(`\n[ÉTAPE 4] Génération de ${CONFIG.outputComponent}...`)

  // Map: nodeId → consolidated file info
  const nodeIdToConsolidated = new Map()
  groups.forEach((group, i) => {
    if (consolidatedFiles[i]) {
      nodeIdToConsolidated.set(group.nodeId, {
        ...consolidatedFiles[i],
        groupName: group.name,
        originalName: group.originalName
      })
    }
  })

  // Collecte les imports à supprimer (anciens SVG individuels)
  const importsToRemove = new Set()
  groups.forEach(group => {
    group.svgImages.forEach(svgImage => {
      importsToRemove.add(svgImage.varName)
    })
  })

  // Ajoute les nouveaux imports pour les SVG consolidés
  const newImports = []
  consolidatedFiles.forEach((file, i) => {
    if (file) {
      const group = groups[i]
      const varName = group.name
        .split('-')
        .map((word, i) => (i === 0 ? word : word[0].toUpperCase() + word.slice(1)))
        .join('')
      const importDecl = t.importDeclaration(
        [t.importDefaultSpecifier(t.identifier(varName))],
        t.stringLiteral(`./img/${file.fileName}`)
      )
      newImports.push({ varName, importDecl, group })
    }
  })

  // Supprime les anciens imports et ajoute les nouveaux
  traverse.default(ast, {
    Program(path) {
      const body = path.node.body

      // Filtre les imports à garder
      const filteredBody = body.filter(node => {
        if (t.isImportDeclaration(node)) {
          const defaultSpec = node.specifiers.find(s =>
            t.isImportDefaultSpecifier(s)
          )
          if (defaultSpec && importsToRemove.has(defaultSpec.local.name)) {
            return false
          }
        }
        return true
      })

      // Ajoute les nouveaux imports après les imports existants
      const lastImportIndex = filteredBody.findIndex(
        node => !t.isImportDeclaration(node)
      )
      const insertIndex = lastImportIndex === -1 ? 0 : lastImportIndex
      newImports.forEach(({ importDecl }, i) => {
        filteredBody.splice(insertIndex + i, 0, importDecl)
      })

      path.node.body = filteredBody
    }
  })

  // Remplace les groupes de <img> par un seul <img> vers le SVG consolidé
  traverse.default(ast, {
    JSXElement(path) {
      const openingElement = path.node.openingElement
      if (!t.isJSXIdentifier(openingElement.name, { name: 'div' })) return

      // Cherche data-node-id
      const nodeIdAttr = openingElement.attributes.find(
        attr =>
          t.isJSXAttribute(attr) &&
          t.isJSXIdentifier(attr.name, { name: 'data-node-id' }) &&
          t.isStringLiteral(attr.value)
      )

      if (!nodeIdAttr) return

      const nodeId = nodeIdAttr.value.value
      const consolidated = nodeIdToConsolidated.get(nodeId)

      if (!consolidated) return

      // Trouve le newImport correspondant
      const newImport = newImports.find(
        ni => ni.group.nodeId === nodeId
      )
      if (!newImport) return

      console.log(`  🔄 Remplacement du groupe "${consolidated.originalName}"`)

      // Crée le nouvel <img> élément
      const imgElement = t.jsxElement(
        t.jsxOpeningElement(
          t.jsxIdentifier('img'),
          [
            t.jsxAttribute(
              t.jsxIdentifier('src'),
              t.jsxExpressionContainer(t.identifier(newImport.varName))
            ),
            t.jsxAttribute(
              t.jsxIdentifier('alt'),
              t.stringLiteral(consolidated.originalName)
            ),
            t.jsxAttribute(
              t.jsxIdentifier('className'),
              t.stringLiteral(`w-[${consolidated.width}px] h-[${consolidated.height}px]`)
            ),
            t.jsxAttribute(
              t.jsxIdentifier('data-name'),
              t.stringLiteral(consolidated.originalName)
            ),
            t.jsxAttribute(
              t.jsxIdentifier('data-node-id'),
              t.stringLiteral(nodeId)
            )
          ],
          true
        ),
        null,
        [],
        true
      )

      // Remplace le div entier par le nouvel img
      path.replaceWith(imgElement)
      path.skip()
    }
  })

  // Génère le nouveau code
  const output = generate.default(ast, {
    retainLines: false,
    comments: true
  })

  const outputPath = path.join(testDir, CONFIG.outputComponent)
  fs.writeFileSync(outputPath, output.code, 'utf-8')

  console.log(`  ✅ ${CONFIG.outputComponent} créé avec succès`)
  console.log(`  ✅ ${newImports.length} groupe(s) consolidé(s)`)
}

/**
 * Main
 */
async function main() {
  const args = process.argv.slice(2)

  if (args.length === 0) {
    console.error('❌ Usage: node consolidate-svg-groups.js <test-dir>')
    console.error(
      '   Example: node consolidate-svg-groups.js src/generated/tests/node-119-15308-1762203586'
    )
    process.exit(1)
  }

  const testDir = path.resolve(args[0])

  if (!fs.existsSync(testDir)) {
    console.error(`❌ Répertoire introuvable: ${testDir}`)
    process.exit(1)
  }

  console.log(`\n${'='.repeat(60)}`)
  console.log('CONSOLIDATION DES SVG ÉCLATÉS')
  console.log(`${'='.repeat(60)}`)
  console.log(`📁 Test: ${path.basename(testDir)}`)

  try {
    // Étape 1: Parse Component.tsx
    const componentPath = path.join(testDir, CONFIG.componentFile)
    if (!fs.existsSync(componentPath)) {
      console.error(`❌ ${CONFIG.componentFile} introuvable`)
      process.exit(1)
    }
    const tsxContent = fs.readFileSync(componentPath, 'utf-8')
    const { importMap, ast } = buildMapsFromAST(tsxContent)

    // Étape 2: Trouve les groupes SVG éclatés dans l'AST
    const groups = findGroupsFromAST(ast, importMap)

    if (groups.length === 0) {
      console.log('\n✅ Aucun groupe SVG éclaté trouvé. Aucune action nécessaire.')
      process.exit(0)
    }

    // Étape 3: Consolide chaque groupe
    const consolidatedFiles = groups.map(group =>
      consolidateGroup(group, testDir)
    )

    // Étape 4: Met à jour le Component.tsx
    updateComponentTSX(
      ast,
      groups,
      consolidatedFiles,
      testDir
    )

    console.log(`\n${'='.repeat(60)}`)
    console.log('✅ CONSOLIDATION TERMINÉE AVEC SUCCÈS')
    console.log(`${'='.repeat(60)}\n`)
  } catch (error) {
    console.error('\n❌ ERREUR:', error.message)
    console.error(error.stack)
    process.exit(1)
  }
}

main()
