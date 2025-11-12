/**
 * CodeViewer - Composant réutilisable pour afficher et naviguer entre fichiers de code
 * Utilisé par ExportFigmaDetailPage et ResponsiveMergeDetailPage
 */

import { useState, useEffect } from 'react'
import { Prism as SyntaxHighlighter } from 'react-syntax-highlighter'
import { vscDarkPlus } from 'react-syntax-highlighter/dist/esm/styles/prism'
import { useTranslation } from '../../i18n/I18nContext'
import { Card } from '@/components/ui/card'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'

export interface CodeFile {
  name: string
  content: string
  type: 'tsx' | 'jsx' | 'css' | 'json' | 'xml' | 'js'
  icon: string
}

export type CodeVersion = 'original' | 'fixed' | 'clean'

export interface CodeViewerProps {
  /** Map de fichiers groupés par version */
  files: {
    original?: CodeFile[]
    fixed?: CodeFile[]
    clean?: CodeFile[]
  }
  /** Version par défaut à afficher */
  defaultVersion?: CodeVersion
  /** Afficher le sélecteur de version (true pour tests MCP, false pour responsive) */
  showVersionSelector?: boolean
  /** Fonction de chargement asynchrone des fichiers */
  onLoadFiles?: () => Promise<void>
}

export function CodeViewer({
  files,
  defaultVersion = 'clean',
  showVersionSelector = true,
  onLoadFiles
}: CodeViewerProps) {
  const { t } = useTranslation()
  const [version, setVersion] = useState<CodeVersion>(defaultVersion)
  const [selectedIndex, setSelectedIndex] = useState(0)
  const [loading, setLoading] = useState(!!onLoadFiles)

  useEffect(() => {
    if (onLoadFiles) {
      onLoadFiles().then(() => setLoading(false))
    }
  }, [onLoadFiles])

  useEffect(() => {
    setSelectedIndex(0)
  }, [version])

  if (loading) {
    return <div className="p-10 text-center text-muted-foreground">{t('detail.code.loading')}</div>
  }

  // Si pas de sélecteur de version, utiliser les fichiers de la première clé disponible
  const availableFiles = showVersionSelector
    ? files[version] || []
    : Object.values(files).find(arr => arr && arr.length > 0) || []

  if (availableFiles.length === 0) {
    return <div className="p-10 text-center text-muted-foreground">{t('detail.code.no_files')}</div>
  }

  const selectedFile = availableFiles[selectedIndex]

  // Déterminer le langage pour le syntax highlighter
  const getLanguage = (type: string) => {
    switch (type) {
      case 'tsx':
      case 'jsx':
        return 'typescript'
      case 'css':
        return 'css'
      case 'json':
        return 'json'
      case 'xml':
        return 'xml'
      case 'js':
        return 'javascript'
      default:
        return 'typescript'
    }
  }

  return (
    <div className="space-y-4">
      {/* Controls - Version & File Selection */}
      <Card>
        <div className="flex flex-col gap-4 p-4 sm:flex-row sm:items-center sm:justify-between">
          {/* Version Selector (conditionnel) */}
          {showVersionSelector && (
            <div className="flex items-center gap-3">
              <span className="text-sm font-medium text-muted-foreground">{t('detail.code.version')}:</span>
              <Tabs value={version} onValueChange={(value: string) => setVersion(value as CodeVersion)} className="w-auto">
                <TabsList>
                  {files.original && files.original.length > 0 && (
                    <TabsTrigger value="original" className="gap-1.5">
                      <span>📄</span>
                      <span className="hidden sm:inline">MCP</span>
                    </TabsTrigger>
                  )}
                  {files.fixed && files.fixed.length > 0 && (
                    <TabsTrigger value="fixed" className="gap-1.5">
                      <span>⚛️</span>
                      <span className="hidden sm:inline">Fixed</span>
                    </TabsTrigger>
                  )}
                  {files.clean && files.clean.length > 0 && (
                    <TabsTrigger value="clean" className="gap-1.5">
                      <span>✨</span>
                      <span className="hidden sm:inline">Clean</span>
                    </TabsTrigger>
                  )}
                </TabsList>
              </Tabs>
            </div>
          )}

          {/* File Selector */}
          <div className="flex flex-1 items-center gap-3 sm:max-w-md">
            <span className="text-sm font-medium text-muted-foreground">{t('detail.code.file')}:</span>
            <Select value={selectedIndex.toString()} onValueChange={(val) => setSelectedIndex(parseInt(val))}>
              <SelectTrigger className="flex-1">
                <SelectValue>
                  <div className="flex items-center gap-2">
                    <span>{selectedFile.icon}</span>
                    <span className="truncate">{selectedFile.name}</span>
                  </div>
                </SelectValue>
              </SelectTrigger>
              <SelectContent>
                {availableFiles.map((file, index) => (
                  <SelectItem key={index} value={index.toString()}>
                    <div className="flex items-center gap-2">
                      <span>{file.icon}</span>
                      <span>{file.name}</span>
                    </div>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>
      </Card>

      {/* Code Viewer */}
      <Card className="overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between border-b bg-muted px-5 py-3">
          <div className="flex items-center gap-2">
            <span className="text-base">{selectedFile.icon}</span>
            <span className="text-sm font-semibold">{selectedFile.name}</span>
          </div>
          <span className="text-xs text-muted-foreground">
            {selectedFile.content.split('\n').length} {t('detail.code.lines')}
          </span>
        </div>

        {/* Code */}
        <ScrollArea className="h-[65vh]">
          <SyntaxHighlighter
            language={getLanguage(selectedFile.type)}
            style={vscDarkPlus}
            customStyle={{
              margin: 0,
              borderRadius: 0,
              fontSize: '13px',
              lineHeight: '1.5',
              minHeight: '65vh'
            }}
            showLineNumbers
          >
            {selectedFile.content}
          </SyntaxHighlighter>
        </ScrollArea>
      </Card>
    </div>
  )
}
