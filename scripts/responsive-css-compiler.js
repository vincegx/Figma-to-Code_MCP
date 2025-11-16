/**
 * RESPONSIVE CSS COMPILER
 *
 * Compile les classes Tailwind-style (max-md:*, max-lg:*) en CSS pur avec @media queries.
 *
 * POURQUOI CE FICHIER EXISTE:
 * - La transformation 45-reset-dependent-properties.js ajoute des classes comme "max-md:basis-auto"
 * - Ces classes sont dans le HTML mais n'ont pas de CSS correspondant
 * - Ce compilateur scanne tous les TSX générés et crée le CSS manquant
 *
 * INTÉGRATION:
 * - Appelé depuis responsive-merger.js après génération TSX, avant écriture CSS
 * - Ligne ~714: Après écriture des fichiers TSX
 * - Ligne ~1187: Avant écriture des fichiers CSS
 */

import fs from 'fs';
import path from 'path';

/**
 * Mapping des classes Tailwind vers CSS pur
 */
const CSS_MAPPINGS = {
  // Flexbox
  'flex-col': 'flex-direction: column;',
  'flex-row': 'flex-direction: row;',
  'flex-wrap': 'flex-wrap: wrap;',
  'flex-nowrap': 'flex-wrap: nowrap;',

  // Flex properties
  'basis-auto': 'flex-basis: auto;',
  'basis-0': 'flex-basis: 0;',
  'basis-full': 'flex-basis: 100%;',
  'grow': 'flex-grow: 1;',
  'grow-0': 'flex-grow: 0;',
  'shrink': 'flex-shrink: 1;',
  'shrink-0': 'flex-shrink: 0;',
  'shrink-1': 'flex-shrink: 1;',

  // Width
  'w-full': 'width: 100%;',
  'w-auto': 'width: auto;',
  'min-w-0': 'min-width: 0;',
  'min-w-full': 'min-width: 100%;',
  'max-w-full': 'max-width: 100%;',
  'max-w-none': 'max-width: none;',

  // Height
  'h-full': 'height: 100%;',
  'h-auto': 'height: auto;',
  'min-h-0': 'min-height: 0;',
  'min-h-full': 'min-height: 100%;',
  'min-h-px': 'min-height: 1px;',
  'max-h-full': 'max-height: 100%;',

  // Display
  'block': 'display: block;',
  'inline-block': 'display: inline-block;',
  'inline': 'display: inline;',
  'flex': 'display: flex;',
  'inline-flex': 'display: inline-flex;',
  'hidden': 'display: none;',

  // Spacing helpers
  'gap-0': 'gap: 0;',
  'p-0': 'padding: 0;',
  'm-0': 'margin: 0;',

  // Justify & Align
  'justify-center': 'justify-content: center;',
  'justify-between': 'justify-content: space-between;',
  'justify-start': 'justify-content: flex-start;',
  'justify-end': 'justify-content: flex-end;',
  'items-center': 'align-items: center;',
  'items-start': 'align-items: flex-start;',
  'items-end': 'align-items: flex-end;',

  // Overflow
  'overflow-x-auto': 'overflow-x: auto;',
  'overflow-x-scroll': 'overflow-x: scroll;',
  'overflow-x-hidden': 'overflow-x: hidden;',
  'overflow-y-auto': 'overflow-y: auto;',
  'overflow-y-scroll': 'overflow-y: scroll;',
  'overflow-y-hidden': 'overflow-y: hidden;',
  'overflow-auto': 'overflow: auto;',
  'overflow-hidden': 'overflow: hidden;',
};

/**
 * Breakpoints utilisés dans le système
 */
const BREAKPOINTS = {
  'max-lg': '1439px',  // Tablet (960px) et mobile (420px)
  'max-md': '939px',   // Mobile seulement (420px)
};

/**
 * Extrait toutes les classes d'un fichier TSX
 */
function extractClassesFromFile(filePath) {
  const content = fs.readFileSync(filePath, 'utf8');
  const classNameRegex = /className=["']([^"']+)["']/g;
  const classes = new Set();

  let match;
  while ((match = classNameRegex.exec(content)) !== null) {
    const classString = match[1];
    classString.split(/\s+/).forEach(cls => {
      if (cls.startsWith('max-md:') || cls.startsWith('max-lg:')) {
        classes.add(cls);
      }
    });
  }

  return classes;
}

