import traverse from '@babel/traverse';

const traverseDefault = traverse.default || traverse;

export const meta = {
  name: 'detect-class-conflicts',
  priority: 30,
  description: 'Detect mutually exclusive classes (flex-row vs flex-col, items-start vs items-center, etc.)'
};

// Define mutually exclusive class groups
const CONFLICT_GROUPS = {
  flexDirection: ['flex-row', 'flex-col', 'flex-row-reverse', 'flex-col-reverse'],
  alignItems: ['items-start', 'items-center', 'items-end', 'items-baseline', 'items-stretch'],
  justifyContent: ['justify-start', 'justify-center', 'justify-end', 'justify-between', 'justify-around', 'justify-evenly'],
  alignContent: ['content-start', 'content-center', 'content-end', 'content-between', 'content-around', 'content-evenly', 'content-stretch'],
  display: ['block', 'inline-block', 'inline', 'flex', 'inline-flex', 'grid', 'inline-grid', 'hidden'],
  position: ['static', 'fixed', 'absolute', 'relative', 'sticky']
};

// Regex patterns for dynamic classes
const DYNAMIC_CONFLICT_PATTERNS = {
  width: /^w-/,
  minWidth: /^min-w-/,
  maxWidth: /^max-w-/,
  height: /^h-/,
  minHeight: /^min-h-/,
  maxHeight: /^max-h-/,
  basis: /^basis-/,
  grow: /^grow/,
  shrink: /^shrink/
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
  if (!className) return new Set();
  return new Set(className.trim().split(/\s+/).filter(c => c.length > 0));
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

function detectConflictsForElement(mobileClasses, tabletClasses, desktopClasses) {
  const conflicts = [];

  // Check static conflict groups
  for (const [groupName, groupClasses] of Object.entries(CONFLICT_GROUPS)) {
    const mobileMatch = [...mobileClasses].find(c => groupClasses.includes(c));
    const tabletMatch = [...tabletClasses].find(c => groupClasses.includes(c));
    const desktopMatch = [...desktopClasses].find(c => groupClasses.includes(c));

    if (mobileMatch || tabletMatch || desktopMatch) {
      if (mobileMatch !== tabletMatch || tabletMatch !== desktopMatch) {
        conflicts.push({
          group: groupName,
          mobile: mobileMatch || null,
          tablet: tabletMatch || null,
          desktop: desktopMatch || null
        });
      }
    }
  }

  // Check dynamic pattern conflicts
  for (const [patternName, pattern] of Object.entries(DYNAMIC_CONFLICT_PATTERNS)) {
    const mobileMatches = [...mobileClasses].filter(c => pattern.test(c));
    const tabletMatches = [...tabletClasses].filter(c => pattern.test(c));
    const desktopMatches = [...desktopClasses].filter(c => pattern.test(c));

    if (mobileMatches.length > 0 || tabletMatches.length > 0 || desktopMatches.length > 0) {
      const mobileStr = mobileMatches.join(' ');
      const tabletStr = tabletMatches.join(' ');
      const desktopStr = desktopMatches.join(' ');

      if (mobileStr !== tabletStr || tabletStr !== desktopStr) {
        conflicts.push({
          group: patternName,
          mobile: mobileMatches,
          tablet: tabletMatches,
          desktop: desktopMatches
        });
      }
    }
  }

  return conflicts;
}

export function execute(context) {
  const { desktopAST, tabletAST, mobileAST } = context;

  const classConflicts = new Map();
  let totalConflicts = 0;

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

      const desktopClasses = normalizeClassName(desktopClassName);
      const tabletClasses = normalizeClassName(tabletClassName);
      const mobileClasses = normalizeClassName(mobileClassName);

      const conflicts = detectConflictsForElement(mobileClasses, tabletClasses, desktopClasses);

      if (conflicts.length > 0) {
        classConflicts.set(dataName, conflicts);
        totalConflicts += conflicts.length;
      }
    }
  });

  context.classConflicts = classConflicts;

  return {
    elementsWithConflicts: classConflicts.size,
    totalConflicts
  };
}
