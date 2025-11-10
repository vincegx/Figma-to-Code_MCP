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

  traverseDefault(desktopAST, {
    JSXElement(path) {
      const dataNameAttr = path.node.openingElement.attributes.find(
        attr => attr.type === 'JSXAttribute' && attr.name?.name === 'data-name'
      );

      const dataName = dataNameAttr?.value?.value;
      if (!dataName) return;

      const desktopClassName = extractClassName(path.node);
      const tabletClassName = findClassNameByDataName(tabletAST, dataName);
      const mobileClassName = findClassNameByDataName(mobileAST, dataName);

      if (!desktopClassName || !tabletClassName || !mobileClassName) return;

      // Skip if all 3 are identical
      if (desktopClassName === tabletClassName && tabletClassName === mobileClassName) {
        return;
      }

      // Normalize to arrays
      const mobileClasses = normalizeClassName(mobileClassName);
      const tabletClasses = normalizeClassName(tabletClassName);
      const desktopClasses = normalizeClassName(desktopClassName);

      // Get identical classes for this element
      const identical = identicalClasses?.get(dataName) || new Set();

      // Get conflicts for this element
      const conflicts = classConflicts?.get(dataName) || [];

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

      // Update Desktop AST with merged className
      const mergedClassName = Array.from(result).join(' ');
      updateClassName(path.node, mergedClassName);

      mergedCount++;
      totalClassesMerged += result.size;
    }
  });

  return {
    elementsMerged: mergedCount,
    totalClassesMerged
  };
}
