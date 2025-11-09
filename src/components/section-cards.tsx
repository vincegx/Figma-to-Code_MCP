import { Card, CardContent } from "@/components/ui/card"
import { Package, Image, Zap } from "lucide-react"
import { useTranslation } from '../i18n/I18nContext'

interface Test {
  stats?: {
    totalNodes?: number
    imagesOrganized?: number
    totalFixes?: number
    classesOptimized?: number
  }
}

interface SectionCardsProps {
  tests: Test[]
}

export function SectionCards({ tests }: SectionCardsProps) {
  const { t } = useTranslation()

  // Calculate totals from all tests
  const totalNodes = tests.reduce((acc, test) => acc + (test.stats?.totalNodes || 0), 0)
  const totalImages = tests.reduce((acc, test) => acc + (test.stats?.imagesOrganized || 0), 0)
  const totalFixes = tests.reduce((acc, test) => acc + (test.stats?.totalFixes || test.stats?.classesOptimized || 0), 0)

  const stats = [
    {
      title: t('header.stats.total_nodes'),
      value: totalNodes.toLocaleString(),
      icon: Package,
      description: t('common.nodes')
    },
    {
      title: t('header.stats.images'),
      value: totalImages.toLocaleString(),
      icon: Image,
      description: t('common.images')
    },
    {
      title: t('header.stats.total_fixes'),
      value: totalFixes.toLocaleString(),
      icon: Zap,
      description: t('common.fixes')
    }
  ]

  return (
    <div className="grid gap-4 md:grid-cols-3">
      {stats.map((stat, index) => {
        const Icon = stat.icon
        return (
          <Card key={index}>
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div className="space-y-1">
                  <p className="text-sm font-medium text-muted-foreground">{stat.title}</p>
                  <p className="text-3xl font-bold tracking-tight">{stat.value}</p>
                  <p className="text-xs text-muted-foreground">{stat.description}</p>
                </div>
                <div className="rounded-lg bg-primary/10 p-3">
                  <Icon className="h-6 w-6 text-primary" />
                </div>
              </div>
            </CardContent>
          </Card>
        )
      })}
    </div>
  )
}
