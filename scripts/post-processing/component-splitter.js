#!/usr/bin/env node
/**
 * Component Splitter - PHASE 1: Responsive Workflow
 *
 * Splits Component-clean.tsx into modular chunks for responsive merging
 *
 * Strategy:
 * - Generic detection rules (not hardcoded whitelist)
 * - Scoped CSS: Extract only classes used by each component
 * - Image tracking: Generate manifest + relative imports (no duplication)
 *
 * Rules:
 * 1. Extract React function components (except main component)
 * 2. Extract direct children of "Container"
 * 3. Extract semantic sections (header, footer, *section, *overview, *actions)
 *
 * Usage:
 *   node component-splitter.js <testDir>
 *
 * Example:
 *   node component-splitter.js src/generated/export_figma/node-6055-2436-1762733564
 *
 * Output:
 *   testDir/modular/
 *   ├── Header.tsx + .css
 *   ├── TitleSection.tsx + .css
 *   ├── AccountOverview.tsx + .css
 *   ├── QuickActions.tsx + .css
 *   ├── ActivitySection.tsx + .css
 *   ├── Footer.tsx + .css
 *   └── image-manifest.json
 */

import fs from 'fs';
import path from 'path';
import { parse } from '@babel/parser';
import traverse from '@babel/traverse';
import generate from '@babel/generator';
import { toPascalCase } from '../utils/chunking.js';

/**
 * Patterns to exclude (too granular or utility sections)
 */
const EXCLUDE_PATTERNS = [
  /^card\//i,       // card/actions, card/transaction (too granular)
  /^copyright$/i,   // Copyright (part of Footer)
  /^socials$/i,     // Socials (part of Footer)
  /^icon[\/\s]/i,   // Icon/chevron-up, Icon Corner Left (icons are too small)
];

/**
 * Parse metadata.xml to get Figma components (instances) + top-level frames
 */
