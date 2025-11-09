import { memo } from 'react'
import { TestCard } from './test-card'

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
}

const TestsGrid = memo(function TestsGrid({ tests, onSelectTest }: TestsGridProps) {
  return (
    <div className="grid gap-4 sm:gap-6" style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(min(280px, 100%), 1fr))' }}>
      {tests.map((test) => (
        <TestCard
          key={test.testId}
          test={test}
          onSelect={() => onSelectTest(test.testId)}
        />
      ))}
    </div>
  )
})

export default TestsGrid
