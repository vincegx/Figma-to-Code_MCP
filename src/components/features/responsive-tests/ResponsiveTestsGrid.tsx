import { memo } from 'react'
import { ResponsiveTestCard } from './ResponsiveTestCard'
import type { ResponsiveTest } from '../../../hooks/useResponsiveTests'

interface ResponsiveTestsGridProps {
  tests: ResponsiveTest[]
  onRefresh?: () => void
}

const ResponsiveTestsGrid = memo(function ResponsiveTestsGrid({ tests, onRefresh }: ResponsiveTestsGridProps) {
  return (
    <div className="grid gap-4 sm:gap-6" style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(min(320px, 100%), 1fr))' }}>
      {tests.map((test) => (
        <ResponsiveTestCard
          key={test.mergeId}
          test={test}
          onRefresh={onRefresh}
        />
      ))}
    </div>
  )
})

export default ResponsiveTestsGrid
