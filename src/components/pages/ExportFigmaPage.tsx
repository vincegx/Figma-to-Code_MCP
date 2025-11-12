/**
 * ExportFigmaPage - List of all exports with grid/list view and pagination
 * Clean orchestrator that delegates to ExportFigmaGrid and ExportFigmaTable
 */

import { useState, useEffect, useMemo, useCallback, startTransition } from 'react'
import { useNavigate } from 'react-router-dom'
import { useExports } from '../../hooks/useExports'
import { ControlsBar } from '../features/export_figma/ControlsBar'
import { PaginationControls } from '../features/export_figma/PaginationControls'
import ExportFigmaGrid from '../features/export_figma/ExportFigmaGrid'
import ExportFigmaTable from '../features/export_figma/ExportFigmaTable'
import { AnalysisDialog } from '../features/analysis/AnalysisDialog'
import { useTranslation } from '../../i18n/I18nContext'
import { Card, CardContent } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Inbox, Plus, Sparkles } from 'lucide-react'

type ViewMode = 'grid' | 'list'
type SortOption = 'date-desc' | 'date-asc' | 'name-asc' | 'name-desc'

export default function ExportFigmaPage() {
  const { t } = useTranslation()
  const navigate = useNavigate()
  const { exports, loading, reload } = useExports()
  const [settingsLoaded, setSettingsLoaded] = useState<boolean>(false)
  const [dialogOpen, setDialogOpen] = useState(false)
  const [viewMode, setViewMode] = useState<ViewMode>('grid')
  const [sortOption, setSortOption] = useState<SortOption>('date-desc')
  const [currentPage, setCurrentPage] = useState<number>(1)
  const [itemsPerPage, setItemsPerPage] = useState<number>(12)

  // Load settings on mount
  useEffect(() => {
    fetch('/api/settings')
      .then(res => res.json())
      .then(settings => {
        if (settings.ui) {
          setViewMode(settings.ui.defaultView || 'grid')
          setItemsPerPage(settings.ui.itemsPerPage || 12)
        }
      })
      .catch(err => console.error('Failed to load settings:', err))
      .finally(() => setSettingsLoaded(true))
  }, [])

  const sortedExports = useMemo(() => {
    const sorted = [...exports]
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
    }
    return sorted
  }, [exports, sortOption])

  const totalPages = useMemo(() => Math.ceil(sortedExports.length / itemsPerPage), [sortedExports.length, itemsPerPage])

  const currentExports = useMemo(() => {
    const indexOfLastItem = currentPage * itemsPerPage
    const indexOfFirstItem = indexOfLastItem - itemsPerPage
    return sortedExports.slice(indexOfFirstItem, indexOfLastItem)
  }, [sortedExports, currentPage, itemsPerPage])

  const handleSelectTest = useCallback((testId: string) => {
    navigate(`/export_figma/${testId}`)
  }, [navigate])

  const handleViewModeChange = useCallback((mode: ViewMode) => {
    startTransition(() => {
      setViewMode(mode)
    })
  }, [])

  const handleSortOptionChange = useCallback((option: SortOption) => {
    startTransition(() => {
      setSortOption(option)
    })
  }, [])

  const handleItemsPerPageChange = useCallback((items: number) => {
    startTransition(() => {
      setItemsPerPage(items)
    })
  }, [])

  const handlePageReset = useCallback(() => {
    setCurrentPage(1)
  }, [])

  const handlePageChange = useCallback((page: number) => {
    setCurrentPage(page)
  }, [])

  const handleAnalysisComplete = useCallback(() => {
    reload()
    setDialogOpen(false)
  }, [reload])

  useEffect(() => {
    setCurrentPage(1)
  }, [sortOption, itemsPerPage])

  if (loading || !settingsLoaded) {
    return (
      <div className="flex min-h-[400px] items-center justify-center">
        <div className="text-center">
          <div className="mx-auto mb-4 h-12 w-12 animate-spin rounded-full border-b-2 border-primary"></div>
          <p className="text-muted-foreground">{t('home.loading_tests')}</p>
        </div>
      </div>
    )
  }

  if (exports.length === 0) {
    return (
      <div className="rounded-xl border-2 border-dashed p-12 text-center">
        <div className="mb-4 flex justify-center">
          <Inbox className="h-16 w-16 text-muted-foreground/50" strokeWidth={1.5} />
        </div>
        <h3 className="mb-2 text-xl font-semibold">
          {t('home.no_exports.title')}
        </h3>
        <p className="text-muted-foreground">
          {t('home.no_exports.message')}
        </p>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Info Section */}
      <Card>
        <CardContent className="p-6">
          <div className="flex items-start justify-between gap-6">
            {/* Left: Description */}
            <div className="flex-1 space-y-2">
              <div className="flex items-center gap-2">
                <Sparkles className="h-5 w-5 text-primary" />
                <h2 className="text-lg font-semibold">{t('home.title')}</h2>
              </div>
              <p className="text-sm text-muted-foreground">
                {t('home.description')}
              </p>
              <div className="flex items-center gap-2 pt-2">
                <Badge variant="secondary" className="text-xs">
                  {t('home.badge_react')}
                </Badge>
                <Badge variant="secondary" className="text-xs">
                  {t('home.badge_tailwind')}
                </Badge>
                <Badge variant="secondary" className="text-xs">
                  {t('home.badge_ast')}
                </Badge>
              </div>
            </div>

            {/* Right: Action Button */}
            <Button onClick={() => setDialogOpen(true)} className="gap-2 flex-shrink-0">
              <Plus className="h-4 w-4" />
              {t('home.new_analysis')}
            </Button>
          </div>
        </CardContent>
      </Card>

      <ControlsBar
        viewMode={viewMode}
        setViewMode={handleViewModeChange}
        exportsCount={exports.length}
        sortOption={sortOption}
        setSortOption={handleSortOptionChange}
        itemsPerPage={itemsPerPage}
        setItemsPerPage={handleItemsPerPageChange}
        onPageReset={handlePageReset}
      />

      {viewMode === 'grid' ? (
        <ExportFigmaGrid
          exports={currentExports}
          onSelectExport={handleSelectTest}
          onRefresh={reload}
        />
      ) : (
        <ExportFigmaTable
          exports={currentExports}
          onSelectExport={handleSelectTest}
          onRefresh={reload}
        />
      )}

      {totalPages > 1 && (
        <PaginationControls
          currentPage={currentPage}
          totalPages={totalPages}
          totalItems={sortedExports.length}
          itemsPerPage={itemsPerPage}
          onPageChange={handlePageChange}
        />
      )}

      {/* Analysis Dialog */}
      <AnalysisDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        onAnalysisComplete={handleAnalysisComplete}
      />
    </div>
  )
}
