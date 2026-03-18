'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Calendar, Home, BookOpen, Ban, User, BrainCircuit, ChevronDown, ChevronLeft } from 'lucide-react';
import { Button, AnimatedHamburgerIcon } from '@altitutor/ui';
import { cn } from '@/shared/utils';
import { ScrollArea } from '@altitutor/ui';
import { useMobileMenu } from '@/shared/contexts/MobileMenuContext';
import { useUcatAccess } from '@/features/ucat/shared/hooks/useUcatAccess';
import type { LucideIcon } from 'lucide-react';

interface SidebarNavProps extends React.HTMLAttributes<HTMLDivElement> {
  collapsed: boolean;
  onToggle: () => void;
}

type NavLink = { title: string; href: string };

type NavItem =
  | { type?: 'link'; title: string; href: string; icon: LucideIcon }
  | { type: 'dropdown'; title: string; href: string; icon: LucideIcon; children: NavLink[] }
  | { type: 'heading'; title: string };

const ucatDropdownChildren: NavLink[] = [
  { title: 'Questions', href: '/ucat/questions' },
  { title: 'Sets', href: '/ucat/sets' },
  { title: 'Mocks', href: '/ucat/mocks' },
  { title: 'Students', href: '/ucat/students' },
  { title: 'Classes', href: '/ucat/classes' },
  { title: 'Reconciliation', href: '/ucat/reconciliation' },
  { title: 'Question Categories', href: '/ucat/question-stem-categories' },
  { title: 'Question Tags', href: '/ucat/question-tags' },
  { title: 'Sections', href: '/ucat/sections' },
];

const allNavItems: NavItem[] = [
  { title: 'Dashboard', href: '/dashboard', icon: Home },
  { title: 'Classes', href: '/classes', icon: Calendar },
  { title: 'Resources', href: '/resources', icon: BookOpen },
  { type: 'dropdown', title: 'UCAT', href: '/ucat', icon: BrainCircuit, children: ucatDropdownChildren },
  { title: 'Blockout Dates', href: '/settings/blockouts', icon: Ban },
  { title: 'My Profile', href: '/my-profile', icon: User },
];

function getNavItems(isUcatTutor: boolean): NavItem[] {
  return allNavItems.filter(
    (item) => item.type !== 'dropdown' || (item.type === 'dropdown' && isUcatTutor)
  );
}

const navHoverStyles = "hover:bg-brand-lightBlue/10 dark:hover:bg-brand-dark-card/70";

