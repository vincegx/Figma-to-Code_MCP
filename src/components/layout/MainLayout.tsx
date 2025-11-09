/**
 * MainLayout - Main layout wrapper for all pages
 * Provides sidebar, header, and MCP connection status
 */

import { useEffect, useRef } from 'react'
import { Outlet, useLocation } from 'react-router-dom'
import { SidebarProvider, SidebarInset, useSidebar } from "@/components/ui/sidebar"
import { AppSidebar } from './AppSidebar'
import { SiteHeader } from './SiteHeader'
import { useMcpConnection } from '../../hooks/useMcpConnection'

function SidebarController() {
  const location = useLocation()
  const { setOpen } = useSidebar()
  const previousPathRef = useRef<string>(location.pathname)

  useEffect(() => {
    // Only trigger on actual route changes, not on re-renders
    if (previousPathRef.current !== location.pathname) {
      previousPathRef.current = location.pathname

      // Auto-close sidebar when navigating TO a detail page
      // Auto-open sidebar when navigating TO a list page
      const isDetailPage = location.pathname.match(/^\/tests\/[^/]+$/)
      setOpen(!isDetailPage)
    }
  }, [location.pathname, setOpen])

  return null
}

function MainLayoutContent() {
  const { mcpConnected, mcpChecking } = useMcpConnection()

  return (
    <>
      <SidebarController />
      <AppSidebar />
      <SidebarInset className="overflow-auto">
        <SiteHeader mcpConnected={mcpConnected} mcpChecking={mcpChecking} />
        <div className="flex flex-1 flex-col gap-6 p-4 md:p-6 min-w-0">
          <Outlet />
        </div>
      </SidebarInset>
    </>
  )
}

export default function MainLayout() {
  return (
    <SidebarProvider defaultOpen={true}>
      <div className="flex h-screen w-screen overflow-hidden">
        <MainLayoutContent />
      </div>
    </SidebarProvider>
  )
}
