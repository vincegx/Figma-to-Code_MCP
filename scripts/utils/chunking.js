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
 * Handles duplicate names by adding a numeric suffix
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
  const nameCount = new Map(); // Track name occurrences

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
        let nodeName = nameMatch[1];

        // Handle duplicate names
        if (nameCount.has(nodeName)) {
          const count = nameCount.get(nodeName) + 1;
          nameCount.set(nodeName, count);
          nodeName = `${nodeName}_${count}`;
        } else {
          nameCount.set(nodeName, 1);
        }

        childNodes.push({
          id: idMatch[1],
          name: nodeName
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
function assembleChunks(parentName, chunkFiles, testDir) {
  // Helper: Convert filename to valid PascalCase component name
  // Examples:
  //   "Frame 1618872337" → "Frame1618872337"
  //   "Group 1321314779" → "Group1321314779"
  //   "Appbar" → "Appbar"
  //   "123test" → "Chunk123test"
  const toPascalCase = (name) => {
    // Remove spaces and special chars, keep alphanumeric
    let cleaned = name.replace(/[^a-zA-Z0-9]/g, '');

    // If starts with number, prefix with "Chunk"
    if (/^\d/.test(cleaned)) {
      cleaned = 'Chunk' + cleaned;
    }

    // Ensure first letter is uppercase
    return cleaned.charAt(0).toUpperCase() + cleaned.slice(1);
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

  // Extract parent wrapper from parent-wrapper.tsx to preserve background/padding
  let wrapperDiv = '<div className="w-full">'; // fallback
  try {
    const parentWrapperPath = path.join(testDir, 'parent-wrapper.tsx');
    if (fs.existsSync(parentWrapperPath)) {
      const parentWrapper = fs.readFileSync(parentWrapperPath, 'utf-8');
      // Extract the opening div tag with all its classes and attributes (including multi-line)
      const divMatch = parentWrapper.match(/<div[\s\S]+?>/);
      if (divMatch) {
        wrapperDiv = divMatch[0];
        console.log(`   ✅ Using parent wrapper with all attributes (${wrapperDiv.length} chars)`);
      }
    }
  } catch (error) {
    console.log(`   ⚠️  Could not read parent wrapper, using default: ${error.message}`);
  }

  // Build final component with imports
  const finalCode = `${imports}

export default function ${parentName}() {
  return (
    ${wrapperDiv}
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

  const assembled = assembleChunks(parentName, chunkFiles, assembleTestDir);
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
