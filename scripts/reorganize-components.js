#!/usr/bin/env node

/**
 * Script de réorganisation automatique des composants
 * - Déplace les fichiers vers la nouvelle structure
 * - Met à jour tous les imports automatiquement
 * - Renomme les fichiers en PascalCase
 */

import fs from 'fs';
import path from 'path';
import { execSync } from 'child_process';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const DRY_RUN = process.argv.includes('--dry-run');
const VERBOSE = process.argv.includes('--verbose');

console.log('🗂️  Réorganisation des composants\n');
if (DRY_RUN) {
  console.log('⚠️  MODE DRY-RUN: Aucun fichier ne sera modifié\n');
}

// ============================================
// CONFIGURATION DES DÉPLACEMENTS
// ============================================

const MOVES = [
  // Layout
  { from: 'src/components/app-sidebar.tsx', to: 'src/components/layout/AppSidebar.tsx' },
  { from: 'src/components/site-header.tsx', to: 'src/components/layout/SiteHeader.tsx' },

  // Pages
  { from: 'src/components/TestDetail.tsx', to: 'src/components/pages/TestDetailPage.tsx' },

  // Features: Analysis
  { from: 'src/components/AnalysisForm.tsx', to: 'src/components/features/analysis/AnalysisForm.tsx' },

  // Features: Tests
  { from: 'src/components/TestsGrid.tsx', to: 'src/components/features/tests/TestsGrid.tsx' },
  { from: 'src/components/TestsTable.tsx', to: 'src/components/features/tests/TestsTable.tsx' },
  { from: 'src/components/test-card.tsx', to: 'src/components/features/tests/TestCard.tsx' },
  { from: 'src/components/controls-bar.tsx', to: 'src/components/features/tests/ControlsBar.tsx' },
  { from: 'src/components/pagination-controls.tsx', to: 'src/components/features/tests/PaginationControls.tsx' },

  // Features: Stats
  { from: 'src/components/UsageBar.tsx', to: 'src/components/features/stats/UsageBar.tsx' },

  // Common
  { from: 'src/components/ThemeToggle.tsx', to: 'src/components/common/ThemeToggle.tsx' },
  { from: 'src/components/LanguageSwitcher.tsx', to: 'src/components/common/LanguageSwitcher.tsx' },
];

const DELETIONS = [
  'src/components/HomePage.tsx',
  'src/components/HomePage.tsx.backup',
  'src/components/section-cards.tsx',
  'tmp/sreenlist.png'
];

// ============================================
// MAPPING DES IMPORTS À REMPLACER
// ============================================

