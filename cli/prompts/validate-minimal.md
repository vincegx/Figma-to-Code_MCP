---
description: Validation visuelle Figma → Web + corrections si nécessaire
---

# 🎯 Validation visuelle Figma

Test à valider: **{{test_id}}**

Test directory: `src/generated/tests/{{test_id}}/`

---

## Étapes de validation

### 1. Lire les screenshots (déjà générés par figma-analyze)

Utilise le Read tool pour lire les 2 screenshots:

- `src/generated/tests/{{test_id}}/figma-screenshot.png` (design Figma)
- `src/generated/tests/{{test_id}}/web-render.png` (rendu web)

**Important:** Ces 2 fichiers ont déjà été générés par `figma-analyze`. Tu dois juste les lire.

### 2. Lire le composant à corriger

- `src/generated/tests/{{test_id}}/Component-fixed.tsx`

### 3. Comparer visuellement les 2 screenshots

Compare **TRÈS ATTENTIVEMENT** les 2 images et identifie les différences:

**Couleurs:**
- Background colors identiques?
- Text colors identiques?
- Border colors identiques?
- Gradients: mêmes angles, mêmes couleurs, mêmes positions?

**Espacements:**
- Padding identique?
- Margin identique?
- Gap (flexbox/grid) identique?
- Spacing entre éléments identique?

**Typographie:**
- Font family identique?
- Font size identique?
- Font weight identique?
- Line height identique?
- Letter spacing identique?
- Text transform (uppercase, lowercase) identique?

**Effets visuels:**
- Shadows: mêmes offsets (x, y), même blur, même spread, même couleur?
- Gradients: mêmes angles, mêmes couleurs, mêmes stops?
- Blend modes corrects?
- Opacity correcte?

**Layout:**
- Positioning correct (absolute, relative, flex)?
- Dimensions correctes (width, height)?
- Overflow géré?
- Z-index correct?

**Images & Assets:**
- Toutes les images chargées?
- Positions correctes?
- Sizes correctes?

**Borders & Strokes:**
- Border width identique?
- Border style identique?
- Border radius identique?
- Stroke alignment (inside, outside, center)?

### 4. SI différences détectées

**A. Identifier précisément les écarts**

Pour chaque différence, note:
- **Où** (quel élément, quelle ligne de code)
- **Quoi** (quelle propriété CSS)
- **Figma** (valeur attendue)
- **Web** (valeur actuelle)

Exemple:
```
Différence 1: Gradient angle
  - Élément: .hero-banner (ligne 45)
  - Propriété: background
  - Figma: linear-gradient(47deg, ...)
  - Web: linear-gradient(45deg, ...)
  - Correction: Changer 45deg → 47deg
```

**B. Appliquer les corrections**

Utilise le Edit tool sur `src/generated/tests/{{test_id}}/Component-fixed.tsx` pour corriger les différences.

**Corrections simples (applique directement):**
- Couleurs (hex, rgb, rgba)
- Espacements (padding, margin, gap)
- Font sizes, weights
- Border radius
- Shadows (box-shadow)
- Gradients (angles, colors)

**Corrections complexes (demande confirmation):**
- Changements de structure HTML
- Changements de logique (conditions, boucles)
- Ajout/suppression de composants

**C. Générer Component-final.tsx**

Après corrections, génère `src/generated/tests/{{test_id}}/Component-final.tsx` avec le code corrigé.

### 5. Confirmer fidélité 100%

Une fois les corrections appliquées, confirme:

```
✅ Validation terminée

Corrections appliquées:
• [Liste des corrections avec détails]

🎉 Fidélité finale: 100%
```

**OU** si aucune différence détectée:

```
✅ Validation terminée

Aucune différence détectée entre Figma et Web.
🎉 Fidélité: 100% (sans corrections nécessaires)
```

---

## Checklist finale

- [ ] Screenshots lus (figma-screenshot.png + web-render.png)
- [ ] Comparaison visuelle effectuée (tous les aspects: couleurs, espacements, fonts, shadows, gradients, etc.)
- [ ] Différences identifiées précisément (si applicable)
- [ ] Corrections appliquées (si applicable)
- [ ] Fidélité 100% confirmée

---

## Notes importantes

- **PRÉCISION:** Sois très précis dans l'identification des différences. Par exemple, "gradient angle 45deg au lieu de 47deg" et pas juste "gradient incorrect".
- **NE PAS REGÉNÉRER:** Ne relance PAS `capture-screenshot.js`. Les screenshots sont déjà générés.
- **CORRECTIONS CIBLÉES:** Modifie uniquement les propriétés CSS nécessaires, ne réécris pas tout le composant.
- **DOCUMENTATION:** Documente chaque correction appliquée pour traçabilité.

**C'est parti! 🚀**
