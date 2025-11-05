#!/usr/bin/env node

import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StreamableHTTPClientTransport } from '@modelcontextprotocol/sdk/client/streamableHttp.js';
import fs from 'fs';
import path from 'path';
import { execSync } from 'child_process';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// ANSI Color codes for better logs
const colors = {
  reset: '\x1b[0m',
  bright: '\x1b[1m',
  dim: '\x1b[2m',

  // Colors
  cyan: '\x1b[36m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  magenta: '\x1b[35m',
  red: '\x1b[31m',
  gray: '\x1b[90m',

  // Background
  bgCyan: '\x1b[46m',
  bgGreen: '\x1b[42m',
  bgYellow: '\x1b[43m',
};

// Logging helpers
const log = {
  phase: (title) => {
    console.log(`\n${colors.bright}${colors.bgCyan}${colors.reset}`);
    console.log(`${colors.bright}${colors.cyan}┌${'─'.repeat(60)}┐${colors.reset}`);
    console.log(`${colors.bright}${colors.cyan}│  ${title.padEnd(58)}│${colors.reset}`);
    console.log(`${colors.bright}${colors.cyan}└${'─'.repeat(60)}┘${colors.reset}\n`);
  },

  task: (emoji, text) => {
    console.log(`${colors.bright}${emoji}  ${colors.blue}${text}${colors.reset}`);
  },

  success: (text) => {
    console.log(`   ${colors.green}✓${colors.reset} ${colors.dim}${text}${colors.reset}`);
  },

  warning: (text) => {
    console.log(`   ${colors.yellow}⚠${colors.reset} ${colors.dim}${text}${colors.reset}`);
  },

  info: (text) => {
    console.log(`   ${colors.cyan}ℹ${colors.reset} ${colors.dim}${text}${colors.reset}`);
  },

  progress: (current, total, item) => {
    const percent = Math.round((current / total) * 100);
    const bar = '█'.repeat(Math.floor(percent / 5)) + '░'.repeat(20 - Math.floor(percent / 5));
    console.log(`   ${colors.cyan}[${current}/${total}]${colors.reset} ${colors.gray}${bar}${colors.reset} ${colors.dim}${item}${colors.reset}`);
  },

  error: (text) => {
    console.log(`\n${colors.red}✗ ${text}${colors.reset}`);
  },

  header: (text) => {
    console.log(`\n${colors.bright}${colors.magenta}🚀 ${text}${colors.reset}\n`);
  },

  divider: () => {
    console.log(`${colors.gray}${'─'.repeat(60)}${colors.reset}`);
  }
};

class FigmaCLI {
  constructor(url) {
    // Load config
    this.config = JSON.parse(
      fs.readFileSync(path.join(__dirname, '../cli/config/figma-params.json'), 'utf8')
    );

    // Determine project root (works from both Docker and host)
    const projectRoot = process.env.PROJECT_ROOT || path.join(__dirname, '..');

    // Always use project tmp directory (not system /tmp)
    this.assetsDir = path.join(projectRoot, 'tmp', 'figma-assets');
    this.config.commonParams.dirForAssetWrites = this.assetsDir;

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
      log.error(`Error parsing Figma URL: ${error.message}`);
      console.log(`   ${colors.dim}Expected format: https://www.figma.com/design/FILE_ID?node-id=X-Y${colors.reset}`);
      process.exit(1);
    }
  }

  /**
   * Connect to MCP server via StreamableHTTP
   */
  async connectMCP() {
    log.task('🔌', 'Connexion au MCP server');

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
      log.success('Connecté au MCP server');
      log.info(`${toolsResult.tools.length} tools disponibles`);

      // Health check: verify the server can respond to a simple call
      log.task('🏥', 'Test de santé du serveur');
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

        log.success('Serveur MCP opérationnel\n');
      } catch (healthError) {
        log.error('Le serveur MCP ne répond pas correctement');
        console.log(`   ${colors.dim}Erreur: ${healthError.message.substring(0, 200)}${colors.reset}`);
        console.log(`\n${colors.yellow}📋 Actions requises:${colors.reset}`);
        console.log(`   ${colors.dim}1. Ouvrez Figma Desktop App${colors.reset}`);
        console.log(`   ${colors.dim}2. Assurez-vous d'être connecté à votre compte Figma${colors.reset}`);
        console.log(`   ${colors.dim}3. Vérifiez que le MCP server tourne sur${colors.reset} ${colors.cyan}${this.config.mcpServer.url}${colors.reset}`);
        console.log(`   ${colors.dim}4. Si "rate limit", attendez quelques minutes avant de réessayer${colors.reset}`);
        console.log(`\n${colors.cyan}💡 Tip:${colors.reset} ${colors.dim}Le serveur MCP nécessite Figma Desktop ouvert et connecté${colors.reset}\n`);
        process.exit(1);
      }
    } catch (error) {
      log.error(`Erreur connexion MCP: ${error.message}`);
      console.log(`\n${colors.yellow}📋 Actions requises:${colors.reset}`);
      console.log(`   ${colors.dim}1. Ouvrez Figma Desktop App${colors.reset}`);
      console.log(`   ${colors.dim}2. Vérifiez que le MCP server tourne sur${colors.reset} ${colors.cyan}${this.config.mcpServer.url}${colors.reset}`);
      console.log(`   ${colors.dim}3. Depuis Docker: utilisez host.docker.internal au lieu de localhost${colors.reset}`);
      console.log(`\n${colors.cyan}💡 Tip:${colors.reset} ${colors.dim}Le serveur MCP nécessite Figma Desktop ouvert${colors.reset}\n`);
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
      log.error(`Erreur lors de l'appel ${toolName}: ${error.message}`);
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
   * Parse metadata.xml to extract node dimensions
   * Returns { width, height } or null if not found
   */
  parseNodeDimensions() {
    const metadataPath = path.join(this.testDir, 'metadata.xml');

    if (!fs.existsSync(metadataPath)) {
      log.warning('metadata.xml not found, cannot extract dimensions');
      return null;
    }

    try {
      const metadata = fs.readFileSync(metadataPath, 'utf8');

      // Parse root node attributes (first tag)
      // Example: <frame id="168:14226" name="Home" width="1426" height="734">
      const match = metadata.match(/width="(\d+(?:\.\d+)?)"\s+height="(\d+(?:\.\d+)?)"/);

      if (match) {
        return {
          width: Math.round(parseFloat(match[1])),
          height: Math.round(parseFloat(match[2]))
        };
      }

      log.warning('Could not parse dimensions from metadata.xml');
      return null;
    } catch (error) {
      log.warning(`Error parsing metadata.xml: ${error.message}`);
      return null;
    }
  }

  /**
   * PHASE 0: Preparation
   */
  async phase0_preparation() {
    log.phase('PHASE 0: PRÉPARATION');

    // Create test directory
    log.task('📁', `Création dossier test: node-${this.nodeIdHyphen}-${this.timestamp}`);
    fs.mkdirSync(this.testDir, { recursive: true });
    log.success('Dossier créé');

    // Ensure assets directory exists with proper permissions
    log.task('🧹', `Nettoyage ${this.assetsDir}`);
    if (!fs.existsSync(this.assetsDir)) {
      fs.mkdirSync(this.assetsDir, { recursive: true, mode: 0o755 });
    }
    execSync(`rm -rf ${this.assetsDir}/* 2>/dev/null || true`);
    log.success('Assets directory nettoyé\n');
  }

  /**
   * PHASE 1: MCP Extraction (chunk mode systématique)
   */
  async phase1_extraction() {
    log.phase('PHASE 1: EXTRACTION MCP (mode chunk systématique)');

    // 1. Get metadata
    log.task('📄', 'Récupération metadata');
    const metadataResult = await this.callMCPTool('get_metadata', {
      nodeId: this.nodeId
    });
    this.saveFile('metadata.xml', metadataResult.content[0].text);
    log.success('metadata.xml sauvegardé\n');

    // 2. Get parent wrapper + screenshot + variables (parallel)
    log.task('🎨', 'Récupération wrapper parent + screenshot + variables (parallèle)');
    const [parentWrapperResult, screenshotResult, variablesResult] = await Promise.all([
      this.callMCPTool('get_design_context', {
        nodeId: this.nodeId,
        ...this.config.commonParams,
        forceCode: true
      }),
      this.callMCPTool('get_screenshot', { nodeId: this.nodeId }),
      this.callMCPTool('get_variable_defs', { nodeId: this.nodeId })
    ]);

    // Save parent wrapper
    this.saveFile('parent-wrapper.tsx', parentWrapperResult.content[0].text);

    // Save screenshot (handle base64/binary)
    const screenshotData = screenshotResult.content[0].data || screenshotResult.content[0].text;
    if (screenshotData) {
      const screenshotBuffer = screenshotResult.content[0].data
        ? Buffer.from(screenshotData, 'base64')
        : screenshotData;
      this.saveFile('figma-screenshot.png', screenshotBuffer);
    } else {
      log.warning('Screenshot non disponible');
    }

    // Save variables
    this.saveFile('variables.json', variablesResult.content[0].text);
    log.success('Parent wrapper + screenshot + variables sauvegardés\n');

    // 3. Extract nodes (mode chunk systématique)
    log.task('📦', 'Extraction des nodes (mode chunk systématique)');
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
      log.info('Aucun enfant détecté, traitement du node racine');
      nodes = [{ id: this.nodeId, name: 'Component' }];
    }

    log.info(`${nodes.length} node(s) à traiter\n`);

    // 4. For each node: get_design_context (séquentiel)
    log.task('⏳', 'Génération des chunks (séquentiel)');
    for (let i = 0; i < nodes.length; i++) {
      const node = nodes[i];
      log.progress(i + 1, nodes.length, `${node.name} (${node.id})`);

      const codeResult = await this.callMCPTool('get_design_context', {
        nodeId: node.id,
        ...this.config.commonParams,
        forceCode: true
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
        log.error('Le serveur MCP a retourné une erreur au lieu du code');
        console.log(`   ${colors.dim}Chunk: ${node.name}${colors.reset}`);
        console.log(`   ${colors.dim}Réponse: ${resultText.substring(0, 200)}${colors.reset}`);
        console.log(`\n${colors.yellow}📋 Actions requises:${colors.reset}`);
        console.log(`   ${colors.dim}1. Attendez quelques minutes (rate limit Figma API)${colors.reset}`);
        console.log(`   ${colors.dim}2. Vérifiez votre connexion Figma Desktop${colors.reset}`);
        console.log(`   ${colors.dim}3. Réessayez la commande${colors.reset}\n`);
        throw new Error(`MCP server returned error instead of code: ${resultText.substring(0, 100)}`);
      }

      // Save chunk immediately
      this.saveFile(`chunks/${node.name}.tsx`, resultText);

      // Wait 1s to avoid rate limit
      if (i < nodes.length - 1) {
        await new Promise(resolve => setTimeout(resolve, 1000));
      }
    }
    log.success('Tous les chunks générés\n');

    // 5. Wait for images in assets directory
    log.task('⏳', 'Attente des images MCP');
    await this.waitForImages();

    // 6. Assemble chunks
    log.task('🔗', 'Assemblage des chunks');
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
    log.success('Component.tsx assemblé\n');
  }

  /**
   * Wait for images to be written by MCP server
   */
  async waitForImages() {
    // Count expected images from Component.tsx
    const componentPath = path.join(this.testDir, 'chunks');
    if (!fs.existsSync(componentPath)) {
      log.warning('Aucun chunk trouvé, skip attente images');
      return;
    }

    const chunks = fs.readdirSync(componentPath).filter(f => f.endsWith('.tsx'));
    const allImagePaths = new Set();

    for (const chunk of chunks) {
      const content = fs.readFileSync(path.join(componentPath, chunk), 'utf8');
      // Match both absolute paths and hash filenames
      const matches = content.match(/[^"']*[/\\][a-f0-9]{40}\.(png|svg|jpg|jpeg|gif|webp)|[^"']+\.(png|svg|jpg|jpeg|gif|webp)/gi);
      if (matches) {
        matches.forEach(match => allImagePaths.add(match));
      }
    }

    const expectedCount = allImagePaths.size;

    if (expectedCount === 0) {
      log.info('Aucune image attendue');
      return;
    }

    log.info(`Attente de ${expectedCount} image(s) unique(s)...`);

    // Wait max 30s
    for (let i = 1; i <= 30; i++) {
      let tmpFiles = [];
      try {
        if (fs.existsSync(this.assetsDir)) {
          tmpFiles = fs.readdirSync(this.assetsDir).filter(f => /\.(png|svg|jpg|jpeg|gif|webp)$/i.test(f));
        }
      } catch (error) {
        log.warning(`Cannot read ${this.assetsDir}: ${error.message}`);
        tmpFiles = [];
      }

      if (tmpFiles.length >= expectedCount) {
        log.success(`${tmpFiles.length} image(s) détectée(s) après ${i}s`);

        // Copy to test directory
        execSync(`cp -r "${this.assetsDir}"/* "${this.testDir}"/ 2>/dev/null || true`);
        return;
      }

      if (i === 30) {
        log.warning(`Timeout: seulement ${tmpFiles.length}/${expectedCount} images après 30s`);
        execSync(`cp -r "${this.assetsDir}"/* "${this.testDir}"/ 2>/dev/null || true`);
      }

      await new Promise(resolve => setTimeout(resolve, 1000));
    }
  }

  /**
   * PHASE 2: Post-processing
   */
  async phase2_postProcessing() {
    log.phase('PHASE 2: POST-PROCESSING');

    // 1. Organize images
    log.task('🖼️', 'Organisation des images');
    const imageCount = fs.existsSync(this.testDir)
      ? fs.readdirSync(this.testDir).filter(f => /\.(png|svg|jpg|jpeg|gif|webp)$/i.test(f)).length
      : 0;

    if (imageCount > 0) {
      execSync(`node ${path.join(__dirname, 'post-processing/organize-images.js')} ${this.testDir}`);
      log.success(`${imageCount} image(s) organisée(s)\n`);
    } else {
      log.warning('Aucune image trouvée, skip organisation\n');
    }

    // 2. Unified processor (AST + reports)
    log.task('🔧', 'Transformations AST + génération rapports');
    execSync(
      `node ${path.join(__dirname, 'unified-processor.js')} ` +
      `${path.join(this.testDir, 'Component.tsx')} ` +
      `${path.join(this.testDir, 'Component-fixed.tsx')} ` +
      `${path.join(this.testDir, 'metadata.xml')} ` +
      `"${this.figmaUrl}"`
    );
    log.success('Component-fixed.tsx + rapports générés\n');

    // 3. Fix SVG vars
    const imgDir = path.join(this.testDir, 'img');
    if (fs.existsSync(imgDir)) {
      log.task('🎨', 'Correction variables CSS dans SVG');
      execSync(`node ${path.join(__dirname, 'post-processing/fix-svg-vars.js')} ${imgDir}`);
      log.success('Variables SVG corrigées\n');
    }
  }

  /**
   * PHASE 3: Capture web render
   */
  async phase3_captureWebRender() {
    log.phase('PHASE 3: CAPTURE WEB RENDER');

    log.task('📸', 'Capture web-render.png');

    // Extract dimensions from metadata.xml to match Figma screenshot size
    const dimensions = this.parseNodeDimensions();

    let command = `node ${path.join(__dirname, 'post-processing/capture-screenshot.js')} ${this.testDir} ${this.config.docker.vitePort}`;

    if (dimensions) {
      log.info(`Using Figma node dimensions: ${dimensions.width}x${dimensions.height}`);
      command += ` ${dimensions.width} ${dimensions.height}`;
    } else {
      log.info('Auto-detecting dimensions from web render');
    }

    execSync(command);
    log.success('web-render.png capturé\n');
  }

  /**
   * Run full workflow
   */
  async run() {
    const startTime = Date.now();

    log.header('FIGMA-ANALYZE - Mode chunk systématique');
    log.divider();
    console.log(`${colors.dim}URL:${colors.reset}  ${this.figmaUrl}`);
    console.log(`${colors.dim}Node:${colors.reset} ${this.nodeId}`);
    console.log(`${colors.dim}Test:${colors.reset} node-${this.nodeIdHyphen}-${this.timestamp}`);
    log.divider();

    try {
      await this.connectMCP();
      await this.phase0_preparation();
      await this.phase1_extraction();
      await this.phase2_postProcessing();
      await this.phase3_captureWebRender();

      const duration = ((Date.now() - startTime) / 1000).toFixed(1);

      console.log(`\n${colors.bright}${colors.bgGreen} ${colors.reset}`);
      console.log(`${colors.bright}${colors.green}┌${'─'.repeat(60)}┐${colors.reset}`);
      console.log(`${colors.bright}${colors.green}│  ✅ TEST GÉNÉRÉ AVEC SUCCÈS${' '.repeat(30)}│${colors.reset}`);
      console.log(`${colors.bright}${colors.green}└${'─'.repeat(60)}┘${colors.reset}\n`);

      console.log(`${colors.cyan}📁${colors.reset} ${colors.dim}Test directory:${colors.reset} ${this.testDir}`);
      console.log(`${colors.cyan}⏱️${colors.reset}  ${colors.dim}Durée:${colors.reset} ${colors.bright}${duration}s${colors.reset}`);
      console.log(`${colors.cyan}📊${colors.reset} ${colors.dim}Dashboard:${colors.reset} ${colors.blue}http://localhost:${this.config.docker.vitePort}${colors.reset}`);
      console.log(`\n${colors.dim}Pour validation Claude (optionnel):${colors.reset}`);
      console.log(`  ${colors.gray}./cli/figma-validate node-${this.nodeIdHyphen}-${this.timestamp}${colors.reset}\n`);

    } catch (error) {
      log.error(`ERREUR lors de la génération: ${error.message}`);
      console.log(`${colors.dim}${error.stack}${colors.reset}`);
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
  log.error('Usage: node figma-cli.js <figma-url>');
  console.log(`${colors.dim}Example: node figma-cli.js "https://www.figma.com/design/abc?node-id=9-2654"${colors.reset}`);
  process.exit(1);
}

const cli = new FigmaCLI(url);
await cli.run();
