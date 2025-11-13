import { memo, useState } from 'react'
import { Eye, Trash2, Loader2, Edit, MoreVertical } from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Checkbox } from "@/components/ui/checkbox"
import { SelectionBar } from "@/components/ui/SelectionBar"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { useConfirm } from '../../../hooks/useConfirm'
import { useAlert } from '../../../hooks/useAlert'
import { useSelection } from '../../../hooks/useSelection'
import { useTranslation } from '../../../i18n/I18nContext'
import type { ResponsiveMerge } from '../../../hooks/useResponsiveMerges'

interface ResponsiveMergesTableProps {
  merges: ResponsiveMerge[]
  onRefresh?: () => void
}

const ResponsiveMergesTable = memo(function ResponsiveMergesTable({ merges, onRefresh }: ResponsiveMergesTableProps) {
  const { t } = useTranslation()
  const { confirm, ConfirmDialog } = useConfirm()
  const { alert, AlertDialogComponent } = useAlert()
  const navigate = useNavigate()
  const [deletingId, setDeletingId] = useState<string | null>(null)
  const [hoveredRowId, setHoveredRowId] = useState<string | null>(null)
  const [isDeletingMultiple, setIsDeletingMultiple] = useState(false)

  // Use selection hook
  const selection = useSelection(merges, (merge) => merge.mergeId)

  const handleDelete = async (merge: ResponsiveMerge, e: React.MouseEvent) => {
    e.stopPropagation()

    const confirmed = await confirm({
      title: 'Supprimer le responsive merge',
      description: 'Êtes-vous sûr de vouloir supprimer ce responsive merge ? Cette action est irréversible.',
      confirmText: 'Supprimer',
      cancelText: 'Annuler',
      variant: 'destructive'
    })

    if (!confirmed) return

    setDeletingId(merge.mergeId)
    try {
      const response = await fetch(`/api/responsive-merges/${merge.mergeId}`, { method: 'DELETE' })
      if (response.ok) {
        if (onRefresh) {
          onRefresh()
        } else {
          window.location.reload()
        }
      } else {
        alert({
          title: 'Erreur',
          description: 'Impossible de supprimer le responsive merge',
          variant: 'destructive'
        })
        setDeletingId(null)
      }
    } catch (error) {
      alert({
        title: 'Erreur',
        description: 'Impossible de supprimer le responsive merge',
        variant: 'destructive'
      })
      setDeletingId(null)
    }
  }

  const handleDeleteSelected = async () => {
    if (selection.selectedCount === 0) return

    const confirmed = await confirm({
      title: t('home.table.delete_selected'),
      description: t('home.table.delete_selected_confirm', { count: selection.selectedCount.toString() }),
      confirmText: t('home.table.delete_selected'),
      cancelText: t('common.close'),
      variant: 'destructive'
    })

    if (!confirmed) return

    setIsDeletingMultiple(true)
    try {
      const deletePromises = Array.from(selection.selectedIds).map(mergeId =>
        fetch(`/api/responsive-merges/${mergeId}`, { method: 'DELETE' })
      )
      await Promise.all(deletePromises)
      selection.clearSelection()
      setIsDeletingMultiple(false)
      if (onRefresh) {
        onRefresh()
      } else {
        window.location.reload()
      }
    } catch (error) {
      alert({
        title: t('common.error'),
        description: 'Impossible de supprimer les responsive merges',
        variant: 'destructive'
      })
      setIsDeletingMultiple(false)
    }
  }

  const formatDate = (timestamp: string | number) => {
    const dateValue = typeof timestamp === 'number' && timestamp < 10000000000
      ? timestamp * 1000
      : timestamp
    const date = new Date(dateValue)
    return new Intl.DateTimeFormat('fr-FR', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    }).format(date)
  }

  return (
    <>
      <ConfirmDialog />
      <AlertDialogComponent />

      <div className="space-y-4 overflow-visible">
        {/* Selection Bar */}
        <SelectionBar
          selectedCount={selection.selectedCount}
          onDelete={handleDeleteSelected}
          isDeleting={isDeletingMultiple}
        />

        {/* Table */}
        <div className="rounded-lg border bg-card overflow-visible">
          <Table containerClassName="overflow-visible" className="overflow-visible">
            <TableHeader>
              <TableRow>
                <TableHead className="w-12">
                  <Checkbox
                    checked={selection.isAllSelected}
                    onCheckedChange={selection.toggleAll}
                    aria-label="Sélectionner tout"
                  />
                </TableHead>
                <TableHead>Breakpoints</TableHead>
                <TableHead>Stats</TableHead>
                <TableHead>Date</TableHead>
                <TableHead>ID</TableHead>
                <TableHead className="w-20"></TableHead>
              </TableRow>
            </TableHeader>
          <TableBody className="overflow-visible">
            {merges.map((merge, index) => {
              const isLastTwo = index >= merges.length - 2
              const isSelected = selection.isSelected(merge.mergeId)
              return (
              <TableRow
                key={merge.mergeId}
                className="cursor-pointer relative overflow-visible"
                onClick={() => navigate(`/responsive-merges/${merge.mergeId}`)}
                onMouseEnter={() => setHoveredRowId(merge.mergeId)}
                onMouseLeave={() => setHoveredRowId(null)}
                data-state={isSelected ? "selected" : undefined}
              >
                <TableCell onClick={(e) => e.stopPropagation()}>
                  <Checkbox
                    checked={isSelected}
                    onCheckedChange={() => selection.toggleSelection(merge.mergeId)}
                    aria-label="Sélectionner la ligne"
                  />
                </TableCell>
                <TableCell className="overflow-visible relative">
                  <div className="flex items-center gap-1.5">
                    {/* Desktop Thumbnail */}
                    <div className="flex flex-col items-center gap-0.5">
                      <div className="w-12 h-9 rounded border overflow-hidden bg-muted">
                        <img
                          src={`/src/generated/export_figma/${merge.breakpoints.desktop.testId}/img/figma-screenshot.png`}
                          alt="Desktop"
                          className="w-full h-full object-cover object-top"
                          onError={(e) => {
                            e.currentTarget.style.display = 'none'
                            const parent = e.currentTarget.parentElement
                            if (parent) {
                              parent.innerHTML = '<div class="flex items-center justify-center h-full text-xs">🖥️</div>'
                            }
                          }}
                        />
                      </div>
                      <span className="text-[9px] text-muted-foreground">{merge.breakpoints.desktop.width}px</span>
                    </div>

                    {/* Tablet Thumbnail */}
                    <div className="flex flex-col items-center gap-0.5">
                      <div className="w-9 h-9 rounded border overflow-hidden bg-muted">
                        <img
                          src={`/src/generated/export_figma/${merge.breakpoints.tablet.testId}/img/figma-screenshot.png`}
                          alt="Tablet"
                          className="w-full h-full object-cover object-top"
                          onError={(e) => {
                            e.currentTarget.style.display = 'none'
                            const parent = e.currentTarget.parentElement
                            if (parent) {
                              parent.innerHTML = '<div class="flex items-center justify-center h-full text-xs">📱</div>'
                            }
                          }}
                        />
                      </div>
                      <span className="text-[9px] text-muted-foreground">{merge.breakpoints.tablet.width}px</span>
                    </div>

                    {/* Mobile Thumbnail */}
                    <div className="flex flex-col items-center gap-0.5">
                      <div className="w-7 h-9 rounded border overflow-hidden bg-muted">
                        <img
                          src={`/src/generated/export_figma/${merge.breakpoints.mobile.testId}/img/figma-screenshot.png`}
                          alt="Mobile"
                          className="w-full h-full object-cover object-top"
                          onError={(e) => {
                            e.currentTarget.style.display = 'none'
                            const parent = e.currentTarget.parentElement
                            if (parent) {
                              parent.innerHTML = '<div class="flex items-center justify-center h-full text-xs">📱</div>'
                            }
                          }}
                        />
                      </div>
                      <span className="text-[9px] text-muted-foreground">{merge.breakpoints.mobile.width}px</span>
                    </div>
                  </div>

                  {/* Hover Preview */}
                  {hoveredRowId === merge.mergeId && (
                    <div
                      className={`absolute left-0 ${isLastTwo ? 'bottom-full mb-1' : 'top-full mt-1'} z-50 bg-popover border rounded-lg shadow-lg p-2 flex gap-2`}
                      style={{ width: 'max-content' }}
                      onClick={(e) => e.stopPropagation()}
                    >
                      {/* Desktop Preview */}
                      <div className="flex flex-col items-center gap-1">
                        <div className="w-32 h-24 rounded border overflow-hidden bg-muted">
                          <img
                            src={`/src/generated/export_figma/${merge.breakpoints.desktop.testId}/img/figma-screenshot.png`}
                            alt="Desktop"
                            className="w-full h-full object-cover object-top"
                            onError={(e) => {
                              e.currentTarget.style.display = 'none'
                              const parent = e.currentTarget.parentElement
                              if (parent) {
                                parent.innerHTML = '<div class="flex items-center justify-center h-full text-3xl">🖥️</div>'
                              }
                            }}
                          />
                        </div>
                        <Badge variant="secondary" className="text-[10px]">
                          🖥️ {merge.breakpoints.desktop.width}px
                        </Badge>
                      </div>

                      {/* Tablet Preview */}
                      <div className="flex flex-col items-center gap-1">
                        <div className="w-24 h-24 rounded border overflow-hidden bg-muted">
                          <img
                            src={`/src/generated/export_figma/${merge.breakpoints.tablet.testId}/img/figma-screenshot.png`}
                            alt="Tablet"
                            className="w-full h-full object-cover object-top"
                            onError={(e) => {
                              e.currentTarget.style.display = 'none'
                              const parent = e.currentTarget.parentElement
                              if (parent) {
                                parent.innerHTML = '<div class="flex items-center justify-center h-full text-3xl">📱</div>'
                              }
                            }}
                          />
                        </div>
                        <Badge variant="secondary" className="text-[10px]">
                          📱 {merge.breakpoints.tablet.width}px
                        </Badge>
                      </div>

                      {/* Mobile Preview */}
                      <div className="flex flex-col items-center gap-1">
                        <div className="w-20 h-24 rounded border overflow-hidden bg-muted">
                          <img
                            src={`/src/generated/export_figma/${merge.breakpoints.mobile.testId}/img/figma-screenshot.png`}
                            alt="Mobile"
                            className="w-full h-full object-cover object-top"
                            onError={(e) => {
                              e.currentTarget.style.display = 'none'
                              const parent = e.currentTarget.parentElement
                              if (parent) {
                                parent.innerHTML = '<div class="flex items-center justify-center h-full text-2xl">📱</div>'
                              }
                            }}
                          />
                        </div>
                        <Badge variant="secondary" className="text-[10px]">
                          📱 {merge.breakpoints.mobile.width}px
                        </Badge>
                      </div>
                    </div>
                  )}
                </TableCell>
                <TableCell>
                  <div className="flex items-center gap-1.5">
                    {merge.mergeStats?.successCount > 0 && (
                      <Badge variant="default" className="text-[10px] bg-green-500">
                        ✓ {merge.mergeStats.successCount} {t('responsive.card.components')}
                      </Badge>
                    )}
                    {merge.mergeStats?.errorCount > 0 && (
                      <Badge variant="destructive" className="text-[10px]">
                        ✗ {merge.mergeStats.errorCount} {t('responsive.card.errors')}
                      </Badge>
                    )}
                  </div>
                </TableCell>
                <TableCell className="text-sm">
                  {formatDate(merge.timestamp)}
                </TableCell>
                <TableCell className="font-mono text-xs text-muted-foreground">
                  {merge.mergeId}
                </TableCell>
                <TableCell onClick={(e) => e.stopPropagation()}>
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button variant="ghost" size="icon" className="h-8 w-8">
                        {deletingId === merge.mergeId ? (
                          <Loader2 className="h-4 w-4 animate-spin" />
                        ) : (
                          <MoreVertical className="h-4 w-4" />
                        )}
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                      <DropdownMenuItem onClick={() => navigate(`/responsive-merges/${merge.mergeId}`)}>
                        <Eye className="mr-2 h-4 w-4" />
                        {t('common.details')}
                      </DropdownMenuItem>
                      <DropdownMenuItem onClick={() => window.open(`/preview?responsive=${merge.mergeId}`, '_blank')}>
                        <Eye className="mr-2 h-4 w-4" />
                        Open Live Demo
                      </DropdownMenuItem>
                      <DropdownMenuItem onClick={() => navigate(`/responsive-merges/${merge.mergeId}/puck-editor`)}>
                        <Edit className="mr-2 h-4 w-4" />
                        Edit in Puck
                      </DropdownMenuItem>
                      <DropdownMenuSeparator />
                      <DropdownMenuItem
                        onClick={(e) => handleDelete(merge, e)}
                        className="text-destructive focus:text-destructive"
                      >
                        <Trash2 className="mr-2 h-4 w-4" />
                        {t('home.card.delete')}
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </TableCell>
              </TableRow>
              )
            })}
          </TableBody>
        </Table>
      </div>
      </div>
    </>
  )
})

export default ResponsiveMergesTable
