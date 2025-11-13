#!/usr/bin/env node
/**
 * Responsive Merger - CSS-Pure Approach
 *
 * Merges modular components from 3 breakpoints (Desktop, Tablet, Mobile)
 * into responsive components using pure CSS media queries.
 *
 * Usage:
 *   node scripts/responsive-merger.js \
 *     --desktop node-6055-2436-1762733564 \
 *     --tablet node-6055-2654-1762712319 \
 *     --mobile node-6055-2872-1762733537
 *
 * Output: src/generated/responsive-screens/responsive-merger-<TIMESTAMP>/
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { parseStringPromise } from 'xml2js';
import { parse as babelParse } from '@babel/parser';
import traverseLib from '@babel/traverse';
import generateLib from '@babel/generator';
import { compileResponsiveClasses } from './responsive-css-compiler.js';
import { execute as extractPropsExecute } from './transformations/extract-props.js';

const traverseDefault = traverseLib.default || traverseLib;
const generateDefault = generateLib.default || generateLib;

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const PROJECT_ROOT = path.resolve(__dirname, '..');

// ═══════════════════════════════════════════════════════════════
// ANSI COLOR CODES & LOGGING
// ═══════════════════════════════════════════════════════════════

const colors = {
  reset: '\x1b[0m',
  bright: '\x1b[1m',
  dim: '\x1b[2m',

  // Colors
  cyan: '\x1b[36m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  magenta: '\x1b[35m',
  red: '\x1b[31m',
  gray: '\x1b[90m',

  // Background
  bgCyan: '\x1b[46m',
  bgGreen: '\x1b[42m',
  bgYellow: '\x1b[43m',
};

const log = {
  phase: (title) => {
    console.log(`\n${colors.bright}${colors.cyan}┌${'─'.repeat(60)}┐${colors.reset}`);
    console.log(`${colors.bright}${colors.cyan}│  ${title.padEnd(58)}│${colors.reset}`);
    console.log(`${colors.bright}${colors.cyan}└${'─'.repeat(60)}┘${colors.reset}\n`);
  },

  task: (emoji, text) => {
    console.log(`${colors.bright}${emoji}  ${colors.blue}${text}${colors.reset}`);
  },

  success: (text) => {
    console.log(`   ${colors.green}✓${colors.reset} ${colors.dim}${text}${colors.reset}`);
  },

  warning: (text) => {
    console.log(`   ${colors.yellow}⚠${colors.reset} ${colors.dim}${text}${colors.reset}`);
  },

  info: (text) => {
    console.log(`   ${colors.cyan}ℹ${colors.reset} ${colors.dim}${text}${colors.reset}`);
  },

  error: (text) => {
    console.log(`\n${colors.red}✗ ${text}${colors.reset}`);
  },

  header: (text) => {
    console.log(`\n${colors.bright}${colors.magenta}🚀 ${text}${colors.reset}\n`);
  },

  divider: () => {
    console.log(`${colors.gray}${'─'.repeat(60)}${colors.reset}`);
  }
};

// ═══════════════════════════════════════════════════════════════
// CLI ARGUMENT PARSING
// ═══════════════════════════════════════════════════════════════

/**
 * Parse CLI arguments with breakpoint sizes
 * Format: --desktop 1440px node-xxx --tablet 960px node-yyy --mobile 420px node-zzz
 */
function parseArguments() {
  const args = process.argv.slice(2);

  const desktopIdx = args.indexOf('--desktop');
  const tabletIdx = args.indexOf('--tablet');
  const mobileIdx = args.indexOf('--mobile');

  if (desktopIdx === -1 || tabletIdx === -1 || mobileIdx === -1) {
    log.error('Missing required arguments\n');
    console.log(`${colors.dim}Usage: node responsive-merger.js \\`);
    console.log(`${colors.dim}  --desktop <width> <testId> \\`);
    console.log(`${colors.dim}  --tablet <width> <testId> \\`);
    console.log(`${colors.dim}  --mobile <width> <testId>\n${colors.reset}`);
    console.log(`${colors.dim}Example:`);
    console.log(`${colors.dim}  node responsive-merger.js \\`);
    console.log(`${colors.dim}    --desktop 1440px node-6055-2436-1762733564 \\`);
    console.log(`${colors.dim}    --tablet 960px node-6055-2654-1762712319 \\`);
    console.log(`${colors.dim}    --mobile 420px node-6055-2872-1762733537${colors.reset}`);
    process.exit(1);
  }

  // Parse width (can be "1440px", "1440", or 1440)
  function parseWidth(widthStr) {
    const parsed = parseInt(widthStr.toString().replace(/px/i, ''), 10);
    if (isNaN(parsed) || parsed <= 0) {
      log.error(`Invalid width: ${widthStr}`);
      log.info('Width must be a positive number (e.g., "1440px", "1440", or 1440)');
      process.exit(1);
    }
    return parsed;
  }

  const desktopWidth = parseWidth(args[desktopIdx + 1]);
  const desktopId = args[desktopIdx + 2];

  const tabletWidth = parseWidth(args[tabletIdx + 1]);
  const tabletId = args[tabletIdx + 2];

  const mobileWidth = parseWidth(args[mobileIdx + 1]);
  const mobileId = args[mobileIdx + 2];

  // Validation check IDs exist
  if (!desktopId || !tabletId || !mobileId) {
    log.error('Missing test IDs\n');
    log.info('Format: --desktop <width> <testId> --tablet <width> <testId> --mobile <width> <testId>');
    process.exit(1);
  }

  // Validate breakpoint order: Desktop > Tablet > Mobile
  if (!(desktopWidth > tabletWidth && tabletWidth > mobileWidth)) {
    log.error('Invalid breakpoint order!\n');
    log.info(`Current: Desktop=${desktopWidth}px, Tablet=${tabletWidth}px, Mobile=${mobileWidth}px`);
    log.info('Required: Desktop > Tablet > Mobile');
    log.warning(`\nExample of correct order:`);
    log.warning(`  Desktop: 1440px (largest)`);
    log.warning(`  Tablet:  960px  (medium)`);
    log.warning(`  Mobile:  420px  (smallest)\n`);
    process.exit(1);
  }

  return {
    desktop: { width: desktopWidth, id: desktopId },
    tablet: { width: tabletWidth, id: tabletId },
    mobile: { width: mobileWidth, id: mobileId }
  };
}

// ═══════════════════════════════════════════════════════════════
// VALIDATION & METADATA
// ═══════════════════════════════════════════════════════════════

function validateBreakpoint(testId, breakpointName, explicitWidth) {
  const testDir = path.join(PROJECT_ROOT, 'src/generated/export_figma', testId);

  if (!fs.existsSync(testDir)) {
    log.error(`${breakpointName} test directory not found`);
    log.info(`Looking for: ${testDir}`);
    process.exit(1);
  }

  const componentsDir = path.join(testDir, 'components');
  if (!fs.existsSync(componentsDir)) {
    log.error(`${breakpointName} missing components/ directory`);
    log.info('Components should be automatically generated during export');
    log.info(`If missing, run: docker exec mcp-figma-v1 node scripts/post-processing/component-splitter.js ${testDir}`);
    process.exit(1);
  }

  // Read metadata.json
  const metadataPath = path.join(testDir, 'metadata.json');
  if (!fs.existsSync(metadataPath)) {
    log.error(`${breakpointName} missing metadata.json`);
    process.exit(1);
  }

  const metadata = JSON.parse(fs.readFileSync(metadataPath, 'utf8'));

  return {
    testId,
    testDir,
    componentsDir,
    metadata,
    width: explicitWidth, // Use explicit width from CLI args
    height: metadata.dimensions?.height || 0
  };
}

