#!/usr/bin/env node

/**
 * Recalculate usage stats from existing test files
 * Scans all tests and computes real token usage based on file sizes
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const TESTS_DIR = path.join(__dirname, '../../src/generated/tests');
const USAGE_FILE = path.join(__dirname, '../../data/figma-usage.json');

/**
 * Calculate tokens from file content
 */
function calculateTokens(content, isBase64 = false) {
  if (!content) return 0;
  const divisor = isBase64 ? 6 : 4;
  return Math.round(content.length / divisor);
}

/**
 * Parse test metadata to get creation date
 */
function getTestDate(testDir) {
  try {
    const metadataPath = path.join(testDir, 'metadata.json');
    if (!fs.existsSync(metadataPath)) {
      // Fallback to folder creation time
      const stats = fs.statSync(testDir);
      return stats.birthtime.toISOString().split('T')[0];
    }

    const metadata = JSON.parse(fs.readFileSync(metadataPath, 'utf8'));
    // Extract date from timestamp or createdAt
    if (metadata.timestamp) {
      return new Date(metadata.timestamp).toISOString().split('T')[0];
    }
    if (metadata.createdAt) {
      return metadata.createdAt.split('T')[0];
    }

    // Fallback to folder creation time
    const stats = fs.statSync(testDir);
    return stats.birthtime.toISOString().split('T')[0];
  } catch (error) {
    console.warn(`Warning: Could not parse date for ${testDir}:`, error.message);
    // Fallback to folder creation time
    const stats = fs.statSync(testDir);
    return stats.birthtime.toISOString().split('T')[0];
  }
}

/**
 * Scan a single test directory and calculate tokens
 */
function scanTest(testDir) {
  const result = {
    get_design_context: 0,
    get_metadata: 0,
    get_variable_defs: 0,
    get_screenshot: 0
  };

  // 1. get_design_context - Component.tsx
  const componentPath = path.join(testDir, 'Component.tsx');
  if (fs.existsSync(componentPath)) {
    const content = fs.readFileSync(componentPath, 'utf8');
    result.get_design_context = calculateTokens(content);
  }

  // 2. get_metadata - metadata.xml
  const metadataXmlPath = path.join(testDir, 'metadata.xml');
  if (fs.existsSync(metadataXmlPath)) {
    const content = fs.readFileSync(metadataXmlPath, 'utf8');
    result.get_metadata = calculateTokens(content);
  }

  // 3. get_variable_defs - variables.json
  const variablesPath = path.join(testDir, 'variables.json');
  if (fs.existsSync(variablesPath)) {
    const content = fs.readFileSync(variablesPath, 'utf8');
    result.get_variable_defs = calculateTokens(content);
  }

  // 4. get_screenshot - figma-screenshot.png (estimate as base64)
  const screenshotPath = path.join(testDir, 'figma-screenshot.png');
  if (fs.existsSync(screenshotPath)) {
    const buffer = fs.readFileSync(screenshotPath);
    // Convert to base64 to simulate MCP response
    const base64 = buffer.toString('base64');
    result.get_screenshot = calculateTokens(base64, true);
  }

  return result;
}

/**
 * Main function
 */
function recalculateUsage() {
  console.log('🔍 Scanning test directories...\n');

  if (!fs.existsSync(TESTS_DIR)) {
    console.error('❌ Tests directory not found:', TESTS_DIR);
    process.exit(1);
  }

  // Read current usage data
  let usageData = { daily: {}, limits: { dailyCredits: 1200000, planType: 'professional' } };
  if (fs.existsSync(USAGE_FILE)) {
    usageData = JSON.parse(fs.readFileSync(USAGE_FILE, 'utf8'));
  }

  // Scan all test directories
  const testDirs = fs.readdirSync(TESTS_DIR)
    .filter(name => name.startsWith('node-'))
    .map(name => path.join(TESTS_DIR, name));

  console.log(`📁 Found ${testDirs.length} test(s)\n`);

  // Group by date
  const testsByDate = {};

  for (const testDir of testDirs) {
    const testName = path.basename(testDir);
    const date = getTestDate(testDir);

    if (!testsByDate[date]) {
      testsByDate[date] = [];
    }

    const tokens = scanTest(testDir);
    testsByDate[date].push({ name: testName, tokens });

    const total = Object.values(tokens).reduce((sum, val) => sum + val, 0);
    console.log(`  ${testName} (${date})`);
    console.log(`    get_design_context: ${tokens.get_design_context.toLocaleString()} tk`);
    console.log(`    get_metadata: ${tokens.get_metadata.toLocaleString()} tk`);
    console.log(`    get_variable_defs: ${tokens.get_variable_defs.toLocaleString()} tk`);
    console.log(`    get_screenshot: ${tokens.get_screenshot.toLocaleString()} tk`);
    console.log(`    Total: ${total.toLocaleString()} tk\n`);
  }

  // Aggregate by date
  console.log('📊 Aggregating by date...\n');

  for (const [date, tests] of Object.entries(testsByDate)) {
    const aggregated = {
      calls: {
        get_design_context: tests.length,
        get_metadata: tests.length,
        get_variable_defs: tests.length,
        get_screenshot: tests.length
      },
      totalCalls: tests.length * 4,
      analyses: tests.length,
      tokens: {
        get_design_context: 0,
        get_metadata: 0,
        get_variable_defs: 0,
        get_screenshot: 0
      },
      totalTokens: 0
    };

    // Sum up tokens
    for (const test of tests) {
      for (const [tool, tokens] of Object.entries(test.tokens)) {
        aggregated.tokens[tool] += tokens;
        aggregated.totalTokens += tokens;
      }
    }

    usageData.daily[date] = aggregated;

    console.log(`  ${date}:`);
    console.log(`    Analyses: ${aggregated.analyses}`);
    console.log(`    Total Calls: ${aggregated.totalCalls}`);
    console.log(`    Total Tokens: ${aggregated.totalTokens.toLocaleString()}`);
    console.log(`    Percentage: ${(aggregated.totalTokens / 1200000 * 100).toFixed(2)}%\n`);
  }

  // Save updated usage data
  fs.writeFileSync(USAGE_FILE, JSON.stringify(usageData, null, 2), 'utf8');
  console.log(`✅ Usage data updated: ${USAGE_FILE}\n`);
}

recalculateUsage();
