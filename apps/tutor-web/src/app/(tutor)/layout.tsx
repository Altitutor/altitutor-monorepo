'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import {
  Calendar,
  Home,
  BookOpen,
  BrainCircuit,
  TrendingUp,
  ChevronDown,
  Settings,
} from 'lucide-react';
import { Button, AnimatedHamburgerIcon } from '@altitutor/ui';
import { cn } from '@/shared/utils';
import { ScrollArea } from '@altitutor/ui';
import { useMobileMenu } from '@/shared/contexts/MobileMenuContext';
import { useUcatAccess } from '@/features/ucat/shared/hooks/useUcatAccess';
import type { LucideIcon } from 'lucide-react';
import { TUTOR_CONTENT_MAX, TUTOR_SHELL_PAD_X } from '@/shared/lib/tutor-layout';

interface SidebarNavProps extends React.HTMLAttributes<HTMLDivElement> {
  collapsed: boolean;
  onToggle: () => void;
}

type NavLink = { title: string; href: string };

type NavItem =
  | { type?: 'link'; title: string; href: string; icon: LucideIcon }
  | { type: 'dropdown'; title: string; href: string; icon: LucideIcon; children: NavLink[] }
  | { type: 'heading'; title: string };

type NavLinkItem = { title: string; href: string; icon: LucideIcon };

const ucatDropdownChildren: NavLink[] = [
  { title: 'Questions', href: '/ucat/questions' },
  { title: 'Learning modules', href: '/ucat/learning-modules' },
  { title: 'Skill trainer sets', href: '/ucat/skill-trainer-sets' },
  { title: 'Generated Questions', href: '/ucat/questions/generated' },
  { title: 'Sets', href: '/ucat/sets' },
  { title: 'Mocks', href: '/ucat/mocks' },
  { title: 'Students', href: '/ucat/students' },
  { title: 'Classes', href: '/ucat/classes' },
  { title: 'Reconciliation', href: '/ucat/reconciliation' },
  { title: 'Question Categories', href: '/ucat/question-stem-categories' },
  { title: 'Question Tags', href: '/ucat/question-tags' },
  { title: 'Sections', href: '/ucat/sections' },
];

const primaryNavItems: NavItem[] = [
  { title: 'Dashboard', href: '/dashboard', icon: Home },
  { title: 'Classes', href: '/classes', icon: Calendar },
  { title: 'Pay tier', href: '/pay-tier', icon: TrendingUp },
  { title: 'Resources', href: '/resources', icon: BookOpen },
  { type: 'dropdown', title: 'UCAT', href: '/ucat', icon: BrainCircuit, children: ucatDropdownChildren },
];

const settingsNavItem: NavLinkItem = { title: 'Settings', href: '/settings', icon: Settings };

function getPrimaryNavItems(isUcatTutor: boolean): NavItem[] {
  return primaryNavItems.filter(
    (item) => item.type !== 'dropdown' || (item.type === 'dropdown' && isUcatTutor),
  );
}

const navHoverStyles =
  'rounded-xl hover:bg-muted/80 dark:hover:bg-white/[0.07] transition-colors duration-300 ease-out';

function isNavLinkActive(pathname: string, href: string): boolean {
  if (pathname === href) return true;
  if (href === '/') return false;
  return pathname.startsWith(`${href}/`);
}

/** Animated height for UCAT (and future) submenu — grid 0fr → 1fr */
function NavSubmenu({ open, children }: { open: boolean; children: React.ReactNode }) {
  return (
    <div
      className={cn(
        'grid transition-[grid-template-rows] duration-300 ease-out motion-reduce:transition-none',
        open ? 'grid-rows-[1fr]' : 'grid-rows-[0fr]',
      )}
    >
      <div className="min-h-0 overflow-hidden">
        <div className="ml-3 mt-1 flex flex-col gap-0.5 border-l border-black/[0.08] pl-3 dark:border-white/10">
          {children}
        </div>
      </div>
    </div>
  );
}

