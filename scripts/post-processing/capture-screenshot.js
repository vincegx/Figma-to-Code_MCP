#!/usr/bin/env node

/**
 * Capture screenshot du rendu web HTML
 * Usage: node scripts/capture-web-screenshot.js <test-dir> <port> [width] [height]
 *
 * Exemple: node scripts/capture-web-screenshot.js src/generated/tests/test-123 5173 1426 734
 */

import puppeteer from 'puppeteer';
import path from 'path';

async function captureWebScreenshot(testDir, port = 5173, fixedWidth = null, fixedHeight = null) {
  console.log('📸 Capturing web screenshot...');
  console.log(`   Test directory: ${testDir}`);
  console.log(`   Dev server port: ${port}`);
  if (fixedWidth && fixedHeight) {
    console.log(`   Fixed dimensions: ${fixedWidth}x${fixedHeight} (from Figma node)`);
  }

  // Extract testId from testDir (e.g., "src/generated/tests/test-123" -> "test-123")
  const testId = path.basename(testDir);

  const browser = await puppeteer.launch({
    headless: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox']
  });

  try {
    const page = await browser.newPage();

    // Use preview mode to render ONLY the component (not the dashboard)
    const url = `http://localhost:${port}/?preview=true&test=${testId}`;
    console.log(`🌐 Opening ${url}...`);

    await page.goto(url, {
      waitUntil: 'networkidle0',
      timeout: 30000
    });

    // Attendre un peu pour que tout se charge (images, fonts, etc.)
    await new Promise(resolve => setTimeout(resolve, 2000));

    // Déterminer les dimensions à utiliser
    let dimensions;
    if (fixedWidth && fixedHeight) {
      // Utiliser les dimensions du node Figma (garantit même taille que figma-screenshot.png)
      dimensions = {
        width: parseInt(fixedWidth),
        height: parseInt(fixedHeight)
      };
      console.log(`📐 Using fixed dimensions: ${dimensions.width}x${dimensions.height}`);
    } else {
      // Fallback: détecter automatiquement les dimensions du contenu
      dimensions = await page.evaluate(() => {
        const body = document.body;
        const html = document.documentElement;

        return {
          width: Math.max(
            body.scrollWidth,
            body.offsetWidth,
            html.clientWidth,
            html.scrollWidth,
            html.offsetWidth
          ),
          height: Math.max(
            body.scrollHeight,
            body.offsetHeight,
            html.clientHeight,
            html.scrollHeight,
            html.offsetHeight
          )
        };
      });
      console.log(`📐 Auto-detected dimensions: ${dimensions.width}x${dimensions.height}`);
    }

    // Set viewport to match content
    await page.setViewport({
      width: dimensions.width,
      height: dimensions.height,
      deviceScaleFactor: 2 // Retina quality
    });

    // Prendre le screenshot
    const screenshotPath = path.join(testDir, 'web-render.png');
    await page.screenshot({
      path: screenshotPath,
      fullPage: true
    });

    console.log(`✅ Screenshot saved: ${screenshotPath}`);

    return screenshotPath;

  } catch (error) {
    console.error('❌ Error capturing screenshot:', error.message);
    throw error;
  } finally {
    await browser.close();
  }
}

// Main
const [testDir, port, width, height] = process.argv.slice(2);

if (!testDir) {
  console.error('Usage: node scripts/capture-web-screenshot.js <test-dir> [port] [width] [height]');
  console.error('Example: node scripts/capture-web-screenshot.js src/generated/tests/test-123 5173');
  console.error('Example: node scripts/capture-web-screenshot.js src/generated/tests/test-123 5173 1426 734');
  process.exit(1);
}

captureWebScreenshot(testDir, port || 5173, width, height)
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
