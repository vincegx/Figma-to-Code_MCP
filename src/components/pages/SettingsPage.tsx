import { useState, useEffect } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Switch } from '@/components/ui/switch'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Slider } from '@/components/ui/slider'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Separator } from '@/components/ui/separator'
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion'
import { Settings, Palette, Save, RotateCcw, CheckCircle2, AlertCircle, Sparkles } from 'lucide-react'
import { useTranslation } from '../../i18n/I18nContext'
import { useConfirm } from '../../hooks/useConfirm'
import AnalysisForm from '../features/analysis/AnalysisForm'
import { useTests } from '../../hooks/useTests'

type Settings = {
  mcp: {
    serverUrl: string
    callDelay: number
    minDelay: number
    maxDelay: number
  }
  generation: {
    defaultMode: 'fixed' | 'clean' | 'both'
    chunking: {
      enabled: boolean
    }
  }
  directories: {
    testsOutput: string
    tmpAssets: string
  }
  apiLimits: {
    dailyTokenLimit: number
    thresholds: {
      warning: number
      critical: number
      danger: number
    }
  }
  ui: {
    defaultView: 'grid' | 'list'
    itemsPerPage: number
    responsiveDefaultView: 'grid' | 'list'
    responsiveItemsPerPage: number
  }
  screenshots: {
    format: 'png' | 'jpg'
    quality: number
  }
  docker: {
    containerName: string
  }
  transforms: {
    [key: string]: {
      enabled: boolean
      [key: string]: any
    }
  }
}

