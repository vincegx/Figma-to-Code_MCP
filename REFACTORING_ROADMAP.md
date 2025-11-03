# REFACTORING ROADMAP - DIAGRAMME VISUEL

**Date:** 2025-11-03
**Objectif:** Migration progressive du système monolithique → Pipeline modulaire

---

## 📊 VUE D'ENSEMBLE: AVANT → APRÈS

```
════════════════════════════════════════════════════════════════════════════════
                            ÉTAT ACTUEL (AVANT)
════════════════════════════════════════════════════════════════════════════════

                    ┌─────────────────────────────────────┐
                    │   unified-processor.js (800 lignes) │
                    │                                     │
                    │  • Parse AST                        │
                    │  • Traverse (single pass)           │
                    │  • Font detection (inline)          │
                    │  • AST cleaning (inline)            │
                    │  • SVG composites (inline)          │
                    │  • CSS vars (inline)                │
                    │  • Tailwind optimizer (inline)      │
                    │  • Generate code                    │
                    │  • Safety net (inline)              │
                    │  • CSS generation (inline)          │
                    │                                     │
                    └─────────────────────────────────────┘
                              │
                    ┌─────────┴─────────────────────────┐
                    │                                   │
         ┌──────────▼──────────┐         ┌─────────────▼─────────────┐
         │ transformations/    │         │  État global partagé       │
         │ ├─ ast-cleaning.js  │         │  • customCSSClasses Map    │
         │ ├─ post-fixes.js    │         │  • rootContainerProcessed  │
         │ ├─ css-vars.js      │         │  • primaryFont             │
         │ ├─ svg-icon-fixes.js│         └────────────────────────────┘
         │ └─ tailwind-opt.js  │
         └─────────────────────┘

    ❌ Problèmes:
       • Couplage fort (tout dans 1 fichier)
       • Ordre hardcodé
       • État global mutable
       • Impossible de tester isolément
       • Mutations structurales dangereuses


════════════════════════════════════════════════════════════════════════════════
                            ÉTAT CIBLE (APRÈS)
════════════════════════════════════════════════════════════════════════════════

┌──────────────────────────────────────────────────────────────────────────────┐
│                      figma-transform.config.js                               │
│  ┌────────────────────────────────────────────────────────────────────────┐  │
│  │ module.exports = {                                                     │  │
│  │   transforms: [                                                        │  │
│  │     { name: 'font-detection', priority: 0, enabled: true },            │  │
│  │     { name: 'ast-cleaning', priority: 10, enabled: true },             │  │
│  │     { name: 'svg-composites', priority: 15, enabled: true },           │  │
│  │     { name: 'css-vars', priority: 30, enabled: true },                 │  │
│  │     { name: 'tailwind-optimizer', priority: 40, enabled: true }        │  │
│  │   ],                                                                   │  │
│  │   mode: 'multi-pass',                                                  │  │
│  │   continueOnError: true,                                               │  │
│  │   debug: { timing: true, dumpAST: false }                              │  │
│  │ }                                                                      │  │
│  └────────────────────────────────────────────────────────────────────────┘  │
└──────────────────────────────────────────────────────────────────────────────┘
                                       │
                                       ▼
              ┌────────────────────────────────────────────┐
              │  transform-pipeline/Pipeline.js            │
              │  ┌──────────────────────────────────────┐  │
              │  │ class TransformPipeline {            │  │
              │  │   async execute(code, config) {      │  │
              │  │     1. Parse AST                     │  │
              │  │     2. Load transforms               │  │
              │  │     3. Sort by priority              │  │
              │  │     4. Execute in order              │  │
              │  │     5. Collect stats                 │  │
              │  │     6. Generate code                 │  │
              │  │   }                                  │  │
              │  │ }                                    │  │
              │  └──────────────────────────────────────┘  │
              └────────────────────────────────────────────┘
                                       │
        ┌──────────────────────────────┼──────────────────────────────┐
        │                              │                              │
        ▼                              ▼                              ▼
┌────────────────┐          ┌──────────────────┐          ┌──────────────────┐
│ transforms/    │          │ transforms/      │          │ transforms/      │
│ font-detection/│          │ ast-cleaning/    │          │ css-vars/        │
│ ├─ index.js    │          │ ├─ index.js      │          │ ├─ index.js      │
│ ├─ detector.js │          │ ├─ overflow.js   │          │ ├─ detector.js   │
│ ├─ converter.js│          │ ├─ flex-grow.js  │          │ ├─ generator.js  │
│ └─ __tests__/  │          │ ├─ cleaner.js    │          │ └─ __tests__/    │
└────────────────┘          │ └─ __tests__/    │          └──────────────────┘
                            └──────────────────┘
        ▼                              ▼                              ▼
┌────────────────┐          ┌──────────────────┐
│ transforms/    │          │ transforms/      │
│ svg-composites/│          │ tailwind-opt/    │
│ ├─ index.js    │          │ ├─ index.js      │
│ ├─ detector.js │          │ ├─ mappings.js   │
│ ├─ merger.js   │          │ └─ __tests__/    │
│ └─ __tests__/  │          └──────────────────┘
└────────────────┘

    ✅ Avantages:
       • Découplage total (1 plugin = 1 transform)
       • Ordre configurable
       • État isolé par transform
       • Testable unitairement
       • Extensible (ajouter transform = ajouter plugin)
```

