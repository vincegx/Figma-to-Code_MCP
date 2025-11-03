/**
 * Chunking Utilities for Large Figma Designs
 *
 * Usage:
 *   node mcp-direct-save.js extract-nodes <metadataXmlPath>       # Extract child nodes from XML
 *   node mcp-direct-save.js assemble-chunks <testDir> <parentName> <chunk1> <chunk2> ... # Assemble chunks
 */

import fs from 'fs';
import path from 'path';

// ═══════════════════════════════════════════════════════════════
// CHUNKING FUNCTIONS
// ═══════════════════════════════════════════════════════════════

/**
 * Extract child node IDs from metadata XML
 * Returns array of {id, name} objects for first-level children
 */
function extractChildNodes(xmlPath) {
  const xml = fs.readFileSync(xmlPath, 'utf8');
  const lines = xml.trim().split('\n');

  if (lines.length === 0) {
    return [];
  }

  // First line is the root node
  const rootLine = lines[0];
  const rootIndent = rootLine.match(/^\s*/)[0].length;

  const childNodes = [];

  // Find all direct children (indent = rootIndent + 2)
  const childIndent = rootIndent + 2;

  for (let i = 1; i < lines.length; i++) {
    const line = lines[i];
    const currentIndent = line.match(/^\s*/)[0].length;

    // Only process direct children
    if (currentIndent === childIndent) {
      const idMatch = line.match(/id="([^"]+)"/);
      const nameMatch = line.match(/name="([^"]+)"/);

      if (idMatch && nameMatch) {
        childNodes.push({
          id: idMatch[1],
          name: nameMatch[1]
        });
      }
    }
  }

  return childNodes;
}

/**
 * Assemble multiple chunk components into one parent component
 * Generates Component.tsx with imports to chunks (not inline fusion)
 */
function assembleChunks(parentName, chunkFiles) {
  // Helper: Convert filename to PascalCase component name (banner1 → Banner1)
  const toPascalCase = (name) => {
    return name.charAt(0).toUpperCase() + name.slice(1)
  }

  const chunks = chunkFiles.map(file => ({
    fileName: path.basename(file, '.tsx'),
    path: file
  }));

  // Generate import statements for each chunk
  const imports = chunks.map(chunk =>
    `import ${toPascalCase(chunk.fileName)} from './chunks/${chunk.fileName}';`
  ).join('\n');

  // Generate JSX with chunk components
  const componentCalls = chunks.map(chunk =>
    `      <${toPascalCase(chunk.fileName)} />`
  ).join('\n');

  // Build final component with imports
  const finalCode = `${imports}

export default function ${parentName}() {
  return (
    <div className="w-full">
${componentCalls}
    </div>
  );
}
`;

  return finalCode;
}

// ═══════════════════════════════════════════════════════════════
// MAIN SCRIPT
// ═══════════════════════════════════════════════════════════════

const mode = process.argv[2];

// Handle different modes
if (mode === 'extract-nodes') {
  const xmlPath = process.argv[3];
  if (!xmlPath) {
    console.error('Usage: node mcp-direct-save.js extract-nodes <metadataXmlPath>');
    process.exit(1);
  }

  const nodes = extractChildNodes(xmlPath);
  console.log(JSON.stringify(nodes, null, 2));
  process.exit(0);
}

if (mode === 'assemble-chunks') {
  const assembleTestDir = process.argv[3];
  const parentName = process.argv[4];
  const chunkFiles = process.argv.slice(5);

  if (!assembleTestDir || !parentName || chunkFiles.length === 0) {
    console.error('Usage: node mcp-direct-save.js assemble-chunks <testDir> <parentName> <chunk1> <chunk2> ...');
    process.exit(1);
  }

  const assembled = assembleChunks(parentName, chunkFiles);
  const outputPath = path.join(assembleTestDir, 'Component.tsx');
  fs.writeFileSync(outputPath, assembled, 'utf8');

  console.log(JSON.stringify({
    success: true,
    file: outputPath,
    chunks: chunkFiles.length
  }));
  process.exit(0);
}

console.error('Usage: node mcp-direct-save.js extract-nodes <metadataXmlPath>');
console.error('   or: node mcp-direct-save.js assemble-chunks <testDir> <parentName> <chunk1> <chunk2> ...');
process.exit(1);
