'use client'

import { useEffect, useRef, useState } from 'react'
import { usePathname, useRouter } from 'next/navigation'
import { useAuth } from '@/features/auth'
import { AppSidebar } from '@/features/layout/components/app-sidebar'
import { FloatingAppActions } from '@/features/layout/components/floating-app-actions'
import { useMediaQuery } from '@/shared/hooks/use-media-query'
import { cn } from '@/lib/utils'

export function AppShell({ children }: { children: React.ReactNode }) {
  const router = useRouter()
  const pathname = usePathname()
  const { user, isLoading } = useAuth()
  const isMobile = useMediaQuery('(max-width: 767px)')
  const prevIsMobileRef = useRef<boolean | null>(null)
  const [collapsed, setCollapsed] = useState(false)
  const [mobileOpen, setMobileOpen] = useState(false)

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

  return (
    <div className="min-h-screen bg-background">
      <FloatingAppActions onToggleNav={handleToggleNav} isMenuOpen={sidebarExpanded} />
      <div className="mx-auto flex max-w-[1400px]">
        <AppSidebar
          collapsed={collapsed}
          mobileOpen={mobileOpen}
          onCloseMobile={() => setMobileOpen(false)}
        />
        <main
          className={cn(
            'min-h-screen flex-1 p-6 pt-16 transition-[margin] duration-200',
            sidebarExpanded ? 'md:ml-[240px]' : 'ml-0'
          )}
        >
          {children}
        </main>
      </div>
    </div>
  )
}