---

## 🔄 ÉTAPES DE MIGRATION PROGRESSIVE

```
════════════════════════════════════════════════════════════════════════════════
                        ÉTAPE 0: PRÉPARATION (1 jour)
════════════════════════════════════════════════════════════════════════════════

┌─────────────────────────────────────────────────────────────────────────────┐
│  ACTIONS:                                                                   │
│  1. Créer dossiers structure                                                │
│  2. Copier (pas déplacer!) fichiers existants                              │
│  3. Installer outils testing                                                │
└─────────────────────────────────────────────────────────────────────────────┘

    AVANT                                      APRÈS
    ─────                                      ─────
    scripts/                                   scripts/
    ├── unified-processor.js                   ├── unified-processor.js  ← GARDÉ!
    ├── transformations/                       ├── transformations/      ← GARDÉ!
    │   ├── ast-cleaning.js                    │   ├── ast-cleaning.js
    │   ├── css-vars.js                        │   ├── css-vars.js
    │   ├── post-fixes.js                      │   ├── post-fixes.js
    │   ├── svg-icon-fixes.js                  │   ├── svg-icon-fixes.js
    │   └── tailwind-optimizer.js              │   └── tailwind-optimizer.js
    └── ...                                    │
                                               ├── transform-pipeline/   ← NOUVEAU
                                               │   ├── Pipeline.js
                                               │   ├── Transform.js
                                               │   ├── Context.js
                                               │   └── __tests__/
                                               │
                                               └── transforms/           ← NOUVEAU
                                                   └── README.md

    📝 Git status:
       • Tous fichiers existants intacts
       • Nouveaux fichiers ajoutés
       • Zero breaking changes


════════════════════════════════════════════════════════════════════════════════
                    ÉTAPE 1: INFRASTRUCTURE (2-3 jours)
════════════════════════════════════════════════════════════════════════════════

┌─────────────────────────────────────────────────────────────────────────────┐
│  ACTIONS:                                                                   │
│  1. Créer TransformPipeline class                                          │
│  2. Créer Transform base class                                             │
│  3. Créer Context + Logger                                                 │
│  4. Tests unitaires infrastructure                                         │
└─────────────────────────────────────────────────────────────────────────────┘

    ┌──────────────────────────────────────────────────────────────┐
    │  scripts/transform-pipeline/Pipeline.js                      │
    │  ─────────────────────────────────────────────────────────   │
    │  export class TransformPipeline {                            │
    │    constructor(config = {}) {                                │
    │      this.transforms = []                                    │
    │      this.config = config                                    │
    │    }                                                          │
    │                                                               │
    │    use(TransformClass, options = {}) {                       │
    │      const transform = new TransformClass(options)           │
    │      this.transforms.push({                                  │
    │        name: transform.name,                                 │
    │        priority: transform.priority || 100,                  │
    │        instance: transform,                                  │
    │        enabled: options.enabled !== false                    │
    │      })                                                       │
    │      return this                                             │
    │    }                                                          │
    │                                                               │
    │    async execute(sourceCode, contextData = {}) {             │
    │      // 1. Parse AST                                         │
    │      const ast = babel.parse(sourceCode, { ... })            │
    │                                                               │
    │      // 2. Create context                                    │
    │      const context = new Context(contextData)                │
    │                                                               │
    │      // 3. Sort transforms by priority                       │
    │      const sorted = this.transforms                          │
    │        .filter(t => t.enabled)                               │
    │        .sort((a, b) => a.priority - b.priority)              │
    │                                                               │
    │      // 4. Execute each transform                            │
    │      for (const transform of sorted) {                       │
    │        await transform.instance.execute(ast, context)        │
    │      }                                                        │
    │                                                               │
    │      // 5. Generate code                                     │
    │      return babel.generate(ast)                              │
    │    }                                                          │
    │  }                                                            │
    └──────────────────────────────────────────────────────────────┘

    ┌──────────────────────────────────────────────────────────────┐
    │  scripts/transform-pipeline/Transform.js                     │
    │  ─────────────────────────────────────────────────────────   │
    │  export class Transform {                                    │
    │    name = 'base-transform'                                   │
    │    priority = 100                                            │
    │                                                               │
    │    async execute(ast, context) {                             │
    │      throw new Error('Must implement execute()')             │
    │    }                                                          │
    │  }                                                            │
    └──────────────────────────────────────────────────────────────┘

    📝 Status:
       • Infrastructure prête
       • Tests passent (100% coverage)
       • unified-processor.js NON touché


════════════════════════════════════════════════════════════════════════════════
           ÉTAPE 2: PREMIER TRANSFORM (TailwindOptimizer) (1 jour)
════════════════════════════════════════════════════════════════════════════════

┌─────────────────────────────────────────────────────────────────────────────┐
│  ACTIONS:                                                                   │
│  1. Copier transformations/tailwind-optimizer.js                           │
│  2. Wrapper dans Transform class                                           │
│  3. Tests unitaires                                                         │
│  4. Validation output identique                                            │
└─────────────────────────────────────────────────────────────────────────────┘

    ┌──────────────────────────────────────────────────────────────┐
    │  scripts/transforms/tailwind-optimizer/index.js              │
    │  ─────────────────────────────────────────────────────────   │
    │  import { Transform } from '../../transform-pipeline'        │
    │  import { optimizeTailwindClasses } from                     │
    │    '../../transformations/tailwind-optimizer.js'             │
    │                                                               │
    │  export default class TailwindOptimizerTransform             │
    │                      extends Transform {                     │
    │    name = 'tailwind-optimizer'                               │
    │    priority = 40  // Run AFTER css-vars                      │
    │                                                               │
    │    async execute(ast, context) {                             │
    │      let count = 0                                           │
    │                                                               │
    │      traverse(ast, {                                         │
    │        JSXElement(path) {                                    │
    │          const attr = getClassNameAttr(path)                 │
    │          if (!attr) return                                   │
    │                                                               │
    │          const original = attr.value.value                   │
    │          const optimized =                                   │
    │            optimizeTailwindClasses(original)                 │
    │                                                               │
    │          if (optimized !== original) {                       │
    │            attr.value = t.stringLiteral(optimized)           │
    │            count++                                           │
    │          }                                                    │
    │        }                                                      │
    │      })                                                       │
    │                                                               │
    │      context.logger.info(                                    │
    │        `tailwind-optimizer: ${count} classes optimized`      │
    │      )                                                        │
    │      return { classesOptimized: count }                      │
    │    }                                                          │
    │  }                                                            │
    └──────────────────────────────────────────────────────────────┘

    ┌──────────────────────────────────────────────────────────────┐
    │  scripts/transforms/tailwind-optimizer/__tests__/index.test.js│
    │  ─────────────────────────────────────────────────────────   │
    │  import TailwindOptimizerTransform from '../index'           │
    │                                                               │
    │  describe('TailwindOptimizerTransform', () => {              │
    │    it('converts gap-[8px] to gap-2', async () => {           │
    │      const code = `                                          │
    │        <div className="gap-[8px]">                           │
    │      `                                                        │
    │                                                               │
    │      const result = await transformCode(code,                │
    │        TailwindOptimizerTransform)                           │
    │                                                               │
    │      expect(result).toContain('gap-2')                       │
    │    })                                                         │
    │                                                               │
    │    it('preserves classes that cannot be optimized', ...)     │
    │  })                                                           │
    └──────────────────────────────────────────────────────────────┘

    📝 Status:
       • 1er transform migré ✅
       • Tests passent ✅
       • unified-processor.js ENCORE utilisé


════════════════════════════════════════════════════════════════════════════════
                ÉTAPE 3: MODE DUAL (Validation parallèle) (1 jour)
════════════════════════════════════════════════════════════════════════════════

┌─────────────────────────────────────────────────────────────────────────────┐
│  ACTIONS:                                                                   │
│  1. Créer wrapper qui exécute OLD + NEW en parallèle                       │
│  2. Comparer outputs (AST diff)                                            │
│  3. Valider que outputs sont identiques                                    │
└─────────────────────────────────────────────────────────────────────────────┘

    ┌──────────────────────────────────────────────────────────────┐
    │  scripts/unified-processor.js (MODIFIÉ TEMPORAIREMENT)       │
    │  ─────────────────────────────────────────────────────────   │
    │  import { TransformPipeline } from './transform-pipeline'    │
    │  import TailwindOptimizerTransform from                      │
    │    './transforms/tailwind-optimizer'                         │
    │                                                               │
    │  const USE_NEW_PIPELINE = process.env.NEW_PIPELINE === 'true'│
    │  const VALIDATE_DUAL = process.env.VALIDATE === 'true'       │
    │                                                               │
    │  async function processCode(sourceCode) {                    │
    │    if (USE_NEW_PIPELINE) {                                   │
    │      // NEW PIPELINE                                         │
    │      const pipeline = new TransformPipeline()                │
    │        .use(TailwindOptimizerTransform)                      │
    │                                                               │
    │      return await pipeline.execute(sourceCode)               │
    │    }                                                          │
    │                                                               │
    │    if (VALIDATE_DUAL) {                                      │
    │      // RUN BOTH + COMPARE                                   │
    │      const oldResult = processOldWay(sourceCode)             │
    │      const newResult = await processNewWay(sourceCode)       │
    │                                                               │
    │      const diff = compareAST(oldResult, newResult)           │
    │      if (diff.hasDifferences) {                              │
    │        console.error('⚠️  MISMATCH:', diff.differences)      │
    │        process.exit(1)                                       │
    │      }                                                        │
    │      console.log('✅ Outputs identical!')                    │
    │      return oldResult  // Use old for now                    │
    │    }                                                          │
    │                                                               │
    │    // OLD PIPELINE (default)                                 │
    │    return processOldWay(sourceCode)                          │
    │  }                                                            │
    │                                                               │
    │  function processOldWay(sourceCode) {                        │
    │    // ... code actuel inchangé ...                           │
    │  }                                                            │
    └──────────────────────────────────────────────────────────────┘

    COMMANDES:
    ─────────

    # Mode normal (OLD pipeline)
    $ node scripts/unified-processor.js input.tsx output.tsx
    ✅ Processing complete (OLD pipeline)

    # Mode validation dual (compare OLD vs NEW)
    $ VALIDATE=true node scripts/unified-processor.js input.tsx output.tsx
    🔄 Running OLD pipeline...
    🔄 Running NEW pipeline...
    📊 Comparing outputs...
    ✅ Outputs identical! (0 differences)

    # Mode NEW only (after validation)
    $ NEW_PIPELINE=true node scripts/unified-processor.js input.tsx output.tsx
    ✅ Processing complete (NEW pipeline)

    📝 Status:
       • Validation automatique ✅
       • Zero breaking changes ✅
       • Peut rollback instantanément


════════════════════════════════════════════════════════════════════════════════
        ÉTAPE 4: MIGRATION DES AUTRES TRANSFORMS (1 transform/jour)
════════════════════════════════════════════════════════════════════════════════

┌─────────────────────────────────────────────────────────────────────────────┐
│  ORDRE DE MIGRATION (du plus simple au plus complexe):                     │
│                                                                             │
│  Jour 1: ✅ TailwindOptimizer (FAIT)                                       │
│  Jour 2: 🔄 FontDetection                                                  │
│  Jour 3: 🔄 AstCleaning                                                    │
│  Jour 4: 🔄 CssVars                                                        │
��  Jour 5: 🔄 SvgComposites (le plus complexe)                               │
└─────────────────────────────────────────────────────────────────────────────┘

    POUR CHAQUE TRANSFORM:
    ─────────────────────

    1. Créer dossier transforms/{name}/
       ├── index.js         ← Transform class
       ├── {helpers}.js     ← Logic séparée
       └── __tests__/       ← Tests isolés

    2. Wrapper code existant (réutiliser!)
       - Copier de transformations/{name}.js
       - Wrapper dans Transform.execute()
       - Isoler état (pas de globals)

    3. Tests unitaires
       - Test chaque helper isolément
       - Test transform complet
       - Test edge cases

    4. Ajouter au pipeline
       pipeline.use(NewTransform, { priority: X })

    5. Validation dual mode
       VALIDATE=true → comparer outputs
       Si identique → continuer
       Si différent → debug + fix

    6. Next transform

    ┌────────────────────────────────────────────────────────┐
    │  EXEMPLE: FontDetection (Jour 2)                       │
    │  ────────────────────────────────────────────────────  │
    │                                                         │
    │  transforms/font-detection/                            │
    │  ├── index.js                                          │
    │  │   import { Transform } from '../../transform-pipeline'│
    │  │   import { detectFont, convertToInlineStyle } from  │
    │  │     './helpers.js'                                  │
    │  │                                                      │
    │  │   export default class FontDetectionTransform       │
    │  │                      extends Transform {            │
    │  │     name = 'font-detection'                         │
    │  │     priority = 0  // MUST BE FIRST!                 │
    │  │                                                      │
    │  │     static requires = ['primaryFont']               │
    │  │     static mutates = ['attributes.style']           │
    │  │                                                      │
    │  │     async execute(ast, context) {                   │
    │  │       const { primaryFont } = context               │
    │  │       if (!primaryFont) return                      │
    │  │                                                      │
    │  │       traverse(ast, {                               │
    │  │         JSXElement(path) {                          │
    │  │           const font = detectFont(path, primaryFont)│
    │  │           if (font) {                               │
    │  │             convertToInlineStyle(path, font)        │
    │  │           }                                          │
    │  │         }                                            │
    │  │       })                                             │
    │  │     }                                                │
    │  │   }                                                  │
    │  │                                                      │
    │  ├── helpers.js                                        │
    │  │   // Code réutilisé de unified-processor.js        │
    │  │   export function detectFont(path, primaryFont) {   │
    │  │     // ... logique existante ...                    │
    │  │   }                                                  │
    │  │                                                      │
    │  │   export function convertToInlineStyle(path, font) {│
    │  │     // ... logique existante ...                    │
    │  │   }                                                  │
    │  │                                                      │
    │  └── __tests__/                                        │
    │      ├── index.test.js                                 │
    │      └── helpers.test.js                               │
    └────────────────────────────────────────────────────────┘

    📝 Status après 5 jours:
       • 5 transforms migrés ✅
       • Tous outputs validés identiques ✅
       • unified-processor.js en dual mode


════════════════════════════════════════════════════════════════════════════════
                ÉTAPE 5: SWITCH FINAL (1 jour)
════════════════════════════════════════════════════════════════════════════════

┌─────────────────────────────────────────────────────────────────────────────┐
│  ACTIONS:                                                                   │
│  1. Changer default → NEW_PIPELINE=true                                    │
│  2. Garder OLD code en backup (commenté)                                   │
│  3. Update documentation                                                    │
│  4. Deploy + monitor                                                        │
└─────────────────────────────────────────────────────────────────────────────┘

    ┌──────────────────────────────────────────────────────────────┐
    │  scripts/unified-processor.js (VERSION FINALE)               │
    │  ─────────────────────────────────────────────────────────   │
    │  import { TransformPipeline } from './transform-pipeline'    │
    │  import { loadConfig } from './figma-transform.config.js'    │
    │                                                               │
    │  // Import tous les transforms                               │
    │  import FontDetectionTransform from                          │
    │    './transforms/font-detection'                             │
    │  import AstCleaningTransform from                            │
    │    './transforms/ast-cleaning'                               │
    │  import SvgCompositesTransform from                          │
    │    './transforms/svg-composites'                             │
    │  import CssVarsTransform from                                │
    │    './transforms/css-vars'                                   │
    │  import TailwindOptimizerTransform from                      │
    │    './transforms/tailwind-optimizer'                         │
    │                                                               │
    │  async function main() {                                     │
    │    const config = loadConfig()                               │
    │                                                               │
    │    // Build pipeline                                         │
    │    const pipeline = new TransformPipeline(config)            │
    │      .use(FontDetectionTransform, { priority: 0 })           │
    │      .use(AstCleaningTransform, { priority: 10 })            │
    │      .use(SvgCompositesTransform, { priority: 15 })          │
    │      .use(CssVarsTransform, { priority: 30 })                │
    │      .use(TailwindOptimizerTransform, { priority: 40 })      │
    │                                                               │
    │    // Execute                                                 │
    │    const sourceCode = fs.readFileSync(inputFile, 'utf8')     │
    │    const result = await pipeline.execute(sourceCode, {       │
    │      primaryFont,                                            │
    │      variables,                                              │
    │      inputDir                                                │
    │    })                                                         │
    │                                                               │
    │    fs.writeFileSync(outputFile, result.code, 'utf8')         │
    │    console.log('✅ Processing complete!')                    │
    │  }                                                            │
    │                                                               │
    │  /*                                                           │
    │   * OLD PIPELINE (backup - peut être supprimé après 1 mois)  │
    │   *                                                           │
    │   * function processOldWay() { ... }                         │
    │   */                                                          │
    └──────────────────────────────────────────────────────────────┘

    STRUCTURE FINALE:
    ────────────────

    scripts/
    ├── unified-processor.js         ← REFACTORÉ (pipeline)
    │
    ├── transform-pipeline/          ← Infrastructure
    │   ├── Pipeline.js
    │   ├── Transform.js
    │   ├── Context.js
    │   ├── Logger.js
    │   └── __tests__/
    │
    ├── transforms/                  ← Plugins isolés
    │   ├── font-detection/
    │   │   ├── index.js
    │   │   ├── helpers.js
    │   │   └── __tests__/
    │   ├── ast-cleaning/
    │   │   ├── index.js
    │   │   ├── overflow.js
    │   │   ├── flex-grow.js
    │   │   └── __tests__/
    │   ├── svg-composites/
    │   │   ├── index.js
    │   │   ├── detector.js
    │   │   ├── merger.js
    │   │   └── __tests__/
    │   ├── css-vars/
    │   │   ├── index.js
    │   │   ├── generator.js
    │   │   └── __tests__/
    │   └── tailwind-optimizer/
    │       ├── index.js
    │       └── __tests__/
    │
    ├── transformations/             ← LEGACY (peut supprimer)
    │   └── ...                      (ou garder pour référence)
    │
    └── figma-transform.config.js    ← Configuration

    📝 Status:
       • Migration complète ✅
       • NEW pipeline en production ✅
       • OLD code backupé ✅
       • Documentation à jour ✅


════════════════════════════════════════════════════════════════════════════════
            ÉTAPE 6: AMÉLIORATION CONTINUE (ongoing)
════════════════════════════════════════════════════════════════════════════════

    Maintenant on peut facilement:

    ✅ Ajouter nouveau transform:
       1. Créer transforms/responsive/
       2. Implémenter transform
       3. Tests
       4. pipeline.use(ResponsiveTransform, { priority: 50 })

    ✅ Désactiver transform:
       // figma-transform.config.js
       { name: 'svg-composites', enabled: false }

    ✅ Réordonner transforms:
       { name: 'css-vars', priority: 20 }  ← Change ordre

    ✅ Debug specific transform:
       TRANSFORM=font-detection DEBUG=true npm run transform

    ✅ Benchmarking:
       npm run transform:benchmark
       → Compare performance transform by transform
```

