import React, { useState, useEffect } from 'react'
import { BrowserRouter, Routes, Route, Navigate, useSearchParams, useParams, useNavigate } from 'react-router-dom'
import './App.css'
import MainLayout from './components/layout/MainLayout'
import DashboardPage from './components/pages/DashboardPage'
import AnalyzePage from './components/pages/AnalyzePage'
import TestsPage from './components/pages/TestsPage'
import TestDetailPage from './components/pages/TestDetailPage'
import ResponsiveTestsPage from './components/pages/ResponsiveTestsPage'
import SettingsPage from './components/pages/SettingsPage'
import { Switch } from './components/ui/switch'
import { Label } from './components/ui/label'
import { ToggleGroup, ToggleGroupItem } from './components/ui/toggle-group'

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
          <Route path="/responsive-tests" element={<ResponsiveTestsPage />} />
          <Route path="/settings" element={<SettingsPage />} />
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
  const responsiveMergeId = searchParams.get('responsive')

  // Check for responsive merge preview
  if (responsiveMergeId) {
    return <ResponsivePreviewMode mergeId={responsiveMergeId} />
  }

  // Check for regular test preview
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
  const [displayMode, setDisplayMode] = useState<'web' | 'figma'>('web')

  // Get version from URL params (clean or fixed)
  const params = new URLSearchParams(window.location.search)
  const version = params.get('version') === 'fixed' ? 'fixed' : 'clean'

  useEffect(() => {
    // Load metadata to get dimensions
    import(`./generated/tests/${testId}/metadata.xml?raw`)
      .then((module) => {
        const xmlContent = module.default

        // Capture the first <frame> tag to get root dimensions
        const firstFrame = xmlContent.match(/<frame[^>]*>/)?.[0]

        if (firstFrame) {
          const widthMatch = firstFrame.match(/width="([\d.]+)"/)
          const heightMatch = firstFrame.match(/height="([\d.]+)"/)

          if (widthMatch && heightMatch) {
            setDimensions({
              width: Math.round(parseFloat(widthMatch[1])),
              height: Math.round(parseFloat(heightMatch[1]))
            })
          }
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

  // Auto-hide navbar after 5 seconds when visible
  useEffect(() => {
    if (showNavbar) {
      const timer = setTimeout(() => setShowNavbar(false), 5000)
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

              <div className="absolute left-1/2 -translate-x-1/2">
                <span className="text-xs text-muted-foreground font-mono">
                  {testId}
                </span>
              </div>

              <div className="flex items-center gap-4">
                <ToggleGroup
                  type="single"
                  value={displayMode}
                  onValueChange={(value) => {
                    if (value) setDisplayMode(value as 'web' | 'figma')
                  }}
                  className="inline-flex bg-background border border-border rounded-md p-1 gap-1"
                >
                  <ToggleGroupItem
                    value="web"
                    aria-label="Web mode"
                    className="text-xs px-2.5 py-1 data-[state=on]:bg-primary data-[state=on]:text-white data-[state=off]:hover:bg-accent data-[state=off]:hover:text-accent-foreground"
                  >
                    <span className="mr-1.5">💻</span>Web
                  </ToggleGroupItem>
                  <ToggleGroupItem
                    value="figma"
                    aria-label="Figma mode"
                    className="text-xs px-2.5 py-1 data-[state=on]:bg-primary data-[state=on]:text-white data-[state=off]:hover:bg-accent data-[state=off]:hover:text-accent-foreground"
                  >
                    <span className="mr-1.5">📐</span>Figma
                  </ToggleGroupItem>
                </ToggleGroup>

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
        width: displayMode === 'figma' ? `${dimensions.width}px` : '100%',
        ...(displayMode === 'figma' && { minHeight: `${dimensions.height}px` })
      }}>
        <Component />
      </div>
    </div>
  )
}

// Responsive Preview Mode component - renders merged responsive components
function ResponsivePreviewMode({ mergeId }: { mergeId: string }) {
  const [Component, setComponent] = useState<React.ComponentType | null>(null)
  const [metadata, setMetadata] = useState<any>(null)
  const [viewportWidth, setViewportWidth] = useState(1440)
  const [mode, setMode] = useState<'responsive' | 'full'>('responsive')
  const [showNavbar, setShowNavbar] = useState(false)
  const [activeBreakpoint, setActiveBreakpoint] = useState<'desktop' | 'tablet' | 'mobile'>('desktop')

  useEffect(() => {
    // Load metadata
    fetch(`/src/generated/responsive-screens/${mergeId}/responsive-metadata.json`)
      .then(res => res.json())
      .then(data => {
        setMetadata(data)
        setViewportWidth(data.breakpoints.desktop.width)
      })
      .catch(err => {
        console.error('Failed to load responsive metadata:', err)
      })

    // Load CSS
    const link = document.createElement('link')
    link.rel = 'stylesheet'
    link.href = `/src/generated/responsive-screens/${mergeId}/Page.css`
    link.id = `responsive-css-${mergeId}`
    document.head.appendChild(link)

    // Dynamic import
    import(`./generated/responsive-screens/${mergeId}/Page.tsx`)
      .then(module => setComponent(() => module.default))
      .catch(err => {
        console.error('Failed to load responsive component:', err)
      })

    // Cleanup
    return () => {
      document.getElementById(`responsive-css-${mergeId}`)?.remove()
    }
  }, [mergeId])

  // Update active breakpoint based on viewport width
  useEffect(() => {
    if (!metadata) return

    const breakpoints = metadata.breakpoints
    if (viewportWidth <= breakpoints.mobile.width) {
      setActiveBreakpoint('mobile')
    } else if (viewportWidth <= breakpoints.tablet.width) {
      setActiveBreakpoint('tablet')
    } else {
      setActiveBreakpoint('desktop')
    }
  }, [viewportWidth, metadata])

  // Auto-hide navbar after 5 seconds when visible
  useEffect(() => {
    if (showNavbar) {
      const timer = setTimeout(() => setShowNavbar(false), 5000)
      return () => clearTimeout(timer)
    }
  }, [showNavbar])

  if (!Component || !metadata) {
    return <div>Loading...</div>
  }

  const { desktop, tablet, mobile } = metadata.breakpoints

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
            <div className="container mx-auto px-4 py-3">
              {/* Top row: Navigation buttons and ID */}
              <div className="flex items-center justify-between mb-3">
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
                </div>

                <div className="absolute left-1/2 -translate-x-1/2">
                  <span className="text-xs text-muted-foreground font-mono">
                    {mergeId}
                  </span>
                </div>

                <div className="flex items-center gap-2">
                  <Label htmlFor="mode-switch" className="text-xs text-muted-foreground cursor-pointer">
                    {mode === 'responsive' ? '📱 Responsive' : '🖥️ Full Width'}
                  </Label>
                  <Switch
                    id="mode-switch"
                    checked={mode === 'full'}
                    onCheckedChange={(checked: boolean) => {
                      setMode(checked ? 'full' : 'responsive')
                    }}
                  />
                </div>
              </div>

              {/* Bottom row: Breakpoint controls */}
              <div className="flex items-center justify-between">
                {/* Preset breakpoint buttons */}
                <div className="flex items-center gap-2">
                  <span className="text-xs text-muted-foreground mr-2">Presets:</span>
                  <button
                    onClick={() => setViewportWidth(desktop.width)}
                    className={`px-3 py-1.5 rounded text-xs font-medium transition-colors ${
                      activeBreakpoint === 'desktop'
                        ? 'bg-blue-500 text-white'
                        : 'bg-background hover:bg-accent border border-border'
                    }`}
                  >
                    💻 Desktop ({desktop.width}px)
                  </button>
                  <button
                    onClick={() => setViewportWidth(tablet.width)}
                    className={`px-3 py-1.5 rounded text-xs font-medium transition-colors ${
                      activeBreakpoint === 'tablet'
                        ? 'bg-orange-500 text-white'
                        : 'bg-background hover:bg-accent border border-border'
                    }`}
                  >
                    📱 Tablet ({tablet.width}px)
                  </button>
                  <button
                    onClick={() => setViewportWidth(mobile.width)}
                    className={`px-3 py-1.5 rounded text-xs font-medium transition-colors ${
                      activeBreakpoint === 'mobile'
                        ? 'bg-green-500 text-white'
                        : 'bg-background hover:bg-accent border border-border'
                    }`}
                  >
                    📱 Mobile ({mobile.width}px)
                  </button>
                </div>

                {/* Viewport slider */}
                <div className="flex items-center gap-3">
                  <span className="text-xs text-muted-foreground">320px</span>
                  <input
                    type="range"
                    min="320"
                    max="1920"
                    value={viewportWidth}
                    onChange={(e) => setViewportWidth(parseInt(e.target.value))}
                    className="w-48 h-2 bg-background rounded-lg appearance-none cursor-pointer slider"
                    style={{
                      background: `linear-gradient(to right,
                        #10b981 0%,
                        #10b981 ${((mobile.width - 320) / (1920 - 320)) * 100}%,
                        #f97316 ${((mobile.width - 320) / (1920 - 320)) * 100}%,
                        #f97316 ${((tablet.width - 320) / (1920 - 320)) * 100}%,
                        #3b82f6 ${((tablet.width - 320) / (1920 - 320)) * 100}%,
                        #3b82f6 100%
                      )`
                    }}
                  />
                  <span className="text-xs text-muted-foreground">1920px</span>
                  <span className="text-xs font-mono font-bold min-w-[60px] text-right">
                    {viewportWidth}px
                  </span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      <div style={{
        width: mode === 'responsive' ? `${viewportWidth}px` : '100%',
        transition: 'width 0.3s ease-in-out',
        minHeight: '100vh'
      }}>
        <Component />
      </div>
    </div>
  )
}

export default App
