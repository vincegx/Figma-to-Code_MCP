import traverse from '@babel/traverse';

const traverseDefault = traverse.default || traverse;

export const meta = {
  name: 'merge-desktop-first',
  priority: 40,
  description: 'Merge classNames using desktop-first approach (Desktop = base, Tablet = max-lg:, Mobile = max-md:)'
};

function extractClassName(jsxElement) {
  const classNameAttr = jsxElement?.openingElement?.attributes.find(
    attr => attr.type === 'JSXAttribute' && attr.name?.name === 'className'
  );

  if (!classNameAttr?.value) return null;

  if (classNameAttr.value.type === 'StringLiteral') {
    return classNameAttr.value.value.trim();
  }

  if (classNameAttr.value.type === 'JSXExpressionContainer' &&
      classNameAttr.value.expression.type === 'StringLiteral') {
    return classNameAttr.value.expression.value.trim();
  }

  return null;
}

function normalizeClassName(className) {
  if (!className) return [];
  return className.trim().split(/\s+/).filter(c => c.length > 0);
}

/**
 * Extract data-name attribute from JSX element
 */
function extractDataName(jsxElement) {
  const dataNameAttr = jsxElement?.openingElement?.attributes.find(
    attr => attr.type === 'JSXAttribute' && attr.name?.name === 'data-name'
  );
  return dataNameAttr?.value?.value || null;
}

/**
 * Extract data-node-id attribute from JSX element
 */
function extractNodeId(jsxElement) {
  const nodeIdAttr = jsxElement?.openingElement?.attributes.find(
    attr => attr.type === 'JSXAttribute' && attr.name?.name === 'data-node-id'
  );
  return nodeIdAttr?.value?.value || null;
}

/**
 * Get element type (tag name)
 */
function getElementType(jsxElement) {
  return jsxElement?.openingElement?.name?.name || null;
}

/**
 * Build a positional path for an element in the tree
 * Format: "ParentDataName > [childIndex]"
 */
function buildElementPath(path) {
  // Find nearest parent with data-name
  let currentPath = path.parentPath;
  while (currentPath) {
    if (currentPath.node.type === 'JSXElement') {
      const parentDataName = extractDataName(currentPath.node);
      if (parentDataName) {
        // Get index among siblings
        const siblings = currentPath.node.children.filter(c => c.type === 'JSXElement');
        const siblingIndex = siblings.indexOf(path.node);
        return `${parentDataName}>[${siblingIndex}]`;
      }
    }
    currentPath = currentPath.parentPath;
  }
  return null;
}

/**
 * Build index of all elements by their position in tree
 * @returns {Map} Map of "path" -> { node, className, elementType }
 */
function buildElementIndex(ast) {
  const index = new Map();

  traverseDefault(ast, {
    JSXElement(path) {
      const elementPath = buildElementPath(path);
      if (elementPath) {
        index.set(elementPath, {
          node: path.node,
          className: extractClassName(path.node),
          elementType: getElementType(path.node)
        });
      }
    }
  });

  return index;
}

/**
 * Classes that represent dimensional/layout properties that often differ across breakpoints
 * These are excluded from core similarity calculation
 */
const DIMENSIONAL_PATTERNS = [
  /^w-/, /^min-w-/, /^max-w-/,
  /^h-/, /^min-h-/, /^max-h-/,
  /^basis-/, /^grow$/, /^grow-/, /^shrink$/, /^shrink-/,
  /^gap-/, /^p-/, /^px-/, /^py-/, /^m-/, /^mx-/, /^my-/
];

function isDimensionalClass(className) {
  return DIMENSIONAL_PATTERNS.some(pattern => pattern.test(className));
}

/**
 * Calculate similarity between two class name strings
 * Uses BOTH total similarity AND core similarity (ignoring dimensions)
 * @returns {number} Percentage (0-100) of similarity
 */
