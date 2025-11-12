import { useState, useEffect } from 'react'
import { BrowserRouter, Routes, Route, Navigate, useSearchParams, useParams, useNavigate } from 'react-router-dom'
import './App.css'
import MainLayout from './components/layout/MainLayout'
import DashboardPage from './components/pages/DashboardPage'
import ExportFigmaPage from './components/pages/ExportFigmaPage'
import ExportFigmaDetailPage from './components/pages/ExportFigmaDetailPage'
import ExportFigmaPreviewPage from './components/pages/ExportFigmaPreviewPage'
import ResponsiveMergesPage from './components/pages/ResponsiveMergesPage'
import ResponsiveMergeDetailPage from './components/pages/ResponsiveMergeDetailPage'
import ResponsivePreviewPage from './components/pages/ResponsivePreviewPage'
import PuckEditorPage from './components/pages/PuckEditorPage'
import PuckRenderPage from './components/pages/PuckRenderPage'
import SettingsPage from './components/pages/SettingsPage'
import { PreviewNavbar } from './components/common/PreviewNavbar'

function App() {
  return (
    <BrowserRouter>
      <Routes>
        {/* Preview mode route (no layout) */}
        <Route path="/preview" element={<PreviewModeWrapper />} />

        {/* Export Figma Preview iframe route (no layout) */}
        <Route path="/export_figma/:exportId/preview" element={<ExportFigmaPreviewPage />} />

        {/* Responsive Preview iframe route (no layout) */}
        <Route path="/responsive-merges/:mergeId/preview" element={<ResponsivePreviewPage />} />

        {/* Puck Editor route (no layout, fullscreen) */}
        <Route path="/responsive-merges/:mergeId/puck-editor" element={<PuckEditorPage />} />

        {/* Puck Render/Preview route (no layout) */}
        <Route path="/responsive-merges/:mergeId/puck-preview" element={<PuckRenderPage />} />

        {/* Main app routes with layout */}
        <Route element={<MainLayout />}>
          <Route path="/" element={<DashboardPage />} />
          <Route path="/export_figma" element={<ExportFigmaPage />} />
          <Route path="/export_figma/:exportId" element={<ExportFigmaDetailWrapper />} />
          <Route path="/responsive-merges" element={<ResponsiveMergesPage />} />
          <Route path="/responsive-merges/:mergeId" element={<ResponsiveMergeDetailPage />} />
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
  const exportId = searchParams.get('export')
  const responsiveMergeId = searchParams.get('responsive')

  // Check for responsive merge preview
  if (responsiveMergeId) {
    return <ResponsivePreviewMode mergeId={responsiveMergeId} />
  }

  // Check for regular export preview
  if (!exportId) {
    return <Navigate to="/" replace />
  }

  return <PreviewMode exportId={exportId} />
}

// Wrapper for ExportFigmaDetail to get exportId from URL params
function ExportFigmaDetailWrapper() {
  const { exportId } = useParams<{ exportId: string }>()
  const navigate = useNavigate()

  if (!exportId) {
    return <Navigate to="/export_figma" replace />
  }

  return <ExportFigmaDetailPage exportId={exportId} onBack={() => navigate('/export_figma')} />
}

// Preview mode component - renders component via iframe with responsive controls
function PreviewMode({ exportId }: { exportId: string }) {
  const [dimensions, setDimensions] = useState<{ width: number; height: number } | null>(null)
  const [viewportWidth, setViewportWidth] = useState(1440)
  const [iframeHeight, setIframeHeight] = useState<number>(800)
  const [mode, setMode] = useState<'responsive' | 'full'>('responsive')
  const [showNavbar, setShowNavbar] = useState(false)

  // Get version from URL params (clean or fixed)
  const params = new URLSearchParams(window.location.search)
  const version = params.get('version') === 'fixed' ? 'fixed' : 'clean'

  useEffect(() => {
    // Load metadata to get default dimensions
    fetch(`/src/generated/export_figma/${exportId}/metadata.xml`)
      .then((response) => response.text())
      .then((xmlContent) => {
        const firstFrame = xmlContent.match(/<frame[^>]*>/)?.[0]

        if (firstFrame) {
          const widthMatch = firstFrame.match(/width="([\d.]+)"/)
          const heightMatch = firstFrame.match(/height="([\d.]+)"/)

          if (widthMatch && heightMatch) {
            const width = Math.round(parseFloat(widthMatch[1]))
            const height = Math.round(parseFloat(heightMatch[1]))
            setDimensions({ width, height })
            setViewportWidth(width)
            setIframeHeight(height)
          }
        }
      })
      .catch((err) => {
        console.error('Failed to load metadata:', err)
      })
  }, [exportId])

  // Listen for iframe resize messages
  useEffect(() => {
    const handleMessage = (e: MessageEvent) => {
      if (e.data.type === 'iframe-resize' && typeof e.data.height === 'number') {
        setIframeHeight(e.data.height)
      }
    }
    window.addEventListener('message', handleMessage)
    return () => window.removeEventListener('message', handleMessage)
  }, [])

  // Auto-hide navbar after 5 seconds when visible
  useEffect(() => {
    if (showNavbar) {
      const timer = setTimeout(() => setShowNavbar(false), 5000)
      return () => clearTimeout(timer)
    }
  }, [showNavbar])

  const handleVersionChange = (newVersion: 'clean' | 'fixed') => {
    const url = new URL(window.location.href)
    if (newVersion === 'fixed') {
      url.searchParams.set('version', 'fixed')
    } else {
      url.searchParams.delete('version')
    }
    window.location.href = url.toString()
  }

  if (!dimensions) {
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
      <PreviewNavbar
        id={exportId}
        mode={mode}
        onModeChange={setMode}
        version={version}
        onVersionChange={handleVersionChange}
        detailUrl={`/export_figma/${exportId}`}
        showNavbar={showNavbar}
        onShowNavbar={setShowNavbar}
        viewportWidth={viewportWidth}
        onViewportChange={setViewportWidth}
        showColoredBreakpoints={true}
      />

      <div
        className="bg-white shadow-lg overflow-hidden"
        style={{
          width: mode === 'responsive' ? `${viewportWidth}px` : '100%',
          minHeight: `${iframeHeight}px`,
          transition: 'width 0.3s ease-in-out'
        }}
      >
        <iframe
          src={`/export_figma/${exportId}/preview?version=${version}`}
          className="w-full border-0"
          style={{ height: `${iframeHeight}px` }}
          title="Export Preview"
        />
      </div>
    </div>
  )
}

// Responsive Preview Mode component - renders merged responsive components via iframe
function ResponsivePreviewMode({ mergeId }: { mergeId: string }) {
  const [metadata, setMetadata] = useState<any>(null)
  const [viewportWidth, setViewportWidth] = useState(1440)
  const [iframeHeight, setIframeHeight] = useState<number>(800)
  const [mode, setMode] = useState<'responsive' | 'full'>('responsive')
  const [showNavbar, setShowNavbar] = useState(false)

  useEffect(() => {
    // Load metadata to get default viewport width
    fetch(`/src/generated/responsive-screens/${mergeId}/responsive-metadata.json`)
      .then(res => res.json())
      .then(data => {
        setMetadata(data)
        setViewportWidth(data.breakpoints.desktop.width)
        setIframeHeight(data.breakpoints.desktop.height || 800)
      })
      .catch(err => {
        console.error('Failed to load responsive metadata:', err)
      })
  }, [mergeId])

  // Listen for iframe resize messages
  useEffect(() => {
    const handleMessage = (e: MessageEvent) => {
      if (e.data.type === 'iframe-resize' && typeof e.data.height === 'number') {
        setIframeHeight(e.data.height)
      }
    }
    window.addEventListener('message', handleMessage)
    return () => window.removeEventListener('message', handleMessage)
  }, [])

  // Auto-hide navbar after 5 seconds when visible
  useEffect(() => {
    if (showNavbar) {
      const timer = setTimeout(() => setShowNavbar(false), 5000)
      return () => clearTimeout(timer)
    }
  }, [showNavbar])

  if (!metadata) {
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
      <PreviewNavbar
        id={mergeId}
        mode={mode}
        onModeChange={setMode}
        detailUrl={`/responsive-merges/${mergeId}`}
        showNavbar={showNavbar}
        onShowNavbar={setShowNavbar}
        viewportWidth={viewportWidth}
        onViewportChange={setViewportWidth}
        showColoredBreakpoints={true}
      />

      <div
        className="bg-white shadow-lg overflow-hidden"
        style={{
          width: mode === 'responsive' ? `${viewportWidth}px` : '100%',
          minHeight: `${iframeHeight}px`,
          transition: 'width 0.3s ease-in-out'
        }}
      >
        <iframe
          src={`/responsive-merges/${mergeId}/preview`}
          className="w-full border-0"
          style={{ height: `${iframeHeight}px` }}
          title="Responsive Preview"
        />
      </div>
    </div>
  )
}

export default App
