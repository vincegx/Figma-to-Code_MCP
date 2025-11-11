/**
 * TestsPage - List of all tests with grid/list view and pagination
 * Clean orchestrator that delegates to TestsGrid and TestsTable
 */

import { useState, useEffect, useMemo, useCallback, startTransition } from 'react'
import { useNavigate } from 'react-router-dom'
import { useTests } from '../../hooks/useTests'
import { ControlsBar } from '../features/tests/ControlsBar'
import { PaginationControls } from '../features/tests/PaginationControls'
import TestsGrid from '../features/tests/TestsGrid'
import TestsTable from '../features/tests/TestsTable'
import { AnalysisDialog } from '../features/analysis/AnalysisDialog'
import { useTranslation } from '../../i18n/I18nContext'
import { Card, CardContent } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Inbox, Plus, Sparkles } from 'lucide-react'

type ViewMode = 'grid' | 'list'
type SortOption = 'date-desc' | 'date-asc' | 'name-asc' | 'name-desc'

export default function TestsPage() {
  const { t } = useTranslation()
  const navigate = useNavigate()
  const { tests, loading, reload } = useTests()
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

  const sortedTests = useMemo(() => {
    const sorted = [...tests]
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
  }, [tests, sortOption])

  const totalPages = useMemo(() => Math.ceil(sortedTests.length / itemsPerPage), [sortedTests.length, itemsPerPage])

  const currentTests = useMemo(() => {
    const indexOfLastItem = currentPage * itemsPerPage
    const indexOfFirstItem = indexOfLastItem - itemsPerPage
    return sortedTests.slice(indexOfFirstItem, indexOfLastItem)
  }, [sortedTests, currentPage, itemsPerPage])

  const handleSelectTest = useCallback((testId: string) => {
    navigate(`/tests/${testId}`)
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

  if (tests.length === 0) {
    return (
      <div className="rounded-xl border-2 border-dashed p-12 text-center">
        <div className="mb-4 flex justify-center">
          <Inbox className="h-16 w-16 text-muted-foreground/50" strokeWidth={1.5} />
        </div>
        <h3 className="mb-2 text-xl font-semibold">
          {t('home.no_tests.title')}
        </h3>
        <p className="text-muted-foreground">
          {t('home.no_tests.message')}
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
                <h2 className="text-lg font-semibold">Analyses Figma</h2>
              </div>
              <p className="text-sm text-muted-foreground">
                Convertissez vos designs Figma en composants React + Tailwind CSS pixel-perfect.
                Le système utilise un pipeline AST avec 11 transformations pour assurer la fidélité visuelle maximale.
              </p>
              <div className="flex items-center gap-2 pt-2">
                <Badge variant="secondary" className="text-xs">
                  React 19
                </Badge>
                <Badge variant="secondary" className="text-xs">
                  Tailwind CSS
                </Badge>
                <Badge variant="secondary" className="text-xs">
                  AST Pipeline
                </Badge>
              </div>
            </div>

            {/* Right: Action Button */}
            <Button onClick={() => setDialogOpen(true)} className="gap-2 flex-shrink-0">
              <Plus className="h-4 w-4" />
              Nouvelle Analyse
            </Button>
          </div>
        </CardContent>
      </Card>

      <ControlsBar
        viewMode={viewMode}
        setViewMode={handleViewModeChange}
        testsCount={tests.length}
        sortOption={sortOption}
        setSortOption={handleSortOptionChange}
        itemsPerPage={itemsPerPage}
        setItemsPerPage={handleItemsPerPageChange}
        onPageReset={handlePageReset}
      />

      {viewMode === 'grid' ? (
        <TestsGrid
          tests={currentTests}
          onSelectTest={handleSelectTest}
          onRefresh={reload}
        />
      ) : (
        <TestsTable
          tests={currentTests}
          onSelectTest={handleSelectTest}
          onRefresh={reload}
        />
      )}

      {totalPages > 1 && (
        <PaginationControls
          currentPage={currentPage}
          totalPages={totalPages}
          totalItems={sortedTests.length}
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
