---
description: Analyse une URL Figma via MCP et génère un test complet avec FIDÉLITÉ 100%
---

# 🎯 Analyse Figma via MCP - PROCESSUS OPTIMISÉ FIDÉLITÉ 100%

Tu vas analyser une URL Figma et générer un test avec une **fidélité visuelle de 100%** par rapport au design Figma.

## URL à analyser

{{url}}

---

## ⚙️ Vérification Docker

```bash
docker ps | grep -q mcp-figma-v1 || docker-compose up -d
```

---

## 📋 PROCESSUS EN 4 PHASES

### ┌─────────────────────────────────────────────────────────┐
### │  PHASE 1: EXTRACTION FIGMA (Tout récupérer)             │
### └─────────────────────────────────────────────────────────┘

**Objectif:** Récupérer TOUTES les données nécessaires depuis Figma

#### 1.1 Préparation
- Extraire `fileId` et `nodeId` de {{url}}
- Convertir `nodeId` : `9-2654` → `9:2654`
- Générer timestamp : `timestamp=$(date +%s)`
- Créer : `src/generated/tests/node-{nodeId}-{timestamp}/`

#### 1.2a Nettoyer /tmp/figma-assets (OBLIGATOIRE)

```bash
rm -rf /tmp/figma-assets/
mkdir -p /tmp/figma-assets/
```

**CRITICAL:** Supprime les images des tests précédents pour éviter contamination croisée.

#### 1.2 Appeler les MCP tools EN PARALLÈLE (dans un seul message avec plusieurs tool calls)

Utilise ces 4 outils MCP Figma **en parallèle** pour récupérer toutes les données:

Paramètres communs pour tous :
- `nodeId: {nodeId parsé}`
- `clientLanguages: "javascript,typescript"`
- `clientFrameworks: "react"`
- **`dirForAssetWrites: /tmp/figma-assets`** (tmp car problème permissions direct)

1. **`mcp__figma-desktop__get_design_context`**
   - `forceCode: true`
   - `dirForAssetWrites: /tmp/figma-assets` → Écrit assets dans tmp
   - → Code React + Tailwind complet

