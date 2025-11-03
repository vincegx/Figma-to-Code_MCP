#!/usr/bin/env node
/**
 * Generate Interactive HTML Report
 *
 * Creates a beautiful, interactive HTML report with:
 * - Copyable color swatches
 * - Copyable spacing/typography values
 * - Component tree visualization
 * - Processing metrics details
 * - Before/After quality comparison
 * - Performance warnings
 *
 * Usage:
 *   node scripts/generate-report.js <test-directory> <processing-stats>
 *
 * Example:
 *   node scripts/generate-report.js \
 *     src/generated/tests/test-123 \
 *     '{"classesOptimized":105,"gradientsFixed":3}'
 */

import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

// ═══════════════════════════════════════════════════════════════
// CLI ARGUMENTS
// ═══════════════════════════════════════════════════════════════

const testDir = process.argv[2]
const processingStatsJSON = process.argv[3] || '{}'

if (!testDir) {
  console.error('Usage: node generate-report.js <test-directory> [processing-stats-json]')
  process.exit(1)
}

console.log('📊 Generating interactive HTML report...')
console.log(`   Test directory: ${testDir}`)

// ═══════════════════════════════════════════════════════════════
// LOAD DATA
// ═══════════════════════════════════════════════════════════════

const testId = path.basename(testDir)

// Load files
let componentCode = ''
let variablesData = {}
let metadataXml = ''
let metadataJson = {}
let processingStats = {}

try {
  componentCode = fs.readFileSync(path.join(testDir, 'Component-fixed.tsx'), 'utf-8')
} catch (e) {
  console.warn('⚠️  Component-fixed.tsx not found')
}

try {
  variablesData = JSON.parse(fs.readFileSync(path.join(testDir, 'variables.json'), 'utf-8'))
} catch (e) {
  console.warn('⚠️  variables.json not found')
}

try {
  metadataXml = fs.readFileSync(path.join(testDir, 'metadata.xml'), 'utf-8')
} catch (e) {
  console.warn('⚠️  metadata.xml not found')
}

try {
  metadataJson = JSON.parse(fs.readFileSync(path.join(testDir, 'metadata.json'), 'utf-8'))
} catch (e) {
  console.warn('⚠️  metadata.json not found')
}

try {
  processingStats = JSON.parse(processingStatsJSON)
} catch (e) {
  console.warn('⚠️  Invalid processing stats JSON')
}

// ═══════════════════════════════════════════════════════════════
// ANALYZE CODE
// ═══════════════════════════════════════════════════════════════

console.log('🔍 Analyzing code...')

// Extract colors from code
const colorRegex = /#[0-9a-fA-F]{6}/g
const colorsFound = [...new Set((componentCode.match(colorRegex) || []).map(c => c.toLowerCase()))]

// Extract Tailwind classes
const classNameRegex = /className="([^"]+)"/g
const allClasses = []
let match
while ((match = classNameRegex.exec(componentCode)) !== null) {
  allClasses.push(...match[1].split(/\s+/))
}

const uniqueClasses = [...new Set(allClasses)]

// Count class types
const gapClasses = uniqueClasses.filter(c => c.startsWith('gap-'))
const paddingClasses = uniqueClasses.filter(c => c.match(/^p[xytblr]?-/))
const marginClasses = uniqueClasses.filter(c => c.match(/^m[xytblr]?-/))
const textClasses = uniqueClasses.filter(c => c.startsWith('text-'))
const fontClasses = uniqueClasses.filter(c => c.startsWith('font-'))
const bgClasses = uniqueClasses.filter(c => c.startsWith('bg-'))
const roundedClasses = uniqueClasses.filter(c => c.startsWith('rounded'))

// Count arbitrary values
const arbitraryClasses = uniqueClasses.filter(c => c.includes('[') && c.includes(']'))

// Count assets from metadata.json (which contains the list of all images)
let imageFiles = []
let totalImageSize = 0
const imageFilesWithSize = [] // Array of {name, size, type}

