'use client';

import React, { useState, useEffect, useMemo } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Home, Calendar, BookOpen, Brain, CreditCard, Settings, ChevronDown } from 'lucide-react';
import { Button, AnimatedHamburgerIcon } from '@altitutor/ui';
import {
  getResourceSubjectHref,
  getResourceSubjectNavLabel,
  isResourceSubjectNavActive,
  isResourcesNavSectionActive,
} from '@altitutor/shared';
import { cn, navActiveStyles, navLinkActiveStyles, navLinkInactiveStyles } from '@/shared/utils';
import { ScrollArea } from '@altitutor/ui';
import { useMobileMenu } from '@/shared/contexts/MobileMenuContext';
import { WelcomeModalGate } from '@/features/welcome';
import { useResourceSubjects } from '@/features/resources';
import type { LucideIcon } from 'lucide-react';
import { STUDENT_CONTENT_MAX, STUDENT_SHELL_PAD_X } from '@/shared/lib/student-layout';

interface SidebarNavProps extends React.HTMLAttributes<HTMLDivElement> {
  collapsed: boolean;
  onToggle: () => void;
}

type NavLink = { title: string; href: string; icon: LucideIcon };

type NavItem =
  | { type?: 'link'; title: string; href: string; icon: LucideIcon }
  | { type: 'dropdown'; title: string; href: string; icon: LucideIcon; children: NavLink[] };

type NavLinkItem = { title: string; href: string; icon: LucideIcon };

const settingsNavItem: NavLinkItem = { title: 'Settings', href: '/settings', icon: Settings };

function isNavLinkActive(pathname: string, href: string): boolean {
  if (pathname === href) return true;
  if (href === '/') return false;
  if (href === '/resources/flashcards') {
    return pathname === '/resources/flashcards' || pathname.startsWith('/resources/flashcards/');
  }
  return pathname.startsWith(`${href}/`);
}

function isDropdownParentActive(pathname: string, parentHref: string): boolean {
  if (parentHref === '/resources') {
    return isResourcesNavSectionActive(pathname, { excludeFlashcards: true });
  }
  return pathname.startsWith(parentHref);
}

function isDropdownChildActive(pathname: string, parentHref: string, childHref: string): boolean {
  if (parentHref === '/resources') {
    return isResourceSubjectNavActive(pathname, childHref);
  }
  return isNavLinkActive(pathname, childHref);
}

function getInitialOpenDropdowns(pathname: string): Record<string, boolean> {
  return {
    Resources: isResourcesNavSectionActive(pathname, { excludeFlashcards: true }),
  };
}

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

function renderDropdownChild(
  child: NavLink,
  linkClassName: (href: string) => string,
) {
  const Icon = child.icon;
  return (
    <Link
      key={child.href}
      href={child.href}
      className={cn(linkClassName(child.href), 'flex items-center gap-2')}
    >
      <Icon className="h-4 w-4 shrink-0 opacity-80" aria-hidden />
      <span className="truncate">{child.title}</span>
    </Link>
  );
}

function renderSettingsLink(item: NavLinkItem, pathname: string, collapsed: boolean) {
  const Icon = item.icon;
  const active = isNavLinkActive(pathname, item.href);
  return (
    <Link
      href={item.href}
      className={cn(
        'flex items-center gap-3 rounded-xl px-3 py-2 text-sm',
        active ? navLinkActiveStyles : navLinkInactiveStyles,
        collapsed && 'justify-center px-0',
      )}
    >
      <Icon className={cn('h-5 w-5', collapsed && 'h-6 w-6')} />
      {!collapsed && <span className="overflow-hidden whitespace-nowrap">{item.title}</span>}
    </Link>
  );
}

