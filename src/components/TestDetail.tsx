/**
 * TestDetail - Vue détaillée d'un test MCP
 *
 * 4 onglets :
 * 1. Preview - Rendu React du composant généré
 * 2. Code - Code source Component-fixed.tsx avec syntax highlighting
 * 3. Rapport - Rapport HTML interactif (report.html)
 * 4. Technical Analysis - Documentation markdown technique (analysis.md)
 */

import React, { useState, useEffect, Suspense, ComponentType } from 'react'
import { Prism as SyntaxHighlighter } from 'react-syntax-highlighter'
import { vscDarkPlus } from 'react-syntax-highlighter/dist/esm/styles/prism'
import { useTranslation } from '../i18n/I18nContext'

type Tab = 'preview' | 'code' | 'report' | 'technical'

interface Metadata {
  fileName?: string
  layerName?: string
  timestamp?: string | number  // Peut être une string ISO ou un nombre (secondes Unix)
  figmaUrl?: string
  figmaNodeId?: string
  componentName?: string
  dimensions?: {
    width: number
    height: number
  }
  stats?: {
    totalNodes?: number
    sectionsDetected?: number
    imagesOrganized?: number
    totalFixes?: number
    classesOptimized?: number
    fontsConverted?: number
  }
}

interface TestDetailProps {
  testId: string
  onBack: () => void
}

// Fonction utilitaire pour formater les dates/timestamps
function formatDate(timestamp: string | number) {
  // Si le timestamp est un nombre avec moins de 13 chiffres, c'est en secondes → convertir en millisecondes
  const dateValue = typeof timestamp === 'number' && timestamp < 10000000000
    ? timestamp * 1000
    : timestamp

  return new Date(dateValue).toLocaleString('fr-FR', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit'
  })
}