---

## 📊 TIMELINE RÉSUMÉ

```
┌─────────────────────────────────────────────────────────────────────────┐
│                                                                         │
│  SEMAINE 1: SETUP                                                       │
│  ─────────────────────────────────────────────────────────────────     │
│  Jour 1: Préparation (structure dossiers)                      ░       │
│  Jour 2-3: Infrastructure (Pipeline, Transform, Context)       ██      │
│  Jour 4: Premier transform (TailwindOptimizer)                 █       │
│  Jour 5: Dual mode validation                                  █       │
│                                                                         │
│  SEMAINE 2: MIGRATION                                                   │
│  ─────────────────────────────────────────────────────────────────     │
│  Jour 1: FontDetection transform                               █       │
│  Jour 2: AstCleaning transform                                 █       │
│  Jour 3: CssVars transform                                     █       │
│  Jour 4: SvgComposites transform                               █       │
│  Jour 5: Testing + validation                                  █       │
│                                                                         │
│  SEMAINE 3: STABILISATION                                              │
│  ─────────────────────────────────────────────────────────────────     │
│  Jour 1-2: Switch final + monitoring                           ██      │
│  Jour 3-4: Documentation                                       ██      │
│  Jour 5: Buffer (résolution bugs)                              █       │
│                                                                         │
└─────────────────────────────────────────────────────────────────────────┘

    Total: ~15 jours (3 semaines)
```