if (metadataJson.files && metadataJson.files.images) {
  // Filter only actual image files from metadata.json
  imageFiles = metadataJson.files.images.filter(f =>
    /\.(png|jpg|jpeg|svg|gif|webp)$/i.test(f)
  )

  // Calculate total size and collect individual file sizes
  const imgDir = path.join(testDir, 'img')
  if (fs.existsSync(imgDir)) {
    imageFiles.forEach(file => {
      // Remove 'img/' prefix if present (metadata.json stores paths as "img/filename")
      const filename = file.startsWith('img/') ? file.substring(4) : file
      const filePath = path.join(imgDir, filename)

      if (fs.existsSync(filePath)) {
        const stats = fs.statSync(filePath)
        totalImageSize += stats.size

        // Get file extension
        const ext = filename.split('.').pop().toLowerCase()

        imageFilesWithSize.push({
          name: filename,  // Store without img/ prefix for display
          size: stats.size,
          type: ext
        })
      }
    })
  }
}

// Parse metadata.xml for component tree
let componentTree = ''
if (metadataXml) {
  componentTree = parseComponentTree(metadataXml)
}

// ═══════════════════════════════════════════════════════════════
// EXTRACT DESIGN TOKENS
// ═══════════════════════════════════════════════════════════════

const designTokens = extractDesignTokens(variablesData, metadataJson)

// ═══════════════════════════════════════════════════════════════
// COMBINE ALL COLORS (from code + design tokens)
// ═══════════════════════════════════════════════════════════════

const allColors = [
  ...colorsFound,  // Colors found in TSX code
  ...Object.values(designTokens.colors)  // Colors from design tokens
]
const uniqueColors = [...new Set(allColors.map(c => c.toLowerCase()))]

// ═══════════════════════════════════════════════════════════════
// GENERATE HTML REPORT
// ═══════════════════════════════════════════════════════════════

console.log('📝 Generating HTML...')

const htmlContent = generateHTML({
  testId,
  testDir,
  figmaUrl: metadataJson.figmaUrl || '#',
  timestamp: new Date().toISOString(),

  // Design tokens
  colors: uniqueColors,
  designTokens,

  // Tailwind analysis
  totalClasses: uniqueClasses.length,
  gapClasses,
  paddingClasses,
  marginClasses,
  textClasses,
  fontClasses,
  bgClasses,
  roundedClasses,
  arbitraryClasses,

  // Assets
  imageFiles,
  imageFilesWithSize,
  totalImageSize,

  // Processing
  processingStats,

  // Metadata
  dimensions: metadataJson.dimensions,
  nodeName: metadataJson.nodeName,

  // Component tree
  componentTree
})

// Write HTML file
const outputPath = path.join(testDir, 'report.html')
fs.writeFileSync(outputPath, htmlContent, 'utf-8')

console.log(`✅ Report generated: ${outputPath}`)
console.log(`   Open in browser: file://${outputPath}`)

// ═══════════════════════════════════════════════════════════════
// HELPER FUNCTIONS
// ═══════════════════════════════════════════════════════════════

function extractDesignTokens(variables, metadata) {
  const tokens = {
    colors: {},
    typography: {},
    spacing: {},
    borderRadius: {}
  }

  // From variables.json
  for (const [key, value] of Object.entries(variables)) {
    if (key.includes('Colors/') || key.includes('colors/')) {
      const colorName = key.split('/')[1] || key
      if (value.startsWith('#')) {
        tokens.colors[colorName] = value
      }
    }

    if (key.includes('Margin/') || key.includes('margin/')) {
      const spaceName = key.split('/')[1] || key
      tokens.spacing[spaceName] = value + 'px'
    }

    if (key.includes('Font/')) {
      const fontKey = key.split('/')[1] || key
      // If value is just a number, add px
      if (/^\d+$/.test(value)) {
        tokens.typography[fontKey] = { size: value + 'px', weight: 400 }
      } else {
        tokens.typography[fontKey] = value
      }
    }

    // Also capture font definitions that don't have "Font/" prefix
    if (value && typeof value === 'string' && value.startsWith('Font(')) {
      // Parse Font(family: "Poppins", style: Regular, size: 16, weight: 400, lineHeight: 1.5)
      const sizeMatch = value.match(/size:\s*(\d+)/)
      const weightMatch = value.match(/weight:\s*(\d+)/)
      if (sizeMatch) {
        tokens.typography[key] = {
          size: sizeMatch[1] + 'px',
          weight: weightMatch ? weightMatch[1] : 400
        }
      }
    }
  }

  // From metadata.json design tokens
  if (metadata.designTokens) {
    Object.assign(tokens.colors, metadata.designTokens.colors || {})
    Object.assign(tokens.spacing, metadata.designTokens.spacing || {})
    Object.assign(tokens.typography, metadata.designTokens.fonts || {})
    Object.assign(tokens.borderRadius, metadata.designTokens.corners || {})
  }

  return tokens
}

