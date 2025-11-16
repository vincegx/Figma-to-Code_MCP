#!/usr/bin/env node
/**
 * Puck Generator
 *
 * Transforms hardcoded responsive components into Puck-ready components with configurable props
 *
 * Usage:
 *   import { generatePuckComponents } from './puck-generator.js'
 *   await generatePuckComponents({ sourceDir, outputDir, imagesDir, components })
 */

import fs from 'fs';
import path from 'path';
import { parse } from '@babel/parser';
import traverse from '@babel/traverse';
import generate from '@babel/generator';
import * as t from '@babel/types';

/**
 * Convert string to camelCase
 */
function toCamelCase(str) {
  return str
    .replace(/[^a-zA-Z0-9]+(.)/g, (match, char) => char.toUpperCase())
    .replace(/^./, char => char.toLowerCase());
}

/**
 * Convert string to PascalCase
 */
function toPascalCase(str) {
  const camel = toCamelCase(str);
  return camel.charAt(0).toUpperCase() + camel.slice(1);
}

/**
 * Convert camelCase to readable label
 */
function toLabel(camelCase) {
  return camelCase
    .replace(/([A-Z])/g, ' $1')
    .replace(/^./, str => str.toUpperCase())
    .trim();
}

/**
 * Get data-name attribute from JSX element
 */
function getDataName(jsxElement) {
  if (!jsxElement || !jsxElement.openingElement) return null;

  const attributes = jsxElement.openingElement.attributes;
  const dataNameAttr = attributes.find(
    attr => attr.type === 'JSXAttribute' && attr.name.name === 'data-name'
  );

  if (dataNameAttr && dataNameAttr.value && dataNameAttr.value.type === 'StringLiteral') {
    return dataNameAttr.value.value;
  }

  return null;
}

/**
 * Extract configurable props from component code
 */
function extractProps(componentCode, componentName) {
  const ast = parse(componentCode, {
    sourceType: 'module',
    plugins: ['jsx', 'typescript']
  });

  const props = {
    texts: [],
    images: [],
    visibility: []
  };

  // Track imported images
  const imageImports = new Map(); // importName → imagePath

  traverse.default(ast, {
    // Extract image imports
    ImportDeclaration(path) {
      if (path.node.source.value.includes('../img/')) {
        const importName = path.node.specifiers[0].local.name;
        const imagePath = path.node.source.value;

        imageImports.set(importName, imagePath);
      }
    },

    // Extract JSX text content
    JSXText(path) {
      const text = path.node.value.trim();
      if (text && text.length > 0) {
        // Generate prop name from text (first 20 chars, camelCase)
        // Remove all non-alphanumeric except spaces first, then convert to camelCase, then remove remaining non-alphanumeric
        const cleanText = text.substring(0, 20).replace(/[^a-zA-Z0-9\s]/g, '');
        let propName = toCamelCase(cleanText).replace(/[^a-zA-Z0-9]/g, '') || 'text';

        // If propName is empty or starts with a digit, prefix it with 'text'
        if (!propName || /^\d/.test(propName)) {
          propName = 'text' + (propName || 'Value');
        }

        // Avoid duplicates by adding index
        let finalPropName = propName;
        let index = 1;
        while (props.texts.find(p => p.propName === finalPropName)) {
          finalPropName = propName + index;
          index++;
        }

        props.texts.push({
          original: text,
          propName: finalPropName,
          defaultValue: text
        });
      }
    },

    // Extract visibility props from conditional classes
    JSXAttribute(path) {
      if (path.node.name.name === 'className') {
        const classValue = path.node.value;

        if (classValue && classValue.type === 'StringLiteral') {
          const classes = classValue.value;

          // Detect responsive visibility (max-md:hidden, max-lg:hidden)
          if (classes.includes('max-md:hidden') || classes.includes('max-lg:hidden')) {
            // Get parent element's data-name
            let parentPath = path.parentPath;
            while (parentPath && parentPath.node.type !== 'JSXElement') {
              parentPath = parentPath.parentPath;
            }

            if (parentPath && parentPath.node.type === 'JSXElement') {
              const dataName = getDataName(parentPath.node);
              if (dataName) {
                const propName = `show${toPascalCase(dataName)}`;

                // Avoid duplicates
                if (!props.visibility.find(p => p.propName === propName)) {
                  props.visibility.push({
                    element: dataName,
                    propName,
                    defaultValue: true // Visible by default
                  });
                }
              }
            }
          }
        }
      }
    }
  });

  // Extract images from imports
  imageImports.forEach((imagePath, importName) => {
    let propName = toCamelCase(importName.replace(/^img/, ''));

    // If propName is empty or starts with a digit, prefix it with 'image'
    if (!propName || /^\d/.test(propName)) {
      propName = 'image' + (propName || 'Asset');
    }

    // Extract filename from path (e.g., '../img/logo.svg' -> 'logo.svg')
    const filename = imagePath.split('/').pop();

    props.images.push({
      importName,
      propName,
      defaultValue: filename // Just the filename, will be served via API
    });
  });

  return props;
}