function calculateSimilarity(className1, className2) {
  const classes1 = normalizeClassName(className1);
  const classes2 = normalizeClassName(className2);

  if (classes1.length === 0 && classes2.length === 0) return 100;
  if (classes1.length === 0 || classes2.length === 0) return 0;

  const set1 = new Set(classes1);
  const set2 = new Set(classes2);

  // Calculate total similarity
  const intersection = [...set1].filter(c => set2.has(c));
  const union = new Set([...set1, ...set2]);
  const totalSimilarity = (intersection.length / union.size) * 100;

  // Calculate core similarity (excluding dimensional properties)
  const coreClasses1 = classes1.filter(c => !isDimensionalClass(c));
  const coreClasses2 = classes2.filter(c => !isDimensionalClass(c));

  if (coreClasses1.length === 0 && coreClasses2.length === 0) {
    return totalSimilarity;
  }

  const coreSet1 = new Set(coreClasses1);
  const coreSet2 = new Set(coreClasses2);
  const coreIntersection = coreClasses1.filter(c => coreSet2.has(c));
  const coreUnion = new Set([...coreClasses1, ...coreClasses2]);

  if (coreUnion.size === 0) {
    return totalSimilarity;
  }

  const coreSimilarity = (coreIntersection.length / coreUnion.size) * 100;

  // Use the HIGHER of total or core similarity
  // This allows matching elements with same structure but different dimensions
  return Math.max(totalSimilarity, coreSimilarity);
}

/**
 * Find matching element using hybrid strategy:
 * Level 1: Match by node-id (most precise - exact match when IDs preserved)
 * Level 2: Match by data-name + element type (prevent parent/child collision)
 * Level 3: Match by position + similarity (for elements without data-name)
 * Level 4: Return null if no match
 */
function findMatchingElement(ast, nodeId, dataName, elementPath, desktopClassName, elementType) {
  // Level 1: Match by node-id (most precise - works when Figma preserves IDs)
  if (nodeId) {
    let found = null;
    traverseDefault(ast, {
      JSXElement(path) {
        if (found) return;
        const targetNodeId = extractNodeId(path.node);
        if (targetNodeId === nodeId) {
          found = extractClassName(path.node);
        }
      }
    });
    if (found) return found; // Exact match by node-id
  }

  // Level 2: Match by data-name + element type (prevent parent/child collision with same data-name)
  if (dataName && elementType) {
    let found = null;
    traverseDefault(ast, {
      JSXElement(path) {
        if (found) return;
        const targetDataName = extractDataName(path.node);
        const targetElementType = getElementType(path.node);
        // Match BOTH data-name AND element type to avoid collision
        if (targetDataName === dataName && targetElementType === elementType) {
          found = extractClassName(path.node);
        }
      }
    });
    if (found) return found;
  }

  // Level 3: Match by position + similarity (for elements without data-name)
  if (elementPath && desktopClassName && elementType) {
    const index = buildElementIndex(ast);
    const candidate = index.get(elementPath);

    if (candidate) {
      // Check element type matches
      if (candidate.elementType === elementType) {
        // Check class similarity
        const similarity = calculateSimilarity(desktopClassName, candidate.className);

        // Require 80% similarity to accept match
        if (similarity >= 80) {
          return candidate.className;
        }
      }
    }
  }

  // Level 4: No match found
  return null;
}

function findClassNameByDataName(ast, targetDataName) {
  let found = null;
  traverseDefault(ast, {
    JSXElement(path) {
      if (found) return;
      const dataNameAttr = path.node.openingElement.attributes.find(
        attr => attr.type === 'JSXAttribute' && attr.name?.name === 'data-name'
      );
      if (dataNameAttr?.value?.value === targetDataName) {
        found = extractClassName(path.node);
      }
    }
  });
  return found;
}

function updateClassName(jsxElement, newClassName) {
  const classNameAttr = jsxElement.openingElement.attributes.find(
    attr => attr.type === 'JSXAttribute' && attr.name?.name === 'className'
  );

  if (!classNameAttr) return;

  if (classNameAttr.value.type === 'StringLiteral') {
    classNameAttr.value.value = newClassName;
  } else if (classNameAttr.value.type === 'JSXExpressionContainer' &&
             classNameAttr.value.expression.type === 'StringLiteral') {
    classNameAttr.value.expression.value = newClassName;
  }
}

