/**
 * TestDetail - Vue détaillée d'un test MCP
 *
 * 4 onglets :
 * 1. Preview - Rendu React du composant généré
 * 2. Code - Code source Component-clean.tsx avec syntax highlighting
 * 3. Rapport - Rapport HTML interactif (report.html)
 * 4. Technical Analysis - Documentation markdown technique (analysis.md)
 */

import { useState, useEffect, Suspense, ComponentType } from 'react'
import { Prism as SyntaxHighlighter } from 'react-syntax-highlighter'
import { vscDarkPlus } from 'react-syntax-highlighter/dist/esm/styles/prism'
import { useTranslation } from '../../i18n/I18nContext'
import { useSidebar } from '@/components/ui/sidebar'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Card } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Separator } from '@/components/ui/separator'
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { ReportViewer } from '../common/ReportViewer'
import { TechnicalAnalysisViewer } from '../common/TechnicalAnalysisViewer'
import { ResponsiveViewportControls, BreakpointPreset } from '../common/ResponsiveViewportControls'
import {
  ExternalLink,
  Download,
  Info,
  Eye,
  Clock,
  Maximize2,
  Smartphone,
  Tablet,
  Monitor,
  Maximize,
  MoreVertical,
  Package,
  FileText,
  Image as ImageIcon,
  Zap
} from 'lucide-react'

type Tab = 'preview' | 'code' | 'report' | 'technical'

interface Metadata {
  fileName?: string
  layerName?: string
  timestamp?: string | number
  figmaUrl?: string
  figmaNodeId?: string
  componentName?: string
  dimensions?: {
    width: number
    height: number
  }
  stats?: {
    totalNodes?: number
    sectionsDetected?: number
    imagesOrganized?: number
    totalFixes?: number
    classesOptimized?: number
    fontsConverted?: number
  }
}

interface TestDetailProps {
  exportId: string
  onBack: () => void
}

function formatDate(timestamp: string | number) {
  const dateValue = typeof timestamp === 'number' && timestamp < 10000000000
    ? timestamp * 1000
    : timestamp

  return new Date(dateValue).toLocaleString('fr-FR', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit'
  })
}

