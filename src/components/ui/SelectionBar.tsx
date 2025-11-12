import { Button } from "./button"
import { Trash2, Loader2 } from 'lucide-react'
import { useTranslation } from '../../i18n/I18nContext'

interface SelectionBarProps {
  selectedCount: number
  onDelete: () => void
  isDeleting?: boolean
}

export function SelectionBar({ selectedCount, onDelete, isDeleting = false }: SelectionBarProps) {
  const { t } = useTranslation()

  if (selectedCount === 0) return null

  return (
    <div className="flex items-center justify-between rounded-lg border bg-muted/50 px-4 py-2">
      <span className="text-sm text-muted-foreground">
        {selectedCount} {t('home.table.selected')}
      </span>
      <Button
        variant="destructive"
        size="sm"
        onClick={onDelete}
        disabled={isDeleting}
      >
        {isDeleting ? (
          <>
            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            {t('home.table.deleting')}
          </>
        ) : (
          <>
            <Trash2 className="mr-2 h-4 w-4" />
            {t('home.table.delete_selected')}
          </>
        )}
      </Button>
    </div>
  )
}
