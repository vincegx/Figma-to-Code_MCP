/**
 * Script de conversion automatique : Tailwind hardcodé → CSS Variables
 *
 * Convertit toutes les classes Tailwind avec couleurs hardcodées en variables CSS du thème
 */

import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

// Mapping des classes Tailwind vers les variables CSS
const COLOR_MAPPINGS = {
  // Backgrounds
  'bg-white': 'var(--bg-card)',
  'bg-gray-50': 'var(--bg-secondary)',
  'bg-gray-100': 'var(--bg-hover)',
  'bg-gray-200': 'var(--bg-hover)',
  'bg-purple-50': 'var(--bg-secondary)',
  'bg-purple-100': 'var(--accent-secondary)',
  'bg-purple-600': 'var(--accent-primary)',
  'bg-blue-50': 'var(--status-info-bg)',
  'bg-blue-100': 'var(--status-info-bg)',
  'bg-green-50': 'var(--status-success-bg)',
  'bg-green-100': 'var(--status-success-bg)',
  'bg-green-500': 'var(--status-success-text)',
  'bg-red-50': 'var(--status-error-bg)',
  'bg-red-500': 'var(--status-error-text)',
  'bg-amber-50': 'var(--status-warning-bg)',

  // Text colors
  'text-white': 'var(--text-inverse)',
  'text-gray-400': 'var(--text-muted)',
  'text-gray-500': 'var(--text-muted)',
  'text-gray-600': 'var(--text-secondary)',
  'text-gray-700': 'var(--text-primary)',
  'text-gray-800': 'var(--text-primary)',
  'text-gray-900': 'var(--text-primary)',
  'text-purple-100': 'var(--text-inverse)',
  'text-purple-200': 'var(--text-inverse)',
  'text-purple-600': 'var(--accent-primary)',
  'text-purple-800': 'var(--accent-primary)',
  'text-blue-600': 'var(--status-info-text)',
  'text-blue-800': 'var(--status-info-text)',
  'text-blue-900': 'var(--status-info-text)',
  'text-green-800': 'var(--status-success-text)',
  'text-green-900': 'var(--status-success-text)',
  'text-red-600': 'var(--status-error-text)',
  'text-amber-600': 'var(--status-warning-text)',

  // Borders
  'border-white': 'var(--border-light)',
  'border-gray-200': 'var(--border-subtle)',
  'border-gray-300': 'var(--border-secondary)',
  'border-slate-200': 'var(--border-subtle)',
  'border-slate-300': 'var(--border-subtle)',
  'border-purple-300': 'var(--accent-primary)',
  'border-purple-400': 'var(--accent-primary)',
  'border-purple-600': 'var(--accent-primary)',
  'border-blue-200': 'var(--status-info-border)',
  'border-green-400': 'var(--status-success-border)',
  'border-red-400': 'var(--status-error-border)',
}

// Patterns pour hover states
const HOVER_MAPPINGS = {
  'hover:bg-white': 'var(--bg-card)',
  'hover:bg-gray-100': 'var(--bg-hover)',
  'hover:bg-gray-50': 'var(--bg-secondary)',
  'hover:bg-blue-50': 'var(--status-info-bg)',
  'hover:bg-red-500': 'var(--status-error-text)',
  'hover:bg-red-50': 'var(--status-error-bg)',

  'hover:text-gray-700': 'var(--text-primary)',
  'hover:text-gray-900': 'var(--text-primary)',
  'hover:text-purple-600': 'var(--accent-primary)',
  'hover:text-blue-600': 'var(--status-info-text)',
  'hover:text-red-600': 'var(--status-error-text)',

  'hover:border-gray-300': 'var(--border-secondary)',
  'hover:border-purple-300': 'var(--accent-primary)',
  'hover:border-purple-400': 'var(--accent-primary)',
}

