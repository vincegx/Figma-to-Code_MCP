/**
 * Settings Loader
 * Centralized settings management for CLI and server
 * Loads from cli/config/settings.json
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

let cachedSettings = null;

/**
 * Load settings from cli/config/settings.json
 * @returns {Object} Settings object
 */
export function loadSettings() {
  if (cachedSettings) {
    return cachedSettings;
  }

  const settingsPath = path.join(__dirname, '../../cli/config/settings.json');

  if (!fs.existsSync(settingsPath)) {
    console.warn('⚠️  Settings file not found, using defaults');
    return getDefaultSettings();
  }

  try {
    const settingsContent = fs.readFileSync(settingsPath, 'utf8');
    cachedSettings = JSON.parse(settingsContent);
    return cachedSettings;
  } catch (error) {
    console.error('❌ Failed to load settings:', error.message);
    return getDefaultSettings();
  }
}

/**
 * Reload settings from disk (clear cache)
 */
export function reloadSettings() {
  cachedSettings = null;
  return loadSettings();
}

/**
 * Get default settings (fallback)
 */
function getDefaultSettings() {
  return {
    mcp: {
      serverUrl: 'http://host.docker.internal:3845/mcp',
      callDelay: 1000,
      minDelay: 500,
      maxDelay: 5000
    },
    generation: {
      defaultMode: 'both',
      chunking: {
        enabled: true
      }
    },
    directories: {
      testsOutput: 'src/generated/export_figma',
      tmpAssets: 'tmp/figma-assets'
    },
    apiLimits: {
      dailyTokenLimit: 1200000,
      thresholds: {
        warning: 50,
        critical: 75,
        danger: 90
      }
    },
    ui: {
      defaultView: 'grid',
      itemsPerPage: 12
    },
    screenshots: {
      format: 'png',
      quality: 90
    },
    docker: {
      containerName: 'mcp-figma-v1'
    },
    transforms: {
      'font-detection': {
        enabled: true,
        usePostScriptName: true,
        useTextStyleId: true
      },
      'auto-layout': {
        enabled: true,
        fixMissingGap: true,
        fixMissingAlignments: true,
        fixSizing: true
      },
      'ast-cleaning': {
        enabled: true
      },
      'svg-icon-fixes': {
        enabled: true
      },
      'post-fixes': {
        enabled: true,
        fixShadows: true,
        fixTextTransform: true
      },
      'position-fixes': {
        enabled: true,
        convertAbsoluteToRelative: true,
        skipOverlays: true
      },
      'stroke-alignment': {
        enabled: true,
        useBoxShadowForInside: true,
        useOutlineForOutside: true
      },
      'css-vars': {
        enabled: true
      },
      'tailwind-optimizer': {
        enabled: true
      },
      continueOnError: false
    }
  };
}

/**
 * Get MCP client parameters (for Figma MCP Desktop)
 */
export function getMcpParams() {
  const settings = loadSettings();
  return {
    serverUrl: settings.mcp.serverUrl,
    callDelay: settings.mcp.callDelay,
    clientLanguages: 'javascript,typescript',
    clientFrameworks: 'react'
  };
}

/**
 * Get transform configuration
 */
export function getTransformConfig() {
  const settings = loadSettings();
  return settings.transforms || {};
}

/**
 * Get directory paths
 */
export function getDirectories() {
  const settings = loadSettings();
  return settings.directories;
}

/**
 * Get generation settings
 */
export function getGenerationSettings() {
  const settings = loadSettings();
  return settings.generation;
}

/**
 * Get screenshot settings
 */
export function getScreenshotSettings() {
  const settings = loadSettings();
  return settings.screenshots;
}

/**
 * Get API limits settings
 */
export function getApiLimits() {
  const settings = loadSettings();
  return settings.apiLimits;
}
