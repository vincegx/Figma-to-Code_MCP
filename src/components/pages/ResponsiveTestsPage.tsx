/**
 * ResponsiveTestsPage - List of all responsive merge tests
 */

import { useState, useEffect, useMemo, useCallback, startTransition } from 'react'
import { useResponsiveTests } from '../../hooks/useResponsiveTests'
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
  const { tests, loading, reload } = useResponsiveTests()
  const [dialogOpen, setDialogOpen] = useState(false)
  const [viewMode, setViewMode] = useState<ViewMode>('grid')
  const [sortOption, setSortOption] = useState<SortOption>('date-desc')
  const [currentPage, setCurrentPage] = useState<number>(1)
  const [itemsPerPage, setItemsPerPage] = useState<number>(12)

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

  if (loading) {
    return (
      <div className="flex min-h-[400px] items-center justify-center">
        <div className="text-center">
          <div className="mx-auto mb-4 h-12 w-12 animate-spin rounded-full border-b-2 border-primary"></div>
          <p className="text-muted-foreground">Chargement des tests responsive...</p>
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
                <h2 className="text-lg font-semibold">Tests Responsive</h2>
              </div>
              <p className="text-sm text-muted-foreground">
                Fusionnez 3 tests (Desktop, Tablet, Mobile) pour créer un composant responsive avec media queries automatiques.
                Le système détecte les différences de classes CSS et génère les breakpoints optimisés.
              </p>
              <div className="flex items-center gap-2 pt-2">
                <Badge variant="secondary" className="text-xs">
                  Desktop-First
                </Badge>
                <Badge variant="secondary" className="text-xs">
                  Media Queries
                </Badge>
                <Badge variant="secondary" className="text-xs">
                  3 Breakpoints
                </Badge>
              </div>
            </div>

            {/* Right: Action Button */}
            <Button onClick={() => setDialogOpen(true)} className="gap-2 flex-shrink-0">
              <Plus className="h-4 w-4" />
              Nouveau Merge
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
            Aucun test responsive
          </h3>
          <p className="text-muted-foreground mb-4">
            Créez votre premier test responsive en fusionnant 3 tests existants
          </p>
          <Button onClick={() => setDialogOpen(true)} className="gap-2">
            <Plus className="h-4 w-4" />
            Créer un merge
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
                {tests.length} test{tests.length > 1 ? 's' : ''}
              </Badge>
            </div>

            {/* Right: Sort + Items per page */}
            <div className="flex items-center gap-4">
              {/* Sort Selector */}
              <div className="flex items-center gap-2">
                <Label htmlFor="sort" className="text-sm font-medium whitespace-nowrap">
                  Trier par
                </Label>
                <Select value={sortOption} onValueChange={(value) => handleSortOptionChange(value as SortOption)}>
                  <SelectTrigger id="sort" className="w-[180px]">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="date-desc">Plus récent</SelectItem>
                    <SelectItem value="date-asc">Plus ancien</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {/* Items Per Page Selector */}
              <div className="flex items-center gap-2">
                <Label htmlFor="per-page" className="text-sm font-medium whitespace-nowrap">
                  Par page
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
