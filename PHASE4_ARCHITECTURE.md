# PHASE 4: Responsive Merger - Architecture Technique

**Date:** 2025-11-10
**Approche:** CSS-Pure (100% CSS-only, générique)
**Objectif:** Fusionner N composants modulaires de 3 breakpoints en composants responsive

---

## 🎯 Principes de Design

### 1. Généricité
- ✅ Fonctionne avec **n'importe quel nombre de composants** (pas hardcodé à 6)
- ✅ Détection automatique des composants communs
- ✅ Gestion des composants manquants (desktop-only, mobile-only)
- ✅ Gestion automatique des différences structurelles (Header: 28→21 éléments)

### 2. Maintenabilité
- ✅ Code modulaire avec fonctions réutilisables
- ✅ Commentaires clairs et documentation inline
- ✅ Logs détaillés pour debugging
- ✅ Gestion d'erreurs robuste

### 3. Intégration
- ✅ S'intègre au workflow existant (compatible avec figma-cli.js)
- ✅ Utilise les structures existantes (modular/, metadata.json)
- ✅ Génère les outputs attendus par le dashboard
- ✅ Pas de duplication de code

### 4. Simplicité
- ✅ Approche CSS-pure uniquement (pas de component-swap)
- ✅ Pas de dépendances externes supplémentaires
- ✅ Algorithme de fusion CSS simple et compréhensible

---

## 📊 Flow Complet

```
INPUT (3 breakpoints)
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Desktop: src/generated/tests/node-XXX-desktop/
  └─ modular/
     ├─ Header.tsx         (28 éléments JSX)
     ├─ Header.css         (7KB, classes desktop)
     ├─ Footer.tsx
     ├─ Footer.css
     └─ ... (autres composants)

Tablet: src/generated/tests/node-XXX-tablet/
  └─ modular/
     ├─ Header.tsx         (28 éléments JSX)
     ├─ Header.css         (6KB, classes tablet)
     └─ ...

Mobile: src/generated/tests/node-XXX-mobile/
  └─ modular/
     ├─ Header.tsx         (21 éléments JSX)  ← Différence
     ├─ Header.css         (5KB, classes mobile)
     └─ ...

          ↓

PROCESSING
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
1. Détection automatique des composants communs
   → Scan modular/ directories
   → Trouve: Header, Footer, ... (6 composants)

2. Pour chaque composant:
   a) Copier JSX Desktop (structure de référence)
   b) Lire CSS des 3 breakpoints
   c) Merger CSS avec media queries
   d) Écrire Header.tsx + Header.css responsive

3. Générer metadata.json (pour dashboard)

          ↓

OUTPUT (1 export fusionné)
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Merged: src/generated/tests/test-merged-TIMESTAMP/
  ├─ components/
  │  ├─ Header.tsx          (structure Desktop: 28 éléments)
  │  ├─ Header.css          (CSS responsive avec media queries)
  │  ├─ Footer.tsx
  │  ├─ Footer.css
  │  └─ ... (tous les composants)
  └─ metadata.json          (info pour dashboard)
```

---

## 🏗️ Architecture du Script

### Fichier: `scripts/responsive-merger.js`

