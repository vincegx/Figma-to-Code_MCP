/**
 * Missing Widths Transform
 *
 * Adds missing width constraints to elements that should have fixed widths.
 *
 * Problem: Figma "Hug content" elements export with shrink-0 but no width,
 *          causing them to expand instead of maintaining Figma's calculated size.
 *
 * Solution: Read metadata.xml to get the actual width from Figma and add it.
 *
 * Example:
 * Before:  <div className="shrink-0 flex" data-node-id="367:527">
 * After:   <div className="shrink-0 flex w-custom-840" data-node-id="367:527">
 *
 * Priority: 66 (after position-fixes, before stroke-alignment)
 */

import traverse from '@babel/traverse';
import * as t from '@babel/types';
import fs from 'fs';
import path from 'path';

export const meta = {
  name: 'missing-widths',
  priority: 66
};

/**
 * Check if className has a width property
 */
function hasWidth(className) {
  return /\b(w-(?:full|screen|fit|auto|min|max)|w-\[|w-custom-|basis-0|grow)/.test(className);
}

/**
 * Check if className has shrink-0
 */
function hasShrinkZero(className) {
  return /\bshrink-0\b/.test(className);
}

/**
 * Add missing widths from metadata.xml
 */
export function execute(ast, context) {
  const stats = {
    widthsAdded: 0,
    executionTime: 0
  };

  const startTime = Date.now();

  // 1. Build node-id → width map from metadata.xml
  const nodeIdToWidthMap = buildNodeIdWidthMap(context);

  if (Object.keys(nodeIdToWidthMap).length === 0) {
    // Skip silently if no metadata.xml (normal in reprocessing)
    stats.executionTime = Date.now() - startTime;
    return stats;
  }

  // 2. Initialize customCSSClasses Map if needed
  if (!context.customCSSClasses) {
    context.customCSSClasses = new Map();
  }

  // 3. Traverse JSX and add missing widths
  traverse.default(ast, {
    JSXOpeningElement(path) {
      const attributes = path.node.attributes;

      // Find className attribute
      const classNameAttr = attributes.find(
        attr => attr.type === 'JSXAttribute' && attr.name?.name === 'className'
      );

      if (!classNameAttr || classNameAttr.value?.type !== 'StringLiteral') {
        return;
      }

      const className = classNameAttr.value.value;

      // Skip if already has width or doesn't have shrink-0
      if (hasWidth(className) || !hasShrinkZero(className)) {
        return;
      }

      // Get data-node-id
      const nodeIdAttr = attributes.find(
        attr => attr.type === 'JSXAttribute' && attr.name?.name === 'data-node-id'
      );

      if (!nodeIdAttr) return;

      const nodeId = nodeIdAttr.value?.type === 'StringLiteral'
        ? nodeIdAttr.value.value
        : null;

      if (!nodeId) return;

      // Lookup width from metadata.xml
      const width = nodeIdToWidthMap[nodeId];

      if (!width) return;

      // Generate width class name
      const widthValue = parseFloat(width);
      const isInteger = widthValue % 1 === 0;
      const widthClass = isInteger
        ? `w-custom-${Math.round(widthValue)}`
        : `w-custom-${widthValue.toFixed(2).replace('.', 'dot')}`;

      // Add width class to className
      classNameAttr.value.value = `${className} ${widthClass}`;
      stats.widthsAdded++;

      // Add to customCSSClasses Map (only once per class)
      if (!context.customCSSClasses.has(widthClass)) {
        const cssValue = isInteger ? Math.round(widthValue) : widthValue.toFixed(2);
        context.customCSSClasses.set(widthClass, {
          type: 'dimension',
          property: 'width',
          value: `${cssValue}px`
        });
      }
    }
  });

  stats.executionTime = Date.now() - startTime;

  return stats;
}

/**
 * Build a map of node-id → width from metadata.xml
 */
function buildNodeIdWidthMap(context) {
  const map = {};

  // Get metadata.xml path from context
  const metadataPath = context.metadataXmlPath || context.metadataPath || getMetadataPath(context.testDir || context.inputDir);

  if (!metadataPath || !fs.existsSync(metadataPath)) {
    return map;
  }

  const xml = fs.readFileSync(metadataPath, 'utf8');

  // Extract all elements with id and width attributes
  // Matches: <frame id="..." width="..."> or <instance id="..." width="..." />
  const elementRegex = /<(frame|instance|text|rounded-rectangle|vector|line)[^>]*id="([^"]+)"[^>]*width="([^"]+)"/g;
  let match;

  while ((match = elementRegex.exec(xml)) !== null) {
    const nodeId = match[2];
    const width = match[3];
    map[nodeId] = width;
  }

  return map;
}

/**
 * Get metadata.xml path from testDir
 */
function getMetadataPath(testDir) {
  if (!testDir) return null;
  return path.join(testDir, 'metadata.xml');
}
