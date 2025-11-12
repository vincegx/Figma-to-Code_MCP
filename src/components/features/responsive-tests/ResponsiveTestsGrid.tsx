import { memo, useState } from 'react'
import { ResponsiveTestCard } from './ResponsiveTestCard'
import { SelectionBar } from '@/components/ui/SelectionBar'
import { useSelection } from '../../../hooks/useSelection'
import { useConfirm } from '../../../hooks/useConfirm'
import { useAlert } from '../../../hooks/useAlert'
import { useTranslation } from '../../../i18n/I18nContext'
import type { ResponsiveTest } from '../../../hooks/useResponsiveTests'

interface ResponsiveTestsGridProps {
  tests: ResponsiveTest[]
  onRefresh?: () => void
}

const ResponsiveTestsGrid = memo(function ResponsiveTestsGrid({ tests, onRefresh }: ResponsiveTestsGridProps) {
  const { t } = useTranslation()
  const { confirm, ConfirmDialog } = useConfirm()
  const { alert, AlertDialogComponent } = useAlert()
  const [isDeletingMultiple, setIsDeletingMultiple] = useState(false)

  // Use selection hook
  const selection = useSelection(tests, (test) => test.mergeId)

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
        fetch(`/api/responsive-tests/${mergeId}`, { method: 'DELETE' })
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
        description: 'Impossible de supprimer les tests responsive',
        variant: 'destructive'
      })
      setIsDeletingMultiple(false)
    }
  }

  return (
    <>
      <ConfirmDialog />
      <AlertDialogComponent />

      <div className="space-y-4">
        {/* Selection Bar */}
        <SelectionBar
          selectedCount={selection.selectedCount}
          onDelete={handleDeleteSelected}
          isDeleting={isDeletingMultiple}
        />

        {/* Grid */}
        <div className="grid gap-4 sm:gap-6" style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(min(320px, 100%), 1fr))' }}>
          {tests.map((test) => (
            <ResponsiveTestCard
              key={test.mergeId}
              test={test}
              onRefresh={onRefresh}
              isSelected={selection.isSelected(test.mergeId)}
              onToggleSelection={() => selection.toggleSelection(test.mergeId)}
            />
          ))}
        </div>
      </div>
    </>
  )
})

export default ResponsiveTestsGrid
