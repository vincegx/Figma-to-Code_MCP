#!/usr/bin/env node

import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StreamableHTTPClientTransport } from '@modelcontextprotocol/sdk/client/streamableHttp.js';
import fs from 'fs';
import path from 'path';
import { execSync } from 'child_process';
import { fileURLToPath } from 'url';
import { UsageTracker } from './utils/usage-tracker.js';
import { loadSettings, getMcpParams, getDirectories, getGenerationSettings } from './utils/settings-loader.js';

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
  constructor(url, cleanMode = false) {
    // Load settings
    this.settings = loadSettings();
    const mcpParams = getMcpParams();
    const directories = getDirectories();
    const generationSettings = getGenerationSettings();

    // Legacy config structure (for backward compatibility)
    this.config = {
      mcpServer: {
        url: this.settings.mcp.serverUrl,
        transport: 'sse'
      },
      commonParams: {
        clientLanguages: mcpParams.clientLanguages,
        clientFrameworks: mcpParams.clientFrameworks,
        dirForAssetWrites: '' // Will be set below
      },
      directories: {
        tmpAssets: directories.tmpAssets,
        testsOutput: directories.testsOutput
      },
      docker: {
        containerName: this.settings.docker.containerName,
        vitePort: 5173
      }
    };

    // Store clean mode flag (use settings default if not specified)
    if (cleanMode === false && generationSettings.defaultMode !== 'fixed') {
      this.cleanMode = generationSettings.defaultMode === 'both' || generationSettings.defaultMode === 'clean';
    } else {
      this.cleanMode = cleanMode;
    }

    // Determine project root (works from both Docker and host)
    // MCP Figma Desktop runs on HOST, so we need the HOST path for dirForAssetWrites
    const isDocker = process.env.PROJECT_ROOT || fs.existsSync('/.dockerenv');

    if (isDocker && process.env.PROJECT_ROOT) {
      // Docker mode: we need BOTH paths
      // - HOST path for MCP to write assets
      // - Docker path for us to read/copy assets
      this.assetsDirHost = path.join(process.env.PROJECT_ROOT, 'tmp', 'figma-assets');  // For MCP
      this.assetsDir = '/app/tmp/figma-assets';  // For Docker to read
    } else {
      // Running on host directly - same path for both
      const projectRoot = path.join(__dirname, '..');
      this.assetsDir = path.join(projectRoot, 'tmp', 'figma-assets');
      this.assetsDirHost = this.assetsDir;
    }

    this.config.commonParams.dirForAssetWrites = this.assetsDirHost;

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
    this.usageTracker = new UsageTracker();
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

      // Track successful call (only if no rate limit error in response)
      if (this.validateMCPResult(result)) {
        const tokensUsed = this.estimateTokensFromResult(result);
        this.usageTracker.track(toolName, tokensUsed);
      }

      return result;
    } catch (error) {
      log.error(`Erreur lors de l'appel ${toolName}: ${error.message}`);
      throw error;
    }
  }

  /**
   * Estimate tokens consumed by an MCP result
   * Based on actual content size (TSX, XML, JSON, screenshot)
   * @param {Object} result - MCP tool result
   * @returns {number} - Estimated tokens used
   */
  estimateTokensFromResult(result) {
    if (!result.content || result.content.length === 0) return 0;

    const item = result.content[0];

    // Text content (TSX, XML, JSON) - ~4 chars per token
    if (item.text) {
      return Math.round(item.text.length / 4);
    }

    // Binary content (screenshot base64) - ~6 chars per token (base64 overhead)
    if (item.data) {
      return Math.round(item.data.length / 6);
    }

    return 0;
  }

  /**
   * Validate MCP result doesn't contain error patterns
   * @param {Object} result - MCP tool result
   * @returns {boolean} - True if successful, false if error detected
   */
  validateMCPResult(result) {
    const resultText = JSON.stringify(result);
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
    return !errorPatterns.some(pattern => pattern.test(resultText));
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
   * Check if code looks like valid React component
   * @param {string} code - Code to validate
   * @param {boolean} isChunk - If true, use more flexible validation for chunks
   * @returns {object} { valid: boolean, reason: string }
   */
  isValidReactCode(code, isChunk = false) {
    // Check for error patterns first
    const errorPatterns = [
      { pattern: /rate limit exceeded/i, message: 'Rate limit exceeded' },
      { pattern: /please try again/i, message: 'API requested retry' },
      { pattern: /^error:/i, message: 'Error message detected' },
      { pattern: /api error/i, message: 'API error' },
      { pattern: /request failed/i, message: 'Request failed' },
      { pattern: /unauthorized/i, message: 'Unauthorized' },
      { pattern: /forbidden/i, message: 'Forbidden' },
      { pattern: /not found/i, message: 'Not found' },
      { pattern: /node is empty/i, message: 'Empty node' },
      { pattern: /no code available/i, message: 'No code available' },
      { pattern: /cannot generate/i, message: 'Code generation failed' }
    ];

    for (const { pattern, message } of errorPatterns) {
      if (pattern.test(code)) {
        return { valid: false, reason: message };
      }
    }

    // Valid React code should have:
    // - export (function or default)
    // - JSX syntax or function/const
    // - reasonable length
    const hasExport = code.includes('export');
    const hasReactSyntax = code.includes('function') || code.includes('const') || code.includes('return');
    const hasJSX = code.includes('<') && code.includes('>');

    // More flexible minimum length for chunks (some chunks can be small)
    const minLength = isChunk ? 100 : 500;
    const hasMinLength = code.length > minLength;

    // Check each requirement and provide specific feedback
    if (!hasExport) {
      return { valid: false, reason: 'Missing export statement' };
    }
    if (!hasReactSyntax) {
      return { valid: false, reason: 'Missing React syntax (function/const/return)' };
    }
    if (!hasJSX) {
      return { valid: false, reason: 'Missing JSX syntax' };
    }
    if (!hasMinLength) {
      return { valid: false, reason: `Code too short (${code.length} chars, need ${minLength}+)` };
    }

    return { valid: true, reason: 'OK' };
  }

  /**
   * Extract child nodes from metadata XML (already saved)
   */
  extractChildNodes() {
    const chunksDir = path.join(this.testDir, 'chunks');
    fs.mkdirSync(chunksDir, { recursive: true });

    const nodesOutput = execSync(
      `node ${path.join(__dirname, 'utils/chunking.js')} extract-nodes ${path.join(this.testDir, 'metadata.xml')}`,
      { encoding: 'utf8' }
    );

    let nodes = JSON.parse(nodesOutput);

    if (nodes.length === 0) {
      nodes = [{ id: this.nodeId, name: 'Component' }];
    }

    return nodes;
  }

  /**
   * Generate chunks for all child nodes
   */
  async generateChunks(nodes) {
    log.task('⏳', 'Génération des chunks (séquentiel)');

    for (let i = 0; i < nodes.length; i++) {
      const node = nodes[i];
      log.progress(i + 1, nodes.length, `${node.name} (${node.id})`);

      const codeResult = await this.callMCPTool('get_design_context', {
        nodeId: node.id,
        dirForAssetWrites: '',  // Images already retrieved
        forceCode: true,
        clientLanguages: this.config.commonParams.clientLanguages,
        clientFrameworks: this.config.commonParams.clientFrameworks
      });

      const code = codeResult.content[0].text;

      // Validate code (use flexible validation for chunks)
      const validation = this.isValidReactCode(code, true);
      if (!validation.valid) {
        log.error(`Code invalide pour chunk "${node.name}": ${validation.reason}`);
        log.info(`Longueur du code: ${code.length} caractères`);

        // Save invalid code for debugging
        const debugPath = `chunks/${node.name}.invalid.tsx`;
        this.saveFile(debugPath, code);
        log.info(`Code invalide sauvegardé dans ${debugPath}`);

        // Show first 500 chars for quick analysis
        const preview = code.substring(0, 500);
        log.info(`Aperçu du code:\n${preview}...`);

        // Check if this is a "node not found" error - provide helpful guidance
        const isNodeNotFound = /no node could be found/i.test(code);
        if (isNodeNotFound) {
          log.error('\n❌ NODE INTROUVABLE DANS FIGMA');
          log.info('   → Ouvrez Figma Desktop');
          log.info('   → Assurez-vous que le document contenant ce node est l\'onglet ACTIF');
          log.info(`   → Node ID recherché: ${node.id}`);
          throw new Error(`Node ${node.id} not found in Figma Desktop. Make sure the correct document is open and active.`);
        }

        throw new Error(`Invalid chunk code for ${node.name}: ${validation.reason}`);
      }

      this.saveFile(`chunks/${node.name}.tsx`, code);

      if (i < nodes.length - 1) {
        await new Promise(resolve => setTimeout(resolve, this.settings.mcp.callDelay));
      }
    }

    log.success('Tous les chunks générés\n');
  }

  /**
   * Assemble all chunks into Component.tsx
   */
  assembleChunks() {
    const chunksDir = path.join(this.testDir, 'chunks');
    const chunkFiles = fs.readdirSync(chunksDir)
      .filter(f => f.endsWith('.tsx'))
      .map(f => path.join(chunksDir, f))
      .map(f => `"${f}"`)
      .join(' ');

    execSync(
      `node ${path.join(__dirname, 'utils/chunking.js')} assemble-chunks ${this.testDir} Component ${chunkFiles}`
    );
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
   * PHASE 1: MCP Extraction (Try Simple First)
   */
  async phase1_extraction() {
    log.phase('PHASE 1: EXTRACTION MCP (Try Simple First)');

    // 1. Call 4 MCP tools in parallel
    log.task('🎨', '4 appels MCP en parallèle');
    const [codeResult, screenshotResult, variablesResult, metadataResult] = await Promise.all([
      this.callMCPTool('get_design_context', {
        nodeId: this.nodeId,
        dirForAssetWrites: this.assetsDirHost,  // HOST path for MCP to write
        forceCode: true,
        clientLanguages: this.config.commonParams.clientLanguages,
        clientFrameworks: this.config.commonParams.clientFrameworks
      }),
      this.callMCPTool('get_screenshot', { nodeId: this.nodeId }),
      this.callMCPTool('get_variable_defs', { nodeId: this.nodeId }),
      this.callMCPTool('get_metadata', { nodeId: this.nodeId })
    ]);

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

    // Save variables and metadata
    this.saveFile('variables.json', variablesResult.content[0].text);
    this.saveFile('metadata.xml', metadataResult.content[0].text);
    log.success('4 appels MCP terminés\n');

    // 2. Check if code is valid and not too large
    const code = codeResult.content[0].text;
    const validation = this.isValidReactCode(code);
    const isTooLarge = code.length > 100000;

    if (validation.valid && !isTooLarge) {
      // SIMPLE MODE (4 calls total)
      log.success('✅ MODE SIMPLE: Code valide et taille OK');
      this.saveFile('Component.tsx', code);

      // Wait for images to be written asynchronously
      log.task('⏳', 'Attente des images MCP');
      log.info('Délai de grâce de 5s pour l\'écriture asynchrone des images...');
      await new Promise(resolve => setTimeout(resolve, 5000));
      await this.waitForImages();

      log.success('Phase 1 terminée en MODE SIMPLE (4 appels)\n');
      return;
    }

    // CHUNK MODE (5+N calls)
    log.warning('⚠️  MODE CHUNKING: Code invalide ou trop volumineux');
    log.info(`   Code valide: ${validation.valid}`);
    if (!validation.valid) {
      log.info(`   Raison: ${validation.reason}`);
    }
    log.info(`   Taille: ${(code.length / 1000).toFixed(1)}k caractères\n`);

    // 3. Extract child nodes
    const nodes = this.extractChildNodes();
    log.info(`${nodes.length} node(s) à traiter\n`);

    // 4. Get parent wrapper for CSS classes
    log.task('📦', 'Récupération parent wrapper');
    const parentWrapperResult = await this.callMCPTool('get_design_context', {
      nodeId: this.nodeId,
      dirForAssetWrites: '',  // Images already retrieved
      forceCode: true,
      clientLanguages: this.config.commonParams.clientLanguages,
      clientFrameworks: this.config.commonParams.clientFrameworks
    });
    this.saveFile('parent-wrapper.tsx', parentWrapperResult.content[0].text);
    log.success('Parent wrapper sauvegardé\n');

    // 5. Generate chunks sequentially
    await this.generateChunks(nodes);

    // 6. Assemble chunks
    log.task('🔗', 'Assemblage des chunks');
    this.assembleChunks();
    log.success('Component.tsx assemblé\n');

    // 7. Wait for images (already should be there from first call)
    log.task('⏳', 'Vérification des images');
    await this.waitForImages();

    log.success(`Phase 1 terminée en MODE CHUNKING (${5 + nodes.length} appels)\n`);
  }

  /**
   * Wait for images to be written by MCP server
   */
  async waitForImages() {
    // Check if assets directory has images
    if (!fs.existsSync(this.assetsDir)) {
      log.info('Aucun assets directory, skip copie images');
      return;
    }

    const assetsFiles = fs.readdirSync(this.assetsDir).filter(f => /\.(png|svg|jpg|jpeg|gif|webp)$/i.test(f));

    if (assetsFiles.length === 0) {
      log.info('Aucune image à copier depuis assets');
      return;
    }

    // Copy images from assets to test directory
    log.info(`Copie de ${assetsFiles.length} image(s) depuis ${path.basename(this.assetsDir)}...`);
    try {
      execSync(`cp -r "${this.assetsDir}"/* "${this.testDir}"/`);
      const copiedFiles = fs.readdirSync(this.testDir).filter(f => /\.(png|svg|jpg|jpeg|gif|webp)$/i.test(f));
      log.success(`✅ ${copiedFiles.length} image(s) copiée(s)\n`);
    } catch (error) {
      log.error(`Erreur lors de la copie des images: ${error.message}`);
      throw error;
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
      log.info('Aucune image à organiser\n');
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

    // 2b. Generate clean version if --clean flag is set
    if (this.cleanMode) {
      log.task('✨', 'Génération version production (clean)');
      execSync(
        `node ${path.join(__dirname, 'unified-processor.js')} ` +
        `${path.join(this.testDir, 'Component.tsx')} ` +
        `${path.join(this.testDir, 'Component-clean.tsx')} ` +
        `${path.join(this.testDir, 'metadata.xml')} ` +
        `"${this.figmaUrl}" ` +
        `--clean`
      );
      log.success('Component-clean.tsx + Component-clean.css générés\n');
    }

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

    log.header('FIGMA-ANALYZE - Try Simple First');
    log.divider();
    console.log(`${colors.dim}URL:${colors.reset}  ${this.figmaUrl}`);
    console.log(`${colors.dim}Node:${colors.reset} ${this.nodeId}`);
    console.log(`${colors.dim}Test:${colors.reset} node-${this.nodeIdHyphen}-${this.timestamp}`);
    log.divider();

    try {
      await this.connectMCP();
      await this.phase0_preparation();

      // Track this analysis
      this.usageTracker.trackAnalysis();

      await this.phase1_extraction();
      await this.phase2_postProcessing();
      await this.phase3_captureWebRender();

      const duration = ((Date.now() - startTime) / 1000).toFixed(1);

      console.log(`\n${colors.bright}${colors.bgGreen} ${colors.reset}`);
      console.log(`${colors.bright}${colors.green}┌${'─'.repeat(60)}┐${colors.reset}`);
      console.log(`${colors.bright}${colors.green}│  ✅ TEST GÉNÉRÉ AVEC SUCCÈS${' '.repeat(30)}│${colors.reset}`);
      console.log(`${colors.bright}${colors.green}└${'─'.repeat(60)}┘${colors.reset}\n`);

      const testId = `node-${this.nodeIdHyphen}-${this.timestamp}`;
      console.log(`${colors.cyan}📁${colors.reset} ${colors.dim}Test directory:${colors.reset} ${this.testDir}`);
      console.log(`${colors.cyan}⏱️${colors.reset}  ${colors.dim}Durée:${colors.reset} ${colors.bright}${duration}s${colors.reset}`);
      console.log(`${colors.cyan}📊${colors.reset} ${colors.dim}Dashboard:${colors.reset} ${colors.blue}http://localhost:${this.config.docker.vitePort}${colors.reset}`);
      console.log(`\n${colors.dim}Pour validation Claude (optionnel):${colors.reset}`);
      console.log(`  ${colors.gray}./cli/figma-validate ${testId}${colors.reset}\n`);

      // Output testId for server parsing (machine-readable format)
      console.log(`TEST_ID: ${testId}`);

    } catch (error) {
      log.error(`ERREUR lors de la génération: ${error.message}`);
      console.log(`${colors.dim}${error.stack}${colors.reset}`);

      // Cleanup: remove incomplete test directory to avoid pollution
      if (fs.existsSync(this.testDir)) {
        log.task('🧹', 'Nettoyage du dossier de test incomplet');
        try {
          fs.rmSync(this.testDir, { recursive: true, force: true });
          log.success(`Dossier supprimé: ${path.basename(this.testDir)}`);
        } catch (cleanupError) {
          log.warning(`Impossible de supprimer le dossier: ${cleanupError.message}`);
        }
      }

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
const cleanMode = process.argv[3] === '--clean';

if (!url) {
  log.error('Usage: node figma-cli.js <figma-url> [--clean]');
  console.log(`${colors.dim}Example: node figma-cli.js "https://www.figma.com/design/abc?node-id=9-2654"${colors.reset}`);
  console.log(`${colors.dim}         node figma-cli.js "https://www.figma.com/design/abc?node-id=9-2654" --clean${colors.reset}`);
  process.exit(1);
}

const cli = new FigmaCLI(url, cleanMode);
await cli.run();