// Pour chaque fichier source, liste des replacements à faire
const IMPORT_REPLACEMENTS = {
  'src/App.tsx': [
    { from: `import TestDetail from './components/TestDetail'`, to: `import TestDetailPage from './components/pages/TestDetailPage'` },
    { from: '<TestDetail', to: '<TestDetailPage', isJSX: true },
    { from: '</TestDetail>', to: '</TestDetailPage>', isJSX: true },
  ],

  'src/components/layout/MainLayout.tsx': [
    { from: `import { AppSidebar } from '../app-sidebar'`, to: `import { AppSidebar } from './AppSidebar'` },
    { from: `import { SiteHeader } from '../site-header'`, to: `import { SiteHeader } from './SiteHeader'` },
  ],

  'src/components/layout/AppSidebar.tsx': [
    { from: `import ThemeToggle from './ThemeToggle'`, to: `import ThemeToggle from '../common/ThemeToggle'` },
    { from: `import LanguageSwitcher from './LanguageSwitcher'`, to: `import LanguageSwitcher from '../common/LanguageSwitcher'` },
    { from: `import { useTranslation } from '../i18n/I18nContext'`, to: `import { useTranslation } from '../../i18n/I18nContext'` },
  ],

  'src/components/layout/SiteHeader.tsx': [
    { from: `import { UsageBar } from './UsageBar'`, to: `import { UsageBar } from '../features/stats/UsageBar'` },
    { from: `import { useTranslation } from '../i18n/I18nContext'`, to: `import { useTranslation } from '../../i18n/I18nContext'` },
  ],

  'src/components/pages/AnalyzePage.tsx': [
    { from: `import AnalysisForm from '../AnalysisForm'`, to: `import AnalysisForm from '../features/analysis/AnalysisForm'` },
  ],

  'src/components/pages/TestsPage.tsx': [
    { from: `import { ControlsBar } from '../controls-bar'`, to: `import { ControlsBar } from '../features/tests/ControlsBar'` },
    { from: `import { PaginationControls } from '../pagination-controls'`, to: `import { PaginationControls } from '../features/tests/PaginationControls'` },
    { from: `import TestsGrid from '../TestsGrid'`, to: `import TestsGrid from '../features/tests/TestsGrid'` },
    { from: `import TestsTable from '../TestsTable'`, to: `import TestsTable from '../features/tests/TestsTable'` },
  ],

  'src/components/features/tests/TestsGrid.tsx': [
    { from: `import { TestCard } from './test-card'`, to: `import { TestCard } from './TestCard'` },
  ],

  'src/components/features/analysis/AnalysisForm.tsx': [
    { from: `import { useTranslation } from '../i18n/I18nContext'`, to: `import { useTranslation } from '../../../i18n/I18nContext'` },
  ],

  'src/components/features/stats/UsageBar.tsx': [
    { from: `import { useTranslation } from '../i18n/I18nContext'`, to: `import { useTranslation } from '../../../i18n/I18nContext'` },
  ],

  'src/components/common/ThemeToggle.tsx': [
    { from: `import { useTheme } from '../contexts/ThemeContext'`, to: `import { useTheme } from '../../contexts/ThemeContext'` },
  ],

  'src/components/common/LanguageSwitcher.tsx': [
    { from: `import { useTranslation } from '../i18n/I18nContext'`, to: `import { useTranslation } from '../../i18n/I18nContext'` },
  ],

  'src/components/features/tests/TestCard.tsx': [
    { from: `import { useTranslation } from '../i18n/I18nContext'`, to: `import { useTranslation } from '../../../i18n/I18nContext'` },
  ],

  'src/components/features/tests/TestsTable.tsx': [
    { from: `import { useTranslation } from '../i18n/I18nContext'`, to: `import { useTranslation } from '../../../i18n/I18nContext'` },
  ],

  'src/components/features/tests/PaginationControls.tsx': [
    { from: `import { useTranslation } from '../i18n/I18nContext'`, to: `import { useTranslation } from '../../../i18n/I18nContext'` },
  ],

  'src/components/features/tests/ControlsBar.tsx': [
    { from: `import { useTranslation } from '../i18n/I18nContext'`, to: `import { useTranslation } from '../../../i18n/I18nContext'` },
  ],

  'src/components/pages/TestDetailPage.tsx': [
    { from: `import { useTranslation } from '../i18n/I18nContext'`, to: `import { useTranslation } from '../../i18n/I18nContext'` },
  ],
};

// ============================================
// FONCTIONS UTILITAIRES
// ============================================

function log(message, level = 'info') {
  const prefix = {
    info: '📝',
    success: '✅',
    warning: '⚠️',
    error: '❌',
    verbose: '🔍'
  }[level] || '📝';

  if (level === 'verbose' && !VERBOSE) return;
  console.log(`${prefix} ${message}`);
}

function ensureDir(filePath) {
  const dir = path.dirname(filePath);
  if (!fs.existsSync(dir)) {
    if (!DRY_RUN) {
      fs.mkdirSync(dir, { recursive: true });
    }
    log(`Created directory: ${dir}`, 'verbose');
  }
}

function fileExists(filePath) {
  return fs.existsSync(filePath);
}

// ============================================
// ÉTAPE 1: SUPPRIMER LES FICHIERS OBSOLÈTES
// ============================================

function deletionPhase() {
  log('\n📦 Phase 1: Suppression des fichiers obsolètes\n');

  let deletedCount = 0;

  for (const file of DELETIONS) {
    if (!fileExists(file)) {
      log(`Fichier déjà supprimé: ${file}`, 'verbose');
      continue;
    }

    if (!DRY_RUN) {
      fs.unlinkSync(file);
    }
    log(`Supprimé: ${file}`, 'success');
    deletedCount++;
  }

  log(`\n✅ ${deletedCount} fichiers supprimés\n`);
}

// ============================================
// ÉTAPE 2: DÉPLACER LES FICHIERS
// ============================================

