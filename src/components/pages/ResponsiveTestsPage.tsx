/**
 * ResponsiveTestsPage - List of all responsive merge tests
 */

import { useState, useEffect, useMemo, useCallback, startTransition } from 'react'
import { useResponsiveTests } from '../../hooks/useResponsiveTests'
import { useTranslation } from '../../i18n/I18nContext'
import { PaginationControls } from '../features/tests/PaginationControls'
import ResponsiveTestsGrid from '../features/responsive-tests/ResponsiveTestsGrid'
import ResponsiveTestsTable from '../features/responsive-tests/ResponsiveTestsTable'
import { MergeDialog } from '../features/responsive-tests/MergeDialog'
import { Card, CardContent } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Inbox, Plus, MonitorSmartphone, LayoutGrid, List } from 'lucide-react'
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group"
import { Label } from "@/components/ui/label"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"

type ViewMode = 'grid' | 'list'
type SortOption = 'date-desc' | 'date-asc'

export default function ResponsiveTestsPage() {
  const { t } = useTranslation()
  const { tests, loading, reload } = useResponsiveTests()
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
          setViewMode(settings.ui.responsiveDefaultView || 'grid')
          setItemsPerPage(settings.ui.responsiveItemsPerPage || 12)
        }
      })
      .catch(err => console.error('Failed to load settings:', err))
      .finally(() => setSettingsLoaded(true))
  }, [])

  const sortedTests = useMemo(() => {
    const sorted = [...tests]
    if (sortOption === 'date-desc') {
      sorted.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime())
    } else {
      sorted.sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime())
    }
    return sorted
  }, [tests, sortOption])

  const totalPages = useMemo(() => Math.ceil(sortedTests.length / itemsPerPage), [sortedTests.length, itemsPerPage])

  const currentTests = useMemo(() => {
    const indexOfLastItem = currentPage * itemsPerPage
    const indexOfFirstItem = indexOfLastItem - itemsPerPage
    return sortedTests.slice(indexOfFirstItem, indexOfLastItem)
  }, [sortedTests, currentPage, itemsPerPage])

  const handlePageChange = useCallback((page: number) => {
    setCurrentPage(page)
  }, [])

  const handleMergeComplete = useCallback(() => {
    reload()
    setDialogOpen(false)
  }, [reload])

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
      setCurrentPage(1)
    })
  }, [])

  useEffect(() => {
    setCurrentPage(1)
  }, [sortOption, itemsPerPage])

  if (loading || !settingsLoaded) {
    return (
      <div className="flex min-h-[400px] items-center justify-center">
        <div className="text-center">
          <div className="mx-auto mb-4 h-12 w-12 animate-spin rounded-full border-b-2 border-primary"></div>
          <p className="text-muted-foreground">{t('responsive.page.loading')}</p>
        </div>
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
                <MonitorSmartphone className="h-5 w-5 text-primary" />
                <h2 className="text-lg font-semibold">{t('responsive.page.title')}</h2>
              </div>
              <p className="text-sm text-muted-foreground">
                {t('responsive.page.description')}
              </p>
              <div className="flex items-center gap-2 pt-2">
                <Badge variant="secondary" className="text-xs">
                  {t('responsive.page.badge_desktop_first')}
                </Badge>
                <Badge variant="secondary" className="text-xs">
                  {t('responsive.page.badge_media_queries')}
                </Badge>
                <Badge variant="secondary" className="text-xs">
                  {t('responsive.page.badge_breakpoints')}
                </Badge>
              </div>
            </div>

            {/* Right: Action Button */}
            <Button onClick={() => setDialogOpen(true)} className="gap-2 flex-shrink-0">
              <Plus className="h-4 w-4" />
              {t('responsive.page.new_merge')}
            </Button>
          </div>
        </CardContent>
      </Card>

      {tests.length === 0 ? (
        <div className="rounded-xl border-2 border-dashed p-12 text-center">
          <div className="mb-4 flex justify-center">
            <Inbox className="h-16 w-16 text-muted-foreground/50" strokeWidth={1.5} />
          </div>
          <h3 className="mb-2 text-xl font-semibold">
            {t('responsive.page.no_tests_title')}
          </h3>
          <p className="text-muted-foreground mb-4">
            {t('responsive.page.no_tests_message')}
          </p>
          <Button onClick={() => setDialogOpen(true)} className="gap-2">
            <Plus className="h-4 w-4" />
            {t('responsive.page.create_merge')}
          </Button>
        </div>
      ) : (
        <>
          {/* Controls Bar */}
          <div className="flex flex-wrap items-center justify-between gap-4 rounded-lg border bg-card p-4">
            {/* Left: View Mode + Count */}
            <div className="flex items-center gap-4">
              <ToggleGroup
                type="single"
                value={viewMode}
                onValueChange={(value) => value && handleViewModeChange(value as ViewMode)}
              >
                <ToggleGroupItem value="grid" aria-label="Grid view" size="sm">
                  <LayoutGrid className="h-4 w-4" />
                </ToggleGroupItem>
                <ToggleGroupItem value="list" aria-label="List view" size="sm">
                  <List className="h-4 w-4" />
                </ToggleGroupItem>
              </ToggleGroup>

              <Badge variant="secondary">
                {tests.length} {tests.length > 1 ? t('common.tests_plural') : t('common.tests')}
              </Badge>
            </div>

            {/* Right: Sort + Items per page */}
            <div className="flex items-center gap-4">
              {/* Sort Selector */}
              <div className="flex items-center gap-2">
                <Label htmlFor="sort" className="text-sm font-medium whitespace-nowrap">
                  {t('home.sort_by')}
                </Label>
                <Select value={sortOption} onValueChange={(value) => handleSortOptionChange(value as SortOption)}>
                  <SelectTrigger id="sort" className="w-[180px]">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="date-desc">{t('home.sort_options.date_desc')}</SelectItem>
                    <SelectItem value="date-asc">{t('home.sort_options.date_asc')}</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {/* Items Per Page Selector */}
              <div className="flex items-center gap-2">
                <Label htmlFor="per-page" className="text-sm font-medium whitespace-nowrap">
                  {t('home.per_page')}
                </Label>
                <Select value={String(itemsPerPage)} onValueChange={(value: string) => handleItemsPerPageChange(Number(value))}>
                  <SelectTrigger id="per-page" className="w-[80px]">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="4">4</SelectItem>
                    <SelectItem value="8">8</SelectItem>
                    <SelectItem value="12">12</SelectItem>
                    <SelectItem value="16">16</SelectItem>
                    <SelectItem value="20">20</SelectItem>
                    <SelectItem value="24">24</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
          </div>

          {/* Grid or List View */}
          {viewMode === 'grid' ? (
            <ResponsiveTestsGrid tests={currentTests} onRefresh={reload} />
          ) : (
            <ResponsiveTestsTable tests={currentTests} onRefresh={reload} />
          )}

          {/* Pagination */}
          {totalPages > 1 && (
            <PaginationControls
              currentPage={currentPage}
              totalPages={totalPages}
              totalItems={sortedTests.length}
              itemsPerPage={itemsPerPage}
              onPageChange={handlePageChange}
            />
          )}
        </>
      )}

      {/* Merge Dialog */}
      <MergeDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        onMergeComplete={handleMergeComplete}
      />
    </div>
  )
}
