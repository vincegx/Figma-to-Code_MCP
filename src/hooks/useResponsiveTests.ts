/**
 * useResponsiveTests - Hook to load and manage responsive test data
 * Pattern adapted from useTests.ts
 */

import { useState, useEffect } from 'react'

export interface ResponsiveTest {
  mergeId: string
  timestamp: string | number
  type: 'responsive-merge'
  breakpoints: {
    desktop: {
      testId: string
      screenSize: string
      width: number
    }
    tablet: {
      testId: string
      screenSize: string
      width: number
    }
    mobile: {
      testId: string
      screenSize: string
      width: number
    }
  }
  mediaQueries: {
    tablet: string
    mobile: string
  }
  components: string[]
  mainFile: string
  mergeStats: {
    successCount: number
    errorCount: number
    totalComponents: number
  }
}

export function useResponsiveTests() {
  const [tests, setTests] = useState<ResponsiveTest[]>([])
  const [loading, setLoading] = useState<boolean>(true)

  const loadTests = async () => {
    try {
      // Load tests via API to avoid HMR reload
      const response = await fetch('/api/responsive-tests')

      if (!response.ok) {
        throw new Error('Failed to fetch responsive tests')
      }

      const loadedTests = await response.json()
      setTests(loadedTests)
      setLoading(false)
    } catch (error) {
      console.error('Error loading responsive tests:', error)
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
