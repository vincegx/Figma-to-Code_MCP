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
      <div className="min-h-screen flex items-center justify-center" style={{ backgroundColor: 'var(--bg-primary)' }}>
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 mx-auto mb-4" style={{ borderColor: 'var(--accent-primary)' }}></div>
          <p style={{ color: 'var(--text-secondary)' }}>{t('detail.loading')}</p>
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="min-h-screen flex items-center justify-center" style={{ backgroundColor: 'var(--bg-primary)' }}>
        <div className="text-center max-w-md">
          <div className="text-6xl mb-4">❌</div>
          <h3 className="text-xl font-semibold mb-2" style={{ color: 'var(--text-primary)' }}>
            {t('detail.error.title')}
          </h3>
          <p className="mb-6" style={{ color: 'var(--text-secondary)' }}>{error}</p>
          <button
            onClick={onBack}
            className="px-4 py-2 rounded-lg transition-all"
            style={{
              background: 'var(--button-primary-bg)',
              color: 'var(--button-primary-text)'
            }}
            onMouseEnter={(e) => e.currentTarget.style.background = 'var(--button-primary-hover)'}
            onMouseLeave={(e) => e.currentTarget.style.background = 'var(--button-primary-bg)'}
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
    <div className="min-h-screen" style={{ backgroundColor: 'var(--bg-primary)' }}>
      {/* Header */}
      <header style={{
        background: 'linear-gradient(to bottom right, var(--bg-secondary), var(--accent-secondary))',
        borderBottom: '1px solid',
        borderColor: 'var(--border-primary)'
      }}>
        <div className="max-w-7xl mx-auto px-6 py-6">
          {/* Back button + Title row */}
          <div className="flex items-start justify-between mb-4">
            <div className="flex items-start gap-4">
              <button
                onClick={onBack}
                className="mt-1 p-2.5 backdrop-blur-sm rounded-xl transition-all"
                style={{
                  backgroundColor: 'var(--bg-card)',
                  boxShadow: 'var(--shadow-sm)',
                  borderWidth: '1px',
                  borderColor: 'var(--border-primary)',
                  color: 'var(--text-primary)'
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.boxShadow = 'var(--shadow-md)'
                  e.currentTarget.style.backgroundColor = 'var(--bg-hover)'
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.boxShadow = 'var(--shadow-sm)'
                  e.currentTarget.style.backgroundColor = 'var(--bg-card)'
                }}
                title="Retour"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                </svg>
              </button>
              <div className="flex-1">
                <div className="flex items-center gap-3 mb-2">
                  <h1 className="text-3xl font-bold" style={{ color: 'var(--text-primary)' }}>
                    {metadata?.layerName || metadata?.fileName || 'Test'}
                  </h1>
                  {metadata?.figmaNodeId && (
                    <span className="px-3 py-1 backdrop-blur-sm text-xs rounded-lg font-mono" style={{
                      backgroundColor: 'var(--bg-overlay-dark)',
                      color: 'var(--text-inverse)'
                    }}>
                      #{nodeIdDisplay}
                    </span>
                  )}
                </div>
                <div className="flex items-center gap-3 text-sm" style={{ color: 'var(--text-secondary)' }}>
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
                  <span className="text-[10px] font-mono ml-2" style={{ color: 'var(--text-muted)' }}>{testId}</span>
                </div>
              </div>
            </div>

            <div className="flex items-center gap-3">
              <a
                href={`http://localhost:5173/?preview=true&test=${testId}`}
                target="_blank"
                rel="noopener noreferrer"
                className="px-4 py-2.5 text-sm font-medium rounded-xl transition-all flex items-center gap-2"
                style={{
                  background: 'var(--status-info-bg)',
                  color: 'var(--status-info-text)',
                  boxShadow: 'var(--shadow-md)'
                }}
                onMouseEnter={(e) => e.currentTarget.style.boxShadow = 'var(--shadow-lg)'}
                onMouseLeave={(e) => e.currentTarget.style.boxShadow = 'var(--shadow-md)'}
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                </svg>
                Preview
              </a>
              <a
                href={`/api/download/${testId}`}
                download={`${testId}.zip`}
                className="px-4 py-2.5 text-sm font-medium rounded-xl transition-all flex items-center gap-2"
                style={{
                  background: 'var(--status-success-bg)',
                  color: 'var(--status-success-text)',
                  boxShadow: 'var(--shadow-md)'
                }}
                onMouseEnter={(e) => e.currentTarget.style.boxShadow = 'var(--shadow-lg)'}
                onMouseLeave={(e) => e.currentTarget.style.boxShadow = 'var(--shadow-md)'}
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                </svg>
                Download
              </a>
              <a
                href={metadata?.figmaUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="px-4 py-2.5 text-sm font-medium rounded-xl transition-all flex items-center gap-2"
                style={{
                  background: 'var(--button-primary-bg)',
                  color: 'var(--button-primary-text)',
                  boxShadow: 'var(--shadow-md)'
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.background = 'var(--button-primary-hover)'
                  e.currentTarget.style.boxShadow = 'var(--shadow-lg)'
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.background = 'var(--button-primary-bg)'
                  e.currentTarget.style.boxShadow = 'var(--shadow-md)'
                }}
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
            <div className="flex items-center gap-3 mt-4 pt-4" style={{
              borderTop: '1px solid',
              borderColor: 'var(--border-light)'
            }}>
              {metadata.stats.totalNodes !== undefined && (
                <div className="flex items-center gap-2 px-3 py-2 backdrop-blur-sm rounded-lg" style={{
                  backgroundColor: 'var(--bg-card)',
                  borderWidth: '1px',
                  borderColor: 'var(--border-subtle)',
                  boxShadow: 'var(--shadow-sm)'
                }}>
                  <span style={{ color: 'var(--text-muted)' }}>📦</span>
                  <span className="text-sm font-medium" style={{ color: 'var(--text-primary)' }}>{metadata.stats.totalNodes}</span>
                  <span className="text-xs" style={{ color: 'var(--text-secondary)' }}>{t('common.nodes')}</span>
                </div>
              )}
              {metadata.stats.sectionsDetected !== undefined && metadata.stats.sectionsDetected > 0 && (
                <div className="flex items-center gap-2 px-3 py-2 backdrop-blur-sm rounded-lg" style={{
                  backgroundColor: 'var(--bg-card)',
                  borderWidth: '1px',
                  borderColor: 'var(--border-subtle)',
                  boxShadow: 'var(--shadow-sm)'
                }}>
                  <span style={{ color: 'var(--text-muted)' }}>📑</span>
                  <span className="text-sm font-medium" style={{ color: 'var(--text-primary)' }}>{metadata.stats.sectionsDetected}</span>
                  <span className="text-xs" style={{ color: 'var(--text-secondary)' }}>{t('common.sections')}</span>
                </div>
              )}
              {metadata.stats.imagesOrganized !== undefined && metadata.stats.imagesOrganized > 0 && (
                <div className="flex items-center gap-2 px-3 py-2 backdrop-blur-sm rounded-lg" style={{
                  backgroundColor: 'var(--bg-card)',
                  borderWidth: '1px',
                  borderColor: 'var(--border-subtle)',
                  boxShadow: 'var(--shadow-sm)'
                }}>
                  <span style={{ color: 'var(--text-muted)' }}>🖼️</span>
                  <span className="text-sm font-medium" style={{ color: 'var(--text-primary)' }}>{metadata.stats.imagesOrganized}</span>
                  <span className="text-xs" style={{ color: 'var(--text-secondary)' }}>{t('common.images')}</span>
                </div>
              )}
              {(metadata.stats.totalFixes !== undefined || metadata.stats.classesOptimized !== undefined) && (
                <div className="flex items-center gap-2 px-3 py-2 backdrop-blur-sm rounded-lg" style={{
                  backgroundColor: 'var(--bg-card)',
                  borderWidth: '1px',
                  borderColor: 'var(--border-subtle)',
                  boxShadow: 'var(--shadow-sm)'
                }}>
                  <span style={{ color: 'var(--text-muted)' }}>⚡</span>
                  <span className="text-sm font-medium" style={{ color: 'var(--text-primary)' }}>
                    {metadata.stats.totalFixes || metadata.stats.classesOptimized || 0}
                  </span>
                  <span className="text-xs" style={{ color: 'var(--text-secondary)' }}>{t('common.fixes')}</span>
                </div>
              )}
            </div>
          )}
        </div>
      </header>

      {/* Tabs */}
      <nav style={{
        backgroundColor: 'var(--bg-card)',
        borderBottom: '1px solid',
        borderColor: 'var(--border-primary)'
      }}>
        <div className="max-w-7xl mx-auto px-6">
          <div className="flex justify-between items-center">
            <div className="flex space-x-8">
              <button
                onClick={() => setActiveTab('preview')}
                className="py-4 px-1 font-medium text-sm transition-colors"
                style={{
                  borderBottom: '2px solid',
                  borderColor: activeTab === 'preview' ? 'var(--accent-primary)' : 'transparent',
                  color: activeTab === 'preview' ? 'var(--accent-primary)' : 'var(--text-secondary)'
                }}
                onMouseEnter={(e) => {
                  if (activeTab !== 'preview') {
                    e.currentTarget.style.color = 'var(--text-primary)'
                    e.currentTarget.style.borderColor = 'var(--border-primary)'
                  }
                }}
                onMouseLeave={(e) => {
                  if (activeTab !== 'preview') {
                    e.currentTarget.style.color = 'var(--text-secondary)'
                    e.currentTarget.style.borderColor = 'transparent'
                  }
                }}
              >
                {t('detail.tabs.preview')}
              </button>
              <button
                onClick={() => setActiveTab('report')}
                className="py-4 px-1 font-medium text-sm transition-colors"
                style={{
                  borderBottom: '2px solid',
                  borderColor: activeTab === 'report' ? 'var(--accent-primary)' : 'transparent',
                  color: activeTab === 'report' ? 'var(--accent-primary)' : 'var(--text-secondary)'
                }}
                onMouseEnter={(e) => {
                  if (activeTab !== 'report') {
                    e.currentTarget.style.color = 'var(--text-primary)'
                    e.currentTarget.style.borderColor = 'var(--border-primary)'
                  }
                }}
                onMouseLeave={(e) => {
                  if (activeTab !== 'report') {
                    e.currentTarget.style.color = 'var(--text-secondary)'
                    e.currentTarget.style.borderColor = 'transparent'
                  }
                }}
              >
                {t('detail.tabs.report')}
              </button>
              <button
                onClick={() => setActiveTab('code')}
                className="py-4 px-1 font-medium text-sm transition-colors"
                style={{
                  borderBottom: '2px solid',
                  borderColor: activeTab === 'code' ? 'var(--accent-primary)' : 'transparent',
                  color: activeTab === 'code' ? 'var(--accent-primary)' : 'var(--text-secondary)'
                }}
                onMouseEnter={(e) => {
                  if (activeTab !== 'code') {
                    e.currentTarget.style.color = 'var(--text-primary)'
                    e.currentTarget.style.borderColor = 'var(--border-primary)'
                  }
                }}
                onMouseLeave={(e) => {
                  if (activeTab !== 'code') {
                    e.currentTarget.style.color = 'var(--text-secondary)'
                    e.currentTarget.style.borderColor = 'transparent'
                  }
                }}
              >
                {t('detail.tabs.code')}
              </button>
              <button
                onClick={() => setActiveTab('technical')}
                className="py-4 px-1 font-medium text-sm transition-colors"
                style={{
                  borderBottom: '2px solid',
                  borderColor: activeTab === 'technical' ? 'var(--accent-primary)' : 'transparent',
                  color: activeTab === 'technical' ? 'var(--accent-primary)' : 'var(--text-secondary)'
                }}
                onMouseEnter={(e) => {
                  if (activeTab !== 'technical') {
                    e.currentTarget.style.color = 'var(--text-primary)'
                    e.currentTarget.style.borderColor = 'var(--border-primary)'
                  }
                }}
                onMouseLeave={(e) => {
                  if (activeTab !== 'technical') {
                    e.currentTarget.style.color = 'var(--text-secondary)'
                    e.currentTarget.style.borderColor = 'transparent'
                  }
                }}
              >
                {t('detail.tabs.technical')}
              </button>
            </div>

            {/* Info button with hover tooltip */}
            {activeTab === 'preview' && (
              <div className="relative group">
                <button className="flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium rounded-full transition-all duration-200" style={{
                  color: 'var(--text-secondary)',
                  backgroundColor: 'var(--bg-secondary)',
                  borderWidth: '1px',
                  borderColor: 'var(--border-primary)',
                  boxShadow: 'var(--shadow-sm)'
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.color = 'var(--status-info-text)'
                  e.currentTarget.style.backgroundColor = 'var(--status-info-bg)'
                  e.currentTarget.style.borderColor = 'var(--status-info-border)'
                  e.currentTarget.style.boxShadow = 'var(--shadow-md)'
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.color = 'var(--text-secondary)'
                  e.currentTarget.style.backgroundColor = 'var(--bg-secondary)'
                  e.currentTarget.style.borderColor = 'var(--border-primary)'
                  e.currentTarget.style.boxShadow = 'var(--shadow-sm)'
                }}>
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                  <span>Info</span>
                </button>

                {/* Tooltip on hover */}
                <div className="absolute right-0 top-full mt-3 w-96 rounded-xl opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all duration-200 z-50 overflow-hidden" style={{
                  backgroundColor: 'var(--bg-card)',
                  borderWidth: '1px',
                  borderColor: 'var(--border-primary)',
                  boxShadow: 'var(--shadow-lg)'
                }}>
                  {/* Info section */}
                  <div className="p-4" style={{
                    background: 'linear-gradient(to bottom right, var(--status-info-bg), var(--bg-secondary))',
                    borderBottom: '1px solid',
                    borderColor: 'var(--status-info-border)'
                  }}>
                    <div className="flex items-start gap-3">
                      <div className="flex-shrink-0 w-8 h-8 rounded-lg flex items-center justify-center text-lg" style={{
                        backgroundColor: 'var(--status-info-text)',
                        color: 'var(--bg-card)',
                        boxShadow: 'var(--shadow-sm)'
                      }}>
                        ℹ️
                      </div>
                      <div className="text-sm flex-1">
                        <p className="font-semibold mb-1" style={{ color: 'var(--text-primary)' }}>{t('detail.preview.banner_title')}</p>
                        <p className="leading-relaxed" style={{ color: 'var(--text-secondary)' }}>{t('detail.preview.banner_text')}</p>
                      </div>
                    </div>
                  </div>

                  {/* Tips section */}
                  <div className="p-4" style={{
                    background: 'linear-gradient(to bottom right, var(--status-success-bg), var(--bg-secondary))'
                  }}>
                    <div className="flex items-center gap-2 mb-3">
                      <div className="flex-shrink-0 w-6 h-6 rounded-md flex items-center justify-center text-sm" style={{
                        backgroundColor: 'var(--status-success-text)',
                        color: 'var(--bg-card)',
                        boxShadow: 'var(--shadow-sm)'
                      }}>
                        💡
                      </div>
                      <p className="text-sm font-semibold" style={{ color: 'var(--text-primary)' }}>{t('detail.preview.tips_title')}</p>
                    </div>
                    <ul className="text-sm space-y-2 ml-8" style={{ color: 'var(--text-secondary)' }}>
                      {metadata?.dimensions && (
                        <li className="flex items-start gap-2">
                          <span className="mt-0.5" style={{ color: 'var(--status-success-text)' }}>→</span>
                          <span>{t('detail.preview.tips.0', { width: metadata.dimensions.width.toString(), height: metadata.dimensions.height.toString() })}</span>
                        </li>
                      )}
                      <li className="flex items-start gap-2">
                        <span className="mt-0.5" style={{ color: 'var(--status-success-text)' }}>→</span>
                        <span>{t('detail.preview.tips.1')}</span>
                      </li>
                      <li className="flex items-start gap-2">
                        <span className="mt-0.5" style={{ color: 'var(--status-success-text)' }}>→</span>
                        <span>{t('detail.preview.tips.2')}</span>
                      </li>
                      <li className="flex items-start gap-2">
                        <span className="mt-0.5" style={{ color: 'var(--status-success-text)' }}>→</span>
                        <span>{t('detail.preview.tips.3')}</span>
                      </li>
                      <li className="flex items-start gap-2">
                        <span className="mt-0.5" style={{ color: 'var(--status-success-text)' }}>→</span>
                        <span>{t('detail.preview.tips.4')}</span>
                      </li>
                    </ul>
                  </div>
                </div>
              </div>
            )}
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
      <div className="rounded-lg p-12 text-center" style={{
        backgroundColor: 'var(--bg-card)',
        boxShadow: 'var(--shadow-sm)',
        borderWidth: '1px',
        borderColor: 'var(--border-primary)'
      }}>
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 mx-auto mb-4" style={{ borderColor: 'var(--accent-primary)' }}></div>
        <p style={{ color: 'var(--text-secondary)' }}>{t('detail.preview.loading_component')}</p>
      </div>
    )
  }

  if (error) {
    return (
      <div className="rounded-lg p-12 text-center" style={{
        backgroundColor: 'var(--bg-card)',
        boxShadow: 'var(--shadow-sm)',
        borderWidth: '1px',
        borderColor: 'var(--border-primary)'
      }}>
        <div className="text-6xl mb-4">⚠️</div>
        <h3 className="text-xl font-semibold mb-2" style={{ color: 'var(--text-primary)' }}>
          {t('detail.preview.error_title')}
        </h3>
        <p className="mb-4" style={{ color: 'var(--text-secondary)' }}>{error}</p>
        <p className="text-sm" style={{ color: 'var(--text-muted)' }}>
          {t('detail.preview.error_text')}
        </p>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Responsive Controls - Sticky */}
      <div className="sticky top-0 z-10 py-4" style={{
        backgroundColor: 'var(--bg-primary)',
        boxShadow: 'var(--shadow-sm)'
      }}>
        <div className="max-w-7xl mx-auto px-6">
          <div className="rounded-lg p-6" style={{
            backgroundColor: 'var(--bg-card)',
            boxShadow: 'var(--shadow-sm)',
            borderWidth: '1px',
            borderColor: 'var(--border-primary)'
          }}>
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-semibold" style={{ color: 'var(--text-primary)' }}>{t('detail.preview.responsive_test')}</h3>
              <div className="flex items-center gap-2">
                {dimensions && viewportWidth === dimensions.width && (
                  <span className="text-sm px-2 py-1 rounded flex items-center gap-1" style={{
                    backgroundColor: 'var(--status-success-bg)',
                    color: 'var(--status-success-text)'
                  }}>
                    <span>🎯</span> {t('detail.preview.native')}
                  </span>
                )}
                <div className="text-sm font-mono px-3 py-1.5 rounded" style={{
                  backgroundColor: 'var(--accent-secondary)',
                  color: 'var(--accent-primary)'
                }}>
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
                className="px-3 py-2 text-sm rounded-lg transition-all"
                style={{
                  backgroundColor: viewportWidth === preset.width ? 'var(--accent-primary)' : 'var(--bg-card)',
                  color: viewportWidth === preset.width ? 'var(--button-primary-text)' : 'var(--text-primary)',
                  borderWidth: '1px',
                  borderColor: viewportWidth === preset.width ? 'var(--accent-primary)' : 'var(--border-primary)'
                }}
                onMouseEnter={(e) => {
                  if (viewportWidth !== preset.width) {
                    e.currentTarget.style.borderColor = 'var(--accent-hover)'
                  }
                }}
                onMouseLeave={(e) => {
                  if (viewportWidth !== preset.width) {
                    e.currentTarget.style.borderColor = 'var(--border-primary)'
                  }
                }}
              >
                {preset.icon} {preset.name} ({preset.width}px)
              </button>
            ))}

            {/* Custom width input */}
            <div className="flex items-center gap-2">
              <div className="flex items-center rounded-lg transition-all" style={{
                backgroundColor: 'var(--bg-card)',
                borderWidth: isCustomWidth ? '2px' : '1px',
                borderColor: isCustomWidth ? 'var(--accent-primary)' : 'var(--border-primary)',
                boxShadow: isCustomWidth ? 'var(--focus-ring)' : 'none'
              }}>
                <span className="pl-3 pr-1 text-sm" style={{ color: 'var(--text-muted)' }}>✏️</span>
                <input
                  type="text"
                  value={customInput}
                  onChange={(e) => handleCustomWidthChange(e.target.value)}
                  placeholder="Custom"
                  className="w-16 px-2 py-2 text-sm outline-none"
                  style={{
                    backgroundColor: 'transparent',
                    color: 'var(--text-primary)'
                  }}
                />
                <span className="pr-3 pl-1 text-xs" style={{ color: 'var(--text-muted)' }}>px</span>
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
              className="w-full h-2 rounded-lg appearance-none cursor-pointer"
              style={{
                backgroundColor: 'var(--bg-hover)',
                accentColor: 'var(--accent-primary)'
              }}
            />
            <div className="flex justify-between text-xs" style={{ color: 'var(--text-muted)' }}>
              <span>{minWidth}px</span>
              <span>{maxWidth}px</span>
            </div>
          </div>
          </div>
        </div>
      </div>

      {/* Component Render - Full width container */}
      <div className="overflow-hidden" style={{
        backgroundColor: 'var(--bg-card)',
        borderTop: '1px solid',
        borderBottom: '1px solid',
        borderColor: 'var(--border-primary)'
      }}>
        <div className="px-6 py-3 flex items-center justify-between" style={{
          backgroundColor: 'var(--bg-secondary)',
          borderBottom: '1px solid',
          borderColor: 'var(--border-primary)'
        }}>
          <h3 className="font-semibold" style={{ color: 'var(--text-primary)' }}>
            {t('detail.preview.component_label')} {componentName}
          </h3>
          <div className="text-xs" style={{ color: 'var(--text-muted)' }}>
            {t('detail.preview.react_tailwind')}
          </div>
        </div>

        {/* Full width viewport simulator */}
        <div className="min-h-[600px] flex justify-center items-start py-8" style={{
          background: 'linear-gradient(to bottom right, var(--bg-primary), var(--bg-secondary))'
        }}>
          <div
            className="shadow-xl transition-all duration-300 ease-in-out overflow-auto"
            style={{
              backgroundColor: 'var(--bg-card)',
              width: `${viewportWidth}px`,
              maxWidth: '100%',
              minHeight: '500px'
            }}
          >
            {Component && (
              <Suspense fallback={<div className="p-8 text-center" style={{ color: 'var(--text-muted)' }}>Loading component...</div>}>
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
    return <div style={{ padding: '40px', textAlign: 'center', color: 'var(--text-secondary)' }}>{t('detail.code.loading')}</div>
  }

  if (files.length === 0) {
    return <div style={{ padding: '40px', textAlign: 'center', color: 'var(--text-secondary)' }}>{t('detail.code.no_files')}</div>
  }

  const selectedFile = files[selectedIndex]

  // Séparer les fichiers principaux des chunks
  const mainFiles = files.filter(f => !f.name.startsWith('chunks/'))
  const chunkFiles = files.filter(f => f.name.startsWith('chunks/'))

  return (
    <div>
      {/* NAVIGATION - Boutons pour chaque fichier */}
      <div style={{
        backgroundColor: 'var(--bg-secondary)',
        borderRadius: '8px',
        padding: '16px',
        marginBottom: '16px',
        border: '1px solid',
        borderColor: 'var(--border-primary)'
      }}>
        <div style={{ fontWeight: 'bold', marginBottom: '16px', fontSize: '16px', color: 'var(--text-primary)' }}>
          📁 Navigation des fichiers ({files.length} fichiers)
        </div>

        {/* Fichiers principaux */}
        <div style={{ marginBottom: '20px' }}>
          <div style={{
            fontSize: '12px',
            fontWeight: '600',
            color: 'var(--text-secondary)',
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
                    border: selectedIndex === actualIndex ? '2px solid' : '1px solid',
                    borderColor: selectedIndex === actualIndex ? 'var(--accent-primary)' : 'var(--border-primary)',
                    borderRadius: '6px',
                    backgroundColor: selectedIndex === actualIndex ? 'var(--accent-secondary)' : 'var(--bg-card)',
                    color: selectedIndex === actualIndex ? 'var(--accent-primary)' : 'var(--text-primary)',
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
              color: 'var(--text-secondary)',
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
                      border: selectedIndex === actualIndex ? '2px solid' : '1px solid',
                      borderColor: selectedIndex === actualIndex ? 'var(--accent-primary)' : 'var(--border-primary)',
                      borderRadius: '6px',
                      backgroundColor: selectedIndex === actualIndex ? 'var(--accent-secondary)' : 'var(--bg-card)',
                      color: selectedIndex === actualIndex ? 'var(--accent-primary)' : 'var(--text-primary)',
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
        backgroundColor: 'var(--bg-card)',
        borderRadius: '8px',
        border: '1px solid',
        borderColor: 'var(--border-primary)',
        overflow: 'hidden'
      }}>
        {/* Header */}
        <div style={{
          backgroundColor: 'var(--bg-overlay-dark)',
          color: 'var(--text-inverse)',
          padding: '12px 24px',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <span style={{ fontSize: '18px' }}>{selectedFile.icon}</span>
            <span style={{ fontWeight: 'bold', fontSize: '14px' }}>{selectedFile.name}</span>
          </div>
          <div style={{ fontSize: '12px', color: 'var(--text-muted)' }}>
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
    <div className="rounded-lg overflow-hidden" style={{
      backgroundColor: 'var(--bg-card)',
      boxShadow: 'var(--shadow-sm)',
      borderWidth: '1px',
      borderColor: 'var(--border-primary)'
    }}>
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
      <div className="rounded-lg p-12 text-center" style={{
        backgroundColor: 'var(--bg-card)',
        boxShadow: 'var(--shadow-sm)',
        borderWidth: '1px',
        borderColor: 'var(--border-primary)'
      }}>
        <div className="text-6xl mb-4">📄</div>
        <h3 className="text-xl font-semibold mb-2" style={{ color: 'var(--text-primary)' }}>
          {t('detail.technical.no_analysis_title')}
        </h3>
        <p style={{ color: 'var(--text-secondary)' }}>
          {t('detail.technical.no_analysis_text')}
        </p>
      </div>
    )
  }

  return (
    <div className="space-y-4">
      {/* Info banner */}
      <div className="rounded-lg p-4" style={{
        backgroundColor: 'var(--status-info-bg)',
        borderWidth: '1px',
        borderColor: 'var(--status-info-border)'
      }}>
        <div className="flex items-start gap-3">
          <div className="text-xl" style={{ color: 'var(--status-info-text)' }}>🔧</div>
          <div className="text-sm">
            <p className="font-semibold mb-1" style={{ color: 'var(--text-primary)' }}>{t('detail.technical.banner_title')}</p>
            <p style={{ color: 'var(--text-secondary)' }}>
              {t('detail.technical.banner_text')}
            </p>
          </div>
        </div>
      </div>

      {/* Markdown code viewer */}
      <div className="rounded-lg overflow-hidden" style={{
        backgroundColor: 'var(--bg-card)',
        boxShadow: 'var(--shadow-sm)',
        borderWidth: '1px',
        borderColor: 'var(--border-primary)'
      }}>
        <div className="px-6 py-3 flex items-center justify-between" style={{
          backgroundColor: 'var(--bg-overlay-dark)',
          color: 'var(--text-inverse)'
        }}>
          <h3 className="font-semibold">analysis.md</h3>
          <div className="text-xs" style={{ color: 'var(--text-muted)' }}>
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

