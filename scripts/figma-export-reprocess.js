#!/usr/bin/env node

import fs from 'fs';
import path from 'path';
import { execSync } from 'child_process';
import { fileURLToPath } from 'url';
import { loadSettings, getDirectories } from './utils/settings-loader.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// ANSI Color codes
const colors = {
  reset: '\x1b[0m',
  bright: '\x1b[1m',
  dim: '\x1b[2m',
  cyan: '\x1b[36m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  magenta: '\x1b[35m',
  red: '\x1b[31m',
  gray: '\x1b[90m',
  bgCyan: '\x1b[46m',
  bgGreen: '\x1b[42m',
};

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
  error: (text) => {
    console.log(`\n${colors.red}✗ ${text}${colors.reset}`);
  },
  header: (text) => {
    console.log(`\n${colors.bright}${colors.magenta}🔄 ${text}${colors.reset}\n`);
  },
  divider: () => {
    console.log(`${colors.gray}${'─'.repeat(60)}${colors.reset}`);
  }
};

class ExportReprocessor {
  constructor(exportId, cleanMode = false) {
    this.settings = loadSettings();
    const directories = getDirectories();

    this.exportId = exportId;
    this.cleanMode = cleanMode;
    this.testDir = path.join(process.cwd(), directories.testsOutput, exportId);
    this.vitePort = (this.settings.docker && this.settings.docker.vitePort) || 5173;

    // Validate export directory exists
    if (!fs.existsSync(this.testDir)) {
      log.error(`Export directory not found: ${this.testDir}`);
      process.exit(1);
    }

    // Validate Component.tsx exists
    if (!fs.existsSync(path.join(this.testDir, 'Component.tsx'))) {
      log.error('Component.tsx not found in export directory');
      log.info('This export may not have been fully processed yet');
      process.exit(1);
    }

    // Try to load metadata to get Figma URL
    this.figmaUrl = this.loadFigmaUrl();
    this.componentName = this.loadComponentName();
  }

  loadFigmaUrl() {
    const metadataPath = path.join(this.testDir, 'metadata.json');
    if (fs.existsSync(metadataPath)) {
      try {
        const metadata = JSON.parse(fs.readFileSync(metadataPath, 'utf8'));
        return metadata.figmaUrl || 'https://figma.com/file/unknown';
      } catch (error) {
        log.warning('Could not parse metadata.json, using default URL');
      }
    }
    return 'https://figma.com/file/unknown';
  }

  loadComponentName() {
    const metadataPath = path.join(this.testDir, 'metadata.json');
    if (fs.existsSync(metadataPath)) {
      try {
        const metadata = JSON.parse(fs.readFileSync(metadataPath, 'utf8'));
        return metadata.nodeName || 'Component';
      } catch (error) {
        return 'Component';
      }
    }
    return 'Component';
  }

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

    // 2.5. Synchronize CSS + TSX (new phase)
    log.task('🔄', 'Synchronisation CSS + TSX optimisations');
    execSync(`node ${path.join(__dirname, 'post-processing/sync-optimizer.js')} ${this.testDir}`);
    log.success('Component-optimized.tsx + Component-optimized.css synchronisés\n');

