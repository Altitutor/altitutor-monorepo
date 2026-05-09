'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Home, Calendar, BookOpen, CreditCard, User, Settings } from 'lucide-react';
import { Button, AnimatedHamburgerIcon } from '@altitutor/ui';
import { cn } from '@/shared/utils';
import { ScrollArea } from '@altitutor/ui';
import { useMobileMenu } from '@/shared/contexts/MobileMenuContext';
import { WelcomeModalGate } from '@/features/welcome';
import type { LucideIcon } from 'lucide-react';
import { STUDENT_CONTENT_MAX, STUDENT_SHELL_PAD_X } from '@/shared/lib/student-layout';

interface SidebarNavProps extends React.HTMLAttributes<HTMLDivElement> {
  collapsed: boolean;
  onToggle: () => void;
}

type NavLinkItem = { title: string; href: string; icon: LucideIcon };

const primaryNavItems: NavLinkItem[] = [
  { title: 'Dashboard', href: '/dashboard', icon: Home },
  { title: 'Classes', href: '/classes', icon: Calendar },
  { title: 'Resources', href: '/resources', icon: BookOpen },
  { title: 'Billing', href: '/billing', icon: CreditCard },
  { title: 'My Profile', href: '/my-profile', icon: User },
];

const settingsNavItem: NavLinkItem = { title: 'Settings', href: '/settings', icon: Settings };

/** Match resources topic tree / sidebar: `hover:bg-muted/80` */
const navHoverStyles =
  'rounded-xl hover:bg-muted/80 dark:hover:bg-white/[0.07] transition-colors duration-300 ease-out';

function isNavItemActive(pathname: string, href: string): boolean {
  if (pathname === href) return true;
  if (href === '/') return false;
  return pathname.startsWith(`${href}/`);
}

function renderNavLink(item: NavLinkItem, pathname: string, collapsed: boolean) {
  const Icon = item.icon;
  const active = isNavItemActive(pathname, item.href);
  return (
    <Link
      key={item.href}
      href={item.href}
      className={cn(
        'flex items-center gap-3 rounded-xl px-3 py-2 text-sm transition-all duration-300 ease-out',
        active
          ? 'bg-brand-darkBlue text-white hover:bg-brand-mediumBlue dark:bg-brand-lightBlue dark:text-brand-dark-bg dark:hover:bg-brand-lightBlue/90'
          : navHoverStyles,
        collapsed && 'justify-center px-0',
      )}
    >
      <Icon className={cn('h-5 w-5', collapsed && 'h-6 w-6')} />
      {!collapsed && <span className="overflow-hidden whitespace-nowrap">{item.title}</span>}
    </Link>
  );
}

function MobileMenu({ isOpen, onClose }: { isOpen: boolean; onClose: () => void }) {
  const pathname = usePathname();

  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = '';
    }
    return () => {
      document.body.style.overflow = '';
    };
  }, [isOpen]);

  useEffect(() => {
    if (!isOpen) return;

    const handleClickOutside = (event: MouseEvent) => {
      const target = event.target as HTMLElement;
      if (target.hasAttribute('data-mobile-menu-overlay')) {
        onClose();
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [isOpen, onClose]);

  useEffect(() => {
    onClose();
  }, [pathname, onClose]);

  return (
    <>
      {isOpen && (
        <div
          data-mobile-menu-overlay
          className="fixed inset-0 z-40 bg-black/50 transition-opacity duration-300 md:hidden"
          onClick={onClose}
        />
      )}

      <div
        className={cn(
          'fixed bottom-0 left-0 top-[var(--navbar-height)] z-50 flex w-[280px] max-w-[85vw] flex-col overflow-hidden rounded-r-3xl border-0 bg-card shadow-2xl ring-1 ring-black/10 transition-transform duration-300 ease-out dark:bg-brand-dark-card dark:ring-white/10 md:hidden',
          isOpen ? 'translate-x-0' : '-translate-x-full',
        )}
      >
        <div className="flex h-14 shrink-0 items-center px-4">
          <h2 className="text-lg font-semibold">Altitutor Student</h2>
        </div>

        <ScrollArea className="min-h-0 flex-1">
          <nav className="flex flex-col gap-1 p-2">
            {primaryNavItems.map((item) => renderNavLink(item, pathname, false))}
          </nav>
        </ScrollArea>

        <nav className="shrink-0 p-2">
          {renderNavLink(settingsNavItem, pathname, false)}
        </nav>
      </div>
    </>
  );
}

function SidebarNav({ className, collapsed, onToggle, ...props }: SidebarNavProps) {
  const pathname = usePathname();

  return (
    <div
      className={cn(
        'hidden h-full min-h-0 shrink-0 flex-col rounded-2xl border-0 bg-card shadow-[0_8px_30px_rgb(0,0,0,0.06)] ring-1 ring-black/[0.06] transition-all duration-300 ease-out dark:bg-brand-dark-card dark:shadow-[0_8px_30px_rgb(0,0,0,0.35)] dark:ring-white/10 md:flex',
        collapsed ? 'w-[72px]' : 'w-[250px]',
        className,
      )}
      {...props}
    >
      <div
        className={cn(
          'flex h-14 shrink-0 items-center',
          collapsed ? 'justify-center px-0' : 'gap-2 px-3',
        )}
      >
        <Button
          variant="ghost"
          size="icon"
          onClick={onToggle}
          aria-label={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
          className={cn(
            'shrink-0 rounded-xl hover:bg-muted/80 dark:hover:bg-white/[0.07]',
            collapsed && 'size-10',
          )}
        >
          <AnimatedHamburgerIcon isOpen={!collapsed} />
        </Button>
        {!collapsed && (
          <div className="min-w-0 flex-1 overflow-hidden transition-opacity duration-300">
            <h2 className="whitespace-nowrap text-lg font-semibold">Altitutor Student</h2>
          </div>
        )}
      </div>

      <ScrollArea className="min-h-0 flex-1">
        <nav className="flex flex-col gap-1 p-2">
          {primaryNavItems.map((item) => renderNavLink(item, pathname, collapsed))}
        </nav>
      </ScrollArea>

      <nav className="mt-auto shrink-0 p-2">
        {renderNavLink(settingsNavItem, pathname, collapsed)}
      </nav>
    </div>
  );
}

export default function StudentLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const [collapsed, setCollapsed] = useState(false);
  const { isOpen: isMobileMenuOpen, close: closeMobileMenu } = useMobileMenu();

  const toggleSidebar = () => {
    setCollapsed(!collapsed);
  };

  return (
    <>
      <MobileMenu isOpen={isMobileMenuOpen} onClose={closeMobileMenu} />
      <div className="flex h-[calc(100dvh-var(--navbar-height))] min-h-0 overflow-hidden bg-background md:gap-3 md:p-3">
        <SidebarNav collapsed={collapsed} onToggle={toggleSidebar} />
        <div className="min-h-0 min-w-0 flex-1 overflow-auto rounded-2xl bg-card/45 ring-1 ring-black/[0.04] [scrollbar-gutter:stable] dark:bg-brand-dark-card/25 dark:ring-white/[0.06]">
          <div
            className={cn(
              'mx-auto min-h-min w-full min-w-0',
              STUDENT_CONTENT_MAX,
              STUDENT_SHELL_PAD_X,
            )}
          >
            {children}
          </div>
        </div>
      </div>
      <WelcomeModalGate />
    </>
  );
}