export default function TestDetail({ testId, onBack }: TestDetailProps) {
  const { t } = useTranslation()
  const [activeTab, setActiveTab] = useState<Tab>('preview')
  const [metadata, setMetadata] = useState<Metadata | null>(null)
  const [analysis, setAnalysis] = useState<string>('')
  const [componentCode, setComponentCode] = useState<string>('')
  const [loading, setLoading] = useState<boolean>(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    loadTestData()
  }, [testId])

  const loadTestData = async () => {
    try {
      setLoading(true)

      // Load metadata
      const metadataModule = await import(`../generated/tests/${testId}/metadata.json`)
      let metadata = metadataModule.default

      // Load layerName from metadata.xml
      try {
        const xmlModule = await import(`../generated/tests/${testId}/metadata.xml?raw`)
        const xmlContent = xmlModule.default
        const frameMatch = xmlContent.match(/<frame[^>]+name="([^"]+)"/)
        if (frameMatch) {
          metadata = { ...metadata, layerName: frameMatch[1] }
        }
      } catch (e) {
        console.warn('Could not load metadata.xml')
      }

      setMetadata(metadata)

      // Load analysis markdown
      const analysisModule = await import(`../generated/tests/${testId}/analysis.md?raw`)
      setAnalysis(analysisModule.default)

      // Load component code (Component-fixed.tsx ou .jsx)
      try {
        const codeModule = await import(`../generated/tests/${testId}/Component-fixed.tsx?raw`)
        setComponentCode(codeModule.default)
      } catch (e) {
        // Fallback sur Component-fixed.jsx
        try {
          const codeModule = await import(`../generated/tests/${testId}/Component-fixed.jsx?raw`)
          setComponentCode(codeModule.default)
        } catch (e2) {
          // Fallback sur Component.tsx
          try {
            const codeModule = await import(`../generated/tests/${testId}/Component.tsx?raw`)
            setComponentCode(codeModule.default)
          } catch (e3) {
            // Fallback sur Component.jsx
            try {
              const codeModule = await import(`../generated/tests/${testId}/Component.jsx?raw`)
              setComponentCode(codeModule.default)
            } catch (err) {
              console.warn('No component code found')
            }
          }
        }
      }

      setLoading(false)
    } catch (err) {
      console.error('Error loading test:', err)
      setError(err.message)
      setLoading(false)
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-purple-600 mx-auto mb-4"></div>
          <p className="text-gray-600">{t('detail.loading')}</p>
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center max-w-md">
          <div className="text-6xl mb-4">❌</div>
          <h3 className="text-xl font-semibold text-gray-900 mb-2">
            {t('detail.error.title')}
          </h3>
          <p className="text-gray-600 mb-6">{error}</p>
          <button
            onClick={onBack}
            className="px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700"
          >
            {t('detail.error.back')}
          </button>
        </div>
      </div>
    )
  }

  // Extract nodeId from testId for display
  const nodeIdDisplay = (() => {
    const match = testId?.match(/^node-(.+)-\d+$/)
    return match ? match[1] : testId?.replace('node-', '')
  })()

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-gradient-to-br from-slate-100 via-gray-100 to-slate-50 border-b border-slate-300">
        <div className="max-w-7xl mx-auto px-6 py-6">
          {/* Back button + Title row */}
          <div className="flex items-start justify-between mb-4">
            <div className="flex items-start gap-4">
              <button
                onClick={onBack}
                className="mt-1 p-2.5 hover:bg-white bg-white/70 backdrop-blur-sm rounded-xl transition-all shadow-sm hover:shadow border border-slate-200"
                title="Retour"
              >
                <svg className="w-5 h-5 text-gray-700" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                </svg>
              </button>
              <div className="flex-1">
                <div className="flex items-center gap-3 mb-2">
                  <h1 className="text-3xl font-bold text-gray-900">
                    {metadata?.layerName || metadata?.fileName || 'Test'}
                  </h1>
                  {metadata?.figmaNodeId && (
                    <span className="px-3 py-1 bg-black/70 backdrop-blur-sm text-white text-xs rounded-lg font-mono">
                      #{nodeIdDisplay}
                    </span>
                  )}
                </div>
                <div className="flex items-center gap-3 text-sm text-gray-600">
                  <span className="flex items-center gap-1.5">
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                    {metadata?.timestamp && formatDate(metadata.timestamp)}
                  </span>
                  {metadata?.dimensions && (
                    <span className="flex items-center gap-1.5">
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 8V4m0 0h4M4 4l5 5m11-1V4m0 0h-4m4 0l-5 5M4 16v4m0 0h4m-4 0l5-5m11 5l-5-5m5 5v-4m0 4h-4" />
                      </svg>
                      {metadata.dimensions.width} × {metadata.dimensions.height}
                    </span>
                  )}
                  <span className="text-[10px] text-gray-400 font-mono ml-2">{testId}</span>
                </div>
              </div>
            </div>

            <div className="flex items-center gap-3">
              <a
                href={`http://localhost:5173/?preview=true&test=${testId}`}
                target="_blank"
                rel="noopener noreferrer"
                className="px-4 py-2.5 text-sm font-medium bg-gradient-to-r from-blue-600 to-blue-700 hover:from-blue-700 hover:to-blue-800 text-white rounded-xl transition-all flex items-center gap-2 shadow-md hover:shadow-lg"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                </svg>
                Preview
              </a>
              <a
                href={metadata?.figmaUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="px-4 py-2.5 text-sm font-medium bg-gradient-to-r from-purple-600 to-purple-700 hover:from-purple-700 hover:to-purple-800 text-white rounded-xl transition-all flex items-center gap-2 shadow-md hover:shadow-lg"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                </svg>
                Figma
              </a>
            </div>
          </div>

          {/* Stats bar */}
          {metadata?.stats && (
            <div className="flex items-center gap-3 mt-4 pt-4 border-t border-slate-300/50">
              {metadata.stats.totalNodes !== undefined && (
                <div className="flex items-center gap-2 px-3 py-2 bg-white/80 backdrop-blur-sm rounded-lg border border-slate-200 shadow-sm">
                  <span className="text-gray-400">📦</span>
                  <span className="text-sm font-medium text-gray-700">{metadata.stats.totalNodes}</span>
                  <span className="text-xs text-gray-500">{t('common.nodes')}</span>
                </div>
              )}
              {metadata.stats.sectionsDetected !== undefined && metadata.stats.sectionsDetected > 0 && (
                <div className="flex items-center gap-2 px-3 py-2 bg-white/80 backdrop-blur-sm rounded-lg border border-slate-200 shadow-sm">
                  <span className="text-gray-400">📑</span>
                  <span className="text-sm font-medium text-gray-700">{metadata.stats.sectionsDetected}</span>
                  <span className="text-xs text-gray-500">{t('common.sections')}</span>
                </div>
              )}
              {metadata.stats.imagesOrganized !== undefined && metadata.stats.imagesOrganized > 0 && (
                <div className="flex items-center gap-2 px-3 py-2 bg-white/80 backdrop-blur-sm rounded-lg border border-slate-200 shadow-sm">
                  <span className="text-gray-400">🖼️</span>
                  <span className="text-sm font-medium text-gray-700">{metadata.stats.imagesOrganized}</span>
                  <span className="text-xs text-gray-500">{t('common.images')}</span>
                </div>
              )}
              {(metadata.stats.totalFixes !== undefined || metadata.stats.classesOptimized !== undefined) && (
                <div className="flex items-center gap-2 px-3 py-2 bg-white/80 backdrop-blur-sm rounded-lg border border-slate-200 shadow-sm">
                  <span className="text-gray-400">⚡</span>
                  <span className="text-sm font-medium text-gray-700">
                    {metadata.stats.totalFixes || metadata.stats.classesOptimized || 0}
                  </span>
                  <span className="text-xs text-gray-500">{t('common.fixes')}</span>
                </div>
              )}
            </div>
          )}
        </div>
      </header>

      {/* Tabs */}
      <nav className="bg-white border-b border-gray-200">
        <div className="max-w-7xl mx-auto px-6">
          <div className="flex space-x-8">
            <button
              onClick={() => setActiveTab('preview')}
              className={`py-4 px-1 border-b-2 font-medium text-sm transition-colors ${
                activeTab === 'preview'
                  ? 'border-purple-500 text-purple-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
              }`}
            >
              {t('detail.tabs.preview')}
            </button>
            <button
              onClick={() => setActiveTab('code')}
              className={`py-4 px-1 border-b-2 font-medium text-sm transition-colors ${
                activeTab === 'code'
                  ? 'border-purple-500 text-purple-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
              }`}
            >
              {t('detail.tabs.code')}
            </button>
            <button
              onClick={() => setActiveTab('report')}
              className={`py-4 px-1 border-b-2 font-medium text-sm transition-colors ${
                activeTab === 'report'
                  ? 'border-purple-500 text-purple-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
              }`}
            >
              {t('detail.tabs.report')}
            </button>
            <button
              onClick={() => setActiveTab('technical')}
              className={`py-4 px-1 border-b-2 font-medium text-sm transition-colors ${
                activeTab === 'technical'
                  ? 'border-purple-500 text-purple-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
              }`}
            >
              {t('detail.tabs.technical')}
            </button>
          </div>
        </div>
      </nav>

      {/* Content */}
      <main className={activeTab === 'preview' ? 'w-full py-8' : 'max-w-7xl mx-auto px-6 py-8'}>
        {activeTab === 'preview' && (
          <PreviewTab testId={testId} componentName={metadata?.componentName} dimensions={metadata?.dimensions} />
        )}

        {activeTab === 'code' && (
          <CodeTab componentCode={componentCode} testId={testId} />
        )}

        {activeTab === 'report' && (
          <ReportTab testId={testId} />
        )}

        {activeTab === 'technical' && (
          <TechnicalAnalysisTab analysis={analysis} />
        )}
      </main>
    </div>
  )
}

