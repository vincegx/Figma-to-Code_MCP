import { useState, useEffect, useRef } from 'react'
import { CheckCircle, Loader2, AlertCircle, ExternalLink } from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Label } from "@/components/ui/label"
import { Input } from "@/components/ui/input"
import { Progress } from "@/components/ui/progress"
import {
  Alert,
  AlertDescription,
} from "@/components/ui/alert"

interface AnalysisDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  onAnalysisComplete?: () => void
}

type DialogState = 'form' | 'progress' | 'success'

export function AnalysisDialog({ open, onOpenChange, onAnalysisComplete }: AnalysisDialogProps) {
  const navigate = useNavigate()
  const [state, setState] = useState<DialogState>('form')
  const [figmaUrl, setFigmaUrl] = useState('')
  const [urlError, setUrlError] = useState<string | null>(null)
  const [logs, setLogs] = useState<string[]>([])
  const [progress, setProgress] = useState(0)
  const [testId, setTestId] = useState<string>('')
  const eventSourceRef = useRef<EventSource | null>(null)

  // Reset state when dialog closes
  useEffect(() => {
    if (!open) {
      setTimeout(() => {
        setState('form')
        setFigmaUrl('')
        setUrlError(null)
        setLogs([])
        setProgress(0)
        setTestId('')
        if (eventSourceRef.current) {
          eventSourceRef.current.close()
        }
      }, 200)
    }
  }, [open])

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
      return 'L\'URL est requise'
    }

    if (!url.includes('figma.com')) {
      return 'L\'URL doit être une URL Figma'
    }

    if (!url.includes('figma.com/design/')) {
      return 'L\'URL doit être une URL de design Figma'
    }

    if (!url.includes('node-id=')) {
      return 'L\'URL doit contenir un paramètre node-id'
    }

    const nodeIdMatch = url.match(/node-id=([0-9]+[-:][0-9]+)/)
    if (!nodeIdMatch) {
      return 'Le format du node-id est invalide (ex: node-id=123-456)'
    }

    return null
  }

  const handleSubmit = async () => {
    // Validation
    const error = validateFigmaUrl(figmaUrl)
    if (error) {
      setUrlError(error)
      return
    }

    setUrlError(null)
    setState('progress')
    setLogs([])
    setProgress(10)

    try {
      // Start analysis
      const response = await fetch('/api/analyze', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ figmaUrl })
      })

      if (!response.ok) {
        const error = await response.json()
        throw new Error(error.error || 'Erreur lors du lancement de l\'analyse')
      }

      const { jobId } = await response.json()
      setProgress(20)

      // Connect to SSE stream
      const eventSource = new EventSource(`/api/analyze/logs/${jobId}`)
      eventSourceRef.current = eventSource

      eventSource.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data)

          if (data.type === 'log') {
            setLogs(prev => [...prev, data.message])
            setProgress(prev => Math.min(prev + 5, 90))
          } else if (data.type === 'done') {
            eventSource.close()
            if (data.success) {
              // Extract test ID from server response
              if (data.testId) {
                setTestId(data.testId)
                setProgress(100)
                setState('success')
              } else {
                // Fallback: try to extract from logs
                const testIdFromLogs = logs.join('').match(/TEST_ID:\s*(.+)/)
                if (testIdFromLogs) {
                  setTestId(testIdFromLogs[1].trim())
                  setProgress(100)
                  setState('success')
                } else {
                  setLogs(prev => [...prev, '\n⚠️ Analyse terminée mais impossible de récupérer l\'ID du test'])
                  setProgress(100)
                }
              }
            } else {
              setLogs(prev => [...prev, '\n❌ L\'analyse a échoué'])
              setProgress(100)
            }
          } else if (data.type === 'error') {
            setLogs(prev => [...prev, data.message])
            setProgress(100)
          }
        } catch (error) {
          console.error('Error parsing SSE:', error)
        }
      }

      eventSource.onerror = () => {
        eventSource.close()
        setLogs(prev => [...prev, '\n❌ Connexion perdue'])
        setProgress(100)
      }
    } catch (error) {
      console.error('Error starting analysis:', error)
      setLogs([`❌ Erreur: ${error instanceof Error ? error.message : 'Erreur inconnue'}`])
      setProgress(100)
    }
  }

  const handleClose = () => {
    if (state === 'success' && onAnalysisComplete) {
      onAnalysisComplete()
    }
    onOpenChange(false)
  }

  const handleViewTest = () => {
    if (testId) {
      navigate(`/tests/${testId}`)
      onOpenChange(false)
      if (onAnalysisComplete) {
        onAnalysisComplete()
      }
    }
  }

  return (
    <Dialog open={open} onOpenChange={state === 'progress' ? undefined : onOpenChange}>
      <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>
            {state === 'form' && 'Nouvelle Analyse Figma'}
            {state === 'progress' && 'Analyse en cours...'}
            {state === 'success' && 'Analyse terminée !'}
          </DialogTitle>
          <DialogDescription>
            {state === 'form' && 'Collez l\'URL Figma avec le paramètre node-id pour commencer l\'analyse'}
            {state === 'progress' && 'L\'analyse est en cours, veuillez patienter'}
            {state === 'success' && 'Votre composant a été généré avec succès'}
          </DialogDescription>
        </DialogHeader>

        {/* Form State */}
        {state === 'form' && (
          <div className="space-y-6">
            <div className="space-y-3">
              <Label htmlFor="figma-url">URL Figma</Label>
              <Input
                id="figma-url"
                type="text"
                value={figmaUrl}
                onChange={(e) => {
                  setFigmaUrl(e.target.value)
                  if (urlError) setUrlError(null)
                }}
                placeholder="https://figma.com/design/FILE_ID?node-id=123-456"
                className="font-mono text-sm"
              />
              <p className="text-xs text-muted-foreground">
                L'URL doit contenir le paramètre <code className="px-1 py-0.5 bg-muted rounded">node-id</code>
              </p>

              {urlError && (
                <Alert variant="destructive">
                  <AlertCircle className="h-4 w-4" />
                  <AlertDescription>{urlError}</AlertDescription>
                </Alert>
              )}
            </div>

            {/* Actions */}
            <div className="flex justify-end gap-3 pt-4">
              <Button variant="outline" onClick={() => onOpenChange(false)}>
                Annuler
              </Button>
              <Button onClick={handleSubmit} disabled={!figmaUrl.trim()}>
                Lancer l'analyse
              </Button>
            </div>
          </div>
        )}

        {/* Progress State */}
        {state === 'progress' && (
          <div className="space-y-4">
            <div className="flex items-center gap-3">
              <Loader2 className="h-5 w-5 animate-spin" />
              <span className="text-sm text-muted-foreground">Analyse en cours...</span>
            </div>

            <Progress value={progress} className="w-full" />

            {/* Logs */}
            <div className="rounded-md bg-black p-4 max-h-96 overflow-y-auto">
              <pre className="text-xs font-mono whitespace-pre-wrap text-gray-300">
                {logs.join('')}
              </pre>
            </div>
          </div>
        )}

        {/* Success State */}
        {state === 'success' && (
          <div className="flex flex-col items-center justify-center py-8 space-y-4">
            <CheckCircle className="h-16 w-16 text-green-500" />
            <div className="text-center space-y-2">
              <p className="text-lg font-medium">Analyse terminée avec succès !</p>
              <p className="text-sm text-muted-foreground">
                Le composant est maintenant disponible dans vos tests
              </p>
              {testId && (
                <p className="text-xs font-mono text-muted-foreground mt-2">
                  {testId}
                </p>
              )}
            </div>
            <div className="flex gap-3 mt-4">
              <Button variant="outline" onClick={handleClose}>
                Fermer
              </Button>
              {testId && (
                <Button onClick={handleViewTest} className="gap-2">
                  Voir le test
                  <ExternalLink className="h-4 w-4" />
                </Button>
              )}
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  )
}
