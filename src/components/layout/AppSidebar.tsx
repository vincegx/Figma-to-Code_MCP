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
import { LayoutDashboard, Sparkles, FileText } from "lucide-react"
import ThemeToggle from './ThemeToggle'
import LanguageSwitcher from './LanguageSwitcher'
import { useTranslation } from '../i18n/I18nContext'

export function AppSidebar() {
  const { t } = useTranslation()

  const menuItems = [
    { to: '/', icon: LayoutDashboard, label: 'Dashboard' },
    { to: '/analyze', icon: Sparkles, label: t('analysis.title') },
    { to: '/tests', icon: FileText, label: 'Tests' },
  ]

  return (
    <Sidebar variant="inset">
      {/* Header */}
      <SidebarHeader className="flex h-16 min-h-16 max-h-16 shrink-0 flex-row items-center gap-3 border-b px-6 py-3">
        <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary text-primary-foreground">
          <span className="text-lg">🎨</span>
        </div>
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
      <SidebarFooter className="border-t p-4">
        {/* Theme & Language controls */}
        <div className="flex items-center justify-between gap-2">
          <ThemeToggle />
          <LanguageSwitcher />
        </div>
      </SidebarFooter>
    </Sidebar>
  )
}
