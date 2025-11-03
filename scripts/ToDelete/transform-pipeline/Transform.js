/**
 * Transform - Base class for all transformations
 *
 * Each transform is a self-contained module that:
 * - Has a unique name
 * - Declares its priority (execution order)
 * - Implements execute() method
 * - Returns stats about what it did
 */

export class Transform {
  constructor(options = {}) {
    this.options = options
  }

  /**
   * Unique name for this transform
   * @type {string}
   */
  name = 'base-transform'

  /**
   * Priority (execution order)
   * Lower number = runs first
   * @type {number}
   */
  priority = 100

  /**
   * Execute the transformation
   *
   * @param {Object} ast - Babel AST
   * @param {Context} context - Shared context
   * @returns {Object} Stats about what was done
   */
  async execute(ast, context) {
    throw new Error(`Transform "${this.name}" must implement execute() method`)
  }

  /**
   * Get className attribute from JSX element
   * @protected
   */
  getClassNameAttr(path) {
    const attributes = path.node.openingElement.attributes
    return attributes.find(
      attr => attr.name && attr.name.name === 'className'
    )
  }

  /**
   * Get attribute value from JSX element
   * @protected
   */
  getAttributeValue(path, attrName) {
    const attributes = path.node.openingElement.attributes
    const attr = attributes.find(
      a => a.name && a.name.name === attrName
    )

    if (!attr) return null

    if (attr.value && attr.value.value) {
      return attr.value.value
    }

    return null
  }
}
