# 🗂️ Plan de Réorganisation des Composants

## 📊 Structure Actuelle (Bordel)

```
src/components/
├── AnalysisForm.tsx
├── HomePage.tsx ❌ (à supprimer)
├── HomePage.tsx.backup ❌ (à supprimer)
├── LanguageSwitcher.tsx
├── TestDetail.tsx
├── TestsGrid.tsx
├── TestsTable.tsx
├── ThemeToggle.tsx
├── UsageBar.tsx
├── app-sidebar.tsx
├── controls-bar.tsx
├── pagination-controls.tsx
├── section-cards.tsx ❌ (à supprimer)
├── site-header.tsx
├── test-card.tsx
├── layout/
│   └── MainLayout.tsx
├── pages/
│   ├── AnalyzePage.tsx
│   ├── DashboardPage.tsx
│   └── TestsPage.tsx
└── ui/ (shadcn - OK)
```

## ✨ Nouvelle Structure (Propre & Logique)

```
src/components/
├── layout/                    # Layouts & structure principale
│   ├── MainLayout.tsx        ✅ (déjà là)
│   ├── AppSidebar.tsx        📦 (app-sidebar.tsx renommé)
│   └── SiteHeader.tsx        📦 (site-header.tsx renommé)
│
├── pages/                     # Pages/Routes
│   ├── DashboardPage.tsx     ✅ (déjà là)
│   ├── TestsPage.tsx         ✅ (déjà là)
│   ├── AnalyzePage.tsx       ✅ (déjà là)
│   └── TestDetailPage.tsx    📦 (TestDetail.tsx déplacé)
│
├── features/                  # Features groupées par domaine
│   ├── analysis/
│   │   └── AnalysisForm.tsx  📦
│   ├── tests/
│   │   ├── TestsGrid.tsx     📦
│   │   ├── TestsTable.tsx    📦
│   │   ├── TestCard.tsx      📦 (test-card.tsx renommé)
│   │   ├── ControlsBar.tsx   📦 (controls-bar.tsx renommé)
│   │   └── PaginationControls.tsx 📦 (pagination-controls.tsx renommé)
│   └── stats/
│       └── UsageBar.tsx      📦
│
├── common/                    # Composants communs réutilisables
│   ├── ThemeToggle.tsx       📦
│   └── LanguageSwitcher.tsx  📦
│
└── ui/                        # shadcn UI components
    └── ... (ne pas toucher)
```

---

## 🔄 Mapping Complet des Déplacements

### Phase 1: Fichiers à SUPPRIMER
```bash
rm src/components/HomePage.tsx
rm src/components/HomePage.tsx.backup
rm src/components/section-cards.tsx
rm tmp/sreenlist.png
```

### Phase 2: Fichiers à DÉPLACER & RENOMMER

| Ancien Chemin | Nouveau Chemin | Raison |
|---------------|----------------|--------|
| `app-sidebar.tsx` | `layout/AppSidebar.tsx` | PascalCase + layout |
| `site-header.tsx` | `layout/SiteHeader.tsx` | PascalCase + layout |
| `TestDetail.tsx` | `pages/TestDetailPage.tsx` | C'est une page |
| `AnalysisForm.tsx` | `features/analysis/AnalysisForm.tsx` | Feature analysis |
| `TestsGrid.tsx` | `features/tests/TestsGrid.tsx` | Feature tests |
| `TestsTable.tsx` | `features/tests/TestsTable.tsx` | Feature tests |
| `test-card.tsx` | `features/tests/TestCard.tsx` | PascalCase + feature |
| `controls-bar.tsx` | `features/tests/ControlsBar.tsx` | PascalCase + feature |
| `pagination-controls.tsx` | `features/tests/PaginationControls.tsx` | PascalCase + feature |
| `UsageBar.tsx` | `features/stats/UsageBar.tsx` | Feature stats |
| `ThemeToggle.tsx` | `common/ThemeToggle.tsx` | Composant commun |
| `LanguageSwitcher.tsx` | `common/LanguageSwitcher.tsx` | Composant commun |

---

## 📝 Mapping des Imports à Modifier

