'use client'

import { Badge } from '@altitutor/ui'
import Image from 'next/image'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { useComingSoon } from '@/features/layout/context/coming-soon-context'
import { appNavigation } from '@/features/layout/config/navigation'
import { isComingSoon } from '@/features/layout/config/coming-soon'
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
  const { showComingSoonModal } = useComingSoon()
  const isVisible = mobileOpen || !collapsed
  const logoSrc = '/images/logo-banner-dark.svg'

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
            {appNavigation.map((section, sectionIndex) => (
              <div key={section.title ?? `section-${sectionIndex}`} className="space-y-1">
                {section.title ? (
                  <div className="px-3 pt-3 text-[11px] font-semibold tracking-[0.16em] text-sidebar-foreground/60">
                    {section.title}
                  </div>
                ) : null}
                {section.items.map((item) => {
                  const Icon = item.icon
                  const active = pathname === item.href
                  const comingSoon = isComingSoon(item.href)

                  if (comingSoon) {
                    return (
                      <button
                        key={item.href}
                        type="button"
                        className={cn(
                          'flex w-full cursor-default items-center rounded-lg px-3 py-2.5 text-left text-sm font-medium',
                          'text-sidebar-foreground/50'
                        )}
                        onClick={() => {
                          showComingSoonModal()
                          onCloseMobile()
                        }}
                        aria-label={`${item.label} (coming soon)`}
                      >
                        <Icon className="h-4 w-4 shrink-0" />
                        <span className="ml-3 flex-1">{item.label}</span>
                        <Badge variant="secondary" className="shrink-0 text-[10px]">
                          Coming soon
                        </Badge>
                      </button>
                    )
                  }

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
              </div>
            ))}
          </nav>
        </div>
      </aside>
    </>
  )
}