function MobileMenu({ isOpen, onClose, navItems: items }: { isOpen: boolean; onClose: () => void; navItems: NavItem[] }) {
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

  return (
    <>
      {isOpen && (
        <div
          data-mobile-menu-overlay
          className="fixed inset-0 bg-black/50 z-40 md:hidden transition-opacity"
          onClick={onClose}
        />
      )}
      <div
        className={cn(
          "fixed top-[var(--navbar-height)] left-0 bottom-0 w-[280px] bg-background dark:bg-brand-dark-bg border-r dark:border-brand-dark-border z-50 md:hidden transition-transform duration-300 ease-in-out overflow-y-auto",
          isOpen ? "translate-x-0" : "-translate-x-full"
        )}
      >
        <div className="flex flex-col h-full">
          <div className="flex h-14 items-center px-4 border-b dark:border-brand-dark-border">
            <h2 className="text-lg font-semibold">Tutor Portal</h2>
          </div>
          <ScrollArea className="flex-1">
            <nav className="flex flex-col gap-1 p-2">
              {items.map((item, index) => {
                if (item.type === 'heading') {
                  return (
                    <div
                      key={`heading-${index}`}
                      className="text-xs font-semibold text-muted-foreground px-3 pt-4 pb-2"
                    >
                      {item.title}
                    </div>
                  );
                }
                if (item.type === 'dropdown') {
                  const isOpen = item.title === 'UCAT' ? ucatOpen : false;
                  const isActive = pathname.startsWith(item.href);
                  const Icon = item.icon;
                  return (
                    <div key={item.href} className="flex flex-col gap-1">
                      <div
                        className={cn(
                          "flex items-center gap-3 px-3 py-2 rounded-md text-sm transition-colors",
                          isActive ? "bg-brand-darkBlue text-white dark:bg-brand-lightBlue dark:text-brand-dark-bg" : navHoverStyles
                        )}
                      >
                        <Link
                          href={item.href}
                          className="flex min-w-0 flex-1 items-center gap-3"
                        >
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
                          className="shrink-0 rounded p-0.5 hover:bg-black/10 dark:hover:bg-white/10"
                          aria-expanded={isOpen}
                        >
                          {isOpen ? <ChevronDown className="h-4 w-4" /> : <ChevronLeft className="h-4 w-4" />}
                        </button>
                      </div>
                      {isOpen && (
                        <div className="ml-4 mt-1 flex flex-col gap-0.5 border-l border-border pl-2">
                          {item.children.map((child) => (
                            <Link
                              key={child.href}
                              href={child.href}
                              className={cn(
                                "rounded-md px-2 py-1.5 text-sm transition-colors",
                                pathname === child.href
                                  ? "bg-brand-darkBlue text-white dark:bg-brand-lightBlue dark:text-brand-dark-bg"
                                  : "text-muted-foreground hover:bg-brand-lightBlue/10 hover:text-foreground dark:hover:bg-brand-dark-card/70"
                              )}
                            >
                              {child.title}
                            </Link>
                          ))}
                        </div>
                      )}
                    </div>
                  );
                }
                const Icon = item.icon;
                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    className={cn(
                      "flex items-center gap-3 px-3 py-2 rounded-md text-sm transition-colors",
                      pathname === item.href
                        ? "bg-brand-darkBlue text-white hover:bg-brand-mediumBlue dark:bg-brand-lightBlue dark:text-brand-dark-bg dark:hover:bg-brand-lightBlue/90"
                        : navHoverStyles
                    )}
                  >
                    <Icon className="h-5 w-5" />
                    <span>{item.title}</span>
                  </Link>
                );
              })}
            </nav>
          </ScrollArea>
        </div>
      </div>
    </>
  );
}