/**
 * Generate Puck-ready component with props interface
 */
function generatePuckComponent(componentName, originalCode, extractedProps) {
  const ast = parse(originalCode, {
    sourceType: 'module',
    plugins: ['jsx', 'typescript']
  });

  // Build props interface with deduplication
  const allProps = [
    ...extractedProps.texts.map(p => ({ ...p, type: 'string' })),
    ...extractedProps.images.map(p => ({ ...p, type: 'string' })),
    ...extractedProps.visibility.map(p => ({ ...p, type: 'boolean' }))
  ];

  // Deduplicate by propName (keep first occurrence)
  const uniquePropsMap = new Map();
  for (const prop of allProps) {
    if (!uniquePropsMap.has(prop.propName)) {
      uniquePropsMap.set(prop.propName, prop);
    }
  }

  const uniqueProps = Array.from(uniquePropsMap.values());

  const propsInterface = `interface ${componentName}Props {
  className?: string;
${uniqueProps.map(p => `  ${p.propName}?: ${p.type};`).join('\n')}
}`;

  // Remove image imports and React/CSS imports (will be re-added)
  traverse.default(ast, {
    ImportDeclaration(path) {
      if (path.node.source.value.includes('../img/') ||
          path.node.source.value === 'react' ||
          path.node.source.value.endsWith('.css')) {
        path.remove();
      }
    }
  });

  // Replace hardcoded texts with props
  let textIndex = 0;
  traverse.default(ast, {
    JSXText(path) {
      const text = path.node.value.trim();
      if (text && text.length > 0 && textIndex < extractedProps.texts.length) {
        const prop = extractedProps.texts[textIndex];
        textIndex++;

        // Replace with {propName}
        path.replaceWith(
          t.jsxExpressionContainer(
            t.identifier(prop.propName)
          )
        );
      }
    }
  });

  // Track image usage in sub-components
  const subComponentImageUsage = new Map(); // subComponentName -> Set(imagePropNames)

  traverse.default(ast, {
    // First pass: Find sub-components (non-exported functions) and track which images they use
    FunctionDeclaration(path) {
      // Skip if this is the exported default function
      if (path.parent.type === 'ExportDefaultDeclaration') {
        return;
      }

      const funcName = path.node.id.name;
      const usedImages = new Set();

      // Traverse this function's body to find image references
      path.traverse({
        JSXAttribute(innerPath) {
          if (innerPath.node.name.name === 'src' && innerPath.node.value.type === 'JSXExpressionContainer') {
            const expr = innerPath.node.value.expression;
            if (expr.type === 'Identifier') {
              const imageProp = extractedProps.images.find(p => p.importName === expr.name);
              if (imageProp) {
                usedImages.add(imageProp.propName);
              }
            }
          }
        }
      });

      if (usedImages.size > 0) {
        subComponentImageUsage.set(funcName, usedImages);
      }
    }
  });

  // Replace image references with props
  traverse.default(ast, {
    JSXAttribute(path) {
      if (path.node.name.name === 'src' && path.node.value.type === 'JSXExpressionContainer') {
        const expr = path.node.value.expression;
        if (expr.type === 'Identifier') {
          const imageProp = extractedProps.images.find(p => p.importName === expr.name);
          if (imageProp) {
            // Replace importName with propName
            expr.name = imageProp.propName;
          }
        }
      }
    }
  });

  // Update sub-component function signatures to accept image props
  traverse.default(ast, {
    FunctionDeclaration(path) {
      // Skip if this is the exported default function
      if (path.parent.type === 'ExportDefaultDeclaration') {
        return;
      }

      const funcName = path.node.id.name;
      const usedImages = subComponentImageUsage.get(funcName);

      if (usedImages && usedImages.size > 0) {
        // Find the TypeScript type annotation parameter
        const param = path.node.params[0];

        if (param && param.type === 'ObjectPattern' && param.typeAnnotation) {
          const typeAnnotation = param.typeAnnotation.typeAnnotation;

          if (typeAnnotation.type === 'TSTypeLiteral') {
            // Add image props to TypeScript interface
            usedImages.forEach(imageProp => {
              typeAnnotation.members.push(
                t.tsPropertySignature(
                  t.identifier(imageProp),
                  t.tsTypeAnnotation(t.tsStringKeyword())
                )
              );

              // Also add to destructuring pattern
              param.properties.push(
                t.objectProperty(
                  t.identifier(imageProp),
                  t.identifier(imageProp),
                  false,
                  true
                )
              );
            });
          }
        }
      }
    }
  });

  // Update JSX elements that render sub-components to pass image props
  traverse.default(ast, {
    JSXOpeningElement(path) {
      const elementName = path.node.name.name;
      const usedImages = subComponentImageUsage.get(elementName);

      if (usedImages && usedImages.size > 0) {
        // Add image props as JSX attributes
        usedImages.forEach(imageProp => {
          path.node.attributes.push(
            t.jsxAttribute(
              t.jsxIdentifier(imageProp),
              t.jsxExpressionContainer(t.identifier(imageProp))
            )
          );
        });
      }
    }
  });

  // Update function signature with props destructuring
  traverse.default(ast, {
    ExportDefaultDeclaration(path) {
      const funcDecl = path.node.declaration;

      if (funcDecl.type === 'FunctionDeclaration') {
        // Collect all unique prop names (deduplicate across texts, images, visibility)
        const allProps = [
          ...extractedProps.texts,
          ...extractedProps.images,
          ...extractedProps.visibility
        ];

        // Deduplicate by propName (keep first occurrence)
        const uniquePropsMap = new Map();
        uniquePropsMap.set('className', { propName: 'className' }); // Always include className

        for (const prop of allProps) {
          if (!uniquePropsMap.has(prop.propName)) {
            uniquePropsMap.set(prop.propName, prop);
          }
        }

        const uniqueProps = Array.from(uniquePropsMap.values());

        // Update params - simple destructuring pattern with unique props only
        funcDecl.params = [
          t.objectPattern(
            uniqueProps.map(p =>
              t.objectProperty(t.identifier(p.propName), t.identifier(p.propName), false, true)
            )
          )
        ];
      }
    }
  });

  // Generate final code
  const transformedCode = generate.default(ast, {}, originalCode).code;

  // Construct final component with interface
  return `import React from 'react';
import './${componentName}.css';

${propsInterface}

${transformedCode}`;
}