function parseComponentTree(xml) {
  // Simple XML parsing to create tree structure
  const lines = xml.split('\n').filter(l => l.trim())
  let tree = '<ul class="component-tree">'
  let indent = 0

  lines.forEach(line => {
    const newIndent = (line.match(/^\s*/)[0].length / 2)

    if (newIndent > indent) {
      tree += '<ul>'
    } else if (newIndent < indent) {
      tree += '</ul>'.repeat(indent - newIndent)
    }

    indent = newIndent

    const match = line.match(/<(\w+)\s+.*?name="([^"]+)".*?(?:width="([^"]+)")?.*?(?:height="([^"]+)")?/)
    if (match) {
      const [, tag, name, width, height] = match
      const icon = getIconForTag(tag)
      const sizeInfo = width && height ? ` <span class="size-badge">${width}×${height}</span>` : ''
      tree += `<li>${icon} <strong>${name}</strong>${sizeInfo}</li>`
    }
  })

  tree += '</ul>'
  return tree
}

function getIconForTag(tag) {
  const icons = {
    'frame': '📦',
    'instance': '🔗',
    'rectangle': '▭',
    'ellipse': '⭕',
    'text': '📝',
    'line': '━',
    'polygon': '⬟'
  }
  return icons[tag.toLowerCase()] || '•'
}

function formatBytes(bytes) {
  if (bytes === 0) return '0 B'
  const k = 1024
  const sizes = ['B', 'KB', 'MB', 'GB']
  const i = Math.floor(Math.log(bytes) / Math.log(k))
  return Math.round(bytes / Math.pow(k, i) * 100) / 100 + ' ' + sizes[i]
}

/**
 * Calculate contrast color (white or black) based on background luminance
 * Uses WCAG formula for relative luminance
 */
function getContrastColor(hexColor) {
  // Remove # if present
  const hex = hexColor.replace('#', '')

  // Convert to RGB
  const r = parseInt(hex.substr(0, 2), 16) / 255
  const g = parseInt(hex.substr(2, 2), 16) / 255
  const b = parseInt(hex.substr(4, 2), 16) / 255

  // Calculate relative luminance (WCAG formula)
  const luminance = 0.2126 * (r <= 0.03928 ? r / 12.92 : Math.pow((r + 0.055) / 1.055, 2.4)) +
                    0.7152 * (g <= 0.03928 ? g / 12.92 : Math.pow((g + 0.055) / 1.055, 2.4)) +
                    0.0722 * (b <= 0.03928 ? b / 12.92 : Math.pow((b + 0.055) / 1.055, 2.4))

  // Return white for dark backgrounds, black for light backgrounds
  return luminance > 0.5 ? '#000000' : '#ffffff'
}