function validateBreakpoints(breakpoints) {
  log.task('🔍', 'Validating breakpoints');

  const desktop = validateBreakpoint(breakpoints.desktop.id, 'Desktop', breakpoints.desktop.width);
  const tablet = validateBreakpoint(breakpoints.tablet.id, 'Tablet', breakpoints.tablet.width);
  const mobile = validateBreakpoint(breakpoints.mobile.id, 'Mobile', breakpoints.mobile.width);

  log.success(`Desktop: ${breakpoints.desktop.id} (${breakpoints.desktop.width}px)`);
  log.success(`Tablet:  ${breakpoints.tablet.id} (${breakpoints.tablet.width}px)`);
  log.success(`Mobile:  ${breakpoints.mobile.id} (${breakpoints.mobile.width}px)\n`);

  return { desktop, tablet, mobile };
}

// ═══════════════════════════════════════════════════════════════
// COMPONENT DETECTION
// ═══════════════════════════════════════════════════════════════

function getModularComponents(componentsDir) {
  if (!fs.existsSync(componentsDir)) return [];

  return fs.readdirSync(componentsDir)
    .filter(file => file.endsWith('.tsx'))
    .map(file => path.basename(file, '.tsx'))
    .sort();
}

function detectCommonComponents(desktop, tablet, mobile) {
  console.log('📊 Detecting common components...\n');

  const desktopComps = getModularComponents(desktop.componentsDir);
  const tabletComps = getModularComponents(tablet.componentsDir);
  const mobileComps = getModularComponents(mobile.componentsDir);

  console.log(`   Desktop: ${desktopComps.length} components`);
  console.log(`   Tablet:  ${tabletComps.length} components`);
  console.log(`   Mobile:  ${mobileComps.length} components\n`);

  // Find common components (present in all 3)
  const common = desktopComps.filter(name =>
    tabletComps.includes(name) && mobileComps.includes(name)
  );

  console.log(`✅ Found ${common.length} common components:\n`);
  common.forEach(name => console.log(`   - ${name}`));
  console.log('');

  // Warn about unique components
  const desktopOnly = desktopComps.filter(n => !common.includes(n));
  const tabletOnly = tabletComps.filter(n => !common.includes(n));
  const mobileOnly = mobileComps.filter(n => !common.includes(n));

  if (desktopOnly.length > 0) {
    console.log(`⚠️  Desktop-only: ${desktopOnly.join(', ')}`);
  }
  if (tabletOnly.length > 0) {
    console.log(`⚠️  Tablet-only: ${tabletOnly.join(', ')}`);
  }
  if (mobileOnly.length > 0) {
    console.log(`⚠️  Mobile-only: ${mobileOnly.join(', ')}`);
  }
  if (desktopOnly.length + tabletOnly.length + mobileOnly.length > 0) {
    console.log('');
  }

  if (common.length === 0) {
    console.error('❌ Error: No common components found across breakpoints');
    process.exit(1);
  }

  return common;
}

// ═══════════════════════════════════════════════════════════════
// COMPONENT ORDER (FROM DESKTOP METADATA.XML)
// ═══════════════════════════════════════════════════════════════

async function getComponentOrder(desktopDir, commonComponents) {
  const metadataXmlPath = path.join(desktopDir, 'metadata.xml');

  if (!fs.existsSync(metadataXmlPath)) {
    console.warn('⚠️  Warning: metadata.xml not found, using alphabetical order');
    return commonComponents.sort();
  }

  // Normalize component name: "title section" → "Titlesection"
  function normalizeComponentName(name) {
    return name
      .split(/[\s_-]+/)  // Split on spaces, underscores, hyphens
      .map((word) => {
        // Capitalize first letter of each word
        return word.charAt(0).toUpperCase() + word.slice(1).toLowerCase();
      })
      .join('');
  }

  try {
    const xmlContent = fs.readFileSync(metadataXmlPath, 'utf8');
    const parsed = await parseStringPromise(xmlContent);

    // Extract component names in order from XML
    // The root element is <frame>, so parsed.frame contains the root frame object
    const orderedNames = [];

    function extractNames(node) {
      if (!node) return;

      const rawName = node.$?.name;
      if (rawName) {
        // Normalize the name to match component file names
        const normalized = normalizeComponentName(rawName);

        // Check if this normalized name matches any component
        if (commonComponents.includes(normalized) && !orderedNames.includes(normalized)) {
          orderedNames.push(normalized);
        }
      }

      // Recursively process all child types as arrays
      // Each child type (node, frame, instance, text) is an array
      if (Array.isArray(node.instance)) {
        node.instance.forEach(child => extractNames(child));
      }
      if (Array.isArray(node.frame)) {
        node.frame.forEach(child => extractNames(child));
      }
      if (Array.isArray(node.node)) {
        node.node.forEach(child => extractNames(child));
      }
      if (Array.isArray(node.text)) {
        node.text.forEach(child => extractNames(child));
      }
    }

    // Start extraction from the root <frame> element (single object, not array)
    if (parsed.frame) {
      extractNames(parsed.frame);
    }

    // Add any missing components alphabetically at the end
    const missing = commonComponents.filter(c => !orderedNames.includes(c));
    const finalOrder = [...orderedNames, ...missing.sort()];

    console.log('📋 Component order (from Desktop metadata.xml):\n');
    finalOrder.forEach((name, idx) => console.log(`   ${idx + 1}. ${name}`));
    console.log('');

    return finalOrder;
  } catch (error) {
    console.warn('⚠️  Warning: Failed to parse metadata.xml, using alphabetical order');
    console.warn(`   Error: ${error.message}\n`);
    return commonComponents.sort();
  }
}

// ═══════════════════════════════════════════════════════════════
// CSS PARSING
// ═══════════════════════════════════════════════════════════════