/**
 * Extract className for each component from Page.tsx
 */
function extractComponentClassNames(pageCode) {
  const ast = parse(pageCode, {
    sourceType: 'module',
    plugins: ['jsx', 'typescript']
  });

  const componentClassNames = {};

  traverse.default(ast, {
    JSXElement(path) {
      const openingElement = path.node.openingElement;
      if (openingElement.type === 'JSXOpeningElement' &&
          openingElement.name.type === 'JSXIdentifier') {

        const componentName = openingElement.name.name;

        // Find className attribute
        const classNameAttr = openingElement.attributes.find(
          attr => attr.type === 'JSXAttribute' && attr.name.name === 'className'
        );

        if (classNameAttr && classNameAttr.value && classNameAttr.value.type === 'StringLiteral') {
          componentClassNames[componentName] = classNameAttr.value.value;
        }
      }
    }
  });

  return componentClassNames;
}

/**
 * Extract root layout properties from Page.tsx
 */
function extractRootLayoutProps(pageCode) {
  const ast = parse(pageCode, {
    sourceType: 'module',
    plugins: ['jsx', 'typescript']
  });

  const rootProps = {
    pageBackground: 'bg-white',
    bodyGap: 'gap-4',
    bodyPadding: 'p-6',
    containerGap: 'gap-6',
    containerMaxWidth: 'max-w-7xl'
  };

  // Helper to extract specific class pattern from className string
  const extractClass = (className, pattern) => {
    const classes = className.split(/\s+/);
    return classes.find(c => c.match(pattern));
  };

  traverse.default(ast, {
    JSXElement(path) {
      const openingElement = path.node.openingElement;

      // Find data-name attribute
      const dataNameAttr = openingElement.attributes.find(
        attr => attr.type === 'JSXAttribute' &&
                attr.name.name === 'data-name' &&
                attr.value && attr.value.type === 'StringLiteral'
      );

      if (dataNameAttr) {
        const dataName = dataNameAttr.value.value;

        // Find className attribute
        const classNameAttr = openingElement.attributes.find(
          attr => attr.type === 'JSXAttribute' && attr.name.name === 'className'
        );

        if (classNameAttr && classNameAttr.value && classNameAttr.value.type === 'StringLiteral') {
          const className = classNameAttr.value.value;

          // Extract from main page div (e.g., "BGS Homepage - 1440px")
          if (dataName.includes('Homepage') || dataName.includes('Page')) {
            const bgClass = extractClass(className, /^bg-/);
            if (bgClass) rootProps.pageBackground = bgClass;
          }

          // Extract from body div
          if (dataName === 'body') {
            const gapClass = extractClass(className, /^gap-/);
            const paddingClass = extractClass(className, /^p-\d+$|^p-custom-/);
            if (gapClass) rootProps.bodyGap = gapClass;
            if (paddingClass) rootProps.bodyPadding = paddingClass;
          }

          // Extract from container div
          if (dataName === 'Container') {
            const gapClass = extractClass(className, /^gap-/);
            const maxWClass = extractClass(className, /^max-w-/);
            if (gapClass) rootProps.containerGap = gapClass;
            if (maxWClass) rootProps.containerMaxWidth = maxWClass;
          }
        }
      }
    }
  });

  return rootProps;
}

