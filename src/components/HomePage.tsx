/**
 * HomePage - Liste de tous les tests MCP analysés
 */

import { useState, useEffect } from 'react'

interface Test {
  testId: string
  fileName?: string
  timestamp: string | number  // Peut être une string ISO ou un nombre (secondes Unix)
  nodeId: string
  stats?: {
    totalNodes?: number
    sectionsDetected?: number
    imagesCount?: number
    svgIconsFlattened?: number
    classesOptimized?: number
    textSizesConverted?: number
    customCSSClasses?: number
  }
}

interface HomePageProps {
  onSelectTest: (testId: string) => void
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

export default function HomePage({ onSelectTest }: HomePageProps) {
  const [tests, setTests] = useState<Test[]>([])
  const [loading, setLoading] = useState<boolean>(true)
  const [mcpConnected, setMcpConnected] = useState<boolean>(false)
  const [mcpChecking, setMcpChecking] = useState<boolean>(true)

  useEffect(() => {
    loadTests()
    checkMcpConnection()

    // Vérifier la connexion MCP toutes les 5 secondes
    const interval = setInterval(checkMcpConnection, 5000)

    return () => clearInterval(interval)
  }, [])

  const checkMcpConnection = async () => {
    try {
      const controller = new AbortController()
      const timeoutId = setTimeout(() => controller.abort(), 2000) // Timeout de 2s

      const response = await fetch('/api/mcp/health', {
        signal: controller.signal,
        method: 'GET'
      })

      clearTimeout(timeoutId)

      // 200 = MCP connecté, 503 = MCP déconnecté
      const isConnected = response.ok

      setMcpConnected(isConnected)
      setMcpChecking(false)
    } catch (error: any) {
      // Erreur réseau = déconnecté
      setMcpConnected(false)
      setMcpChecking(false)
    }
  }

  const loadTests = async () => {
    try {
      // Récupérer la liste des tests depuis src/generated/tests/
      // Pour l'instant on va créer un système simple avec import.meta.glob
      const testModules = import.meta.glob<{ default: any }>('../generated/tests/*/metadata.json', { eager: true })

      const loadedTests = Object.entries(testModules).map(([path, module]) => {
        const testId = path.split('/')[3] // Extract test-{timestamp}
        return {
          ...module.default,
          testId
        } as Test
      })

      // Trier par date (plus récent en premier)
      loadedTests.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime())

      setTests(loadedTests)
      setLoading(false)
    } catch (error) {
      console.error('Error loading tests:', error)
      setTests([])
      setLoading(false)
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-purple-600 mx-auto mb-4"></div>
          <p className="text-gray-600">Chargement des tests...</p>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-white shadow-sm border-b border-gray-200">
        <div className="max-w-7xl mx-auto px-6 py-6">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-3xl font-bold text-gray-900">
                🎨 MCP Figma Analyzer
              </h1>
              <p className="text-gray-600 mt-1">
                Analyses Figma → React + Tailwind avec rapports détaillés
              </p>
            </div>
            <div className="flex items-center gap-4">
              {mcpChecking ? (
                <div className="px-3 py-1 bg-gray-100 text-gray-600 text-sm font-medium rounded-full">
                  <span className="animate-pulse">⏳ Vérification...</span>
                </div>
              ) : mcpConnected ? (
                <div className="px-3 py-1 bg-green-100 text-green-800 text-sm font-medium rounded-full">
                  ✓ MCP Connected
                </div>
              ) : (
                <div className="px-3 py-1 bg-red-100 text-red-800 text-sm font-medium rounded-full">
                  ✗ MCP Disconnected
                </div>
              )}
              <div className="text-sm text-gray-500">
                {tests.length} test{tests.length !== 1 ? 's' : ''}
              </div>
            </div>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-7xl mx-auto px-6 py-8">
        {/* Instructions */}
        <div className="bg-gradient-to-r from-purple-50 to-blue-50 border border-purple-200 rounded-lg p-6 mb-8">
          <h2 className="text-lg font-semibold text-purple-900 mb-3">
            💡 Comment lancer une nouvelle analyse
          </h2>
          <div className="space-y-2 text-sm text-purple-800">
            <p>
              <span className="font-semibold">Option 1 - Slash Command :</span>
              {' '}Utilise{' '}
              <code className="bg-purple-100 px-2 py-0.5 rounded font-mono">
                /analyze-mcp URL_FIGMA
              </code>
              {' '}dans Claude Code
            </p>
            <p>
              <span className="font-semibold">Option 2 - Demande directe :</span>
              {' '}"Analyse cette URL Figma en suivant MCP_ANALYSIS_PROCESS.md : URL"
            </p>
          </div>
        </div>

        {/* Tests List */}
        {tests.length === 0 ? (
          <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-12 text-center">
            <div className="text-6xl mb-4">📭</div>
            <h3 className="text-xl font-semibold text-gray-900 mb-2">
              Aucun test pour le moment
            </h3>
            <p className="text-gray-600 mb-6">
              Lance ta première analyse avec le slash command /analyze-mcp
            </p>
            <div className="inline-block bg-gray-100 px-4 py-2 rounded-lg">
              <code className="text-sm text-gray-800">
                /analyze-mcp https://www.figma.com/design/...
              </code>
            </div>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {tests.map((test) => (
              <TestCard
                key={test.testId}
                test={test}
                onSelect={() => onSelectTest(test.testId)}
              />
            ))}
          </div>
        )}
      </main>
    </div>
  )
}

/**
 * TestCard Component
 */
interface TestCardProps {
  test: Test
  onSelect: () => void
}

function TestCard({ test, onSelect }: TestCardProps) {
  const handleOpenPreview = (e: React.MouseEvent) => {
    e.stopPropagation()
    const previewUrl = `http://localhost:5173/?preview=true&test=${test.testId}`
    window.open(previewUrl, '_blank')
  }

  // Chemin vers la miniature
  const thumbnailPath = `/src/generated/tests/${test.testId}/web-render.png`

  return (
    <div className="bg-white rounded-lg shadow-sm border border-gray-200 hover:shadow-md hover:border-purple-300 transition-all overflow-hidden group">
      {/* Thumbnail Preview */}
      <div className="relative w-full h-48 bg-gradient-to-br from-purple-100 to-blue-100 overflow-hidden">
        <img
          src={thumbnailPath}
          alt={test.fileName || 'Preview'}
          className="w-full h-full object-contain object-center group-hover:scale-105 transition-transform duration-300"
          onError={(e) => {
            // Fallback si l'image n'existe pas
            e.currentTarget.style.display = 'none'
            e.currentTarget.nextElementSibling?.classList.remove('hidden')
          }}
        />
        <div className="hidden absolute inset-0 flex items-center justify-center text-6xl">
          🎨
        </div>
        {/* Badge ID */}
        <div className="absolute top-2 right-2 px-2 py-1 bg-black/50 backdrop-blur-sm text-white text-xs rounded font-mono">
          {test.testId?.replace('node-', '')}
        </div>
      </div>

      {/* Card Content */}
      <div className="p-6">
        {/* Test Info */}
        <h3 className="text-lg font-semibold text-gray-900 mb-2 group-hover:text-purple-600 transition-colors">
          {test.fileName || 'Sans titre'}
        </h3>

      <div className="space-y-2 text-sm text-gray-600 mb-4">
        <div className="flex items-center gap-2">
          <span className="text-gray-400">📅</span>
          <span>{formatDate(test.timestamp)}</span>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-gray-400">🔗</span>
          <span className="truncate">Node {test.nodeId}</span>
        </div>
      </div>

      {/* Stats Preview - Affichage dynamique */}
      {test.stats && (
        <div className="flex gap-2 pt-4 border-t border-gray-100 flex-wrap">
          {test.stats.totalNodes !== undefined && (
            <div className="px-2 py-1 bg-purple-50 text-purple-700 text-xs rounded font-medium">
              📦 {test.stats.totalNodes} nodes
            </div>
          )}
          {test.stats.imagesCount !== undefined && (
            <div className="px-2 py-1 bg-blue-50 text-blue-700 text-xs rounded font-medium">
              🖼️ {test.stats.imagesCount} images
            </div>
          )}
          {test.stats.classesOptimized !== undefined && (
            <div className="px-2 py-1 bg-amber-50 text-amber-700 text-xs rounded font-medium">
              ⚡ {test.stats.classesOptimized} fixes
            </div>
          )}
          {test.stats.sectionsDetected !== undefined && (
            <div className="px-2 py-1 bg-green-50 text-green-700 text-xs rounded font-medium">
              📋 {test.stats.sectionsDetected} sections
            </div>
          )}
        </div>
      )}

        {/* Action Buttons */}
        <div className="mt-4 pt-4 border-t border-gray-100 flex gap-2">
          <button
            onClick={handleOpenPreview}
            className="flex-1 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium rounded-lg transition-colors flex items-center justify-center gap-2"
          >
            <span>Preview</span>
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
            </svg>
          </button>
          <button
            onClick={onSelect}
            className="flex-1 px-4 py-2 bg-purple-600 hover:bg-purple-700 text-white text-sm font-medium rounded-lg transition-colors flex items-center justify-center gap-2"
          >
            <span>Détails</span>
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
            </svg>
          </button>
        </div>
      </div>
    </div>
  )
}
