import { LayoutGrid, List } from "lucide-react"
import { Badge } from "@/components/ui/badge"
import { Label } from "@/components/ui/label"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group"
import { useTranslation } from '../../../i18n/I18nContext'

type ViewMode = 'grid' | 'list'
type SortOption = 'date-desc' | 'date-asc' | 'name-asc' | 'name-desc'

interface ControlsBarProps {
  viewMode: ViewMode
  setViewMode: (mode: ViewMode) => void
  testsCount: number
  sortOption: SortOption
  setSortOption: (option: SortOption) => void
  itemsPerPage: number
  setItemsPerPage: (items: number) => void
  onPageReset: () => void
}

export function ControlsBar({
  viewMode,
  setViewMode,
  testsCount,
  sortOption,
  setSortOption,
  itemsPerPage,
  setItemsPerPage,
  onPageReset
}: ControlsBarProps) {
  const { t } = useTranslation()

  const handleItemsPerPageChange = (value: string) => {
    setItemsPerPage(Number(value))
    onPageReset()
  }

  return (
    <div className="flex flex-wrap items-center justify-between gap-4 rounded-lg border bg-card p-4">
      {/* Left: View Mode + Count */}
      <div className="flex items-center gap-4">
        <ToggleGroup
          type="single"
          value={viewMode}
          onValueChange={(value) => value && setViewMode(value as ViewMode)}
        >
          <ToggleGroupItem value="grid" aria-label="Grid view" size="sm">
            <LayoutGrid className="h-4 w-4" />
          </ToggleGroupItem>
          <ToggleGroupItem value="list" aria-label="List view" size="sm">
            <List className="h-4 w-4" />
          </ToggleGroupItem>
        </ToggleGroup>

        <Badge variant="secondary">
          {testsCount} {testsCount > 1 ? t('common.tests_plural') : t('common.tests')}
        </Badge>
      </div>

      {/* Right: Sort + Items per page */}
      <div className="flex items-center gap-4">
        {/* Sort Selector */}
        <div className="flex items-center gap-2">
          <Label htmlFor="sort" className="text-sm font-medium whitespace-nowrap">
            {t('home.sort_by')}
          </Label>
          <Select value={sortOption} onValueChange={(value) => setSortOption(value as SortOption)}>
            <SelectTrigger id="sort" className="w-[180px]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="date-desc">{t('home.sort_options.date_desc')}</SelectItem>
              <SelectItem value="date-asc">{t('home.sort_options.date_asc')}</SelectItem>
              <SelectItem value="name-asc">{t('home.sort_options.name_asc')}</SelectItem>
              <SelectItem value="name-desc">{t('home.sort_options.name_desc')}</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {/* Items Per Page Selector */}
        <div className="flex items-center gap-2">
          <Label htmlFor="per-page" className="text-sm font-medium whitespace-nowrap">
            {t('home.per_page')}
          </Label>
          <Select value={String(itemsPerPage)} onValueChange={handleItemsPerPageChange}>
            <SelectTrigger id="per-page" className="w-[80px]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="4">4</SelectItem>
              <SelectItem value="6">6</SelectItem>
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
  )
}
