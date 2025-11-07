# SVG Consolidation - Problèmes & Solutions

## Problème Initial

Le logo "VAYA MENTAWAI" (14 SVG séparés) était mal rendu après consolidation : lettres cassées et mal alignées.

## Causes Racines

### 1. ViewBox Incorrect
**Symptôme :** Le logo consolidé avait `viewBox="0 0 50 50"` au lieu de `viewBox="0 0 140 49.551"`

**Cause :** Le script calculait le viewBox en agrégeant les bounding boxes des SVG individuels au lieu d'utiliser les dimensions du container parent.

**Solution :** Extraire les dimensions du container depuis le className Tailwind :
```javascript
const widthMatch = className.match(/w-\[(\d+(?:\.\d+)?)px\]/)
const heightMatch = className.match(/h-\[(\d+(?:\.\d+)?)px\]/)
```

### 2. Positionnement Manquant
**Symptôme :** Tous les SVG étaient empilés au même endroit sans respecter leur position relative.

**Cause :** Figma MCP exporte chaque vecteur avec un viewBox local (coordonnées relatives au vecteur), pas avec des coordonnées globales.

**Solution :** Parser les classes CSS de positionnement (`left-[%]`, `right-[%]`, `top-[%]`, `bottom-[%]`, `inset-[...]`) et calculer des transforms SVG :
```javascript
function parsePositionAndTransform(cssPosition, containerWidth, containerHeight, svgViewBox) {
  // Parse CSS positioning classes
  const x = (left / 100) * containerWidth
  const y = (top / 100) * containerHeight
  const scaleX = elementWidth / vbW
  const scaleY = elementHeight / vbH

  return { x, y, scaleX, scaleY }
}
```

Génération avec `<g transform="">` :
```xml
<svg viewBox="0 0 140 49.551">
  <g transform="translate(0, 0) scale(0.990, 0.991)">
    <path d="..." />
  </g>
  <g transform="translate(120.792, 7.373) scale(0.960, 0.970)">
    <path d="..." />
  </g>
</svg>
```

### 3. Capture de className Incorrecte
**Symptôme :** Aucune position n'était capturée car tous les SVG avaient `cssPosition: null`.

**Cause :** Structure DOM avec wrapper `inset-0` :
```jsx
<div className="absolute left-[0%] right-[64.64%]">  ← BONNE POSITION
  <div className="absolute inset-0">                  ← WRAPPER
    <img src={svg} />                                  ← ON CAPTURAIT ICI
  </div>
</div>
```

**Solution :** Tracker `grandparentClassName` en plus de `parentClassName` et utiliser le grandparent si le parent est juste "inset-0".

### 4. Consolidation Récursive Excessive
**Symptôme :** Le Header consolidait les SVG du logo enfant, créant `header.svg` avec le logo dedans, et `logo.svg` n'était jamais utilisé.

**Cause :** Le script traversait récursivement TOUS les divs enfants sans distinction.

**Solution :** Ne pas traverser dans les divs avec `data-name` car ils représentent des composants Figma distincts qui seront consolidés séparément :
```javascript
const childDataName = childDataNameAttr?.value?.value
const isTechnicalWrapper = childDataName === 'Vector' || childDataName === 'Group'

if (childDataName && !isTechnicalWrapper) {
  continue  // Skip component boundaries
}
```

Exception pour les wrappers techniques Figma (`Vector`, `Group`) qui font partie du composant parent.

## Architecture Finale

### Pipeline de Consolidation

1. **Identification des groupes** : Divs avec `data-name` + 5+ SVG enfants
2. **Extraction des données** :
   - Dimensions container : `w-[140px] h-[49.551px]`
   - Positions CSS : `left-[0%] right-[64.64%] top-[0%] bottom-[0%]`
   - ViewBox de chaque SVG individuel
3. **Calcul des transforms** : Position absolue + scale basé sur le ratio viewBox/dimensions
4. **Génération SVG** : Un fichier consolidé avec `<g transform="">` pour chaque élément
5. **Transformation AST** : Remplacer les multiples `<img>` par un seul `<img src={logoConsolidé}>`

### Règles de Consolidation

- ✅ Consolider : Groupes de 5+ SVG dans un div avec `data-name`
- ❌ Ne pas consolider : Divs enfants avec `data-name` (sauf "Vector"/"Group")
- ✅ Respecter : La hiérarchie Figma (composants = frontières)
- ✅ Utiliser : Dimensions du container parent comme viewBox global

## Résultat

**Avant :**
```jsx
<div className="logo">
  <div><img src={img1} /></div>
  <div><img src={img2} /></div>
  ...
  <div><img src={img14} /></div>
</div>
```

**Après :**
```jsx
<div className="logo">
  <img src={imgLogo} alt="logo" />
</div>
```

**Fichier généré :**
```xml
<svg viewBox="0 0 140 49.551">
  <g transform="translate(0, 0) scale(0.990, 0.991)">
    <path d="..." fill="white" />
  </g>
  <g transform="translate(120.792, 7.373) scale(0.960, 0.970)">
    <path d="..." fill="white" />
  </g>
  <!-- 12 autres lettres -->
</svg>
```

**Fidélité :** 100% - Logo parfaitement aligné comme dans Figma.
