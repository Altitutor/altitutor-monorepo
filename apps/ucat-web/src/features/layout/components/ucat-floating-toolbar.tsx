'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Menu, Settings } from 'lucide-react'
import { cn } from '@/lib/utils'

export function UcatFloatingToolbar() {
  const router = useRouter()
  const [menuOpen, setMenuOpen] = useState(false)

  const handleGoHome = () => {
    const confirmLeave = window.confirm(
      'Are you sure you want to leave this UCAT exam? Your current progress may be lost.'
    )
    if (!confirmLeave) {
      return
    }

    setMenuOpen(false)
    router.push('/')
  }

  const handleSettingsClick = () => {
    // TODO: Implement UCAT settings panel
  }

  return (
    <div className="pointer-events-none fixed inset-x-0 top-2 z-[60] flex justify-center">
      <div className="pointer-events-auto inline-flex items-center gap-2 rounded-full border bg-background/95 px-3 py-1 text-sm shadow-md">
        <div className="flex items-center gap-1">
          <button
            type="button"
            title="Open menu"
            aria-label="Open menu"
            onClick={() => setMenuOpen((prev) => !prev)}
            className="inline-flex h-7 w-7 items-center justify-center rounded-full border border-transparent bg-transparent text-foreground hover:bg-muted/50"
          >
            <Menu className="h-4 w-4" />
          </button>
          <button
            type="button"
            title="Open settings"
            aria-label="Open settings"
            onClick={handleSettingsClick}
            className="inline-flex h-7 w-7 items-center justify-center rounded-full border border-transparent bg-transparent text-foreground hover:bg-muted/50"
          >
            <Settings className="h-4 w-4" />
          </button>
        </div>
        <div
          className={cn(
            'absolute left-1/2 top-9 z-[61] -translate-x-1/2 rounded-md border bg-background text-xs shadow-lg',
            menuOpen ? 'block' : 'hidden'
          )}
        >
          <button
            type="button"
            className="block w-full px-3 py-1.5 text-left hover:bg-muted"
            onClick={handleGoHome}
          >
            Go home
          </button>
        </div>
      </div>
    </div>
  )
}