// Gradients courants
const GRADIENT_PATTERNS = [
  {
    pattern: /bg-gradient-to-r from-purple-600 to-blue-600/g,
    replacement: 'style={{ background: "var(--button-primary-bg)" }}'
  },
  {
    pattern: /bg-gradient-to-r from-purple-700 to-blue-700/g,
    replacement: 'style={{ background: "var(--button-primary-hover)" }}'
  },
  {
    pattern: /from-purple-600 hover:from-purple-700/g,
    replacement: ''
  }
]

/**
 * Convertit une classe Tailwind en style inline
 */
function convertClass ToStyle(className, value) {
  const styleMap = {
    'bg-': 'backgroundColor',
    'text-': 'color',
    'border-': 'borderColor'
  }

  for (const [prefix, cssProp] of Object.entries(styleMap)) {
    if (className.startsWith(prefix)) {
      return `${cssProp}: '${value}'`
    }
  }

  return null
}

/**
 * Convertit un fichier
 */
function convertFile(filePath) {
  console.log(`\n🔄 Conversion de ${path.basename(filePath)}...`)

  let content = fs.readFileSync(filePath, 'utf-8')
  let replacements = 0

  // 1. Convertir les classes simples
  for (const [tailwindClass, cssVar] of Object.entries(COLOR_MAPPINGS)) {
    const styleType = convertClassToStyle(tailwindClass, cssVar)
    if (!styleType) continue

    // Pattern: className="... tailwind-class ..."
    const pattern1 = new RegExp(`className="([^"]*\\s)?${tailwindClass}(\\s[^"]*)?\"`, 'g')
    const matches1 = content.match(pattern1) || []

    // Pattern: className={`... tailwind-class ...`}
    const pattern2 = new RegExp(`className={\`([^\`]*\\s)?${tailwindClass}(\\s[^\`]*)?\`}`, 'g')
    const matches2 = content.match(pattern2) || []

    if (matches1.length > 0 || matches2.length > 0) {
      console.log(`  ✓ Remplacé ${matches1.length + matches2.length}x : ${tailwindClass} → ${cssVar}`)
      replacements += matches1.length + matches2.length
    }

    // Remplacer par style inline
    // Note: Ceci est simplifié - en réalité il faut merger avec les styles existants
    content = content.replace(pattern1, (match, before, after) => {
      const otherClasses = (before || '') + (after || '')
      if (match.includes('style={{')) {
        // Déjà un style inline, ajouter à celui-ci
        return match.replace('style={{', `style={{ ${styleType}, `)
      } else {
        // Créer un nouveau style inline
        return `className="${otherClasses.trim()}" style={{ ${styleType} }}`
      }
    })
  }

  // 2. Convertir les gradients
  for (const { pattern, replacement } of GRADIENT_PATTERNS) {
    const matches = content.match(pattern) || []
    if (matches.length > 0) {
      console.log(`  ✓ Remplacé ${matches.length}x gradients`)
      replacements += matches.length
      content = content.replace(pattern, replacement)
    }
  }

  // 3. Sauvegarder
  fs.writeFileSync(filePath, content, 'utf-8')

  console.log(`✅ ${replacements} remplacements effectués`)
  return replacements
}

/**
 * Main
 */
function main() {
  console.log('🎨 Conversion Tailwind → CSS Variables\n')
  console.log('📋 Fichiers à convertir:')

  const files = [
    path.join(__dirname, '../src/components/HomePage.tsx'),
    path.join(__dirname, '../src/components/TestDetail.tsx')
  ]

  let totalReplacements = 0

  for (const file of files) {
    if (fs.existsSync(file)) {
      console.log(`  - ${path.basename(file)}`)
      const count = convertFile(file)
      totalReplacements += count
    } else {
      console.log(`  ⚠️  ${path.basename(file)} n'existe pas`)
    }
  }

  console.log(`\n✅ Conversion terminée! ${totalReplacements} remplacements au total`)
  console.log('\n💡 Vérifiez les fichiers et testez l\'application')
  console.log('   Certains ajustements manuels peuvent être nécessaires')
}

main()