2. **`mcp__figma-desktop__get_screenshot`**
   - → PNG pour validation visuelle (**CRITICAL** : tu verras l'image)

3. **`mcp__figma-desktop__get_variable_defs`**
   - → Variables design (couleurs, spacing)

4. **`mcp__figma-desktop__get_metadata`**
   - → Structure XML (hiérarchie)

**IMPORTANT:** Appelle ces 4 tools **en parallèle** dans UN SEUL message.

#### 1.2b Copier les assets depuis /tmp

```bash
# Compter combien d'images on attend depuis Component.tsx
expected_count=$(grep -o '/tmp/figma-assets/[^"]*\.\(png\|svg\|jpg\|jpeg\|gif\|webp\)' \
  src/generated/tests/node-{nodeId}-{timestamp}/Component.tsx | sort -u | wc -l)

echo "⏳ Attente de $expected_count images MCP..."

# Attendre CE nombre précis d'images (max 30s)
for i in {1..30}; do
  actual_count=$(ls /tmp/figma-assets/*.{png,svg,jpg,jpeg,gif,webp} 2>/dev/null | wc -l)
  if [ "$actual_count" -ge "$expected_count" ]; then
    echo "   ✅ $actual_count/$expected_count images détectées après ${i}s"
    break
  fi
  if [ "$i" -eq 30 ]; then
    echo "   ⚠️ Timeout: seulement $actual_count/$expected_count images après 30s"
  fi
  sleep 1
done

# Copier dans la racine (organize-images.js les déplacera vers img/)
cp -r /tmp/figma-assets/* src/generated/tests/node-{nodeId}-{timestamp}/ 2>/dev/null || true
```

**Si get_design_context échoue (>25k tokens) - MODE CHUNKING:**

1. Extraire liste nœuds: `mkdir -p src/generated/tests/node-{nodeId}-{timestamp}/chunks && docker exec mcp-figma-v1 node scripts/utils/chunking.js extract-nodes src/generated/tests/node-{nodeId}-{timestamp}/metadata.xml`

2. **POUR CHAQUE NŒUD - UN PAR UN - SÉQUENTIEL:**
   - Appel `mcp__figma-desktop__get_design_context` avec nodeId du nœud
   - IMMÉDIATEMENT après, sauvegarder avec Write tool: `src/generated/tests/node-{nodeId}-{timestamp}/chunks/NomNoeud.tsx` avec contenu MCP
   - **NE PAS PASSER AU NŒUD SUIVANT AVANT D'AVOIR SAUVEGARDÉ**

3. Quand TOUS les chunks sont sauvegardés: `docker exec mcp-figma-v1 node scripts/utils/chunking.js assemble-chunks src/generated/tests/node-{nodeId}-{timestamp} Component src/generated/tests/node-{nodeId}-{timestamp}/chunks/*.tsx`

#### 1.3 Sauvegarder avec Write tool

Sauvegarder les 3 fichiers en parallèle avec Write tool :

1. `src/generated/tests/node-{nodeId}-{timestamp}/Component.tsx` avec contenu de `get_design_context`
2. `src/generated/tests/node-{nodeId}-{timestamp}/variables.json` avec contenu de `get_variable_defs`
3. `src/generated/tests/node-{nodeId}-{timestamp}/metadata.xml` avec contenu de `get_metadata`

```bash
echo "✅ Phase 1 terminée"
```

---

### ┌─────────────────────────────────────────────────────────┐
### │  PHASE 2: POST-PROCESSING INTELLIGENT                   │
### └─────────────────────────────────────────────────────────┘

**Objectif:** Fixer tous les éléments cassés pour fidélité 100%

#### 2.1 Organiser les images (FIRST)

**IMPORTANT:** Vérifier que les images sont bien dans la racine avant de lancer organize-images.js.

```bash
# Vérifier que les images sont présentes dans la racine du test
test_dir="src/generated/tests/node-{nodeId}-{timestamp}"
image_count=$(ls "$test_dir"/*.{png,svg,jpg,jpeg,gif,webp} 2>/dev/null | wc -l)

if [ "$image_count" -gt 0 ]; then
  echo "✅ $image_count images trouvées dans la racine, lancement de organize-images.js"
  docker exec mcp-figma-v1 node scripts/post-processing/organize-images.js "$test_dir"
else
  echo "⚠️  Aucune image trouvée dans $test_dir - organize-images.js non lancé"
  echo "   Vérifiez que la copie depuis /tmp/figma-assets/ s'est bien passée"
fi
```

Crée `img/`, déplace images, renomme avec noms Figma, convertit en imports ES6.

#### 2.2 Appliquer le processeur unifié

```bash
docker exec mcp-figma-v1 node scripts/unified-processor.js \
  src/generated/tests/node-{nodeId}-{timestamp}/Component.tsx \
  src/generated/tests/node-{nodeId}-{timestamp}/Component-fixed.tsx \
  src/generated/tests/node-{nodeId}-{timestamp}/metadata.xml \
  "{{url}}"
```

AST cleaning, gradients, shapes, CSS vars, Tailwind optimization. Génère metadata.json + analysis.md + report.html.

#### 2.3 Fixer variables CSS dans les SVG

```bash
docker exec mcp-figma-v1 node scripts/post-processing/fix-svg-vars.js src/generated/tests/node-{nodeId}-{timestamp}/img
```

#### 2.4 VALIDATION VISUELLE (OBLIGATOIRE)

Cette étape garantit la fidélité 100%. Screenshot Figma (Phase 1) vs rendu web réel.

**A. Vérifier serveur dev**
```bash
docker ps | grep mcp-figma-v1 || echo "⚠️ Container Docker non lancé - Lancer: docker-compose up"
```
Si non lancé, demander à l'utilisateur de lancer `docker-compose up`.

**B. Capturer screenshot web**
```bash
docker exec mcp-figma-v1 node scripts/post-processing/capture-screenshot.js src/generated/tests/node-{nodeId}-{timestamp} 5173
```

**C. Voir le rendu web**
Utilise Read tool sur `src/generated/tests/node-{nodeId}-{timestamp}/web-render.png`

**D. Comparer visuellement**
Tu as 2 images (Figma depuis Phase 1 + Web depuis étape C).
Compare : couleurs, espacements, fonts, tailles, gradients, shapes, shadows, borders, opacité, alignement.

**E. Corrections**
- **Simple** (couleur, spacing, taille) → Fixe directement sans demander
- **Complexe** (structure, logique) → Propose solutions et demande validation

**F. Feedback**
Confirme fidélité 100% ou liste corrections appliquées.

**Note:** Les fichiers metadata.json, analysis.md et report.html sont générés automatiquement par unified-processor.js (étape 2.1).

---

## ✅ CHECKLIST FINALE

- [ ] /tmp/figma-assets/ nettoyé avant MCP calls (évite contamination croisée)
- [ ] 4 MCP tools EN PARALLÈLE + screenshot Figma vu
- [ ] Component.tsx complet
- [ ] Unified processor appliqué avec URL Figma (génération auto des metadata/reports)
- [ ] Images organisées + SVG vars fixés
- [ ] VALIDATION VISUELLE effectuée (Étapes A-F) + fidélité 100% confirmée

---

## 🎉 RÉSULTAT

Test avec fidélité visuelle 100% : gradients, shapes, blend modes, couleurs, espacements, images fonctionnels.

**C'est parti!** 🚀
