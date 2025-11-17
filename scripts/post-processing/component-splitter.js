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
 * Parse metadata.xml to build full hierarchy with levels + frameChildren + totalChildren
 * @returns Map<nodeId, { level, frameChildren, totalChildren, parent, name, type, isInstance, children }>
 */
function parseXMLHierarchy(xml) {
  const hierarchy = new Map();
  const lines = xml.split('\n');
  const stack = []; // Track parent chain

  for (const line of lines) {
    // Skip empty lines
    if (!line.trim()) continue;

    // Calculate level from indentation (2 spaces = 1 level)
    const indent = line.match(/^(\s*)/)[1].length;
    const level = indent / 2;

    // Extract tag type (frame, instance, text, etc.)
    const tagMatch = line.match(/<(\w+)\s/);
    if (!tagMatch) continue;

    const tagType = tagMatch[1];

    // Extract id and name
    const idMatch = line.match(/id="([^"]+)"/);
    const nameMatch = line.match(/name="([^"]+)"/);

    if (!idMatch || !nameMatch) continue;

    const nodeId = idMatch[1];
    const name = nameMatch[1];

    // Update stack (pop parents deeper than current level)
    while (stack.length > level) {
      stack.pop();
    }

    const parent = stack[stack.length - 1] || null;

    // Store node metadata
    hierarchy.set(nodeId, {
      level,
      name,
      type: tagType,
      isInstance: tagType === 'instance',
      parent: parent,
      frameChildren: 0, // Will be calculated in second pass
      totalChildren: 0, // Will be calculated in second pass
      children: []
    });

    // Add to parent's children list
    if (parent && hierarchy.has(parent)) {
      hierarchy.get(parent).children.push(nodeId);
    }

    // Push to stack if not self-closing tag
    if (!line.includes('/>')) {
      stack.push(nodeId);
    }
  }

  // Second pass: count totalChildren + frameChildren
  for (const [nodeId, node] of hierarchy.entries()) {
    // Count ALL children (frames + instances + text + etc.)
    node.totalChildren = node.children.length;

    // Count only frame children (for backward compatibility)
    node.frameChildren = node.children.filter(childId => {
      const child = hierarchy.get(childId);
      return child && child.type === 'frame';
    }).length;
  }

  return hierarchy;
}

/**
 * Parse metadata.xml to get Figma components (instances) + top-level frames + full hierarchy
 */
function parseFigmaComponents(testDir) {
  const metadataPath = path.join(testDir, 'metadata.xml');

  if (!fs.existsSync(metadataPath)) {
    return { instances: [], topLevelFrames: [], hierarchy: new Map() };
  }

  const xml = fs.readFileSync(metadataPath, 'utf8');

  // Parse full hierarchy
  const hierarchy = parseXMLHierarchy(xml);

  // Extract instances and top-level frames from hierarchy
  const instances = [];
  const topLevelFrames = [];

  for (const [nodeId, node] of hierarchy.entries()) {
    // Collect instances
    if (node.isInstance) {
      instances.push({
        nodeId: nodeId,
        name: node.name,
        type: 'instance'
      });
    }

    // Collect top-level frames (level 1)
    if (node.level === 1 && node.type === 'frame') {
      // Auto-rename generic "Frame XXXXXX" names
      let displayName = node.name;
      if (node.name.match(/^Frame\s+\d+$/)) {
        displayName = '__GENERIC_FRAME__';
      }

      topLevelFrames.push({
        nodeId: nodeId,
        name: node.name,
        displayName: displayName,
        type: 'top-level-frame'
      });
    }
  }

  return { instances, topLevelFrames, hierarchy };
}


/**
 * Main entry point
 */
