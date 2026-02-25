'use client'

import Link from 'next/link'
import Image from 'next/image'
import { usePathname } from 'next/navigation'
import { useTheme } from 'next-themes'
import { appNavigation } from '@/features/layout/config/navigation'
import { cn } from '@/lib/utils'

export function AppSidebar({
  collapsed,
  mobileOpen,
  onCloseMobile,
}: {
  collapsed: boolean
  mobileOpen: boolean
  onCloseMobile: () => void
}) {
  const pathname = usePathname()
  const { resolvedTheme } = useTheme()
  const isVisible = mobileOpen || !collapsed
  const logoSrc ='/images/logo-banner-dark.svg'

  return (
    <>
      {mobileOpen ? (
        <button
          type="button"
          aria-label="Close navigation"
          className="fixed inset-0 z-30 bg-black/40 md:hidden"
          onClick={onCloseMobile}
        />
      ) : null}

      <aside
        className={cn(
          'fixed left-0 top-0 z-40 h-screen overflow-hidden transition-[transform,width] duration-200 ease-in-out',
          'rounded-r-2xl bg-sidebar text-sidebar-foreground shadow-lg',
          isVisible ? 'w-[240px] translate-x-0' : 'w-0 -translate-x-full'
        )}
      >
        <div className="flex h-full w-[240px] flex-col">
          <div className="shrink-0 p-3">
            <Image
              src={logoSrc}
              alt="Altitutor"
              width={140}
              height={32}
              className="h-14 w-auto object-contain object-left"
              priority
            />
          </div>
          <nav className="flex flex-1 flex-col space-y-1 overflow-auto p-3">
          {appNavigation.map((item) => {
            const Icon = item.icon
            const active = pathname === item.href

            return (
              <Link
                key={item.href}
                href={item.href}
                className={cn(
                  'flex items-center rounded-lg px-3 py-2.5 text-sm font-medium transition-colors',
                  active
                    ? 'bg-sidebar-foreground/20 text-sidebar-foreground'
                    : 'text-sidebar-foreground/90 hover:bg-sidebar-foreground/10 hover:text-sidebar-foreground'
                )}
                onClick={onCloseMobile}
              >
                <Icon className="h-4 w-4 shrink-0" />
                <span className="ml-3">{item.label}</span>
              </Link>
            )
          })}
          </nav>
        </div>
      </aside>
    </>
  )
}
