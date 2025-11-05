/**
 * HomePage - Liste de tous les tests MCP analysés
 */

import { useState, useEffect } from 'react'
import AnalysisForm from './AnalysisForm'
import LanguageSwitcher from './LanguageSwitcher'
import ThemeToggle from './ThemeToggle'
import { UsageBar } from './UsageBar'
import { useTranslation } from '../i18n/I18nContext'

interface Test {
  testId: string
  fileName?: string
  layerName?: string  // Nom du layer extrait de metadata.xml
  timestamp: string | number  // Peut être une string ISO ou un nombre (secondes Unix)
  nodeId: string
  stats?: {
    totalNodes?: number
    sectionsDetected?: number
    imagesOrganized?: number
    totalFixes?: number
    fontsConverted?: number
    classesFixed?: number
    wrappersFlattened?: number
    compositesInlined?: number
    gradientsFixed?: number
    shapesFixed?: number
    blendModesVerified?: number
    varsConverted?: number
    classesOptimized?: number
    customClassesGenerated?: number
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

type ViewMode = 'grid' | 'list'
type SortOption = 'date-desc' | 'date-asc' | 'name-asc' | 'name-desc'

export default function HomePage({ onSelectTest }: HomePageProps) {
  const { t } = useTranslation()
  const [tests, setTests] = useState<Test[]>([])
  const [loading, setLoading] = useState<boolean>(true)
  const [mcpConnected, setMcpConnected] = useState<boolean>(false)
  const [mcpChecking, setMcpChecking] = useState<boolean>(true)
  const [viewMode, setViewMode] = useState<ViewMode>('grid')
  const [sortOption, setSortOption] = useState<SortOption>('date-desc')
  const [currentPage, setCurrentPage] = useState<number>(1)
  const [itemsPerPage, setItemsPerPage] = useState<number>(9)

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
      const testModules = import.meta.glob<{ default: any }>('../generated/tests/*/metadata.json', { eager: true })
      const xmlModules = import.meta.glob<string>('../generated/tests/*/metadata.xml', { eager: true, as: 'raw' })

      const loadedTests = Object.entries(testModules).map(([path, module]) => {
        const testId = path.split('/')[3] // Extract test-{timestamp}

        // Extraire le nom du layer depuis metadata.xml si disponible
        const xmlPath = path.replace('metadata.json', 'metadata.xml')
        let layerName = null

        if (xmlModules[xmlPath]) {
          const xmlContent = xmlModules[xmlPath]
          const frameMatch = xmlContent.match(/<frame[^>]+name="([^"]+)"/)
          layerName = frameMatch ? frameMatch[1] : null
        }

        return {
          ...module.default,
          testId,
          layerName
        } as Test
      })

      setTests(loadedTests)
      setLoading(false)
    } catch (error) {
      console.error('Error loading tests:', error)
      setTests([])
      setLoading(false)
    }
  }

  // Fonction de tri des tests
  const sortTests = (testsToSort: Test[]): Test[] => {
    const sorted = [...testsToSort]

    switch (sortOption) {
      case 'date-desc':
        sorted.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime())
        break
      case 'date-asc':
        sorted.sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime())
        break
      case 'name-asc':
        sorted.sort((a, b) => (a.layerName || a.fileName || '').localeCompare(b.layerName || b.fileName || ''))
        break
      case 'name-desc':
        sorted.sort((a, b) => (b.layerName || b.fileName || '').localeCompare(a.layerName || a.fileName || ''))
        break
      default:
        break
    }

    return sorted
  }

  const sortedTests = sortTests(tests)

  // Pagination logic
  const totalPages = Math.ceil(sortedTests.length / itemsPerPage)
  const indexOfLastItem = currentPage * itemsPerPage
  const indexOfFirstItem = indexOfLastItem - itemsPerPage
  const currentTests = sortedTests.slice(indexOfFirstItem, indexOfLastItem)

  // Reset to page 1 when filters change
  useEffect(() => {
    setCurrentPage(1)
  }, [sortOption, viewMode])

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center" style={{ backgroundColor: 'var(--bg-primary)' }}>
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 mx-auto mb-4" style={{ borderColor: 'var(--accent-primary)' }}></div>
          <p style={{ color: 'var(--text-secondary)' }}>{t('home.loading_tests')}</p>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen" style={{ backgroundColor: 'var(--bg-primary)' }}>
      {/* Header */}
      <header className="relative overflow-hidden" style={{
        background: 'linear-gradient(to bottom right, var(--accent-primary), var(--accent-secondary))'
      }}>
        {/* Background Pattern */}
        <div className="absolute inset-0 bg-grid-white/10 bg-[size:20px_20px]"></div>
        <div className="absolute inset-0 bg-gradient-to-t from-black/20 to-transparent"></div>

        <div className="relative max-w-7xl mx-auto px-6 py-12">
          {/* Status Bar */}
          <div className="flex items-center justify-between mb-8">
            <div className="flex items-center gap-3">
              {mcpChecking ? (
                <div className="px-4 py-2 backdrop-blur-sm text-sm font-medium rounded-xl" style={{
                  backgroundColor: 'var(--bg-overlay-light)',
                  color: 'var(--text-inverse)',
                  borderWidth: '1px',
                  borderColor: 'var(--border-light)'
                }}>
                  <span className="animate-pulse flex items-center gap-2">
                    <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                    </svg>
                    MCP
                  </span>
                </div>
              ) : mcpConnected ? (
                <div className="px-4 py-2 backdrop-blur-sm text-sm font-medium rounded-xl flex items-center gap-2" style={{
                  backgroundColor: 'var(--status-success-bg)',
                  color: 'var(--status-success-text)',
                  borderWidth: '1px',
                  borderColor: 'var(--status-success-border)'
                }}>
                  <span className="relative flex h-2 w-2">
                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full opacity-75" style={{ backgroundColor: 'var(--status-success-text)' }}></span>
                    <span className="relative inline-flex rounded-full h-2 w-2" style={{ backgroundColor: 'var(--status-success-text)' }}></span>
                  </span>
                  MCP
                </div>
              ) : (
                <div className="px-4 py-2 backdrop-blur-sm text-sm font-medium rounded-xl flex items-center gap-2" style={{
                  backgroundColor: 'var(--status-error-bg)',
                  color: 'var(--status-error-text)',
                  borderWidth: '1px',
                  borderColor: 'var(--status-error-border)'
                }}>
                  <span className="relative flex h-2 w-2">
                    <span className="relative inline-flex rounded-full h-2 w-2" style={{ backgroundColor: 'var(--status-error-text)' }}></span>
                  </span>
                  MCP
                </div>
              )}

              {/* Usage Bar à côté du MCP status */}
              <UsageBar />
            </div>

            <div className="flex items-center gap-3">
              <ThemeToggle />
              <LanguageSwitcher />
            </div>
          </div>

          {/* Main Title */}
          <div className="text-center mb-8">
            <div className="inline-flex items-center gap-3 mb-4">
              <div className="w-16 h-16 backdrop-blur-sm rounded-2xl flex items-center justify-center shadow-xl" style={{
                backgroundColor: 'var(--bg-overlay-light)',
                borderWidth: '1px',
                borderColor: 'var(--border-light)'
              }}>
                <svg className="w-10 h-10" fill="none" stroke="currentColor" viewBox="0 0 24 24" style={{ color: 'var(--text-inverse)' }}>
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 21a4 4 0 01-4-4V5a2 2 0 012-2h4a2 2 0 012 2v12a4 4 0 01-4 4zm0 0h12a2 2 0 002-2v-4a2 2 0 00-2-2h-2.343M11 7.343l1.657-1.657a2 2 0 012.828 0l2.829 2.829a2 2 0 010 2.828l-8.486 8.485M7 17h.01" />
                </svg>
              </div>
            </div>

            <h1 className="text-5xl font-bold mb-3 tracking-tight" style={{ color: 'var(--text-inverse)' }}>
              {t('header.title')}
            </h1>
            <p className="text-xl max-w-2xl mx-auto" style={{ color: 'var(--text-inverse)', opacity: 0.9 }}>
              {t('header.subtitle')}
              <span className="block text-base mt-2" style={{ opacity: 0.8 }}>
                {t('header.subtitle_detail')}
              </span>
            </p>
          </div>

          {/* Stats Cards */}
          {tests.length > 0 && (
            <div className="grid grid-cols-3 gap-4 max-w-3xl mx-auto">
              <div className="backdrop-blur-sm rounded-xl p-4" style={{
                backgroundColor: 'var(--bg-overlay-light)',
                borderWidth: '1px',
                borderColor: 'var(--border-light)'
              }}>
                <div className="text-3xl font-bold mb-1" style={{ color: 'var(--text-inverse)' }}>
                  {tests.reduce((acc, test) => acc + (test.stats?.totalNodes || 0), 0)}
                </div>
                <div className="text-sm" style={{ color: 'var(--text-inverse)', opacity: 0.9 }}>{t('header.stats.total_nodes')}</div>
              </div>
              <div className="backdrop-blur-sm rounded-xl p-4" style={{
                backgroundColor: 'var(--bg-overlay-light)',
                borderWidth: '1px',
                borderColor: 'var(--border-light)'
              }}>
                <div className="text-3xl font-bold mb-1" style={{ color: 'var(--text-inverse)' }}>
                  {tests.reduce((acc, test) => acc + (test.stats?.imagesOrganized || 0), 0)}
                </div>
                <div className="text-sm" style={{ color: 'var(--text-inverse)', opacity: 0.9 }}>{t('header.stats.images')}</div>
              </div>
              <div className="backdrop-blur-sm rounded-xl p-4" style={{
                backgroundColor: 'var(--bg-overlay-light)',
                borderWidth: '1px',
                borderColor: 'var(--border-light)'
              }}>
                <div className="text-3xl font-bold mb-1" style={{ color: 'var(--text-inverse)' }}>
                  {tests.reduce((acc, test) => acc + (test.stats?.totalFixes || test.stats?.classesOptimized || 0), 0)}
                </div>
                <div className="text-sm" style={{ color: 'var(--text-inverse)', opacity: 0.9 }}>{t('header.stats.total_fixes')}</div>
              </div>
            </div>
          )}
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-7xl mx-auto px-6 py-8">
        {/* Analysis Form - Remplace le bloc "💡 Comment lancer" */}
        <AnalysisForm onAnalysisComplete={loadTests} />

        {/* Controls Bar */}
        {tests.length > 0 && (
          <div className="mb-6 flex flex-wrap items-center justify-between rounded-lg p-4 gap-4" style={{
            backgroundColor: 'var(--bg-card)',
            borderWidth: '1px',
            borderColor: 'var(--border-subtle)',
            boxShadow: 'var(--shadow-sm)'
          }}>
            {/* Left: View Mode Toggle + Test Count */}
            <div className="flex items-center gap-4">
              <div className="flex items-center gap-2">
                <span className="text-sm font-medium" style={{ color: 'var(--text-secondary)' }}>{t('home.view')}</span>
                <div className="flex rounded-lg p-1" style={{ backgroundColor: 'var(--bg-hover)' }}>
                  <button
                    onClick={() => setViewMode('grid')}
                    className={`px-3 py-1.5 rounded-md text-sm font-medium transition-all ${
                      viewMode === 'grid'
                        ? 'bg-white text-purple-600 shadow-sm'
                        : 'text-gray-600 hover:text-gray-900'
                    }`}
                  >
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2V6zM14 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2V6zM4 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2v-2zM14 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2v-2z" />
                    </svg>
                  </button>
                  <button
                    onClick={() => setViewMode('list')}
                    className={`px-3 py-1.5 rounded-md text-sm font-medium transition-all ${
                      viewMode === 'list'
                        ? 'bg-white text-purple-600 shadow-sm'
                        : 'text-gray-600 hover:text-gray-900'
                    }`}
                  >
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
                    </svg>
                  </button>
                </div>
              </div>

              {/* Test Count */}
              <div className="px-3 py-1.5 rounded-lg text-sm font-medium" style={{
                backgroundColor: 'var(--bg-hover)',
                color: 'var(--text-primary)'
              }}>
                <span className="flex items-center gap-2">
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                  </svg>
                  {tests.length} {tests.length > 1 ? t('common.tests_plural') : t('common.tests')}
                </span>
              </div>
            </div>

            {/* Right: Sort Options + Items per page */}
            <div className="flex items-center gap-4">
              <div className="flex items-center gap-2">
                <span className="text-sm text-gray-600 font-medium">{t('home.sort_by')}</span>
                <select
                  value={sortOption}
                  onChange={(e) => setSortOption(e.target.value as SortOption)}
                  className="px-3 py-1.5 bg-gray-50 border border-gray-200 rounded-lg text-sm font-medium text-gray-700 hover:bg-gray-100 focus:outline-none focus:ring-2 focus:ring-purple-500 transition-all"
                >
                  <option value="date-desc">{t('home.sort_options.date_desc')}</option>
                  <option value="date-asc">{t('home.sort_options.date_asc')}</option>
                  <option value="name-asc">{t('home.sort_options.name_asc')}</option>
                  <option value="name-desc">{t('home.sort_options.name_desc')}</option>
                </select>
              </div>

              <div className="flex items-center gap-2">
                <span className="text-sm text-gray-600 font-medium">{t('home.per_page')}</span>
                <select
                  value={itemsPerPage}
                  onChange={(e) => {
                    setItemsPerPage(Number(e.target.value))
                    setCurrentPage(1)
                  }}
                  className="px-3 py-1.5 bg-gray-50 border border-gray-200 rounded-lg text-sm font-medium text-gray-700 hover:bg-gray-100 focus:outline-none focus:ring-2 focus:ring-purple-500 transition-all"
                >
                  <option value="6">6</option>
                  <option value="9">9</option>
                  <option value="12">12</option>
                  <option value="18">18</option>
                  <option value="24">24</option>
                </select>
              </div>
            </div>
          </div>
        )}

        {/* Tests List */}
        {sortedTests.length === 0 ? (
          <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-12 text-center">
            <div className="text-6xl mb-4">📭</div>
            <h3 className="text-xl font-semibold text-gray-900 mb-2">
              {t('home.no_tests.title')}
            </h3>
            <p className="text-gray-600 mb-6">
              {t('home.no_tests.message')}
            </p>
            <div className="inline-block bg-gray-100 px-4 py-2 rounded-lg">
              <code className="text-sm text-gray-800">
                /analyze-mcp https://www.figma.com/design/...
              </code>
            </div>
          </div>
        ) : (
          <>
            {viewMode === 'grid' ? (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {currentTests.map((test) => (
                  <TestCard
                    key={test.testId}
                    test={test}
                    onSelect={() => onSelectTest(test.testId)}
                  />
                ))}
              </div>
            ) : (
              <div className="space-y-3">
                {currentTests.map((test) => (
                  <TestCardList
                    key={test.testId}
                    test={test}
                    onSelect={() => onSelectTest(test.testId)}
                  />
                ))}
              </div>
            )}

            {/* Pagination */}
            {totalPages > 1 && (
              <div className="mt-8 flex items-center justify-between rounded-lg px-6 py-4" style={{
                backgroundColor: 'var(--bg-card)',
                boxShadow: 'var(--shadow-sm)',
                borderWidth: '1px',
                borderColor: 'var(--border-primary)'
              }}>
                {/* Left: Info */}
                <div className="text-sm" style={{ color: 'var(--text-secondary)' }}>
                  {t('home.pagination.showing')} <span className="font-medium" style={{ color: 'var(--text-primary)' }}>{indexOfFirstItem + 1}</span> {t('home.pagination.to')}{' '}
                  <span className="font-medium" style={{ color: 'var(--text-primary)' }}>{Math.min(indexOfLastItem, sortedTests.length)}</span> {t('home.pagination.of')}{' '}
                  <span className="font-medium" style={{ color: 'var(--text-primary)' }}>{sortedTests.length}</span> {sortedTests.length > 1 ? t('common.tests_plural') : t('common.tests')}
                </div>

                {/* Center: Page Numbers */}
                <div className="flex items-center gap-2">
                  {/* Previous Button */}
                  <button
                    onClick={() => setCurrentPage(prev => Math.max(prev - 1, 1))}
                    disabled={currentPage === 1}
                    className="px-3 py-2 rounded-lg text-sm font-medium transition-all disabled:opacity-40 disabled:cursor-not-allowed"
                    style={{
                      color: 'var(--text-primary)'
                    }}
                    onMouseEnter={(e) => {
                      if (currentPage !== 1) {
                        e.currentTarget.style.backgroundColor = 'var(--bg-hover)'
                      }
                    }}
                    onMouseLeave={(e) => {
                      e.currentTarget.style.backgroundColor = 'transparent'
                    }}
                    title={t('home.pagination.previous')}
                  >
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                    </svg>
                  </button>

                  {/* Page Numbers */}
                  <div className="flex items-center gap-1">
                    {Array.from({ length: totalPages }, (_, i) => i + 1).map((page) => {
                      // Show first page, last page, current page, and pages around current
                      const showPage =
                        page === 1 ||
                        page === totalPages ||
                        (page >= currentPage - 1 && page <= currentPage + 1)

                      // Show ellipsis
                      const showEllipsisBefore = page === currentPage - 2 && currentPage > 3
                      const showEllipsisAfter = page === currentPage + 2 && currentPage < totalPages - 2

                      if (showEllipsisBefore || showEllipsisAfter) {
                        return (
                          <span key={page} className="px-2" style={{ color: 'var(--text-muted)' }}>
                            ...
                          </span>
                        )
                      }

                      if (!showPage) return null

                      return (
                        <button
                          key={page}
                          onClick={() => setCurrentPage(page)}
                          className="min-w-[40px] px-3 py-2 rounded-lg text-sm font-medium transition-all"
                          style={{
                            background: currentPage === page ? 'var(--button-primary-bg)' : 'transparent',
                            color: currentPage === page ? 'var(--button-primary-text)' : 'var(--text-primary)',
                            boxShadow: currentPage === page ? 'var(--shadow-sm)' : 'none'
                          }}
                          onMouseEnter={(e) => {
                            if (currentPage !== page) {
                              e.currentTarget.style.backgroundColor = 'var(--bg-hover)'
                            }
                          }}
                          onMouseLeave={(e) => {
                            if (currentPage !== page) {
                              e.currentTarget.style.backgroundColor = 'transparent'
                            }
                          }}
                        >
                          {page}
                        </button>
                      )
                    })}
                  </div>

                  {/* Next Button */}
                  <button
                    onClick={() => setCurrentPage(prev => Math.min(prev + 1, totalPages))}
                    disabled={currentPage === totalPages}
                    className="px-3 py-2 rounded-lg text-sm font-medium transition-all disabled:opacity-40 disabled:cursor-not-allowed"
                    style={{
                      color: 'var(--text-primary)'
                    }}
                    onMouseEnter={(e) => {
                      if (currentPage !== totalPages) {
                        e.currentTarget.style.backgroundColor = 'var(--bg-hover)'
                      }
                    }}
                    onMouseLeave={(e) => {
                      e.currentTarget.style.backgroundColor = 'transparent'
                    }}
                    title={t('home.pagination.next')}
                  >
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                    </svg>
                  </button>
                </div>

                {/* Right: Quick jump */}
                <div className="flex items-center gap-2">
                  <span className="text-sm" style={{ color: 'var(--text-secondary)' }}>{t('home.pagination.go_to')}</span>
                  <input
                    type="number"
                    min="1"
                    max={totalPages}
                    value={currentPage}
                    onChange={(e) => {
                      const page = parseInt(e.target.value)
                      if (page >= 1 && page <= totalPages) {
                        setCurrentPage(page)
                      }
                    }}
                    className="w-16 px-3 py-2 rounded-lg text-sm font-medium text-center transition-all"
                    style={{
                      backgroundColor: 'var(--bg-secondary)',
                      borderWidth: '1px',
                      borderColor: 'var(--border-primary)',
                      color: 'var(--text-primary)'
                    }}
                    onFocus={(e) => {
                      e.currentTarget.style.outline = 'none'
                      e.currentTarget.style.boxShadow = 'var(--focus-ring)'
                      e.currentTarget.style.borderColor = 'var(--accent-primary)'
                    }}
                    onBlur={(e) => {
                      e.currentTarget.style.boxShadow = 'none'
                      e.currentTarget.style.borderColor = 'var(--border-primary)'
                    }}
                  />
                </div>
              </div>
            )}
          </>
        )}
      </main>
    </div>
  )
}

