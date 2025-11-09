import React, { useState, useEffect } from 'react'
import { BrowserRouter, Routes, Route, Navigate, useSearchParams, useParams, useNavigate } from 'react-router-dom'
import './App.css'
import MainLayout from './components/layout/MainLayout'
import DashboardPage from './components/pages/DashboardPage'
import AnalyzePage from './components/pages/AnalyzePage'
import TestsPage from './components/pages/TestsPage'
import TestDetailPage from './components/pages/TestDetailPage'
import { Switch } from './components/ui/switch'
import { Label } from './components/ui/label'

function App() {
  return (
    <BrowserRouter>
      <Routes>
        {/* Preview mode route (no layout) */}
        <Route path="/preview" element={<PreviewModeWrapper />} />

        {/* Main app routes with layout */}
        <Route element={<MainLayout />}>
          <Route path="/" element={<DashboardPage />} />
          <Route path="/analyze" element={<AnalyzePage />} />
          <Route path="/tests" element={<TestsPage />} />
          <Route path="/tests/:testId" element={<TestDetailWrapper />} />
        </Route>

        {/* Redirect old paths */}
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </BrowserRouter>
  )
}

// Wrapper for preview mode to check URL params
function PreviewModeWrapper() {
  const [searchParams] = useSearchParams()
  const testId = searchParams.get('test')

  if (!testId) {
    return <Navigate to="/" replace />
  }

  return <PreviewMode testId={testId} />
}

// Wrapper for TestDetail to get testId from URL params
function TestDetailWrapper() {
  const { testId } = useParams<{ testId: string }>()
  const navigate = useNavigate()

  if (!testId) {
    return <Navigate to="/tests" replace />
  }

  return <TestDetailPage testId={testId} onBack={() => navigate('/tests')} />
}

// Preview mode component - renders ONLY the generated component
function PreviewMode({ testId }: { testId: string }) {
  const [Component, setComponent] = useState<React.ComponentType | null>(null)
  const [dimensions, setDimensions] = useState<{ width: number; height: number } | null>(null)
  const [showNavbar, setShowNavbar] = useState(false)

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

  // Auto-hide navbar after 3 seconds when visible
  useEffect(() => {
    if (showNavbar) {
      const timer = setTimeout(() => setShowNavbar(false), 3000)
      return () => clearTimeout(timer)
    }
  }, [showNavbar])

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
      {/* Hover area to show navbar */}
      <div
        className="fixed top-0 left-0 right-0 h-16 z-50"
        onMouseEnter={() => setShowNavbar(true)}
      >
        {/* Navbar - hidden by default, shows on hover */}
        <div className={`
          absolute top-0 left-0 right-0
          transition-all duration-300 ease-in-out
          ${showNavbar ? 'translate-y-0 opacity-100' : '-translate-y-full opacity-0'}
        `}>
          <div className="backdrop-blur-md bg-background/80 border-b border-border shadow-lg">
            <div className="container mx-auto px-4 py-3 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <button
                  onClick={() => window.history.back()}
                  className="inline-flex items-center justify-center h-9 px-4 rounded-md text-sm font-medium ring-offset-background transition-colors hover:bg-accent hover:text-accent-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
                >
                  <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="mr-2">
                    <path d="m12 19-7-7 7-7"/>
                    <path d="M19 12H5"/>
                  </svg>
                  Back
                </button>
                <button
                  onClick={() => window.location.href = '/'}
                  className="inline-flex items-center justify-center h-9 px-4 rounded-md text-sm font-medium ring-offset-background transition-colors hover:bg-accent hover:text-accent-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
                >
                  <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="mr-2">
                    <path d="m3 9 9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/>
                    <polyline points="9 22 9 12 15 12 15 22"/>
                  </svg>
                  Home
                </button>
                <button
                  onClick={() => window.location.href = `/tests/${testId}`}
                  className="inline-flex items-center justify-center h-9 px-4 rounded-md text-sm font-medium ring-offset-background transition-colors hover:bg-accent hover:text-accent-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
                >
                  <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="mr-2">
                    <path d="M2 12s3-7 10-7 10 7 10 7-3 7-10 7-10-7-10-7Z"/>
                    <circle cx="12" cy="12" r="3"/>
                  </svg>
                  Detail
                </button>
              </div>
              <div className="flex items-center gap-3">
                <span className="text-xs text-muted-foreground font-mono">
                  {testId}
                </span>
                <div className="flex items-center gap-2">
                  <Label htmlFor="version-switch" className="text-xs text-muted-foreground cursor-pointer">
                    {version === 'clean' ? 'Clean' : 'Fixed'}
                  </Label>
                  <Switch
                    id="version-switch"
                    checked={version === 'fixed'}
                    onCheckedChange={(checked: boolean) => {
                      const newVersion = checked ? 'fixed' : 'clean'
                      const url = new URL(window.location.href)
                      if (newVersion === 'fixed') {
                        url.searchParams.set('version', 'fixed')
                      } else {
                        url.searchParams.delete('version')
                      }
                      window.location.href = url.toString()
                    }}
                  />
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

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