/**
 * TAB 1: Preview - Rendu React du composant généré
 */
interface PreviewTabProps {
  testId: string
  componentName?: string
  dimensions?: {
    width: number
    height: number
  }
}

function PreviewTab({ testId, componentName, dimensions }: PreviewTabProps) {
  const { t } = useTranslation()
  const [Component, setComponent] = useState<ComponentType | null>(null)
  const [loading, setLoading] = useState<boolean>(true)
  const [error, setError] = useState<string | null>(null)

  // Responsive viewport simulator - use dimensions if available, otherwise default to 1200
  const defaultWidth = dimensions?.width || 1200
  const [viewportWidth, setViewportWidth] = useState<number>(defaultWidth)
  const [customInput, setCustomInput] = useState<string>(defaultWidth.toString())
  const minWidth = 320
  const maxWidth = 1920

  useEffect(() => {
    loadComponent()
  }, [testId])

  // Charger le CSS du composant généré
  useEffect(() => {
    const link = document.createElement('link')
    link.rel = 'stylesheet'
    link.href = `/src/generated/tests/${testId}/Component-fixed.css`
    link.id = `test-css-${testId}`
    document.head.appendChild(link)

    return () => {
      const existingLink = document.getElementById(`test-css-${testId}`)
      if (existingLink) {
        document.head.removeChild(existingLink)
      }
    }
  }, [testId])

  // Sync customInput with viewportWidth when changed by presets or slider
  useEffect(() => {
    setCustomInput(viewportWidth.toString())
  }, [viewportWidth])

  const loadComponent = async () => {
    try {
      setLoading(true)

      // Import dynamique du composant - essayer d'abord la version fixed (.tsx puis .jsx)
      let module: any
      try {
        module = await import(`../generated/tests/${testId}/Component-fixed.tsx`)
      } catch (e) {
        try {
          module = await import(`../generated/tests/${testId}/Component-fixed.jsx`)
        } catch (e2) {
          try {
            module = await import(`../generated/tests/${testId}/Component.tsx`)
          } catch (e3) {
            // Fallback final sur Component.jsx
            module = await import(`../generated/tests/${testId}/Component.jsx`)
          }
        }
      }
      setComponent(() => module.default)

      setLoading(false)
    } catch (err) {
      console.error('Error loading component:', err)
      setError(err.message)
      setLoading(false)
    }
  }

  const presets = [
    ...(dimensions ? [{ name: 'Native', width: dimensions.width, icon: '🎯' }] : []),
    { name: 'Mobile', width: 375, icon: '📱' },
    { name: 'Tablet', width: 768, icon: '📱' },
    { name: 'Desktop', width: 1200, icon: '💻' },
    { name: 'Large', width: 1920, icon: '🖥️' }
  ]

  // Check if current width matches any preset
  const isCustomWidth = !presets.some(preset => preset.width === viewportWidth)

  const handleCustomWidthChange = (value: string) => {
    setCustomInput(value)
    const numValue = parseInt(value)
    if (!isNaN(numValue) && numValue >= minWidth && numValue <= maxWidth) {
      setViewportWidth(numValue)
    } else if (value === '') {
      // Allow clearing the field
      setCustomInput('')
    }
  }

  if (loading) {
    return (
      <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-12 text-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-purple-600 mx-auto mb-4"></div>
        <p className="text-gray-600">{t('detail.preview.loading_component')}</p>
      </div>
    )
  }

  if (error) {
    return (
      <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-12 text-center">
        <div className="text-6xl mb-4">⚠️</div>
        <h3 className="text-xl font-semibold text-gray-900 mb-2">
          {t('detail.preview.error_title')}
        </h3>
        <p className="text-gray-600 mb-4">{error}</p>
        <p className="text-sm text-gray-500">
          {t('detail.preview.error_text')}
        </p>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Info banner */}
      <div className="max-w-7xl mx-auto px-6">
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
          <div className="flex items-start gap-3">
            <div className="text-blue-500 text-xl">ℹ️</div>
            <div className="text-sm text-blue-900">
              <p className="font-semibold mb-1">{t('detail.preview.banner_title')}</p>
              <p className="text-blue-800">
                {t('detail.preview.banner_text')}
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Responsive Controls - Sticky */}
      <div className="sticky top-0 z-10 bg-gray-50 py-4 shadow-sm">
        <div className="max-w-7xl mx-auto px-6">
          <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-semibold text-gray-900">{t('detail.preview.responsive_test')}</h3>
              <div className="flex items-center gap-2">
                {dimensions && viewportWidth === dimensions.width && (
                  <span className="text-sm bg-green-100 text-green-800 px-2 py-1 rounded flex items-center gap-1">
                    <span>🎯</span> {t('detail.preview.native')}
                  </span>
                )}
                <div className="text-sm font-mono bg-purple-100 text-purple-800 px-3 py-1.5 rounded">
                  {viewportWidth}px
                </div>
              </div>
            </div>

          {/* Presets */}
          <div className="flex gap-2 mb-4 flex-wrap items-center">
            {presets.map((preset) => (
              <button
                key={preset.name}
                onClick={() => setViewportWidth(preset.width)}
                className={`px-3 py-2 text-sm rounded-lg border transition-all ${
                  viewportWidth === preset.width
                    ? 'bg-purple-600 text-white border-purple-600'
                    : 'bg-white text-gray-700 border-gray-300 hover:border-purple-400'
                }`}
              >
                {preset.icon} {preset.name} ({preset.width}px)
              </button>
            ))}

            {/* Custom width input */}
            <div className="flex items-center gap-2">
              <div className={`flex items-center border rounded-lg transition-all bg-white ${
                isCustomWidth
                  ? 'border-purple-600 ring-2 ring-purple-200'
                  : 'border-gray-300'
              }`}>
                <span className="pl-3 pr-1 text-gray-500 text-sm">✏️</span>
                <input
                  type="text"
                  value={customInput}
                  onChange={(e) => handleCustomWidthChange(e.target.value)}
                  placeholder="Custom"
                  className="w-16 px-2 py-2 text-sm outline-none"
                />
                <span className="pr-3 pl-1 text-gray-500 text-xs">px</span>
              </div>
            </div>
          </div>

          {/* Slider */}
          <div className="space-y-2">
            <input
              type="range"
              min={minWidth}
              max={maxWidth}
              value={viewportWidth}
              onChange={(e) => setViewportWidth(Number(e.target.value))}
              className="w-full h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer accent-purple-600"
            />
            <div className="flex justify-between text-xs text-gray-500">
              <span>{minWidth}px</span>
              <span>{maxWidth}px</span>
            </div>
          </div>
          </div>
        </div>
      </div>

      {/* Component Render - Full width container */}
      <div className="bg-white border-t border-b border-gray-200 overflow-hidden">
        <div className="bg-gray-50 border-b border-gray-200 px-6 py-3 flex items-center justify-between">
          <h3 className="font-semibold text-gray-900">
            {t('detail.preview.component_label')} {componentName}
          </h3>
          <div className="text-xs text-gray-500">
            {t('detail.preview.react_tailwind')}
          </div>
        </div>

        {/* Full width viewport simulator */}
        <div className="min-h-[600px] bg-gradient-to-br from-gray-50 to-gray-100 flex justify-center items-start py-8">
          <div
            className="bg-white shadow-xl transition-all duration-300 ease-in-out overflow-auto"
            style={{
              width: `${viewportWidth}px`,
              maxWidth: '100%',
              minHeight: '500px'
            }}
          >
            {Component && (
              <Suspense fallback={<div className="p-8 text-center text-gray-500">Loading component...</div>}>
                {dimensions ? (
                  <div style={{
                    width: `${dimensions.width}px`,
                    height: `${dimensions.height}px`,
                    margin: '0 auto'
                  }}>
                    <Component />
                  </div>
                ) : (
                  <Component />
                )}
              </Suspense>
            )}
          </div>
        </div>
      </div>

      {/* Tips */}
      <div className="max-w-7xl mx-auto px-6">
        <div className="bg-green-50 border border-green-200 rounded-lg p-4">
          <p className="text-sm font-semibold text-green-900 mb-2">{t('detail.preview.tips_title')}</p>
          <ul className="text-sm text-green-800 space-y-1">
            {dimensions && (
              <li>• {t('detail.preview.tips.0', { width: dimensions.width.toString(), height: dimensions.height.toString() })}</li>
            )}
            <li>• {t('detail.preview.tips.1')}</li>
            <li>• {t('detail.preview.tips.2')}</li>
            <li>• {t('detail.preview.tips.3')}</li>
            <li>• {t('detail.preview.tips.4')}</li>
          </ul>
        </div>
      </div>
    </div>
  )
}