```javascript
#!/usr/bin/env node
/**
 * Responsive Merger - CSS-Pure Approach
 *
 * Merges modular components from 3 breakpoints into responsive components
 * using pure CSS media queries (no React variants).
 *
 * Usage:
 *   node scripts/responsive-merger.js \
 *     <desktopDir> <tabletDir> <mobileDir> \
 *     --output <mergedDir>
 *
 * Input: 3 test directories with modular/ subdirectories
 * Output: 1 merged directory with responsive components
 */

import fs from 'fs';
import path from 'path';

// ═══════════════════════════════════════════════════════════════
// MAIN FUNCTION
// ═══════════════════════════════════════════════════════════════

async function mergeBreakpoints(desktopDir, tabletDir, mobileDir, outputDir) {
  console.log('🔄 Starting responsive merge (CSS-Pure approach)...\n');

  // 1. Detect common components (generic)
  const commonComponents = detectCommonComponents(desktopDir, tabletDir, mobileDir);

  if (commonComponents.length === 0) {
    console.error('❌ No common components found');
    process.exit(1);
  }

  console.log(`✅ Found ${commonComponents.length} common components\n`);

  // 2. Create output structure
  const componentsDir = path.join(outputDir, 'components');
  fs.mkdirSync(componentsDir, { recursive: true });

  // 3. Merge each component
  let successCount = 0;
  let errorCount = 0;

  for (const componentName of commonComponents) {
    try {
      await mergeComponent(
        componentName,
        desktopDir, tabletDir, mobileDir,
        componentsDir
      );
      successCount++;
    } catch (error) {
      console.error(`❌ Error merging ${componentName}: ${error.message}`);
      errorCount++;
    }
  }

  // 4. Generate metadata
  generateMetadata(outputDir, commonComponents, { successCount, errorCount });

  console.log(`\n✅ Merge complete!`);
  console.log(`   Success: ${successCount}/${commonComponents.length}`);
  if (errorCount > 0) {
    console.log(`   Errors:  ${errorCount}`);
  }
}

// ═══════════════════════════════════════════════════════════════
// COMPONENT DETECTION (Generic)
// ═══════════════════════════════════════════════════════════════

function detectCommonComponents(desktopDir, tabletDir, mobileDir) {
  const getComponents = (dir) => {
    const modularDir = path.join(dir, 'modular');
    if (!fs.existsSync(modularDir)) return [];

    return fs.readdirSync(modularDir)
      .filter(f => f.endsWith('.tsx'))
      .map(f => path.basename(f, '.tsx'))
      .sort();
  };

  const desktopComps = getComponents(desktopDir);
  const tabletComps = getComponents(tabletDir);
  const mobileComps = getComponents(mobileDir);

  // Find common components (present in all 3)
  const allComps = new Set([...desktopComps, ...tabletComps, ...mobileComps]);
  const common = [...allComps].filter(name =>
    desktopComps.includes(name) &&
    tabletComps.includes(name) &&
    mobileComps.includes(name)
  );

  console.log('📊 Component Detection:');
  console.log(`   Desktop: ${desktopComps.length} components`);
  console.log(`   Tablet:  ${tabletComps.length} components`);
  console.log(`   Mobile:  ${mobileComps.length} components`);
  console.log(`   Common:  ${common.length} components\n`);

  return common;
}

// ═══════════════════════════════════════════════════════════════
// COMPONENT MERGER (CSS-Pure)
// ═══════════════════════════════════════════════════════════════

async function mergeComponent(
  componentName,
  desktopDir, tabletDir, mobileDir,
  outputDir
) {
  console.log(`🔄 Merging ${componentName}...`);

  // 1. Copy Desktop JSX (reference structure)
  const desktopJSX = fs.readFileSync(
    path.join(desktopDir, 'modular', `${componentName}.tsx`),
    'utf8'
  );

  fs.writeFileSync(
    path.join(outputDir, `${componentName}.tsx`),
    desktopJSX
  );

  // 2. Merge CSS with media queries
  const desktopCSS = readCSS(desktopDir, componentName);
  const tabletCSS = readCSS(tabletDir, componentName);
  const mobileCSS = readCSS(mobileDir, componentName);

  const responsiveCSS = mergeCSS(
    desktopCSS,
    tabletCSS,
    mobileCSS,
    componentName
  );

  fs.writeFileSync(
    path.join(outputDir, `${componentName}.css`),
    responsiveCSS
  );

  console.log(`   ✅ ${componentName}.tsx + .css`);
}

function readCSS(dir, componentName) {
  const cssPath = path.join(dir, 'modular', `${componentName}.css`);
  return fs.existsSync(cssPath) ? fs.readFileSync(cssPath, 'utf8') : '';
}

// ═══════════════════════════════════════════════════════════════
// CSS MERGER (Core Algorithm)
// ═══════════════════════════════════════════════════════════════

function mergeCSS(desktopCSS, tabletCSS, mobileCSS, componentName) {
  // Parse CSS into sections
  const desktopSections = parseCSSIntoSections(desktopCSS);
  const tabletSections = parseCSSIntoSections(tabletCSS);
  const mobileSections = parseCSSIntoSections(mobileCSS);

  let merged = `/* Auto-generated responsive CSS for ${componentName} */\n`;
  merged += `/* Generated by responsive-merger.js */\n\n`;

  // 1. Google Fonts (from desktop)
  if (desktopSections.imports) {
    merged += desktopSections.imports + '\n\n';
  }

  // 2. :root variables (merged from all 3)
  const rootVars = mergeRootVariables([
    desktopSections.root,
    tabletSections.root,
    mobileSections.root
  ]);
  if (rootVars) {
    merged += rootVars + '\n\n';
  }

  // 3. Utility classes (Figma-specific, from desktop)
  if (desktopSections.utilities) {
    merged += desktopSections.utilities + '\n\n';
  }

  // 4. Desktop styles (default - no media query)
  merged += '/* ========== Desktop Styles (Default) ========== */\n';
  merged += desktopSections.customClasses + '\n\n';

  // 5. Tablet overrides (media query)
  const tabletDiff = getClassDifferences(
    desktopSections.customClasses,
    tabletSections.customClasses
  );

  if (tabletDiff.trim()) {
    merged += '/* ========== Tablet Overrides (≤960px) ========== */\n';
    merged += '@media (max-width: 960px) {\n';
    merged += indentCSS(tabletDiff);
    merged += '}\n\n';
  }

  // 6. Mobile overrides (media query)
  const mobileDiff = getClassDifferences(
    tabletSections.customClasses,
    mobileSections.customClasses
  );

  if (mobileDiff.trim()) {
    merged += '/* ========== Mobile Overrides (≤420px) ========== */\n';
    merged += '@media (max-width: 420px) {\n';
    merged += indentCSS(mobileDiff);
    merged += '}\n';
  }

  return merged;
}

// ═══════════════════════════════════════════════════════════════
// CSS PARSING HELPERS
// ═══════════════════════════════════════════════════════════════

function parseCSSIntoSections(css) {
  return {
    imports: extractImports(css),
    root: extractRoot(css),
    utilities: extractUtilities(css),
    customClasses: extractCustomClasses(css)
  };
}

function extractImports(css) {
  const regex = /@import[^;]+;/g;
  const matches = css.match(regex);
  return matches ? matches.join('\n') : '';
}

function extractRoot(css) {
  const regex = /:root\s*\{[^}]+\}/s;
  const match = css.match(regex);
  return match ? match[0] : '';
}

function extractUtilities(css) {
  // Figma utilities: .content-start, .content-end, etc.
  const regex = /\/\* Figma-specific utility classes \*\/\n([\s\S]*?)(?=\n\/\*|$)/;
  const match = css.match(regex);
  return match ? match[0] : '';
}

function extractCustomClasses(css) {
  // Everything after "===== 3." or similar section markers
  const regex = /\/\* ===== [3-9]\..*?\*\/[\s\S]*$/;
  const match = css.match(regex);
  return match ? match[0] : css; // Fallback to full CSS if no marker
}

// ═══════════════════════════════════════════════════════════════
// CSS DIFFING
// ═══════════════════════════════════════════════════════════════

function getClassDifferences(baseCSS, targetCSS) {
  const baseClasses = parseClassDefinitions(baseCSS);
  const targetClasses = parseClassDefinitions(targetCSS);

  let diff = '';

  for (const [className, targetDef] of targetClasses) {
    const baseDef = baseClasses.get(className);

    // Include if: new class OR different definition
    if (!baseDef || baseDef !== targetDef) {
      diff += targetDef + '\n';
    }
  }

  return diff;
}

function parseClassDefinitions(css) {
  const map = new Map();
  const regex = /\.([a-z0-9_-]+)\s*\{([^}]+)\}/gi;
  let match;

  while ((match = regex.exec(css)) !== null) {
    const className = match[1];
    const definition = `.${className} {${match[2]}}`;
    map.set(className, definition);
  }

  return map;
}

// ═══════════════════════════════════════════════════════════════
// UTILITY FUNCTIONS
// ═══════════════════════════════════════════════════════════════

function mergeRootVariables(rootSections) {
  const vars = new Map();

  rootSections.forEach(section => {
    if (!section) return;

    const varPattern = /(--[a-z0-9-]+):\s*([^;]+);/g;
    let match;

    while ((match = varPattern.exec(section)) !== null) {
      vars.set(match[1], match[2]);
    }
  });

  if (vars.size === 0) return '';

  let root = ':root {\n';
  for (const [varName, value] of vars) {
    root += `  ${varName}: ${value};\n`;
  }
  root += '}';

  return root;
}

function indentCSS(css) {
  return css.split('\n')
    .map(line => line ? '  ' + line : line)
    .join('\n');
}

function generateMetadata(outputDir, components, stats) {
  const metadata = {
    timestamp: new Date().toISOString(),
    type: 'responsive-merged',
    componentsCount: components.length,
    components: components,
    mergeStats: stats
  };

  fs.writeFileSync(
    path.join(outputDir, 'metadata.json'),
    JSON.stringify(metadata, null, 2)
  );
}

// ═══════════════════════════════════════════════════════════════
// CLI
// ═══════════════════════════════════════════════════════════════

const args = process.argv.slice(2);
const outputIndex = args.indexOf('--output');

if (outputIndex === -1 || args.length < 4) {
  console.error('Usage: node responsive-merger.js <desktopDir> <tabletDir> <mobileDir> --output <mergedDir>');
  process.exit(1);
}

const desktopDir = args[0];
const tabletDir = args[1];
const mobileDir = args[2];
const outputDir = args[outputIndex + 1];

mergeBreakpoints(desktopDir, tabletDir, mobileDir, outputDir)
  .catch(err => {
    console.error('Error:', err);
    process.exit(1);
  });
```