export async function splitComponent(testDir) {
  // 1. Read files (use optimized version - already synchronized)
  const optimizedPath = path.join(testDir, 'Component-optimized.tsx');
  const cssPath = path.join(testDir, 'Component-optimized.css');

  if (!fs.existsSync(optimizedPath)) {
    throw new Error(`Component-optimized.tsx not found in ${testDir}`);
  }

  if (!fs.existsSync(cssPath)) {
    throw new Error(`Component-optimized.css not found in ${testDir}`);
  }

  const cleanCode = fs.readFileSync(optimizedPath, 'utf8');
  const globalCSS = fs.readFileSync(cssPath, 'utf8');

  // 2. Parse Figma components from metadata.xml (includes full hierarchy)
  const figmaComponents = parseFigmaComponents(testDir);

  // DEBUG: Log hierarchy
  console.log('\n📊 HIERARCHY DEBUG:');
  for (const [nodeId, node] of figmaComponents.hierarchy.entries()) {
    if (node.level <= 2) {
      console.log(`  ${nodeId}: "${node.name}" - L${node.level}, type=${node.type}, instance=${node.isInstance}, frameChildren=${node.frameChildren}, totalChildren=${node.totalChildren}`);
    }
  }

  // 3. Detect sections using hierarchy-based rules (R1-R8)
  const sections = detectSections(cleanCode, figmaComponents);

  // DEBUG: Log extracted sections
  console.log('\n✅ EXTRACTED SECTIONS:');
  sections.forEach(s => console.log(`  - ${s.name} (${s.nodeId}): "${s.originalName}"`));

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

    // Generate scoped CSS (include helper functions to extract all used classes)
    const fullJSX = section.jsx + '\n' + helperFunctions;
    const scopedCSS = generateScopedCSS(fullJSX, globalCSS);
    const cssSize = (scopedCSS.length / 1024).toFixed(1);

    fs.writeFileSync(
      path.join(componentsDir, `${chunkName}.css`),
      scopedCSS
    );

    // Track images
    imageManifest[chunkName] = Array.from(usedImages);
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

  // Return stats for CLI display
  return {
    componentsCount: sections.length,
    componentsDir
  };
}

/**
 * Detect sections using Figma data (hierarchy-based R1-R8 rules)
 */
