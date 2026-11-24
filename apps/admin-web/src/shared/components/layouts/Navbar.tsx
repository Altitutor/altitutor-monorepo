'use client';

import { ShortcutKeys } from '@/shared/shortcuts/ShortcutKeys';
import { Button, Tooltip, TooltipTrigger, TooltipContent, TooltipProvider } from '@altitutor/ui';
import type { ReactElement, Ref } from 'react';
import { useAuthStore } from '@/shared/lib/supabase/auth';
import { useMessageSubscription } from '@/features/messages/hooks/useMessageSubscription';
import { PanelLeft } from 'lucide-react';
import { cn, navLinkActiveStyles } from '@/shared/utils';
import Image from 'next/image';
import { useTheme } from 'next-themes';

import { useCurrentStaff } from '@/shared/hooks';
import { useMobileMenu } from '@/shared/contexts/MobileMenuContext';
import { useCommandPalette } from '@/shared/contexts/CommandPaletteContext';
import { Search } from 'lucide-react';
import { NotificationsTray } from '@/features/notifications';
import { useNotificationsRealtime } from '@/features/notifications';

import { useAdminShell } from '@/shared/contexts/AdminShellContext';

function SidebarShortcutTooltip({ label, shortcut, children }: { label: string; shortcut: 'left' | 'right'; children: ReactElement }) {
  return <TooltipProvider delayDuration={100}><Tooltip>
    <TooltipTrigger asChild>{children}</TooltipTrigger>
    <TooltipContent side="bottom" className="flex items-center gap-2">
      {label}<ShortcutKeys id={shortcut} always />
    </TooltipContent>
  </Tooltip></TooltipProvider>;
}

export function Navbar({ tabsRef }: { tabsRef?: Ref<HTMLDivElement> }) {
  useMessageSubscription();
  const { user } = useAuthStore();
  const { resolvedTheme } = useTheme();
  const { data: staffRecord } = useCurrentStaff();
  const { toggle: toggleMobileMenu, isOpen: isMobileMenuOpen } = useMobileMenu();
  const { sidebarCollapsed, toggleSidebar } = useAdminShell();
  const { toggle: toggleCommandPalette } = useCommandPalette();


  // Subscribe to notifications real-time updates
  useNotificationsRealtime(staffRecord?.id ?? '');

  return (
    <nav data-admin-navbar className="fixed top-0 left-0 right-0 z-50 h-[var(--navbar-height)] bg-card">
      <div className="flex h-full w-full items-center gap-2 px-2 sm:px-3">
        {/* Mobile Hamburger Menu Button */}
        {user && (
          <SidebarShortcutTooltip label={isMobileMenuOpen ? 'Close menu' : 'Open menu'} shortcut="left">
          <Button
            variant="outline"
            size="icon"
            onClick={toggleMobileMenu}
            aria-pressed={isMobileMenuOpen}
            aria-expanded={isMobileMenuOpen}
            aria-controls="admin-mobile-sidebar"
            aria-keyshortcuts="["
            className={cn("relative inline-flex h-8 w-8 flex-shrink-0 md:hidden", isMobileMenuOpen && navLinkActiveStyles)}
            aria-label={isMobileMenuOpen ? "Close menu" : "Open menu"}
          >
            <PanelLeft className="h-4 w-4" />
          </Button>
          </SidebarShortcutTooltip>
        )}

        {user && (
          <SidebarShortcutTooltip label={sidebarCollapsed ? 'Expand sidebar' : 'Collapse sidebar'} shortcut="left">
          <Button
            variant="outline"
            size="icon"
            aria-keyshortcuts="[" onClick={toggleSidebar}
            aria-pressed={!sidebarCollapsed}
            className={cn("relative hidden h-8 w-8 flex-shrink-0 md:inline-flex", !sidebarCollapsed && navLinkActiveStyles)}
            aria-label={sidebarCollapsed ? 'Expand sidebar' : 'Collapse sidebar'}
          >
            <PanelLeft className="h-4 w-4" />
          </Button>
          </SidebarShortcutTooltip>
        )}

        {/* Desktop Logo - hidden on mobile */}
        <div className="hidden shrink-0 items-center md:flex">
          <div className="flex h-8 w-32 items-center">
            <Image
              src={resolvedTheme === 'dark' ? "/images/logo-banner-dark.svg" : "/images/logo-banner-light.svg"}
              alt="Altitutor"
              width={160}
              height={36}
              priority
              className="h-auto w-full object-contain"
            />
          </div>
        </div>

        <div ref={tabsRef} className="h-full min-w-0 flex-1" />

        <div className="flex items-center gap-2 flex-shrink-0 justify-end">

          {/* Command palette */}
          {user && (
            <Button
              variant="outline"
              size="icon"
              aria-keyshortcuts="Alt+K Meta+K Control+K" onClick={toggleCommandPalette}
              className="relative h-8 w-8"
              aria-label="Open command palette"
              title="Search (Alt+K / Cmd+K / Ctrl+K)"
            >
              <Search className="h-4 w-4" /><span className="absolute top-full right-0"><ShortcutKeys id="palette" /></span>
            </Button>
          )}

          {/* Notifications Button */}
          {user && staffRecord?.id && (
            <NotificationsTray staffId={staffRecord.id} />
          )}



        </div>
      </div>
    </nav>
  );
}