/**
 * TestCard Component (Grid View)
 */
interface TestCardProps {
  test: Test
  onSelect: () => void
}

function TestCard({ test, onSelect }: TestCardProps) {
  const { t } = useTranslation()
  const [isDeleting, setIsDeleting] = useState(false)

  const handleOpenPreview = (e: React.MouseEvent) => {
    e.stopPropagation()
    const previewUrl = `http://localhost:5173/?preview=true&test=${test.testId}`
    window.open(previewUrl, '_blank')
  }

  const handleCardClick = () => {
    onSelect()
  }

  const handleDelete = async (e: React.MouseEvent) => {
    e.stopPropagation()

    if (!confirm(t('home.card.delete_confirm'))) {
      return
    }

    setIsDeleting(true)

    try {
      const response = await fetch(`/api/tests/${test.testId}`, {
        method: 'DELETE'
      })

      if (response.ok) {
        // Reload the page to refresh the list
        window.location.reload()
      } else {
        alert(t('home.card.delete_error'))
        setIsDeleting(false)
      }
    } catch (error) {
      alert(t('home.card.delete_error'))
      setIsDeleting(false)
    }
  }

  // Chemin vers la miniature
  const thumbnailPath = `/src/generated/tests/${test.testId}/web-render.png`

  // Extract nodeId from testId: node-9-2654-1735689600 → 9-2654
  const nodeIdDisplay = (() => {
    const match = test.testId?.match(/^node-(.+)-\d+$/)
    return match ? match[1] : test.testId?.replace('node-', '')
  })()

  return (
    <div
      onClick={handleCardClick}
      className="rounded-xl overflow-hidden group cursor-pointer relative transition-all"
      style={{
        backgroundColor: 'var(--bg-card)',
        borderWidth: '1px',
        borderColor: 'var(--border-subtle)',
        boxShadow: 'var(--shadow-sm)'
      }}
      onMouseEnter={(e) => {
        e.currentTarget.style.boxShadow = 'var(--shadow-lg)'
        e.currentTarget.style.borderColor = 'var(--accent-primary)'
      }}
      onMouseLeave={(e) => {
        e.currentTarget.style.boxShadow = 'var(--shadow-sm)'
        e.currentTarget.style.borderColor = 'var(--border-subtle)'
      }}>

      {/* Thumbnail Preview */}
      <div className="relative w-full h-52 overflow-hidden" style={{
        background: 'linear-gradient(to bottom right, var(--accent-secondary), var(--bg-secondary))'
      }}>
        <img
          src={thumbnailPath}
          alt={test.layerName || test.fileName || 'Preview'}
          className="w-full h-full object-contain object-center group-hover:scale-105 transition-transform duration-300"
          onError={(e) => {
            e.currentTarget.style.display = 'none'
            e.currentTarget.nextElementSibling?.classList.remove('hidden')
          }}
        />
        <div className="hidden absolute inset-0 flex items-center justify-center text-6xl">
          🎨
        </div>

        {/* Top Actions Bar */}
        <div className="absolute top-0 left-0 right-0 p-3 flex items-start justify-between bg-gradient-to-b from-black/40 to-transparent opacity-0 group-hover:opacity-100 transition-opacity">
          {/* Preview Button */}
          <button
            onClick={handleOpenPreview}
            className="p-2 backdrop-blur-sm rounded-lg transition-all"
            style={{
              backgroundColor: 'var(--bg-overlay-medium)',
              boxShadow: 'var(--shadow-sm)'
            }}
            onMouseEnter={(e) => e.currentTarget.style.backgroundColor = 'var(--bg-card)'}
            onMouseLeave={(e) => e.currentTarget.style.backgroundColor = 'var(--bg-overlay-medium)'}
            title={t('home.card.open_preview')}
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" style={{ color: 'var(--text-primary)' }}>
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
            </svg>
          </button>

          {/* Delete Button */}
          <button
            onClick={handleDelete}
            disabled={isDeleting}
            className="p-2 backdrop-blur-sm rounded-lg transition-all disabled:opacity-50"
            style={{
              backgroundColor: 'var(--bg-overlay-medium)',
              boxShadow: 'var(--shadow-sm)'
            }}
            onMouseEnter={(e) => {
              if (!isDeleting) {
                e.currentTarget.style.backgroundColor = 'var(--status-error-text)'
                e.currentTarget.querySelector('svg')!.style.color = 'var(--text-inverse)'
              }
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.backgroundColor = 'var(--bg-overlay-medium)'
              e.currentTarget.querySelector('svg')!.style.color = 'var(--text-primary)'
            }}
            title={t('home.card.delete')}
          >
            {isDeleting ? (
              <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
              </svg>
            ) : (
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" style={{ color: 'var(--text-primary)', transition: 'color 0.2s' }}>
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
              </svg>
            )}
          </button>
        </div>

        {/* Node ID Badge - Bottom left */}
        <div className="absolute bottom-3 left-3 px-2.5 py-1 backdrop-blur-sm text-[11px] rounded-md font-mono whitespace-nowrap" style={{
          backgroundColor: 'var(--bg-overlay-dark)',
          color: 'var(--text-inverse)'
        }}>
          #{nodeIdDisplay}
        </div>
      </div>

      {/* Card Content - Simplifié */}
      <div className="p-5">
        {/* Title */}
        <h3 className="text-base font-semibold mb-2 transition-colors truncate" style={{ color: 'var(--text-primary)' }}>
          {test.layerName || test.fileName || t('home.card.no_title')}
        </h3>

        {/* Date + Stats inline */}
        <div className="flex items-center justify-between mb-4">
          <div className="flex flex-col">
            <span className="text-xs" style={{ color: 'var(--text-secondary)' }}>{formatDate(test.timestamp)}</span>
            <span className="text-[9px] font-mono mt-0.5" style={{ color: 'var(--text-muted)' }}>{test.testId}</span>
          </div>

          {/* Mini stats */}
          {test.stats && (
            <div className="flex gap-1.5">
              {test.stats.totalNodes !== undefined && (
                <span className="px-2 py-0.5 text-[10px] rounded font-medium min-w-[28px] text-center" style={{
                  backgroundColor: 'var(--bg-hover)',
                  color: 'var(--text-secondary)'
                }} title="Nodes">
                  {test.stats.totalNodes}
                </span>
              )}
              {test.stats.sectionsDetected !== undefined && test.stats.sectionsDetected > 0 && (
                <span className="px-2 py-0.5 text-[10px] rounded font-medium min-w-[28px] text-center" style={{
                  backgroundColor: 'var(--accent-secondary)',
                  color: 'var(--accent-primary)'
                }} title="Sections">
                  {test.stats.sectionsDetected}
                </span>
              )}
              {test.stats.imagesOrganized !== undefined && test.stats.imagesOrganized > 0 && (
                <span className="px-2 py-0.5 text-[10px] rounded font-medium min-w-[28px] text-center" style={{
                  backgroundColor: 'var(--status-info-bg)',
                  color: 'var(--status-info-text)'
                }} title="Images">
                  {test.stats.imagesOrganized}
                </span>
              )}
              {(test.stats.totalFixes !== undefined || test.stats.classesOptimized !== undefined) && (
                <span className="px-2 py-0.5 text-[10px] rounded font-medium min-w-[28px] text-center" style={{
                  backgroundColor: 'var(--status-warning-bg)',
                  color: 'var(--status-warning-text)'
                }} title="Fixes">
                  {test.stats.totalFixes || test.stats.classesOptimized || 0}
                </span>
              )}
            </div>
          )}
        </div>

        {/* Single Primary Action Button */}
        <button
          onClick={handleCardClick}
          className="w-full px-4 py-2.5 text-sm font-medium rounded-lg transition-all flex items-center justify-center gap-2"
          style={{
            background: 'var(--button-primary-bg)',
            color: 'var(--button-primary-text)',
            boxShadow: 'var(--shadow-sm)'
          }}
          onMouseEnter={(e) => e.currentTarget.style.background = 'var(--button-primary-hover)'}
          onMouseLeave={(e) => e.currentTarget.style.background = 'var(--button-primary-bg)'}
        >
          <span>{t('home.card.view_details')}</span>
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
          </svg>
        </button>
      </div>
    </div>
  )
}

