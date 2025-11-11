import { memo } from 'react'
import { SidebarTrigger } from "@/components/ui/sidebar"
import { Badge } from "@/components/ui/badge"
import { Separator } from "@/components/ui/separator"
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from "@/components/ui/breadcrumb"
import { useLocation, Link } from 'react-router-dom'
import { useTranslation } from '../../i18n/I18nContext'
import { UsageBar } from '../features/stats/UsageBar'

interface SiteHeaderProps {
  mcpConnected: boolean
  mcpChecking: boolean
}

export const SiteHeader = memo(function SiteHeader({ mcpConnected, mcpChecking }: SiteHeaderProps) {
  const { t } = useTranslation()
  const location = useLocation()

  // Generate breadcrumbs based on current path
  const getBreadcrumbs = () => {
    const path = location.pathname

    // Dashboard
    if (path === '/') {
      return [{ label: 'Dashboard', href: '/', isLast: true }]
    }


    // Tests list
    if (path === '/tests') {
      return [
        { label: 'Dashboard', href: '/', isLast: false },
        { label: 'Tests', href: '/tests', isLast: true }
      ]
    }

    // Test detail
    if (path.startsWith('/tests/')) {
      const testId = path.split('/')[2]
      return [
        { label: 'Dashboard', href: '/', isLast: false },
        { label: 'Tests', href: '/tests', isLast: false },
        { label: testId.substring(0, 20) + '...', href: path, isLast: true }
      ]
    }

    return [{ label: 'Dashboard', href: '/', isLast: true }]
  }

  const breadcrumbs = getBreadcrumbs()

  return (
    <header className="sticky top-0 z-10 flex h-16 min-h-16 items-center gap-2 md:gap-4 border-b bg-background px-4 md:px-6 py-3">
      {/* Hamburger menu */}
      <SidebarTrigger className="shrink-0" />

      <Separator orientation="vertical" className="h-4 md:h-6 shrink-0" />

      {/* Breadcrumb - hide on mobile, show on larger screens */}
      <Breadcrumb className="hidden sm:block flex-1 min-w-0">
        <BreadcrumbList className="flex-nowrap">
          {breadcrumbs.map((crumb, index) => (
            <div key={crumb.href} className="flex items-center">
              {index > 0 && <BreadcrumbSeparator />}
              <BreadcrumbItem className="max-w-[120px] md:max-w-none">
                {crumb.isLast ? (
                  <BreadcrumbPage className="truncate">{crumb.label}</BreadcrumbPage>
                ) : (
                  <BreadcrumbLink asChild>
                    <Link to={crumb.href} className="truncate block">{crumb.label}</Link>
                  </BreadcrumbLink>
                )}
              </BreadcrumbItem>
            </div>
          ))}
        </BreadcrumbList>
      </Breadcrumb>

      {/* Spacer - grows to push right-side items */}
      <div className="flex-1 sm:flex-initial sm:ml-auto" />

      {/* Usage Bar - always visible but adapts internally */}
      <UsageBar />

      {/* MCP Status Badge - compact on mobile */}
      {mcpChecking ? (
        <Badge variant="outline" className="gap-1 md:gap-1.5 text-xs shrink-0">
          <div className="h-2 w-2 rounded-full bg-muted animate-pulse" />
          <span className="hidden md:inline">{t('header.mcp_checking')}</span>
        </Badge>
      ) : mcpConnected ? (
        <Badge variant="outline" className="gap-1 md:gap-1.5 text-xs border-green-500/20 bg-green-500/10 text-green-600 shrink-0">
          <div className="h-2 w-2 rounded-full bg-green-500 animate-pulse" />
          <span className="hidden md:inline">{t('header.mcp_connected')}</span>
        </Badge>
      ) : (
        <Badge variant="destructive" className="gap-1 md:gap-1.5 text-xs shrink-0">
          <div className="h-2 w-2 rounded-full bg-white" />
          <span className="hidden md:inline">{t('header.mcp_disconnected')}</span>
        </Badge>
      )}
    </header>
  )
})