/**
 * Scanne tous les fichiers TSX dans un dossier
 */
function scanDirectory(dirPath) {
  const allClasses = new Set();

  function scanRecursive(currentPath) {
    if (!fs.existsSync(currentPath)) return;

    const entries = fs.readdirSync(currentPath, { withFileTypes: true });

    for (const entry of entries) {
      const fullPath = path.join(currentPath, entry.name);

      if (entry.isDirectory()) {
        scanRecursive(fullPath);
      } else if (entry.isFile() && entry.name.endsWith('.tsx')) {
        const classes = extractClassesFromFile(fullPath);
        classes.forEach(cls => allClasses.add(cls));
      }
    }
  }

  scanRecursive(dirPath);
  return allClasses;
}

/**
 * Convertit une classe responsive en CSS
 */
function classToCSS(className) {
  // Format: max-md:basis-auto ou max-lg:flex-col
  const match = className.match(/^(max-(?:md|lg)):(.+)$/);
  if (!match) return null;

  const [, breakpoint, baseClass] = match;

  // Chercher dans le mapping
  if (CSS_MAPPINGS[baseClass]) {
    return {
      breakpoint,
      selector: className,
      css: CSS_MAPPINGS[baseClass]
    };
  }

  // Gérer les classes custom avec valeurs arbitraires
  // Ex: max-md:w-custom-360, max-md:min-w-custom-181, max-md:gap-custom-10
  const customMatch = baseClass.match(/^(min-w|max-w|w|min-h|max-h|h|gap)-custom-(.+)$/);
  if (customMatch) {
    const [, property, value] = customMatch;

    // Map shorthand to full CSS property name
    const propertyMap = {
      'min-w': 'min-width',
      'max-w': 'max-width',
      'w': 'width',
      'min-h': 'min-height',
      'max-h': 'max-height',
      'h': 'height',
      'gap': 'gap'
    };

    const cssProperty = propertyMap[property] || property;
    const cssValue = value.replace(/dot/g, '.'); // 360dot5 → 360.5

    return {
      breakpoint,
      selector: className,
      css: `${cssProperty}: ${cssValue}px;`
    };
  }

  // Gérer les classes gap standard Tailwind (gap-0, gap-1, gap-6, etc.)
  // Tailwind scale: 0.25rem per unit (gap-6 = 1.5rem = 24px)
  const gapMatch = baseClass.match(/^gap-(\d+)$/);
  if (gapMatch) {
    const [, value] = gapMatch;
    const pxValue = parseInt(value) * 4; // Tailwind: 1 unit = 4px (0.25rem)

    return {
      breakpoint,
      selector: className,
      css: `gap: ${pxValue}px;`
    };
  }

  return null;
}

/**
 * Génère le CSS pour toutes les classes responsive trouvées
 */
function generateResponsiveCSS(classes) {
  const cssByBreakpoint = {
    'max-lg': [],
    'max-md': []
  };

  // Convertir chaque classe en CSS
  for (const className of classes) {
    const cssRule = classToCSS(className);
    if (cssRule) {
      cssByBreakpoint[cssRule.breakpoint].push({
        selector: cssRule.selector,
        css: cssRule.css
      });
    }
  }

  // Générer le CSS final avec @media queries
  let output = '';

  output += '/* ========================================= */\n';
  output += '/* RESPONSIVE CSS - Auto-generated          */\n';
  output += '/* Generated by responsive-css-compiler.js  */\n';
  output += '/* ========================================= */\n\n';

  for (const [breakpoint, rules] of Object.entries(cssByBreakpoint)) {
    if (rules.length === 0) continue;

    // Dédupliquer les règles identiques
    const uniqueRules = Array.from(
      new Map(rules.map(r => [r.selector, r])).values()
    );

    output += `/* Breakpoint: ${breakpoint} (${BREAKPOINTS[breakpoint]}) */\n`;
    output += `@media (max-width: ${BREAKPOINTS[breakpoint]}) {\n`;

    for (const rule of uniqueRules) {
      // Échapper les caractères spéciaux pour CSS (: devient \:)
      const escapedSelector = rule.selector.replace(/:/g, '\\:');
      output += `  .${escapedSelector} {\n`;
      output += `    ${rule.css}\n`;
      output += `  }\n`;
    }

    output += '}\n\n';
  }

  return output;
}

