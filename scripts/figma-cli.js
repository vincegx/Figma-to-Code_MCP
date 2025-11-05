#!/usr/bin/env node

import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StreamableHTTPClientTransport } from '@modelcontextprotocol/sdk/client/streamableHttp.js';
import fs from 'fs';
import path from 'path';
import { execSync } from 'child_process';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

class FigmaCLI {
  constructor(url) {
    // Load config
    this.config = JSON.parse(
      fs.readFileSync(path.join(__dirname, '../cli/config/figma-params.json'), 'utf8')
    );

    // Fix dirForAssetWrites: MCP runs on host, so use host absolute path
    if (process.env.PROJECT_ROOT) {
      const hostPath = path.join(process.env.PROJECT_ROOT, 'tmp/figma-assets');
      this.config.commonParams.dirForAssetWrites = hostPath;
      console.log(`📂 Assets will be written to: ${hostPath} (on host)\n`);
    }

    // Parse Figma URL
    const parsed = this.parseUrl(url);
    this.fileId = parsed.fileId;
    this.nodeId = parsed.nodeId;
    this.nodeIdHyphen = parsed.nodeIdHyphen;
    this.figmaUrl = url;

    // Create test directory
    this.timestamp = Math.floor(Date.now() / 1000);
    this.testDir = path.join(
      __dirname,
      '..',
      this.config.directories.testsOutput,
      `node-${this.nodeIdHyphen}-${this.timestamp}`
    );

    this.client = null;
  }

  /**
   * Parse Figma URL and extract fileId + nodeId
   * Example: https://www.figma.com/design/abc123?node-id=9-2654
   * Returns: { fileId: 'abc123', nodeId: '9:2654', nodeIdHyphen: '9-2654' }
   */
  parseUrl(url) {
    try {
      const urlObj = new URL(url);

      // Extract fileId from path
      const pathParts = urlObj.pathname.split('/');
      const fileId = pathParts[pathParts.length - 1] || pathParts[pathParts.length - 2];

      // Extract nodeId from query params
      const nodeIdParam = urlObj.searchParams.get('node-id');
      if (!nodeIdParam) {
        throw new Error('node-id parameter not found in URL');
      }

      // Convert 9-2654 → 9:2654 (MCP format)
      const nodeId = nodeIdParam.replace(/-/g, ':');
      const nodeIdHyphen = nodeIdParam;

      return { fileId, nodeId, nodeIdHyphen };
    } catch (error) {
      console.error('❌ Error parsing Figma URL:', error.message);
      console.error('   Expected format: https://www.figma.com/design/FILE_ID?node-id=X-Y');
      process.exit(1);
    }
  }

  /**
   * Connect to MCP server via StreamableHTTP
   */
  async connectMCP() {
    console.log('🔌 Connexion au MCP server...');

    try {
      const transport = new StreamableHTTPClientTransport(
        new URL(this.config.mcpServer.url)
      );

      this.client = new Client(
        {
          name: 'figma-cli',
          version: '1.0.0'
        },
        {
          capabilities: {}
        }
      );

      await this.client.connect(transport);

      // List available tools (concise)
      const toolsResult = await this.client.listTools();
      console.log('   ✅ Connecté au MCP server');
      console.log(`   📋 ${toolsResult.tools.length} tools: ${toolsResult.tools.map(t => t.name).join(', ')}`);

      // Health check: verify the server can respond to a simple call
      console.log('   🏥 Test de santé du serveur...');
      try {
        // Try a simple call to verify the server is working
        const healthCheck = await this.client.callTool({
          name: 'mcp__figma-desktop__get_variable_defs',
          arguments: { nodeId: '1:1' } // Minimal test call
        });

        // Check if response contains error messages
        const responseText = JSON.stringify(healthCheck).toLowerCase();
        if (responseText.includes('rate limit') ||
            responseText.includes('try again') ||
            responseText.includes('unauthorized') ||
            responseText.includes('forbidden')) {
          throw new Error('Server responded with error: ' + responseText.substring(0, 200));
        }

        console.log('   ✅ Serveur MCP opérationnel\n');
      } catch (healthError) {
        console.error('\n❌ Le serveur MCP ne répond pas correctement');
        console.error('   Erreur:', healthError.message.substring(0, 200));
        console.error('\n📋 Actions requises:');
        console.error('   1. Ouvrez Figma Desktop App');
        console.error('   2. Assurez-vous d\'être connecté à votre compte Figma');
        console.error('   3. Vérifiez que le MCP server tourne sur', this.config.mcpServer.url);
        console.error('   4. Si "rate limit", attendez quelques minutes avant de réessayer');
        console.error('\n💡 Tip: Le serveur MCP nécessite Figma Desktop ouvert et connecté\n');
        process.exit(1);
      }
    } catch (error) {
      console.error('\n❌ Erreur connexion MCP:', error.message);
      console.error('\n📋 Actions requises:');
      console.error('   1. Ouvrez Figma Desktop App');
      console.error('   2. Vérifiez que le MCP server tourne sur', this.config.mcpServer.url);
      console.error('   3. Depuis Docker: utilisez host.docker.internal au lieu de localhost');
      console.error('\n💡 Tip: Le serveur MCP nécessite Figma Desktop ouvert\n');
      process.exit(1);
    }
  }

