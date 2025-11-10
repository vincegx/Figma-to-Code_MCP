import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

/**
 * Load all responsive transformations from the transformations directory
 * @param {object} config - Configuration object with enabled transforms
 * @returns {Array} Array of transformation modules
 */
function loadResponsiveTransforms(config = {}) {
  const transformsDir = path.join(__dirname, 'responsive-transformations');

  if (!fs.existsSync(transformsDir)) {
    console.warn('⚠️  Responsive transformations directory not found, skipping pipeline');
    return [];
  }

  const files = fs.readdirSync(transformsDir)
    .filter(file => file.endsWith('.js'))
    .sort(); // Alphabetical sort (files are named with priority prefix)

  const transforms = [];

  for (const file of files) {
    const transformPath = path.join(transformsDir, file);

    try {
      // Dynamic import with file:// URL
      import(`file://${transformPath}`)
        .then(module => {
          if (!module.meta || !module.execute) {
            console.warn(`⚠️  Transform ${file} missing meta or execute, skipping`);
            return;
          }

          // Check if transform is enabled in config
          const isEnabled = config.transforms?.[module.meta.name]?.enabled !== false;

          if (isEnabled) {
            transforms.push(module);
          }
        })
        .catch(err => {
          console.error(`❌ Failed to load transform ${file}:`, err.message);
        });
    } catch (err) {
      console.error(`❌ Failed to import transform ${file}:`, err.message);
    }
  }

  return transforms;
}

/**
 * Load all responsive transformations synchronously
 * @param {object} config - Configuration object
 * @returns {Promise<Array>} Array of transformation modules
 */
async function loadResponsiveTransformsAsync(config = {}) {
  const transformsDir = path.join(__dirname, 'responsive-transformations');

  if (!fs.existsSync(transformsDir)) {
    console.warn('⚠️  Responsive transformations directory not found, skipping pipeline');
    return [];
  }

  const files = fs.readdirSync(transformsDir)
    .filter(file => file.endsWith('.js'))
    .sort();

  const transforms = [];

  for (const file of files) {
    const transformPath = path.join(transformsDir, file);

    try {
      const module = await import(`file://${transformPath}`);

      if (!module.meta || !module.execute) {
        console.warn(`⚠️  Transform ${file} missing meta or execute, skipping`);
        continue;
      }

      // Check if transform is enabled in config
      const isEnabled = config.transforms?.[module.meta.name]?.enabled !== false;

      if (isEnabled) {
        transforms.push(module);
      }
    } catch (err) {
      console.error(`❌ Failed to load transform ${file}:`, err.message);
    }
  }

  return transforms;
}

/**
 * Run responsive transformation pipeline
 * @param {object} desktopAST - Babel AST of Desktop TSX
 * @param {object} tabletAST - Babel AST of Tablet TSX
 * @param {object} mobileAST - Babel AST of Mobile TSX
 * @param {object} breakpoints - Breakpoint widths { desktop, tablet, mobile }
 * @param {object} config - Pipeline configuration
 * @returns {Promise<object>} Context with modified ASTs and stats
 */
export async function runResponsivePipeline(desktopAST, tabletAST, mobileAST, breakpoints, config = {}) {
  // Load all transformations
  const transforms = await loadResponsiveTransformsAsync(config);

  if (transforms.length === 0) {
    console.warn('⚠️  No responsive transformations loaded, returning original ASTs');
    return {
      desktopAST,
      tabletAST,
      mobileAST,
      stats: {}
    };
  }

  // Sort by priority (ascending: 10 → 100)
  transforms.sort((a, b) => a.meta.priority - b.meta.priority);

  // Initialize context shared across all transforms
  const context = {
    desktopAST,
    tabletAST,
    mobileAST,
    breakpoints,
    stats: {},
    // Shared data populated by transforms
    missingInMobile: new Set(),
    missingInTablet: new Set(),
    identicalClasses: new Map(),
    classConflicts: new Map()
  };

  // Execute each transformation sequentially
  for (const transform of transforms) {
    try {
      const startTime = Date.now();
      const result = transform.execute(context);
      const executionTime = Date.now() - startTime;

      // Store stats
      context.stats[transform.meta.name] = {
        ...result,
        executionTime: `${executionTime}ms`
      };

    } catch (err) {
      console.error(`❌ Transform ${transform.meta.name} failed:`, err.message);
      context.stats[transform.meta.name] = {
        error: err.message
      };
    }
  }

  return context;
}

/**
 * Get transform statistics summary
 * @param {object} stats - Stats from pipeline execution
 * @returns {string} Formatted summary
 */
export function formatPipelineStats(stats) {
  const lines = [];

  for (const [name, data] of Object.entries(stats)) {
    if (data.error) {
      lines.push(`  ❌ ${name}: ${data.error}`);
    } else {
      const details = Object.entries(data)
        .filter(([key]) => key !== 'executionTime')
        .map(([key, value]) => `${key}=${value}`)
        .join(', ');

      lines.push(`  ✓ ${name}: ${details} (${data.executionTime})`);
    }
  }

  return lines.join('\n');
}
