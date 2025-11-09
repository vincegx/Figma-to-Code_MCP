/**
 * useTests - Hook to load and manage test data
 * Extracted from HomePage.tsx for reusability
 */

import { useState, useEffect } from 'react'

export interface Test {
  testId: string
  fileName?: string
  layerName?: string
  timestamp: string | number
  nodeId: string
  stats?: {
    totalNodes?: number
    sectionsDetected?: number
    imagesOrganized?: number
    totalFixes?: number
    fontsConverted?: number
    enhancedWeights?: number
    fontsDetected?: number
    executionTime?: number
    classesFixed?: number
    overflowAdded?: boolean
    textSizesConverted?: number
    widthsAdded?: number
    nodesAnalyzed?: number
    wrappersFlattened?: number
    compositesInlined?: number
    groupsConsolidated?: number
    svgsConsolidated?: number
    gradientsFixed?: number
    shapesFixed?: number
    blendModesVerified?: number
    shadowsFixed?: number
    spreadAdded?: number
    invisibleShadowsRemoved?: number
    textTransformAdded?: number
    varsConverted?: number
    customClassesGenerated?: number
    classesOptimized?: number
    dataAttrsRemoved?: number
    inlineStylesExtracted?: number
    arbitraryClassesConverted?: number
    fontClassesGenerated?: number
    cleanClassesGenerated?: number
  }
}

export function useTests() {
  const [tests, setTests] = useState<Test[]>([])
  const [loading, setLoading] = useState<boolean>(true)

  const loadTests = async () => {
    try {
      const testModules = import.meta.glob<{ default: any }>('../generated/tests/*/metadata.json', { eager: true })
      const xmlModules = import.meta.glob<string>('../generated/tests/*/metadata.xml', { eager: true, as: 'raw' })

      const loadedTests = Object.entries(testModules).map(([path, module]) => {
        const testId = path.split('/')[3]
        const xmlPath = path.replace('metadata.json', 'metadata.xml')
        let layerName = null

        if (xmlModules[xmlPath]) {
          const xmlContent = xmlModules[xmlPath]
          const frameMatch = xmlContent.match(/<frame[^>]+name="([^"]+)"/)
          layerName = frameMatch ? frameMatch[1] : null
        }

        return {
          ...module.default,
          testId,
          layerName
        } as Test
      })

      setTests(loadedTests)
      setLoading(false)
    } catch (error) {
      console.error('Error loading tests:', error)
      setTests([])
      setLoading(false)
    }
  }

  useEffect(() => {
    loadTests()
  }, [])

  return {
    tests,
    loading,
    reload: loadTests
  }
}
