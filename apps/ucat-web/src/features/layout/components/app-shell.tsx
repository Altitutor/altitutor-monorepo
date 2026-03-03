'use client'

import { useEffect, useRef, useState } from 'react'
import { usePathname, useRouter } from 'next/navigation'
import { useAuth } from '@/features/auth'
import { AppSidebar } from '@/features/layout/components/app-sidebar'
import { ComingSoonProvider } from '@/features/layout/context/coming-soon-context'
import { FloatingAppActions } from '@/features/layout/components/floating-app-actions'
import { UcatFloatingToolbar } from '@/features/layout/components/ucat-floating-toolbar'
import { isComingSoon } from '@/features/layout/config/coming-soon'
import { UcatLagProvider } from '@/features/question-engine/context/ucat-lag-context'
import { useMediaQuery } from '@/shared/hooks/use-media-query'
import { cn } from '@/lib/utils'

type AppShellProps = {
  children: React.ReactNode
  detail?: React.ReactNode
}

export function AppShell({ children, detail }: AppShellProps) {
  const router = useRouter()
  const pathname = usePathname()
  const { user, isLoading } = useAuth()
  const isMobile = useMediaQuery('(max-width: 767px)')
  const prevIsMobileRef = useRef<boolean | null>(null)
  const [collapsed, setCollapsed] = useState(false)
  const [mobileOpen, setMobileOpen] = useState(false)

  const isExamRoute = pathname.startsWith('/exam')

  // For exam routes, start with sidebar collapsed (full-screen content) but allow toggling via floating menu.
  // This effect must be declared before any conditional returns to keep hook order stable.
  useEffect(() => {
    if (isExamRoute) {
      setCollapsed(true)
    }
  }, [isExamRoute])

  useEffect(() => {
    if (!isLoading && !user) {
      router.replace('/login')
    }
  }, [isLoading, router, user])

  useEffect(() => {
    setMobileOpen(false)
  }, [pathname])

  useEffect(() => {
    const prev = prevIsMobileRef.current
    prevIsMobileRef.current = isMobile
    if (prev === null) return

    if (isMobile && !prev) {
      if (!collapsed) setMobileOpen(true)
    } else if (!isMobile && prev) {
      if (mobileOpen) {
        setCollapsed(false)
        setMobileOpen(false)
      }
    }
  }, [isMobile, collapsed, mobileOpen])

  const handleToggleNav = () => {
    if (isMobile) {
      setMobileOpen((prev) => !prev)
      return
    }
    setCollapsed((prev) => !prev)
  }

  if (isLoading || !user) {
    return <div className="p-6 text-sm text-muted-foreground">Loading...</div>
  }

  const sidebarExpanded = isMobile ? mobileOpen : !collapsed
  const comingSoonPath = isComingSoon(pathname)

  const handleComingSoonConfirm = () => {
    router.replace('/dashboard')
  }

  return (
    <ComingSoonProvider
      openOnMount={comingSoonPath}
      onConfirmRedirect={handleComingSoonConfirm}
    >
      <div className="min-h-screen bg-background">
        {isExamRoute ? (
        <UcatLagProvider>
          <UcatFloatingToolbar />
          <div className={cn('flex', 'w-screen')}>
            <AppSidebar
              collapsed={collapsed}
              mobileOpen={mobileOpen}
              onCloseMobile={() => setMobileOpen(false)}
            />
            <main
              className={cn(
                'flex-1 min-h-0 transition-[margin] duration-200',
                'h-screen min-h-0 overflow-hidden p-0',
                sidebarExpanded ? 'md:ml-[240px]' : 'ml-0'
              )}
            >
              {children}
            </main>
          </div>
        </UcatLagProvider>
      ) : (
        <>
          <FloatingAppActions onToggleNav={handleToggleNav} isMenuOpen={sidebarExpanded} />
          <div className={cn('flex', 'mx-auto max-w-[1400px]')}>
            <AppSidebar
              collapsed={collapsed}
              mobileOpen={mobileOpen}
              onCloseMobile={() => setMobileOpen(false)}
            />
            <main
              className={cn(
                'flex-1 min-h-0 transition-[margin] duration-200',
                'min-h-screen pt-16 p-6',
                sidebarExpanded ? 'md:ml-[240px]' : 'ml-0'
              )}
            >
              {children}
            </main>
          </div>
        </>
      )}
        {detail}
      </div>
    </ComingSoonProvider>
  )
}