function generateHTML(data) {
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Design System Report - ${data.testId}</title>
  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
  <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap" rel="stylesheet">
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }

    :root {
      --primary: #6366f1;
      --primary-dark: #4f46e5;
      --bg-page: #fafafa;
      --bg-card: #ffffff;
      --border: #e5e7eb;
      --text-primary: #111827;
      --text-secondary: #6b7280;
      --shadow-sm: 0 1px 2px 0 rgb(0 0 0 / 0.05);
      --shadow-md: 0 4px 6px -1px rgb(0 0 0 / 0.1);
    }

    body {
      font-family: 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
      background: var(--bg-page);
      color: var(--text-primary);
      line-height: 1.6;
      display: flex;
      min-height: 100vh;
    }

    /* Navigation Sidebar */
    .sidebar {
      width: 240px;
      background: var(--bg-card);
      border-right: 1px solid var(--border);
      padding: 24px 16px;
      position: sticky;
      top: 0;
      height: 100vh;
      overflow-y: auto;
      flex-shrink: 0;
    }

    .nav-title {
      font-size: 11px;
      font-weight: 600;
      text-transform: uppercase;
      letter-spacing: 0.05em;
      color: var(--text-secondary);
      margin-bottom: 12px;
    }

    .nav-list {
      list-style: none;
      margin-bottom: 24px;
    }

    .nav-link {
      display: flex;
      align-items: center;
      gap: 8px;
      padding: 8px 12px;
      color: var(--text-secondary);
      text-decoration: none;
      border-radius: 6px;
      font-size: 14px;
      transition: all 0.15s;
      cursor: pointer;
    }

    .nav-link:hover {
      background: #f3f4f6;
      color: var(--text-primary);
    }

    .nav-link.active {
      background: #eef2ff;
      color: var(--primary);
      font-weight: 500;
    }

    /* Main Content */
    .main-content {
      flex: 1;
      padding: 48px 64px;
      max-width: 1400px;
      margin: 0 auto;
    }

    .section {
      margin-bottom: 80px;
      scroll-margin-top: 24px;
    }

    .section-header {
      margin-bottom: 32px;
      padding-bottom: 16px;
      border-bottom: 1px solid var(--border);
    }

    .section-title {
      font-size: 28px;
      font-weight: 700;
      color: var(--text-primary);
      margin-bottom: 8px;
      letter-spacing: -0.02em;
    }

    .section-description {
      font-size: 15px;
      color: var(--text-secondary);
    }

    h2 {
      font-size: 18px;
      font-weight: 600;
      margin-bottom: 24px;
      margin-top: 48px;
      padding-top: 24px;
      color: var(--text-primary);
      border-top: 1px solid var(--border);
    }

    h2:first-of-type {
      margin-top: 32px;
      padding-top: 0;
      border-top: none;
    }

    h3 {
      font-size: 16px;
      font-weight: 600;
      margin-bottom: 16px;
      margin-top: 32px;
      color: var(--text-primary);
    }

    /* Stats Grid */
    .stats-grid {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(180px, 1fr));
      gap: 20px;
      margin-bottom: 32px;
    }

    .stat-card {
      background: var(--bg-card);
      border: 1px solid var(--border);
      border-radius: 12px;
      padding: 20px;
      transition: all 0.2s;
    }

    .stat-card:hover {
      box-shadow: var(--shadow-md);
      border-color: var(--primary);
    }

    .stat-value {
      font-size: 32px;
      font-weight: 700;
      color: var(--primary);
      margin-bottom: 4px;
    }

    .stat-label {
      font-size: 13px;
      color: var(--text-secondary);
      font-weight: 500;
    }

    /* Color Swatches */
    .color-grid {
      display: grid;
      grid-template-columns: repeat(auto-fill, minmax(140px, 1fr));
      gap: 16px;
    }

    .color-swatch-card {
      background: var(--bg-card);
      border: 1px solid var(--border);
      border-radius: 10px;
      overflow: hidden;
      transition: all 0.2s;
      cursor: pointer;
    }

    .color-swatch-card:hover {
      box-shadow: var(--shadow-md);
      transform: translateY(-2px);
      border-color: var(--primary);
    }

    .color-preview {
      height: 80px;
      position: relative;
      border-bottom: 1px solid var(--border);
    }

    .color-details {
      padding: 12px;
    }

    .color-name {
      font-size: 12px;
      font-weight: 600;
      color: var(--text-primary);
      margin-bottom: 6px;
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
    }

    .color-value {
      font-family: 'SF Mono', 'Monaco', 'Courier New', monospace;
      font-size: 11px;
      color: var(--text-secondary);
      background: var(--bg-page);
      padding: 4px 8px;
      border-radius: 4px;
      display: inline-block;
      text-transform: uppercase;
    }

    /* Compact color chips (for extracted colors) */
    .color-chips {
      display: flex;
      flex-wrap: wrap;
      gap: 12px;
      margin-bottom: 32px;
    }

    .color-chip {
      display: flex;
      align-items: center;
      gap: 10px;
      padding: 10px 14px;
      background: var(--bg-card);
      border: 1px solid var(--border);
      border-radius: 8px;
      transition: all 0.2s;
      cursor: pointer;
    }

    .color-chip:hover {
      border-color: var(--primary);
      box-shadow: var(--shadow-sm);
      transform: translateY(-1px);
    }

    .color-chip-preview {
      width: 32px;
      height: 32px;
      border-radius: 6px;
      border: 1px solid var(--border);
      flex-shrink: 0;
    }

    .color-chip-value {
      font-family: 'SF Mono', Monaco, monospace;
      font-size: 12px;
      font-weight: 500;
      color: var(--text-primary);
      text-transform: uppercase;
    }

    /* Spacing Scale */
    .spacing-grid {
      display: grid;
      grid-template-columns: repeat(auto-fill, minmax(180px, 1fr));
      gap: 12px;
    }

    .spacing-item {
      background: var(--bg-card);
      border: 1px solid var(--border);
      border-radius: 8px;
      padding: 12px 16px;
      display: flex;
      align-items: center;
      gap: 12px;
      transition: all 0.2s;
      cursor: pointer;
    }

    .spacing-item:hover {
      border-color: var(--primary);
      box-shadow: var(--shadow-sm);
      transform: translateY(-1px);
    }

    .spacing-visual {
      background: var(--primary);
      border-radius: 4px;
      height: 32px;
      display: flex;
      align-items: center;
      justify-content: center;
      color: white;
      font-size: 10px;
      font-weight: 600;
      min-width: 32px;
      flex-shrink: 0;
    }

    .spacing-info {
      flex: 1;
      min-width: 0;
    }

    .spacing-name {
      font-weight: 600;
      font-size: 12px;
      color: var(--text-primary);
      margin-bottom: 2px;
    }

    .spacing-value {
      font-family: 'SF Mono', Monaco, monospace;
      font-size: 11px;
      color: var(--text-secondary);
    }

    /* Typography Scale */
    .type-scale {
      display: grid;
      gap: 24px;
    }

    .type-sample {
      background: var(--bg-card);
      border: 1px solid var(--border);
      border-radius: 12px;
      padding: 24px;
      transition: all 0.2s;
    }

    .type-sample:hover {
      box-shadow: var(--shadow-md);
    }

    .type-label {
      font-size: 12px;
      font-weight: 600;
      color: var(--text-secondary);
      text-transform: uppercase;
      letter-spacing: 0.05em;
      margin-bottom: 12px;
    }

    .type-preview {
      color: var(--text-primary);
      margin-bottom: 12px;
      border-bottom: 1px solid var(--border);
      padding-bottom: 16px;
    }

    .type-specs {
      display: flex;
      gap: 16px;
      font-size: 13px;
      color: var(--text-secondary);
    }

    .type-spec {
      font-family: 'SF Mono', Monaco, monospace;
    }

    .processing-label {
      font-weight: 500;
    }

    .processing-value {
      font-weight: 700;
      color: #48bb78;
    }

    /* Component Tree */
    .component-tree {
      list-style: none;
      padding-left: 0;
    }

    .component-tree ul {
      list-style: none;
      padding-left: 24px;
      margin-top: 8px;
    }

    .component-tree li {
      padding: 8px 12px;
      margin: 4px 0;
      background: #f7fafc;
      border-radius: 6px;
      border-left: 3px solid #667eea;
    }

    .size-badge {
      font-size: 12px;
      color: #718096;
      margin-left: 8px;
    }

    /* Warnings */
    .warning-card {
      background: #fef5e7;
      border: 1px solid #f39c12;
      border-radius: 8px;
      padding: 16px;
      margin-bottom: 12px;
    }

    .warning-icon {
      font-size: 20px;
      margin-right: 8px;
    }

    /* Table */
    table {
      width: 100%;
      border-collapse: collapse;
      margin-top: 16px;
    }

    th, td {
      padding: 12px;
      text-align: left;
      border-bottom: 1px solid #e2e8f0;
    }

    th {
      background: #f7fafc;
      font-weight: 600;
      color: #2d3748;
    }

    tr:hover {
      background: #f7fafc;
    }

    /* Badge */
    .badge {
      display: inline-block;
      padding: 4px 12px;
      border-radius: 12px;
      font-size: 12px;
      font-weight: 600;
    }

    .badge-success {
      background: #c6f6d5;
      color: #22543d;
    }

    .badge-warning {
      background: #fef5e7;
      color: #d69e2e;
    }

    /* Toast notification */
    .toast {
      position: fixed;
      bottom: 20px;
      right: 20px;
      background: #48bb78;
      color: white;
      padding: 16px 24px;
      border-radius: 8px;
      box-shadow: 0 4px 12px rgba(0,0,0,0.2);
      opacity: 0;
      transform: translateY(20px);
      transition: all 0.3s;
      z-index: 1000;
    }

    .toast.show {
      opacity: 1;
      transform: translateY(0);
    }

    /* File Browser */
    .file-browser {
      background: var(--bg-card);
      border: 1px solid var(--border);
      border-radius: 12px;
      margin-top: 24px;
      position: relative;
    }

    .file-browser-header {
      background: #f7fafc;
      padding: 12px 20px;
      border-bottom: 1px solid var(--border);
      border-radius: 12px 12px 0 0;
      display: grid;
      grid-template-columns: 40px 1fr 120px 100px;
      gap: 16px;
      font-size: 12px;
      font-weight: 600;
      color: var(--text-secondary);
      text-transform: uppercase;
      letter-spacing: 0.05em;
    }

    .file-row {
      position: relative;
      display: grid;
      grid-template-columns: 40px 1fr 120px 100px;
      gap: 16px;
      padding: 12px 20px;
      border-bottom: 1px solid var(--border);
      align-items: center;
      transition: background 0.15s;
    }

    .file-row:last-child {
      border-bottom: none;
      border-radius: 0 0 12px 12px;
    }

    .file-row:hover {
      background: #f7fafc;
    }

    .file-icon {
      width: 32px;
      height: 32px;
      display: flex;
      align-items: center;
      justify-content: center;
      border-radius: 6px;
      font-size: 16px;
    }

    .file-icon.svg {
      background: #e0e7ff;
      color: #5b21b6;
    }

    .file-icon.png {
      background: #dbeafe;
      color: #1e40af;
    }

    .file-name {
      font-family: 'SF Mono', Monaco, monospace;
      font-size: 13px;
      color: var(--text-primary);
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
    }

    .file-size {
      font-family: 'SF Mono', Monaco, monospace;
      font-size: 13px;
      color: var(--text-secondary);
      text-align: right;
    }

    .file-actions {
      display: flex;
      gap: 8px;
      justify-content: flex-end;
    }

    .btn-download {
      padding: 6px 12px;
      background: var(--primary);
      color: white;
      border: none;
      border-radius: 6px;
      font-size: 12px;
      font-weight: 500;
      cursor: pointer;
      transition: all 0.15s;
      display: flex;
      align-items: center;
      gap: 4px;
    }

    .btn-download:hover {
      background: var(--primary-dark);
      transform: translateY(-1px);
      box-shadow: var(--shadow-sm);
    }

    /* Image Preview Tooltip */
    .image-preview {
      position: fixed;
      background: white;
      border: 2px solid var(--border);
      border-radius: 8px;
      padding: 8px;
      box-shadow: 0 8px 16px rgba(0,0,0,0.15);
      opacity: 0;
      pointer-events: none;
      transition: opacity 0.2s;
      z-index: 1000;
      max-width: 300px;
      max-height: 300px;
    }

    .file-row:hover .image-preview {
      opacity: 1;
    }

    .image-preview img {
      display: block;
      max-width: 280px;
      max-height: 280px;
      width: auto;
      height: auto;
      border-radius: 4px;
      background-image:
        linear-gradient(45deg, #f0f0f0 25%, transparent 25%),
        linear-gradient(-45deg, #f0f0f0 25%, transparent 25%),
        linear-gradient(45deg, transparent 75%, #f0f0f0 75%),
        linear-gradient(-45deg, transparent 75%, #f0f0f0 75%);
      background-size: 20px 20px;
      background-position: 0 0, 0 10px, 10px -10px, -10px 0px;
      padding: 4px;
    }

    .image-preview-label {
      font-size: 11px;
      color: var(--text-secondary);
      margin-top: 6px;
      text-align: center;
      font-weight: 500;
    }
  </style>
</head>
<body>
  <!-- Sidebar Navigation -->
  <aside class="sidebar">
    <div class="nav-title">Navigation</div>
    <ul class="nav-list">
      <li><a class="nav-link active" href="#overview" onclick="scrollToSection(event, 'overview')">📊 Overview</a></li>
      <li><a class="nav-link" href="#colors" onclick="scrollToSection(event, 'colors')">🎨 Colors</a></li>
      <li><a class="nav-link" href="#spacing" onclick="scrollToSection(event, 'spacing')">📏 Spacing</a></li>
      <li><a class="nav-link" href="#typography" onclick="scrollToSection(event, 'typography')">✍️ Typography</a></li>
      <li><a class="nav-link" href="#assets" onclick="scrollToSection(event, 'assets')">🖼️ Assets</a></li>
    </ul>
  </aside>

  <!-- Main Content -->
  <main class="main-content">

    <!-- Overview Section -->
    <section id="overview" class="section">
      <div class="section-header">
        <h1 class="section-title">Design System Report</h1>
        <p class="section-description">Analysis of ${data.nodeName || 'Component'} • Generated ${new Date(data.timestamp).toLocaleDateString()}</p>
      </div>

      <div class="stats-grid">
        <div class="stat-card">
          <div class="stat-value">${data.processingStats.classesOptimized || 0}</div>
          <div class="stat-label">Classes Optimized</div>
        </div>
        <div class="stat-card">
          <div class="stat-value">${data.totalClasses}</div>
          <div class="stat-label">Tailwind Classes</div>
        </div>
        <div class="stat-card">
          <div class="stat-value">${data.colors.length}</div>
          <div class="stat-label">Colors</div>
        </div>
        <div class="stat-card">
          <div class="stat-value">${data.imageFiles.length}</div>
          <div class="stat-label">Assets</div>
        </div>
      </div>
    </section>

    <!-- Colors Section -->
    <section id="colors" class="section">
      <div class="section-header">
        <h1 class="section-title">Colors</h1>
        <p class="section-description">Color palette extracted from design</p>
      </div>

      ${data.colors.length > 0 ? `
        <h3 style="font-size: 14px; font-weight: 600; color: var(--text-secondary); text-transform: uppercase; letter-spacing: 0.05em; margin-bottom: 16px;">Extracted Colors</h3>
        <div class="color-chips">
          ${data.colors.map((color) => {
            return `
            <div class="color-chip" onclick="copyToClipboard('${color}', 'Color')">
              <div class="color-chip-preview" style="background: ${color};"></div>
              <div class="color-chip-value">${color.toUpperCase()}</div>
            </div>
          `}).join('')}
        </div>
      ` : ''}

      ${Object.keys(data.designTokens.colors).length > 0 ? `
        <h2>Design Tokens</h2>
        <div class="color-grid">
          ${Object.entries(data.designTokens.colors).map(([name, value]) => {
            return `
            <div class="color-swatch-card" onclick="copyToClipboard('${value}', 'Color')">
              <div class="color-preview" style="background: ${value};"></div>
              <div class="color-details">
                <div class="color-name">${name}</div>
                <div class="color-value">${value}</div>
              </div>
            </div>
          `}).join('')}
        </div>
      ` : ''}
    </section>

    <!-- Spacing Section -->
    <section id="spacing" class="section">
      <div class="section-header">
        <h1 class="section-title">Spacing</h1>
        <p class="section-description">Spacing scale and utilities</p>
      </div>

      ${Object.keys(data.designTokens.spacing).length > 0 ? `
        <h2>Design Tokens</h2>
        <div class="spacing-grid">
          ${Object.entries(data.designTokens.spacing).map(([name, value]) => `
            <div class="spacing-item" onclick="copyToClipboard('${value}', 'Spacing')">
              <div class="spacing-visual" style="width: ${value};">${value}</div>
              <div class="spacing-info">
                <div class="spacing-name">${name}</div>
                <div class="spacing-value">${value}</div>
              </div>
            </div>
          `).join('')}
        </div>
      ` : ''}
    </section>

    <!-- Typography Section -->
    <section id="typography" class="section">
      <div class="section-header">
        <h1 class="section-title">Typography</h1>
        <p class="section-description">Type scale and font families</p>
      </div>

      ${Object.keys(data.designTokens.typography).length > 0 ? `
        <h2>Type Scale</h2>
        <div class="type-scale">
          ${Object.entries(data.designTokens.typography)
            .sort(([, valueA], [, valueB]) => {
              // Extract numeric value from size
              const sizeA = typeof valueA === 'object' ? valueA.size : valueA
              const sizeB = typeof valueB === 'object' ? valueB.size : valueB
              const numA = parseInt(sizeA)
              const numB = parseInt(sizeB)
              return numA - numB  // Sort ascending (smallest to largest)
            })
            .map(([name, value]) => {
              // Handle both object {size, weight} and string formats
              const fontSize = typeof value === 'object' ? value.size : value
              const fontWeight = typeof value === 'object' ? value.weight : 400
              return `
              <div class="type-sample">
                <div class="type-label">${name}</div>
                <div class="type-preview" style="font-size: ${fontSize}; font-weight: ${fontWeight};">
                  The quick brown fox jumps over the lazy dog
                </div>
                <div class="type-specs">
                  <span class="type-spec">Size: ${fontSize}</span>
                  <span class="type-spec">Weight: ${fontWeight}</span>
                </div>
              </div>
              `
            }).join('')}
        </div>
      ` : ''}

    </section>

    <!-- Assets Section -->
    <section id="assets" class="section">
      <div class="section-header">
        <h1 class="section-title">Assets</h1>
        <p class="section-description">${data.imageFiles.length} images • ${formatBytes(data.totalImageSize)}</p>
      </div>

      <div class="stats-grid">
        <div class="stat-card">
          <div class="stat-value">${data.imageFiles.filter(f => f.endsWith('.svg')).length}</div>
          <div class="stat-label">SVG Icons</div>
        </div>
        <div class="stat-card">
          <div class="stat-value">${data.imageFiles.filter(f => f.endsWith('.png')).length}</div>
          <div class="stat-label">PNG Images</div>
        </div>
        <div class="stat-card">
          <div class="stat-value">${formatBytes(data.totalImageSize)}</div>
          <div class="stat-label">Total Size</div>
        </div>
      </div>

      ${data.imageFilesWithSize.length > 0 ? `
        <h2>File Browser</h2>
        <div class="file-browser">
          <div class="file-browser-header">
            <div>Type</div>
            <div>File Name</div>
            <div>Size</div>
            <div>Actions</div>
          </div>
          ${data.imageFilesWithSize.map(file => {
            const icon = file.type === 'svg' ? '📐' : '🖼️'
            return `
          <div class="file-row">
            <div class="file-icon ${file.type}">
              ${icon}
            </div>
            <div class="file-name">${file.name}</div>
            <div class="file-size">${formatBytes(file.size)}</div>
            <div class="file-actions">
              <button class="btn-download" onclick="downloadFile('${file.name}')">
                ⬇ Download
              </button>
            </div>
            <div class="image-preview">
              <img src="img/${file.name}" alt="${file.name}" loading="lazy" />
              <div class="image-preview-label">Preview</div>
            </div>
          </div>
            `
          }).join('')}
        </div>
      ` : ''}
    </section>

  </main>

  <!-- Toast Notification -->
  <div id="toast" class="toast"></div>

  <script>
    // Smooth scroll to section
    function scrollToSection(event, id) {
      event.preventDefault()

      // Update active nav link
      document.querySelectorAll('.nav-link').forEach(link => {
        link.classList.remove('active')
      })
      event.target.classList.add('active')

      // Scroll to section
      const section = document.getElementById(id)
      if (section) {
        section.scrollIntoView({ behavior: 'smooth', block: 'start' })
      }
    }

    // Copy to clipboard
    function copyToClipboard(text, type) {
      navigator.clipboard.writeText(text).then(() => {
        showToast(\`\${type} copied: \${text}\`)
      }).catch(err => {
        console.error('Failed to copy:', err)
      })
    }

    // Download file
    function downloadFile(filename) {
      const link = document.createElement('a')
      link.href = \`img/\${filename}\`
      link.download = filename
      document.body.appendChild(link)
      link.click()
      document.body.removeChild(link)
      showToast(\`Downloading: \${filename}\`)
    }

    // Show toast
    function showToast(message) {
      const toast = document.getElementById('toast')
      toast.textContent = message
      toast.classList.add('show')

      setTimeout(() => {
        toast.classList.remove('show')
      }, 2000)
    }

    // Image preview follows cursor
    document.addEventListener('DOMContentLoaded', () => {
      const fileRows = document.querySelectorAll('.file-row')

      fileRows.forEach(row => {
        const preview = row.querySelector('.image-preview')

        row.addEventListener('mousemove', (e) => {
          const offset = 20
          preview.style.left = (e.clientX + offset) + 'px'
          preview.style.top = (e.clientY + offset) + 'px'
        })
      })
    })

    // Intersection Observer for nav highlighting
    const sections = document.querySelectorAll('section[id]')
    const navLinks = document.querySelectorAll('.nav-link')

    const observer = new IntersectionObserver((entries) => {
      entries.forEach(entry => {
        if (entry.isIntersecting) {
          const id = entry.target.getAttribute('id')
          navLinks.forEach(link => {
            link.classList.remove('active')
            if (link.getAttribute('href') === \`#\${id}\`) {
              link.classList.add('active')
            }
          })
        }
      })
    }, { threshold: 0.3 })

    sections.forEach(section => observer.observe(section))
  </script>
</body>
</html>`
}

process.exit(0)