/**
 * Point d'entrée principal
 *
 * @param {string} outputDir - Dossier de sortie (ex: src/generated/responsive-screens/responsive-merger-XXX)
 * @returns {string} CSS généré
 */
export function compileResponsiveClasses(outputDir) {
  console.log(`[CSS Compiler] Scanning all TSX files for responsive classes...`);

  // Scanner tous les fichiers .tsx récursivement
  const allClasses = new Set();

  function scanDirectory(dir) {
    if (!fs.existsSync(dir)) return;

    const entries = fs.readdirSync(dir, { withFileTypes: true });

    for (const entry of entries) {
      const fullPath = path.join(dir, entry.name);

      if (entry.isDirectory()) {
        scanDirectory(fullPath);
      } else if (entry.isFile() && entry.name.endsWith('.tsx')) {
        const classes = extractClassesFromFile(fullPath);
        classes.forEach(cls => allClasses.add(cls));
      }
    }
  }

  scanDirectory(outputDir);

  console.log(`[CSS Compiler] Found ${allClasses.size} unique responsive classes`);

  if (allClasses.size === 0) {
    return '';
  }

  // Générer le CSS
  const css = generateResponsiveCSS(allClasses);

  console.log(`[CSS Compiler] Generated ${css.split('\n').length} lines of CSS`);

  return css;
}

/**
 * Compile les classes responsive pour chaque composant individuellement
 * et ajoute le CSS compilé à la fin de chaque fichier CSS de composant
 *
 * @param {string} outputDir - Dossier de sortie contenant components/
 */
export function compileResponsiveClassesPerComponent(outputDir) {
  const componentsDir = path.join(outputDir, 'components');

  if (!fs.existsSync(componentsDir)) {
    console.log('[CSS Compiler] No components/ directory found, skipping per-component compilation');
    return;
  }

  console.log('[CSS Compiler] Compiling responsive classes per component...');

  const files = fs.readdirSync(componentsDir);
  const tsxFiles = files.filter(f => f.endsWith('.tsx'));

  let totalCompiled = 0;

  for (const tsxFile of tsxFiles) {
    const componentName = tsxFile.replace('.tsx', '');
    const tsxPath = path.join(componentsDir, tsxFile);
    const cssPath = path.join(componentsDir, `${componentName}.css`);

    // Extraire les classes responsive de ce composant
    const classes = extractClassesFromFile(tsxPath);

    if (classes.size === 0) {
      console.log(`   ⏭️  ${componentName}: no responsive classes`);
      continue;
    }

    // Générer le CSS pour ces classes
    const compiledCSS = generateResponsiveCSS(classes);

    if (!compiledCSS) {
      continue;
    }

    // Lire le CSS existant du composant
    let existingCSS = '';
    if (fs.existsSync(cssPath)) {
      existingCSS = fs.readFileSync(cssPath, 'utf8');
    }

    // Vérifier si le CSS compilé existe déjà (éviter les doublons)
    if (existingCSS.includes('/* RESPONSIVE CSS - Auto-generated */')) {
      // Supprimer l'ancien CSS compilé
      existingCSS = existingCSS.replace(
        /\/\* =========================================.*?(?=\/\*|$)/gs,
        ''
      ).trim();
    }

    // Ajouter le CSS compilé à la fin
    const finalCSS = existingCSS + '\n\n' + compiledCSS;

    // Écrire le fichier CSS mis à jour
    fs.writeFileSync(cssPath, finalCSS);

    console.log(`   ✅ ${componentName}: ${classes.size} responsive classes compiled`);
    totalCompiled += classes.size;
  }

  console.log(`[CSS Compiler] Compiled ${totalCompiled} responsive classes across ${tsxFiles.length} components`);
}

/**
 * Utilitaire pour tester le compilateur en standalone
 */
export function testCompiler(outputDir) {
  const css = compileResponsiveClasses(outputDir);
  console.log('\n===== GENERATED CSS =====\n');
  console.log(css);
  return css;
}
