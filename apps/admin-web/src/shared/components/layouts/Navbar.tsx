'use client';

import { ShortcutKeys } from '@/shared/shortcuts/ShortcutKeys';
import { Button, Tooltip, TooltipTrigger, TooltipContent, TooltipProvider } from '@altitutor/ui';
import type { ReactElement, Ref } from 'react';
import { useAuthStore } from '@/shared/lib/supabase/auth';
import { useMessageSubscription } from '@/features/messages/hooks/useMessageSubscription';
import { PanelLeft, Search } from 'lucide-react';
import { cn, navLinkActiveStyles } from '@/shared/utils';

import { useCurrentStaff } from '@/shared/hooks';
import { useMobileMenu } from '@/shared/contexts/MobileMenuContext';
import { useCommandPalette } from '@/shared/contexts/CommandPaletteContext';
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
  const { data: staffRecord } = useCurrentStaff();
  const { toggle: toggleMobileMenu, isOpen: isMobileMenuOpen } = useMobileMenu();
  const { sidebarCollapsed, toggleSidebar } = useAdminShell();
  const { toggle: toggleCommandPalette } = useCommandPalette();


  // Subscribe to notifications real-time updates
  useNotificationsRealtime(staffRecord?.id ?? '');

  return (
    <nav data-admin-navbar className="relative z-50 h-[var(--navbar-height)] shrink-0 bg-card">
      <div className="flex h-full w-full items-center">
        <div className="flex w-12 shrink-0 items-center pl-2 md:w-[calc(var(--admin-sidebar-width)+4px)]">
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

        </div>

        <div ref={tabsRef} className="h-full min-w-0 flex-1" />

        <TooltipProvider delayDuration={100}>
          <div className="flex shrink-0 items-center gap-2 px-2">
            {user && (
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    variant="outline"
                    size="icon"
                    aria-keyshortcuts="Alt+K Meta+K Control+K"
                    onClick={toggleCommandPalette}
                    className="relative size-8"
                    aria-label="Open command palette"
                  >
                    <Search className="size-4" />
                    <span className="pointer-events-none absolute right-0 top-full empty:hidden rounded border border-border bg-popover p-0.5">
                      <ShortcutKeys id="palette" />
                    </span>
                  </Button>
                </TooltipTrigger>
                <TooltipContent side="bottom" className="flex items-center gap-2">
                  Search <ShortcutKeys id="palette" always preferPrimaryModifier />
                </TooltipContent>
              </Tooltip>
            )}
            {user && staffRecord?.id && <NotificationsTray staffId={staffRecord.id} />}
          </div>
        </TooltipProvider>
      </div>
    </nav>
  );
}
