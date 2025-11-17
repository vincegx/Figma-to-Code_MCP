# Guidelines de développement Claude Code

## Analyse préalable OBLIGATOIRE
- Toujours lire le `claude.md` du projet en premier
- Scanner la structure des dossiers avant tout changement
- Identifier les patterns et conventions existants
- Repérer les fichiers de configuration (tsconfig, eslint, prettier, etc.)

## Principes de modification du code

### 1. Diagnostic avant correction
- Localiser précisément le bug/problème
- Identifier la cause racine
- Ne modifier QUE ce qui est nécessaire
- Éviter les refactorings non demandés

### 2. Respect de l'architecture
- Suivre la structure de dossiers existante
- Respecter les séparations de responsabilités
- Maintenir la cohérence des imports/exports
- Ne pas créer de nouvelles structures sans validation

### 3. Conventions à respecter
- Style de code existant (indentation, quotes, semicolons)
- Nomenclature des variables/fonctions/composants
- Patterns architecturaux (hooks, stores, utils)
- Gestion d'état et side effects

### 4. Code maintenable
- Commentaires uniquement pour la logique complexe
- Fonctions courtes et focused
- Typage explicite (TypeScript)
- Pas de code mort ou commenté

## Workflow standard
1. Lire `claude.md` projet + scanner structure
2. Comprendre le contexte complet
3. Proposer solution minimale
4. Implémenter changements ciblés
5. Vérifier impact sur le reste du code

## Anti-patterns à éviter
- ❌ Réécrire du code fonctionnel
- ❌ Ajouter des features non demandées
- ❌ Changer l'architecture sans raison
- ❌ Over-engineering
- ❌ Ignorer les conventions existantes