function SidebarNav({
  className,
  collapsed,
  onToggle,
  navItems: items,
  ...props
}: SidebarNavProps & { navItems: NavItem[] }) {
  const pathname = usePathname();
  const [ucatOpen, setUcatOpen] = useState(() => pathname.startsWith('/ucat'));

  useEffect(() => {
    if (pathname.startsWith('/ucat')) setUcatOpen(true);
  }, [pathname]);

  return (
    <div
      className={cn(
        "hidden md:flex flex-col border-r bg-background dark:bg-brand-dark-bg dark:border-brand-dark-border h-[calc(100vh-var(--navbar-height))] transition-all duration-300",
        collapsed ? "w-[70px]" : "w-[250px]",
        className
      )}
      {...props}
    >
      <div className="flex h-14 items-center px-4 border-b dark:border-brand-dark-border">
        <Button
          variant="ghost"
          size="icon"
          onClick={onToggle}
          className="mr-2 hover:bg-brand-lightBlue/10 dark:hover:bg-brand-dark-card/70"
        >
          <AnimatedHamburgerIcon isOpen={!collapsed} />
        </Button>
        {!collapsed && (
          <div className="flex items-center overflow-hidden min-w-0 transition-opacity duration-300">
            <h2 className="text-lg font-semibold whitespace-nowrap">Tutor Portal</h2>
          </div>
        )}
      </div>
      <ScrollArea className="flex-1">
        <nav className="flex flex-col gap-1 p-2">
          {items.map((item, index) => {
            if (item.type === 'heading') {
              return (
                <div
                  key={`heading-${index}`}
                  className={cn(
                    "text-xs font-semibold text-muted-foreground px-3 pt-4 pb-2",
                    collapsed && "text-center px-0"
                  )}
                >
                  {!collapsed && (
                    <span className="whitespace-nowrap overflow-hidden">{item.title}</span>
                  )}
                  {collapsed && <div className="h-px bg-border" />}
                </div>
              );
            }
            if (item.type === 'dropdown') {
              const isOpen = item.title === 'UCAT' ? ucatOpen : false;
              const isActive = pathname.startsWith(item.href);
              const Icon = item.icon;
              if (collapsed) {
                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    className={cn(
                      "flex items-center justify-center px-0 py-2 rounded-md text-sm transition-colors",
                      isActive
                        ? "bg-brand-darkBlue text-white dark:bg-brand-lightBlue dark:text-brand-dark-bg"
                        : navHoverStyles
                    )}
                  >
                    <Icon className="h-6 w-6" />
                  </Link>
                );
              }
              return (
                <div key={item.href} className="flex flex-col gap-1">
                  <div
                    className={cn(
                      "flex items-center gap-3 px-3 py-2 rounded-md text-sm transition-colors",
                      isActive
                        ? "bg-brand-darkBlue text-white dark:bg-brand-lightBlue dark:text-brand-dark-bg"
                        : navHoverStyles
                    )}
                  >
                    <Link
                      href={item.href}
                      className="flex min-w-0 flex-1 items-center gap-3"
                    >
                      <Icon className="h-5 w-5 shrink-0" />
                      <span className="whitespace-nowrap overflow-hidden text-left">{item.title}</span>
                    </Link>
                    <button
                      type="button"
                      onClick={(e) => {
                        e.preventDefault();
                        e.stopPropagation();
                        if (item.title === 'UCAT') setUcatOpen((o) => !o);
                      }}
                      className="shrink-0 rounded p-0.5 hover:bg-black/10 dark:hover:bg-white/10"
                      aria-expanded={isOpen}
                    >
                      {isOpen ? <ChevronDown className="h-4 w-4" /> : <ChevronLeft className="h-4 w-4" />}
                    </button>
                  </div>
                  {isOpen && (
                    <div className="ml-4 mt-1 flex flex-col gap-0.5 border-l border-border pl-2">
                      {item.children.map((child) => (
                        <Link
                          key={child.href}
                          href={child.href}
                          className={cn(
                            "rounded-md px-2 py-1.5 text-sm transition-colors whitespace-nowrap overflow-hidden",
                            pathname === child.href
                              ? "bg-brand-darkBlue text-white dark:bg-brand-lightBlue dark:text-brand-dark-bg"
                              : "text-muted-foreground hover:bg-brand-lightBlue/10 hover:text-foreground dark:hover:bg-brand-dark-card/70"
                          )}
                        >
                          {child.title}
                        </Link>
                      ))}
                    </div>
                  )}
                </div>
              );
            }
            const Icon = item.icon;
            return (
              <Link
                key={item.href}
                href={item.href}
                className={cn(
                  "flex items-center gap-3 px-3 py-2 rounded-md text-sm transition-colors",
                  pathname === item.href
                    ? "bg-brand-darkBlue text-white hover:bg-brand-mediumBlue dark:bg-brand-lightBlue dark:text-brand-dark-bg dark:hover:bg-brand-lightBlue/90"
                    : navHoverStyles,
                  collapsed && "justify-center px-0"
                )}
              >
                <Icon className={cn("h-5 w-5", collapsed && "h-6 w-6")} />
                {!collapsed && (
                  <span className="whitespace-nowrap overflow-hidden">{item.title}</span>
                )}
              </Link>
            );
          })}
        </nav>
      </ScrollArea>
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
  const navItems = getNavItems(isUcatTutor);

  const toggleSidebar = () => {
    setCollapsed(!collapsed);
  };

  return (
    <>
      <MobileMenu isOpen={isMobileMenuOpen} onClose={closeMobileMenu} navItems={navItems} />
      <div className="flex h-[calc(100vh-var(--navbar-height))] overflow-hidden">
        <SidebarNav collapsed={collapsed} onToggle={toggleSidebar} navItems={navItems} />
        <div className="flex-1 overflow-auto">
          {children}
        </div>
      </div>
    </>
  );
}
