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
      // Load tests via API instead of import.meta.glob to avoid HMR reload
      const response = await fetch('/api/tests')

      if (!response.ok) {
        throw new Error('Failed to fetch tests')
      }

      const loadedTests = await response.json()
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