function parseFigmaComponents(testDir) {
  const metadataPath = path.join(testDir, 'metadata.xml');

  if (!fs.existsSync(metadataPath)) {
    return { instances: [], topLevelFrames: [] };
  }

  const xml = fs.readFileSync(metadataPath, 'utf8');
  const instances = [];
  const topLevelFrames = [];

  // Extract <instance id="..." name="..." /> elements (Figma components)
  const instanceRegex = /<instance[^>]*id="([^"]+)"[^>]*name="([^"]+)"[^>]*\/>/g;
  let match;

  while ((match = instanceRegex.exec(xml)) !== null) {
    instances.push({
      nodeId: match[1],
      name: match[2],
      type: 'instance'
    });
  }

  // Extract top-level <frame> elements (direct children of root)
  // Pattern: ^  <frame (2 spaces = level 1)
  const topLevelFrameRegex = /^  <frame id="([^"]+)" name="([^"]+)"/gm;

  while ((match = topLevelFrameRegex.exec(xml)) !== null) {
    const frameName = match[2];

    // Auto-rename generic "Frame XXXXXX" names
    let displayName = frameName;
    if (frameName.match(/^Frame\s+\d+$/)) {
      // Will be renamed later with section index
      displayName = '__GENERIC_FRAME__';
    }

    topLevelFrames.push({
      nodeId: match[1],
      name: frameName,        // Original name
      displayName: displayName, // Name for component generation
      type: 'top-level-frame'
    });
  }

  return { instances, topLevelFrames };
}

/**
 * Main entry point
 */
export async function splitComponent(testDir) {
  console.log('🔪 Splitting Component-optimized.tsx into components...\n');

  // 1. Read files (use optimized version - already synchronized)
  const optimizedPath = path.join(testDir, 'Component-optimized.tsx');
  const cssPath = path.join(testDir, 'Component-optimized.css');

  if (!fs.existsSync(optimizedPath)) {
    console.error(`❌ Error: Component-optimized.tsx not found in ${testDir}`);
    return;
  }

  if (!fs.existsSync(cssPath)) {
    console.error(`❌ Error: Component-optimized.css not found in ${testDir}`);
    return;
  }

  const cleanCode = fs.readFileSync(optimizedPath, 'utf8');
  const globalCSS = fs.readFileSync(cssPath, 'utf8');

  // 2. Parse Figma components from metadata.xml
  const figmaComponents = parseFigmaComponents(testDir);

  // 3. Detect sections using Figma data
  const sections = detectSections(cleanCode, figmaComponents);

  console.log(`   Found ${sections.length} sections:\n`);
  sections.forEach(s => console.log(`     - ${s.name} (${s.type})`));

  // 3. Create components/ directory
  const componentsDir = path.join(testDir, 'components');
  if (!fs.existsSync(componentsDir)) {
    fs.mkdirSync(componentsDir, { recursive: true });
  }

  // 4. Extract global imports
  const globalImports = extractImageImports(cleanCode);

  // 5. Generate chunks
  const imageManifest = {};

  for (const section of sections) {
    const chunkName = section.name;  // Already in PascalCase

    // Generate TSX
    const usedImages = extractUsedImages(section.jsx);

    // Extract helper functions used in this section
    const helperFunctions = extractHelperFunctions(section.jsx, cleanCode);

    // Extract images from helper functions too
    const helperImages = extractUsedImages(helperFunctions);
    const allUsedImages = new Set([...usedImages, ...helperImages]);

    const chunkImports = filterImports(globalImports, allUsedImages);

    const chunkCode = generateChunkCode(chunkName, section.jsx, chunkImports, helperFunctions);

    fs.writeFileSync(
      path.join(componentsDir, `${chunkName}.tsx`),
      chunkCode
    );

    // Generate scoped CSS
    const scopedCSS = generateScopedCSS(section.jsx, globalCSS);
    const cssSize = (scopedCSS.length / 1024).toFixed(1);

    fs.writeFileSync(
      path.join(componentsDir, `${chunkName}.css`),
      scopedCSS
    );

    // Track images
    imageManifest[chunkName] = Array.from(usedImages);

    console.log(`   ✅ ${chunkName}.tsx + .css (${cssSize}KB CSS)`);
  }

  // 6. Write image manifest
  fs.writeFileSync(
    path.join(componentsDir, 'image-manifest.json'),
    JSON.stringify(imageManifest, null, 2)
  );

  // 7. Write component mapping (node-id → component name) for dist-generator
  const componentMapping = {};
  for (const section of sections) {
    if (section.nodeId) {
      componentMapping[section.nodeId] = section.name;
    }
  }

  fs.writeFileSync(
    path.join(componentsDir, 'component-mapping.json'),
    JSON.stringify(componentMapping, null, 2)
  );

  console.log(`\n✅ Splitting complete: ${sections.length} chunks created`);
  console.log(`📁 Output: ${componentsDir}\n`);
}

/**
 * Extract parent component name from Component-clean.tsx
 */
function getParentComponentName(tsxCode) {
  const match = tsxCode.match(/export default function (\w+)\(\)/);
  return match ? match[1] : null;
}

/**
 * Detect sections using Figma data
 */
function detectSections(tsxCode, figmaComponents) {
  const ast = parse(tsxCode, {
    sourceType: 'module',
    plugins: ['jsx', 'typescript']
  });

  const sections = [];
  const functionNames = new Set();

  // Get parent component name (to skip it)
  const parentComponentName = getParentComponentName(tsxCode);

  // Rule 1: Detect React function components (except main component and utility components)
  traverse.default(ast, {
    FunctionDeclaration(path) {
      const functionName = path.node.id?.name;
      if (!functionName) return;

      // Skip parent component (detected from export default)
      if (parentComponentName && functionName === parentComponentName) return;

      // Skip utility components (Icon*, etc.)
      if (functionName.match(/^Icon[A-Z]/)) return;

      // Track function names to avoid duplicates
      functionNames.add(functionName.toLowerCase());

      sections.push({
        name: functionName,
        type: 'function',
        jsx: generate.default(path.node).code
      });
    }
  });

  // Rules 2 & 3: Detect inline sections with data-name
  const extractedSections = new Set();

  traverse.default(ast, {
    ReturnStatement(path) {
      const rootJSX = path.node.argument;
      if (!rootJSX) return;

      // Traverse JSX tree with parent tracking
      function findSections(jsxNode, parentName = null) {
        if (!jsxNode || jsxNode.type !== 'JSXElement') return;

        // Get data-name attribute
        const dataNameAttr = jsxNode.openingElement?.attributes?.find(
          attr => attr.type === 'JSXAttribute' && attr.name?.name === 'data-name'
        );

        const dataName = dataNameAttr?.value?.type === 'StringLiteral'
          ? dataNameAttr.value.value
          : null;

        // Get data-node-id attribute
        const nodeIdAttr = jsxNode.openingElement?.attributes?.find(
          attr => attr.type === 'JSXAttribute' && attr.name?.name === 'data-node-id'
        );

        const nodeId = nodeIdAttr?.value?.type === 'StringLiteral'
          ? nodeIdAttr.value.value
          : null;

        // Check extraction rules
        if (dataName && nodeId && shouldExtract(dataName, nodeId, parentName, functionNames, extractedSections, figmaComponents)) {
          // Auto-rename generic "Frame XXXXXX" names
          let componentName = dataName;
          if (dataName.match(/^Frame\s+\d+$/)) {
            // Find the section index (how many sections extracted so far)
            const sectionIndex = sections.filter(s => s.type === 'inline').length + 1;
            componentName = `Section${sectionIndex}`;
          }

          // Convert to PascalCase (same as file name)
          let pascalName = toPascalCase(componentName);

          // Handle duplicates by adding suffix
          let counter = 2;
          while (sections.find(s => s.name === pascalName)) {
            pascalName = `${toPascalCase(componentName)}${counter}`;
            counter++;
          }

          sections.push({
            name: pascalName,  // Store PascalCase name (matches file name)
            type: 'inline',
            jsx: generate.default(jsxNode).code,
            nodeId: nodeId,  // Store nodeId for mapping
            originalName: dataName  // Store original Figma name for reference
          });

          // Track that this section is extracted (to skip its children)
          extractedSections.add(dataName);
        }

        // Recurse through children
        if (jsxNode.children) {
          jsxNode.children.forEach(child => findSections(child, dataName));
        }
      }

      findSections(rootJSX);
    }
  });

  return sections;
}

/**
 * Determine if a section should be extracted
 */
function shouldExtract(dataName, nodeId, parentName, functionNames, extractedSections, figmaComponents) {
  // Skip if explicitly excluded
  if (EXCLUDE_PATTERNS.some(pattern => pattern.test(dataName))) {
    return false;
  }

  // Skip if parent is already extracted (avoid over-granularity)
  // Ex: If "Footer" is extracted, skip "Copyright" and "Socials"
  if (parentName && extractedSections.has(parentName)) {
    return false;
  }

  // Skip if duplicate of a function component (case-insensitive)
  // Ex: If function "Header" exists, skip inline "header"
  if (functionNames.has(dataName.toLowerCase())) {
    return false;
  }

  // Rule 2: Direct children of "Container"
  if (parentName === 'Container') {
    return true;
  }

  // Rule 3: Match exact Figma component (instance) by node-id
  if (figmaComponents.instances.some(comp => comp.nodeId === nodeId && comp.name === dataName)) {
    return true;
  }

  // Rule 4: Top-level frames (fallback for poorly organized Figma files)
  // Extract all direct children of root (level 1 frames)
  if (figmaComponents.topLevelFrames.some(frame => frame.nodeId === nodeId)) {
    return true;
  }

  return false;
}

/**
 * Extract all image imports from source code
 */
function extractImageImports(sourceCode) {
  const imports = [];
  const importRegex = /import\s+(\w+)\s+from\s+["']\.\/img\/([^"']+)["'];?/g;
  let match;

  while ((match = importRegex.exec(sourceCode)) !== null) {
    imports.push({
      varName: match[1],
      fileName: match[2],
      statement: match[0]
    });
  }

  return imports;
}

/**
 * Extract image variable names used in JSX
 */
function extractUsedImages(jsx) {
  const usedImages = new Set();

  // Pattern 1: src={imgVariableName}
  const srcRegex = /src=\{(\w+)\}/g;
  let match;

  while ((match = srcRegex.exec(jsx)) !== null) {
    usedImages.add(match[1]);
  }

  // Pattern 2: maskImage: url('${imgVariableName}')
  // Pattern 3: backgroundImage: url('${imgVariableName}')
  const urlRegex = /url\(['"`]\$\{(\w+)\}['"`]\)/g;

  while ((match = urlRegex.exec(jsx)) !== null) {
    usedImages.add(match[1]);
  }

  // Pattern 4: Any variable reference in template literal within style
  // style={{ maskImage: `url('${imgVar}')`, backgroundImage: `url('${imgVar2}')` }}
  const styleTemplateRegex = /\$\{(\w+)\}/g;

  while ((match = styleTemplateRegex.exec(jsx)) !== null) {
    // Only add if it looks like an image variable (starts with 'img' or contains 'image')
    const varName = match[1];
    if (varName.startsWith('img') ||
        varName.toLowerCase().includes('image') ||
        varName.toLowerCase().includes('icon') ||
        varName.toLowerCase().includes('logo') ||
        varName.toLowerCase().includes('picture')) {
      usedImages.add(varName);
    }
  }

  return usedImages;
}

/**
 * Extract helper functions used in JSX from source code
 */
function extractHelperFunctions(jsx, sourceCode) {
  // Find all component calls in JSX: <ComponentName ...>
  const componentRegex = /<([A-Z]\w+)[\s/>]/g;
  const usedComponents = new Set();
  let match;

  while ((match = componentRegex.exec(jsx)) !== null) {
    usedComponents.add(match[1]);
  }

  if (usedComponents.size === 0) {
    return '';
  }

  // Parse source code to find function definitions
  const ast = parse(sourceCode, {
    sourceType: 'module',
    plugins: ['jsx', 'typescript']
  });

  const helperFunctions = [];

  traverse.default(ast, {
    FunctionDeclaration(path) {
      const functionName = path.node.id?.name;
      if (functionName && usedComponents.has(functionName)) {
        // Generate the function code
        const functionCode = generate.default(path.node).code;
        helperFunctions.push(functionCode);
      }
    }
  });

  return helperFunctions.join('\n\n');
}

/**
 * Filter imports to only include used images (Option B: relative imports)
 */
function filterImports(globalImports, usedImages) {
  return globalImports
    .filter(imp => usedImages.has(imp.varName))
    .map(imp => imp.statement)
    .join('\n');
}

/**
 * Generate chunk TSX code
 */
function generateChunkCode(chunkName, jsx, imageImports, helperFunctions = '') {
  // Add comment before helpers if present
  const helpersWithComment = helperFunctions
    ? `\n// ========================================\n// Helper Components\n// ========================================\n\n${helperFunctions}\n\n`
    : '';

  // For function components, jsx already contains full function declaration
  if (jsx.startsWith('function ') || jsx.startsWith('export function')) {
    // Extract function body and make it default export
    const funcCode = jsx.replace(/^function\s+/, 'export default function ');

    return `/**
 * ${chunkName} Component
 * Generated from Figma design
 */
import React from 'react';
import './${chunkName}.css';
${imageImports ? imageImports + '\n' : ''}${helpersWithComment}// ========================================
// Main Component
// ========================================

${funcCode}
`;
  }

  // For inline sections, wrap in function
  return `/**
 * ${chunkName} Component
 * Generated from Figma design
 */
import React from 'react';
import './${chunkName}.css';
${imageImports ? imageImports + '\n' : ''}${helpersWithComment}// ========================================
// Main Component
// ========================================

export default function ${chunkName}() {
  return ${jsx};
}
`;
}

/**
 * Generate scoped CSS for a chunk
 */
function generateScopedCSS(chunkJSX, globalCSS) {
  // 1. Extract all classes used in chunk
  const usedClasses = extractClassNames(chunkJSX);

  // 2. Parse global CSS into sections
  const cssSections = parseCssSections(globalCSS);

  // 3. Build scoped CSS
  let scopedCSS = '/* Auto-generated scoped CSS */\n';

  // Always include imports (Google Fonts)
  if (cssSections.imports) {
    scopedCSS += cssSections.imports + '\n\n';
  }

  // Always include :root variables (design tokens)
  if (cssSections.root) {
    scopedCSS += cssSections.root + '\n\n';
  }

  // Always include Figma utilities
  if (cssSections.utilities) {
    scopedCSS += cssSections.utilities + '\n\n';
  }

  // Filter custom classes (only used ones)
  scopedCSS += filterCSSClasses(cssSections.customClasses, usedClasses);

  return scopedCSS;
}

/**
 * Extract class names from JSX code
 */
function extractClassNames(jsx) {
  const classes = new Set();
  const classNameRegex = /className="([^"]+)"/g;
  let match;

  while ((match = classNameRegex.exec(jsx)) !== null) {
    match[1].split(/\s+/).forEach(cls => {
      if (cls) classes.add(cls);
    });
  }

  return classes;
}

/**
 * Parse CSS into logical sections
 */
function parseCssSections(css) {
  const sections = {
    imports: '',
    root: '',
    utilities: '',
    customClasses: ''
  };

  const lines = css.split('\n');
  let currentSection = null;
  let buffer = [];
  let braceDepth = 0;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];

    // Detect @import
    if (line.startsWith('@import')) {
      sections.imports += line + '\n';
      continue;
    }

    // Detect :root
    if (line.startsWith(':root')) {
      currentSection = 'root';
      buffer = [line];
      // Count braces in the initial line (e.g., ":root {" has 1 opening brace)
      braceDepth = (line.match(/\{/g) || []).length - (line.match(/\}/g) || []).length;
      continue;
    }

    // Detect Figma utilities comment
    if (line.includes('Figma-specific utility classes')) {
      currentSection = 'utilities';
      buffer = [line];
      braceDepth = (line.match(/\{/g) || []).length - (line.match(/\}/g) || []).length;
      continue;
    }

    // Detect custom classes section (starts with /* ===== 3. or higher)
    if (line.match(/\/\* ===== [3-9]\./)) {
      // If already in customClasses section, just add the line (don't reinitialize)
      if (currentSection === 'customClasses') {
        buffer.push(line);
      } else {
        currentSection = 'customClasses';
        buffer = [line];
      }
      braceDepth = (line.match(/\{/g) || []).length - (line.match(/\}/g) || []).length;
      continue;
    }

    // Buffer content
    if (currentSection) {
      buffer.push(line);

      // Track brace depth
      braceDepth += (line.match(/\{/g) || []).length;
      braceDepth -= (line.match(/\}/g) || []).length;

      // Check for section end (only for non-customClasses sections)
      if (braceDepth === 0 && buffer.length > 1 && currentSection !== 'customClasses') {
        sections[currentSection] += buffer.join('\n') + '\n';
        buffer = [];
        currentSection = null;
      }
    }
  }

  // Flush remaining buffer (for customClasses section)
  if (currentSection && buffer.length > 0) {
    sections[currentSection] += buffer.join('\n');
  }

  return sections;
}