---

## 🔍 Algorithme de Fusion CSS Détaillé

### Étape 1: Parsing CSS

```javascript
Input: CSS file (example)
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
@import url('https://fonts.googleapis.com/...');

:root {
  --header-padding: 24px;
}

/* Figma-specific utility classes */
.content-start { ... }

/* ===== 3. Custom Classes ===== */
.header { display: flex; padding: 24px; }
.help-menu { display: flex; }

          ↓ parseCSSIntoSections()

Output: Sections object
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
{
  imports: "@import url('...');",
  root: ":root { --header-padding: 24px; }",
  utilities: ".content-start { ... }",
  customClasses: ".header { ... }\n.help-menu { ... }"
}
```

### Étape 2: Class Diffing

```javascript
Base (Desktop):    Target (Tablet):    Diff Result:
━━━━━━━━━━━━━━━    ━━━━━━━━━━━━━━━━    ━━━━━━━━━━━━━━━━
.header {          .header {           .header {
  padding: 24px;     padding: 16px;      padding: 16px;  ← Changed
}                  }                   }

.help-menu {       .help-menu {        (not included - same)
  display: flex;     display: flex;
}                  }
```

### Étape 3: Media Query Generation

```javascript
Desktop CSS (default):
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
.header { padding: 24px; }
.help-menu { display: flex; }

Tablet Diff:
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
@media (max-width: 960px) {
  .header { padding: 16px; }  ← Only changed properties
}

Mobile Diff:
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
@media (max-width: 420px) {
  .header { padding: 12px; }
  .help-menu { display: none; }  ← New rule
}
```