### Fichier: `src/App.tsx`

| Ancien Import | Nouveau Import |
|---------------|----------------|
| `import MainLayout from './components/layout/MainLayout'` | ✅ (pas de changement) |
| `import DashboardPage from './components/pages/DashboardPage'` | ✅ (pas de changement) |
| `import AnalyzePage from './components/pages/AnalyzePage'` | ✅ (pas de changement) |
| `import TestsPage from './components/pages/TestsPage'` | ✅ (pas de changement) |
| `import TestDetail from './components/TestDetail'` | `import TestDetailPage from './components/pages/TestDetailPage'` |

### Fichier: `src/components/layout/MainLayout.tsx`

| Ancien Import | Nouveau Import |
|---------------|----------------|
| `import { AppSidebar } from '../app-sidebar'` | `import { AppSidebar } from './AppSidebar'` |
| `import { SiteHeader } from '../site-header'` | `import { SiteHeader } from './SiteHeader'` |
| `import { useMcpConnection } from '../../hooks/useMcpConnection'` | ✅ (pas de changement) |

### Fichier: `src/components/layout/AppSidebar.tsx` (ex app-sidebar.tsx)

| Ancien Import | Nouveau Import |
|---------------|----------------|
| `import ThemeToggle from './ThemeToggle'` | `import ThemeToggle from '../common/ThemeToggle'` |
| `import LanguageSwitcher from './LanguageSwitcher'` | `import LanguageSwitcher from '../common/LanguageSwitcher'` |
| `import { useTranslation } from '../i18n/I18nContext'` | `import { useTranslation } from '../../i18n/I18nContext'` |

### Fichier: `src/components/layout/SiteHeader.tsx` (ex site-header.tsx)

| Ancien Import | Nouveau Import |
|---------------|----------------|
| `import { UsageBar } from './UsageBar'` | `import { UsageBar } from '../features/stats/UsageBar'` |
| `import { useTranslation } from '../i18n/I18nContext'` | `import { useTranslation } from '../../i18n/I18nContext'` |

### Fichier: `src/components/pages/AnalyzePage.tsx`

| Ancien Import | Nouveau Import |
|---------------|----------------|
| `import AnalysisForm from '../AnalysisForm'` | `import AnalysisForm from '../features/analysis/AnalysisForm'` |
| `import { useTests } from '../../hooks/useTests'` | ✅ (pas de changement) |

### Fichier: `src/components/pages/TestsPage.tsx`

| Ancien Import | Nouveau Import |
|---------------|----------------|
| `import { ControlsBar } from '../controls-bar'` | `import { ControlsBar } from '../features/tests/ControlsBar'` |
| `import { PaginationControls } from '../pagination-controls'` | `import { PaginationControls } from '../features/tests/PaginationControls'` |
| `import TestsGrid from '../TestsGrid'` | `import TestsGrid from '../features/tests/TestsGrid'` |
| `import TestsTable from '../TestsTable'` | `import TestsTable from '../features/tests/TestsTable'` |
| `import { useTests } from '../../hooks/useTests'` | ✅ (pas de changement) |
| `import { useTranslation } from '../../i18n/I18nContext'` | ✅ (pas de changement) |

### Fichier: `src/components/features/tests/TestsGrid.tsx` (ex TestsGrid.tsx)

| Ancien Import | Nouveau Import |
|---------------|----------------|
| `import { TestCard } from './test-card'` | `import { TestCard } from './TestCard'` |

### Fichiers avec import i18n (changement de profondeur)

**Fichiers à 1 niveau de profondeur (avant) → 3 niveaux (après):**

- `features/analysis/AnalysisForm.tsx`: `'../i18n'` → `'../../../i18n'`
- `features/stats/UsageBar.tsx`: `'../i18n'` → `'../../../i18n'`
- `common/ThemeToggle.tsx`: `'../contexts'` → `'../../contexts'`
- `common/LanguageSwitcher.tsx`: `'../i18n'` → `'../../i18n'`

**Fichiers à 2 niveaux de profondeur (avant) → 3 niveaux (après):**