---

## ✅ VALIDATION À CHAQUE ÉTAPE

```
┌───────────────────────────────────────────────────────────────────┐
│  CHECKLIST VALIDATION                                             │
│  ───────────────────────────────────────────────────��─────────   │
│                                                                   │
│  Après chaque transform migré:                                   │
│  ☐ Tests unitaires passent (npm test)                            │
│  ☐ Output identical à OLD pipeline (VALIDATE=true)               │
│  ☐ Performance acceptable (±10% du baseline)                     │
│  ☐ Code review fait                                              │
│  ☐ Documentation updated                                         │
│                                                                   │
│  Avant switch final:                                             │
│  ☐ TOUS transforms migrés                                        │
│  ☐ Test suite complet >80% coverage                              │
│  ☐ Validation end-to-end (plusieurs designs)                     │
│  ☐ Benchmark performance global                                  │
│  ☐ Documentation complète                                        │
│  ☐ Rollback plan documenté                                       │
│                                                                   │
└───────────────────────────────────────────────────────────────────┘
```

---

## 🎯 POINTS CLÉS

### ✅ Ce qu'on GARDE (zero waste):
- ✅ Tout le code de `transformations/*.js` (réutilisé!)
- ✅ La logique AST (identique, juste wrappée)
- ✅ L'ordre des transformations (reproduit via priority)
- ✅ Les performances (single-pass possible)