  /**
   * Call MCP tool and handle errors
   */
  async callMCPTool(toolName, args) {
    try {
      const result = await this.client.callTool({
        name: toolName,
        arguments: args
      });
      return result;
    } catch (error) {
      console.error(`❌ Erreur lors de l'appel ${toolName}:`, error.message);
      throw error;
    }
  }

  /**
   * Save file to test directory
   */
  saveFile(filename, content) {
    const filePath = path.join(this.testDir, filename);
    fs.mkdirSync(path.dirname(filePath), { recursive: true });
    fs.writeFileSync(filePath, content, 'utf8');
  }

  /**
   * PHASE 0: Preparation
   */
  async phase0_preparation() {
    console.log('┌─────────────────────────────────────────────────────────┐');
    console.log('│  PHASE 0: PRÉPARATION                                   │');
    console.log('└─────────────────────────────────────────────────────────┘\n');

    // Create test directory
    console.log(`📁 Création dossier test: node-${this.nodeIdHyphen}-${this.timestamp}`);
    fs.mkdirSync(this.testDir, { recursive: true });

    // Clean /tmp/figma-assets (empty content, don't remove dir as it's a volume mount)
    console.log('🧹 Nettoyage /tmp/figma-assets...');
    execSync('rm -rf /tmp/figma-assets/* 2>/dev/null || true');
    console.log('   ✅ /tmp/figma-assets nettoyé\n');
  }

