import { useState, useMemo, useCallback, memo } from 'react'
import { ExternalLink, Trash2, Eye, ChevronRight, Loader2 } from 'lucide-react'
import { Card, CardContent } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { useTranslation } from '../i18n/I18nContext'

interface Test {
  testId: string
  fileName?: string
  layerName?: string
  timestamp: string | number
  nodeId: string
  stats?: {
    totalNodes?: number
    sectionsDetected?: number
    imagesOrganized?: number
    totalFixes?: number
    classesOptimized?: number
  }
}

interface TestCardProps {
  test: Test
  onSelect: () => void
}

export const TestCard = memo(function TestCard({ test, onSelect }: TestCardProps) {
  const { t } = useTranslation()
  const [isDeleting, setIsDeleting] = useState(false)

  const handleOpenPreview = useCallback((e: React.MouseEvent) => {
    e.stopPropagation()
    window.location.href = `/preview?test=${test.testId}`
  }, [test.testId])

  const handleDelete = useCallback(async (e: React.MouseEvent) => {
    e.stopPropagation()
    if (!confirm(t('home.card.delete_confirm'))) return

    setIsDeleting(true)
    try {
      const response = await fetch(`/api/tests/${test.testId}`, { method: 'DELETE' })
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
  }, [test.testId, t])

  const thumbnailPath = useMemo(
    () => `/src/generated/tests/${test.testId}/img/figma-screenshot.png`,
    [test.testId]
  )

  const nodeIdDisplay = useMemo(() => {
    const match = test.testId?.match(/^node-(.+)-\d+$/)
    return match ? match[1] : test.testId?.replace('node-', '')
  }, [test.testId])

  const formattedDate = useMemo(() => {
    if (!test.timestamp) return ''
    const dateValue = typeof test.timestamp === 'number' && test.timestamp < 10000000000
      ? test.timestamp * 1000
      : test.timestamp
    const date = new Date(dateValue)
    return new Intl.DateTimeFormat('fr-FR', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    }).format(date)
  }, [test.timestamp])

  return (
    <Card
      className="group cursor-pointer overflow-hidden transition-shadow duration-200 hover:shadow-lg"
      onClick={onSelect}
      style={{ contain: 'layout style paint' }}
    >
      {/* Thumbnail */}
      <div className="relative h-52 w-full overflow-hidden bg-muted">
        <img
          src={thumbnailPath}
          alt={test.layerName || test.fileName || 'Preview'}
          loading="lazy"
          decoding="async"
          className="h-full w-full object-cover object-top transition-transform duration-200 ease-out group-hover:scale-105"
          onError={(e) => {
            e.currentTarget.style.display = 'none'
            const fallback = e.currentTarget.nextElementSibling as HTMLElement
            if (fallback) fallback.classList.remove('hidden')
          }}
        />
        <div className="absolute inset-0 hidden flex items-center justify-center text-6xl">
          🎨
        </div>

        {/* Hover Overlay with Actions */}
        <div className="absolute inset-x-0 top-0 flex items-start justify-between gap-2 bg-gradient-to-b from-black/40 to-transparent p-3 opacity-0 transition-opacity duration-200 group-hover:opacity-100">
          <Button
            size="sm"
            variant="secondary"
            className="h-8 w-8 p-0"
            onClick={handleOpenPreview}
            title={t('home.card.open_preview')}
          >
            <ExternalLink className="h-4 w-4" />
          </Button>
          <Button
            size="sm"
            variant="destructive"
            className="h-8 w-8 p-0"
            onClick={handleDelete}
            disabled={isDeleting}
            title={t('home.card.delete')}
          >
            {isDeleting ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Trash2 className="h-4 w-4" />
            )}
          </Button>
        </div>

        {/* Node ID Badge */}
        <div className="absolute bottom-3 left-3">
          <Badge variant="secondary" className="font-mono text-[10px]">
            #{nodeIdDisplay}
          </Badge>
        </div>
      </div>

      {/* Card Content */}
      <CardContent className="p-5">
        {/* Stats Badges - First Line */}
        {test.stats && (
          <div className="mb-3 flex flex-wrap gap-1.5">
            {test.stats.totalNodes !== undefined && (
              <Badge variant="secondary" className="text-[10px]">
                {test.stats.totalNodes}
              </Badge>
            )}
            {test.stats.sectionsDetected !== undefined && test.stats.sectionsDetected > 0 && (
              <Badge variant="statSection" className="text-[10px]">
                {test.stats.sectionsDetected}
              </Badge>
            )}
            {test.stats.imagesOrganized !== undefined && test.stats.imagesOrganized > 0 && (
              <Badge variant="statImage" className="text-[10px]">
                {test.stats.imagesOrganized}
              </Badge>
            )}
            {(test.stats.totalFixes !== undefined || test.stats.classesOptimized !== undefined) && (
              <Badge variant="statFix" className="text-[10px]">
                {test.stats.totalFixes || test.stats.classesOptimized || 0}
              </Badge>
            )}
          </div>
        )}

        {/* Title + Date/ID - Second Line */}
        <div className="mb-4 flex items-start justify-between gap-3">
          <h3 className="truncate text-base font-semibold flex-1 min-w-0">
            {test.layerName || test.fileName || t('home.card.no_title')}
          </h3>
          <div className="flex flex-col items-end gap-0.5 flex-shrink-0">
            <span className="text-xs text-muted-foreground whitespace-nowrap">
              {formattedDate}
            </span>
            <span className="font-mono text-[9px] text-muted-foreground">
              {test.testId}
            </span>
          </div>
        </div>

        {/* Action Buttons */}
        <div className="flex gap-2">
          <Button
            variant="outline"
            size="sm"
            className="gap-2"
            onClick={handleOpenPreview}
          >
            <Eye className="h-4 w-4" />
          </Button>
          <Button
            variant="default"
            size="sm"
            className="flex-1 gap-2"
            onClick={onSelect}
          >
            <span>{t('home.card.view_details')}</span>
            <ChevronRight className="h-4 w-4" />
          </Button>
        </div>
      </CardContent>
    </Card>
  )
})
