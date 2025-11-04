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

type Tab = 'preview' | 'code' | 'report' | 'technical'

interface Metadata {
  fileName?: string
  timestamp?: string | number  // Peut être une string ISO ou un nombre (secondes Unix)
  figmaUrl?: string
  componentName?: string
  dimensions?: {
    width: number
    height: number
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
      setMetadata(metadataModule.default)

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
          <p className="text-gray-600">Chargement du test...</p>
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
            Erreur de chargement
          </h3>
          <p className="text-gray-600 mb-6">{error}</p>
          <button
            onClick={onBack}
            className="px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700"
          >
            ← Retour à la liste
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-white shadow-sm border-b border-gray-200">
        <div className="max-w-7xl mx-auto px-6 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <button
                onClick={onBack}
                className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
                title="Retour"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                </svg>
              </button>
              <div>
                <h1 className="text-2xl font-bold text-gray-900">
                  {metadata?.fileName || 'Test'}
                </h1>
                <p className="text-sm text-gray-500">
                  {metadata?.timestamp && formatDate(metadata.timestamp)}
                </p>
              </div>
            </div>

            <div className="flex items-center gap-3">
              <a
                href={`http://localhost:5173/?preview=true&test=${testId}`}
                target="_blank"
                rel="noopener noreferrer"
                className="px-4 py-2 text-sm font-medium bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition-colors flex items-center gap-2 shadow-sm"
              >
                <span className="text-lg">⚛️</span>
                Preview
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                </svg>
              </a>
              <a
                href={metadata?.figmaUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="px-4 py-2 text-sm font-medium bg-purple-600 hover:bg-purple-700 text-white rounded-lg transition-colors flex items-center gap-2 shadow-sm"
              >
                <span className="text-lg">🎨</span>
                Ouvrir dans Figma
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                </svg>
              </a>
            </div>
          </div>
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
              🎨 Preview
            </button>
            <button
              onClick={() => setActiveTab('code')}
              className={`py-4 px-1 border-b-2 font-medium text-sm transition-colors ${
                activeTab === 'code'
                  ? 'border-purple-500 text-purple-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
              }`}
            >
              💻 Code
            </button>
            <button
              onClick={() => setActiveTab('report')}
              className={`py-4 px-1 border-b-2 font-medium text-sm transition-colors ${
                activeTab === 'report'
                  ? 'border-purple-500 text-purple-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
              }`}
            >
              📊 Rapport
            </button>
            <button
              onClick={() => setActiveTab('technical')}
              className={`py-4 px-1 border-b-2 font-medium text-sm transition-colors ${
                activeTab === 'technical'
                  ? 'border-purple-500 text-purple-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
              }`}
            >
              🔧 Technical Analysis
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
          <CodeTab componentCode={componentCode} />
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
        <p className="text-gray-600">Chargement du composant...</p>
      </div>
    )
  }

  if (error) {
    return (
      <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-12 text-center">
        <div className="text-6xl mb-4">⚠️</div>
        <h3 className="text-xl font-semibold text-gray-900 mb-2">
          Erreur de chargement du composant
        </h3>
        <p className="text-gray-600 mb-4">{error}</p>
        <p className="text-sm text-gray-500">
          Le composant est peut-être manquant ou invalide
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
              <p className="font-semibold mb-1">Rendu du composant Figma</p>
              <p className="text-blue-800">
                Ce composant a été généré automatiquement depuis Figma via MCP.
                Utilise les DevTools (F12) pour inspecter les classes Tailwind.
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
              <h3 className="font-semibold text-gray-900">Test Responsive</h3>
              <div className="flex items-center gap-2">
                {dimensions && viewportWidth === dimensions.width && (
                  <span className="text-sm bg-green-100 text-green-800 px-2 py-1 rounded flex items-center gap-1">
                    <span>🎯</span> Native
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
            Composant : {componentName}
          </h3>
          <div className="text-xs text-gray-500">
            React + Tailwind CSS
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
          <p className="text-sm font-semibold text-green-900 mb-2">💡 Tips</p>
          <ul className="text-sm text-green-800 space-y-1">
            {dimensions && (
              <li>• Le bouton 🎯 Native affiche le composant à sa taille Figma originale ({dimensions.width}×{dimensions.height}px)</li>
            )}
            <li>• Utilise le slider ou les presets pour tester différentes tailles d'écran</li>
            <li>• Inspecte les éléments avec les DevTools pour voir les classes Tailwind</li>
            <li>• Compare avec le design Figma original</li>
            <li>• Vérifie les couleurs, espacements, et typographie</li>
          </ul>
        </div>
      </div>
    </div>
  )
}

/**
 * TAB 2: Code - Code source Component-fixed.tsx
 */
interface CodeTabProps {
  componentCode: string
}

function CodeTab({ componentCode }: CodeTabProps) {
  if (!componentCode) {
    return (
      <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-12 text-center">
        <div className="text-6xl mb-4">📝</div>
        <h3 className="text-xl font-semibold text-gray-900 mb-2">
          Code non disponible
        </h3>
        <p className="text-gray-600">
          Le fichier Component-fixed.jsx n'a pas pu être chargé
        </p>
      </div>
    )
  }

  return (
    <div className="space-y-4">
      {/* Info banner */}
      <div className="bg-purple-50 border border-purple-200 rounded-lg p-4">
        <div className="flex items-start gap-3">
          <div className="text-purple-500 text-xl">💻</div>
          <div className="text-sm text-purple-900">
            <p className="font-semibold mb-1">Code source généré</p>
            <p className="text-purple-800">
              Composant React + Tailwind CSS généré depuis Figma avec post-processing intelligent (gradients, shapes, optimisations).
            </p>
          </div>
        </div>
      </div>

      {/* Code viewer */}
      <div className="bg-white rounded-lg shadow-sm border border-gray-200 overflow-hidden">
        <div className="bg-gray-900 text-gray-100 px-6 py-3 flex items-center justify-between">
          <h3 className="font-semibold">Component-fixed.tsx</h3>
          <div className="text-xs text-gray-400">
            {componentCode.split('\n').length} lignes
          </div>
        </div>

        <div className="overflow-x-auto">
          <SyntaxHighlighter
            language="typescript"
            style={vscDarkPlus}
            customStyle={{
              margin: 0,
              borderRadius: 0,
              fontSize: '13px',
              lineHeight: '1.5'
            }}
            showLineNumbers
          >
            {componentCode}
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
  if (!analysis) {
    return (
      <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-12 text-center">
        <div className="text-6xl mb-4">📄</div>
        <h3 className="text-xl font-semibold text-gray-900 mb-2">
          Analyse technique non disponible
        </h3>
        <p className="text-gray-600">
          Le fichier analysis.md n'a pas pu être chargé
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
            <p className="font-semibold mb-1">Rapport technique complet</p>
            <p className="text-blue-800">
              Documentation détaillée de toutes les transformations appliquées : AST processing, optimisations Tailwind, gestion des assets, etc.
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