  /**
   * PHASE 1: MCP Extraction (chunk mode systématique)
   */
  async phase1_extraction() {
    console.log('┌─────────────────────────────────────────────────────────┐');
    console.log('│  PHASE 1: EXTRACTION MCP (mode chunk systématique)     │');
    console.log('└─────────────────────────────────────────────────────────┘\n');

    // 1. Check/create design system rules
    const rulesPath = path.join(__dirname, '..', this.config.directories.designRules);
    let designRules = null;

    if (fs.existsSync(rulesPath)) {
      console.log('📋 Chargement design system rules (cache)...');
      designRules = JSON.parse(fs.readFileSync(rulesPath, 'utf8'));
    } else {
      console.log('📋 Génération design system rules...');
      try {
        const rulesResult = await this.callMCPTool('create_design_system_rules', {
          fileId: this.fileId,
          clientLanguages: this.config.commonParams.clientLanguages,
          clientFrameworks: this.config.commonParams.clientFrameworks
        });

        designRules = JSON.parse(rulesResult.content[0].text);
        fs.writeFileSync(rulesPath, JSON.stringify(designRules, null, 2), 'utf8');
        console.log('   ✅ Design rules sauvegardées\n');
      } catch (error) {
        console.log('   ⚠️  Design rules non générées (continuera sans):\n', error.message);
      }
    }

    // 2. Get metadata
    console.log('📄 Récupération metadata...');
    const metadataResult = await this.callMCPTool('get_metadata', {
      nodeId: this.nodeId
    });
    this.saveFile('metadata.xml', metadataResult.content[0].text);
    console.log('   ✅ metadata.xml sauvegardé\n');

    // 2b. Get parent wrapper (for chunking mode background/padding preservation)
    console.log('🎨 Récupération wrapper parent...');
    const parentWrapperResult = await this.callMCPTool('get_design_context', {
      nodeId: this.nodeId,
      ...this.config.commonParams,
      forceCode: true,
      ...(designRules && { designSystemRules: JSON.stringify(designRules) })
    });
    this.saveFile('parent-wrapper.tsx', parentWrapperResult.content[0].text);
    console.log('   ✅ parent-wrapper.tsx sauvegardé\n');

    // 3. Extract nodes (mode chunk systématique)
    console.log('📦 Extraction des nodes (mode chunk systématique)...');
    const chunksDir = path.join(this.testDir, 'chunks');
    fs.mkdirSync(chunksDir, { recursive: true });

    const nodesOutput = execSync(
      `node ${path.join(__dirname, 'utils/chunking.js')} extract-nodes ` +
      `${path.join(this.testDir, 'metadata.xml')}`,
      { encoding: 'utf8' }
    );

    const nodesListPath = path.join(chunksDir, 'nodes.json');
    fs.writeFileSync(nodesListPath, nodesOutput, 'utf8');
    let nodes = JSON.parse(nodesOutput);

    // Si aucun enfant, traiter le node racine lui-même
    if (nodes.length === 0) {
      console.log('   ℹ️  Aucun enfant détecté, traitement du node racine');
      nodes = [{ id: this.nodeId, name: 'Component' }];
    }

    console.log(`   📦 ${nodes.length} node(s) à traiter\n`);

    // 4. For each node: get_design_context (séquentiel)
    console.log('⏳ Génération des chunks (séquentiel)...');
    for (let i = 0; i < nodes.length; i++) {
      const node = nodes[i];
      console.log(`   [${i + 1}/${nodes.length}] Processing chunk: ${node.name} (${node.id})`);

      const codeResult = await this.callMCPTool('get_design_context', {
        nodeId: node.id,
        ...this.config.commonParams,
        forceCode: true,
        ...(designRules && { designSystemRules: JSON.stringify(designRules) })
      });

      // Validate that the result contains valid code, not an error message
      const resultText = codeResult.content[0].text;
      const errorPatterns = [
        /rate limit exceeded/i,
        /please try again/i,
        /^error:/i,
        /api error/i,
        /request failed/i,
        /unauthorized/i,
        /forbidden/i,
        /not found/i
      ];

      const containsError = errorPatterns.some(pattern => pattern.test(resultText));
      const looksLikeReactCode = resultText.includes('import') || resultText.includes('export') || resultText.includes('function') || resultText.includes('const');

      if (containsError || (!looksLikeReactCode && resultText.length < 500)) {
        console.error(`\n❌ Le serveur MCP a retourné une erreur au lieu du code:`);
        console.error(`   Chunk: ${node.name}`);
        console.error(`   Réponse: ${resultText.substring(0, 200)}`);
        console.error('\n📋 Actions requises:');
        console.error('   1. Attendez quelques minutes (rate limit Figma API)');
        console.error('   2. Vérifiez votre connexion Figma Desktop');
        console.error('   3. Réessayez la commande\n');
        throw new Error(`MCP server returned error instead of code: ${resultText.substring(0, 100)}`);
      }

      // Save chunk immediately
      this.saveFile(`chunks/${node.name}.tsx`, resultText);

      // Wait 1s to avoid rate limit
      if (i < nodes.length - 1) {
        await new Promise(resolve => setTimeout(resolve, 1000));
      }
    }
    console.log('   ✅ Tous les chunks générés\n');

    // 5. Parallel: get_screenshot + get_variable_defs
    console.log('🖼️  Récupération screenshot + variables (parallèle)...');
    const [screenshotResult, variablesResult] = await Promise.all([
      this.callMCPTool('get_screenshot', { nodeId: this.nodeId }),
      this.callMCPTool('get_variable_defs', { nodeId: this.nodeId })
    ]);

    // Screenshot peut être dans .data (base64) ou .text (binary)
    const screenshotData = screenshotResult.content[0].data || screenshotResult.content[0].text;
    if (screenshotData) {
      const screenshotBuffer = screenshotResult.content[0].data
        ? Buffer.from(screenshotData, 'base64')
        : screenshotData;
      this.saveFile('figma-screenshot.png', screenshotBuffer);
    } else {
      console.log('   ⚠️  Screenshot non disponible');
    }

    this.saveFile('variables.json', variablesResult.content[0].text);
    console.log('   ✅ Variables sauvegardées\n');

    // 6. Wait for images in /tmp/figma-assets
    console.log('⏳ Attente des images MCP...');
    await this.waitForImages();

    // 7. Assemble chunks
    console.log('🔗 Assemblage des chunks...');
    // Find all .tsx files in chunks/ directory (avoids issues with spaces in filenames)
    const allChunkFiles = fs.readdirSync(chunksDir)
      .filter(f => f.endsWith('.tsx'))
      .map(f => path.join(chunksDir, f))
      .map(f => `"${f}"`)  // Quote each file to handle spaces
      .join(' ');

    execSync(
      `node ${path.join(__dirname, 'utils/chunking.js')} assemble-chunks ` +
      `${this.testDir} Component ${allChunkFiles}`
    );
    console.log('   ✅ Component.tsx assemblé\n');
  }