function parseCSSIntoSections(css) {
  const sections = {
    imports: '',
    root: '',
    utilities: '',
    customClasses: ''
  };

  // Extract @import statements (handle URLs with semicolons in query params)
  const importMatches = css.match(/@import\s+(?:url\(['"].*?['"]\)|['"][^'"]*['"])[^;]*;/g);
  if (importMatches) {
    sections.imports = importMatches.join('\n');
  }

  // Extract :root variables
  const rootMatch = css.match(/:root\s*\{[^}]+\}/s);
  if (rootMatch) {
    sections.root = rootMatch[0];
  }

  // Extract Figma utilities (content-start, content-end, etc.)
  const utilMatch = css.match(/\/\*\s*Figma-specific utility classes\s*\*\/\n([\s\S]*?)(?=\n\/\*|$)/);
  if (utilMatch) {
    sections.utilities = utilMatch[0];
  }

  // Extract custom classes (everything else)
  const sectionMarkerMatch = css.match(/\/\*\s*=====\s*[3-9]\..*?\*\/[\s\S]*$/);
  if (sectionMarkerMatch) {
    sections.customClasses = sectionMarkerMatch[0];
  } else {
    // Fallback: extract everything after utilities
    const afterUtils = css.indexOf(sections.utilities) + sections.utilities.length;
    sections.customClasses = css.substring(afterUtils).trim();
  }

  return sections;
}

function parseClassDefinitions(css) {
  const map = new Map();
  const regex = /\.([a-z0-9_-]+)\s*\{([^}]+)\}/gi;
  let match;

  while ((match = regex.exec(css)) !== null) {
    const className = match[1];
    const definition = `.${className} {${match[2]}}`;
    map.set(className, definition);
  }

  return map;
}

function getClassDifferences(baseCSS, targetCSS) {
  const baseClasses = parseClassDefinitions(baseCSS);
  const targetClasses = parseClassDefinitions(targetCSS);

  let diff = '';

  for (const [className, targetDef] of targetClasses) {
    const baseDef = baseClasses.get(className);

    // Include if: new class OR different definition
    if (!baseDef || baseDef !== targetDef) {
      diff += targetDef + '\n';
    }
  }

  return diff;
}

function mergeRootVariables(rootSections) {
  const vars = new Map();

  rootSections.forEach(section => {
    if (!section) return;

    const varPattern = /(--[a-z0-9-]+):\s*([^;]+);/g;
    let match;

    while ((match = varPattern.exec(section)) !== null) {
      vars.set(match[1], match[2]);
    }
  });

  if (vars.size === 0) return '';

  let root = ':root {\n';
  for (const [varName, value] of vars) {
    root += `  ${varName}: ${value};\n`;
  }
  root += '}';

  return root;
}

function indentCSS(css) {
  return css.split('\n')
    .map(line => line ? '  ' + line : line)
    .join('\n');
}

// ═══════════════════════════════════════════════════════════════
// CSS MERGER (CORE ALGORITHM)
// ═══════════════════════════════════════════════════════════════

function readCSS(dir, componentName) {
  const cssPath = path.join(dir, 'modular', `${componentName}.css`);
  return fs.existsSync(cssPath) ? fs.readFileSync(cssPath, 'utf8') : '';
}

function mergeCSS(desktopCSS, tabletCSS, mobileCSS, componentName, breakpoints) {
  const desktopSections = parseCSSIntoSections(desktopCSS);
  const tabletSections = parseCSSIntoSections(tabletCSS);
  const mobileSections = parseCSSIntoSections(mobileCSS);

  const desktopWidth = breakpoints?.desktop || 1440;
  const tabletWidth = breakpoints?.tablet || 960;
  const mobileWidth = breakpoints?.mobile || 420;

  let merged = `/* Auto-generated responsive CSS for ${componentName} */\n`;
  merged += `/* Generated by responsive-merger.js */\n`;
  merged += `/* Breakpoints: Desktop ${desktopWidth}px | Tablet ${tabletWidth}px | Mobile ${mobileWidth}px */\n\n`;

  // 1. Google Fonts (from desktop)
  if (desktopSections.imports) {
    merged += desktopSections.imports + '\n\n';
  }

  // 2. :root variables (merged from all 3)
  const rootVars = mergeRootVariables([
    desktopSections.root,
    tabletSections.root,
    mobileSections.root
  ]);
  if (rootVars) {
    merged += rootVars + '\n\n';
  }

  // 3. Utility classes (Figma-specific, from desktop)
  if (desktopSections.utilities) {
    merged += desktopSections.utilities + '\n\n';
  }

  // 4. Desktop styles (default - no media query)
  merged += `/* ========== Desktop Styles (${desktopWidth}px) ========== */\n`;
  merged += desktopSections.customClasses + '\n\n';

  // 5. Tablet overrides (media query)
  const tabletDiff = getClassDifferences(
    desktopSections.customClasses,
    tabletSections.customClasses
  );

  if (tabletDiff.trim()) {
    merged += `/* ========== Tablet Overrides (≤${tabletWidth}px) ========== */\n`;
    merged += `@media (max-width: ${tabletWidth}px) {\n`;
    merged += indentCSS(tabletDiff);
    merged += '}\n\n';
  }

  // 6. Mobile overrides (media query)
  const mobileDiff = getClassDifferences(
    tabletSections.customClasses,
    mobileSections.customClasses
  );

  if (mobileDiff.trim()) {
    merged += `/* ========== Mobile Overrides (≤${mobileWidth}px) ========== */\n`;
    merged += `@media (max-width: ${mobileWidth}px) {\n`;
    merged += indentCSS(mobileDiff);
    merged += '}';
  }

  return merged;
}

// ═══════════════════════════════════════════════════════════════
// TSX RESPONSIVE MERGING (TAILWIND PREFIXES)
// ═══════════════════════════════════════════════════════════════

/**
 * Extract className value from JSX element's attributes
 * @param {object} jsxElement - Babel JSX element node
 * @returns {string|null} - className value or null
 */
function extractClassNameFromJSX(jsxElement) {
  if (!jsxElement || !jsxElement.openingElement) {
    return null;
  }

  const classNameAttr = jsxElement.openingElement.attributes.find(
    attr => attr.type === 'JSXAttribute' && attr.name?.name === 'className'
  );

  if (!classNameAttr || !classNameAttr.value) {
    return null;
  }

  // Handle string literal
  if (classNameAttr.value.type === 'StringLiteral') {
    return classNameAttr.value.value.trim();
  }

  // Handle JSX expression (template string, variable, etc.)
  if (classNameAttr.value.type === 'JSXExpressionContainer') {
    const expr = classNameAttr.value.expression;
    if (expr.type === 'StringLiteral') {
      return expr.value.trim();
    }
    if (expr.type === 'TemplateLiteral') {
      // For template literals, try to extract static parts
      const staticParts = expr.quasis.map(q => q.value.cooked).join(' ');
      return staticParts.trim();
    }
  }

  return null;
}

/**
 * Normalize className string (split, sort, dedupe)
 * @param {string} className - Raw className string
 * @returns {Array<string>} - Normalized class array
 */
function normalizeClassName(className) {
  if (!className || typeof className !== 'string') {
    return [];
  }

  return className
    .trim()
    .split(/\s+/)
    .filter(c => c.length > 0)
    .sort()
    .filter((c, i, arr) => i === 0 || c !== arr[i - 1]); // Dedupe
}

/**
 * Compare two className strings and return differences
 * @param {string} baseClasses - Base (Desktop) className
 * @param {string} targetClasses - Target (Tablet/Mobile) className
 * @returns {object} - { added: [], removed: [], unchanged: [] }
 */
function diffClassNames(baseClasses, targetClasses) {
  const base = new Set(normalizeClassName(baseClasses));
  const target = new Set(normalizeClassName(targetClasses));

  const added = [...target].filter(c => !base.has(c));
  const removed = [...base].filter(c => !target.has(c));
  const unchanged = [...base].filter(c => target.has(c));

  return { added, removed, unchanged };
}

/**
 * Merge className differences with Tailwind breakpoint prefixes
 * Mobile-first approach: sm: (≥420px), md: (≥960px), lg: (≥1440px)
 *
 * @param {string} desktopClasses - Desktop className (default, no prefix)
 * @param {string} tabletClasses - Tablet className
 * @param {string} mobileClasses - Mobile className (base)
 * @param {object} breakpoints - { desktop, tablet, mobile } widths
 * @returns {string} - Merged responsive className
 */
function mergeClassNamesResponsive(desktopClasses, tabletClasses, mobileClasses, breakpoints) {
  // Normalize all classNames
  const mobile = normalizeClassName(mobileClasses);
  const tablet = normalizeClassName(tabletClasses);
  const desktop = normalizeClassName(desktopClasses);

  // Mobile-first: start with mobile classes (no prefix)
  const result = new Set(mobile);

  // Find what changes from mobile → tablet
  const mobileToTablet = diffClassNames(mobileClasses, tabletClasses);

  // Remove mobile classes that disappear on tablet
  mobileToTablet.removed.forEach(cls => result.delete(cls));

  // Add tablet classes with md: prefix
  mobileToTablet.added.forEach(cls => result.add(`md:${cls}`));

  // Find what changes from tablet → desktop
  const tabletToDesktop = diffClassNames(tabletClasses, desktopClasses);

  // Remove tablet classes that disappear on desktop (with md: prefix)
  tabletToDesktop.removed.forEach(cls => {
    result.delete(`md:${cls}`);
    result.delete(cls); // Also remove unprefixed version if exists
  });

  // Add desktop classes with lg: prefix
  tabletToDesktop.added.forEach(cls => result.add(`lg:${cls}`));

  return Array.from(result).join(' ');
}

/**
 * Recursively parse JSX element and extract structure + classNames
 * @param {object} jsxElement - Babel JSX element node
 * @returns {object} - { dataName, className, children: [...] }
 */
function parseJSXElement(jsxElement) {
  if (!jsxElement || jsxElement.type !== 'JSXElement') {
    return null;
  }

  // Extract data-name attribute
  const dataNameAttr = jsxElement.openingElement.attributes.find(
    attr => attr.type === 'JSXAttribute' && attr.name?.name === 'data-name'
  );
  const dataName = dataNameAttr?.value?.value || null;

  // Extract className
  const className = extractClassNameFromJSX(jsxElement);

  // Parse children recursively
  const children = [];
  if (jsxElement.children) {
    for (const child of jsxElement.children) {
      if (child.type === 'JSXElement') {
        const parsed = parseJSXElement(child);
        if (parsed) {
          children.push(parsed);
        }
      }
    }
  }

  return { dataName, className, children };
}

/**
 * Merge 3 TSX files using responsive transformation pipeline
 * @param {string} desktopTSX - Desktop TSX content
 * @param {string} tabletTSX - Tablet TSX content
 * @param {string} mobileTSX - Mobile TSX content
 * @param {object} breakpoints - { desktop, tablet, mobile } widths
 * @returns {Promise<{code: string, stats: object}>} - Merged responsive TSX and transformation stats
 */
async function mergeTSXStructure(desktopTSX, tabletTSX, mobileTSX, breakpoints) {
  try {
    // Import pipeline (dynamic import to avoid circular dependencies)
    const { runResponsivePipeline, formatPipelineStats } = await import('./responsive-pipeline.js');

    // Parse all 3 TSX files into AST
    const desktopAST = babelParse(desktopTSX, {
      sourceType: 'module',
      plugins: ['jsx', 'typescript']
    });

    const tabletAST = babelParse(tabletTSX, {
      sourceType: 'module',
      plugins: ['jsx', 'typescript']
    });

    const mobileAST = babelParse(mobileTSX, {
      sourceType: 'module',
      plugins: ['jsx', 'typescript']
    });

    // Run responsive transformation pipeline
    const config = { transforms: {} }; // All transforms enabled by default

    const context = await runResponsivePipeline(
      desktopAST,
      tabletAST,
      mobileAST,
      breakpoints,
      config
    );

    // Log pipeline statistics
    if (Object.keys(context.stats).length > 0) {
      const statsFormatted = formatPipelineStats(context.stats);
      log.info('Responsive Pipeline Stats:\n' + statsFormatted);
    }

    // Generate merged TSX code from modified Desktop AST
    const mergedCode = generateDefault(context.desktopAST).code;

    // Return both code and stats for metadata
    return {
      code: mergedCode,
      stats: context.stats || {}
    };

  } catch (err) {
    log.warning(`Failed to merge TSX structures: ${err.message}`);
    log.info('Falling back to Desktop TSX only');
    return {
      code: desktopTSX,
      stats: { error: err.message }
    };
  }
}

// ═══════════════════════════════════════════════════════════════
// HELPER FUNCTION EXTRACTION & INJECTION
// ═══════════════════════════════════════════════════════════════

/**
 * Extract helper functions from Component-clean.tsx
 * Returns Map<helperName, { code, imports }>
 */
function extractHelperFunctions(testDir, mainComponentNames) {
  const componentCleanPath = path.join(testDir, 'Component-clean.tsx');

  if (!fs.existsSync(componentCleanPath)) {
    return new Map();
  }

  const sourceCode = fs.readFileSync(componentCleanPath, 'utf8');

  try {
    const ast = babelParse(sourceCode, {
      sourceType: 'module',
      plugins: ['jsx', 'typescript']
    });

    const helpers = new Map();
    const imports = [];

    // Collect all imports
    traverseDefault(ast, {
      ImportDeclaration(path) {
        imports.push(generateDefault(path.node).code);
      }
    });

    // Find all function declarations
    traverseDefault(ast, {
      FunctionDeclaration(path) {
        const functionName = path.node.id?.name;

        // Skip if it's a main component
        if (functionName && !mainComponentNames.includes(functionName)) {
          // This is a helper function
          const helperCode = generateDefault(path.node).code;

          // Find which imports this helper uses
          const usedImports = [];
          const helperIdentifiers = [];

          // Collect identifiers from this function
          path.traverse({
            Identifier(identPath) {
              const name = identPath.node.name;
              if (!helperIdentifiers.includes(name)) {
                helperIdentifiers.push(name);
              }
            }
          });

          // Match identifiers with imports
          for (const name of helperIdentifiers) {
            const matchingImport = imports.find(imp =>
              imp.includes(`import ${name} `) ||
              imp.includes(`{ ${name}`) ||
              imp.includes(`, ${name}`)
            );
            if (matchingImport && !usedImports.includes(matchingImport)) {
              usedImports.push(matchingImport);
            }
          }

          helpers.set(functionName, {
            code: helperCode,
            imports: usedImports
          });
        }
      }
    });

    return helpers;
  } catch (err) {
    console.error('   ⚠️  Error parsing Component-clean.tsx:', err.message);
    return new Map();
  }
}

/**
 * Find which helpers are used in a TSX file
 * Returns Set<helperNames> with recursive dependencies resolved
 */
function findUsedHelpers(tsxContent, availableHelpers) {
  const usedHelpers = new Set();

  try {
    const ast = babelParse(tsxContent, {
      sourceType: 'module',
      plugins: ['jsx', 'typescript']
    });

    // Find JSX elements and function calls
    traverseDefault(ast, {
      JSXIdentifier(path) {
        const name = path.node.name;
        if (availableHelpers.has(name)) {
          usedHelpers.add(name);
        }
      },
      CallExpression(path) {
        if (path.node.callee.type === 'Identifier') {
          const name = path.node.callee.name;
          if (availableHelpers.has(name)) {
            usedHelpers.add(name);
          }
        }
      }
    });

    // Resolve dependencies recursively
    const resolvedHelpers = new Set(usedHelpers);
    let changed = true;

    while (changed) {
      changed = false;
      for (const helperName of resolvedHelpers) {
        const helper = availableHelpers.get(helperName);
        if (helper) {
          // Check if this helper uses other helpers
          const helperUsedHelpers = findUsedHelpers(helper.code, availableHelpers);
          for (const dep of helperUsedHelpers) {
            if (!resolvedHelpers.has(dep)) {
              resolvedHelpers.add(dep);
              changed = true;
            }
          }
        }
      }
    }

    return resolvedHelpers;
  } catch (err) {
    console.error('   ⚠️  Error analyzing helper usage:', err.message);
    return usedHelpers;
  }
}

/**
 * Inject helper functions into a component TSX file
 * Returns modified TSX content
 */
function injectHelpersIntoComponent(tsxContent, usedHelperNames, helpersMap) {
  if (usedHelperNames.size === 0) {
    return tsxContent; // No helpers needed
  }

  try {
    const ast = babelParse(tsxContent, {
      sourceType: 'module',
      plugins: ['jsx', 'typescript']
    });

    // Collect all imports and helpers to inject
    const importsToAdd = new Set();
    const helpersToAdd = [];
    const existingImports = new Set();
    const existingFunctions = new Set();

    // Get existing imports and function names
    traverseDefault(ast, {
      ImportDeclaration(path) {
        existingImports.add(generateDefault(path.node).code);
        // Also track import specifiers to avoid duplicate imports
        path.node.specifiers.forEach(spec => {
          if (spec.type === 'ImportDefaultSpecifier' || spec.type === 'ImportSpecifier') {
            existingImports.add(spec.local.name);
          }
        });
      },
      FunctionDeclaration(path) {
        if (path.node.id && path.node.id.name) {
          existingFunctions.add(path.node.id.name);
        }
      }
    });

    // Collect helper code and imports
    for (const helperName of usedHelperNames) {
      const helper = helpersMap.get(helperName);
      if (helper) {
        // Only add helper if it doesn't exist already
        if (!existingFunctions.has(helperName)) {
          helpersToAdd.push(helper.code);

          // Add imports, fixing paths for nested subcomponents
          for (const imp of helper.imports) {
            // Fix image import paths: "./img/" -> "../img/"
            const fixedImport = imp.replace(/from\s+["']\.\/img\//g, 'from "../img/');
            // Check if import statement already exists OR import name is already imported
            const importName = imp.match(/import\s+(\w+)/)?.[1];
            if (!existingImports.has(fixedImport) && (!importName || !existingImports.has(importName))) {
              importsToAdd.add(fixedImport);
            }
          }
        }
      }
    }

    // Find the position of the last import or start of file
    let lastImportEnd = 0;
    let exportDefaultStart = tsxContent.length;

    traverseDefault(ast, {
      ImportDeclaration(path) {
        if (path.node.end > lastImportEnd) {
          lastImportEnd = path.node.end;
        }
      },
      ExportDefaultDeclaration(path) {
        if (path.node.start < exportDefaultStart) {
          exportDefaultStart = path.node.start;
        }
      }
    });

    // Build injected code
    let result = tsxContent;

    // Insert imports after existing imports
    if (importsToAdd.size > 0) {
      const importsCode = '\n' + Array.from(importsToAdd).join('\n') + '\n';
      result = result.slice(0, lastImportEnd) + importsCode + result.slice(lastImportEnd);
      exportDefaultStart += importsCode.length;
    }

    // Insert helpers before export default
    if (helpersToAdd.length > 0) {
      const helpersCode = '\n' + helpersToAdd.join('\n\n') + '\n';
      const insertPos = result.lastIndexOf('export default', exportDefaultStart);
      if (insertPos !== -1) {
        result = result.slice(0, insertPos) + helpersCode + result.slice(insertPos);
      }
    }

    return result;
  } catch (err) {
    console.error('   ⚠️  Error injecting helpers:', err.message);
    return tsxContent; // Return original on error
  }
}

/**
 * Extract props from component code (text, images, numbers)
 * Returns modified code with TypeScript interface + props
 */
async function extractPropsFromCode(sourceCode, componentName) {
  try {
    // Parse code
    const ast = babelParse(sourceCode, {
      sourceType: 'module',
      plugins: ['jsx', 'typescript']
    });

    // Run extract-props transform
    const context = { componentName };
    const stats = extractPropsExecute(ast, context);

    if (stats.skipped || stats.propsExtracted === 0) {
      return null; // No props to extract
    }

    // Generate code with interface prepended
    const result = generateDefault(ast, {
      retainLines: false,
      compact: false,
      comments: true
    });

    let finalCode = result.code;
    if (context.propsExtraction && context.propsExtraction.interface) {
      finalCode = context.propsExtraction.interface + finalCode;
    }

    return {
      code: finalCode,
      propsCount: stats.propsExtracted,
      byType: stats.byType
    };
  } catch (err) {
    console.error(`   ⚠️  Error extracting props: ${err.message}`);
    return null;
  }
}

// ═══════════════════════════════════════════════════════════════
// COMPONENT MERGER
// ═══════════════════════════════════════════════════════════════

async function mergeComponent(componentName, desktop, tablet, mobile, outputDir, breakpoints, helpersCache) {
  log.task('🔄', `Merging ${componentName}`);

  // 1. Read all 3 TSX files
  const desktopTSX = fs.readFileSync(
    path.join(desktop.componentsDir, `${componentName}.tsx`),
    'utf8'
  );
  const tabletTSX = fs.readFileSync(
    path.join(tablet.componentsDir, `${componentName}.tsx`),
    'utf8'
  );
  const mobileTSX = fs.readFileSync(
    path.join(mobile.componentsDir, `${componentName}.tsx`),
    'utf8'
  );

  // 2. Merge TSX with responsive classNames (using pipeline)
  const mergeResult = await mergeTSXStructure(desktopTSX, tabletTSX, mobileTSX, breakpoints);
  let mergedTSX = mergeResult.code;
  const transformStats = mergeResult.stats;

  // 3. Detect and inject helper functions if needed
  if (helpersCache && helpersCache.size > 0) {
    const usedHelpers = findUsedHelpers(mergedTSX, helpersCache);
    if (usedHelpers.size > 0) {
      mergedTSX = injectHelpersIntoComponent(mergedTSX, usedHelpers, helpersCache);
    }
  }

  // 4. Fix image import paths: "./img/" -> "../img/"
  mergedTSX = mergedTSX.replace(/from\s+["']\.\/img\//g, 'from "../img/');

  // 5. Save component WITHOUT props extraction
  // Props will be extracted only in dist/ via dist-generator.js (same as Process 1)
  fs.writeFileSync(
    path.join(outputDir, `${componentName}.tsx`),
    mergedTSX
  );

  // 6. Merge CSS with media queries
  const desktopCSS = readCSS(desktop.testDir, componentName);
  const tabletCSS = readCSS(tablet.testDir, componentName);
  const mobileCSS = readCSS(mobile.testDir, componentName);

  const responsiveCSS = mergeCSS(desktopCSS, tabletCSS, mobileCSS, componentName, breakpoints);

  fs.writeFileSync(
    path.join(outputDir, `${componentName}.css`),
    responsiveCSS
  );

  log.success(`${componentName}.tsx + .css (responsive)`);

  // Return transformation stats for metadata
  return transformStats;
}

// ═══════════════════════════════════════════════════════════════
// PAGE.TSX GENERATION (FROM COMPONENT-CLEAN.TSX)
// ═══════════════════════════════════════════════════════════════

/**
 * Map data-name attributes to component names
 */
const DATA_NAME_TO_COMPONENT = {
  'title section': 'Titlesection',
  'Account Overview': 'AccountOverview',
  'Quick actions': 'Quickactions',
  'Activity Section': 'ActivitySection',
  'header': 'Header',
  'Footer': 'Footer'
};

async function generatePage(components, desktop, tablet, mobile, outputDir, breakpoints) {
  console.log('\n📝 Generating Page.tsx from Component-clean.tsx (3 breakpoints)...');

  // Read all 3 Component-clean.tsx files
  const desktopPath = path.join(desktop.testDir, 'Component-clean.tsx');
  const tabletPath = path.join(tablet.testDir, 'Component-clean.tsx');
  const mobilePath = path.join(mobile.testDir, 'Component-clean.tsx');

  if (!fs.existsSync(desktopPath)) {
    console.error('   ❌ Desktop Component-clean.tsx not found, falling back to simple structure');
    generateSimplePage(components, outputDir);
    return;
  }

  const desktopTSX = fs.readFileSync(desktopPath, 'utf8');
  const tabletTSX = fs.existsSync(tabletPath) ? fs.readFileSync(tabletPath, 'utf8') : desktopTSX;
  const mobileTSX = fs.existsSync(mobilePath) ? fs.readFileSync(mobilePath, 'utf8') : tabletTSX;

  try {
    // Merge TSX structures with responsive classNames (using pipeline)
    const mergeResult = await mergeTSXStructure(desktopTSX, tabletTSX, mobileTSX, breakpoints);
    const mergedTSX = mergeResult.code;
    const pageStats = mergeResult.stats;

    // Parse the merged TSX file
    const ast = babelParse(mergedTSX, {
      sourceType: 'module',
      plugins: ['jsx', 'typescript']
    });

    const componentsToImport = new Set();

    // Traverse and replace div[data-name] with component calls
    traverseDefault(ast, {
      JSXElement(path) {
        const openingElement = path.node.openingElement;

        // Check if it's a div with data-name
        if (openingElement.name.type === 'JSXIdentifier' && openingElement.name.name === 'div') {
          const dataNameAttr = openingElement.attributes.find(
            attr => attr.type === 'JSXAttribute' &&
                    attr.name &&
                    attr.name.name === 'data-name' &&
                    attr.value &&
                    attr.value.type === 'StringLiteral'
          );

          if (dataNameAttr) {
            const dataName = dataNameAttr.value.value;
            const componentName = DATA_NAME_TO_COMPONENT[dataName];

            if (componentName && components.includes(componentName)) {
              // Replace div with component
              componentsToImport.add(componentName);

              // Create a simple JSXElement for the component
              path.replaceWith({
                type: 'JSXElement',
                openingElement: {
                  type: 'JSXOpeningElement',
                  name: { type: 'JSXIdentifier', name: componentName },
                  attributes: [],
                  selfClosing: true
                },
                closingElement: null,
                children: []
              });
            }
          }
        }

        // Also check for inline components like <Header />
        if (openingElement.name.type === 'JSXIdentifier') {
          const tagName = openingElement.name.name;
          if (components.includes(tagName)) {
            componentsToImport.add(tagName);
          }
        }
      }
    });

    // Generate code
    const output = generateDefault(ast, {
      retainLines: false,
      compact: false
    });

    // Add imports at the top (after React import)
    const imports = Array.from(componentsToImport)
      .map(name => `import ${name} from './components/${name}';`)
      .join('\n');

    let finalCode = output.code;

    // Replace the React import + CSS import with our imports
    finalCode = finalCode.replace(
      /import React from 'react';[\s\S]*?import '\.\/Component-clean\.css';/,
      `import React from 'react';\nimport './Page.css';\n${imports}`
    );

    // Remove all image imports (they're in subcomponents now)
    finalCode = finalCode.replace(/\/\/ Image imports[\s\S]*?(?=function|export)/m, '');

    // Remove inline component definitions (they're in Subcomponents/ now)
    // Match function ComponentName with TypeScript params and body (including nested braces)
    const componentNames = ['IconTansaction', 'Header', 'Footer', 'AccountOverview', 'ActivitySection', 'Quickactions', 'Titlesection'];
    componentNames.forEach(name => {
      // Match from 'function ComponentName' to the closing brace of the function
      // Using a simple approach: match function declaration + everything until next top-level function/export
      const pattern = new RegExp(`function\\s+${name}\\s*\\([\\s\\S]*?\\n\\}(?=\\s*(?:function|export|$))`, 'g');
      finalCode = finalCode.replace(pattern, '');
    });

    // Rename main component to Page and remove all props (components handle their own props)
    // Match: export default function ComponentName({ ...props }: PropsInterface)
    // Replace with: export default function Page()
    finalCode = finalCode.replace(
      /export default function \w+\([^)]*\)(?::\s*\w+Props)?/,
      'export default function Page()'
    );

    // Remove the Props interface as it's no longer needed (components have their own)
    finalCode = finalCode.replace(/interface \w+Props\s*\{[^}]*\}\s*\n*/g, '');

    // Clean up excessive blank lines
    finalCode = finalCode.replace(/\n{3,}/g, '\n\n');

    fs.writeFileSync(path.join(outputDir, 'Page.tsx'), finalCode);
    console.log('   ✅ Page.tsx generated with full structure');

    // Return transformation stats for metadata
    return pageStats;

  } catch (error) {
    console.error(`   ⚠️  Failed to parse Component-clean.tsx: ${error.message}`);
    console.log('   Falling back to simple structure');
    generateSimplePage(components, outputDir);
    return { error: error.message };
  }
}

/**
 * Fallback: Generate simple Page.tsx if Component-clean.tsx parsing fails
 */
function generateSimplePage(components, outputDir) {
  const imports = components
    .map(name => `import ${name} from './components/${name}';`)
    .join('\n');

  const jsxComponents = components
    .map(name => `      <${name} />`)
    .join('\n');

  const pageContent = `import React from 'react';
import './Page.css';
${imports}

export default function Page() {
  return (
    <>
${jsxComponents}
    </>
  );
}
`;

  fs.writeFileSync(path.join(outputDir, 'Page.tsx'), pageContent);
  console.log('   ✅ Page.tsx generated (simple structure)');
}

// ═══════════════════════════════════════════════════════════════
// PAGE.CSS GENERATION
// ═══════════════════════════════════════════════════════════════

function generatePageCSS(components, desktop, tablet, mobile, outputDir, breakpoints) {
  log.task('📝', 'Generating Page.css');

  // 1. Import all subcomponent CSS files
  const cssImports = components
    .map(name => `@import './components/${name}.css';`)
    .join('\n');

  // 2. Read Component-clean.css from all 3 breakpoints
  const desktopCSS = readComponentCSS(desktop.testDir);
  const tabletCSS = readComponentCSS(tablet.testDir);
  const mobileCSS = readComponentCSS(mobile.testDir);

  // 3. Extract parent container CSS (everything NOT in modular components)
  const desktopParentCSS = extractParentCSS(desktopCSS);
  const tabletParentCSS = extractParentCSS(tabletCSS);
  const mobileParentCSS = extractParentCSS(mobileCSS);

  // 4. Merge parent CSS with media queries
  const responsiveParentCSS = mergeCSS(
    desktopParentCSS,
    tabletParentCSS,
    mobileParentCSS,
    'Page (parent containers)',
    breakpoints
  );

  // 5. Compile responsive classes (max-md:*, max-lg:*) from ALL generated TSX files
  log.task('🎨', 'Compiling responsive classes to CSS');
  const compiledCSS = compileResponsiveClasses(outputDir);

  // 6. Combine imports + parent CSS + compiled responsive CSS
  const pageCSS = compiledCSS
    ? `/* Auto-generated Page.css */\n/* Component imports */\n${cssImports}\n\n${responsiveParentCSS}\n\n${compiledCSS}`
    : `/* Auto-generated Page.css */\n/* Component imports */\n${cssImports}\n\n${responsiveParentCSS}`;

  fs.writeFileSync(path.join(outputDir, 'Page.css'), pageCSS);
  log.success('Page.css generated with component imports + parent CSS + compiled responsive classes');
}

function readComponentCSS(testDir) {
  const cssPath = path.join(testDir, 'Component-clean.css');
  return fs.existsSync(cssPath) ? fs.readFileSync(cssPath, 'utf8') : '';
}

/**
 * Extract CSS for parent containers (global classes, not component-specific)
 * This includes classes like .bg-custom-fcfcfc, layout containers, etc.
 */
function extractParentCSS(css) {
  if (!css) return '';

  const sections = parseCSSIntoSections(css);

  // Return imports + root + utilities + custom classes
  // (The custom classes contain the parent container styles)
  let parentCSS = '';

  if (sections.imports) parentCSS += sections.imports + '\n\n';
  if (sections.root) parentCSS += sections.root + '\n\n';
  if (sections.utilities) parentCSS += sections.utilities + '\n\n';
  if (sections.customClasses) parentCSS += sections.customClasses;

  return parentCSS;
}

// ═══════════════════════════════════════════════════════════════
// IMAGE COPYING
// ═══════════════════════════════════════════════════════════════

/**
 * Copy images from Desktop test to merged output directory
 * @param {object} desktop - Desktop breakpoint data
 * @param {string} mergedDir - Merged output directory
 */
function copyImages(desktop, mergedDir) {
  const sourceImgDir = path.join(desktop.testDir, 'img');
  const targetImgDir = path.join(mergedDir, 'img');

  if (!fs.existsSync(sourceImgDir)) {
    console.log('   ⚠️  No img/ directory found in Desktop test, skipping image copy');
    return;
  }

  // Create target img directory
  fs.mkdirSync(targetImgDir, { recursive: true });

  // Copy all images
  const images = fs.readdirSync(sourceImgDir);
  let copiedCount = 0;

  for (const image of images) {
    const sourcePath = path.join(sourceImgDir, image);
    const targetPath = path.join(targetImgDir, image);

    // Only copy files (not directories)
    if (fs.statSync(sourcePath).isFile()) {
      fs.copyFileSync(sourcePath, targetPath);
      copiedCount++;
    }
  }

  console.log(`   ✅ Copied ${copiedCount} images to img/`);
}

// ═══════════════════════════════════════════════════════════════
// METADATA GENERATION
// ═══════════════════════════════════════════════════════════════

function generateMetadata(mergedDir, components, desktop, tablet, mobile, stats) {
  // Aggregate transformation statistics
  const transformationSummary = aggregateTransformationStats(stats.componentStats, stats.pageStats);

  const metadata = {
    timestamp: new Date().toISOString(),
    mergeId: path.basename(mergedDir),
    type: 'responsive-merge',
    breakpoints: {
      desktop: {
        testId: desktop.testId,
        screenSize: `${desktop.width}px`,
        width: desktop.width,
        height: desktop.height
      },
      tablet: {
        testId: tablet.testId,
        screenSize: `${tablet.width}px`,
        width: tablet.width,
        height: tablet.height
      },
      mobile: {
        testId: mobile.testId,
        screenSize: `${mobile.width}px`,
        width: mobile.width,
        height: mobile.height
      }
    },
    mediaQueries: {
      tablet: `@media (max-width: ${tablet.width}px)`,
      mobile: `@media (max-width: ${mobile.width}px)`
    },
    components: components,
    mainFile: 'Page.tsx',
    mergeStats: {
      successCount: stats.successCount,
      errorCount: stats.errorCount,
      totalComponents: stats.totalComponents
    },
    transformations: transformationSummary,
    detailedStats: {
      components: stats.componentStats,
      page: stats.pageStats
    }
  };

  fs.writeFileSync(
    path.join(mergedDir, 'responsive-metadata.json'),
    JSON.stringify(metadata, null, 2)
  );

  log.success('responsive-metadata.json generated\n');
}

/**
 * Aggregate transformation statistics from all components and page
 * Returns summary suitable for dashboard display
 */
function aggregateTransformationStats(componentStats = {}, pageStats = {}) {
  const summary = {
    totalElementsProcessed: 0,
    totalClassesMerged: 0,
    matchingStrategy: {
      byDataName: 0,
      byPosition: 0
    },
    conflicts: {
      elementsWithConflicts: 0,
      totalConflicts: 0
    },
    elementsMerged: 0,
    horizontalScrollAdded: 0,
    resetsApplied: 0,
    visibilityClassesInjected: 0,
    missingElements: []
  };

  // Aggregate component stats
  Object.values(componentStats).forEach(stats => {
    if (stats.error) return; // Skip components with errors

    // Detect-missing-elements
    if (stats['detect-missing-elements']) {
      summary.totalElementsProcessed += stats['detect-missing-elements'].elementsDetected || 0;
      const elements = stats['detect-missing-elements'].elements;
      if (elements) {
        // Handle both string and array formats
        if (typeof elements === 'string') {
          summary.missingElements.push(...elements.split(',').map(e => e.trim()).filter(Boolean));
        } else if (Array.isArray(elements)) {
          summary.missingElements.push(...elements);
        }
      }
    }

    // Normalize-identical-classes
    if (stats['normalize-identical-classes']) {
      summary.totalElementsProcessed += stats['normalize-identical-classes'].elementsProcessed || 0;
    }

    // Detect-class-conflicts
    if (stats['detect-class-conflicts']) {
      summary.conflicts.elementsWithConflicts += stats['detect-class-conflicts'].elementsWithConflicts || 0;
      summary.conflicts.totalConflicts += stats['detect-class-conflicts'].totalConflicts || 0;
      summary.matchingStrategy.byDataName += stats['detect-class-conflicts'].matchedByDataName || 0;
      summary.matchingStrategy.byPosition += stats['detect-class-conflicts'].matchedByPosition || 0;
    }

    // Merge-desktop-first
    if (stats['merge-desktop-first']) {
      summary.elementsMerged += stats['merge-desktop-first'].elementsMerged || 0;
      summary.totalClassesMerged += stats['merge-desktop-first'].totalClassesMerged || 0;
    }

    // Add-horizontal-scroll
    if (stats['add-horizontal-scroll']) {
      summary.horizontalScrollAdded += stats['add-horizontal-scroll'].parentsUpdated || 0;
    }

    // Reset-dependent-properties
    if (stats['reset-dependent-properties']) {
      summary.resetsApplied += stats['reset-dependent-properties'].totalResetsAdded || 0;
    }

    // Inject-visibility-classes
    if (stats['inject-visibility-classes']) {
      summary.visibilityClassesInjected += stats['inject-visibility-classes'].visibilityClassesInjected || 0;
    }
  });

  // Add page stats
  if (pageStats && !pageStats.error) {
    if (pageStats['detect-class-conflicts']) {
      summary.matchingStrategy.byDataName += pageStats['detect-class-conflicts'].matchedByDataName || 0;
      summary.matchingStrategy.byPosition += pageStats['detect-class-conflicts'].matchedByPosition || 0;
    }
    if (pageStats['merge-desktop-first']) {
      summary.elementsMerged += pageStats['merge-desktop-first'].elementsMerged || 0;
      summary.totalClassesMerged += pageStats['merge-desktop-first'].totalClassesMerged || 0;
    }
  }

  // Deduplicate missing elements
  summary.missingElements = [...new Set(summary.missingElements)];

  return summary;
}

// ═══════════════════════════════════════════════════════════════
// MAIN FUNCTION
// ═══════════════════════════════════════════════════════════════

async function mergeResponsive() {
  log.header('Responsive Merger - CSS-Pure Approach');
  log.divider();

  // 1. Parse CLI arguments (with breakpoint widths)
  const breakpoints = parseArguments();

  // 2. Validate breakpoints and read metadata
  const { desktop, tablet, mobile } = validateBreakpoints(breakpoints);

  // 3. Detect common components
  log.task('📊', 'Detecting common components');
  const commonComponents = detectCommonComponents(desktop, tablet, mobile);
  log.success(`Found ${commonComponents.length} common components\n`);

  // 4. Get component order from Desktop metadata.xml
  log.task('📋', 'Determining component order');
  const orderedComponents = await getComponentOrder(desktop.testDir, commonComponents);
  log.success(`Component order established\n`);

  // 5. Create output directory
  const timestamp = Date.now();
  const responsiveScreensDir = path.join(PROJECT_ROOT, 'src/generated/responsive-screens');
  const mergedDir = path.join(responsiveScreensDir, `responsive-merger-${timestamp}`);
  const componentsOutputDir = path.join(mergedDir, 'components');

  fs.mkdirSync(componentsOutputDir, { recursive: true });
  log.success(`Output directory: ${path.relative(PROJECT_ROOT, mergedDir)}\n`);

  // 6. Copy images from Desktop test
  log.task('📷', 'Copying images from Desktop test');
  copyImages(desktop, mergedDir);
  console.log();

  // 7. Extract helper functions from Desktop Component-clean.tsx
  log.phase('EXTRACTING HELPERS');
  const helpersCache = extractHelperFunctions(desktop.testDir, orderedComponents);

  if (helpersCache.size > 0) {
    log.success(`Found ${helpersCache.size} helper function(s): ${Array.from(helpersCache.keys()).join(', ')}`);
  } else {
    log.info('No helper functions found');
  }
  console.log();

  // 8. Merge each component
  log.phase('MERGING COMPONENTS');
  let successCount = 0;
  let errorCount = 0;
  const componentStats = {}; // Collect stats for each component

  const breakpointWidths = {
    desktop: desktop.width,
    tablet: tablet.width,
    mobile: mobile.width
  };

  for (const componentName of orderedComponents) {
    try {
      const stats = await mergeComponent(componentName, desktop, tablet, mobile, componentsOutputDir, breakpointWidths, helpersCache);
      componentStats[componentName] = stats;
      successCount++;
    } catch (error) {
      log.error(`Error merging ${componentName}: ${error.message}`);
      componentStats[componentName] = { error: error.message };
      errorCount++;
    }
  }

  console.log();

  // 9. Generate Page.tsx from Component-clean.tsx with responsive classNames
  log.phase('GENERATING PAGE FILES');
  const pageStats = await generatePage(orderedComponents, desktop, tablet, mobile, mergedDir, breakpointWidths);

  // 10. Generate Page.css with imports + parent CSS
  generatePageCSS(orderedComponents, desktop, tablet, mobile, mergedDir, breakpointWidths);

  // 11. Generate metadata with transformation statistics
  log.task('📄', 'Generating metadata');
  generateMetadata(mergedDir, orderedComponents, desktop, tablet, mobile, {
    successCount,
    errorCount,
    totalComponents: orderedComponents.length,
    componentStats,
    pageStats
  });

  // 12. Generate Puck-ready components
  log.phase('GENERATING PUCK COMPONENTS');
  try {
    // Extract actual component order from generated Page.tsx
    const pageTsxPath = path.join(mergedDir, 'Page.tsx');
    const pageTsxContent = fs.readFileSync(pageTsxPath, 'utf8');

    // Extract component usage order from JSX (e.g., <Titlesection />, <AccountOverview />)
    const componentMatches = [...pageTsxContent.matchAll(/<(\w+)\s*(?:className|\/)/g)];
    const actualOrder = componentMatches
      .map(m => m[1])
      .filter(name => orderedComponents.includes(name) && name !== 'div');

    // Remove duplicates while preserving order
    const uniqueActualOrder = [...new Set(actualOrder)];

    console.log(`🎨 Generating Puck components in actual Page.tsx order:\n`);
    uniqueActualOrder.forEach((name, idx) => console.log(`   ${idx + 1}. ${name}`));
    console.log('');

    const { generatePuckComponents } = await import('./puck-generator.js');
    await generatePuckComponents({
      sourceDir: componentsOutputDir,
      outputDir: path.join(mergedDir, 'puck'),
      imagesDir: path.join(mergedDir, 'img'),
      components: uniqueActualOrder
    });
    log.success('Puck components generated successfully\n');
  } catch (error) {
    log.error(`Error generating Puck components: ${error.message}`);
    console.error(error.stack);
  }

  // 13. Generate Visual Report
  log.phase('GENERATING VISUAL REPORT');
  try {
    const { execSync } = await import('child_process');
    const reportScriptPath = path.join(__dirname, 'reporting', 'generate-responsive-report.js');
    execSync(`node "${reportScriptPath}" "${mergedDir}"`, { stdio: 'inherit' });
    log.success('Visual report generated successfully\n');
  } catch (error) {
    log.error(`Error generating visual report: ${error.message}`);
  }

  // 14. Generate Technical Analysis
  log.phase('GENERATING TECHNICAL ANALYSIS');
  try {
    const { execSync } = await import('child_process');
    const analysisScriptPath = path.join(__dirname, 'reporting', 'generate-responsive-analysis.js');
    execSync(`node "${analysisScriptPath}" "${mergedDir}"`, { stdio: 'inherit' });
    log.success('Technical analysis generated successfully\n');
  } catch (error) {
    log.error(`Error generating technical analysis: ${error.message}`);
  }

  // 15. Generate dist/ package
  log.phase('GENERATING DEVELOPER-READY EXPORT');
  try {
    log.task('📦', 'Generating dist/ package');
    const { generateDist } = await import('./post-processing/dist-generator.js');
    await generateDist(mergedDir, {
      type: 'responsive',
      componentName: 'Page',
      breakpoints: {
        desktop: desktop.width,
        tablet: tablet.width,
        mobile: mobile.width
      }
    });
    log.success('dist/ package ready\n');
  } catch (error) {
    log.error(`Error generating dist/ package: ${error.message}`);
  }

  // 16. Summary
  console.log(`\n${colors.bright}${colors.bgGreen} ${colors.reset}`);
  console.log(`${colors.bright}${colors.green}┌${'─'.repeat(60)}┐${colors.reset}`);
  console.log(`${colors.bright}${colors.green}│  ✅ RESPONSIVE MERGE COMPLETE${' '.repeat(28)}│${colors.reset}`);
  console.log(`${colors.bright}${colors.green}└${'─'.repeat(60)}┘${colors.reset}\n`);

  console.log(`${colors.cyan}📊${colors.reset} ${colors.dim}Components:${colors.reset} ${colors.bright}${successCount}/${orderedComponents.length} merged${colors.reset}`);
  if (errorCount > 0) {
    console.log(`${colors.red}⚠️${colors.reset}  ${colors.dim}Errors:${colors.reset} ${colors.bright}${errorCount}${colors.reset}`);
  }
  console.log(`${colors.cyan}🎯${colors.reset} ${colors.dim}Breakpoints:${colors.reset} Desktop ${colors.bright}${desktop.width}px${colors.reset} | Tablet ${colors.bright}${tablet.width}px${colors.reset} | Mobile ${colors.bright}${mobile.width}px${colors.reset}`);
  console.log(`${colors.cyan}📁${colors.reset} ${colors.dim}Output:${colors.reset} ${colors.blue}${path.relative(PROJECT_ROOT, mergedDir)}${colors.reset}\n`);
}

// ═══════════════════════════════════════════════════════════════
// ENTRY POINT
// ═══════════════════════════════════════════════════════════════

mergeResponsive().catch(err => {
  console.error('\n❌ Fatal error:', err.message);
  console.error(err.stack);
  process.exit(1);
});
