import traverse from '@babel/traverse';

const traverseDefault = traverse.default || traverse;

export const meta = {
  name: 'detect-missing-elements',
  priority: 10,
  description: 'Detect elements present in Desktop/Tablet but missing in Mobile (e.g., help menu)'
};

/**
 * Collect all data-name attributes from an AST
 * @param {object} ast - Babel AST
 * @returns {Set<string>} Set of data-name values
 */
function collectDataNames(ast) {
  const dataNames = new Set();

  traverseDefault(ast, {
    JSXElement(path) {
      const dataNameAttr = path.node.openingElement.attributes.find(
        attr => attr.type === 'JSXAttribute' && attr.name?.name === 'data-name'
      );

      if (dataNameAttr && dataNameAttr.value?.value) {
        dataNames.add(dataNameAttr.value.value);
      }
    }
  });

  return dataNames;
}

/**
 * Detect Missing Elements Transformation
 *
 * Identifies elements that exist in Desktop and Tablet versions but are
 * intentionally absent in the Mobile version (e.g., help menu for space constraints).
 *
 * Results are stored in context.missingInMobile for use by later transformations.
 *
 * @param {object} context - Pipeline context
 * @param {object} context.desktopAST - Desktop AST
 * @param {object} context.tabletAST - Tablet AST
 * @param {object} context.mobileAST - Mobile AST
 * @returns {object} Statistics about detected missing elements
 */
export function execute(context) {
  const { desktopAST, tabletAST, mobileAST } = context;

  // Collect all data-name attributes from each version
  const desktopElements = collectDataNames(desktopAST);
  const tabletElements = collectDataNames(tabletAST);
  const mobileElements = collectDataNames(mobileAST);

  // Find elements present in Desktop AND Tablet but absent in Mobile
  const missingInMobile = new Set();

  for (const dataName of desktopElements) {
    // Element must be in both Desktop and Tablet but NOT in Mobile
    if (tabletElements.has(dataName) && !mobileElements.has(dataName)) {
      missingInMobile.add(dataName);
    }
  }

  // Find elements present in Desktop AND Mobile but absent in Tablet
  const missingInTablet = new Set();

  for (const dataName of desktopElements) {
    // Element must be in both Desktop and Mobile but NOT in Tablet
    if (!tabletElements.has(dataName) && mobileElements.has(dataName)) {
      missingInTablet.add(dataName);
    }
  }

  // Store in context for later transformations
  context.missingInMobile = missingInMobile;
  context.missingInTablet = missingInTablet;

  return {
    elementsDetected: missingInMobile.size,
    elements: Array.from(missingInMobile),
    elementsInTablet: missingInTablet.size,
    tabletElements: Array.from(missingInTablet)
  };
}
