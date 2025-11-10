import traverse from '@babel/traverse';

const traverseDefault = traverse.default || traverse;

export const meta = {
  name: 'normalize-identical-classes',
  priority: 20,
  description: 'Identify classes that are identical across all 3 breakpoints (should be base classes)'
};

/**
 * Extract className value from JSX element
 * @param {object} jsxElement - Babel JSX element node
 * @returns {string|null} - className value or null
 */
function extractClassName(jsxElement) {
  if (!jsxElement || !jsxElement.openingElement) {
    return null;
  }

  const classNameAttr = jsxElement.openingElement.attributes.find(
    attr => attr.type === 'JSXAttribute' && attr.name?.name === 'className'
  );

  if (!classNameAttr || !classNameAttr.value) {
    return null;
  }

  if (classNameAttr.value.type === 'StringLiteral') {
    return classNameAttr.value.value.trim();
  }

  if (classNameAttr.value.type === 'JSXExpressionContainer' &&
      classNameAttr.value.expression.type === 'StringLiteral') {
    return classNameAttr.value.expression.value.trim();
  }

  return null;
}

/**
 * Normalize className string into sorted array
 * @param {string} className - Raw className string
 * @returns {Set<string>} - Set of normalized class names
 */
function normalizeClassName(className) {
  if (!className || typeof className !== 'string') {
    return new Set();
  }

  return new Set(
    className
      .trim()
      .split(/\s+/)
      .filter(c => c.length > 0)
  );
}

/**
 * Find className for a specific data-name in an AST
 * @param {object} ast - Babel AST
 * @param {string} targetDataName - data-name to search for
 * @returns {string|null} - className or null
 */
function findClassNameByDataName(ast, targetDataName) {
  let found = null;

  traverseDefault(ast, {
    JSXElement(path) {
      if (found) return; // Already found, skip

      const dataNameAttr = path.node.openingElement.attributes.find(
        attr => attr.type === 'JSXAttribute' && attr.name?.name === 'data-name'
      );

      if (dataNameAttr && dataNameAttr.value?.value === targetDataName) {
        found = extractClassName(path.node);
      }
    }
  });

  return found;
}

/**
 * Normalize Identical Classes Transformation
 *
 * Identifies classes that appear identically in all 3 versions (Desktop, Tablet, Mobile).
 * These classes should NOT have responsive prefixes - they are base classes.
 *
 * Example: If all 3 versions have "flex gap-3 relative", these are base classes.
 *
 * Results stored in context.identicalClasses for use by merge transformation.
 *
 * @param {object} context - Pipeline context
 * @returns {object} Statistics about identical classes found
 */
export function execute(context) {
  const { desktopAST, tabletAST, mobileAST } = context;

  const identicalClasses = new Map(); // dataName → Set<className>
  let totalIdenticalClasses = 0;

  // Traverse Desktop AST to get all elements
  traverseDefault(desktopAST, {
    JSXElement(path) {
      const dataNameAttr = path.node.openingElement.attributes.find(
        attr => attr.type === 'JSXAttribute' && attr.name?.name === 'data-name'
      );

      const dataName = dataNameAttr?.value?.value;
      if (!dataName) return;

      // Get classNames from all 3 versions
      const desktopClassName = extractClassName(path.node);
      const tabletClassName = findClassNameByDataName(tabletAST, dataName);
      const mobileClassName = findClassNameByDataName(mobileAST, dataName);

      if (!desktopClassName || !tabletClassName || !mobileClassName) {
        return; // Skip if any version missing className
      }

      // Normalize to Sets for comparison
      const desktopClasses = normalizeClassName(desktopClassName);
      const tabletClasses = normalizeClassName(tabletClassName);
      const mobileClasses = normalizeClassName(mobileClassName);

      // Find intersection (classes present in ALL 3 versions)
      const commonClasses = new Set();

      for (const cls of desktopClasses) {
        if (tabletClasses.has(cls) && mobileClasses.has(cls)) {
          commonClasses.add(cls);
        }
      }

      if (commonClasses.size > 0) {
        identicalClasses.set(dataName, commonClasses);
        totalIdenticalClasses += commonClasses.size;
      }
    }
  });

  // Store in context
  context.identicalClasses = identicalClasses;

  return {
    elementsProcessed: identicalClasses.size,
    totalIdenticalClasses
  };
}
