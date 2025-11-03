/**
 * Figma Transform Configuration
 *
 * Defines which transforms to run and in what order.
 * You can easily enable/disable transforms or change their priority.
 */

export default {
  // List of transforms with their configuration
  transforms: [
    {
      name: 'font-detection',
      priority: 0,
      enabled: true,
      description: 'Convert font-[...] to inline styles'
    },
    {
      name: 'ast-cleaning',
      priority: 10,
      enabled: true,
      description: 'Clean invalid classes, add overflow-x-hidden, convert text sizes'
    },
    {
      name: 'svg-composites',
      priority: 15,
      enabled: true,
      description: 'Merge composite SVG logos, flatten unnecessary wrappers'
    },
    {
      name: 'post-fixes',
      priority: 20,
      enabled: true,
      description: 'Fix gradients, shapes, blend modes'
    },
    {
      name: 'css-vars',
      priority: 30,
      enabled: true,
      description: 'Convert CSS variables to custom classes'
    },
    {
      name: 'tailwind-optimizer',
      priority: 40,
      enabled: true,
      description: 'Convert arbitrary values to standard Tailwind classes'
    }
  ],

  // Pipeline options
  continueOnError: false, // Set to true to continue even if a transform fails

  // Debug options
  debug: {
    timing: true,      // Log execution time for each transform
    verbose: false,    // Detailed logging
    dumpAST: false     // Save AST snapshots (for debugging)
  }
}
