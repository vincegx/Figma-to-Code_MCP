# MCP Figma to Code - V1

Dashboard pour analyser des designs Figma et générer du code React avec fidélité 100%.

## Prérequis

- **MCP Figma Desktop** doit être lancé sur votre machine (port 3845)
- **Docker** et **Docker Compose** installés

## Installation & Utilisation

### Option 1 : Avec Docker (Recommandé)

```bash
# Build et lancer le container
docker-compose up --build

# Accéder à l'application
# http://localhost:5173
```

Le container utilise `network_mode: host` pour accéder au serveur MCP Figma sur votre machine.

**Volumes montés :**
- `src/` : Hot reload activé
- `src/generated/` : Fichiers générés accessibles depuis l'host

**Arrêter le container :**
```bash
docker-compose down
```

### Option 2 : Installation locale

```bash
npm install
npm run dev
```

## Utilisation

### Analyser un design Figma
Utiliser la commande Claude : `/analyze-mcp <url-figma>`

Le workflow complet :
1. Extraction des données Figma via MCP
2. Post-processing (AST, images, SVG)
3. Validation visuelle automatique
4. Génération du rapport de fidélité

## Stack Technique
- React 19 + Vite
- TailwindCSS
- MCP Figma Desktop
- Babel (AST processing)
- Puppeteer (validation visuelle)
- Docker (containerisation)
