import traverse from '@babel/traverse';

const traverseDefault = traverse.default || traverse;

export const meta = {
  name: 'inject-visibility-classes',
  priority: 50,
  description: 'Add max-md:hidden to elements missing in mobile, max-lg:hidden for elements missing in tablet'
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
 * Detect display type from existing classes
 * @param {string} className - Current className string
 * @returns {string} - 'flex', 'block', 'grid', or 'block' (default)
 */
function detectDisplayType(className) {
  if (!className) return 'block';

  const classes = className.split(/\s+/);

  if (classes.includes('flex') || classes.includes('inline-flex')) {
    return 'flex';
  }

  if (classes.includes('grid') || classes.includes('inline-grid')) {
    return 'grid';
  }

  if (classes.includes('inline-block')) {
    return 'inline-block';
  }

  if (classes.includes('inline')) {
    return 'inline';
  }

  return 'block';
}

/**
 * Inject Visibility Classes Transformation
 *
 * For elements that are present in Desktop but absent in Mobile or Tablet,
 * add visibility classes to hide them at smaller breakpoints:
 * - max-md:hidden (for elements missing in mobile)
 * - max-lg:hidden md:block (for elements missing in tablet only)
 *
 * This ensures elements like help menu are hidden on appropriate screens.
 *
 * @param {object} context - Pipeline context
 * @returns {object} Statistics about visibility classes injected
 */
export function execute(context) {
  const { desktopAST, missingInMobile, missingInTablet } = context;

  let injectedCount = 0;
  const elementsProcessed = [];

  traverseDefault(desktopAST, {
    JSXElement(path) {
      const dataNameAttr = path.node.openingElement.attributes.find(
        attr => attr.type === 'JSXAttribute' && attr.name?.name === 'data-name'
      );

      const dataName = dataNameAttr?.value?.value;
      if (!dataName) return;

      const currentClassName = extractClassName(path.node);
      if (!currentClassName) return;

      let visibilityClasses = '';

      // Check if element is missing in mobile
      if (missingInMobile && missingInMobile.has(dataName)) {
        // Element visible on Desktop/Tablet, hidden on Mobile (≤939px)
        visibilityClasses = 'max-md:hidden';

        const newClassName = `${currentClassName} ${visibilityClasses}`;
        updateClassName(path.node, newClassName);

        injectedCount++;
        elementsProcessed.push(dataName);
      }
      // Check if element is missing only in tablet (present in Desktop and Mobile)
      else if (missingInTablet && missingInTablet.has(dataName)) {
        // Element visible on Desktop and Mobile, hidden only on Tablet (940-1439px)
        const displayType = detectDisplayType(currentClassName);
        visibilityClasses = `max-lg:hidden lg:${displayType}`;

        const newClassName = `${currentClassName} ${visibilityClasses}`;
        updateClassName(path.node, newClassName);

        injectedCount++;
        elementsProcessed.push(dataName);
      }
    }
  });

  return {
    visibilityClassesInjected: injectedCount,
    elements: elementsProcessed
  };
}