/**
 * TestCardList Component (List View)
 */
interface TestCardListProps {
  test: Test
  onSelect: () => void
}

function TestCardList({ test, onSelect }: TestCardListProps) {
  const { t } = useTranslation()
  const [isDeleting, setIsDeleting] = useState(false)

  const handleOpenPreview = (e: React.MouseEvent) => {
    e.stopPropagation()
    const previewUrl = `http://localhost:5173/?preview=true&test=${test.testId}`
    window.open(previewUrl, '_blank')
  }

  const handleDelete = async (e: React.MouseEvent) => {
    e.stopPropagation()

    if (!confirm(t('home.card.delete_confirm'))) {
      return
    }

    setIsDeleting(true)

    try {
      const response = await fetch(`/api/tests/${test.testId}`, {
        method: 'DELETE'
      })

      if (response.ok) {
        window.location.reload()
      } else {
        alert(t('home.card.delete_error'))
        setIsDeleting(false)
      }
    } catch (error) {
      alert(t('home.card.delete_error'))
      setIsDeleting(false)
    }
  }

  // Chemin vers la miniature
  const thumbnailPath = `/src/generated/tests/${test.testId}/web-render.png`

  const nodeIdDisplay = (() => {
    const match = test.testId?.match(/^node-(.+)-\d+$/)
    return match ? match[1] : test.testId?.replace('node-', '')
  })()

  return (
    <div
      onClick={() => onSelect()}
      className="bg-white rounded-lg shadow-sm border border-gray-200 hover:shadow-md hover:border-purple-300 transition-all overflow-hidden group cursor-pointer flex items-center p-4 gap-4"
    >
      {/* Thumbnail */}
      <div className="relative w-32 h-24 flex-shrink-0 bg-gradient-to-br from-purple-100 to-blue-100 rounded-lg overflow-hidden">
        <img
          src={thumbnailPath}
          alt={test.layerName || test.fileName || 'Preview'}
          className="w-full h-full object-contain object-center group-hover:scale-105 transition-transform duration-300"
          onError={(e) => {
            e.currentTarget.style.display = 'none'
            e.currentTarget.nextElementSibling?.classList.remove('hidden')
          }}
        />
        <div className="hidden absolute inset-0 flex items-center justify-center text-4xl">
          🎨
        </div>

        {/* Node ID Badge */}
        <div className="absolute bottom-1 right-1 px-1.5 py-0.5 bg-black/70 backdrop-blur-sm text-white text-[10px] rounded font-mono whitespace-nowrap">
          #{nodeIdDisplay}
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 min-w-0">
        <h3 className="text-base font-semibold text-gray-900 group-hover:text-purple-600 transition-colors truncate mb-1">
          {test.layerName || test.fileName || t('home.card.no_title')}
        </h3>
        <div className="flex items-center gap-4 text-xs text-gray-500">
          <div className="flex flex-col">
            <span>{formatDate(test.timestamp)}</span>
            <span className="text-[9px] text-gray-400 font-mono">{test.testId}</span>
          </div>
          {test.stats && (
            <>
              {test.stats.totalNodes !== undefined && (
                <span className="flex items-center gap-1">
                  <span className="text-gray-400">📦</span>
                  {test.stats.totalNodes} nodes
                </span>
              )}
              {test.stats.sectionsDetected !== undefined && test.stats.sectionsDetected > 0 && (
                <span className="flex items-center gap-1">
                  <span className="text-gray-400">📑</span>
                  {test.stats.sectionsDetected} sections
                </span>
              )}
              {test.stats.imagesOrganized !== undefined && test.stats.imagesOrganized > 0 && (
                <span className="flex items-center gap-1">
                  <span className="text-gray-400">🖼️</span>
                  {test.stats.imagesOrganized} images
                </span>
              )}
              {(test.stats.totalFixes !== undefined || test.stats.classesOptimized !== undefined) && (
                <span className="flex items-center gap-1">
                  <span className="text-gray-400">⚡</span>
                  {test.stats.totalFixes || test.stats.classesOptimized || 0} fixes
                </span>
              )}
            </>
          )}
        </div>
      </div>

      {/* Actions */}
      <div className="flex items-center gap-2 flex-shrink-0">
        <button
          onClick={handleOpenPreview}
          className="p-2 bg-gray-50 hover:bg-blue-50 hover:text-blue-600 rounded-lg transition-all"
          title={t('home.card.open_preview')}
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
          </svg>
        </button>
        <button
          onClick={handleDelete}
          disabled={isDeleting}
          className="p-2 bg-gray-50 hover:bg-red-50 hover:text-red-600 rounded-lg transition-all disabled:opacity-50"
          title={t('home.card.delete')}
        >
          {isDeleting ? (
            <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
            </svg>
          ) : (
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
            </svg>
          )}
        </button>
        <button
          onClick={() => onSelect()}
          className="px-4 py-2 bg-gradient-to-r from-purple-600 to-blue-600 hover:from-purple-700 hover:to-blue-700 text-white text-sm font-medium rounded-lg transition-all flex items-center gap-2"
        >
          <span>{t('common.details')}</span>
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
          </svg>
        </button>
      </div>
    </div>
  )
}