---

## 🧪 Tests & Validation

### Test 1: Fusion Basique (5 composants identiques)

```bash
# Input
Desktop/Tablet/Mobile: Header, Footer, AccountOverview, Quickactions, Titlesection
Structures: 100% identiques (hash match)

# Expected Output
5 composants avec CSS responsive
Media queries contiennent uniquement les différences (padding, spacing)

# Validation
✅ Tous les composants fusionnés
✅ CSS valide (pas de doublons)
✅ Taille CSS réduite (vs 3 fichiers séparés)
```

### Test 2: Fusion avec Différence Mineure (Header: 28→21 éléments)

```bash
# Input
Desktop/Tablet: Header avec help-menu (28 éléments)
Mobile: Header sans help-menu (21 éléments)

# Expected Output
Header.tsx: structure Desktop (28 éléments, avec help-menu)
Header.css:
  - Desktop: .help-menu { display: flex; }
  - Mobile: @media { .help-menu { display: none; } }

# Validation
✅ JSX Desktop copié
✅ Help menu présent dans JSX
✅ Media query masque help-menu sur mobile
✅ Pas d'erreurs de rendu
```

### Test 3: Composant Manquant

```bash
# Input
Desktop: Header, Footer, Special
Tablet:  Header, Footer
Mobile:  Header, Footer

# Expected Behavior
Détection: 2 composants communs (Header, Footer)
Warning: "Special" présent uniquement sur Desktop (ignoré)

# Output
2 composants fusionnés
metadata.json: { componentsCount: 2 }
```

---

## 🔄 Intégration avec le Flow Existant

### Option A: Standalone (Manuel)