### 🔄 Ce qu'on AMÉLIORE:
- 🔄 Organisation (1 fichier 800 lignes → 10 modules 50-150 lignes)
- 🔄 Testabilité (0 tests → 80%+ coverage)
- 🔄 Extensibilité (modifier code → ajouter plugin)
- 🔄 Configuration (hardcoded → externe)
- 🔄 Debugging (logs globaux → timing par transform)

### 🚫 Ce qu'on ÉVITE:
- 🚫 Réécrire from scratch (réutilisation max!)
- 🚫 Breaking changes (migration progressive)
- 🚫 Big bang deployment (dual mode validation)
- 🚫 Supprimer ancien code immédiatement (garder backup)

---

## 🔐 SÉCURITÉ & ROLLBACK

```
┌───────────────────────────────────────────────────────────────────┐
│  ROLLBACK PLAN (si problème détecté)                              │
│  ─────────────────────────────────────────────────────────────   │
│                                                                   │
│  1. Rollback instantané:                                          │
│     $ export NEW_PIPELINE=false                                   │
│     → Retour à OLD code immédiatement                             │
│                                                                   │
│  2. Rollback Git:                                                 │
│     $ git revert <commit-hash>                                    │
│     → Annule le switch final                                      │
│                                                                   │
│  3. Investigation:                                                │
│     • Activer debug mode                                          │
│     • Comparer AST snapshots (OLD vs NEW)                         │
│     • Identifier transform problématique                          │
│     • Fix + redeploy                                              │
│                                                                   │
└───────────────────────────────────────────────────────────────────┘
```

---

Voulez-vous que je commence par créer le **POC (Étape 0-1)** pour valider l'approche concrètement ? 🚀