export default function SettingsPage() {
  const { t } = useTranslation()
  const { confirm, ConfirmDialog } = useConfirm()
  const { reload: reloadTests } = useTests()
  const [settings, setSettings] = useState<Settings | null>(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [message, setMessage] = useState<{ type: 'success' | 'error', text: string } | null>(null)

  // Charger les settings au montage
  useEffect(() => {
    loadSettings()
  }, [])

  const loadSettings = async () => {
    try {
      const response = await fetch('/api/settings')
      if (!response.ok) throw new Error('Failed to load settings')
      const data = await response.json()
      setSettings(data)
    } catch (error) {
      console.error('Error loading settings:', error)
      setMessage({ type: 'error', text: t('settings.messages.error_load') })
    } finally {
      setLoading(false)
    }
  }

  const saveSettings = async () => {
    if (!settings) return

    setSaving(true)
    setMessage(null)

    try {
      const response = await fetch('/api/settings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(settings)
      })

      if (!response.ok) throw new Error('Failed to save settings')

      setMessage({ type: 'success', text: t('settings.messages.saved') })
      setTimeout(() => setMessage(null), 3000)
    } catch (error) {
      console.error('Error saving settings:', error)
      setMessage({ type: 'error', text: t('settings.messages.error_save') })
    } finally {
      setSaving(false)
    }
  }

  const resetSettings = async () => {
    const confirmed = await confirm({
      title: t('settings.buttons.reset'),
      description: t('settings.messages.reset_confirm'),
      confirmText: t('settings.buttons.reset'),
      cancelText: t('common.close'),
      variant: 'destructive'
    })

    if (!confirmed) return

    setSaving(true)
    setMessage(null)

    try {
      const response = await fetch('/api/settings/reset', { method: 'POST' })
      if (!response.ok) throw new Error('Failed to reset settings')

      const data = await response.json()
      setSettings(data.settings)
      setMessage({ type: 'success', text: t('settings.messages.reset_success') })
      setTimeout(() => setMessage(null), 3000)
    } catch (error) {
      console.error('Error resetting settings:', error)
      setMessage({ type: 'error', text: t('settings.messages.error_save') })
    } finally {
      setSaving(false)
    }
  }

  const updateSetting = (path: string[], value: any) => {
    if (!settings) return

    const newSettings = { ...settings }
    let current: any = newSettings

    for (let i = 0; i < path.length - 1; i++) {
      current = current[path[i]]
    }

    current[path[path.length - 1]] = value
    setSettings(newSettings)
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="text-muted-foreground">{t('settings.loading')}</div>
      </div>
    )
  }

  if (!settings) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="text-destructive">{t('settings.error_loading')}</div>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <ConfirmDialog />

      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight flex items-center gap-2">
            <Settings className="h-8 w-8" />
            {t('settings.title')}
          </h1>
          <p className="text-muted-foreground mt-1">
            {t('settings.subtitle')}
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={resetSettings} disabled={saving}>
            <RotateCcw className="h-4 w-4 mr-2" />
            {t('settings.buttons.reset')}
          </Button>
          <Button onClick={saveSettings} disabled={saving}>
            <Save className="h-4 w-4 mr-2" />
            {saving ? t('settings.buttons.saving') : t('settings.buttons.save')}
          </Button>
        </div>
      </div>

      {/* Message de feedback */}
      {message && (
        <Alert variant={message.type === 'error' ? 'destructive' : 'default'}>
          {message.type === 'success' ? (
            <CheckCircle2 className="h-4 w-4" />
          ) : (
            <AlertCircle className="h-4 w-4" />
          )}
          <AlertDescription>{message.text}</AlertDescription>
        </Alert>
      )}

      {/* Tabs */}
      <Tabs defaultValue="interface" className="space-y-4">
        <TabsList className="grid w-full grid-cols-3">
          <TabsTrigger value="interface">
            <Palette className="h-4 w-4 mr-2" />
            {t('settings.tabs.ui')}
          </TabsTrigger>
          <TabsTrigger value="analysis">
            <Sparkles className="h-4 w-4 mr-2" />
            Analyse Figma
          </TabsTrigger>
          <TabsTrigger value="advanced">
            <Settings className="h-4 w-4 mr-2" />
            {t('settings.tabs.advanced')}
          </TabsTrigger>
        </TabsList>

        {/* Analysis Tab */}
        <TabsContent value="analysis" className="space-y-4">
          <AnalysisForm onAnalysisComplete={reloadTests} />
        </TabsContent>

        {/* Interface Tab */}
        <TabsContent value="interface" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>{t('settings.ui.title')}</CardTitle>
              <CardDescription>
                {t('settings.ui.description')}
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              {/* Tests Page Settings */}
              <div className="space-y-4">
                <div className="flex items-center gap-2">
                  <Sparkles className="h-4 w-4 text-primary" />
                  <h3 className="font-semibold">Page des Tests Figma</h3>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="defaultView">{t('settings.ui.default_view')}</Label>
                  <Select
                    value={settings.ui.defaultView}
                    onValueChange={(value) => updateSetting(['ui', 'defaultView'], value)}
                  >
                    <SelectTrigger id="defaultView">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="grid">{t('settings.ui.view_grid')}</SelectItem>
                      <SelectItem value="list">{t('settings.ui.view_list')}</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="itemsPerPage">{t('settings.ui.items_per_page')}</Label>
                  <Select
                    value={settings.ui.itemsPerPage.toString()}
                    onValueChange={(value) => updateSetting(['ui', 'itemsPerPage'], parseInt(value))}
                  >
                    <SelectTrigger id="itemsPerPage">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="6">6</SelectItem>
                      <SelectItem value="12">12</SelectItem>
                      <SelectItem value="24">24</SelectItem>
                      <SelectItem value="48">48</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <Separator />

              {/* Responsive Tests Page Settings */}
              <div className="space-y-4">
                <div className="flex items-center gap-2">
                  <Settings className="h-4 w-4 text-primary" />
                  <h3 className="font-semibold">Page des Tests Responsive</h3>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="responsiveDefaultView">Vue par défaut (Responsive)</Label>
                  <Select
                    value={settings.ui.responsiveDefaultView}
                    onValueChange={(value) => updateSetting(['ui', 'responsiveDefaultView'], value)}
                  >
                    <SelectTrigger id="responsiveDefaultView">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="grid">Grille</SelectItem>
                      <SelectItem value="list">Liste</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="responsiveItemsPerPage">Éléments par page (Responsive)</Label>
                  <Select
                    value={settings.ui.responsiveItemsPerPage.toString()}
                    onValueChange={(value) => updateSetting(['ui', 'responsiveItemsPerPage'], parseInt(value))}
                  >
                    <SelectTrigger id="responsiveItemsPerPage">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="4">4</SelectItem>
                      <SelectItem value="8">8</SelectItem>
                      <SelectItem value="12">12</SelectItem>
                      <SelectItem value="16">16</SelectItem>
                      <SelectItem value="20">20</SelectItem>
                      <SelectItem value="24">24</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Advanced Settings Tab */}
        <TabsContent value="advanced" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>{t('settings.advanced.title')}</CardTitle>
              <CardDescription>
                {t('settings.advanced.description')}
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {/* Warning Alert */}
              <Alert variant="destructive">
                <AlertCircle className="h-4 w-4" />
                <AlertDescription>
                  {t('settings.advanced.warning')}
                </AlertDescription>
              </Alert>

              <Accordion type="single" collapsible className="w-full">
                {/* MCP Section */}
                <AccordionItem value="mcp">
                  <AccordionTrigger className="text-base font-semibold">
                    {t('settings.mcp.title')}
                  </AccordionTrigger>
                  <AccordionContent className="space-y-4 pt-4">
                    <div className="space-y-2">
                      <Label htmlFor="serverUrl">{t('settings.mcp.server_url')}</Label>
                      <Input
                        id="serverUrl"
                        value={settings.mcp.serverUrl}
                        onChange={(e) => updateSetting(['mcp', 'serverUrl'], e.target.value)}
                        placeholder="http://127.0.0.1:3845/mcp"
                      />
                      <p className="text-sm text-muted-foreground">
                        {t('settings.mcp.server_url_help')}
                      </p>
                    </div>

                    <Separator />

                    <div className="space-y-2">
                      <Label htmlFor="callDelay">{t('settings.mcp.call_delay', { delay: settings.mcp.callDelay })}</Label>
                      <div className="flex gap-2">
                        <Input
                          id="callDelay"
                          type="number"
                          value={settings.mcp.callDelay}
                          onChange={(e) => {
                            const value = parseInt(e.target.value)
                            if (value >= settings.mcp.minDelay && value <= settings.mcp.maxDelay) {
                              updateSetting(['mcp', 'callDelay'], value)
                            }
                          }}
                          min={settings.mcp.minDelay}
                          max={settings.mcp.maxDelay}
                          step={100}
                          className="w-32"
                        />
                        <span className="text-sm text-muted-foreground flex items-center">ms</span>
                      </div>
                      <p className="text-sm text-muted-foreground">
                        {t('settings.mcp.delay_help', { min: settings.mcp.minDelay, max: settings.mcp.maxDelay })}
                      </p>
                    </div>
                  </AccordionContent>
                </AccordionItem>

                {/* Generation Section */}
                <AccordionItem value="generation">
                  <AccordionTrigger className="text-base font-semibold">
                    {t('settings.generation.title')}
                  </AccordionTrigger>
                  <AccordionContent className="space-y-4 pt-4">
                    <div className="space-y-2">
                      <Label htmlFor="defaultMode">{t('settings.generation.default_mode')}</Label>
                      <Select
                        value={settings.generation.defaultMode}
                        onValueChange={(value) => updateSetting(['generation', 'defaultMode'], value)}
                      >
                        <SelectTrigger id="defaultMode">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="fixed">{t('settings.generation.mode_fixed')}</SelectItem>
                          <SelectItem value="clean">{t('settings.generation.mode_clean')}</SelectItem>
                          <SelectItem value="both">{t('settings.generation.mode_both')}</SelectItem>
                        </SelectContent>
                      </Select>
                      <p className="text-sm text-muted-foreground">
                        {t('settings.generation.mode_help')}
                      </p>
                    </div>

                    <Separator />

                    <div className="flex items-center justify-between">
                      <div className="space-y-0.5">
                        <Label htmlFor="chunking">{t('settings.generation.chunking')}</Label>
                        <p className="text-sm text-muted-foreground">
                          {t('settings.generation.chunking_help')}
                        </p>
                      </div>
                      <Switch
                        id="chunking"
                        checked={settings.generation.chunking.enabled}
                        onCheckedChange={(checked: boolean) => updateSetting(['generation', 'chunking', 'enabled'], checked)}
                      />
                    </div>

                    <Separator />

                    <div className="space-y-2">
                      <Label htmlFor="screenshotFormat">{t('settings.ui.screenshot_format')}</Label>
                      <Select
                        value={settings.screenshots.format}
                        onValueChange={(value) => updateSetting(['screenshots', 'format'], value)}
                      >
                        <SelectTrigger id="screenshotFormat">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="png">{t('settings.ui.format_png')}</SelectItem>
                          <SelectItem value="jpg">{t('settings.ui.format_jpg')}</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>

                    <div className="space-y-2">
                      <Label>{t('settings.ui.quality', { quality: settings.screenshots.quality })}</Label>
                      <Slider
                        value={[settings.screenshots.quality]}
                        onValueChange={(value) => updateSetting(['screenshots', 'quality'], value[0])}
                        min={50}
                        max={100}
                        step={10}
                      />
                    </div>
                  </AccordionContent>
                </AccordionItem>

                {/* Directories Section */}
                <AccordionItem value="directories">
                  <AccordionTrigger className="text-base font-semibold">
                    {t('settings.directories.title')}
                  </AccordionTrigger>
                  <AccordionContent className="space-y-4 pt-4">
                    <div className="space-y-2">
                      <Label htmlFor="testsOutput">{t('settings.directories.tests_output')}</Label>
                      <Input
                        id="testsOutput"
                        value={settings.directories.testsOutput}
                        onChange={(e) => updateSetting(['directories', 'testsOutput'], e.target.value)}
                      />
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="tmpAssets">{t('settings.directories.tmp_assets')}</Label>
                      <Input
                        id="tmpAssets"
                        value={settings.directories.tmpAssets}
                        onChange={(e) => updateSetting(['directories', 'tmpAssets'], e.target.value)}
                      />
                    </div>
                  </AccordionContent>
                </AccordionItem>

                {/* API Limits Section */}
                <AccordionItem value="api">
                  <AccordionTrigger className="text-base font-semibold">
                    {t('settings.api.title')}
                  </AccordionTrigger>
                  <AccordionContent className="space-y-4 pt-4">
                    <div className="space-y-2">
                      <Label htmlFor="dailyLimit">{t('settings.api.daily_limit')}</Label>
                      <Input
                        id="dailyLimit"
                        type="number"
                        value={settings.apiLimits.dailyTokenLimit}
                        onChange={(e) => updateSetting(['apiLimits', 'dailyTokenLimit'], parseInt(e.target.value))}
                      />
                      <p className="text-sm text-muted-foreground">
                        {t('settings.api.daily_limit_help')}
                      </p>
                    </div>

                    <Separator />

                    <div className="space-y-4">
                      <Label>{t('settings.api.thresholds')}</Label>

                      <div className="space-y-2">
                        <div className="flex justify-between text-sm">
                          <span>{t('settings.api.threshold_warning')}</span>
                          <span className="text-yellow-600">{settings.apiLimits.thresholds.warning}%</span>
                        </div>
                        <Slider
                          value={[settings.apiLimits.thresholds.warning]}
                          onValueChange={(value) => updateSetting(['apiLimits', 'thresholds', 'warning'], value[0])}
                          min={0}
                          max={100}
                          step={5}
                        />
                      </div>

                      <div className="space-y-2">
                        <div className="flex justify-between text-sm">
                          <span>{t('settings.api.threshold_critical')}</span>
                          <span className="text-orange-600">{settings.apiLimits.thresholds.critical}%</span>
                        </div>
                        <Slider
                          value={[settings.apiLimits.thresholds.critical]}
                          onValueChange={(value) => updateSetting(['apiLimits', 'thresholds', 'critical'], value[0])}
                          min={0}
                          max={100}
                          step={5}
                        />
                      </div>

                      <div className="space-y-2">
                        <div className="flex justify-between text-sm">
                          <span>{t('settings.api.threshold_danger')}</span>
                          <span className="text-red-600">{settings.apiLimits.thresholds.danger}%</span>
                        </div>
                        <Slider
                          value={[settings.apiLimits.thresholds.danger]}
                          onValueChange={(value) => updateSetting(['apiLimits', 'thresholds', 'danger'], value[0])}
                          min={0}
                          max={100}
                          step={5}
                        />
                      </div>
                    </div>
                  </AccordionContent>
                </AccordionItem>

                {/* Docker Section */}
                <AccordionItem value="docker">
                  <AccordionTrigger className="text-base font-semibold">
                    {t('settings.docker.title')}
                  </AccordionTrigger>
                  <AccordionContent className="space-y-4 pt-4">
                    <div className="space-y-2">
                      <Label htmlFor="containerName">{t('settings.docker.container_name')}</Label>
                      <Input
                        id="containerName"
                        value={settings.docker.containerName}
                        onChange={(e) => updateSetting(['docker', 'containerName'], e.target.value)}
                      />
                    </div>
                  </AccordionContent>
                </AccordionItem>

                {/* Transforms Section */}
                <AccordionItem value="transforms">
                  <AccordionTrigger className="text-base font-semibold">
                    {t('settings.transforms.title')}
                  </AccordionTrigger>
                  <AccordionContent className="space-y-4 pt-4">
                    {Object.entries(settings.transforms).map(([key, value]) => {
                      if (key === 'continueOnError') {
                        return (
                          <div key={key}>
                            <Separator className="my-4" />
                            <div className="flex items-center justify-between">
                              <div className="space-y-0.5">
                                <Label htmlFor="continueOnError">{t('settings.transforms.continue_on_error')}</Label>
                                <p className="text-sm text-muted-foreground">
                                  {t('settings.transforms.continue_help')}
                                </p>
                              </div>
                              <Switch
                                id="continueOnError"
                                checked={value as boolean}
                                onCheckedChange={(checked: boolean) => updateSetting(['transforms', key], checked)}
                              />
                            </div>
                          </div>
                        )
                      }

                      return (
                        <div key={key} className="flex items-center justify-between">
                          <div className="space-y-0.5">
                            <Label htmlFor={key}>{key}</Label>
                            {value.enabled !== undefined && (
                              <p className="text-sm text-muted-foreground">
                                {Object.keys(value).filter(k => k !== 'enabled').length} {t('settings.transforms.options')}
                              </p>
                            )}
                          </div>
                          <Switch
                            id={key}
                            checked={value.enabled}
                            onCheckedChange={(checked: boolean) => updateSetting(['transforms', key, 'enabled'], checked)}
                          />
                        </div>
                      )
                    })}
                  </AccordionContent>
                </AccordionItem>
              </Accordion>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  )
}