  /**
   * Wait for images to be written by MCP server
   */
  async waitForImages() {
    // Count expected images from Component.tsx
    const componentPath = path.join(this.testDir, 'chunks');
    if (!fs.existsSync(componentPath)) {
      console.log('   ⚠️  Aucun chunk trouvé, skip attente images');
      return;
    }

    const chunks = fs.readdirSync(componentPath).filter(f => f.endsWith('.tsx'));
    let expectedCount = 0;

    for (const chunk of chunks) {
      const content = fs.readFileSync(path.join(componentPath, chunk), 'utf8');
      const matches = content.match(/\/tmp\/figma-assets\/[^"']+\.(png|svg|jpg|jpeg|gif|webp)/g);
      if (matches) {
        expectedCount += new Set(matches).size;
      }
    }

    if (expectedCount === 0) {
      console.log('   ℹ️  Aucune image attendue');
      return;
    }

    console.log(`   ⏳ Attente de ${expectedCount} image(s)...`);

    // Wait max 30s
    for (let i = 1; i <= 30; i++) {
      const tmpFiles = fs.existsSync('/tmp/figma-assets')
        ? fs.readdirSync('/tmp/figma-assets').filter(f => /\.(png|svg|jpg|jpeg|gif|webp)$/i.test(f))
        : [];

      if (tmpFiles.length >= expectedCount) {
        console.log(`   ✅ ${tmpFiles.length} image(s) détectée(s) après ${i}s`);

        // Copy to test directory
        execSync(`cp -r /tmp/figma-assets/* ${this.testDir}/ 2>/dev/null || true`);
        return;
      }

      if (i === 30) {
        console.log(`   ⚠️  Timeout: seulement ${tmpFiles.length}/${expectedCount} images après 30s`);
        execSync(`cp -r /tmp/figma-assets/* ${this.testDir}/ 2>/dev/null || true`);
      }

      await new Promise(resolve => setTimeout(resolve, 1000));
    }
  }

  /**
   * PHASE 2: Post-processing
   */
  async phase2_postProcessing() {
    console.log('┌─────────────────────────────────────────────────────────┐');
    console.log('│  PHASE 2: POST-PROCESSING                               │');
    console.log('└─────────────────────────────────────────────────────────┘\n');

    // 1. Organize images
    console.log('🖼️  Organisation des images...');
    const imageCount = fs.existsSync(this.testDir)
      ? fs.readdirSync(this.testDir).filter(f => /\.(png|svg|jpg|jpeg|gif|webp)$/i.test(f)).length
      : 0;

    if (imageCount > 0) {
      execSync(`node ${path.join(__dirname, 'post-processing/organize-images.js')} ${this.testDir}`);
      console.log(`   ✅ ${imageCount} image(s) organisée(s)\n`);
    } else {
      console.log('   ⚠️  Aucune image trouvée, skip organisation\n');
    }

    // 2. Unified processor (AST + reports)
    console.log('🔧 Transformations AST + génération rapports...');
    execSync(
      `node ${path.join(__dirname, 'unified-processor.js')} ` +
      `${path.join(this.testDir, 'Component.tsx')} ` +
      `${path.join(this.testDir, 'Component-fixed.tsx')} ` +
      `${path.join(this.testDir, 'metadata.xml')} ` +
      `"${this.figmaUrl}"`
    );
    console.log('   ✅ Component-fixed.tsx + rapports générés\n');

    // 3. Fix SVG vars
    const imgDir = path.join(this.testDir, 'img');
    if (fs.existsSync(imgDir)) {
      console.log('🎨 Correction variables CSS dans SVG...');
      execSync(`node ${path.join(__dirname, 'post-processing/fix-svg-vars.js')} ${imgDir}`);
      console.log('   ✅ Variables SVG corrigées\n');
    }
  }

  /**
   * PHASE 3: Capture web render
   */
  async phase3_captureWebRender() {
    console.log('┌─────────────────────────────────────────────────────────┐');
    console.log('│  PHASE 3: CAPTURE WEB RENDER                            │');
    console.log('└─────────────────────────────────────────────────────────┘\n');

    console.log('📸 Capture web-render.png...');
    execSync(
      `node ${path.join(__dirname, 'post-processing/capture-screenshot.js')} ` +
      `${this.testDir} ${this.config.docker.vitePort}`
    );
    console.log('   ✅ web-render.png capturé\n');
  }

  /**
   * Run full workflow
   */
  async run() {
    const startTime = Date.now();

    console.log('\n🚀 FIGMA-ANALYZE - Mode chunk systématique\n');
    console.log(`URL: ${this.figmaUrl}`);
    console.log(`Node: ${this.nodeId}`);
    console.log(`Test: node-${this.nodeIdHyphen}-${this.timestamp}\n`);

    try {
      await this.connectMCP();
      await this.phase0_preparation();
      await this.phase1_extraction();
      await this.phase2_postProcessing();
      await this.phase3_captureWebRender();

      const duration = ((Date.now() - startTime) / 1000).toFixed(1);

      console.log('┌─────────────────────────────────────────────────────────┐');
      console.log('│  ✅ TEST GÉNÉRÉ AVEC SUCCÈS                             │');
      console.log('└─────────────────────────────────────────────────────────┘\n');

      console.log(`📁 Test directory: ${this.testDir}`);
      console.log(`⏱️  Durée: ${duration}s`);
      console.log(`📊 Dashboard: http://localhost:${this.config.docker.vitePort}`);
      console.log(`\nPour validation Claude (optionnel):`);
      console.log(`  ./cli/figma-validate node-${this.nodeIdHyphen}-${this.timestamp}\n`);

    } catch (error) {
      console.error('\n❌ ERREUR lors de la génération:', error.message);
      console.error(error.stack);
      process.exit(1);
    } finally {
      if (this.client) {
        await this.client.close();
      }
    }
  }
}

// CLI entry point
const url = process.argv[2];
if (!url) {
  console.error('Usage: node figma-cli.js <figma-url>');
  console.error('Example: node figma-cli.js "https://www.figma.com/design/abc?node-id=9-2654"');
  process.exit(1);
}

const cli = new FigmaCLI(url);
await cli.run();
