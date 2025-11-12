/**
 * DashboardPage - Overview with KPIs and charts
 * Shows stats, timeline, and recent tests
 */

import { useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import { useExports } from '../../hooks/useExports'
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { ChartContainer, ChartTooltip, ChartTooltipContent, ChartLegend, ChartLegendContent } from "@/components/ui/chart"
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, LineChart, Line, AreaChart, Area, PieChart, Pie, Cell } from "recharts"
import { Package, Image, Zap, Clock, BarChart3, TrendingUp, Activity, PieChart as PieChartIcon } from "lucide-react"
import { useTranslation } from '../../i18n/I18nContext'

export default function DashboardPage() {
  const { t } = useTranslation()
  const navigate = useNavigate()
  const { exports, loading } = useExports()

  // KPIs calculation
  const kpis = useMemo(() => {
    const totalNodes = exports.reduce((acc, test) => acc + (test.stats?.totalNodes || 0), 0)
    const totalImages = exports.reduce((acc, test) => acc + (test.stats?.imagesOrganized || 0), 0)
    const totalFixes = exports.reduce((acc, test) => acc + (test.stats?.totalFixes || test.stats?.classesOptimized || 0), 0)
    const totalExecutionTime = exports.reduce((acc, test) => acc + (test.stats?.executionTime || 0), 0)

    return {
      totalTests: exports.length,
      totalNodes,
      totalImages,
      totalFixes,
      avgExecutionTime: exports.length > 0 ? Math.round(totalExecutionTime / exports.length) : 0
    }
  }, [exports])

  // Timeline data: tests per day
  const timelineData = useMemo(() => {
    const grouped = exports.reduce((acc, test) => {
      const date = new Date(typeof test.timestamp === 'number' && test.timestamp < 10000000000
        ? test.timestamp * 1000
        : test.timestamp)
      const dateKey = date.toISOString().split('T')[0]
      acc[dateKey] = (acc[dateKey] || 0) + 1
      return acc
    }, {} as Record<string, number>)

    return Object.entries(grouped)
      .map(([date, count]) => ({ date, count }))
      .sort((a, b) => a.date.localeCompare(b.date))
      .slice(-14) // Last 14 days
  }, [exports])

  // Top 10 tests by nodes
  const topTestsByNodes = useMemo(() => {
    return [...exports]
      .sort((a, b) => (b.stats?.totalNodes || 0) - (a.stats?.totalNodes || 0))
      .slice(0, 10)
      .map(test => ({
        name: (test.layerName || test.fileName || t('dashboard.untitled')).substring(0, 20),
        nodes: test.stats?.totalNodes || 0,
        testId: test.testId
      }))
  }, [exports, t])

  // Transformation Activity Over Time (Stacked Area Chart)
  const transformationActivityData = useMemo(() => {
    const grouped = exports.reduce((acc, test) => {
      const date = new Date(typeof test.timestamp === 'number' && test.timestamp < 10000000000
        ? test.timestamp * 1000
        : test.timestamp)
      const dateKey = date.toISOString().split('T')[0]

      if (!acc[dateKey]) {
        acc[dateKey] = {
          date: dateKey,
          fonts: 0,
          classes: 0,
          variables: 0,
          assets: 0,
          cleanup: 0
        }
      }

      // Aggregate transformations by category
      acc[dateKey].fonts += (test.stats?.fontsConverted || 0) + (test.stats?.fontClassesGenerated || 0)
      acc[dateKey].classes += (test.stats?.classesFixed || 0) + (test.stats?.classesOptimized || 0) + (test.stats?.customClassesGenerated || 0)
      acc[dateKey].variables += test.stats?.varsConverted || 0
      acc[dateKey].assets += test.stats?.imagesOrganized || 0
      acc[dateKey].cleanup += (test.stats?.dataAttrsRemoved || 0) + (test.stats?.arbitraryClassesConverted || 0)

      return acc
    }, {} as Record<string, any>)

    return Object.values(grouped)
      .sort((a: any, b: any) => a.date.localeCompare(b.date))
      .slice(-14) // Last 14 days
  }, [exports])

  // Transformation Breakdown (Donut Chart)
  const transformationBreakdownData = useMemo(() => {
    const totals = exports.reduce((acc, test) => {
      acc.fonts += (test.stats?.fontsConverted || 0) + (test.stats?.fontClassesGenerated || 0)
      acc.classes += (test.stats?.classesFixed || 0) + (test.stats?.classesOptimized || 0) + (test.stats?.customClassesGenerated || 0)
      acc.variables += test.stats?.varsConverted || 0
      acc.assets += test.stats?.imagesOrganized || 0
      acc.cleanup += (test.stats?.dataAttrsRemoved || 0) + (test.stats?.arbitraryClassesConverted || 0)
      return acc
    }, { fonts: 0, classes: 0, variables: 0, assets: 0, cleanup: 0 })

    return [
      { name: t('dashboard.chart_labels.fonts'), value: totals.fonts, fill: 'hsl(var(--chart-1))' },
      { name: t('dashboard.chart_labels.classes'), value: totals.classes, fill: 'hsl(var(--chart-2))' },
      { name: t('dashboard.chart_labels.variables'), value: totals.variables, fill: 'hsl(var(--chart-3))' },
      { name: t('dashboard.chart_labels.assets'), value: totals.assets, fill: 'hsl(var(--chart-4))' },
      { name: t('dashboard.chart_labels.cleanup'), value: totals.cleanup, fill: 'hsl(var(--chart-5))' }
    ].filter(item => item.value > 0) // Only show non-zero categories
  }, [exports, t])

  // Recent tests
  const recentTests = useMemo(() => {
    return [...exports]
      .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime())
      .slice(0, 5)
  }, [exports])

  if (loading) {
    return (
      <div className="flex min-h-[400px] items-center justify-center">
        <div className="text-center">
          <div className="mx-auto mb-4 h-12 w-12 animate-spin rounded-full border-b-2 border-primary"></div>
          <p className="text-muted-foreground">{t('home.loading_tests')}</p>
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* KPI Cards */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-5">
        <Card>
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div className="space-y-1">
                <p className="text-sm font-medium text-muted-foreground">{t('dashboard.kpi.total_tests')}</p>
                <p className="text-3xl font-bold tracking-tight">{kpis.totalTests}</p>
              </div>
              <div className="rounded-lg bg-primary/10 p-3">
                <BarChart3 className="h-6 w-6 text-primary" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div className="space-y-1">
                <p className="text-sm font-medium text-muted-foreground">{t('header.stats.total_nodes')}</p>
                <p className="text-3xl font-bold tracking-tight">{kpis.totalNodes.toLocaleString()}</p>
              </div>
              <div className="rounded-lg bg-primary/10 p-3">
                <Package className="h-6 w-6 text-primary" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div className="space-y-1">
                <p className="text-sm font-medium text-muted-foreground">{t('header.stats.images')}</p>
                <p className="text-3xl font-bold tracking-tight">{kpis.totalImages.toLocaleString()}</p>
              </div>
              <div className="rounded-lg bg-primary/10 p-3">
                <Image className="h-6 w-6 text-primary" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div className="space-y-1">
                <p className="text-sm font-medium text-muted-foreground">{t('header.stats.total_fixes')}</p>
                <p className="text-3xl font-bold tracking-tight">{kpis.totalFixes.toLocaleString()}</p>
              </div>
              <div className="rounded-lg bg-primary/10 p-3">
                <Zap className="h-6 w-6 text-primary" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div className="space-y-1">
                <p className="text-sm font-medium text-muted-foreground">{t('dashboard.kpi.avg_time')}</p>
                <p className="text-3xl font-bold tracking-tight">{kpis.avgExecutionTime}s</p>
              </div>
              <div className="rounded-lg bg-primary/10 p-3">
                <Clock className="h-6 w-6 text-primary" />
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Transformation Activity Chart - Full Width (EN HAUT) */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Activity className="h-5 w-5" />
            <p className="text-lg font-medium">{t('dashboard.charts.transformation_activity')}</p>
          </CardTitle>
        </CardHeader>
        <CardContent>
          {transformationActivityData.length > 0 ? (
            <ChartContainer config={{
              fonts: { label: t('dashboard.chart_labels.fonts'), color: "hsl(var(--chart-1))" },
              classes: { label: t('dashboard.chart_labels.classes'), color: "hsl(var(--chart-2))" },
              variables: { label: t('dashboard.chart_labels.variables'), color: "hsl(var(--chart-3))" },
              assets: { label: t('dashboard.chart_labels.assets'), color: "hsl(var(--chart-4))" },
              cleanup: { label: t('dashboard.chart_labels.cleanup'), color: "hsl(var(--chart-5))" }
            }} className="h-[300px] w-full">
              <AreaChart data={transformationActivityData} width={undefined} height={undefined}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis
                  dataKey="date"
                  tickFormatter={(value) => new Date(value).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                />
                <YAxis />
                <ChartTooltip content={<ChartTooltipContent />} />
                <ChartLegend content={<ChartLegendContent />} />
                <Area type="monotone" dataKey="fonts" stackId="1" stroke="hsl(var(--chart-1))" fill="hsl(var(--chart-1))" fillOpacity={0.6} />
                <Area type="monotone" dataKey="classes" stackId="1" stroke="hsl(var(--chart-2))" fill="hsl(var(--chart-2))" fillOpacity={0.6} />
                <Area type="monotone" dataKey="variables" stackId="1" stroke="hsl(var(--chart-3))" fill="hsl(var(--chart-3))" fillOpacity={0.6} />
                <Area type="monotone" dataKey="assets" stackId="1" stroke="hsl(var(--chart-4))" fill="hsl(var(--chart-4))" fillOpacity={0.6} />
                <Area type="monotone" dataKey="cleanup" stackId="1" stroke="hsl(var(--chart-5))" fill="hsl(var(--chart-5))" fillOpacity={0.6} />
              </AreaChart>
            </ChartContainer>
          ) : (
            <div className="flex h-[300px] items-center justify-center text-muted-foreground">
              {t('dashboard.empty_states.no_data')}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Second Row - 3 Charts Aligned: Timeline + Top 10 + Breakdown */}
      <div className="grid gap-6 grid-cols-1 md:grid-cols-2 lg:grid-cols-3">
        {/* Tests Timeline */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <TrendingUp className="h-5 w-5" />
              <p className="text-lg font-medium">{t('dashboard.charts.tests_timeline')}</p>
            </CardTitle>
          </CardHeader>
          <CardContent>
            {timelineData.length > 0 ? (
              <ChartContainer config={{
                count: { label: "Tests", color: "hsl(var(--primary))" }
              }} className="h-[300px] w-full">
                <LineChart data={timelineData} width={undefined} height={undefined} margin={{ top: 5, right: 10, left: -10, bottom: 5 }}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis
                    dataKey="date"
                    tickFormatter={(value) => new Date(value).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                    tick={{ fontSize: 10 }}
                  />
                  <YAxis tick={{ fontSize: 10 }} />
                  <ChartTooltip content={<ChartTooltipContent />} />
                  <ChartLegend content={<ChartLegendContent />} />
                  <Line type="monotone" dataKey="count" stroke="hsl(var(--primary))" strokeWidth={2} />
                </LineChart>
              </ChartContainer>
            ) : (
              <div className="flex h-[300px] items-center justify-center text-muted-foreground">
                {t('dashboard.empty_states.no_data')}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Top Tests by Nodes */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <BarChart3 className="h-5 w-5" />
              <p className="text-lg font-medium">{t('dashboard.charts.top_tests')}</p>
            </CardTitle>
          </CardHeader>
          <CardContent>
            {topTestsByNodes.length > 0 ? (
              <ChartContainer config={{
                nodes: { label: "Nodes", color: "hsl(var(--chart-1))" }
              }} className="h-[300px] w-full">
                <BarChart data={topTestsByNodes} layout="vertical" width={undefined} height={undefined} margin={{ top: 5, right: 10, left: -15, bottom: 5 }}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis type="number" tick={{ fontSize: 10 }} />
                  <YAxis dataKey="name" type="category" width={80} tick={{ fontSize: 9 }} />
                  <ChartTooltip content={<ChartTooltipContent />} />
                  <ChartLegend content={<ChartLegendContent />} />
                  <Bar dataKey="nodes" fill="hsl(var(--chart-1))" radius={[0, 4, 4, 0]} />
                </BarChart>
              </ChartContainer>
            ) : (
              <div className="flex h-[300px] items-center justify-center text-muted-foreground">
                {t('dashboard.empty_states.no_data')}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Transformation Breakdown - Donut Chart */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <PieChartIcon className="h-5 w-5" />
              <p className="text-lg font-medium">{t('dashboard.charts.transformation_breakdown')}</p>
            </CardTitle>
          </CardHeader>
          <CardContent>
            {transformationBreakdownData.length > 0 ? (
              <ChartContainer config={{
                fonts: { label: t('dashboard.chart_labels.fonts'), color: "hsl(var(--chart-1))" },
                classes: { label: t('dashboard.chart_labels.classes'), color: "hsl(var(--chart-2))" },
                variables: { label: t('dashboard.chart_labels.variables'), color: "hsl(var(--chart-3))" },
                assets: { label: t('dashboard.chart_labels.assets'), color: "hsl(var(--chart-4))" },
                cleanup: { label: t('dashboard.chart_labels.cleanup'), color: "hsl(var(--chart-5))" }
              }} className="h-[300px] w-full">
                <PieChart width={undefined} height={undefined}>
                  <ChartTooltip content={<ChartTooltipContent />} />
                  <ChartLegend content={<ChartLegendContent />} />
                  <Pie
                    data={transformationBreakdownData}
                    cx="50%"
                    cy="50%"
                    innerRadius={50}
                    outerRadius={80}
                    paddingAngle={2}
                    dataKey="value"
                    nameKey="name"
                    label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}
                    labelLine={{ stroke: 'hsl(var(--border))', strokeWidth: 1 }}
                  >
                    {transformationBreakdownData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={entry.fill} />
                    ))}
                  </Pie>
                </PieChart>
              </ChartContainer>
            ) : (
              <div className="flex h-[300px] items-center justify-center text-muted-foreground">
                {t('dashboard.empty_states.no_data')}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Recent Tests Table */}
      <Card>
        <CardHeader>
          <CardTitle>{t('dashboard.charts.recent_tests')}</CardTitle>
        </CardHeader>
        <CardContent>
          {recentTests.length > 0 ? (
            <div className="space-y-2">
              {recentTests.map((test) => (
                <div
                  key={test.testId}
                  className="flex items-center gap-4 rounded-lg border p-3 hover:bg-accent cursor-pointer transition-colors"
                  onClick={() => navigate(`/export_figma/${test.exportId}`)}
                >
                  {/* Thumbnail */}
                  <div className="relative flex-shrink-0 w-14 h-14 rounded-md overflow-hidden bg-muted border">
                    <img
                      src={`/src/generated/export_figma/${test.exportId}/img/figma-screenshot.png`}
                      alt={test.layerName || test.fileName || t('dashboard.untitled')}
                      className="w-full h-full object-cover"
                      onError={(e) => {
                        // Fallback to web-render.png if figma-screenshot.png fails
                        const img = e.target as HTMLImageElement
                        if (!img.src.includes('web-render.png')) {
                          img.src = `/src/generated/export_figma/${test.exportId}/img/web-render.png`
                        } else {
                          // If both fail, hide the image
                          img.style.display = 'none'
                        }
                      }}
                    />
                  </div>

                  {/* Test Info */}
                  <div className="flex-1 min-w-0">
                    <p className="font-medium truncate">{test.layerName || test.fileName || t('dashboard.untitled')}</p>
                    <p className="text-xs text-muted-foreground truncate">{test.testId}</p>
                  </div>

                  {/* Stats */}
                  <div className="flex items-center gap-4 text-sm text-muted-foreground flex-shrink-0">
                    <div className="flex items-center gap-1">
                      <Package className="h-4 w-4" />
                      {test.stats?.totalNodes || 0}
                    </div>
                    <div className="flex items-center gap-1">
                      <Image className="h-4 w-4" />
                      {test.stats?.imagesOrganized || 0}
                    </div>
                    <div className="flex items-center gap-1">
                      <Zap className="h-4 w-4" />
                      {test.stats?.totalFixes || test.stats?.classesOptimized || 0}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="py-12 text-center text-muted-foreground">
              {t('dashboard.empty_states.no_exports')}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