function renderNavItem(
  item: NavItem,
  pathname: string,
  collapsed: boolean,
  openDropdowns: Record<string, boolean>,
  onToggleDropdown: (title: string) => void,
  getChildLinkClass: (parentHref: string) => (href: string) => string,
) {
  if (item.type === 'dropdown') {
    const open = openDropdowns[item.title] ?? false;
    const isActive = isDropdownParentActive(pathname, item.href);
    const Icon = item.icon;
    const childLinkClass = getChildLinkClass(item.href);

    if (collapsed) {
      return (
        <Link
          key={item.href}
          href={item.href}
          className={cn(
            'flex items-center justify-center rounded-xl px-0 py-2 text-sm',
            isActive ? navLinkActiveStyles : navLinkInactiveStyles,
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
            'flex items-center gap-1 rounded-xl px-2 py-2 text-sm',
            isActive ? navLinkActiveStyles : navLinkInactiveStyles,
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
              onToggleDropdown(item.title);
            }}
            className="shrink-0 rounded-lg p-1 hover:bg-black/10 dark:hover:bg-white/10"
            aria-expanded={open}
            aria-label={open ? `Collapse ${item.title} menu` : `Expand ${item.title} menu`}
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
          {item.children.map((child) => renderDropdownChild(child, childLinkClass))}
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
        'flex items-center gap-3 rounded-xl px-3 py-2 text-sm',
        active ? navLinkActiveStyles : navLinkInactiveStyles,
        collapsed && 'justify-center px-0',
      )}
    >
      <Icon className={cn('h-5 w-5', collapsed && 'h-6 w-6')} />
      {!collapsed && <span className="overflow-hidden whitespace-nowrap">{item.title}</span>}
    </Link>
  );
}

