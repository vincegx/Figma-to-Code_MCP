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

    // Track if MCP extraction succeeded (to avoid deleting files on post-processing errors)
    this.mcpSucceeded = false;

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

    // Initialize timestamp early (needed for unique assets directory)
    this.timestamp = Math.floor(Date.now() / 1000);

    // Determine project root (works from both Docker and host)
    // MCP Figma Desktop runs on HOST, so we need the HOST path for dirForAssetWrites
    const isDocker = process.env.PROJECT_ROOT || fs.existsSync('/.dockerenv');

    if (isDocker && process.env.PROJECT_ROOT) {
      // Docker mode: we need BOTH paths
      // - HOST path for MCP to write assets
      // - Docker path for us to read/copy assets
      // Use unique directory per export to avoid conflicts
      this.assetsDirHost = path.join(process.env.PROJECT_ROOT, 'tmp', `figma-assets-${this.timestamp}`);  // For MCP
      this.assetsDir = `/app/tmp/figma-assets-${this.timestamp}`;  // For Docker to read
    } else {
      // Running on host directly - same path for both
      // Use unique directory per export to avoid conflicts
      const projectRoot = path.join(__dirname, '..');
      this.assetsDir = path.join(projectRoot, 'tmp', `figma-assets-${this.timestamp}`);
      this.assetsDirHost = this.assetsDir;
    }

    this.config.commonParams.dirForAssetWrites = this.assetsDirHost;

    // Parse Figma URL
    const parsed = this.parseUrl(url);
    this.fileId = parsed.fileId;
    this.nodeId = parsed.nodeId;
    this.nodeIdHyphen = parsed.nodeIdHyphen;
    this.figmaUrl = url;

    // Create test directory (timestamp already initialized above)
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
   * Check if validation error is a fatal API error (rate limit, auth, etc.)
   * Throws immediately to prevent wasting more API calls
   * @param {object} validation - Result from isValidReactCode
   * @param {string} code - The code that failed validation
   */
  checkForFatalAPIError(validation, code) {
    if (!validation.valid && /rate limit|unauthorized|forbidden|api error/i.test(validation.reason)) {
      log.error(`\n❌ ERREUR API MCP: ${validation.reason}`);

      if (/rate limit/i.test(validation.reason)) {
        log.error('⚠️  QUOTA API DÉPASSÉ');
        log.info('   → Attendez la réinitialisation du quota (24h)');
        log.info('   → Vérifiez votre usage: GET /api/usage');
      }

      log.info(`   Code reçu: ${code.substring(0, 150)}${code.length > 150 ? '...' : ''}\n`);
      throw new Error(`MCP API Error: ${validation.reason}. Stopping to avoid wasting API calls.`);
    }
  }

  /**
   * Classify code result from MCP into categories
   * @param {string} code - Code received from MCP
   * @returns {object} - {category: string, reason: string, needsChunking: boolean}
   */
  classifyCodeResult(code) {
    // 0. Check if code exists
    if (!code || typeof code !== 'string') {
      return { category: 'CONTENT_ERROR', reason: 'No code received from MCP', needsChunking: false };
    }

    // 1. Fatal API errors (rate limit, auth, etc.) → FAIL immediately
    const fatalErrors = [
      { pattern: /rate limit exceeded/i, message: 'Rate limit exceeded' },
      { pattern: /unauthorized/i, message: 'Unauthorized' },
      { pattern: /forbidden/i, message: 'Forbidden' },
      { pattern: /api error/i, message: 'API error' },
      { pattern: /request failed/i, message: 'Request failed' }
    ];

    for (const { pattern, message } of fatalErrors) {
      if (pattern.test(code)) {
        return { category: 'FATAL_ERROR', reason: message, needsChunking: false };
      }
    }

    // 2. Signals that chunking is needed (content too large/complex)
    const chunkSignals = [
      { pattern: /too large/i, message: 'Content too large' },
      { pattern: /too complex/i, message: 'Content too complex' },
      { pattern: /exceeds limit/i, message: 'Exceeds limit' },
      { pattern: /content size/i, message: 'Content size exceeded' },
      { pattern: /cannot generate.*size/i, message: 'Cannot generate due to size' },
      { pattern: /selection too big/i, message: 'Selection too big' },
      { pattern: /try.*smaller/i, message: 'Try smaller selection' }
    ];

    for (const { pattern, message } of chunkSignals) {
      if (pattern.test(code)) {
        return { category: 'TOO_LARGE', reason: message, needsChunking: true };
      }
    }

    // 3. Content errors (empty node, not found, etc.) → FAIL
    const contentErrors = [
      { pattern: /node is empty/i, message: 'Node is empty' },
      { pattern: /no code available/i, message: 'No code available' },
      { pattern: /not found/i, message: 'Not found' },
      { pattern: /node.*empty/i, message: 'Empty node' },
      { pattern: /cannot generate/i, message: 'Code generation failed' }
    ];

    for (const { pattern, message } of contentErrors) {
      if (pattern.test(code)) {
        return { category: 'CONTENT_ERROR', reason: message, needsChunking: false };
      }
    }

    // 4. Validate as React code
    const validation = this.isValidReactCode(code, false);
    if (!validation.valid) {
      return { category: 'INVALID_CODE', reason: validation.reason, needsChunking: false };
    }

    // 5. Valid code
    return { category: 'VALID_CODE', reason: 'Valid React code', needsChunking: false };
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
        dirForAssetWrites: this.assetsDirHost,  // Required by MCP server
        forceCode: true,
        clientLanguages: this.config.commonParams.clientLanguages,
        clientFrameworks: this.config.commonParams.clientFrameworks
      });

      const code = codeResult.content[0].text;

      // Validate code (use flexible validation for chunks)
      const validation = this.isValidReactCode(code, true);
      if (!validation.valid) {
        // Check for fatal API errors first (rate limit, auth, etc.) - stop immediately
        this.checkForFatalAPIError(validation, code);

        // Non-fatal validation errors (design issues, node not found, etc.)
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

    // Create unique assets directory for this export
    log.task('📁', 'Création dossier assets');
    fs.mkdirSync(this.assetsDir, { recursive: true, mode: 0o755 });
    log.success(`Assets: ${path.basename(this.assetsDir)}\n`);
  }

  /**
   * PHASE 1: MCP Extraction (Metadata First, Intelligent Classification)
   */
  async phase1_extraction() {
    log.phase('PHASE 1: EXTRACTION MCP (Metadata First)');

    // 1. Get metadata first (needed for both modes)
    log.task('📋', 'Récupération metadata');
    const metadataResult = await this.callMCPTool('get_metadata', {
      nodeId: this.nodeId,
      clientLanguages: this.config.commonParams.clientLanguages,
      clientFrameworks: this.config.commonParams.clientFrameworks
    });
    this.saveFile('metadata.xml', metadataResult.content[0].text);
    log.success('Metadata sauvegardé\n');

    // 2. Get variables and screenshot in parallel
    log.task('🎨', '2 appels MCP en parallèle');
    const [screenshotResult, variablesResult] = await Promise.all([
      this.callMCPTool('get_screenshot', { nodeId: this.nodeId }),
      this.callMCPTool('get_variable_defs', { nodeId: this.nodeId })
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

    // Save variables
    this.saveFile('variables.json', variablesResult.content[0].text);
    log.success('2 appels MCP terminés\n');

    // 3. Get design context with assets
    log.task('💻', 'Récupération code + assets');
    const codeResult = await this.callMCPTool('get_design_context', {
      nodeId: this.nodeId,
      dirForAssetWrites: this.assetsDirHost,  // Unique per export, no conflicts
      forceCode: true,
      clientLanguages: this.config.commonParams.clientLanguages,
      clientFrameworks: this.config.commonParams.clientFrameworks
    });

    // Safe access to code (may be undefined if MCP returns error)
    const code = codeResult?.content?.[0]?.text;

    if (!code) {
      log.error('MCP returned empty or invalid response');
      log.info(`Response structure: ${JSON.stringify(codeResult, null, 2).substring(0, 500)}...\n`);
    } else {
      log.success('Code + assets récupérés\n');
      // Debug: show first 200 chars to understand what MCP returns
      if (code.length < 500) {
        log.info(`   Code complet reçu (${code.length} chars):\n${code}\n`);
      }
    }

    // 4. Classify the result
    const classification = this.classifyCodeResult(code);
    log.info(`   Classification: ${classification.category}`);
    log.info(`   Raison: ${classification.reason}`);
    if (code) {
      log.info(`   Taille: ${(code.length / 1000).toFixed(1)}k caractères\n`);
    } else {
      log.info(`   Taille: N/A (code manquant)\n`);
    }

    // 5. Handle based on classification
    switch (classification.category) {
      case 'FATAL_ERROR':
        log.error(`❌ ERREUR API MCP: ${classification.reason}`);
        throw new Error(`MCP API Error: ${classification.reason}. Aborting to save API calls.`);

      case 'TOO_LARGE':
        // MODE CHUNK - Figma signals content too large
        log.warning(`⚠️  MODE CHUNKING: ${classification.reason}`);

        // Extract child nodes from metadata (already retrieved)
        const nodes = this.extractChildNodes();
        log.info(`${nodes.length} node(s) à traiter\n`);

        // Get parent wrapper
        log.task('📦', 'Récupération parent wrapper');
        const parentWrapperResult = await this.callMCPTool('get_design_context', {
          nodeId: this.nodeId,
          dirForAssetWrites: this.assetsDirHost,  // Same folder, no conflict
          forceCode: true,
          clientLanguages: this.config.commonParams.clientLanguages,
          clientFrameworks: this.config.commonParams.clientFrameworks
        });
        this.saveFile('parent-wrapper.tsx', parentWrapperResult.content[0].text);
        log.success('Parent wrapper sauvegardé\n');

        // Generate chunks sequentially
        await this.generateChunks(nodes);

        // Assemble chunks
        log.task('🔗', 'Assemblage des chunks');
        this.assembleChunks();
        log.success('Component.tsx assemblé\n');

        // Wait for images
        await this.waitForImages();

        // Cleanup temp assets
        await this.cleanupTempAssets();

        log.success(`Phase 1 terminée en MODE CHUNKING (${4 + nodes.length} appels)\n`);
        this.mcpSucceeded = true; // Mark MCP extraction as successful
        break;

      case 'CONTENT_ERROR':
      case 'INVALID_CODE':
        log.error(`❌ Code invalide: ${classification.reason}`);
        if (code && typeof code === 'string') {
          log.info(`   Aperçu du code:\n${code.substring(0, 300)}${code.length > 300 ? '...' : ''}\n`);
        } else {
          log.info(`   Code reçu: ${JSON.stringify(code)}\n`);
        }
        throw new Error(`Invalid content from MCP: ${classification.reason}. Cannot process.`);

      case 'VALID_CODE':
        // MODE SIMPLE - Valid code received
        log.success('✅ MODE SIMPLE: Code valide');
        this.saveFile('Component.tsx', code);

        // Wait for images to be written asynchronously
        log.task('⏳', 'Attente des images MCP');
        log.info('Délai de grâce de 5s pour l\'écriture asynchrone des images...');
        await new Promise(resolve => setTimeout(resolve, 5000));
        await this.waitForImages();

        // Cleanup temp assets
        await this.cleanupTempAssets();

        log.success('Phase 1 terminée en MODE SIMPLE (4 appels)\n');
        this.mcpSucceeded = true; // Mark MCP extraction as successful
        break;

      default:
        throw new Error(`Unknown classification category: ${classification.category}`);
    }
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
   * Cleanup temporary assets directory after images are copied
   */
  async cleanupTempAssets() {
    log.task('🧹', 'Nettoyage dossier temporaire');
    try {
      if (fs.existsSync(this.assetsDir)) {
        execSync(`rm -rf "${this.assetsDir}" 2>/dev/null || true`);
        log.success(`Dossier temporaire nettoyé: ${path.basename(this.assetsDir)}\n`);
      } else {
        log.info('Dossier temporaire déjà supprimé\n');
      }
    } catch (error) {
      log.warning(`Impossible de nettoyer ${path.basename(this.assetsDir)}: ${error.message}\n`);
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

      // Always generate components/
      log.task('🔪', 'Splitting components');
      const { splitComponent } = await import('./post-processing/component-splitter.js');
      await splitComponent(this.testDir);
      log.success('components/ directory created\n');

      // Generate dist/ package
      log.task('📦', 'Generating developer-ready export');
      const { generateDist } = await import('./post-processing/dist-generator.js');
      await generateDist(this.testDir, {
        type: 'single',
        componentName: this.nodeName || 'Component'
      });
      log.success('dist/ package ready\n');

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

      // Output exportId for server parsing (machine-readable format)
      console.log(`EXPORT_ID: ${testId}`);

    } catch (error) {
      log.error(`ERREUR lors de la génération: ${error.message}`);
      console.log(`${colors.dim}${error.stack}${colors.reset}`);

      // Cleanup: only remove folder if MCP extraction failed
      // If MCP succeeded but post-processing failed, keep files for debugging
      if (!this.mcpSucceeded && fs.existsSync(this.testDir)) {
        log.task('🧹', 'Nettoyage du dossier de test incomplet (MCP a échoué)');
        try {
          fs.rmSync(this.testDir, { recursive: true, force: true });
          log.success(`Dossier supprimé: ${path.basename(this.testDir)}`);
        } catch (cleanupError) {
          log.warning(`Impossible de supprimer le dossier: ${cleanupError.message}`);
        }
      } else if (this.mcpSucceeded && fs.existsSync(this.testDir)) {
        log.warning(`⚠️  Fichiers conservés pour débogage: ${path.basename(this.testDir)}`);
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
