import { useState, useEffect } from 'react'
import { CheckCircle, Loader2, Monitor, Tablet, Smartphone } from 'lucide-react'
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
import { TestSelectWithPreview } from './TestSelectWithPreview'

interface Test {
  testId: string
  layerName?: string
  fileName?: string
  timestamp?: string | number
}

interface MergeDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  onMergeComplete?: () => void
}

type DialogState = 'form' | 'progress' | 'success'

interface FormData {
  desktop: { size: string; testId: string }
  tablet: { size: string; testId: string }
  mobile: { size: string; testId: string }
}

export function MergeDialog({ open, onOpenChange, onMergeComplete }: MergeDialogProps) {
  const [state, setState] = useState<DialogState>('form')
  const [availableTests, setAvailableTests] = useState<Test[]>([])
  const [loadingTests, setLoadingTests] = useState(true)
  const [formData, setFormData] = useState<FormData>({
    desktop: { size: '1440', testId: '' },
    tablet: { size: '960', testId: '' },
    mobile: { size: '420', testId: '' }
  })
  const [logs, setLogs] = useState<string[]>([])
  const [progress, setProgress] = useState(0)
  const [mergeId, setMergeId] = useState<string>('')

  // Load available tests when dialog opens
  useEffect(() => {
    if (open && state === 'form') {
      loadAvailableTests()
    }
  }, [open, state])

  // Reset state when dialog closes
  useEffect(() => {
    if (!open) {
      setTimeout(() => {
        setState('form')
        setLogs([])
        setProgress(0)
        setMergeId('')
      }, 200)
    }
  }, [open])

  const loadAvailableTests = async () => {
    setLoadingTests(true)
    try {
      const response = await fetch('/api/tests')
      if (response.ok) {
        const tests = await response.json()
        // Sort by timestamp descending (most recent first)
        const sortedTests = tests.sort((a: Test, b: Test) => {
          const dateA = typeof a.timestamp === 'number' ? a.timestamp : new Date(a.timestamp || 0).getTime()
          const dateB = typeof b.timestamp === 'number' ? b.timestamp : new Date(b.timestamp || 0).getTime()
          return dateB - dateA
        })
        setAvailableTests(sortedTests)
      }
    } catch (error) {
      console.error('Error loading tests:', error)
    }
    setLoadingTests(false)
  }

  const handleSubmit = async () => {
    // Validation
    if (!formData.desktop.testId || !formData.tablet.testId || !formData.mobile.testId) {
      alert('Veuillez sélectionner les 3 tests')
      return
    }

    setState('progress')
    setLogs([])
    setProgress(10)

    try {
      // Start merge
      const response = await fetch('/api/responsive-tests/merge', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData)
      })

      if (!response.ok) {
        const error = await response.json()
        throw new Error(error.error || 'Erreur lors du merge')
      }

      const { jobId, mergeId: newMergeId } = await response.json()
      setMergeId(newMergeId)
      setProgress(20)

      // Connect to SSE stream
      const eventSource = new EventSource(`/api/responsive-tests/merge/logs/${jobId}`)

      eventSource.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data)

          if (data.type === 'log') {
            setLogs(prev => [...prev, data.message])
            setProgress(prev => Math.min(prev + 5, 90))
          } else if (data.type === 'done') {
            eventSource.close()
            if (data.success) {
              setProgress(100)
              setState('success')
            } else {
              setLogs(prev => [...prev, '\n❌ Le merge a échoué'])
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
      console.error('Error starting merge:', error)
      setLogs([`❌ Erreur: ${error instanceof Error ? error.message : 'Erreur inconnue'}`])
      setProgress(100)
    }
  }

  const handleClose = () => {
    if (state === 'success' && onMergeComplete) {
      onMergeComplete()
    }
    onOpenChange(false)
  }

  return (
    <Dialog open={open} onOpenChange={state === 'progress' ? undefined : onOpenChange}>
      <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>
            {state === 'form' && 'Nouveau Merge Responsive'}
            {state === 'progress' && 'Merge en cours...'}
            {state === 'success' && 'Merge terminé !'}
          </DialogTitle>
          <DialogDescription>
            {state === 'form' && 'Sélectionnez les 3 tests à fusionner pour créer un composant responsive'}
            {state === 'progress' && 'Le processus de merge est en cours, veuillez patienter'}
            {state === 'success' && 'Votre composant responsive a été créé avec succès'}
          </DialogDescription>
        </DialogHeader>

        {/* Form State */}
        {state === 'form' && (
          <div className="space-y-6">
            {/* Desktop Section */}
            <div className="space-y-3">
              <div className="flex items-center gap-2 text-sm font-medium">
                <Monitor className="h-4 w-4" />
                <span>Desktop</span>
              </div>
              <div className="flex gap-3">
                <div className="w-32">
                  <Label htmlFor="desktop-size">Taille (px)</Label>
                  <Input
                    id="desktop-size"
                    type="number"
                    value={formData.desktop.size}
                    onChange={(e) => setFormData(prev => ({
                      ...prev,
                      desktop: { ...prev.desktop, size: e.target.value }
                    }))}
                    placeholder="1440"
                  />
                </div>
                <div className="flex-1">
                  <Label htmlFor="desktop-test">Test</Label>
                  <TestSelectWithPreview
                    id="desktop-test"
                    tests={availableTests}
                    value={formData.desktop.testId}
                    onValueChange={(value) => setFormData(prev => ({
                      ...prev,
                      desktop: { ...prev.desktop, testId: value }
                    }))}
                    placeholder={loadingTests ? "Chargement..." : "Sélectionnez un test"}
                    disabled={loadingTests}
                  />
                </div>
              </div>
            </div>

            {/* Tablet Section */}
            <div className="space-y-3">
              <div className="flex items-center gap-2 text-sm font-medium">
                <Tablet className="h-4 w-4" />
                <span>Tablet</span>
              </div>
              <div className="flex gap-3">
                <div className="w-32">
                  <Label htmlFor="tablet-size">Taille (px)</Label>
                  <Input
                    id="tablet-size"
                    type="number"
                    value={formData.tablet.size}
                    onChange={(e) => setFormData(prev => ({
                      ...prev,
                      tablet: { ...prev.tablet, size: e.target.value }
                    }))}
                    placeholder="960"
                  />
                </div>
                <div className="flex-1">
                  <Label htmlFor="tablet-test">Test</Label>
                  <TestSelectWithPreview
                    id="tablet-test"
                    tests={availableTests}
                    value={formData.tablet.testId}
                    onValueChange={(value) => setFormData(prev => ({
                      ...prev,
                      tablet: { ...prev.tablet, testId: value }
                    }))}
                    placeholder={loadingTests ? "Chargement..." : "Sélectionnez un test"}
                    disabled={loadingTests}
                  />
                </div>
              </div>
            </div>

            {/* Mobile Section */}
            <div className="space-y-3">
              <div className="flex items-center gap-2 text-sm font-medium">
                <Smartphone className="h-4 w-4" />
                <span>Mobile</span>
              </div>
              <div className="flex gap-3">
                <div className="w-32">
                  <Label htmlFor="mobile-size">Taille (px)</Label>
                  <Input
                    id="mobile-size"
                    type="number"
                    value={formData.mobile.size}
                    onChange={(e) => setFormData(prev => ({
                      ...prev,
                      mobile: { ...prev.mobile, size: e.target.value }
                    }))}
                    placeholder="420"
                  />
                </div>
                <div className="flex-1">
                  <Label htmlFor="mobile-test">Test</Label>
                  <TestSelectWithPreview
                    id="mobile-test"
                    tests={availableTests}
                    value={formData.mobile.testId}
                    onValueChange={(value) => setFormData(prev => ({
                      ...prev,
                      mobile: { ...prev.mobile, testId: value }
                    }))}
                    placeholder={loadingTests ? "Chargement..." : "Sélectionnez un test"}
                    disabled={loadingTests}
                  />
                </div>
              </div>
            </div>

            {/* Actions */}
            <div className="flex justify-end gap-3 pt-4">
              <Button variant="outline" onClick={() => onOpenChange(false)}>
                Annuler
              </Button>
              <Button onClick={handleSubmit}>
                Lancer le merge
              </Button>
            </div>
          </div>
        )}

        {/* Progress State */}
        {state === 'progress' && (
          <div className="space-y-4">
            <div className="flex items-center gap-3">
              <Loader2 className="h-5 w-5 animate-spin" />
              <span className="text-sm text-muted-foreground">Merge en cours...</span>
            </div>

            <Progress value={progress} className="w-full" />

            {/* Logs */}
            <div className="rounded-md bg-muted p-4 max-h-96 overflow-y-auto">
              <pre className="text-xs font-mono whitespace-pre-wrap">
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
              <p className="text-lg font-medium">Merge terminé avec succès !</p>
              <p className="text-sm text-muted-foreground">
                Le composant responsive est maintenant disponible
              </p>
              {mergeId && (
                <p className="text-xs font-mono text-muted-foreground mt-2">
                  {mergeId}
                </p>
              )}
            </div>
            <Button onClick={handleClose} className="mt-4">
              Fermer
            </Button>
          </div>
        )}
      </DialogContent>
    </Dialog>
  )
}
