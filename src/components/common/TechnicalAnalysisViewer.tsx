/**
 * TechnicalAnalysisViewer - Composant réutilisable pour afficher l'analyse technique
 * Utilisé par ExportFigmaDetailPage et ResponsiveMergeDetailPage
 */

import { Prism as SyntaxHighlighter } from 'react-syntax-highlighter'
import { vscDarkPlus } from 'react-syntax-highlighter/dist/esm/styles/prism'
import { useTranslation } from '../../i18n/I18nContext'
import { Card } from '@/components/ui/card'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Info } from 'lucide-react'

interface TechnicalAnalysisViewerProps {
  analysis: string
  title?: string
}

export function TechnicalAnalysisViewer({ analysis, title = 'analysis.md' }: TechnicalAnalysisViewerProps) {
  const { t } = useTranslation()

  if (!analysis) {
    return (
      <Card className="p-12 text-center">
        <div className="mb-4 text-6xl">📄</div>
        <h3 className="mb-2 text-xl font-semibold">{t('detail.technical.no_analysis_title')}</h3>
        <p className="text-muted-foreground">{t('detail.technical.no_analysis_text')}</p>
      </Card>
    )
  }

  return (
    <div className="space-y-4 max-w-full">
      {/* Info banner */}
      <Alert>
        <Info className="h-4 w-4" />
        <AlertDescription>
          <p className="mb-1 font-semibold">{t('detail.technical.banner_title')}</p>
          <p className="text-sm">{t('detail.technical.banner_text')}</p>
        </AlertDescription>
      </Alert>

      {/* Markdown code viewer */}
      <Card className="overflow-hidden min-w-0">
        <div className="flex items-center justify-between border-b bg-muted px-6 py-3">
          <h3 className="font-semibold">{title}</h3>
          <span className="text-xs text-muted-foreground">
            {analysis.split('\n').length} lignes
          </span>
        </div>

        <ScrollArea className="h-[600px]">
          <SyntaxHighlighter
            language="markdown"
            style={vscDarkPlus}
            customStyle={{
              margin: 0,
              borderRadius: 0,
              fontSize: '13px',
              lineHeight: '1.5'
            }}
            showLineNumbers
          >
            {analysis}
          </SyntaxHighlighter>
        </ScrollArea>
      </Card>
    </div>
  )
}
