import { useState, useMemo, useCallback, memo } from 'react'
import { Trash2, ChevronRight, Loader2, Monitor, Tablet, Smartphone, Edit } from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import { Card, CardContent } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { useConfirm } from '../../../hooks/useConfirm'
import { useAlert } from '../../../hooks/useAlert'
import { useTranslation } from '../../../i18n/I18nContext'
import type { ResponsiveTest } from '../../../hooks/useResponsiveTests'

interface ResponsiveTestCardProps {
  test: ResponsiveTest
  onRefresh?: () => void
}

export const ResponsiveTestCard = memo(function ResponsiveTestCard({ test, onRefresh }: ResponsiveTestCardProps) {
  const { t } = useTranslation()
  const { confirm, ConfirmDialog } = useConfirm()
  const { alert, AlertDialogComponent } = useAlert()
  const navigate = useNavigate()
  const [isDeleting, setIsDeleting] = useState(false)

  const handleOpenPreview = useCallback((e: React.MouseEvent) => {
    e.stopPropagation()
    window.location.href = `/preview?responsive=${test.mergeId}`
  }, [test.mergeId])

  const handleOpenPuck = useCallback((e: React.MouseEvent) => {
    e.stopPropagation()
    navigate(`/responsive-tests/${test.mergeId}/puck-editor`)
  }, [test.mergeId, navigate])

  const handleDelete = useCallback(async (e: React.MouseEvent) => {
    e.stopPropagation()

    const confirmed = await confirm({
      title: t('responsive.card.delete_confirm_title'),
      description: t('responsive.card.delete_confirm_description'),
      confirmText: t('responsive.card.delete_confirm_button'),
      cancelText: t('responsive.card.delete_cancel_button'),
      variant: 'destructive'
    })

    if (!confirmed) return

    setIsDeleting(true)
    try {
      const response = await fetch(`/api/responsive-tests/${test.mergeId}`, { method: 'DELETE' })
      if (response.ok) {
        if (onRefresh) {
          onRefresh()
        } else {
          window.location.reload()
        }
      } else {
        alert({
          title: t('responsive.card.delete_error_title'),
          description: t('responsive.card.delete_error_description'),
          variant: 'destructive'
        })
        setIsDeleting(false)
      }
    } catch (error) {
      alert({
        title: t('responsive.card.delete_error_title'),
        description: t('responsive.card.delete_error_description'),
        variant: 'destructive'
      })
      setIsDeleting(false)
    }
  }, [test.mergeId, confirm, alert, onRefresh, t])

  // Thumbnails paths for 3 breakpoints
  const desktopThumbnail = useMemo(
    () => `/src/generated/tests/${test.breakpoints.desktop.testId}/img/figma-screenshot.png`,
    [test.breakpoints.desktop.testId]
  )
  const tabletThumbnail = useMemo(
    () => `/src/generated/tests/${test.breakpoints.tablet.testId}/img/figma-screenshot.png`,
    [test.breakpoints.tablet.testId]
  )
  const mobileThumbnail = useMemo(
    () => `/src/generated/tests/${test.breakpoints.mobile.testId}/img/figma-screenshot.png`,
    [test.breakpoints.mobile.testId]
  )

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
    <>
      <ConfirmDialog />
      <AlertDialogComponent />

      <Card
        className="group cursor-pointer overflow-hidden transition-shadow duration-200 hover:shadow-lg"
        onClick={handleOpenPreview}
        style={{ contain: 'layout style paint' }}
      >
        {/* 3 Thumbnails Side by Side */}
        <div className="relative h-52 w-full flex overflow-hidden bg-muted">
          {/* Desktop */}
          <div className="relative flex-1 h-full overflow-hidden border-r border-border/50">
            <img
              src={desktopThumbnail}
              alt="Desktop preview"
              loading="lazy"
              decoding="async"
              className="h-full w-full object-cover object-top transition-transform duration-200 ease-out group-hover:scale-105"
              onError={(e) => {
                e.currentTarget.style.display = 'none'
              }}
            />
            <div className="absolute bottom-2 left-2">
              <Badge variant="secondary" className="text-[9px] gap-1">
                <Monitor className="h-3 w-3" />
                {test.breakpoints.desktop.width}px
              </Badge>
            </div>
          </div>

          {/* Tablet */}
          <div className="relative flex-1 h-full overflow-hidden border-r border-border/50">
            <img
              src={tabletThumbnail}
              alt="Tablet preview"
              loading="lazy"
              decoding="async"
              className="h-full w-full object-cover object-top transition-transform duration-200 ease-out group-hover:scale-105"
              onError={(e) => {
                e.currentTarget.style.display = 'none'
              }}
            />
            <div className="absolute bottom-2 left-2">
              <Badge variant="secondary" className="text-[9px] gap-1">
                <Tablet className="h-3 w-3" />
                {test.breakpoints.tablet.width}px
              </Badge>
            </div>
          </div>

          {/* Mobile */}
          <div className="relative flex-1 h-full overflow-hidden">
            <img
              src={mobileThumbnail}
              alt="Mobile preview"
              loading="lazy"
              decoding="async"
              className="h-full w-full object-cover object-top transition-transform duration-200 ease-out group-hover:scale-105"
              onError={(e) => {
                e.currentTarget.style.display = 'none'
              }}
            />
            <div className="absolute bottom-2 left-2">
              <Badge variant="secondary" className="text-[9px] gap-1">
                <Smartphone className="h-3 w-3" />
                {test.breakpoints.mobile.width}px
              </Badge>
            </div>
          </div>

          {/* Hover Overlay with Actions */}
          <div className="absolute inset-x-0 top-0 flex items-start justify-end gap-2 bg-gradient-to-b from-black/40 to-transparent p-3 opacity-0 transition-opacity duration-200 group-hover:opacity-100">
            <Button
              size="sm"
              variant="destructive"
              className="h-8 w-8 p-0"
              onClick={handleDelete}
              disabled={isDeleting}
              title={t('responsive.card.delete')}
            >
              {isDeleting ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Trash2 className="h-4 w-4" />
              )}
            </Button>
          </div>
        </div>

        {/* Card Content */}
        <CardContent className="p-5">
          {/* Stats Badges */}
          {test.mergeStats && (
            <div className="mb-3 flex flex-wrap gap-1.5">
              <Badge variant="secondary" className="text-[10px]">
                {test.components?.length || 0} {t('responsive.card.components')}
              </Badge>
              {test.mergeStats.successCount > 0 && (
                <Badge variant="default" className="text-[10px] bg-green-500">
                  ✓ {test.mergeStats.successCount} {t('responsive.card.successful')}
                </Badge>
              )}
              {test.mergeStats.errorCount > 0 && (
                <Badge variant="destructive" className="text-[10px]">
                  ✗ {test.mergeStats.errorCount} {t('responsive.card.errors')}
                </Badge>
              )}
            </div>
          )}

          {/* Title + Date/ID */}
          <div className="mb-4 flex items-start justify-between gap-3">
            <h3 className="truncate text-base font-semibold flex-1 min-w-0">
              {t('responsive.card.title')}
            </h3>
            <div className="flex flex-col items-end gap-0.5 flex-shrink-0">
              <span className="text-xs text-muted-foreground whitespace-nowrap">
                {formattedDate}
              </span>
              <span className="font-mono text-[9px] text-muted-foreground">
                {test.mergeId}
              </span>
            </div>
          </div>

          {/* Action Buttons */}
          <div className="flex gap-2">
            <Button
              variant="outline"
              size="sm"
              className="gap-2"
              onClick={handleOpenPuck}
            >
              <Edit className="h-4 w-4" />
            </Button>
            <Button
              variant="default"
              size="sm"
              className="flex-1 gap-2"
              onClick={handleOpenPreview}
            >
              <span>{t('responsive.card.view_preview')}</span>
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>
        </CardContent>
      </Card>
    </>
  )
})
