/**
 * Context - Shared state passed to all transforms
 *
 * Provides:
 * - Access to external data (variables, fonts, etc.)
 * - Logger for transforms
 * - Stats collection
 * - Shared state (replaces global variables)
 */

export class Context {
  constructor(data = {}) {
    // External data
    this.primaryFont = data.primaryFont || null
    this.googleFontsUrl = data.googleFontsUrl || null
    this.variables = data.variables || {}
    this.cssVariables = data.cssVariables || {}
    this.inputDir = data.inputDir || ''
    this.metadataXmlPath = data.metadataXmlPath || null

    // Shared state (isolated per execution - replaces global vars)
    this.customCSSClasses = new Map()
    this.rootContainerProcessed = false

    // Analysis data
    this.analysis = {
      sections: [],
      totalNodes: 0,
      imagesCount: 0
    }

    // Stats collection
    this.stats = {}

    // Logger (can be overridden)
    this.logger = data.logger || console

    // Options
    this.options = data.options || {}
  }

  /**
   * Record stats for a transform
   */
  recordStats(transformName, stats) {
    this.stats[transformName] = {
      ...stats,
      timestamp: Date.now()
    }
  }

  /**
   * Get accumulated stats
   */
  getStats() {
    return {
      transforms: this.stats,
      analysis: this.analysis,
      customCSSClasses: this.customCSSClasses.size
    }
  }

  /**
   * Reset state (useful for testing or processing multiple files)
   */
  reset() {
    this.customCSSClasses.clear()
    this.rootContainerProcessed = false
    this.analysis = {
      sections: [],
      totalNodes: 0,
      imagesCount: 0
    }
    this.stats = {}
  }
}