function useStudentPrimaryNavItems(): NavItem[] {
  const { data: subjects } = useResourceSubjects();

  return useMemo(() => {
    const resourceChildren: NavLink[] = (subjects ?? []).map((subject) => ({
      title: getResourceSubjectNavLabel(subject),
      href: getResourceSubjectHref(subject),
      icon: BookOpen,
    }));

    return [
      { title: 'Dashboard', href: '/dashboard', icon: Home },
      { title: 'Classes', href: '/classes', icon: Calendar },
      {
        type: 'dropdown',
        title: 'Resources',
        href: '/resources',
        icon: BookOpen,
        children: resourceChildren,
      },
      { title: 'Flashcards', href: '/resources/flashcards', icon: Brain },
      { title: 'Billing', href: '/billing', icon: CreditCard },
    ];
  }, [subjects]);
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
  const [openDropdowns, setOpenDropdowns] = useState(() => getInitialOpenDropdowns(pathname));
  const dragStartYRef = React.useRef<number | null>(null);
  const dragOffsetRef = React.useRef(0);
  const [dragOffset, setDragOffset] = useState(0);

  useEffect(() => {
    if (isResourcesNavSectionActive(pathname, { excludeFlashcards: true })) {
      setOpenDropdowns((prev) => ({ ...prev, Resources: true }));
    }
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

  useEffect(() => {
    if (!isOpen) {
      dragStartYRef.current = null;
      dragOffsetRef.current = 0;
      setDragOffset(0);
    }
  }, [isOpen]);

  const handleTouchStart = (event: React.TouchEvent<HTMLDivElement>) => {
    dragStartYRef.current = event.touches[0]?.clientY ?? null;
    dragOffsetRef.current = 0;
    setDragOffset(0);
  };

  const handleTouchMove = (event: React.TouchEvent<HTMLDivElement>) => {
    if (dragStartYRef.current == null) return;
    const nextOffset = Math.max(0, (event.touches[0]?.clientY ?? dragStartYRef.current) - dragStartYRef.current);
    dragOffsetRef.current = nextOffset;
    setDragOffset(nextOffset);
  };

  const handleTouchEnd = () => {
    if (dragOffsetRef.current > 96) {
      onClose();
    }
    dragStartYRef.current = null;
    dragOffsetRef.current = 0;
    setDragOffset(0);
  };

  const getChildLinkClass = (parentHref: string) => (href: string) =>
    cn(
      'rounded-xl px-3 py-2 text-sm',
      isDropdownChildActive(pathname, parentHref, href)
        ? navActiveStyles
        : cn('text-muted-foreground', navLinkInactiveStyles),
    );

  const toggleDropdown = (title: string) => {
    setOpenDropdowns((prev) => ({ ...prev, [title]: !prev[title] }));
  };

  return (
    <>
      {isOpen && (
        <div
          data-mobile-menu-overlay
          className="fixed inset-0 z-[70] bg-black/60 transition-opacity duration-300 md:hidden"
          onClick={onClose}
        />
      )}

      <div
        className={cn(
          'fixed inset-x-0 bottom-0 z-[80] flex h-[88dvh] flex-col overflow-hidden rounded-t-3xl border-0 bg-card shadow-2xl ring-1 ring-black/10 transition-transform duration-300 ease-out dark:bg-brand-dark-card dark:ring-white/10 md:hidden',
          dragStartYRef.current != null && 'transition-none',
          isOpen ? 'translate-y-0' : 'translate-y-full',
        )}
        style={isOpen && dragOffset > 0 ? { transform: `translateY(${dragOffset}px)` } : undefined}
      >
        <div
          className="flex h-14 shrink-0 touch-pan-y items-center px-4"
          onTouchStart={handleTouchStart}
          onTouchMove={handleTouchMove}
          onTouchEnd={handleTouchEnd}
          onTouchCancel={handleTouchEnd}
        >
          <h2 className="text-lg font-semibold">Altitutor Student</h2>
        </div>

        <ScrollArea className="min-h-0 flex-1">
          <nav className="flex flex-col gap-1 p-2">
            {primaryItems.map((item) =>
              renderNavItem(item, pathname, false, openDropdowns, toggleDropdown, getChildLinkClass),
            )}
          </nav>
        </ScrollArea>

        <nav className="shrink-0 p-2">
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
  const [openDropdowns, setOpenDropdowns] = useState(() => getInitialOpenDropdowns(pathname));

  useEffect(() => {
    if (isResourcesNavSectionActive(pathname, { excludeFlashcards: true })) {
      setOpenDropdowns((prev) => ({ ...prev, Resources: true }));
    }
  }, [pathname]);

  const getChildLinkClass = (parentHref: string) => (href: string) =>
    cn(
      'rounded-xl px-2 py-1.5 text-sm whitespace-nowrap overflow-hidden',
      isDropdownChildActive(pathname, parentHref, href)
        ? navActiveStyles
        : cn('text-muted-foreground', navLinkInactiveStyles),
    );

  const toggleDropdown = (title: string) => {
    setOpenDropdowns((prev) => ({ ...prev, [title]: !prev[title] }));
  };

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
          {primaryItems.map((item) =>
            renderNavItem(item, pathname, collapsed, openDropdowns, toggleDropdown, getChildLinkClass),
          )}
        </nav>
      </ScrollArea>

      <nav className="mt-auto shrink-0 p-2">
        {renderSettingsLink(settingsNavItem, pathname, collapsed)}
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
  const primaryItems = useStudentPrimaryNavItems();

  const toggleSidebar = () => {
    setCollapsed(!collapsed);
  };

  return (
    <>
      <MobileMenu isOpen={isMobileMenuOpen} onClose={closeMobileMenu} primaryItems={primaryItems} />
      <div className="flex h-[calc(100dvh-var(--navbar-height))] min-h-0 overflow-hidden bg-background md:gap-3 md:p-3">
        <SidebarNav collapsed={collapsed} onToggle={toggleSidebar} primaryItems={primaryItems} />
        <div className="min-h-0 min-w-0 flex-1 overflow-auto rounded-2xl bg-card/45 ring-1 ring-black/[0.04] dark:bg-brand-dark-card/25 dark:ring-white/[0.06]">
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
