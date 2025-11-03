# ANALYSE APPROFONDIE: ORDRE DES TRANSFORMATIONS & REFACTORING

**Date:** 2025-11-03
**Objectif:** Comprendre les dépendances, identifier les problèmes d'architecture, proposer refactoring scalable

---

## 📋 TABLE DES MATIÈRES

1. [Ordre actuel et dépendances](#ordre-actuel-et-dépendances)
2. [Problèmes architecturaux](#problèmes-architecturaux)
3. [Analyse de faisabilité refactoring](#analyse-de-faisabilité-refactoring)
4. [Outils et frameworks reconnus](#outils-et-frameworks-reconnus)
5. [Proposition d'architecture](#proposition-darchitecture)
6. [Plan de migration](#plan-de-migration)

---

## 🔄 ORDRE ACTUEL ET DÉPENDANCES

### Vue d'ensemble du pipeline actuel

```
┌─────────────────────────────────────────────────────────────────────┐
│ PHASE 3: TRANSFORMATIONS AST (unified-processor.js)                 │
│                                                                      │
│ 1. Parse AST (Babel parser)                                         │
│    ↓                                                                 │
│ 2. Single Traversal avec visiteurs:                                 │
│    ├─ JSXText → detectSection()                                     │
│    └─ JSXElement → SÉQUENCE ORDONNÉE ⚠️                             │
│                                                                      │
│ ORDRE CRITIQUE DANS JSXElement:                                     │
│                                                                      │
│ [0] FONT DETECTION ⚠️ DOIT ÊTRE PREMIER                             │
│     • Lit: font-['Poppins:Bold']                                    │
│     • Écrit: inline style { fontFamily, fontWeight }                │
│     • ⚠️ AVANT cleanClasses qui supprime font-[...]                 │
│     ├─ Dépendance: primaryFont (de variables.json)                  │
│     └─ Mutate: attributes (ajoute/modifie style)                    │
│                                                                      │
│ [1] AST CLEANING                                                    │
│     [1a] addOverflowXHidden()                                       │
│          • Condition: rootContainerProcessed flag (stateful!)       │
│          • Mutate: className (ajoute overflow-x-hidden)             │
│                                                                      │
│     [1b] addWidthToFlexGrow()                                       │
│          • Lit: className (cherche basis-0 grow)                    │
│          • Mutate: className (ajoute w-full)                        │
│                                                                      │
│     [1c] cleanClasses() ⚠️ DOIT ÊTRE APRÈS FONT DETECTION           │
│          • Lit: className                                           │
│          • Supprime: font-['...'] (déjà converti en inline)         │
│          • Supprime: text-nowrap whitespace-pre                     │
│          • Mutate: className                                        │
│                                                                      │
│     [1d] convertTextSizes()                                         │
│          • Lit: className                                           │
│          • Convertit: text-[16px] → text-base                       │
│          • Mutate: className                                        │
│                                                                      │
│ [1.5] SVG COMPOSITE INLINING ⚠️ STRUCTURE MUTATION                  │
│       inlineSVGComposites()                                         │
│       • Lit: children (tous les <img> enfants)                      │
│       • Analyse: 3+ img avec absolute+inset                         │
│       • Système de fichiers: lit SVG sources                        │
│       • Système de fichiers: écrit SVG merged                       │
│       • Mutate: REPLACE entier node par nouveau <img>               │
│       • Mutate: AST program (ajoute import)                         │
│       └─ ⚠️ Peut causer skip des transformations suivantes!         │
│                                                                      │
│ [1.6] SVG STRUCTURE FIXES ⚠️ STRUCTURE MUTATION                     │
│       flattenAbsoluteImgWrappers()                                  │
│       • Lit: node structure (div > img)                             │
│       • Mutate: REPLACE div par img (flatten)                       │
│       └─ ⚠️ Peut causer skip des transformations suivantes!         │
│                                                                      │
│ [2] POST-PROCESSING FIXES                                           │
│     [2a] fixMultiStopGradient()                                     │
│          • Lit: data-name attribute                                 │
│          • Condition: includes('Fill_Gradient_Linear_MultiStop')    │
│          • Mutate: style attribute (ajoute gradient)                │
│                                                                      │
│     [2b] fixRadialGradient()                                        │
│          • Lit: data-name attribute                                 │
│          • Condition: includes('Fill_Gradient_Radial')              │
│          • Mutate: style attribute                                  │
│                                                                      │
│     [2c] fixShapesContainer()                                       │
│          • Lit: data-name attribute                                 │
│          • Condition: includes('Node_Container_Shapes')             │
│          • Mutate: children (REPLACE avec SVG)                      │
│                                                                      │
│     [2d] verifyBlendMode()                                          │
│          • Lit: data-name, className                                │
│          • Action: verification + warning (pas de mutation)         │
│                                                                      │
│ [3] CSS VARIABLES CONVERSION ⚠️ ORDRE IMPORTANT                     │
│     convertCSSVarsInClass()                                         │
│     • Lit: className                                                │
│     • Détecte: p-[var(--margin/r,32px)]                             │
│     • Génère: p-margin-r                                            │
│     • Side-effect: customCSSClasses Map (global state!)             │
│     • Mutate: className                                             │
│     • ⚠️ DOIT être AVANT Tailwind Optimizer                         │
│                                                                      │
│ [4] TAILWIND OPTIMIZATION                                           │
│     optimizeTailwindClasses()                                       │
│     • Lit: className (après CSS vars conversion)                    │
│     • Convertit: gap-[8px] → gap-2                                  │
│     • Mutate: className                                             │
│     • ⚠️ DOIT être APRÈS CSS vars (sinon peut casser var patterns)  │
│                                                                      │
│ 3. Generate Code (Babel generator)                                  │
│    ↓                                                                 │
│ 4. SAFETY NET (Regex sur code STRING) ⚠️ POST-AST                   │
│    applySafetyNetRegex()                                            │
│    • Lit: code généré (string)                                      │
│    • Détecte: vars échappées (edge cases AST)                       │
│    • Mutate: code string (regex replace)                            │
│    • Side-effect: customCSSClasses Map (global)                     │
│    ↓                                                                 │
│ 5. Generate CSS File                                                │
│    • Lit: customCSSClasses Map                                      │
│    • Lit: cssVariables (de variables.json)                          │
│    • Lit: primaryFont, googleFontsUrl                               │
│    • Écrit: Component-fixed.css                                     │
│                                                                      │
└─────────────────────────────────────────────────────────────────────┘
```

---

## ⚠️ DÉPENDANCES CRITIQUES IDENTIFIÉES

### 1. Ordre STRICT requis (breaking changes si inversé)

| Transformation A | DOIT être avant | Transformation B | Raison |
|-----------------|-----------------|------------------|--------|
| **Font Detection** | ← | **cleanClasses** | cleanClasses supprime `font-[...]` que Font Detection lit |
| **CSS Vars Conversion** | ← | **Tailwind Optimizer** | Optimizer peut casser patterns `var(...)` |
| **SVG Composites** | ← | **Autres transformations** | REPLACE node → skip visiteurs suivants |
| **SVG Flatten** | ← | **Autres transformations** | REPLACE node → skip visiteurs suivants |

---

### 2. État global partagé (problématique!)

#### 2.1 `customCSSClasses` Map (css-vars.js)
```javascript
export const customCSSClasses = new Map()
```

**Problème:**
- Partagé entre imports
- Muté par `convertCSSVarsInClass()` (AST phase)
- Muté par `applySafetyNetRegex()` (post-AST phase)
- Lu par génération CSS finale
- ⚠️ Pas thread-safe (si parallélisation future)
- ⚠️ Doit être clear() entre fichiers

**Actuellement clear ici:**
```javascript
// unified-processor.js ligne 306
customCSSClasses.clear()
```

---

#### 2.2 `rootContainerProcessed` flag (ast-cleaning.js)
```javascript
let rootContainerProcessed = false

export function resetRootContainer() {
  rootContainerProcessed = false
}
```

**Problème:**
- État mutable au niveau module
- Doit être reset manuellement avant chaque fichier
- ⚠️ Bug potentiel si oubli reset

**Actuellement reset ici:**
```javascript
// unified-processor.js ligne 309
astCleaning.resetRootContainer()
```

---

### 3. Mutations structurales dangereuses

#### 3.1 `inlineSVGComposites()` et `flattenAbsoluteImgWrappers()`

**Problème:**
```javascript
// Ces fonctions appellent path.replaceWith()
path.replaceWith(newNode)
```

**Impact:**
- Le node remplacé n'est PAS revisité par les visiteurs suivants
- Si SVG composite est détecté tôt, les transformations CSS vars, Tailwind optimizer ne s'appliquent PAS au nouveau node

**Exemple problématique:**
```tsx
// AVANT transformation
<div className="h-[70px] w-48 p-[var(--margin-r,32px)]">
  <img src="logo.svg" absolute />
  <img src="logo.svg" absolute />
  <img src="logo.svg" absolute />
</div>

// APRÈS inlineSVGComposites (ligne 486)
<img src="logo-merged.svg" className="h-[70px] w-48" />
             //                                   ↑
             // ❌ p-[var(...)] perdu! Car pas encore converti par CSS vars!
```

**Timing du problème:**
- SVG Composites = Phase 1.5
- CSS Vars = Phase 3
- → Le nouveau `<img>` créé en Phase 1.5 ne passe jamais par Phase 3!

---

### 4. Dépendances externes (I/O système)

#### 4.1 Lecture fichiers SVG (inlineSVGComposites)
```javascript
// Lit fichiers SVG durant traversal AST
const svgContent = fs.readFileSync(svgFilePath, 'utf8')
```

**Problème:**
- I/O synchrone durant traversal AST
- Performance: bloque le parsing
- Testabilité: difficile à mocker

---

#### 4.2 Écriture fichiers SVG (inlineSVGComposites)
```javascript
// Écrit merged SVG durant traversal AST
fs.writeFileSync(svgFilePath, mergedSVG, 'utf8')
```

**Problème:**
- Side-effect durant transformation
- Si transformation échoue après, fichier créé reste (orphelin)
- Pas de rollback possible

---

## 🔴 PROBLÈMES ARCHITECTURAUX

### 1. Couplage fort entre transformations

**Actuel:**
```javascript
// unified-processor.js - TOUT dans un fichier
traverse.default(ast, {
  JSXElement(path) {
    // Phase 0
    if (classNameAttr && t.isStringLiteral(classNameAttr.value) && primaryFont) {
      // Font detection inline (60 lignes)
    }

    // Phase 1
    if (astCleaning.addOverflowXHidden(path)) { ... }
    if (astCleaning.addWidthToFlexGrow(path)) { ... }
    if (astCleaning.cleanClasses(path)) { ... }

    // Phase 1.5
    if (svgIconFixes.inlineSVGComposites(path, inputDir)) { ... }

    // ... etc (500+ lignes dans 1 fonction)
  }
})
```

**Problèmes:**
- ❌ Impossible de désactiver une transformation sélectivement
- ❌ Impossible de réordonner sans modifier code
- ❌ Impossible de tester transformations isolément
- ❌ Difficile d'ajouter nouvelles transformations

---

### 2. Configuration en dur (hardcoded)

**Actuel:**
```javascript
// Ordre des transformations = ordre du code
// Pas de config externe
// Pas de flags feature
```

**Besoins futurs:**
```javascript
// Voudrais pouvoir:
--enable-responsive-transform
--disable-svg-composite-merge
--transform-order="fonts,cleaning,css-vars"
```

---

### 3. Pas de gestion d'erreurs granulaire

**Actuel:**
```javascript
// Si une transformation échoue → TOUT échoue
try {
  ast = parser.parse(sourceCode)
} catch (error) {
  console.error(`❌ AST parsing failed`)
  process.exit(1)
}
```

**Besoin:**
- Continue sur erreur (skip transformation)
- Reporting détaillé (quelle transformation a échoué)
- Rollback partiel possible

---

### 4. Debugging difficile

**Actuel:**
- Single traversal = pas de snapshot intermédiaire
- Impossible de voir AST après chaque transformation
- Stats globales uniquement (fixes.classesOptimized++)

**Besoin:**
- Dump AST après chaque phase
- Diff before/after pour chaque transformation
- Verbose mode avec timing

---

### 5. Performance: Trade-offs non mesurés

**Actuel:**
```javascript
// "Single pass = 50% faster"
// Mais... preuve?
```

**Questions:**
- Est-ce vraiment 50% plus rapide?
- Benchmark multi-pass vs single-pass?
- Coût I/O (SVG reads) vs parsing?

---

## 🛠️ OUTILS ET FRAMEWORKS RECONNUS

### Option 1: **jscodeshift** (Facebook)

**Description:**
- Framework de codemods (automated code transformations)
- Utilisé par React, Jest, etc. pour migrations
- API haut niveau sur Babel/Recast

**Avantages:**
```javascript
// API élégante pour transformations
module.exports = function transformer(fileInfo, api) {
  const j = api.jscodeshift
  const root = j(fileInfo.source)

  // Find all className attributes
  root.find(j.JSXAttribute, {
    name: { name: 'className' }
  })
  .forEach(path => {
    // Transform...
  })

  return root.toSource()
}
```

**✅ Pros:**
- Testable (test framework intégré)
- Composable (chain transformations)
- Runner intégré (parallélisation)
- Communauté active

**❌ Cons:**
- Learning curve
- Abstractions parfois limitantes
- Moins de contrôle bas niveau que Babel direct

---

### Option 2: **ts-morph** (TypeScript AST)

**Description:**
- Wrapper TypeScript-first sur ts-compiler API
- Simplifie manipulation AST TypeScript

**Avantages:**
```typescript
import { Project } from "ts-morph"

const project = new Project()
const sourceFile = project.addSourceFileAtPath("Component.tsx")

// API fluide
sourceFile.getDescendantsOfKind(SyntaxKind.JsxElement)
  .forEach(element => {
    const className = element.getAttribute("className")
    // Transform...
  })
```

**✅ Pros:**
- Type-safe (TypeScript native)
- API très haut niveau
- Refactoring tools built-in

**❌ Cons:**
- TypeScript seulement (pas JSX pure)
- Plus lourd (compile TS)
- Moins utilisé pour codemods

---

### Option 3: **Babel Plugin System**

**Description:**
- Système de plugins natif Babel
- Architecture standard pour transformations

**Avantages:**
```javascript
// babel-plugin-figma-transform.js
module.exports = function({ types: t }) {
  return {
    name: "figma-transform",
    visitor: {
      JSXElement(path, state) {
        // Access options
        const options = state.opts

        // Transform with ordering
      }
    }
  }
}

// Configuration
{
  plugins: [
    ["figma-transform-fonts", { priority: 0 }],
    ["figma-transform-cleaning", { priority: 1 }],
    ["figma-transform-css-vars", { priority: 2 }]
  ]
}
```

**✅ Pros:**
- Standard Babel (déjà utilisé)
- Multi-pass natif
- Configuration externe (babel.config.js)
- Écosystème énorme

**❌ Cons:**
- Multi-pass = performances?
- Complexity (plugin registration, etc.)

---

### Option 4: **AST-grep** (Rust-based)

**Description:**
- Pattern matching pour AST
- Performance extrême (Rust)
- YAML config

**Avantages:**
```yaml
# ast-grep.yml
rules:
  - id: convert-text-sizes
    pattern: className="$$$BEFORE text-[$SIZE] $$$AFTER"
    fix: className="$$$BEFORE text-base $$$AFTER"
```

**✅ Pros:**
- Extrêmement rapide
- Déclaratif (YAML)
- Pas de code JavaScript

**❌ Cons:**
- Limité aux patterns simples
- Pas de logique complexe (conditions, etc.)
- Moins flexible

---

### Option 5: **Architecture Custom (Pipeline Pattern)**

**Description:**
- Système custom de plugins
- Inspired by Babel/Rollup plugin system

**Avantages:**
```javascript
// transform-pipeline.js
class TransformPipeline {
  constructor() {
    this.transforms = []
  }

  use(transform, options = {}) {
    this.transforms.push({
      name: transform.name,
      priority: options.priority || 100,
      fn: transform,
      enabled: options.enabled !== false
    })
    return this
  }

  async run(ast, context) {
    // Sort by priority
    const sorted = this.transforms
      .filter(t => t.enabled)
      .sort((a, b) => a.priority - b.priority)

    // Execute in order with error handling
    for (const transform of sorted) {
      try {
        const snapshot = cloneAST(ast) // Rollback capability
        await transform.fn(ast, context)
        context.stats[transform.name] = { success: true }
      } catch (error) {
        context.stats[transform.name] = { success: false, error }
        if (!context.continueOnError) throw error
      }
    }

    return ast
  }
}

// Usage
const pipeline = new TransformPipeline()
  .use(fontDetectionTransform, { priority: 0 })
  .use(astCleaningTransform, { priority: 10 })
  .use(svgCompositeTransform, { priority: 15 })
  .use(cssVarsTransform, { priority: 30 })
  .use(tailwindOptimizerTransform, { priority: 40 })

await pipeline.run(ast, { continueOnError: true })
```

**✅ Pros:**
- Contrôle total
- Adapté à nos besoins exacts
- Peut intégrer multi-pass ET single-pass
- Testable + configurable

**❌ Cons:**
- Maintenance custom code
- Réinventer roue (plugin system)

---

## 🎯 PROPOSITION D'ARCHITECTURE

### Approche recommandée: **Hybrid (Babel Plugins + Custom Pipeline)**

**Rationale:**
1. ✅ Utilise Babel (déjà utilisé, standard)
2. ✅ Plugins = isolation + testabilité
3. ✅ Custom pipeline = contrôle ordering + error handling
4. ✅ Multi-pass optimisé (caching, skip)

---

### Architecture proposée

```
┌─────────────────────────────────────────────────────────────────────┐
│ TRANSFORMATION PIPELINE v2                                          │
│                                                                      │
│ Configuration (figma-transform.config.js)                           │
│ ┌─────────────────────────────────────────────────────────────────┐ │
│ │ module.exports = {                                              │ │
│ │   transforms: [                                                 │ │
│ │     { name: 'font-detection', priority: 0, enabled: true },     │ │
│ │     { name: 'ast-cleaning', priority: 10 },                     │ │
│ │     { name: 'svg-composites', priority: 15 },                   │ │
│ │     { name: 'css-vars', priority: 30 },                         │ │
│ │     { name: 'tailwind-optimizer', priority: 40 }                │ │
│ │   ],                                                            │ │
│ │   mode: 'multi-pass', // ou 'single-pass' ou 'auto'            │ │
│ │   continueOnError: true,                                        │ │
│ │   debug: { dumpAST: false, timing: true }                       │ │
│ │ }                                                               │ │
│ └─────────────────────────────────────────────────────────────────┘ │
│                                                                      │
│ Pipeline Executor                                                    │
│ ┌─────────────────────────────────────────────────────────────────┐ │
│ │ class FigmaTransformPipeline {                                  │ │
│ │   async execute(sourceCode, config) {                           │ │
│ │     // 1. Parse AST                                             │ │
│ │     let ast = babel.parse(sourceCode)                           │ │
│ │                                                                  │ │
│ │     // 2. Load transforms                                       │ │
│ │     const transforms = this.loadTransforms(config)              │ │
│ │                                                                  │ │
│ │     // 3. Decide strategy                                       │ │
│ │     if (config.mode === 'single-pass') {                        │ │
│ │       return this.runSinglePass(ast, transforms, config)        │ │
│ │     } else {                                                    │ │
│ │       return this.runMultiPass(ast, transforms, config)         │ │
│ │     }                                                            │ │
│ │   }                                                             │ │
│ │                                                                  │ │
│ │   runSinglePass(ast, transforms, config) {                      │ │
│ │     // Combine tous visitors en 1 traversal                     │ │
│ │     const mergedVisitor = this.mergeVisitors(transforms)        │ │
│ │     traverse(ast, mergedVisitor)                                │ │
│ │     return ast                                                  │ │
│ │   }                                                             │ │
│ │                                                                  │ │
│ │   runMultiPass(ast, transforms, config) {                       │ │
│ │     // Execute chaque transform séparément                      │ │
│ │     for (const transform of transforms) {                       │ │
│ │       if (config.debug.dumpAST) {                               │ │
│ │         this.snapshotAST(ast, `before-${transform.name}`)       │ │
│ │       }                                                          │ │
│ │                                                                  │ │
│ │       try {                                                     │ │
│ │         transform.execute(ast, this.context)                    │ │
│ │         this.stats[transform.name] = { success: true }          │ │
│ │       } catch (error) {                                         │ │
│ │         this.handleError(transform, error, config)              │ │
│ │       }                                                          │ │
│ │     }                                                            │ │
│ │     return ast                                                  │ │
│ │   }                                                             │ │
│ │ }                                                               │ │
│ └─────────────────────────────────────────────────────────────────┘ │
│                                                                      │
│ Transforms (Plugins)                                                 │
│ ┌─────────────────────────────────────────────────────────────────┐ │
│ │ transforms/                                                     │ │
│ │ ├── font-detection/                                             │ │
│ │ │   ├── index.js         (export default transform)            │ │
│ │ │   ├── detector.js      (font pattern matching)               │ │
│ │ │   ├── converter.js     (style generation)                    │ │
│ │ │   └── __tests__/       (isolated tests)                      │ │
│ │ │                                                               │ │
│ │ ├── ast-cleaning/                                               │ │
│ │ │   ├── index.js                                                │ │
│ │ │   ├── overflow.js      (overflow-x-hidden)                    │ │
│ │ │   ├── flex-grow.js     (w-full on basis-0 grow)              │ │
│ │ │   ├── clean-classes.js (invalid classes removal)             │ │
│ │ │   ├── text-sizes.js    (text size conversion)                │ │
│ │ │   └── __tests__/                                              │ │
│ │ │                                                               │ │
│ │ ├── svg-composites/                                             │ │
│ │ │   ├── index.js                                                │ │
│ │ │   ├── detector.js      (3+ absolute img detection)           │ │
│ │ │   ├── merger.js        (SVG paths merge)                     │ │
│ │ │   ├── replacer.js      (node replacement)                    │ │
│ │ │   └── __tests__/                                              │ │
│ │ │                                                               │ │
│ │ ├── css-vars/                                                   │ │
│ │ │   ├── index.js                                                │ │
│ │ │   ├── detector.js      (var(...) patterns)                   │ │
│ │ │   ├── class-generator.js (custom CSS classes)                │ │
│ │ │   ├── safety-net.js    (regex fallback)                      │ │
│ │ │   └── __tests__/                                              │ │
│ │ │                                                               │ │
│ │ └── tailwind-optimizer/                                         │ │
│ │     ├── index.js                                                │ │
│ │     ├── mappings.js      (arbitrary → standard)                │ │
│ │     └── __tests__/                                              │ │
│ └─────────────────────────────────────────────────────────────────┘ │
└─────────────────────────────────────────────────────────────────────┘
```

---

### Structure d'un Transform Plugin

```javascript
// transforms/font-detection/index.js
import * as t from '@babel/types'

export default class FontDetectionTransform {
  constructor(options = {}) {
    this.options = options
    this.name = 'font-detection'
    this.priority = 0 // Must run FIRST
  }

  // Declare dependencies on context
  static requires = ['variables', 'primaryFont']

  // Declare what this transform mutates
  static mutates = ['attributes.style']

  // Main entry point
  execute(ast, context) {
    const { primaryFont } = context

    if (!primaryFont) {
      context.logger.warn('font-detection: No primary font found, skipping')
      return
    }

    let count = 0

    traverse(ast, {
      JSXElement: (path) => {
        if (this.detectAndConvertFont(path, primaryFont)) {
          count++
        }
      }
    })

    context.logger.info(`font-detection: Converted ${count} font declarations`)
    return { fontsConverted: count }
  }

  detectAndConvertFont(path, primaryFont) {
    const classNameAttr = this.getClassNameAttribute(path)
    if (!classNameAttr) return false

    const fontMatch = this.matchFontPattern(classNameAttr.value)
    if (!fontMatch) return false

    const { fontFamily, fontWeight } = this.parseFontSpec(fontMatch)
    this.addInlineStyle(path, fontFamily, fontWeight)

    return true
  }

  // Helper methods
  getClassNameAttribute(path) { /* ... */ }
  matchFontPattern(className) { /* ... */ }
  parseFontSpec(match) { /* ... */ }
  addInlineStyle(path, family, weight) { /* ... */ }
}
```

---

### Configuration avancée

```javascript
// figma-transform.config.js
module.exports = {
  // Liste des transforms avec ordre et options
  transforms: [
    {
      name: 'font-detection',
      priority: 0,
      enabled: true,
      options: {
        weightMap: {
          'Bold': 700,
          'SemiBold': 600,
          // ... custom mapping
        }
      }
    },

    {
      name: 'ast-cleaning',
      priority: 10,
      enabled: true,
      options: {
        addOverflowHidden: true,
        addFlexWidth: true,
        cleanInvalidClasses: true,
        convertTextSizes: true
      }
    },

    {
      name: 'svg-composites',
      priority: 15,
      enabled: process.env.ENABLE_SVG_MERGE !== 'false', // Feature flag
      options: {
        minImagesForComposite: 3,
        outputDir: 'img',
        mergeStrategy: 'paths' // ou 'layers'
      }
    },

    {
      name: 'css-vars',
      priority: 30,
      enabled: true,
      options: {
        generateCustomClasses: true,
        useSafetyNet: true,
        prefixCustomClasses: '' // ou 'figma-'
      }
    },

    {
      name: 'tailwind-optimizer',
      priority: 40,
      enabled: true,
      options: {
        optimizeSpacing: true,
        optimizeSizes: true,
        optimizeRadius: true
      }
    }
  ],

  // Strategy
  mode: 'auto', // 'single-pass' | 'multi-pass' | 'auto'
  autoModeThreshold: {
    // Si transforms < 5 && aucune mutation structurale → single-pass
    // Sinon → multi-pass
    maxTransformsForSinglePass: 5,
    allowStructuralMutationsInSinglePass: false
  },

  // Error handling
  continueOnError: true,
  errorStrategy: 'skip', // 'skip' | 'rollback' | 'fail'

  // Debug & profiling
  debug: {
    dumpAST: false,
    dumpASTPath: './debug/ast-snapshots',
    timing: true,
    verbose: false
  },

  // Performance
  cache: {
    enabled: true,
    cacheKey: (sourceCode) => hash(sourceCode)
  }
}
```

---

## 📊 ANALYSE DE FAISABILITÉ

### Effort de refactoring estimé

| Phase | Tâche | Effort | Priorité |
|-------|-------|--------|----------|
| **1. Setup Infrastructure** | | | |
| 1.1 | Créer TransformPipeline class | 2 jours | 🔴 Haute |
| 1.2 | Créer Transform base class | 1 jour | 🔴 Haute |
| 1.3 | Config loader + validation | 1 jour | 🟡 Moyenne |
| 1.4 | Logger + stats collector | 1 jour | 🟡 Moyenne |
| **2. Migrate Existing Transforms** | | | |
| 2.1 | FontDetectionTransform | 1 jour | 🔴 Haute |
| 2.2 | AstCleaningTransform | 2 jours | 🔴 Haute |
| 2.3 | SvgCompositesTransform | 2 jours | 🔴 Haute |
| 2.4 | CssVarsTransform | 2 jours | 🔴 Haute |
| 2.5 | TailwindOptimizerTransform | 1 jour | 🟡 Moyenne |
| **3. Advanced Features** | | | |
| 3.1 | Multi-pass vs single-pass | 2 jours | 🟡 Moyenne |
| 3.2 | Error handling + rollback | 2 jours | 🟡 Moyenne |
| 3.3 | AST snapshots + diff | 1 jour | 🟢 Basse |
| 3.4 | Performance profiling | 1 jour | 🟢 Basse |
| **4. Testing** | | | |
| 4.1 | Unit tests per transform | 3 jours | 🔴 Haute |
| 4.2 | Integration tests pipeline | 2 jours | 🔴 Haute |
| 4.3 | Regression tests (existing) | 1 jour | 🟡 Moyenne |
| **5. Documentation** | | | |
| 5.1 | Architecture docs | 1 jour | 🟡 Moyenne |
| 5.2 | Transform API docs | 1 jour | 🟡 Moyenne |
| 5.3 | Migration guide | 1 jour | 🟢 Basse |

**Total estimé: 28-35 jours** (4-5 semaines développeur)

---

### Risques identifiés

| Risque | Probabilité | Impact | Mitigation |
|--------|-------------|--------|------------|
| **Regression bugs** | 🟡 Moyenne | 🔴 Haute | Tests exhaustifs + feature flags |
| **Performance dégradée** | 🟡 Moyenne | 🟡 Moyenne | Benchmarks avant/après |
| **Breaking changes API** | 🔴 Haute | 🟡 Moyenne | Backward compatibility layer |
| **Complexité accrue** | 🟡 Moyenne | 🟢 Basse | Bonne documentation |
| **Effort sous-estimé** | 🟡 Moyenne | 🟡 Moyenne | Buffer 20% dans timeline |

---

### Bénéfices mesurables

| Bénéfice | Mesure actuelle | Mesure cible | Gain |
|----------|-----------------|--------------|------|
| **Testabilité** | Tests manuels seulement | Unit tests 80%+ coverage | ⭐⭐⭐⭐⭐ |
| **Maintenabilité** | 1 fichier 800 lignes | ~10 modules 50-150 lignes | ⭐⭐⭐⭐⭐ |
| **Extensibilité** | Modifier code core | Ajouter plugin | ⭐⭐⭐⭐⭐ |
| **Debugging** | Logs globaux | Snapshots + timing par transform | ⭐⭐⭐⭐ |
| **Performance** | ~10-15s | 10-15s (identique ou mieux) | ⭐⭐⭐ |
| **Error handling** | Fail rapide | Continue + rapport détaillé | ⭐⭐⭐⭐ |

---

## 🚀 PLAN DE MIGRATION

### Phase 1: Setup (Semaine 1)

**Objectif:** Infrastructure de base sans breaking changes

```bash
# Structure
scripts/
├── transform-pipeline/
│   ├── Pipeline.js          # Main orchestrator
│   ├── Transform.js         # Base class
│   ├── Context.js           # Shared context
│   ├── Logger.js            # Logging system
│   └── __tests__/
│
└── transforms/
    └── README.md            # Guide pour créer transforms

# Commandes
npm run transform:migrate    # Migrate to new system
npm run transform:benchmark  # Compare old vs new
npm run transform:test       # Run all transform tests
```

**Deliverables:**
- [ ] TransformPipeline class fonctionnelle
- [ ] Transform base class avec hooks
- [ ] Config loader basique
- [ ] Tests infrastructure (90%+ coverage)

---

### Phase 2: Migration Progressive (Semaines 2-3)

**Objectif:** Migrer transformations existantes UNE PAR UNE

**Ordre de migration:**
1. ✅ TailwindOptimizerTransform (plus simple, pas de dépendances)
2. ✅ FontDetectionTransform (dépendances: variables.json)
3. ✅ AstCleaningTransform (4 sous-transforms)
4. ✅ CssVarsTransform (état global: customCSSClasses)
5. ✅ SvgCompositesTransform (I/O filesystem + mutations structurales)

**Stratégie migration:**
```javascript
// unified-processor.js (temporaire - dual mode)
if (process.env.USE_NEW_PIPELINE === 'true') {
  // New pipeline
  const pipeline = new TransformPipeline(config)
  const result = await pipeline.execute(sourceCode)
} else {
  // Old code (current)
  traverse.default(ast, { /* ... */ })
}
```

**Validation migration:**
- Run both pipelines en parallèle
- Compare outputs (AST diff)
- Compare stats (timing, transforms applied)
- Si identical → migration OK

---

### Phase 3: Optimisations (Semaine 4)

**Objectif:** Optimisations avancées

**Features:**
- [ ] Multi-pass avec caching intelligent
- [ ] Détection automatique single-pass vs multi-pass
- [ ] AST snapshots pour debugging
- [ ] Performance profiling par transform

**Benchmarks cibles:**
```
Design simple (1 component):
  Old: ~10s
  New: ~8-10s  (acceptable)

Design complexe (chunking):
  Old: ~25-40s
  New: ~20-35s (15-20% faster grâce au caching)
```

---

### Phase 4: Features Avancées (Semaine 5)

**Objectif:** Features qui n'existaient pas avant

**Features:**
- [ ] Error recovery (continue on error)
- [ ] Partial rollback (si transform échoue)
- [ ] Transform dependencies graph
- [ ] Hot reload config
- [ ] CLI interactive mode

**CLI nouvelle:**
```bash
# Interactive mode
npm run transform -- --interactive

# Sélectif transforms
npm run transform -- --only=fonts,cleaning

# Debug mode
npm run transform -- --debug --dump-ast

# Dry run
npm run transform -- --dry-run
```

---

## 🎯 RECOMMANDATION FINALE

### ✅ GO pour refactoring

**Justification:**
1. 🔴 **Problèmes actuels sont bloquants** pour évolution future
   - Impossible d'ajouter responsive sans refacto
   - Impossible d'ajouter component extraction sans refacto

2. 🟢 **ROI est excellent**
   - 4-5 semaines investissement
   - Gain maintenabilité: ⭐⭐⭐⭐⭐
   - Gain extensibilité: ⭐⭐⭐⭐⭐

3. 🟡 **Risques sont gérables**
   - Migration progressive (dual mode)
   - Validation automatique (compare outputs)
   - Rollback possible à chaque étape

---

### Approche recommandée

**Option choisie: Hybrid Custom Pipeline**

**Pourquoi PAS jscodeshift?**
- Trop opinionné (multi-pass forcé)
- Abstractions limitent contrôle
- Pas de support natif pour nos besoins (I/O, état global)

**Pourquoi custom pipeline:**
- ✅ Contrôle total sur ordering
- ✅ Support single-pass ET multi-pass
- ✅ Intégration facile avec Babel existant
- ✅ Testable + extensible
- ✅ Feature flags + config externe

---

### Next Steps Immédiats

#### Sprint 1 (Cette semaine)
1. **Créer spike/POC**
   - TransformPipeline minimal
   - 1 transform migré (TailwindOptimizer)
   - Démo fonctionnelle

2. **Valider approach**
   - Review avec équipe
   - Benchmark POC vs current
   - Décision GO/NO-GO

#### Sprint 2-4 (Prochains 3 semaines)
3. **Migration complète**
   - Suivre plan Phase 1-2
   - Tests à chaque étape
   - Documentation inline

#### Sprint 5+ (Après stabilisation)
4. **Features avancées**
   - Responsive transform (nouveau)
   - Component extraction (nouveau)
   - Performance optimizations

---

### Métriques de succès

**Must-have (blocker si non atteint):**
- ✅ 0 regression bugs (outputs identiques)
- ✅ 80%+ test coverage
- ✅ Performance ≤ 10% slower (acceptable pour gains maintenabilité)

**Nice-to-have:**
- ⭐ Performance 15%+ faster
- ⭐ Config externe fonctionnelle
- ⭐ Debug mode avec AST snapshots

---

## 📚 RESSOURCES

### Documentation
- [Babel Plugin Handbook](https://github.com/jamiebuilds/babel-handbook/blob/master/translations/en/plugin-handbook.md)
- [AST Explorer](https://astexplorer.net/) (visualize transformations)
- [jscodeshift docs](https://github.com/facebook/jscodeshift)

### Exemples de pipelines similaires
- [React codemod](https://github.com/reactjs/react-codemod)
- [Next.js codemods](https://nextjs.org/docs/pages/building-your-application/upgrading/codemods)
- [Prettier plugin system](https://prettier.io/docs/en/plugins.html)

### Outils de développement
- [@babel/parser](https://babeljs.io/docs/en/babel-parser)
- [@babel/traverse](https://babeljs.io/docs/en/babel-traverse)
- [@babel/types](https://babeljs.io/docs/en/babel-types)
- [recast](https://github.com/benjamn/recast) (preserve formatting)

---

**Prêt à commencer le POC?** 🚀