/**
 * Detect if a value is a number (pure number, money, percentage, etc.)
 */
function isNumericValue(value) {
  if (typeof value === 'number') return true;
  if (typeof value !== 'string') return false;

  // Remove currency symbols, commas, percentages
  const cleaned = value.replace(/[$,€£¥%\s]/g, '');

  // Check if what remains is a valid number
  return !isNaN(cleaned) && cleaned !== '';
}

/**
 * Detect optimal field type based on prop name and value
 */
function detectFieldType(propName, defaultValue, category) {
  // Images → object with url/mode/alt
  if (category === 'image') {
    return 'object';
  }

  // Visibility → radio
  if (category === 'visibility') {
    return 'radio';
  }

  // Text fields - detect number vs textarea vs text
  if (category === 'text') {
    // Check if it's a number
    if (isNumericValue(defaultValue)) {
      return 'number';
    }

    // Long text → textarea
    if (defaultValue && defaultValue.length > 50) {
      return 'textarea';
    }

    // Default to text
    return 'text';
  }

  return 'text';
}

/**
 * Generate puck.config.tsx
 */
function generatePuckConfig(components, extractedPropsMap, componentClassNames = {}, rootLayoutProps = {}) {
  const imports = components.map(name =>
    `import ${name} from './components/${name}';`
  ).join('\n');

  const configs = components.map(name => {
    const props = extractedPropsMap[name];

    const fields = [];

    // ClassName field - always textarea for long CSS strings
    fields.push(`    className: {
      type: 'textarea',
      label: 'CSS Classes'
    }`);

    // Text fields - auto-detect type (number, textarea, or text)
    props.texts.forEach(p => {
      const fieldType = detectFieldType(p.propName, p.defaultValue, 'text');

      fields.push(`    ${p.propName}: {
      type: '${fieldType}',
      label: '${toLabel(p.propName)}'
    }`);
    });

    // Image fields - use object with url/mode/alt
    props.images.forEach(p => {
      fields.push(`    ${p.propName}: {
      type: 'object',
      objectFields: {
        url: {
          type: 'text',
          label: 'Image URL'
        },
        mode: {
          type: 'select',
          label: 'Display Mode',
          options: [
            { label: 'Cover', value: 'cover' },
            { label: 'Contain', value: 'contain' },
            { label: 'Fill', value: 'fill' },
            { label: 'Scale Down', value: 'scale-down' },
            { label: 'None', value: 'none' }
          ]
        },
        alt: {
          type: 'text',
          label: 'Alt Text'
        }
      },
      label: '${toLabel(p.propName)}'
    }`);
    });

    // Visibility fields - radio buttons
    props.visibility.forEach(p => {
      fields.push(`    ${p.propName}: {
      type: 'radio',
      label: '${toLabel(p.propName)}',
      options: [
        { label: 'Show', value: true },
        { label: 'Hide', value: false }
      ]
    }`);
    });

    const defaultProps = [];

    // Add className to defaultProps if available
    if (componentClassNames[name]) {
      defaultProps.push(`className: ${JSON.stringify(componentClassNames[name])}`);
    }

    // Text fields - handle numbers vs strings
    props.texts.forEach(p => {
      const fieldType = detectFieldType(p.propName, p.defaultValue, 'text');
      if (fieldType === 'number') {
        // Parse as number, removing currency/formatting
        const numValue = parseFloat(p.defaultValue.replace(/[$,€£¥%\s]/g, ''));
        defaultProps.push(`${p.propName}: ${numValue}`);
      } else {
        defaultProps.push(`${p.propName}: ${JSON.stringify(p.defaultValue)}`);
      }
    });

    // Image fields - now objects with url/mode/alt
    props.images.forEach(p => {
      defaultProps.push(`${p.propName}: {
        url: ${JSON.stringify(p.defaultValue)},
        mode: 'cover',
        alt: ''
      }`);
    });

    // Visibility fields
    props.visibility.forEach(p => defaultProps.push(`${p.propName}: ${p.defaultValue}`));

    return `  ${name}: {
    fields: {
${fields.join(',\n')}
    },
    defaultProps: {
      ${defaultProps.join(',\n      ')}
    },
    render: (props) => {
      // Transform image URLs to use API endpoint
      const mergeId = (window as any).__PUCK_MERGE_ID__;
      const transformedProps = { ...props };

      ${props.images.map(p => `
      // Transform image object to URL string for component
      if (transformedProps.${p.propName} && typeof transformedProps.${p.propName} === 'object') {
        const imgUrl = transformedProps.${p.propName}.url;
        if (imgUrl && !imgUrl.startsWith('http') && !imgUrl.startsWith('/api/')) {
          transformedProps.${p.propName} = \`/api/responsive-merges/\${mergeId}/images/\${imgUrl}\`;
        } else {
          transformedProps.${p.propName} = imgUrl;
        }
      }`).join('')}

      return <${name} {...transformedProps} />;
    }
  }`;
  }).join(',\n');

  return `import { Config } from '@measured/puck';
import { DropZone } from '@measured/puck';
import './Page.css';
${imports}

export const config: Config = {
  components: {
${configs}
  },
  root: {
    fields: {
      pageBackground: {
        type: 'text',
        label: 'Page Background Class'
      },
      bodyGap: {
        type: 'text',
        label: 'Body Gap Class'
      },
      bodyPadding: {
        type: 'text',
        label: 'Body Padding Class'
      },
      containerGap: {
        type: 'text',
        label: 'Container Gap Class'
      },
      containerMaxWidth: {
        type: 'text',
        label: 'Container Max Width Class'
      }
    },
    defaultProps: {
      pageBackground: ${JSON.stringify(rootLayoutProps.pageBackground || 'bg-white')},
      bodyGap: ${JSON.stringify(rootLayoutProps.bodyGap || 'gap-4')},
      bodyPadding: ${JSON.stringify(rootLayoutProps.bodyPadding || 'p-6')},
      containerGap: ${JSON.stringify(rootLayoutProps.containerGap || 'gap-6')},
      containerMaxWidth: ${JSON.stringify(rootLayoutProps.containerMaxWidth || 'max-w-7xl')}
    },
    render: ({ pageBackground, bodyGap, bodyPadding, containerGap, containerMaxWidth }) => {
      return (
        <div className={\`\${pageBackground} content-stretch flex flex-col items-center relative size-full\`} data-name="BGS Homepage - 1440px">
          <DropZone zone="header" />
          <div className={\`box-border content-stretch flex flex-col \${bodyGap} items-center \${bodyPadding} relative shrink-0 w-full\`} data-name="body">
            <div className={\`content-stretch flex flex-col \${containerGap} items-start \${containerMaxWidth} relative shrink-0 w-full\`} data-name="Container">
              <DropZone zone="body" />
            </div>
          </div>
          <DropZone zone="footer" />
        </div>
      );
    }
  }
};
`;
}

/**
 * Generate puck/Page.tsx from original Page.tsx
 */
function generatePuckPage(originalPagePath, outputDir) {
  const pageCode = fs.readFileSync(originalPagePath, 'utf8');
  const ast = parse(pageCode, {
    sourceType: 'module',
    plugins: ['jsx', 'typescript']
  });

  // Replace imports: ./Subcomponents/ → ./components/
  traverse.default(ast, {
    ImportDeclaration(path) {
      if (path.node.source.value.startsWith('./Subcomponents/')) {
        path.node.source.value = path.node.source.value.replace(
          './Subcomponents/',
          './components/'
        );
      }
    }
  });

  const transformedCode = generate.default(ast, {}, pageCode).code;

  // Write puck/Page.tsx
  fs.writeFileSync(
    path.join(outputDir, 'Page.tsx'),
    transformedCode
  );

  // Copy and fix Page.css imports
  const pageCssPath = originalPagePath.replace('.tsx', '.css');
  if (fs.existsSync(pageCssPath)) {
    let cssContent = fs.readFileSync(pageCssPath, 'utf8');
    // Fix relative paths for puck/ directory (up one level)
    // Replace ./Subcomponents/ → ../components/ in CSS imports
    // Replace ./components/ → ../components/ in CSS imports
    cssContent = cssContent.replace(/\.\/Subcomponents\//g, '../components/');
    cssContent = cssContent.replace(/\.\/components\//g, '../components/');
    fs.writeFileSync(
      path.join(outputDir, 'Page.css'),
      cssContent
    );
  }

  console.log('   ✅ puck/Page.tsx generated');
}

/**
 * Main function: Generate Puck-ready components
 */
export async function generatePuckComponents({ sourceDir, outputDir, imagesDir, components }) {
  console.log('🎨 Generating Puck-ready components...\n');

  // Create output structure
  const puckComponentsDir = path.join(outputDir, 'components');
  fs.mkdirSync(puckComponentsDir, { recursive: true });

  const extractedPropsMap = {};

  // Process each component
  for (const componentName of components) {
    console.log(`   Processing ${componentName}...`);

    try {
      // Read original component
      const originalTsxPath = path.join(sourceDir, `${componentName}.tsx`);
      const originalCssPath = path.join(sourceDir, `${componentName}.css`);

      if (!fs.existsSync(originalTsxPath)) {
        console.log(`   ⚠️  ${componentName}.tsx not found, skipping`);
        continue;
      }

      const originalTsx = fs.readFileSync(originalTsxPath, 'utf8');

      // Extract props
      const extractedProps = extractProps(originalTsx, componentName);
      extractedPropsMap[componentName] = extractedProps;

      console.log(`      - Extracted ${extractedProps.texts.length} texts, ${extractedProps.images.length} images, ${extractedProps.visibility.length} visibility props`);

      // Generate Puck component
      const puckComponent = generatePuckComponent(componentName, originalTsx, extractedProps);

      // Write component
      fs.writeFileSync(
        path.join(puckComponentsDir, `${componentName}.tsx`),
        puckComponent
      );

      // Copy CSS
      if (fs.existsSync(originalCssPath)) {
        fs.copyFileSync(
          originalCssPath,
          path.join(puckComponentsDir, `${componentName}.css`)
        );
      }

      console.log(`   ✅ ${componentName}`);
    } catch (error) {
      console.error(`   ❌ Error processing ${componentName}: ${error.message}`);
    }
  }

  // Copy images
  const puckImgDir = path.join(outputDir, 'img');
  if (fs.existsSync(imagesDir)) {
    fs.mkdirSync(puckImgDir, { recursive: true });

    const images = fs.readdirSync(imagesDir);
    for (const img of images) {
      fs.copyFileSync(
        path.join(imagesDir, img),
        path.join(puckImgDir, img)
      );
    }

    console.log(`\n   ✅ Copied ${images.length} images to puck/img/`);
  }

  // Extract className and root layout props from Page.tsx
  const originalPagePath = path.join(path.dirname(sourceDir), 'Page.tsx');
  let componentClassNames = {};
  let rootLayoutProps = {};
  if (fs.existsSync(originalPagePath)) {
    const pageCode = fs.readFileSync(originalPagePath, 'utf8');
    componentClassNames = extractComponentClassNames(pageCode);
    rootLayoutProps = extractRootLayoutProps(pageCode);
    console.log('   ✅ Extracted className from Page.tsx:', componentClassNames);
    console.log('   ✅ Extracted root layout props:', rootLayoutProps);
  }

  // Generate puck.config.tsx
  const puckConfig = generatePuckConfig(Object.keys(extractedPropsMap), extractedPropsMap, componentClassNames, rootLayoutProps);
  fs.writeFileSync(
    path.join(outputDir, 'puck.config.tsx'),
    puckConfig
  );
  console.log('   ✅ puck.config.tsx generated');

  // Generate puck/Page.tsx
  if (fs.existsSync(originalPagePath)) {
    generatePuckPage(originalPagePath, outputDir);
  }

  // Generate initial puck-data.json with all components pre-loaded in correct zones
  // NOTE: Zone keys must be in "ComponentId:zoneName" format (Puck requirement)
  // NOTE: Root props must be in root.props (Puck data structure requirement)
  const initialData = {
    content: [],
    root: {
      props: {
        pageBackground: rootLayoutProps.pageBackground || 'bg-white',
        bodyGap: rootLayoutProps.bodyGap || 'gap-4',
        bodyPadding: rootLayoutProps.bodyPadding || 'p-6',
        containerGap: rootLayoutProps.containerGap || 'gap-6',
        containerMaxWidth: rootLayoutProps.containerMaxWidth || 'max-w-7xl'
      }
    },
    zones: {
      "root:header": [],
      "root:body": [],
      "root:footer": []
    }
  };

  // Distribute components into zones based on their names
  components.forEach((componentName, index) => {
    const props = extractedPropsMap[componentName];
    if (!props) return;

    const defaultProps = {};

    // Add className if available from Page.tsx
    if (componentClassNames[componentName]) {
      defaultProps.className = componentClassNames[componentName];
    }

    // Add text props with default values - parse numbers
    props.texts.forEach(p => {
      const fieldType = detectFieldType(p.propName, p.defaultValue, 'text');
      if (fieldType === 'number') {
        // Parse as number, removing currency/formatting
        defaultProps[p.propName] = parseFloat(p.defaultValue.replace(/[$,€£¥%\s]/g, ''));
      } else {
        defaultProps[p.propName] = p.defaultValue;
      }
    });

    // Add image props as objects with url/mode/alt
    props.images.forEach(p => {
      defaultProps[p.propName] = {
        url: p.defaultValue,
        mode: 'cover',
        alt: ''
      };
    });

    // Add visibility props with default values
    props.visibility.forEach(p => {
      defaultProps[p.propName] = p.defaultValue;
    });

    // Add unique ID in props (Puck requirement for React keys)
    defaultProps.id = `${componentName}-${Date.now()}-${index}`;

    const component = {
      type: componentName,
      props: defaultProps
    };

    // Determine which zone this component belongs to
    if (componentName === 'Header') {
      initialData.zones["root:header"].push(component);
    } else if (componentName === 'Footer') {
      initialData.zones["root:footer"].push(component);
    } else {
      // All other components go to body
      initialData.zones["root:body"].push(component);
    }
  });

  fs.writeFileSync(
    path.join(outputDir, 'puck-data.json'),
    JSON.stringify(initialData, null, 2)
  );
  console.log('   ✅ puck-data.json generated with pre-loaded components');

  console.log(`\n✅ Puck generation complete: ${Object.keys(extractedPropsMap).length} components\n`);
}

// CLI support
if (import.meta.url === `file://${process.argv[1]}`) {
  const sourceDir = process.argv[2];
  const outputDir = process.argv[3];
  const imagesDir = process.argv[4];
  const components = process.argv.slice(5);

  if (!sourceDir || !outputDir || components.length === 0) {
    console.error('Usage: node puck-generator.js <sourceDir> <outputDir> <imagesDir> <component1> <component2> ...');
    process.exit(1);
  }

  generatePuckComponents({ sourceDir, outputDir, imagesDir, components })
    .catch(err => {
      console.error('Error:', err);
      process.exit(1);
    });
}
