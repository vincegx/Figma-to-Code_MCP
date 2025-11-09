/**
 * AnalyzePage - Page for triggering new Figma analysis
 * Shows analysis form with real-time logs and recent tests
 */

import { useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import { useTests } from '../../hooks/useTests'
import AnalysisForm from '../features/analysis/AnalysisForm'
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Package, Image, Zap } from "lucide-react"

export default function AnalyzePage() {
  const navigate = useNavigate()
  const { tests, reload } = useTests()

  // Recent tests calculation (last 5)
  const recentTests = useMemo(() => {
    return [...tests]
      .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime())
      .slice(0, 5)
  }, [tests])

  return (
    <div className="w-full space-y-6">
      <AnalysisForm onAnalysisComplete={reload} />

      {/* Recent Tests */}
      <Card>
        <CardHeader>
          <CardTitle>Recent Tests</CardTitle>
        </CardHeader>
        <CardContent>
          {recentTests.length > 0 ? (
            <div className="space-y-2">
              {recentTests.map((test) => (
                <div
                  key={test.testId}
                  className="flex items-center justify-between rounded-lg border p-3 hover:bg-accent cursor-pointer transition-colors"
                  onClick={() => navigate(`/tests/${test.testId}`)}
                >
                  <div className="flex-1 min-w-0">
                    <p className="font-medium truncate">{test.layerName || test.fileName || 'Untitled'}</p>
                    <p className="text-xs text-muted-foreground truncate">{test.testId}</p>
                  </div>
                  <div className="flex items-center gap-2 md:gap-4 text-sm text-muted-foreground shrink-0 ml-4">
                    <div className="flex items-center gap-1">
                      <Package className="h-4 w-4" />
                      <span className="hidden sm:inline">{test.stats?.totalNodes || 0}</span>
                    </div>
                    <div className="flex items-center gap-1">
                      <Image className="h-4 w-4" />
                      <span className="hidden sm:inline">{test.stats?.imagesOrganized || 0}</span>
                    </div>
                    <div className="flex items-center gap-1">
                      <Zap className="h-4 w-4" />
                      <span className="hidden sm:inline">{test.stats?.totalFixes || test.stats?.classesOptimized || 0}</span>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="py-12 text-center text-muted-foreground">
              No tests found
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
