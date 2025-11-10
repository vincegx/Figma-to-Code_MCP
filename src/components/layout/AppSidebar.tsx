import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuItem,
  SidebarMenuButton,
} from "@/components/ui/sidebar"
import { NavLink } from "react-router-dom"
import { LayoutDashboard, Sparkles, FileText, MonitorSmartphone, Settings } from "lucide-react"
import ThemeToggle from '../common/ThemeToggle'
import LanguageSwitcher from '../common/LanguageSwitcher'
import { useTranslation } from '../../i18n/I18nContext'

export function AppSidebar() {
  const { t } = useTranslation()

  const menuItems = [
    { to: '/', icon: LayoutDashboard, label: 'Dashboard' },
    { to: '/analyze', icon: Sparkles, label: t('analysis.title') },
    { to: '/tests', icon: FileText, label: 'Tests' },
    { to: '/responsive-tests', icon: MonitorSmartphone, label: 'Tests Responsive' },
  ]

  return (
    <Sidebar variant="inset">
      {/* Header */}
      <SidebarHeader className="flex h-16 min-h-16 max-h-16 shrink-0 flex-row items-center gap-3 border-b px-6 py-3">
        <svg className="h-8 w-8 text-primary" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
          <g fill="currentColor">
            <path d="M19.15 13.92c-.59 5.68-1.31 6.32-7.18 6.32 -6.01 0-6.8-.78-7.17-6.31 -.27-3.9.15-4.2 7.16-4.2 6.89 0 7.54.5 7.17 4.17Zm1.49.15c.48-4.7-.99-5.83-8.67-5.83 -7.79 0-9 .89-8.67 5.8 .42 6.29 1.85 7.69 8.66 7.69 6.63 0 7.99-1.23 8.66-7.68Z"/>
            <path d="M7 6.75h9.99c.41 0 .75-.34.75-.75 0-.42-.34-.75-.75-.75h-10c-.42 0-.75.33-.75.75 0 .41.33.75.75.75Z"/>
            <path d="M10 3.75h4c.41 0 .75-.34.75-.75 0-.42-.34-.75-.75-.75h-4c-.42 0-.75.33-.75.75 0 .41.33.75.75.75Z"/>
          </g>
        </svg>
        <div className="flex flex-col">
          <h2 className="text-base font-bold leading-none">{t('header.title')}</h2>
          <p className="text-xs text-muted-foreground mt-1">MCP Exporter</p>
        </div>
      </SidebarHeader>

      {/* Navigation */}
      <SidebarContent className="px-2 py-4">
        <SidebarMenu>
          {menuItems.map((item) => (
            <SidebarMenuItem key={item.to}>
              <SidebarMenuButton asChild>
                <NavLink
                  to={item.to}
                  end={item.to === '/'}
                  className={({ isActive }) =>
                    isActive ? 'bg-sidebar-accent text-sidebar-accent-foreground' : ''
                  }
                >
                  <item.icon className="h-4 w-4" />
                  <span>{item.label}</span>
                </NavLink>
              </SidebarMenuButton>
            </SidebarMenuItem>
          ))}
        </SidebarMenu>
      </SidebarContent>

      {/* Footer */}
      <SidebarFooter className="border-t p-4 space-y-2">
        {/* Settings Link */}
        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarMenuButton asChild>
              <NavLink
                to="/settings"
                className={({ isActive }) =>
                  isActive ? 'bg-sidebar-accent text-sidebar-accent-foreground' : ''
                }
              >
                <Settings className="h-4 w-4" />
                <span>{t('settings.title')}</span>
              </NavLink>
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>

        {/* Theme & Language controls */}
        <div className="flex items-center justify-between gap-2">
          <ThemeToggle />
          <LanguageSwitcher />
        </div>
      </SidebarFooter>
    </Sidebar>
  )
}