/**
 * Filter CSS classes to only include used ones
 */
function filterCSSClasses(cssContent, usedClasses) {
  if (!cssContent) return '';

  const lines = cssContent.split('\n');
  let filteredLines = [];
  let currentRule = [];
  let keepCurrentRule = false;

  for (const line of lines) {
    // Detect class definition: .className {
    // Updated regex to capture all class names (including "dot", "rgba", etc.)
    const classMatch = line.match(/^\.([a-zA-Z0-9_-]+)\s*\{/);

    if (classMatch) {
      // Save previous rule if needed
      if (keepCurrentRule && currentRule.length > 0) {
        filteredLines.push(...currentRule);
      }

      // Start new rule
      const className = classMatch[1];
      keepCurrentRule = usedClasses.has(className);
      currentRule = [line];
    } else if (line.includes('}') && currentRule.length > 0) {
      // End of rule
      currentRule.push(line);
      if (keepCurrentRule) {
        filteredLines.push(...currentRule);
      }
      currentRule = [];
    } else if (currentRule.length > 0) {
      // Inside rule
      currentRule.push(line);
    } else {
      // Keep comments and section headers
      if (line.startsWith('/*') || line.trim() === '') {
        filteredLines.push(line);
      }
    }
  }

  // Save any remaining buffer (last rule in file)
  if (keepCurrentRule && currentRule.length > 0) {
    filteredLines.push(...currentRule);
  }

  return filteredLines.join('\n');
}

// CLI support
if (import.meta.url === `file://${process.argv[1]}`) {
  const testDir = process.argv[2];

  if (!testDir) {
    console.error('Usage: node component-splitter.js <testDir>');
    console.error('Example: node component-splitter.js src/generated/export_figma/node-6055-2436-1762733564');
    process.exit(1);
  }

  splitComponent(testDir)
    .then(() => process.exit(0))
    .catch(err => {
      console.error('❌ Error:', err.message);
      console.error(err.stack);
      process.exit(1);
    });
}
