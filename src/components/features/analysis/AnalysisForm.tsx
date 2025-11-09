/**
 * AnalysisForm - Formulaire pour lancer une nouvelle analyse Figma
 * Affiche les logs en temps réel dans un terminal custom
 */

import { useState, useEffect, useRef } from 'react'
import { LazyLog } from 'react-lazylog'
import { useTranslation } from '../../../i18n/I18nContext'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog"
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Sparkles, ArrowRight, Loader2, X, AlertCircle, Trash2 } from 'lucide-react'

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
  const logContainerRef = useRef<HTMLDivElement | null>(null)

  // DEBUG: Track component lifecycle
  useEffect(() => {
    console.log('🔵 AnalysisForm MOUNTED')
    return () => console.log('🔴 AnalysisForm UNMOUNTED')
  }, [])

  // DEBUG: Track logs changes
  useEffect(() => {
    console.log('📝 Logs changed, length:', logs.length)
  }, [logs])

  // Cleanup EventSource on unmount
  useEffect(() => {
    return () => {
      if (eventSourceRef.current) {
        eventSourceRef.current.close()
      }
    }
  }, [])

  // Auto-scroll to bottom when new logs arrive (only during analysis)
  useEffect(() => {
    if (isAnalyzing && logContainerRef.current) {
      logContainerRef.current.scrollTop = logContainerRef.current.scrollHeight
    }
  }, [logs, isAnalyzing])

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
          console.log('✅ Analysis DONE, success:', message.success)
          setIsComplete(true)
          setIsSuccess(message.success)
          setIsAnalyzing(false)
          eventSource.close()

          // Refresh tests list automatically (HMR is now blocked via handleHotUpdate)
          if (onAnalysisComplete) {
            console.log('🔄 Calling onAnalysisComplete after analysis completion')
            onAnalysisComplete()
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
    console.log('🔄 handleReset called')
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

    // Refresh tests list when user manually resets
    if (onAnalysisComplete) {
      console.log('🔄 Calling onAnalysisComplete from handleReset')
      onAnalysisComplete()
    }
  }

  const handleClearLogs = () => {
    console.log('🗑️ handleClearLogs called')
    setLogs('')
  }

  // Réinitialiser l'erreur quand l'utilisateur modifie l'URL
  const handleUrlChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setFigmaUrl(e.target.value)
    if (urlError) {
      setUrlError(null)
    }
  }

  return (
    <Card className="mb-2 bg-primary text-primary-foreground">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Sparkles className="w-6 h-6" />
          {t('analysis.title')}
        </CardTitle>
      </CardHeader>
      <CardContent>

        {/* Form */}
        <form onSubmit={handleSubmit} className="mb-4">
          <div className="flex flex-col gap-2">
            <div className="flex gap-3">
              <Input
                type="text"
                value={figmaUrl}
                onChange={handleUrlChange}
                placeholder={t('analysis.placeholder')}
                disabled={isAnalyzing}
                className="flex-1 bg-primary-foreground text-primary"
              />
              <Button
                type="submit"
                disabled={isAnalyzing || !figmaUrl.trim()}
                variant="secondary"
                className="gap-2"
              >
                {isAnalyzing ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" />
                    {t('analysis.in_progress')}
                  </>
                ) : (
                  <>
                    <span>{t('analysis.launch')}</span>
                    <ArrowRight className="h-4 w-4" />
                  </>
                )}
              </Button>
            </div>

            {/* Error Dialog */}
            <AlertDialog open={!!urlError} onOpenChange={(open: boolean) => !open && setUrlError(null)}>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle className="flex items-center gap-2 text-destructive">
                    <AlertCircle className="h-5 w-5" />
                    {t('analysis.error_title')}
                  </AlertDialogTitle>
                  <AlertDialogDescription>
                    {urlError}
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogAction onClick={() => setUrlError(null)}>
                    {t('common.ok')}
                  </AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
        </div>
      </form>

        {/* Terminal Logs - Always visible */}
        <Card className="overflow-hidden bg-black border-0">
          {/* Terminal Header */}
          <div className="px-4 py-2 flex items-center justify-between border-b bg-muted">
            <div className="flex items-center gap-3">
              <div className="flex gap-1.5">
                <div className="w-3 h-3 rounded-full bg-destructive"></div>
                <div className="w-3 h-3 rounded-full bg-chart-4"></div>
                <div className="w-3 h-3 rounded-full bg-chart-2"></div>
              </div>
              <span className="text-sm font-mono text-muted-foreground">
                {!jobId && (
                  <span className="text-muted-foreground">Terminal ready</span>
                )}
                {isAnalyzing && (
                  <span className="text-chart-2">{t('analysis.status.in_progress')}</span>
                )}
                {isComplete && isSuccess && (
                  <span className="text-chart-2">{t('analysis.status.success')}</span>
                )}
                {isComplete && !isSuccess && (
                  <span className="text-destructive">{t('analysis.status.failed')}</span>
                )}
              </span>
            </div>
            <div className="flex items-center gap-2">
              {logs && (
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={handleClearLogs}
                  title="Clear logs"
                  className="h-8 w-8"
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              )}
              {jobId && (
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={handleReset}
                  title={t('common.close')}
                  className="h-8 w-8"
                >
                  <X className="h-4 w-4" />
                </Button>
              )}
            </div>
          </div>

          {/* Logs Display with react-lazylog */}
          <div style={{ backgroundColor: '#000000', padding: '12px 16px' }}>
            <LazyLog
              text={logs || `# ${t('analysis.helper')}\n# Paste a Figma URL with node-id parameter and click Launch\n\nWaiting for analysis...`}
              height={296}
              follow={isAnalyzing}
              selectableLines={true}
              enableSearch={false}
              caseInsensitive={true}
              extraLines={1}
              stream={false}
              style={{
                backgroundColor: '#000000',
                color: '#e5e7eb',
                fontSize: '13px',
                fontFamily: '"Fira Code", "Courier New", monospace',
                lineHeight: '1.5'
              }}
            />
          </div>
        </Card>
      </CardContent>
    </Card>
  )
}
