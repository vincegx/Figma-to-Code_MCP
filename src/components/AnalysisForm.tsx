/**
 * AnalysisForm - Formulaire pour lancer une nouvelle analyse Figma
 * Affiche les logs en temps réel avec react-lazylog
 */

import { useState, useEffect, useRef } from 'react'
import { LazyLog } from 'react-lazylog'
import { useTranslation } from '../i18n/I18nContext'

interface AnalysisFormProps {
  onAnalysisComplete?: () => void
}

export default function AnalysisForm({ onAnalysisComplete }: AnalysisFormProps) {
  const { t } = useTranslation()
  const [figmaUrl, setFigmaUrl] = useState('')
  const [isAnalyzing, setIsAnalyzing] = useState(false)
  const [jobId, setJobId] = useState<string | null>(null)
  const [logs, setLogs] = useState('')
  const [isComplete, setIsComplete] = useState(false)
  const [isSuccess, setIsSuccess] = useState(false)
  const [urlError, setUrlError] = useState<string | null>(null)
  const eventSourceRef = useRef<EventSource | null>(null)

  // Cleanup EventSource on unmount
  useEffect(() => {
    return () => {
      if (eventSourceRef.current) {
        eventSourceRef.current.close()
      }
    }
  }, [])

  // Validation de l'URL Figma
  const validateFigmaUrl = (url: string): string | null => {
    if (!url.trim()) {
      return t('analysis.validation.empty')
    }

    // Vérifier que c'est une URL Figma
    if (!url.includes('figma.com')) {
      return t('analysis.validation.not_figma')
    }

    // Vérifier que c'est une URL de design
    if (!url.includes('figma.com/design/')) {
      return t('analysis.validation.not_design')
    }

    // Vérifier la présence du paramètre node-id
    if (!url.includes('node-id=')) {
      return t('analysis.validation.missing_node_id')
    }

    // Vérifier le format du node-id (nombre-nombre ou nombre:nombre)
    const nodeIdMatch = url.match(/node-id=([0-9]+[-:][0-9]+)/)
    if (!nodeIdMatch) {
      return t('analysis.validation.invalid_node_id')
    }

    return null
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()

    // Valider l'URL
    const error = validateFigmaUrl(figmaUrl)
    if (error) {
      setUrlError(error)
      return
    }

    setUrlError(null)

    setIsAnalyzing(true)
    setIsComplete(false)
    setLogs(t('analysis.status.launching') + '\n\n')

    try {
      // Start analysis
      const response = await fetch('/api/analyze', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ figmaUrl })
      })

      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.error || 'Erreur lors du lancement de l\'analyse')
      }

      // Connect to SSE stream for logs
      const newJobId = data.jobId
      setJobId(newJobId)

      const eventSource = new EventSource(`/api/analyze/logs/${newJobId}`)
      eventSourceRef.current = eventSource

      eventSource.onmessage = (event) => {
        const message = JSON.parse(event.data)

        if (message.type === 'log') {
          setLogs((prev) => prev + message.message)
        } else if (message.type === 'done') {
          setIsComplete(true)
          setIsSuccess(message.success)
          setIsAnalyzing(false)
          eventSource.close()

          // Reload page to show new test with fresh images
          if (message.success) {
            setTimeout(() => {
              window.location.reload()
            }, 2000)
          }
        } else if (message.type === 'error') {
          setLogs((prev) => prev + message.message)
          setIsComplete(true)
          setIsSuccess(false)
          setIsAnalyzing(false)
          eventSource.close()
        }
      }

      eventSource.onerror = () => {
        setLogs((prev) => prev + '\n' + t('analysis.status.error_connection') + '\n')
        setIsComplete(true)
        setIsSuccess(false)
        setIsAnalyzing(false)
        eventSource.close()
      }
    } catch (error: any) {
      setLogs((prev) => prev + `\n✗ ${t('common.error')}: ${error.message}\n`)
      setIsComplete(true)
      setIsSuccess(false)
      setIsAnalyzing(false)
    }
  }

  const handleReset = () => {
    if (eventSourceRef.current) {
      eventSourceRef.current.close()
    }
    setJobId(null)
    setLogs('')
    setIsAnalyzing(false)
    setIsComplete(false)
    setIsSuccess(false)
    setFigmaUrl('')
    setUrlError(null)
  }

  // Réinitialiser l'erreur quand l'utilisateur modifie l'URL
  const handleUrlChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setFigmaUrl(e.target.value)
    if (urlError) {
      setUrlError(null)
    }
  }

  return (
    <div className="rounded-lg p-5 mb-2" style={{
      backgroundColor: 'var(--color-1)',
      boxShadow: 'var(--shadow-sm)',
      borderWidth: '1px',
      borderColor: 'var(--color-1)'
    }}>
      {/* Header */}
      <h2 className="text-xl font-semibold mb-4 flex items-center gap-2" style={{ color: 'var(--color-white)' }}>
        <svg className="w-6 h-6" viewBox="0 0 24 24" fill="currentColor">
          <path d="M9.813 15.904L9 18.75l-.813-2.846a4.5 4.5 0 00-3.09-3.09L2.25 12l2.846-.813a4.5 4.5 0 003.09-3.09L9 5.25l.813 2.846a4.5 4.5 0 003.09 3.09L15.75 12l-2.846.813a4.5 4.5 0 00-3.09 3.09zM18.259 8.715L18 9.75l-.259-1.035a3.375 3.375 0 00-2.455-2.456L14.25 6l1.036-.259a3.375 3.375 0 002.455-2.456L18 2.25l.259 1.035a3.375 3.375 0 002.456 2.456L21.75 6l-1.035.259a3.375 3.375 0 00-2.456 2.456zM16.894 20.567L16.5 21.75l-.394-1.183a2.25 2.25 0 00-1.423-1.423L13.5 18.75l1.183-.394a2.25 2.25 0 001.423-1.423l.394-1.183.394 1.183a2.25 2.25 0 001.423 1.423l1.183.394-1.183.394a2.25 2.25 0 00-1.423 1.423z" />
        </svg>
        {t('analysis.title')}
      </h2>

      {/* Form */}
      <form onSubmit={handleSubmit} className="mb-4">
        <div className="flex flex-col gap-2">
          <div className="flex gap-3">
            <input
              type="text"
              value={figmaUrl}
              onChange={handleUrlChange}
              placeholder={t('analysis.placeholder')}
              disabled={isAnalyzing}
              className="flex-1 px-4 py-2 rounded-lg transition-colors disabled:cursor-not-allowed"
              style={{
                backgroundColor: isAnalyzing ? 'var(--color-1)' : 'var(--color-white)',
                borderWidth: '1px',
                // borderColor: urlError ? 'var(--status-error-border)' : 'var(--border-primary)',
                color: isAnalyzing ? 'var(--text-primary)' : 'var(--color-1)',
                outline: 'none'
              }}
              onFocus={(e) => {
                if (!urlError) {
                  e.currentTarget.style.boxShadow = 'var(--focus-ring)'
                  e.currentTarget.style.borderColor = 'var(--accent-primary)'
                }
              }}
              onBlur={(e) => {
                e.currentTarget.style.boxShadow = 'none'
                e.currentTarget.style.borderColor = urlError ? 'var(--status-error-border)' : 'var(--border-primary)'
              }}
            />
            <button
              type="submit"
              disabled={isAnalyzing || !figmaUrl.trim()}
              className="px-6 py-2 font-medium rounded-lg transition-colors disabled:cursor-not-allowed flex items-center gap-2"
              style={{
                background: (isAnalyzing || !figmaUrl.trim()) ? 'var(--color-5)' : 'var(--color-4)',
                color: (isAnalyzing || !figmaUrl.trim()) ? 'var(--text-muted)' : 'var(--text-primary)'
              }}
              onMouseEnter={(e) => {
                if (!isAnalyzing && figmaUrl.trim()) {
                  e.currentTarget.style.background = 'var(--button-primary-hover)'
                }
              }}
              onMouseLeave={(e) => {
                if (!isAnalyzing && figmaUrl.trim()) {
                  e.currentTarget.style.background = 'var(--color-4)'
                }
              }}
            >
              {isAnalyzing ? (
                <>
                  <div className="animate-spin rounded-full h-4 w-4 border-2 border-t-transparent" style={{ borderColor: 'var(--text-muted)' }}></div>
                  {t('analysis.in_progress')}
                </>
              ) : (
                <>
                  <span>{t('analysis.launch')}</span>
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14 5l7 7m0 0l-7 7m7-7H3" />
                  </svg>
                </>
              )}
            </button>
          </div>

          {/* Error Message */}
          {urlError && (
            <div className="flex items-start gap-2 px-3 py-2 rounded-lg" style={{
              backgroundColor: 'var(--status-error-bg)',
              borderWidth: '1px',
              borderColor: 'var(--status-error-border)'
            }}>
              <svg className="w-5 h-5 flex-shrink-0 mt-0.5" style={{ color: 'var(--status-error-text)' }} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              <p className="text-sm" style={{ color: 'var(--status-error-text)' }}>{urlError}</p>
            </div>
          )}
        </div>
      </form>

      {/* Terminal Logs */}
      {jobId && (
        <div className="rounded-lg overflow-hidden" style={{
          backgroundColor: 'var(--bg-overlay-dark)',
          borderWidth: '1px',
          borderColor: 'var(--border-primary)'
        }}>
          {/* Terminal Header */}
          <div className="px-4 py-2 flex items-center justify-between" style={{
            backgroundColor: 'var(--bg-overlay-medium)',
            borderBottom: '1px solid',
            borderColor: 'var(--border-primary)'
          }}>
            <div className="flex items-center gap-3">
              <div className="flex gap-1.5">
                <div className="w-3 h-3 rounded-full" style={{ backgroundColor: 'var(--status-error-text)' }}></div>
                <div className="w-3 h-3 rounded-full" style={{ backgroundColor: 'var(--status-warning-text)' }}></div>
                <div className="w-3 h-3 rounded-full" style={{ backgroundColor: 'var(--status-success-text)' }}></div>
              </div>
              <span className="text-sm font-mono" style={{ color: 'var(--text-secondary)' }}>
                {isAnalyzing && (
                  <span style={{ color: 'var(--status-success-text)' }}>{t('analysis.status.in_progress')}</span>
                )}
                {isComplete && isSuccess && (
                  <span style={{ color: 'var(--status-success-text)' }}>{t('analysis.status.success')}</span>
                )}
                {isComplete && !isSuccess && (
                  <span style={{ color: 'var(--status-error-text)' }}>{t('analysis.status.failed')}</span>
                )}
              </span>
            </div>
            <button
              onClick={handleReset}
              className="transition-colors"
              style={{ color: 'var(--text-muted)' }}
              onMouseEnter={(e) => e.currentTarget.style.color = 'var(--text-inverse)'}
              onMouseLeave={(e) => e.currentTarget.style.color = 'var(--text-muted)'}
              title={t('common.close')}
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>

          {/* Logs Display with react-lazylog */}
          <div style={{ backgroundColor: '#000000' }}>
            <LazyLog
              text={logs}
              height={320}
              follow={true}
              selectableLines={true}
              enableSearch={true}
              caseInsensitive={true}
              extraLines={1}
              stream={isAnalyzing}
              style={{
                backgroundColor: '#000000',
                color: '#e5e7eb',
                fontSize: '13px',
                fontFamily: '"Fira Code", "Courier New", monospace',
                lineHeight: '1.5'
              }}
            />
          </div>

          {/* Footer Actions */}
          {isComplete && (
            <div className="px-4 py-3 flex items-center justify-between" style={{
              backgroundColor: 'var(--bg-overlay-medium)',
              borderTop: '1px solid',
              borderColor: 'var(--border-primary)'
            }}>
              <span className="text-sm" style={{ color: 'var(--text-muted)' }}>
                {isSuccess
                  ? t('analysis.footer.success_message')
                  : t('analysis.footer.error_message')}
              </span>
              <button
                onClick={handleReset}
                className="px-4 py-1.5 text-sm font-medium rounded transition-colors"
                style={{
                  background: 'var(--button-primary-bg)',
                  color: 'var(--button-primary-text)'
                }}
                onMouseEnter={(e) => e.currentTarget.style.background = 'var(--button-primary-hover)'}
                onMouseLeave={(e) => e.currentTarget.style.background = 'var(--button-primary-bg)'}
              >
                {t('analysis.footer.new_export')}
              </button>
            </div>
          )}
        </div>
      )}

      {/* Helper Text */}
      {!jobId && (
        <p className="text-sm mt-3" style={{ color: 'var(--color-white)' }}>
          {t('analysis.helper')} <code className="px-1 rounded" style={{ backgroundColor: 'var(--color-5)', color: 'var(--color-black)' }}>node-id</code>
        </p>
      )}
    </div>
  )
}
