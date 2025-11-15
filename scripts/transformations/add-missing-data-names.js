import traverse from '@babel/traverse';
import * as t from '@babel/types';
import fs from 'fs';
import path from 'path';

export const meta = {
  name: 'add-missing-data-names',
  priority: 5
};

/**
 * Add missing data-name attributes from metadata.xml
 *
 * Problem: Figma MCP doesn't generate data-name for poorly named frames
 * Solution: Read metadata.xml and add data-name to elements that only have data-node-id
 *
 * Example:
 * Before:  <div data-node-id="1929:4456">
 * After:   <div data-name="Frame 427320661" data-node-id="1929:4456">
 */
export function execute(ast, context) {
  const stats = {
    dataNamesAdded: 0,
    executionTime: 0
  };

  const startTime = Date.now();

  // 1. Build node-id → name map from metadata.xml
  const nodeIdToNameMap = buildNodeIdMap(context);

  if (Object.keys(nodeIdToNameMap).length === 0) {
    console.log('   ⚠️  No metadata.xml found, skipping add-missing-data-names');
    stats.executionTime = Date.now() - startTime;
    return stats;
  }

  // 2. Traverse JSX and add missing data-name attributes
  traverse.default(ast, {
    JSXOpeningElement(path) {
      const attributes = path.node.attributes;

      // Check if element has data-node-id
      const nodeIdAttr = attributes.find(
        attr => attr.type === 'JSXAttribute' && attr.name?.name === 'data-node-id'
      );

      if (!nodeIdAttr) return;

      const nodeId = nodeIdAttr.value?.type === 'StringLiteral'
        ? nodeIdAttr.value.value
        : null;

      if (!nodeId) return;

      // Check if element already has data-name
      const hasDataName = attributes.some(
        attr => attr.type === 'JSXAttribute' && attr.name?.name === 'data-name'
      );

      if (hasDataName) return;

      // Lookup name from metadata.xml
      const name = nodeIdToNameMap[nodeId];

      if (!name) return;

      // Add data-name attribute
      const dataNameAttr = t.jsxAttribute(
        t.jsxIdentifier('data-name'),
        t.stringLiteral(name)
      );

      // Insert data-name BEFORE data-node-id (for readability)
      const nodeIdIndex = attributes.indexOf(nodeIdAttr);
      attributes.splice(nodeIdIndex, 0, dataNameAttr);

      stats.dataNamesAdded++;
    }
  });

  stats.executionTime = Date.now() - startTime;

  return stats;
}

/**
 * Build a map of node-id → name from metadata.xml
 */
function buildNodeIdMap(context) {
  const map = {};

  // Get metadata.xml path from context
  const metadataPath = context.metadataXmlPath || context.metadataPath || getMetadataPath(context.testDir || context.inputDir);

  if (!metadataPath || !fs.existsSync(metadataPath)) {
    return map;
  }

  const xml = fs.readFileSync(metadataPath, 'utf8');

  // Extract all elements with id and name attributes
  // Matches: <frame id="..." name="..."> or <instance id="..." name="..." />
  const elementRegex = /<(frame|instance|text|rounded-rectangle|vector|line)[^>]*id="([^"]+)"[^>]*name="([^"]+)"/g;
  let match;

  while ((match = elementRegex.exec(xml)) !== null) {
    const nodeId = match[2];
    const name = match[3];
    map[nodeId] = name;
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