export default function TestDetail({ exportId, onBack }: TestDetailProps) {
  const { t } = useTranslation()
  const { setOpen } = useSidebar()
  const [activeTab, setActiveTab] = useState<Tab>('preview')
  const [metadata, setMetadata] = useState<Metadata | null>(null)
  const [analysis, setAnalysis] = useState<string>('')
  const [loading, setLoading] = useState<boolean>(true)
  const [error, setError] = useState<string | null>(null)

  // Auto-collapse sidebar on mount only
  useEffect(() => {
    setOpen(false)
  }, []) // Empty dependency array = runs once on mount only

  useEffect(() => {
    loadTestData()
  }, [exportId])

  const loadTestData = async () => {
    try {
      setLoading(true)

      // Load test data via API instead of dynamic imports to avoid HMR issues
      const response = await fetch(`/api/export_figma/${exportId}/data`)

      if (!response.ok) {
        throw new Error('Failed to fetch test data')
      }

      const data = await response.json()

      setMetadata(data.metadata || {})
      setAnalysis(data.analysis || '')

      setLoading(false)
    } catch (err) {
      console.error('Error loading test:', err)
      setError(err instanceof Error ? err.message : 'Unknown error')
      setLoading(false)
    }
  }

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <div className="text-center">
          <div className="mx-auto mb-4 h-12 w-12 animate-spin rounded-full border-b-2 border-primary"></div>
          <p className="text-muted-foreground">{t('detail.loading')}</p>
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <div className="max-w-md text-center">
          <div className="mb-4 text-6xl">❌</div>
          <h3 className="mb-2 text-xl font-semibold text-foreground">
            {t('detail.error.title')}
          </h3>
          <p className="mb-6 text-muted-foreground">{error}</p>
          <Button onClick={onBack}>
            {t('detail.error.back')}
          </Button>
        </div>
      </div>
    )
  }

  const nodeIdDisplay = (() => {
    const match = exportId?.match(/^node-(.+)-\d+$/)
    return match ? match[1] : exportId?.replace('node-', '')
  })()

  return (
    <div className="min-h-screen bg-background">
      {/* Compact Hero Section */}
      <div className="border-b bg-gradient-to-r from-primary/5 via-primary/10 to-primary/5">
        <div className="w-full px-4 sm:px-6 py-4 sm:py-6">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
            {/* Title & Metadata */}
            <div className="flex-1 space-y-3">
              <div className="flex flex-wrap items-center gap-2 sm:gap-3">
                <h1 className="text-2xl sm:text-3xl font-bold text-foreground">
                  {metadata?.layerName || metadata?.fileName || 'Test'}
                </h1>
                {metadata?.figmaNodeId && (
                  <Badge variant="outline" className="font-mono text-xs">
                    #{nodeIdDisplay}
                  </Badge>
                )}
              </div>

              <div className="flex flex-wrap items-center gap-3 text-sm text-muted-foreground">
                <span className="flex items-center gap-1.5">
                  <Clock className="h-4 w-4" />
                  {metadata?.timestamp && formatDate(metadata.timestamp)}
                </span>
                {metadata?.dimensions && (
                  <span className="flex items-center gap-1.5">
                    <Maximize2 className="h-4 w-4" />
                    {metadata.dimensions.width} × {metadata.dimensions.height}
                  </span>
                )}
              </div>
            </div>

            {/* Actions & Stats - Right side */}
            <div className="flex flex-col gap-3">
              {/* Actions - Desktop */}
              <div className="hidden sm:flex items-center gap-2">
                <Button variant="default" size="sm" asChild>
                  <a
                    href={`/preview?export=${exportId}&version=fixed`}
                    className="[&]:dark:text-white [&>svg]:dark:text-white"
                    style={{ color: 'white' }}
                  >
                    <Eye className="mr-2 h-4 w-4" style={{ color: 'white' }} />
                    Preview
                  </a>
                </Button>
                <Button variant="outline" size="sm" asChild className="border-primary text-primary hover:bg-primary hover:text-primary-foreground">
                  <a
                    href={`/api/download/${exportId}`}
                    download={`${exportId}.zip`}
                  >
                    <Download className="mr-2 h-4 w-4" />
                    Download
                  </a>
                </Button>
                <Button variant="secondary" size="sm" asChild className="bg-foreground/90 text-background hover:bg-foreground font-semibold">
                  <a
                    href={metadata?.figmaUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                  >
                    <ExternalLink className="mr-2 h-4 w-4" />
                    Figma
                  </a>
                </Button>
              </div>

              {/* Actions - Mobile (Dropdown) */}
              <div className="sm:hidden">
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button variant="outline" size="sm">
                      <MoreVertical className="h-4 w-4" />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end">
                    <DropdownMenuItem asChild>
                      <a
                        href={`/preview?export=${exportId}&version=fixed`}
                        className="flex items-center"
                      >
                        <Eye className="mr-2 h-4 w-4" />
                        Preview
                      </a>
                    </DropdownMenuItem>
                    <DropdownMenuItem asChild>
                      <a
                        href={`/api/download/${exportId}`}
                        download={`${exportId}.zip`}
                        className="flex items-center"
                      >
                        <Download className="mr-2 h-4 w-4" />
                        Download
                      </a>
                    </DropdownMenuItem>
                    <DropdownMenuItem asChild>
                      <a
                        href={metadata?.figmaUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="flex items-center"
                      >
                        <ExternalLink className="mr-2 h-4 w-4" />
                        Open in Figma
                      </a>
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              </div>

              {/* Stats Bar */}
              {metadata?.stats && (
                <div className="flex items-center gap-2 overflow-x-auto pb-2">
                  {metadata.stats.totalNodes !== undefined && (
                    <Card className="p-2">
                      <div className="flex items-center gap-2">
                        <div className="rounded-md bg-primary/10 p-1.5">
                          <Package className="h-3.5 w-3.5 text-primary" />
                        </div>
                        <div className="flex items-baseline gap-1">
                          <p className="text-lg font-bold">{metadata.stats.totalNodes}</p>
                          <p className="text-[10px] text-muted-foreground">Nodes</p>
                        </div>
                      </div>
                    </Card>
                  )}

                  {metadata.stats.sectionsDetected !== undefined && metadata.stats.sectionsDetected > 0 && (
                    <Card className="p-2">
                      <div className="flex items-center gap-2">
                        <div className="rounded-md bg-primary/10 p-1.5">
                          <FileText className="h-3.5 w-3.5 text-primary" />
                        </div>
                        <div className="flex items-baseline gap-1">
                          <p className="text-lg font-bold">{metadata.stats.sectionsDetected}</p>
                          <p className="text-[10px] text-muted-foreground">Sections</p>
                        </div>
                      </div>
                    </Card>
                  )}

                  {metadata.stats.imagesOrganized !== undefined && metadata.stats.imagesOrganized > 0 && (
                    <Card className="p-2">
                      <div className="flex items-center gap-2">
                        <div className="rounded-md bg-primary/10 p-1.5">
                          <ImageIcon className="h-3.5 w-3.5 text-primary" />
                        </div>
                        <div className="flex items-baseline gap-1">
                          <p className="text-lg font-bold">{metadata.stats.imagesOrganized}</p>
                          <p className="text-[10px] text-muted-foreground">Images</p>
                        </div>
                      </div>
                    </Card>
                  )}

                  {(metadata.stats.totalFixes !== undefined || metadata.stats.classesOptimized !== undefined) && (
                    <Card className="p-2">
                      <div className="flex items-center gap-2">
                        <div className="rounded-md bg-primary/10 p-1.5">
                          <Zap className="h-3.5 w-3.5 text-primary" />
                        </div>
                        <div className="flex items-baseline gap-1">
                          <p className="text-lg font-bold">
                            {metadata.stats.totalFixes || metadata.stats.classesOptimized || 0}
                          </p>
                          <p className="text-[10px] text-muted-foreground">Fixes</p>
                        </div>
                      </div>
                    </Card>
                  )}
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Tabs */}
      <Tabs value={activeTab} onValueChange={(value: string) => setActiveTab(value as Tab)} className="w-full max-w-full">
        <div className="bg-card px-6 py-4 max-w-full">
          <div className="flex items-center justify-between">
            <TabsList>
              <TabsTrigger value="preview">
                {t('detail.tabs.preview')}
              </TabsTrigger>
              <TabsTrigger value="report">
                {t('detail.tabs.report')}
              </TabsTrigger>
              <TabsTrigger value="code">
                {t('detail.tabs.code')}
              </TabsTrigger>
              <TabsTrigger value="technical">
                {t('detail.tabs.technical')}
              </TabsTrigger>
            </TabsList>

            {/* Info popover - only show on preview tab */}
            {activeTab === 'preview' && (
              <Popover>
                <PopoverTrigger asChild>
                  <Button variant="ghost" size="sm">
                    <Info className="mr-2 h-4 w-4" />
                    Info
                  </Button>
                </PopoverTrigger>
                <PopoverContent align="end" className="w-96">
                  <Alert>
                    <Info className="h-4 w-4" />
                    <AlertDescription>
                      <p className="mb-2 font-semibold">{t('detail.preview.banner_title')}</p>
                      <p className="text-sm">{t('detail.preview.banner_text')}</p>
                    </AlertDescription>
                  </Alert>
                  <Separator className="my-4" />
                  <div>
                    <div className="mb-2 flex items-center gap-2">
                      <span className="text-sm">💡</span>
                      <p className="text-sm font-semibold">{t('detail.preview.tips_title')}</p>
                    </div>
                    <ul className="space-y-2 text-sm text-muted-foreground">
                      {metadata?.dimensions && (
                        <li className="flex items-start gap-2">
                          <span>→</span>
                          <span>{t('detail.preview.tips.0', { width: metadata.dimensions.width.toString(), height: metadata.dimensions.height.toString() })}</span>
                        </li>
                      )}
                      <li className="flex items-start gap-2">
                        <span>→</span>
                        <span>{t('detail.preview.tips.1')}</span>
                      </li>
                      <li className="flex items-start gap-2">
                        <span>→</span>
                        <span>{t('detail.preview.tips.2')}</span>
                      </li>
                    </ul>
                  </div>
                </PopoverContent>
              </Popover>
            )}
          </div>
        </div>

        {/* Tab Content */}
        <main className={activeTab === 'preview' ? 'w-full max-w-full' : 'w-full max-w-full px-6 py-8'}>
          <TabsContent value="preview" className="mt-0 max-w-full">
            <PreviewTab exportId={exportId} componentName={metadata?.componentName} dimensions={metadata?.dimensions} />
          </TabsContent>

          <TabsContent value="code" className="mt-0 max-w-full">
            <CodeTab exportId={exportId} />
          </TabsContent>

          <TabsContent value="report" className="mt-0 max-w-full">
            <ReportViewer reportPath={`/src/generated/export_figma/${exportId}/report.html`} />
          </TabsContent>

          <TabsContent value="technical" className="mt-0 max-w-full">
            <TechnicalAnalysisViewer analysis={analysis} />
          </TabsContent>
        </main>
      </Tabs>
    </div>
  )
}

/**
 * TAB 1: Preview - Rendu React du composant généré avec ResizablePanel
 */
interface PreviewTabProps {
  exportId: string
  componentName?: string
  dimensions?: {
    width: number
    height: number
  }
}

function PreviewTab({ exportId, dimensions }: PreviewTabProps) {
  const { t } = useTranslation()
  const [Component, setComponent] = useState<ComponentType | null>(null)
  const [loading, setLoading] = useState<boolean>(true)
  const [error, setError] = useState<string | null>(null)

  const defaultWidth = dimensions?.width || 1200
  const [viewportWidth, setViewportWidth] = useState<number>(defaultWidth)

  useEffect(() => {
    loadComponent()
  }, [exportId])

  useEffect(() => {
    const link = document.createElement('link')
    link.rel = 'stylesheet'
    link.href = `/src/generated/export_figma/${exportId}/Component-clean.css`
    link.id = `test-css-${exportId}`
    document.head.appendChild(link)

    return () => {
      const existingLink = document.getElementById(`test-css-${exportId}`)
      if (existingLink) {
        document.head.removeChild(existingLink)
      }
    }
  }, [exportId])

  const loadComponent = async () => {
    try {
      setLoading(true)

      let module: any
      try {
        module = await import(`../../generated/export_figma/${exportId}/Component-clean.tsx`)
      } catch (e) {
        try {
          module = await import(`../../generated/export_figma/${exportId}/Component-clean.jsx`)
        } catch (e2) {
          try {
            module = await import(`../../generated/export_figma/${exportId}/Component.tsx`)
          } catch (e3) {
            module = await import(`../../generated/export_figma/${exportId}/Component.jsx`)
          }
        }
      }
      setComponent(() => module.default)

      setLoading(false)
    } catch (err) {
      console.error('Error loading component:', err)
      setError(err instanceof Error ? err.message : 'Unknown error')
      setLoading(false)
    }
  }

  // Custom presets avec couleurs pour ResponsiveViewportControls
  const customPresets: BreakpointPreset[] = [
    { name: 'Mobile', width: 375, icon: Smartphone, color: '#10b981' }, // green-500
    { name: 'Tablet', width: 768, icon: Tablet, color: '#f97316' },      // orange-500
    ...(dimensions ? [{ name: 'Native', width: dimensions.width, icon: Maximize, color: '#8b5cf6' }] : []), // violet-500
    { name: 'Desktop', width: 1200, icon: Monitor, color: '#3b82f6' },   // blue-500
    { name: 'Large', width: 1920, icon: Maximize, color: '#6366f1' }     // indigo-500
  ].sort((a, b) => a.width - b.width)

  if (loading) {
    return (
      <Card className="p-12 text-center">
        <div className="mx-auto mb-4 h-12 w-12 animate-spin rounded-full border-b-2 border-primary"></div>
        <p className="text-muted-foreground">{t('detail.preview.loading_component')}</p>
      </Card>
    )
  }

  if (error) {
    return (
      <Card className="p-12 text-center">
        <div className="mb-4 text-6xl">⚠️</div>
        <h3 className="mb-2 text-xl font-semibold">{t('detail.preview.error_title')}</h3>
        <p className="mb-4 text-muted-foreground">{error}</p>
        <p className="text-sm text-muted-foreground">{t('detail.preview.error_text')}</p>
      </Card>
    )
  }

  return (
    <div>
      {/* Responsive Controls - Sticky */}
      <div className="sticky top-0 z-10 bg-muted/50 py-4 backdrop-blur">
        <div className="w-full px-4 sm:px-6">
          <ResponsiveViewportControls
            viewportWidth={viewportWidth}
            onViewportChange={setViewportWidth}
            title={t('detail.preview.responsive_test')}
            customPresets={customPresets}
            showNativeBadge={dimensions !== undefined && viewportWidth === dimensions.width}
            nativeLabel={t('detail.preview.native')}
          />
        </div>
      </div>

      {/* Component Render */}
      <div
        className="flex justify-center items-start overflow-auto py-8"
        style={{
          backgroundColor: '#fafafa',
          backgroundImage: `
            linear-gradient(to right, rgb(209 213 219 / 0.5) 1px, transparent 1px),
            linear-gradient(to bottom, rgb(209 213 219 / 0.5) 1px, transparent 1px)
          `,
          backgroundSize: '20px 20px',
          minHeight: 'calc(100vh - 300px)'
        }}
      >
        <div
          className="bg-white shadow-lg"
          style={{
            display: 'flex',
            flexDirection: 'column',
            width: `${viewportWidth}px`,
            minHeight: dimensions?.height ? `${dimensions.height}px` : 'auto'
          }}
        >
          {/* Wrapper flex: permet à la racine avec flex-1 de fonctionner correctement avec minHeight */}
          <div style={{ flex: '1 1 auto', display: 'flex', flexDirection: 'column' }}>
            {Component && (
              <Suspense fallback={<div className="p-8 text-center text-muted-foreground">Loading component...</div>}>
                <Component />
              </Suspense>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}

/**
 * TAB 2: Code - Navigation entre tous les fichiers
 */
interface CodeTabProps {
  exportId: string
}

interface CodeFile {
  name: string
  content: string
  type: 'tsx' | 'css'
  icon: string
}

type CodeVersion = 'original' | 'fixed' | 'clean'

type FileCache = {
  original: CodeFile[]
  fixed: CodeFile[]
  clean: CodeFile[]
}

function CodeTab({ exportId }: CodeTabProps) {
  const { t } = useTranslation()
  const [version, setVersion] = useState<CodeVersion>('clean')
  const [fileCache, setFileCache] = useState<FileCache | null>(null)
  const [selectedIndex, setSelectedIndex] = useState(0)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    loadAllFiles()
  }, [exportId])

  useEffect(() => {
    setSelectedIndex(0)
  }, [version])

  const loadAllFiles = async () => {
    try {
      setLoading(true)
      const cache: FileCache = {
        original: [],
        fixed: [],
        clean: []
      }

      // Load Original files
      try {
        const originalModule = await import(`../../generated/export_figma/${exportId}/Component.tsx?raw`)
        cache.original.push({ name: 'Component.tsx', content: originalModule.default, type: 'tsx', icon: '📄' })
      } catch (e) {
        console.warn('No original Component.tsx')
      }

      try {
        const metadataModule = await import(`../../generated/export_figma/${exportId}/metadata.xml?raw`)
        cache.original.push({ name: 'metadata.xml', content: metadataModule.default, type: 'tsx', icon: '📋' })
      } catch (e) {
        console.warn('No metadata.xml')
      }

      try {
        const variablesModule = await import(`../../generated/export_figma/${exportId}/variables.json?raw`)
        cache.original.push({ name: 'variables.json', content: variablesModule.default, type: 'tsx', icon: '🎨' })
      } catch (e) {
        console.warn('No variables.json')
      }

      // Load Fixed files
      try {
        const fixedModule = await import(`../../generated/export_figma/${exportId}/Component-fixed.tsx?raw`)
        cache.fixed.push({ name: 'Component-fixed.tsx', content: fixedModule.default, type: 'tsx', icon: '⚛️' })
      } catch (e) {
        console.warn('No Component-fixed.tsx')
      }

      try {
        const cssModule = await import(`../../generated/export_figma/${exportId}/Component-fixed.css?raw`)
        cache.fixed.push({ name: 'Component-fixed.css', content: cssModule.default, type: 'css', icon: '🎨' })
      } catch (e) {
        console.warn('No Component-fixed.css')
      }

      try {
        const response = await fetch('/tailwind.config.js')
        if (response.ok) {
          const content = await response.text()
          cache.fixed.push({ name: 'tailwind.config.js', content: content, type: 'tsx', icon: '⚙️' })
        }
      } catch (e) {
        console.warn('No tailwind.config.js')
      }

      // Load Fixed Chunks
      const chunkNames = ['ImageText', 'Header', 'Footer', 'Hero', 'Card', 'Button', 'Navigation', 'Sidebar']
      for (const chunkName of chunkNames) {
        try {
          const tsxModule = await import(`../../generated/export_figma/${exportId}/chunks-fixed/${chunkName}.tsx?raw`)
          cache.fixed.push({ name: `chunks/${chunkName}.tsx`, content: tsxModule.default, type: 'tsx', icon: '🧩' })
        } catch (e) {
          // Chunk doesn't exist
        }

        try {
          const cssModule = await import(`../../generated/export_figma/${exportId}/chunks-fixed/${chunkName}.css?raw`)
          cache.fixed.push({ name: `chunks/${chunkName}.css`, content: cssModule.default, type: 'css', icon: '🎨' })
        } catch (e) {
          // CSS doesn't exist
        }
      }

      // Load Clean files
      try {
        const cleanModule = await import(`../../generated/export_figma/${exportId}/Component-clean.tsx?raw`)
        cache.clean.push({ name: 'Component-clean.tsx', content: cleanModule.default, type: 'tsx', icon: '✨' })
      } catch (e) {
        console.warn('No Component-clean.tsx')
      }

      try {
        const cssModule = await import(`../../generated/export_figma/${exportId}/Component-clean.css?raw`)
        cache.clean.push({ name: 'Component-clean.css', content: cssModule.default, type: 'css', icon: '🎨' })
      } catch (e) {
        console.warn('No Component-clean.css')
      }

      setFileCache(cache)
      setLoading(false)
    } catch (err) {
      console.error('Error loading files:', err)
      setLoading(false)
    }
  }

  if (loading || !fileCache) {
    return <div className="p-10 text-center text-muted-foreground">{t('detail.code.loading')}</div>
  }

  const files = fileCache[version]

  if (files.length === 0) {
    return <div className="p-10 text-center text-muted-foreground">{t('detail.code.no_files')}</div>
  }

  const selectedFile = files[selectedIndex]

  return (
    <div className="space-y-4">
      {/* Controls - Version & File Selection */}
      <Card>
        <div className="flex flex-col gap-4 p-4 sm:flex-row sm:items-center sm:justify-between">
          {/* Version Selector */}
          <div className="flex items-center gap-3">
            <span className="text-sm font-medium text-muted-foreground">{t('detail.code.version')}:</span>
            <Tabs value={version} onValueChange={(value: string) => setVersion(value as CodeVersion)} className="w-auto">
              <TabsList>
                <TabsTrigger value="original" className="gap-1.5">
                  <span>📄</span>
                  <span className="hidden sm:inline">MCP</span>
                </TabsTrigger>
                <TabsTrigger value="fixed" className="gap-1.5">
                  <span>⚛️</span>
                  <span className="hidden sm:inline">Fixed</span>
                </TabsTrigger>
                <TabsTrigger value="clean" className="gap-1.5">
                  <span>✨</span>
                  <span className="hidden sm:inline">Clean</span>
                </TabsTrigger>
              </TabsList>
            </Tabs>
          </div>

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
                {files.map((file, index) => (
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
            language={selectedFile.type === 'tsx' ? 'typescript' : 'css'}
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

