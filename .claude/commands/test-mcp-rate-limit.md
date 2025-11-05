---
description: Test rapide MCP Figma - Vérifie si rate limit présent
---

# 🧪 Test Rate Limit MCP Figma

Test rapide pour vérifier si le rate limit Figma affecte les appels MCP via Claude Code.

## URL Figma à tester

{{url}}

---

## 📋 PROCESSUS DE TEST RAPIDE

### Étape 1: Extraction du nodeId

Extraire `nodeId` de l'URL et le convertir au format MCP :
- Format URL : `node-id=9-2654`
- Format MCP : `9:2654` (remplacer `-` par `:`)

### Étape 2: Appel MCP minimal

Utiliser l'outil MCP **`mcp__figma-desktop__get_metadata`** avec :

Paramètres :
- `nodeId`: {nodeId au format MCP avec :}
- `clientLanguages`: "javascript,typescript"
- `clientFrameworks`: "react"

**IMPORTANT**: Utilise UN SEUL appel MCP pour tester.

### Étape 3: Analyse du résultat

**Si SUCCESS** :
- ✅ Afficher : "Pas de rate limit sur ce compte Claude Code"
- Montrer les premières lignes du XML reçu

**Si ERREUR contenant** :
- "rate limit exceeded" → ⚠️ Rate limit présent aussi sur Claude Code
- "please try again" → ⚠️ Rate limit présent aussi sur Claude Code
- "unauthorized" → ⚠️ Problème d'authentification
- Autre erreur → 🔍 Afficher l'erreur complète

---

## 🎯 RÉSULTAT ATTENDU

Ce test permet de savoir si :
1. Claude Code MCP a un quota indépendant de votre script CLI
2. Ou si le rate limit Figma est partagé/bloque tout le monde

**C'est parti !** 🚀