function renderSettingsLink(item: NavLinkItem, pathname: string, collapsed: boolean) {
  const Icon = item.icon;
  const active = isNavLinkActive(pathname, item.href);
  return (
    <Link
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

function MobileMenu({
  isOpen,
  onClose,
  primaryItems,
}: {
  isOpen: boolean;
  onClose: () => void;
  primaryItems: NavItem[];
}) {
  const pathname = usePathname();
  const [ucatOpen, setUcatOpen] = useState(() => pathname.startsWith('/ucat'));

  useEffect(() => {
    if (pathname.startsWith('/ucat')) setUcatOpen(true);
  }, [pathname]);

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

  const childLinkClass = (href: string) =>
    cn(
      'rounded-xl px-3 py-2 text-sm transition-all duration-300 ease-out',
      pathname === href
        ? 'bg-brand-darkBlue text-white dark:bg-brand-lightBlue dark:text-brand-dark-bg'
        : 'text-muted-foreground hover:bg-muted/80 dark:hover:bg-white/[0.07]',
    );

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
          <h2 className="text-lg font-semibold">Altitutor Tutor</h2>
        </div>

        <ScrollArea className="min-h-0 flex-1">
          <nav className="flex flex-col gap-1 p-2">
            {primaryItems.map((item, index) => {
              if (item.type === 'heading') {
                return (
                  <div
                    key={`heading-${index}`}
                    className="px-3 pb-2 pt-4 text-xs font-semibold text-muted-foreground"
                  >
                    {item.title}
                  </div>
                );
              }
              if (item.type === 'dropdown') {
                const open = item.title === 'UCAT' ? ucatOpen : false;
                const isActive = pathname.startsWith(item.href);
                const Icon = item.icon;
                return (
                  <div key={item.href} className="flex flex-col gap-0">
                    <div
                      className={cn(
                        'flex items-center gap-1 rounded-xl px-2 py-2 text-sm transition-all duration-300 ease-out',
                        isActive
                          ? 'bg-brand-darkBlue text-white dark:bg-brand-lightBlue dark:text-brand-dark-bg'
                          : navHoverStyles,
                      )}
                    >
                      <Link href={item.href} className="flex min-w-0 flex-1 items-center gap-3 px-1">
                        <Icon className="h-5 w-5 shrink-0" />
                        <span className="text-left">{item.title}</span>
                      </Link>
                      <button
                        type="button"
                        onClick={(e) => {
                          e.preventDefault();
                          e.stopPropagation();
                          if (item.title === 'UCAT') setUcatOpen((o) => !o);
                        }}
                        className="shrink-0 rounded-lg p-1 hover:bg-black/10 dark:hover:bg-white/10"
                        aria-expanded={open}
                      >
                        <ChevronDown
                          className={cn(
                            'h-4 w-4 transition-transform duration-300 ease-out motion-reduce:transition-none',
                            open ? 'rotate-0' : '-rotate-90',
                          )}
                        />
                      </button>
                    </div>
                    <NavSubmenu open={open}>
                      {item.children.map((child) => (
                        <Link key={child.href} href={child.href} className={childLinkClass(child.href)}>
                          {child.title}
                        </Link>
                      ))}
                    </NavSubmenu>
                  </div>
                );
              }
              const Icon = item.icon;
              const active = isNavLinkActive(pathname, item.href);
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className={cn(
                    'flex items-center gap-3 rounded-xl px-3 py-2 text-sm transition-all duration-300 ease-out',
                    active
                      ? 'bg-brand-darkBlue text-white hover:bg-brand-mediumBlue dark:bg-brand-lightBlue dark:text-brand-dark-bg dark:hover:bg-brand-lightBlue/90'
                      : navHoverStyles,
                  )}
                >
                  <Icon className="h-5 w-5" />
                  <span>{item.title}</span>
                </Link>
              );
            })}
          </nav>
        </ScrollArea>

        <nav className="shrink-0 border-t border-black/[0.06] p-2 dark:border-white/10">
          {renderSettingsLink(settingsNavItem, pathname, false)}
        </nav>
      </div>
    </>
  );
}

