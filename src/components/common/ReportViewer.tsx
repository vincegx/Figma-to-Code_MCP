/**
 * ReportViewer - Composant réutilisable pour afficher un rapport HTML
 * Utilisé par ExportFigmaDetailPage et ResponsiveMergeDetailPage
 */

import { Card } from '@/components/ui/card'

interface ReportViewerProps {
  reportPath: string
}

export function ReportViewer({ reportPath }: ReportViewerProps) {
  return (
    <Card className="overflow-hidden">
      <iframe
        src={reportPath}
        className="w-full border-0"
        style={{ minHeight: 'calc(100vh - 300px)' }}
        title="Test Analysis Report"
      />
    </Card>
  )
}
