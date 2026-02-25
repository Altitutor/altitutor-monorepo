'use client'

import { Button, AnimatedHamburgerIcon } from '@altitutor/ui'
import { ThemeToggle } from '@/components/theme/theme-toggle'
import { ProfileDropdown } from '@/features/layout/components/profile-dropdown'
import { cn } from '@/lib/utils'

type FloatingAppActionsProps = {
  onToggleNav: () => void
  isMenuOpen: boolean
  className?: string
}

export function FloatingAppActions({ onToggleNav, isMenuOpen, className }: FloatingAppActionsProps) {
  return (
    <div
      className={cn(
        'fixed top-4 left-4 right-4 z-50 flex items-center justify-between gap-2',
        className
      )}
    >
      <div
        className={cn(
          'shrink-0 transition-[margin] duration-200 ease-in-out',
          isMenuOpen ? 'ml-[240px]' : 'ml-0'
        )}
      >
        <Button
          type="button"
          variant="ghost"
          size="icon"
          onClick={onToggleNav}
          className="h-9 w-9 rounded-lg bg-card border border-border shadow-sm hover:bg-muted transition-colors"
          aria-label={isMenuOpen ? 'Close menu' : 'Open menu'}
        >
          <AnimatedHamburgerIcon isOpen={isMenuOpen} className="h-5 w-5" />
        </Button>
      </div>
      <div className="flex items-center gap-2">
        <ThemeToggle />
        <ProfileDropdown />
      </div>
    </div>
  )
}
