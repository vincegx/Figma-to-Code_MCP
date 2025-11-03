/**
 * Transform Configuration
 *
 * Simple configuration for enabling/disabling transforms
 * and setting transform-specific options
 */

export const defaultConfig = {
  // Enable/disable individual transforms
  'font-detection': {
    enabled: true
  },
  'ast-cleaning': {
    enabled: true
  },
  'svg-icon-fixes': {
    enabled: true
  },
  'post-fixes': {
    enabled: true
  },
  'css-vars': {
    enabled: true
  },
  'tailwind-optimizer': {
    enabled: true
  },

  // Global options
  continueOnError: false  // Stop on first error or continue
}