- `features/tests/TestCard.tsx`: `'../i18n'` → `'../../../i18n'`
- `features/tests/TestsTable.tsx`: `'../i18n'` → `'../../../i18n'`
- `features/tests/PaginationControls.tsx`: `'../i18n'` → `'../../../i18n'`
- `features/tests/ControlsBar.tsx`: `'../i18n'` → `'../../../i18n'`

**Fichiers dans pages/ (déjà à 2 niveaux, bonne profondeur):**

- `pages/TestDetailPage.tsx`: `'../i18n'` → `'../../i18n'` ✅

---

## 🎯 Plan d'Exécution Automatique

### Option 1: Script de Migration Manuelle (Recommandé)

```bash
# 1. Créer les nouveaux dossiers
mkdir -p src/components/features/analysis
mkdir -p src/components/features/tests
mkdir -p src/components/features/stats
mkdir -p src/components/common

# 2. Déplacer les fichiers
git mv src/components/app-sidebar.tsx src/components/layout/AppSidebar.tsx
git mv src/components/site-header.tsx src/components/layout/SiteHeader.tsx
git mv src/components/TestDetail.tsx src/components/pages/TestDetailPage.tsx
git mv src/components/AnalysisForm.tsx src/components/features/analysis/AnalysisForm.tsx
git mv src/components/TestsGrid.tsx src/components/features/tests/TestsGrid.tsx
git mv src/components/TestsTable.tsx src/components/features/tests/TestsTable.tsx
git mv src/components/test-card.tsx src/components/features/tests/TestCard.tsx
git mv src/components/controls-bar.tsx src/components/features/tests/ControlsBar.tsx
git mv src/components/pagination-controls.tsx src/components/features/tests/PaginationControls.tsx
git mv src/components/UsageBar.tsx src/components/features/stats/UsageBar.tsx
git mv src/components/ThemeToggle.tsx src/components/common/ThemeToggle.tsx
git mv src/components/LanguageSwitcher.tsx src/components/common/LanguageSwitcher.tsx

# 3. Supprimer les fichiers obsolètes
rm src/components/HomePage.tsx
rm src/components/HomePage.tsx.backup
rm src/components/section-cards.tsx
rm tmp/sreenlist.png

# 4. Lancer le script de fix des imports (à créer)
node scripts/fix-imports.js
```

### Option 2: Script Node.js Automatique

Créer un script `scripts/reorganize-components.js` qui:
1. Déplace les fichiers
2. Met à jour tous les imports automatiquement via AST
3. Vérifie qu'aucun import n'est cassé

---

## ✅ Checklist de Validation

- [ ] Tous les fichiers sont déplacés
- [ ] Tous les imports sont mis à jour
- [ ] `npm run lint` passe sans erreur
- [ ] `npm run build` réussit
- [ ] Le dashboard s'affiche correctement à http://localhost:5173
- [ ] Les routes fonctionnent: `/`, `/analyze`, `/tests`, `/tests/:testId`
- [ ] La navigation fonctionne (sidebar, header)
- [ ] Le changement de thème fonctionne
- [ ] Le changement de langue fonctionne
- [ ] Les previews de tests s'affichent correctement

---

## 🚀 Bénéfices de cette Organisation

### Avant (Bordel)
```
components/
├── 15 fichiers mélangés à la racine 😵
├── Nommage incohérent (kebab-case & PascalCase)
└── Difficile de retrouver un composant
```

### Après (Propre)
```
components/
├── layout/ → Layouts principaux (3 fichiers)
├── pages/ → Pages/Routes (4 fichiers)
├── features/ → Logique métier groupée (9 fichiers)
│   ├── analysis/ → Tout ce qui touche à l'analyse
│   ├── tests/ → Tout ce qui touche aux tests
│   └── stats/ → Statistiques & usage
├── common/ → Composants réutilisables (2 fichiers)
└── ui/ → Primitives shadcn
```

**Gains:**
- ✅ Structure claire et prévisible
- ✅ Nommage cohérent (PascalCase partout)
- ✅ Facilité de maintenance
- ✅ Séparation des responsabilités
- ✅ Facile de retrouver un composant
- ✅ Prêt pour scale (ajouter de nouvelles features)