function SidebarNav({
  className,
  collapsed,
  onToggle,
  primaryItems,
  ...props
}: SidebarNavProps & { primaryItems: NavItem[] }) {
  const pathname = usePathname();
  const [ucatOpen, setUcatOpen] = useState(() => pathname.startsWith('/ucat'));

  useEffect(() => {
    if (pathname.startsWith('/ucat')) setUcatOpen(true);
  }, [pathname]);

  const childLinkClass = (href: string) =>
    cn(
      'rounded-xl px-2 py-1.5 text-sm transition-all duration-300 ease-out whitespace-nowrap overflow-hidden',
      pathname === href
        ? 'bg-brand-darkBlue text-white dark:bg-brand-lightBlue dark:text-brand-dark-bg'
        : 'text-muted-foreground hover:bg-muted/80 dark:hover:bg-white/[0.07]',
    );

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
            <h2 className="whitespace-nowrap text-lg font-semibold">Altitutor Tutor</h2>
          </div>
        )}
      </div>

      <ScrollArea className="min-h-0 flex-1">
        <nav className="flex flex-col gap-1 p-2">
          {primaryItems.map((item, index) => {
            if (item.type === 'heading') {
              return (
                <div
                  key={`heading-${index}`}
                  className={cn(
                    'px-3 pb-2 pt-4 text-xs font-semibold text-muted-foreground',
                    collapsed && 'px-0 text-center',
                  )}
                >
                  {!collapsed && (
                    <span className="overflow-hidden whitespace-nowrap">{item.title}</span>
                  )}
                  {collapsed && <div className="mx-auto h-px max-w-[28px] bg-border" />}
                </div>
              );
            }
            if (item.type === 'dropdown') {
              const open = item.title === 'UCAT' ? ucatOpen : false;
              const isActive = pathname.startsWith(item.href);
              const Icon = item.icon;
              if (collapsed) {
                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    className={cn(
                      'flex items-center justify-center rounded-xl px-0 py-2 text-sm transition-all duration-300 ease-out',
                      isActive
                        ? 'bg-brand-darkBlue text-white dark:bg-brand-lightBlue dark:text-brand-dark-bg'
                        : navHoverStyles,
                    )}
                  >
                    <Icon className="h-6 w-6" />
                  </Link>
                );
              }
              return (
                <div key={item.href} className="flex flex-col gap-0">
                  <div
                    className={cn(
                      'flex items-center gap-1 rounded-xl px-2 py-2 text-sm transition-all duration-300 ease-out',
                      isActive
                        ? 'bg-brand-darkBlue text-white dark:bg-brand-lightBlue dark:text-brand-dark-bg'
                        : navHoverStyles,
                    )}
                  >
                    <Link href={item.href} className="flex min-w-0 flex-1 items-center gap-3 px-1">
                      <Icon className="h-5 w-5 shrink-0" />
                      <span className="overflow-hidden whitespace-nowrap text-left">{item.title}</span>
                    </Link>
                    <button
                      type="button"
                      onClick={(e) => {
                        e.preventDefault();
                        e.stopPropagation();
                        if (item.title === 'UCAT') setUcatOpen((o) => !o);
                      }}
                      className="shrink-0 rounded-lg p-1 hover:bg-black/10 dark:hover:bg-white/10"
                      aria-expanded={open}
                    >
                      <ChevronDown
                        className={cn(
                          'h-4 w-4 transition-transform duration-300 ease-out motion-reduce:transition-none',
                          open ? 'rotate-0' : '-rotate-90',
                        )}
                      />
                    </button>
                  </div>
                  <NavSubmenu open={open}>
                    {item.children.map((child) => (
                      <Link key={child.href} href={child.href} className={childLinkClass(child.href)}>
                        {child.title}
                      </Link>
                    ))}
                  </NavSubmenu>
                </div>
              );
            }
            const Icon = item.icon;
            const active = isNavLinkActive(pathname, item.href);
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
                {!collapsed && (
                  <span className="overflow-hidden whitespace-nowrap">{item.title}</span>
                )}
              </Link>
            );
          })}
        </nav>
      </ScrollArea>

      <nav className="mt-auto shrink-0 border-t border-black/[0.06] p-2 dark:border-white/10">
        {renderSettingsLink(settingsNavItem, pathname, collapsed)}
      </nav>
    </div>
  );
}

export default function TutorLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const [collapsed, setCollapsed] = useState(false);
  const { isOpen: isMobileMenuOpen, close: closeMobileMenu } = useMobileMenu();
  const ucatAccess = useUcatAccess();
  const isUcatTutor = !!ucatAccess.data;
  const primaryItems = getPrimaryNavItems(isUcatTutor);

  const toggleSidebar = () => {
    setCollapsed(!collapsed);
  };

  return (
    <>
      <MobileMenu isOpen={isMobileMenuOpen} onClose={closeMobileMenu} primaryItems={primaryItems} />
      <div className="flex h-[calc(100dvh-var(--navbar-height))] min-h-0 overflow-hidden bg-background md:gap-3 md:p-3">
        <SidebarNav collapsed={collapsed} onToggle={toggleSidebar} primaryItems={primaryItems} />
        <div className="min-h-0 min-w-0 flex-1 overflow-auto rounded-2xl bg-card/45 ring-1 ring-black/[0.04] [scrollbar-gutter:stable] dark:bg-brand-dark-card/25 dark:ring-white/[0.06]">
          <div className={cn('mx-auto min-h-min w-full min-w-0', TUTOR_CONTENT_MAX, TUTOR_SHELL_PAD_X)}>
            {children}
          </div>
        </div>
      </div>
    </>
  );
}
