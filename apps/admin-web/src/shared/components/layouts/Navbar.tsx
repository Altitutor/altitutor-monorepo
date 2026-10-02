'use client';

import { useAccessoryPanel } from '@/shared/contexts/AccessoryPanelContext';
import { ShortcutKeys } from '@/shared/shortcuts/ShortcutKeys';
import { Button } from '@altitutor/ui';
import { useAuthStore } from '@/shared/lib/supabase/auth';
import { PanelRight, PanelLeft } from 'lucide-react';
import { cn, navLinkActiveStyles } from '@/shared/utils';
import Image from 'next/image';
import { useTheme } from 'next-themes';

import { useCurrentStaff } from '@/shared/hooks';
import { useMobileMenu } from '@/shared/contexts/MobileMenuContext';
import { useCommandPalette } from '@/shared/contexts/CommandPaletteContext';
import { Search } from 'lucide-react';
import { NotificationsTray } from '@/features/notifications';
import { useNotificationsRealtime } from '@/features/notifications';
import { DashboardDatePicker } from './DashboardDatePicker';

import { useAdminShell } from '@/shared/contexts/AdminShellContext';

export function Navbar() {
  const detailPanel = useAccessoryPanel();
  const { user } = useAuthStore();
  const { resolvedTheme } = useTheme();
  const { data: staffRecord } = useCurrentStaff();
  const { toggle: toggleMobileMenu, isOpen: isMobileMenuOpen } = useMobileMenu();
  const { sidebarCollapsed, toggleSidebar } = useAdminShell();
  const { toggle: toggleCommandPalette } = useCommandPalette();


  // Subscribe to notifications real-time updates
  useNotificationsRealtime(staffRecord?.id ?? '');

  return (
    <nav className="fixed top-0 left-0 right-0 z-50 h-[var(--navbar-height)] bg-card">
      <div className="h-full w-full px-4 flex items-center gap-4">
        {/* Mobile Hamburger Menu Button */}
        {user && (
          <Button
            variant="outline"
            size="icon"
            onClick={toggleMobileMenu}
            aria-pressed={isMobileMenuOpen}
            className={cn("relative md:relative hidden h-9 w-9 flex-shrink-0", isMobileMenuOpen && navLinkActiveStyles)}
            aria-label={isMobileMenuOpen ? "Close menu" : "Open menu"}
          >
            <PanelLeft className="h-4 w-4" /><span className="absolute top-full left-0"><ShortcutKeys id="left" /></span>
          </Button>
        )}

        {user && (
          <Button
            variant="outline"
            size="icon"
            aria-keyshortcuts="Alt+ArrowLeft" onClick={toggleSidebar}
            aria-pressed={!sidebarCollapsed}
            className={cn("relative hidden h-9 w-9 flex-shrink-0 md:inline-flex", !sidebarCollapsed && navLinkActiveStyles)}
            aria-label={sidebarCollapsed ? 'Expand sidebar' : 'Collapse sidebar'}
          >
            <PanelLeft className="h-4 w-4" /><span className="absolute top-full left-0"><ShortcutKeys id="left" /></span>
          </Button>
        )}

        {/* Desktop Logo - hidden on mobile */}
        <div className="hidden md:flex items-center gap-3 min-w-[180px]">
          <div className="h-12 flex items-center gap-1">
            <Image
              src={resolvedTheme === 'dark' ? "/images/logo-banner-dark.svg" : "/images/logo-banner-light.svg"}
              alt="Altitutor"
              width={160}
              height={36}
              priority
              className="object-contain"
              style={{ width: 'auto', height: 'auto' }}
            />
          </div>
        </div>

        {/* Search Button - same on desktop and mobile */}
        {user && (
          <div className="flex-1 flex justify-center min-w-0">
            {/* Spacer to center the search button */}
          </div>
        )}

        <div className="flex items-center gap-2 flex-shrink-0 justify-end">
          {user && <DashboardDatePicker />}

          {/* Command palette */}
          {user && (
            <Button
              variant="outline"
              size="icon"
              aria-keyshortcuts="Alt+K Meta+K Control+K" onClick={toggleCommandPalette}
              className="relative h-9 w-9"
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

          {user && detailPanel && (
            <Button variant="outline" size="icon" className={cn("relative h-9 w-9", detailPanel.expanded && navLinkActiveStyles)} aria-pressed={detailPanel.expanded}
              aria-keyshortcuts="Alt+ArrowRight" onClick={detailPanel.toggle} aria-controls="admin-accessory-panel" aria-expanded={detailPanel.expanded}
              aria-label={detailPanel.expanded ? 'Collapse accessory panel' : 'Expand accessory panel'}
              title={detailPanel.expanded ? 'Collapse accessory panel' : 'Expand accessory panel'}>
              <PanelRight className="h-4 w-4" /><span className="absolute top-full right-0"><ShortcutKeys id="right" /></span>
            </Button>
          )}

        </div>
      </div>
    </nav>
  );
}