/**
 * Get classes that should be removed when applying conflicting class
 * @param {Array} conflicts - Conflicts for this element
 * @param {string} applyingClass - Class being applied
 * @returns {Array<string>} Classes to remove
 */
function getConflictingClasses(conflicts, applyingClass) {
  const toRemove = [];

  for (const conflict of conflicts) {
    const allValues = [
      ...(Array.isArray(conflict.mobile) ? conflict.mobile : [conflict.mobile]),
      ...(Array.isArray(conflict.tablet) ? conflict.tablet : [conflict.tablet]),
      ...(Array.isArray(conflict.desktop) ? conflict.desktop : [conflict.desktop])
    ].filter(Boolean);

    // If applying class is in this conflict group
    if (allValues.includes(applyingClass)) {
      // Remove other conflicting classes from the same group
      toRemove.push(...allValues.filter(c => c !== applyingClass));
    }
  }

  return toRemove;
}

export function execute(context) {
  const { desktopAST, tabletAST, mobileAST, identicalClasses, classConflicts } = context;

  let mergedCount = 0;
  let totalClassesMerged = 0;
  let matchedByDataName = 0;
  let matchedByPosition = 0;
  let skippedNoMatch = 0;

  traverseDefault(desktopAST, {
    JSXElement(path) {
      // Extract element info from desktop
      const nodeId = extractNodeId(path.node);
      const dataName = extractDataName(path.node);
      const desktopClassName = extractClassName(path.node);
      const elementType = getElementType(path.node);
      const elementPath = buildElementPath(path);

      // Try to find matching elements in tablet and mobile using hybrid strategy
      const tabletClassName = findMatchingElement(
        tabletAST,
        nodeId,
        dataName,
        elementPath,
        desktopClassName,
        elementType
      );

      const mobileClassName = findMatchingElement(
        mobileAST,
        nodeId,
        dataName,
        elementPath,
        desktopClassName,
        elementType
      );

      // Skip if we couldn't find matches in both breakpoints
      if (!desktopClassName || !tabletClassName || !mobileClassName) {
        skippedNoMatch++;
        return;
      }

      // Track matching method for stats
      if (dataName) {
        matchedByDataName++;
      } else {
        matchedByPosition++;
      }

      // Skip if all 3 are identical
      if (desktopClassName === tabletClassName && tabletClassName === mobileClassName) {
        return;
      }

      // Normalize to arrays
      const mobileClasses = normalizeClassName(mobileClassName);
      const tabletClasses = normalizeClassName(tabletClassName);
      const desktopClasses = normalizeClassName(desktopClassName);

      // Use same key strategy as conflict detection: dataName or elementPath
      // This ensures we find conflicts for elements without data-name
      const conflictKey = dataName || elementPath;

      // Get identical classes for this element
      const identical = identicalClasses?.get(dataName) || new Set();

      // Get conflicts for this element using the same key strategy
      const conflicts = classConflicts?.get(conflictKey) || [];

      // Start with desktop classes (desktop-first approach)
      const result = new Set(desktopClasses);

      // Handle tablet differences (max-lg: prefix for ≤1439px)
      for (const cls of tabletClasses) {
        if (!desktopClasses.includes(cls) && !identical.has(cls)) {
          // This class is different in tablet
          const conflicting = getConflictingClasses(conflicts, cls);

          // Remove conflicting desktop base classes
          for (const conflict of conflicting) {
            if (desktopClasses.includes(conflict)) {
              result.delete(conflict);
            }
          }

          // Add with max-lg: prefix (applies at ≤1439px)
          result.add(`max-lg:${cls}`);
        }
      }

      // Handle desktop classes that disappear in tablet
      for (const cls of desktopClasses) {
        if (!tabletClasses.includes(cls) && !identical.has(cls)) {
          // Check if there's a tablet replacement
          const hasTabletReplacement = conflicts.some(conflict => {
            const desktopVal = Array.isArray(conflict.desktop) ? conflict.desktop : [conflict.desktop];
            const tabletVal = Array.isArray(conflict.tablet) ? conflict.tablet : [conflict.tablet];
            return desktopVal.includes(cls) && tabletVal.some(t => t && t !== cls);
          });

          if (hasTabletReplacement) {
            // Desktop class will be replaced by max-lg: override
            // Keep it in result as it's still the base class
          }
        }
      }

      // Handle mobile differences (max-md: prefix for ≤939px)
      for (const cls of mobileClasses) {
        if (!tabletClasses.includes(cls) && !identical.has(cls)) {
          // This class is different in mobile

          // IMPORTANT: If mobile = desktop, skip adding max-md: override
          // The class is already in base, no need to re-apply it at mobile breakpoint
          // This prevents overriding tablet constraints (e.g., max-lg:max-w-custom-360)
          if (desktopClasses.includes(cls)) {
            continue;
          }

          const conflicting = getConflictingClasses(conflicts, cls);

          // Remove conflicting classes (both base and max-lg: prefixed)
          for (const conflict of conflicting) {
            result.delete(conflict);
            result.delete(`max-lg:${conflict}`);
          }

          // Add with max-md: prefix (applies at ≤939px)
          result.add(`max-md:${cls}`);
        }
      }

      // Handle tablet classes that disappear in mobile
      for (const cls of tabletClasses) {
        if (!mobileClasses.includes(cls) && !identical.has(cls)) {
          const hasMobileReplacement = conflicts.some(conflict => {
            const tabletVal = Array.isArray(conflict.tablet) ? conflict.tablet : [conflict.tablet];
            const mobileVal = Array.isArray(conflict.mobile) ? conflict.mobile : [conflict.mobile];
            return tabletVal.includes(cls) && mobileVal.some(m => m && m !== cls);
          });

          if (hasMobileReplacement) {
            // Tablet class (max-lg:) will be replaced by max-md: override
            // Keep it in result as it's the tablet override
          }
        }
      }

      // CRITICAL FIX: Cancel tablet constraints on mobile when mobile = desktop
      // Example: Desktop w-full, Tablet max-w-custom-360, Mobile w-full
      // Result should be: w-full max-lg:max-w-custom-360 max-md:max-w-none
      // Without max-md:max-w-none, the tablet constraint applies to mobile too (cascade issue)
      for (const cls of tabletClasses) {
        // Check if tablet has a constraint class that desktop doesn't have
        if (!desktopClasses.includes(cls) && !identical.has(cls)) {
          // Check if this is a width/height constraint
          const isMaxConstraint = /^max-w-/.test(cls) || /^max-h-/.test(cls);
          const isMinConstraint = /^min-w-/.test(cls) || /^min-h-/.test(cls);

          if (isMaxConstraint || isMinConstraint) {
            // Check if mobile = desktop (mobile doesn't have this constraint)
            if (!mobileClasses.includes(cls)) {
              // Check if max-lg:constraint was added
              if (result.has(`max-lg:${cls}`)) {
                // Mobile = Desktop (no constraint), but max-lg:constraint applies to mobile too
                // Must cancel it with max-md:max-w-none or max-md:min-w-0
                if (isMaxConstraint) {
                  if (!result.has('max-md:max-w-none')) {
                    result.add('max-md:max-w-none');
                  }
                } else if (isMinConstraint) {
                  if (!result.has('max-md:min-w-0')) {
                    result.add('max-md:min-w-0');
                  }
                }
              }
            }
          }
        }
      }


      // Update Desktop AST with merged className
      const mergedClassName = Array.from(result).join(' ');
      updateClassName(path.node, mergedClassName);

      mergedCount++;
      totalClassesMerged += result.size;
    }
  });

  return {
    elementsMerged: mergedCount,
    totalClassesMerged,
    matchedByDataName,
    matchedByPosition,
    skippedNoMatch
  };
}