/**
 * TAB 2: Code - Navigation entre tous les fichiers
 */
interface CodeTabProps {
  componentCode: string
  testId: string
}

interface CodeFile {
  name: string
  content: string
  type: 'tsx' | 'css'
  icon: string
}

function CodeTab({ componentCode, testId }: CodeTabProps) {
  const { t } = useTranslation()
  const [files, setFiles] = useState<CodeFile[]>([])
  const [selectedIndex, setSelectedIndex] = useState(0)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    loadAllFiles()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [testId])

  const loadAllFiles = async () => {
    try {
      const fileList: CodeFile[] = []

      // 1. Component-fixed.tsx
      fileList.push({
        name: 'Component-fixed.tsx',
        content: componentCode,
        type: 'tsx',
        icon: '⚛️'
      })

      // 2. Component-fixed.css
      try {
        const cssModule = await import(`../generated/tests/${testId}/Component-fixed.css?raw`)
        fileList.push({
          name: 'Component-fixed.css',
          content: cssModule.default,
          type: 'css',
          icon: '🎨'
        })
      } catch (e) {
        console.warn('No CSS file')
      }

      // 3. Tous les chunks
      const chunkNames = ['ImageText', 'Header', 'Footer', 'Hero', 'Card', 'Button', 'Navigation', 'Sidebar']

      for (const chunkName of chunkNames) {
        // TSX chunk
        try {
          const tsxModule = await import(`../generated/tests/${testId}/chunks-fixed/${chunkName}.tsx?raw`)
          fileList.push({
            name: `chunks/${chunkName}.tsx`,
            content: tsxModule.default,
            type: 'tsx',
            icon: '🧩'
          })
        } catch (e) {
          // Chunk n'existe pas
        }

        // CSS chunk
        try {
          const cssModule = await import(`../generated/tests/${testId}/chunks-fixed/${chunkName}.css?raw`)
          fileList.push({
            name: `chunks/${chunkName}.css`,
            content: cssModule.default,
            type: 'css',
            icon: '🎨'
          })
        } catch (e) {
          // CSS n'existe pas
        }
      }

      setFiles(fileList)
      setLoading(false)
    } catch (err) {
      console.error('Error loading files:', err)
      setLoading(false)
    }
  }

  if (loading) {
    return <div style={{ padding: '40px', textAlign: 'center' }}>{t('detail.code.loading')}</div>
  }

  if (files.length === 0) {
    return <div style={{ padding: '40px', textAlign: 'center' }}>{t('detail.code.no_files')}</div>
  }

  const selectedFile = files[selectedIndex]

  // Séparer les fichiers principaux des chunks
  const mainFiles = files.filter(f => !f.name.startsWith('chunks/'))
  const chunkFiles = files.filter(f => f.name.startsWith('chunks/'))

  return (
    <div>
      {/* NAVIGATION - Boutons pour chaque fichier */}
      <div style={{
        backgroundColor: '#f9fafb',
        borderRadius: '8px',
        padding: '16px',
        marginBottom: '16px',
        border: '1px solid #e5e7eb'
      }}>
        <div style={{ fontWeight: 'bold', marginBottom: '16px', fontSize: '16px', color: '#111827' }}>
          📁 Navigation des fichiers ({files.length} fichiers)
        </div>

        {/* Fichiers principaux */}
        <div style={{ marginBottom: '20px' }}>
          <div style={{
            fontSize: '12px',
            fontWeight: '600',
            color: '#6b7280',
            textTransform: 'uppercase',
            marginBottom: '8px',
            letterSpacing: '0.5px'
          }}>
            📦 Composant principal ({mainFiles.length})
          </div>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
            {mainFiles.map((file) => {
              const actualIndex = files.indexOf(file)
              return (
                <button
                  key={actualIndex}
                  onClick={() => setSelectedIndex(actualIndex)}
                  style={{
                    padding: '8px 16px',
                    border: selectedIndex === actualIndex ? '2px solid #7c3aed' : '1px solid #d1d5db',
                    borderRadius: '6px',
                    backgroundColor: selectedIndex === actualIndex ? '#ede9fe' : 'white',
                    color: selectedIndex === actualIndex ? '#5b21b6' : '#374151',
                    cursor: 'pointer',
                    fontSize: '13px',
                    fontWeight: selectedIndex === actualIndex ? '600' : '400',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '6px'
                  }}
                >
                  <span>{file.icon}</span>
                  <span>{file.name}</span>
                </button>
              )
            })}
          </div>
        </div>

        {/* Chunks */}
        {chunkFiles.length > 0 && (
          <div>
            <div style={{
              fontSize: '12px',
              fontWeight: '600',
              color: '#6b7280',
              textTransform: 'uppercase',
              marginBottom: '8px',
              letterSpacing: '0.5px'
            }}>
              🧩 Chunks - Composants découpés ({chunkFiles.length})
            </div>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
              {chunkFiles.map((file) => {
                const actualIndex = files.indexOf(file)
                return (
                  <button
                    key={actualIndex}
                    onClick={() => setSelectedIndex(actualIndex)}
                    style={{
                      padding: '8px 16px',
                      border: selectedIndex === actualIndex ? '2px solid #7c3aed' : '1px solid #d1d5db',
                      borderRadius: '6px',
                      backgroundColor: selectedIndex === actualIndex ? '#ede9fe' : 'white',
                      color: selectedIndex === actualIndex ? '#5b21b6' : '#374151',
                      cursor: 'pointer',
                      fontSize: '13px',
                      fontWeight: selectedIndex === actualIndex ? '600' : '400',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '6px'
                    }}
                  >
                    <span>{file.icon}</span>
                    <span>{file.name.replace('chunks/', '')}</span>
                  </button>
                )
              })}
            </div>
          </div>
        )}
      </div>

      {/* AFFICHAGE DU CODE */}
      <div style={{
        backgroundColor: 'white',
        borderRadius: '8px',
        border: '1px solid #e5e7eb',
        overflow: 'hidden'
      }}>
        {/* Header */}
        <div style={{
          backgroundColor: '#1f2937',
          color: 'white',
          padding: '12px 24px',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <span style={{ fontSize: '18px' }}>{selectedFile.icon}</span>
            <span style={{ fontWeight: 'bold', fontSize: '14px' }}>{selectedFile.name}</span>
          </div>
          <div style={{ fontSize: '12px', color: '#9ca3af' }}>
            {selectedFile.content.split('\n').length} lignes
          </div>
        </div>

        {/* Code */}
        <div style={{ overflow: 'auto', maxHeight: '70vh' }}>
          <SyntaxHighlighter
            language={selectedFile.type === 'tsx' ? 'typescript' : 'css'}
            style={vscDarkPlus}
            customStyle={{
              margin: 0,
              borderRadius: 0,
              fontSize: '13px',
              lineHeight: '1.5'
            }}
            showLineNumbers
          >
            {selectedFile.content}
          </SyntaxHighlighter>
        </div>
      </div>
    </div>
  )
}

/**
 * TAB 3: Report - Rapport HTML interactif
 */
interface ReportTabProps {
  testId: string
}

function ReportTab({ testId }: ReportTabProps) {
  return (
    <div className="bg-white rounded-lg shadow-sm border border-gray-200 overflow-hidden">
      {/* Embed report.html in iframe */}
      <iframe
        src={`/src/generated/tests/${testId}/report.html`}
        className="w-full border-0"
        style={{ minHeight: 'calc(100vh - 300px)' }}
        title="Test Analysis Report"
      />
    </div>
  )
}

/**
 * TAB 4: Technical Analysis - Rapport markdown technique
 */
interface TechnicalAnalysisTabProps {
  analysis: string
}

function TechnicalAnalysisTab({ analysis }: TechnicalAnalysisTabProps) {
  const { t } = useTranslation()

  if (!analysis) {
    return (
      <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-12 text-center">
        <div className="text-6xl mb-4">📄</div>
        <h3 className="text-xl font-semibold text-gray-900 mb-2">
          {t('detail.technical.no_analysis_title')}
        </h3>
        <p className="text-gray-600">
          {t('detail.technical.no_analysis_text')}
        </p>
      </div>
    )
  }

  return (
    <div className="space-y-4">
      {/* Info banner */}
      <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
        <div className="flex items-start gap-3">
          <div className="text-blue-500 text-xl">🔧</div>
          <div className="text-sm text-blue-900">
            <p className="font-semibold mb-1">{t('detail.technical.banner_title')}</p>
            <p className="text-blue-800">
              {t('detail.technical.banner_text')}
            </p>
          </div>
        </div>
      </div>

      {/* Markdown code viewer */}
      <div className="bg-white rounded-lg shadow-sm border border-gray-200 overflow-hidden">
        <div className="bg-gray-900 text-gray-100 px-6 py-3 flex items-center justify-between">
          <h3 className="font-semibold">analysis.md</h3>
          <div className="text-xs text-gray-400">
            {analysis.split('\n').length} lignes
          </div>
        </div>

        <div className="overflow-x-auto">
          <SyntaxHighlighter
            language="markdown"
            style={vscDarkPlus}
            customStyle={{
              margin: 0,
              borderRadius: 0,
              fontSize: '13px',
              lineHeight: '1.5'
            }}
            showLineNumbers
          >
            {analysis}
          </SyntaxHighlighter>
        </div>
      </div>
    </div>
  )
}