function movePhase() {
  log('\n📦 Phase 2: Déplacement des fichiers\n');

  let movedCount = 0;

  for (const move of MOVES) {
    if (!fileExists(move.from)) {
      log(`Fichier source non trouvé: ${move.from}`, 'warning');
      continue;
    }

    if (fileExists(move.to)) {
      log(`Fichier destination existe déjà: ${move.to}`, 'warning');
      continue;
    }

    ensureDir(move.to);

    if (!DRY_RUN) {
      // Utiliser git mv pour préserver l'historique
      try {
        execSync(`git mv "${move.from}" "${move.to}"`, { stdio: 'ignore' });
        log(`Déplacé: ${move.from} → ${move.to}`, 'success');
      } catch (e) {
        // Fallback to regular move if git fails
        fs.renameSync(move.from, move.to);
        log(`Déplacé (sans git): ${move.from} → ${move.to}`, 'warning');
      }
    } else {
      log(`Déplacerait: ${move.from} → ${move.to}`, 'verbose');
    }

    movedCount++;
  }

  log(`\n✅ ${movedCount} fichiers déplacés\n`);
}

// ============================================
// ÉTAPE 3: METTRE À JOUR LES IMPORTS
// ============================================

function fixImportsPhase() {
  log('\n📦 Phase 3: Mise à jour des imports\n');

  let filesModified = 0;
  let importsFixed = 0;

  for (const [filePath, replacements] of Object.entries(IMPORT_REPLACEMENTS)) {
    if (!fileExists(filePath)) {
      log(`Fichier non trouvé pour fix imports: ${filePath}`, 'warning');
      continue;
    }

    let content = fs.readFileSync(filePath, 'utf8');
    let modified = false;
    let localFixes = 0;

    for (const replacement of replacements) {
      if (content.includes(replacement.from)) {
        content = content.replace(new RegExp(escapeRegex(replacement.from), 'g'), replacement.to);
        modified = true;
        localFixes++;
        log(`  ${path.basename(filePath)}: "${replacement.from}" → "${replacement.to}"`, 'verbose');
      }
    }

    if (modified) {
      if (!DRY_RUN) {
        fs.writeFileSync(filePath, content, 'utf8');
      }
      log(`Mis à jour: ${filePath} (${localFixes} imports)`, 'success');
      filesModified++;
      importsFixed += localFixes;
    }
  }

  log(`\n✅ ${filesModified} fichiers modifiés, ${importsFixed} imports fixés\n`);
}

function escapeRegex(string) {
  return string.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

// ============================================
// ÉTAPE 4: VALIDATION
// ============================================

function validationPhase() {
  log('\n📦 Phase 4: Validation\n');

  // Vérifier que tous les nouveaux fichiers existent
  let missingFiles = 0;
  for (const move of MOVES) {
    if (!fileExists(move.to)) {
      log(`Fichier manquant: ${move.to}`, 'error');
      missingFiles++;
    }
  }

  // Vérifier que les anciens fichiers ont été supprimés
  let remainingOldFiles = 0;
  for (const move of MOVES) {
    if (fileExists(move.from)) {
      log(`Ancien fichier toujours présent: ${move.from}`, 'warning');
      remainingOldFiles++;
    }
  }

  if (missingFiles === 0 && remainingOldFiles === 0) {
    log('✅ Validation réussie!\n', 'success');
    return true;
  } else {
    log(`⚠️  ${missingFiles} fichiers manquants, ${remainingOldFiles} anciens fichiers restants\n`, 'warning');
    return false;
  }
}

// ============================================
// MAIN
// ============================================

function main() {
  try {
    // Phase 1: Supprimer les fichiers obsolètes
    deletionPhase();

    // Phase 2: Déplacer les fichiers
    movePhase();

    // Phase 3: Fixer les imports
    fixImportsPhase();

    // Phase 4: Validation
    if (!DRY_RUN) {
      const valid = validationPhase();

      if (valid) {
        log('�� Réorganisation terminée avec succès!', 'success');
        log('\n📝 Prochaines étapes:');
        log('   1. Exécuter: npm run lint');
        log('   2. Exécuter: npm run build');
        log('   3. Tester: npm run dev');
        log('   4. Vérifier toutes les routes: /, /analyze, /tests, /tests/:testId');
        log('   5. Si tout fonctionne: git add . && git commit -m "refactor: reorganize components structure"');
      } else {
        log('⚠️  Réorganisation terminée avec des avertissements', 'warning');
      }
    } else {
      log('\n✅ Dry-run terminé. Exécutez sans --dry-run pour appliquer les changements.', 'success');
    }

  } catch (error) {
    log(`Erreur: ${error.message}`, 'error');
    console.error(error);
    process.exit(1);
  }
}

// Exécuter
main();
