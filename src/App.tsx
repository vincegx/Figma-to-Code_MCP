import React, { useState, useEffect } from 'react'
import './App.css'
import HomePage from './components/HomePage'
import TestDetail from './components/TestDetail'

type View = 'home' | 'detail' | 'preview'

function App() {
  const [currentView, setCurrentView] = useState<View>('home')
  const [selectedTestId, setSelectedTestId] = useState<string | null>(null)

  // Check URL params for preview mode
  useEffect(() => {
    const params = new URLSearchParams(window.location.search)
    const previewMode = params.get('preview')
    const testId = params.get('test')

    if (previewMode === 'true' && testId) {
      setSelectedTestId(testId)
      setCurrentView('preview')
    }
  }, [])

  const handleSelectTest = (testId: string) => {
    setSelectedTestId(testId)
    setCurrentView('detail')
  }

  const handleBack = () => {
    setSelectedTestId(null)
    setCurrentView('home')
  }

  // Preview mode: just render the component without dashboard UI
  if (currentView === 'preview' && selectedTestId) {
    return <PreviewMode testId={selectedTestId} />
  }

  return (
    <div className="min-h-screen" style={{ backgroundColor: 'var(--bg-primary)' }}>
      {currentView === 'home' && (
        <HomePage onSelectTest={handleSelectTest} />
      )}

      {currentView === 'detail' && selectedTestId && (
        <TestDetail testId={selectedTestId} onBack={handleBack} />
      )}
    </div>
  )
}

// Preview mode component - renders ONLY the generated component
function PreviewMode({ testId }: { testId: string }) {
  const [Component, setComponent] = useState<React.ComponentType | null>(null)
  const [dimensions, setDimensions] = useState<{ width: number; height: number } | null>(null)

  // Get version from URL params (clean or fixed)
  const params = new URLSearchParams(window.location.search)
  const version = params.get('version') === 'fixed' ? 'fixed' : 'clean'

  useEffect(() => {
    // Load metadata to get dimensions
    import(`./generated/tests/${testId}/metadata.xml?raw`)
      .then((module) => {
        const xmlContent = module.default
        const widthMatch = xmlContent.match(/width="(\d+)"/)
        const heightMatch = xmlContent.match(/height="(\d+)"/)

        if (widthMatch && heightMatch) {
          setDimensions({
            width: parseInt(widthMatch[1]),
            height: parseInt(heightMatch[1])
          })
        }
      })
      .catch((err) => {
        console.error('Failed to load metadata:', err)
      })

    // Load CSS based on version
    const link = document.createElement('link')
    link.rel = 'stylesheet'
    link.href = `/src/generated/tests/${testId}/Component-${version}.css`
    link.id = `test-css-${testId}`
    document.head.appendChild(link)

    // Dynamically import the generated component based on version
    import(`./generated/tests/${testId}/Component-${version}.tsx`)
      .then((module) => {
        setComponent(() => module.default)
      })
      .catch((err) => {
        console.error('Failed to load component:', err)
      })

    return () => {
      const existingLink = document.getElementById(`test-css-${testId}`)
      if (existingLink) {
        document.head.removeChild(existingLink)
      }
    }
  }, [testId, version])

  if (!Component || !dimensions) {
    return <div>Loading...</div>
  }

  return (
    <div style={{
      minHeight: '100vh',
      display: 'flex',
      justifyContent: 'center',
      alignItems: 'start',
      backgroundImage: `
        linear-gradient(45deg, #f0f0f0 25%, transparent 25%),
        linear-gradient(-45deg, #f0f0f0 25%, transparent 25%),
        linear-gradient(45deg, transparent 75%, #f0f0f0 75%),
        linear-gradient(-45deg, transparent 75%, #f0f0f0 75%)
      `,
      backgroundSize: '20px 20px',
      backgroundPosition: '0 0, 0 10px, 10px -10px, -10px 0px',
      backgroundColor: '#ffffff'
    }}>
      <div style={{
        width: `${dimensions.width}px`,
        height: `${dimensions.height}px`
      }}>
        <Component />
      </div>
    </div>
  )
}

export default App
