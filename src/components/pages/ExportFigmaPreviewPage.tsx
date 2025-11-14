import { useState, useEffect } from 'react'
import { useParams, useSearchParams } from 'react-router-dom'

/**
 * ExportFigmaPreviewPage - Renders only the generated component without layout
 * Used as iframe content in PreviewMode
 */
export default function ExportFigmaPreviewPage() {
  const { exportId } = useParams<{ exportId: string }>()
  const [searchParams] = useSearchParams()
  const version = searchParams.get('version') === 'fixed' ? 'fixed' : 'clean'

  const [Component, setComponent] = useState<React.ComponentType | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [dimensions, setDimensions] = useState<{ width: number; height: number } | null>(null)

  useEffect(() => {
    if (!exportId) {
      setError('Export ID is required')
      setLoading(false)
      return
    }

    loadComponent()
  }, [exportId, version])

  async function loadComponent() {
    try {
      setLoading(true)
      setError(null)

      // Load metadata.xml to get dimensions
      try {
        const metadataResponse = await fetch(`/src/generated/export_figma/${exportId}/metadata.xml`)
        if (metadataResponse.ok) {
          const metadataText = await metadataResponse.text()
          const parser = new DOMParser()
          const xmlDoc = parser.parseFromString(metadataText, 'text/xml')
          const root = xmlDoc.documentElement
          const width = parseInt(root.getAttribute('width') || '0')
          const height = parseInt(root.getAttribute('height') || '0')
          if (width && height) {
            setDimensions({ width, height })
          }
        }
      } catch (e) {
        console.warn('Failed to load metadata.xml:', e)
      }

      // Load CSS
      const link = document.createElement('link')
      link.rel = 'stylesheet'
      link.href = `/src/generated/export_figma/${exportId}/Component-${version}.css`
      link.id = `export-css-${exportId}`
      document.head.appendChild(link)

      // Dynamically import the generated component
      const module = await import(`../../generated/export_figma/${exportId}/Component-${version}.tsx`)
      setComponent(() => module.default)
      setLoading(false)

      // Cleanup function
      return () => {
        const existingLink = document.getElementById(`export-css-${exportId}`)
        if (existingLink) {
          document.head.removeChild(existingLink)
        }
      }
    } catch (err) {
      console.error('Failed to load component:', err)
      setError(err instanceof Error ? err.message : 'Failed to load component')
      setLoading(false)
    }
  }

  // Auto-resize iframe based on content height
  useEffect(() => {
    if (!Component) return

    const sendHeight = () => {
      const height = document.body.scrollHeight
      window.parent.postMessage({ type: 'iframe-resize', height }, '*')
    }

    // Send height after render
    const timer = setTimeout(sendHeight, 100)

    // Observe changes (images loading, dynamic content)
    const observer = new ResizeObserver(sendHeight)
    observer.observe(document.body)

    return () => {
      clearTimeout(timer)
      observer.disconnect()
    }
  }, [Component])

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <div className="text-center">
          <div className="mx-auto mb-4 h-12 w-12 animate-spin rounded-full border-b-2 border-primary"></div>
          <p className="text-muted-foreground">Loading component...</p>
        </div>
      </div>
    )
  }

  if (error || !Component) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <div className="max-w-md text-center">
          <div className="mb-4 text-6xl">❌</div>
          <h3 className="mb-2 text-xl font-semibold">Error loading component</h3>
          <p className="text-muted-foreground">{error || 'Component not found'}</p>
        </div>
      </div>
    )
  }

  // Wrapper flex pour que flex-1 sur le composant racine fonctionne
  // Utilise les dimensions de Figma pour définir la hauteur minimale
  return (
    <div style={{
      display: 'flex',
      flexDirection: 'column',
      minHeight: dimensions?.height ? `${dimensions.height}px` : '100vh'
    }}>
      <div style={{ flex: '1 1 auto', display: 'flex', flexDirection: 'column' }}>
        <Component />
      </div>
    </div>
  )
}
