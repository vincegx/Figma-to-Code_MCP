import { Switch } from '@/components/ui/switch'
import { Label } from '@/components/ui/label'
import { ResponsiveViewportControls } from './ResponsiveViewportControls'

interface PreviewNavbarProps {
  id: string
  mode: 'responsive' | 'full'
  onModeChange: (mode: 'responsive' | 'full') => void
  version?: 'clean' | 'fixed'
  onVersionChange?: (version: 'clean' | 'fixed') => void
  detailUrl?: string
  showNavbar: boolean
  onShowNavbar: (show: boolean) => void
  viewportWidth?: number
  onViewportChange?: (width: number) => void
  showColoredBreakpoints?: boolean
}

export function PreviewNavbar({
  id,
  mode,
  onModeChange,
  version,
  onVersionChange,
  detailUrl,
  showNavbar,
  onShowNavbar,
  viewportWidth,
  onViewportChange,
  showColoredBreakpoints = false
}: PreviewNavbarProps) {
  return (
    <div
      className="fixed top-0 left-0 right-0 h-16 z-50"
      onMouseEnter={() => onShowNavbar(true)}
    >
      {/* Navbar - hidden by default, shows on hover */}
      <div className={`
        absolute top-0 left-0 right-0
        transition-all duration-300 ease-in-out
        ${showNavbar ? 'translate-y-0 opacity-100' : '-translate-y-full opacity-0'}
      `}>
        <div className="backdrop-blur-md bg-background/80 border-b border-border shadow-lg">
          <div className="container mx-auto px-4 py-3">
            {/* Top row: Navigation buttons, ID, and controls */}
            <div className="flex items-center justify-between mb-3">
              {/* Left: Navigation buttons */}
              <div className="flex items-center gap-2">
                <button
                  onClick={() => detailUrl ? window.location.href = detailUrl : window.history.back()}
                  className="inline-flex items-center justify-center h-9 px-4 rounded-md text-sm font-medium ring-offset-background transition-colors hover:bg-accent hover:text-accent-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
                >
                  <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="mr-2">
                    <path d="m12 19-7-7 7-7"/>
                    <path d="M19 12H5"/>
                  </svg>
                  Back
                </button>
                <button
                  onClick={() => window.location.href = '/'}
                  className="inline-flex items-center justify-center h-9 px-4 rounded-md text-sm font-medium ring-offset-background transition-colors hover:bg-accent hover:text-accent-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
                >
                  <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="mr-2">
                    <path d="m3 9 9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/>
                    <polyline points="9 22 9 12 15 12 15 22"/>
                  </svg>
                  Home
                </button>
                {detailUrl && (
                  <button
                    onClick={() => window.location.href = detailUrl}
                    className="inline-flex items-center justify-center h-9 px-4 rounded-md text-sm font-medium ring-offset-background transition-colors hover:bg-accent hover:text-accent-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
                  >
                    <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="mr-2">
                      <path d="M2 12s3-7 10-7 10 7 10 7-3 7-10 7-10-7-10-7Z"/>
                      <circle cx="12" cy="12" r="3"/>
                    </svg>
                    Detail
                  </button>
                )}
              </div>

              {/* Center: ID */}
              <div className="absolute left-1/2 -translate-x-1/2">
                <span className="text-xs text-muted-foreground font-mono">
                  {id}
                </span>
              </div>

              {/* Right: Controls */}
              <div className="flex items-center gap-4">
                {/* Version Switch (only for normal tests) */}
                {version && onVersionChange && (
                  <div className="flex items-center gap-2">
                    <Label htmlFor="version-switch" className="text-xs text-muted-foreground cursor-pointer">
                      {version === 'clean' ? 'Clean' : 'Fixed'}
                    </Label>
                    <Switch
                      id="version-switch"
                      checked={version === 'fixed'}
                      onCheckedChange={(checked: boolean) => {
                        const newVersion = checked ? 'fixed' : 'clean'
                        onVersionChange(newVersion)
                      }}
                    />
                  </div>
                )}

                {/* Mode Switch (responsive/full) */}
                <div className="flex items-center gap-2">
                  <Label htmlFor="mode-switch" className="text-xs text-muted-foreground cursor-pointer">
                    {mode === 'responsive' ? '📱 Responsive' : '🖥️ Full Width'}
                  </Label>
                  <Switch
                    id="mode-switch"
                    checked={mode === 'full'}
                    onCheckedChange={(checked: boolean) => {
                      onModeChange(checked ? 'full' : 'responsive')
                    }}
                  />
                </div>
              </div>
            </div>

            {/* Bottom row: Responsive Controls - Only show in responsive mode */}
            {mode === 'responsive' && viewportWidth !== undefined && onViewportChange && (
              <ResponsiveViewportControls
                viewportWidth={viewportWidth}
                onViewportChange={onViewportChange}
                title="Responsive Preview"
                showColoredBreakpoints={showColoredBreakpoints}
              />
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
