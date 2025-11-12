import { memo, useState } from 'react'
import { TestCard } from './TestCard'
import { SelectionBar } from '@/components/ui/SelectionBar'
import { useSelection } from '../../../hooks/useSelection'
import { useConfirm } from '../../../hooks/useConfirm'
import { useAlert } from '../../../hooks/useAlert'
import { useTranslation } from '../../../i18n/I18nContext'

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

interface TestsGridProps {
  tests: Test[]
  onSelectTest: (testId: string) => void
  onRefresh?: () => void
}

const TestsGrid = memo(function TestsGrid({ tests, onSelectTest, onRefresh }: TestsGridProps) {
  const { t } = useTranslation()
  const { confirm, ConfirmDialog } = useConfirm()
  const { alert, AlertDialogComponent } = useAlert()
  const [isDeletingMultiple, setIsDeletingMultiple] = useState(false)

  // Use selection hook
  const selection = useSelection(tests, (test) => test.testId)

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
      const deletePromises = Array.from(selection.selectedIds).map(testId =>
        fetch(`/api/tests/${testId}`, { method: 'DELETE' })
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
        description: t('home.card.delete_error'),
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
        <div className="grid gap-4 sm:gap-6" style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(min(280px, 100%), 1fr))' }}>
          {tests.map((test) => (
            <TestCard
              key={test.testId}
              test={test}
              onSelect={() => onSelectTest(test.testId)}
              onRefresh={onRefresh}
              isSelected={selection.isSelected(test.testId)}
              onToggleSelection={() => selection.toggleSelection(test.testId)}
            />
          ))}
        </div>
      </div>
    </>
  )
})

export default TestsGrid