function detectSections(tsxCode, figmaComponents) {
  const ast = parse(tsxCode, {
    sourceType: 'module',
    plugins: ['jsx', 'typescript']
  });

  const sections = [];
  const functionNames = new Set(); // Reserved for future use (helper function tracking)
  const extractedNodes = new Set(); // Track extracted nodeIds for R3

  // Apply hierarchy-based extraction rules (R1-R8)
  // No longer extract React functions automatically - they're handled by hierarchy or kept as helpers

  traverse.default(ast, {
    ReturnStatement(path) {
      const rootJSX = path.node.argument;
      if (!rootJSX) return;

      // Traverse JSX tree using hierarchy-based extraction rules
      function findSections(jsxNode) {
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

        // Check extraction rules (NEW: uses hierarchy-based R1-R8)
        const shouldExtractThisNode = dataName && nodeId && shouldExtract(dataName, nodeId, functionNames, figmaComponents, extractedNodes);

        if (shouldExtractThisNode) {
          // Extract this component
          let componentName = dataName;
          if (dataName.match(/^Frame\s+\d+$/)) {
            // Auto-rename generic "Frame XXXXXX" names
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

          // Track that this node is extracted (for R3: parent extracted check)
          extractedNodes.add(nodeId);

          // DON'T recurse into children - they're already included in this extracted section
          return;
        }

        // Only recurse through children if we DIDN'T extract this node
        if (jsxNode.children) {
          jsxNode.children.forEach(child => findSections(child));
        }
      }

      findSections(rootJSX);
    }
  });

  return sections;
}

/**
 * Determine if a section should be extracted (NEW: R1-R8 rules based on hierarchy)
 * @param {string} dataName - Current node's data-name
 * @param {string} nodeId - Current node's data-node-id
 * @param {Set} functionNames - Set of extracted function component names
 * @param {Object} figmaComponents - Parsed Figma metadata (with hierarchy Map)
 * @param {Set} extractedNodes - Set of already extracted nodeIds
 */
function shouldExtract(dataName, nodeId, functionNames, figmaComponents, extractedNodes) {
  // Skip if explicitly excluded
  if (EXCLUDE_PATTERNS.some(pattern => pattern.test(dataName))) {
    return false;
  }

  // Skip if duplicate of a function component (case-insensitive)
  if (functionNames.has(dataName.toLowerCase())) {
    return false;
  }

  // Get node from hierarchy
  const node = figmaComponents.hierarchy.get(nodeId);
  if (!node) return false;

  const { level, frameChildren, parent, type } = node;

  // ========================================
  // R1: Instances top-level (L1-L2 only)
  // ========================================
  if (node.isInstance && level >= 1 && level <= 2) {
    return true;
  }

  // ========================================
  // R2: Root (skip)
  // ========================================
  if (level === 0) {
    return false;
  }

  // ========================================
  // R3: Parent already extracted (avoid over-granularity)
  // ========================================
  if (parent && extractedNodes.has(parent)) {
    return false;
  }

  // ========================================
  // R4: Level 1 (top-level frames)
  // ========================================
  if (level === 1 && type === 'frame') {
    // Wrapper detection: 2+ frame children → descend to L2
    if (frameChildren >= 2) return false;
    // Semantic component: < 2 frame children → extract
    return true;
  }

  // ========================================
  // R5: Level 2 (children of L1 wrappers)
  // ========================================
  if (level === 2 && type === 'frame') {
    const parentNode = figmaComponents.hierarchy.get(parent);
    // If parent L1 is wrapper (frameChildren >= 2) → extract this L2
    if (parentNode && parentNode.level === 1 && parentNode.frameChildren >= 2) {
      return true;
    }
    return false;
  }

  // ========================================
  // R6: Level 3+ (max depth - atomic design limit)
  // ========================================
  if (level >= 3) {
    return false;
  }

  // ========================================
  // Fallback: Other cases → skip
  // ========================================
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
 * INCLUDES: TypeScript types/interfaces + function declarations
 * RECURSIVE: Extracts helpers used by other helpers
 */
function extractHelperFunctions(jsx, sourceCode) {
  // Parse source code once
  const ast = parse(sourceCode, {
    sourceType: 'module',
    plugins: ['jsx', 'typescript']
  });

  // STEP 1: Find all component calls in initial JSX
  const componentRegex = /<([A-Z]\w+)[\s/>]/g;
  const usedComponents = new Set();
  let match;

  while ((match = componentRegex.exec(jsx)) !== null) {
    usedComponents.add(match[1]);
  }

  if (usedComponents.size === 0) {
    return '';
  }

  // STEP 2: Recursively collect all nested helper components
  const allHelpers = new Set(usedComponents);
  const processed = new Set();

  function findNestedHelpers(componentName) {
    if (processed.has(componentName)) return;
    processed.add(componentName);

    // Find this component's function declaration
    traverse.default(ast, {
      FunctionDeclaration(path) {
        if (path.node.id?.name === componentName) {
          // Extract JSX from this function
          const functionCode = generate.default(path.node).code;

          // Find components used in this function
          const nestedRegex = /<([A-Z]\w+)[\s/>]/g;
          let nestedMatch;
          while ((nestedMatch = nestedRegex.exec(functionCode)) !== null) {
            const nestedComponent = nestedMatch[1];
            if (!allHelpers.has(nestedComponent)) {
              allHelpers.add(nestedComponent);
              findNestedHelpers(nestedComponent); // Recursive call
            }
          }
        }
      }
    });
  }

  // Start recursive collection
  for (const component of usedComponents) {
    findNestedHelpers(component);
  }

  const helperTypes = [];
  const helperFunctions = [];

  // STEP 3: Extract TypeScript types/interfaces for ALL helpers (including nested)
  traverse.default(ast, {
    TSTypeAliasDeclaration(path) {
      const typeName = path.node.id.name;
      if (typeName.endsWith('Props')) {
        const componentName = typeName.replace(/Props$/, '');
        if (allHelpers.has(componentName)) {
          const typeCode = generate.default(path.node).code;
          helperTypes.push(typeCode);
        }
      }
    },
    TSInterfaceDeclaration(path) {
      const interfaceName = path.node.id.name;
      if (interfaceName.endsWith('Props')) {
        const componentName = interfaceName.replace(/Props$/, '');
        if (allHelpers.has(componentName)) {
          const interfaceCode = generate.default(path.node).code;
          helperTypes.push(interfaceCode);
        }
      }
    }
  });

  // STEP 4: Extract ALL function declarations (including nested helpers)
  traverse.default(ast, {
    FunctionDeclaration(path) {
      const functionName = path.node.id?.name;
      if (functionName && allHelpers.has(functionName)) {
        const functionCode = generate.default(path.node).code;
        helperFunctions.push(functionCode);
      }
    }
  });

  // Combine types + functions in correct order
  const combined = [...helperTypes, ...helperFunctions];
  return combined.join('\n');
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

// Export utilities for reuse in responsive-merger.js
export {
  extractClassNames,
  parseCssSections,
  filterCSSClasses
};

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
