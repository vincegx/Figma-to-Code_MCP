import { useState, useCallback } from 'react'

/**
 * Reusable hook for managing multi-item selection
 * Used for bulk delete operations in grid/table views
 */
export function useSelection<T extends { [key: string]: any }>(
  items: T[],
  getItemId: (item: T) => string
) {
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set())

  const toggleSelection = useCallback((itemId: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev)
      if (next.has(itemId)) {
        next.delete(itemId)
      } else {
        next.add(itemId)
      }
      return next
    })
  }, [])

  const toggleAll = useCallback(() => {
    if (selectedIds.size === items.length && items.length > 0) {
      setSelectedIds(new Set())
    } else {
      setSelectedIds(new Set(items.map(getItemId)))
    }
  }, [items, selectedIds.size, getItemId])

  const clearSelection = useCallback(() => {
    setSelectedIds(new Set())
  }, [])

  const isSelected = useCallback(
    (itemId: string) => selectedIds.has(itemId),
    [selectedIds]
  )

  const isAllSelected = selectedIds.size === items.length && items.length > 0

  return {
    selectedIds,
    toggleSelection,
    toggleAll,
    clearSelection,
    isSelected,
    isAllSelected,
    selectedCount: selectedIds.size,
  }
}
