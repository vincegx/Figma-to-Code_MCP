/**
 * Transform Configuration
 *
 * DEPRECATED: This file is deprecated in favor of settings.json
 * Use getTransformConfig() from settings-loader.js instead
 *
 * This file is kept for backward compatibility only
 */

import { getTransformConfig } from './utils/settings-loader.js';

// Export function that loads from settings.json
export const defaultConfig = getTransformConfig();
