import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"

interface Test {
  testId: string
  layerName?: string
  fileName?: string
}

interface TestSelectWithPreviewProps {
  tests: Test[]
  value: string
  onValueChange: (value: string) => void
  placeholder?: string
  disabled?: boolean
  id?: string
}

export function TestSelectWithPreview({
  tests,
  value,
  onValueChange,
  placeholder = "Sélectionnez un test",
  disabled,
  id
}: TestSelectWithPreviewProps) {
  const selectedTest = tests.find(t => t.testId === value)

  return (
    <div className="flex items-start gap-3">
      <div className="flex-1">
        <Select value={value} onValueChange={onValueChange} disabled={disabled}>
          <SelectTrigger id={id}>
            <SelectValue placeholder={placeholder} />
          </SelectTrigger>
          <SelectContent className="max-h-[300px]">
            {tests.map((test) => (
              <SelectItem key={test.testId} value={test.testId} className="cursor-pointer">
                <div className="flex items-center gap-3 py-1">
                  {/* Thumbnail in list */}
                  <div className="w-12 h-8 flex-shrink-0 rounded border overflow-hidden bg-muted">
                    <img
                      src={`/src/generated/tests/${test.testId}/img/figma-screenshot.png`}
                      alt="Thumbnail"
                      className="w-full h-full object-cover object-top"
                      onError={(e) => {
                        e.currentTarget.style.display = 'none'
                        const parent = e.currentTarget.parentElement
                        if (parent) {
                          parent.innerHTML = '<span class="text-xs">🎨</span>'
                        }
                      }}
                    />
                  </div>
                  <div className="flex flex-col min-w-0">
                    <span className="text-sm truncate">{test.layerName || test.fileName || 'Untitled'}</span>
                    <span className="text-xs text-muted-foreground font-mono truncate">{test.testId}</span>
                  </div>
                </div>
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* Preview Image - shows when a test is selected */}
      {selectedTest && (
        <div className="w-24 h-16 flex-shrink-0 rounded border overflow-hidden bg-muted">
          <img
            src={`/src/generated/tests/${selectedTest.testId}/img/figma-screenshot.png`}
            alt="Preview"
            className="w-full h-full object-cover object-top"
            onError={(e) => {
              e.currentTarget.style.display = 'none'
              const parent = e.currentTarget.parentElement
              if (parent) {
                parent.innerHTML = '<div class="flex items-center justify-center h-full text-2xl">🎨</div>'
              }
            }}
          />
        </div>
      )}
    </div>
  )
}