    // 3. Fix SVG vars
    const imgDir = path.join(this.testDir, 'img');
    if (fs.existsSync(imgDir)) {
      log.task('🎨', 'Correction variables CSS dans SVG');
      execSync(`node ${path.join(__dirname, 'post-processing/fix-svg-vars.js')} ${imgDir}`);
      log.success('Variables SVG corrigées\n');
    }
  }

  async phase5_captureWebRender() {
    log.phase('PHASE 5: CAPTURE WEB RENDER (FINAL)');

    log.task('📸', 'Capture web-render.png');

    // Extract dimensions from metadata.xml
    const dimensions = this.parseNodeDimensions();

    let command = `node ${path.join(__dirname, 'post-processing/capture-screenshot.js')} ${this.testDir} ${this.vitePort}`;

    if (dimensions) {
      log.info(`Using Figma node dimensions: ${dimensions.width}x${dimensions.height}`);
      command += ` ${dimensions.width} ${dimensions.height}`;
    } else {
      log.info('Auto-detecting dimensions from web render');
    }

    try {
      execSync(command);
      log.success('Screenshot capturé\n');
    } catch (error) {
      log.warning('Screenshot capture failed (le serveur Vite est-il lancé ?)\n');
    }
  }

  parseNodeDimensions() {
    const metadataPath = path.join(this.testDir, 'metadata.xml');
    if (!fs.existsSync(metadataPath)) return null;

    const xml = fs.readFileSync(metadataPath, 'utf8');
    const match = xml.match(/<node[^>]*width="([^"]+)"[^>]*height="([^"]+)"/);
    if (!match) return null;

    return {
      width: Math.round(parseFloat(match[1])),
      height: Math.round(parseFloat(match[2]))
    };
  }

  async run() {
    const startTime = Date.now();

    log.header('FIGMA EXPORT REPROCESSING');
    log.divider();
    console.log(`${colors.dim}Export ID:${colors.reset} ${this.exportId}`);
    console.log(`${colors.dim}Directory:${colors.reset} ${this.testDir}`);
    console.log(`${colors.dim}Clean Mode:${colors.reset} ${this.cleanMode ? 'Yes' : 'No'}`);
    log.divider();

    try {
      await this.phase2_postProcessing();

      // PHASE 3: Component Splitting
      log.phase('PHASE 3: COMPONENT SPLITTING');
      log.task('🔪', 'Extracting modular components');
      const { splitComponent } = await import('./post-processing/component-splitter.js');
      const splitStats = await splitComponent(this.testDir);
      log.success(`${splitStats.componentsCount} components extracted\n`);

      // PHASE 4: Dist Package Generation
      log.phase('PHASE 4: DIST PACKAGE GENERATION');
      log.task('📦', 'Generating developer-ready export');
      const { generateDist } = await import('./post-processing/dist-generator.js');
      const distStats = await generateDist(this.testDir, {
        type: 'single',
        componentName: this.componentName
      });
      log.success(`dist/ package ready (${distStats.componentsCount} components)\n`);

      // PHASE 5: Visual Validation (screenshot)
      await this.phase5_captureWebRender();

      const duration = ((Date.now() - startTime) / 1000).toFixed(1);

      console.log(`\n${colors.bright}${colors.bgGreen} ${colors.reset}`);
      console.log(`${colors.bright}${colors.green}┌${'─'.repeat(60)}┐${colors.reset}`);
      console.log(`${colors.bright}${colors.green}│  ✅ EXPORT RETRAITÉ AVEC SUCCÈS${' '.repeat(27)}│${colors.reset}`);
      console.log(`${colors.bright}${colors.green}└${'─'.repeat(60)}┘${colors.reset}\n`);

      console.log(`${colors.cyan}📁${colors.reset} ${colors.dim}Export directory:${colors.reset} ${this.testDir}`);
      console.log(`${colors.cyan}⏱️${colors.reset}  ${colors.dim}Durée:${colors.reset} ${colors.bright}${duration}s${colors.reset}`);
      console.log(`${colors.cyan}📊${colors.reset} ${colors.dim}Dashboard:${colors.reset} ${colors.blue}http://localhost:${this.vitePort}${colors.reset}\n`);

    } catch (error) {
      // Detect duplicate identifier errors (corrupted Figma file)
      if (error.message.includes('has already been declared') ||
          error.message.includes('Identifier') && error.message.includes('already')) {
        log.error('FICHIER FIGMA CORROMPU');
        console.log(`\n${colors.yellow}Le fichier source généré par Figma contient des imports dupliqués.${colors.reset}`);
        console.log(`${colors.dim}Solution: Renommez les layers dupliqués dans Figma et ré-exportez.${colors.reset}\n`);
      } else {
        log.error(`ERREUR lors du retraitement: ${error.message}`);
        console.log(`${colors.dim}${error.stack}${colors.reset}`);
      }
      process.exit(1);
    }
  }
}

// CLI entry point
const exportId = process.argv[2];
const cleanMode = process.argv.includes('--clean');

if (!exportId) {
  log.error('Usage: node figma-export-reprocess.js <export-id> [--clean]');
  console.log(`${colors.dim}Example: node scripts/figma-export-reprocess.js node-9-2654-1735689600${colors.reset}`);
  console.log(`${colors.dim}         node scripts/figma-export-reprocess.js node-9-2654-1735689600 --clean${colors.reset}`);
  process.exit(1);
}

const reprocessor = new ExportReprocessor(exportId, cleanMode);
await reprocessor.run();