```bash
# Utilisation standalone (tests manuels)
node scripts/responsive-merger.js \
  src/generated/tests/node-6055-2436-1762733564 \
  src/generated/tests/node-6055-2654-1762712319 \
  src/generated/tests/node-6055-2872-1762733537 \
  --output src/generated/tests/test-merged-1762734000
```

### Option B: Intégré (Via API - PHASE 3)

```javascript
// server.js (PHASE 3)
app.post('/api/tests/merge', async (req, res) => {
  const { testIds } = req.body; // [desktop, tablet, mobile]

  const mergedId = `test-merged-${Date.now()}`;
  const mergedDir = path.join(__dirname, 'src/generated/tests', mergedId);

  const { spawn } = require('child_process');
  const merger = spawn('node', [
    'scripts/responsive-merger.js',
    ...testIds.map(id => path.join('src/generated/tests', id)),
    '--output', mergedDir
  ]);

  merger.on('close', (code) => {
    // Notify via SSE
  });

  res.json({ success: true, mergedId });
});
```

---

## 📈 Performance & Optimisation

### Métriques Attendues

| Métrique | Valeur | Note |
|----------|--------|------|
| Temps de fusion (6 composants) | < 2 secondes | Lecture + parsing + écriture |
| Taille CSS finale | -40% vs 3 fichiers séparés | Dédupli + media queries |
| Mémoire utilisée | < 50MB | Traitement synchrone simple |
| Lignes de code script | ~300 lignes | Maintenable |

### Optimisations Futures (Si Nécessaire)

1. **Cache des parsings CSS** (si réutilisation fréquente)
2. **Parallélisation** (traiter plusieurs composants en parallèle)
3. **CSS minification** (optionnel, pour production)

---

## 🚀 Plan d'Implémentation

### Étape 1: Core Script (2 jours)

- [ ] Créer `scripts/responsive-merger.js`
- [ ] Implémenter `detectCommonComponents()`
- [ ] Implémenter `mergeComponent()`
- [ ] Implémenter `mergeCSS()` (parsing + diffing)
- [ ] Tests manuels avec les 3 exports existants

### Étape 2: CSS Algorithm (2 jours)

- [ ] Parser CSS sections (imports, root, utilities, custom)
- [ ] Algorithme de diff (getClassDifferences)
- [ ] Génération media queries
- [ ] Tests: Header (28→21), autres composants (100% identiques)

### Étape 3: Validation & Polish (1-2 jours)

- [ ] Tests visuels (comparer Figma vs Merged)
- [ ] Vérifier media queries fonctionnent (responsive preview)
- [ ] Logging & error handling
- [ ] Documentation inline

### Étape 4: Metadata & Integration (1 jour)

- [ ] Générer metadata.json (pour dashboard)
- [ ] Tester intégration avec workflow existant
- [ ] Tests edge cases (composants manquants, etc.)

**Total: 5-7 jours** ✅

---

## ✅ Checklist de Validation

### Avant de démarrer

- [x] Architecture clarifiée
- [x] Approche CSS-pure confirmée
- [x] Généricité validée (fonctionne avec n composants)
- [ ] **Approbation de l'architecture**

### Pendant l'implémentation

- [ ] Script responsive-merger.js créé
- [ ] Tests avec les 3 exports (6 composants)
- [ ] Validation visuelle (Figma vs Merged)
- [ ] Edge cases testés

### Après l'implémentation

- [ ] 6 composants fusionnés avec succès
- [ ] CSS responsive valide
- [ ] Pas d'erreurs de rendu
- [ ] Metadata.json généré
- [ ] Prêt pour PHASE 3 (UI Dashboard)

---

## 🔗 Références

- **PHASE 1 Summary:** [PHASE1_SUMMARY.md](PHASE1_SUMMARY.md)
- **PHASE 2 Analysis:** [PHASE2_ANALYSIS_RESULTS.md](PHASE2_ANALYSIS_RESULTS.md)
- **PHASE 2 Recommendations:** [PHASE2_RECOMMENDATIONS.md](PHASE2_RECOMMENDATIONS.md)
- **Roadmap:** [ROADMAP_RESPONSIVE_PUCK.md](ROADMAP_RESPONSIVE_PUCK.md)

---

**Dernière mise à jour:** 2025-11-10
**Status:** 📋 Architecture définie - En attente d'approbation
**Prochaine étape:** Implémentation responsive-merger.js (5-7 jours)
