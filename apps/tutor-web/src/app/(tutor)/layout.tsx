'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Calendar, Settings, Home, ClipboardList, BookOpen, Ban } from 'lucide-react';
import { Button, AnimatedHamburgerIcon } from '@altitutor/ui';
import { cn } from '@/shared/utils';
import { ScrollArea } from '@altitutor/ui';
import { useMobileMenu } from '@/shared/contexts/MobileMenuContext';
import type { LucideIcon } from 'lucide-react';

interface SidebarNavProps extends React.HTMLAttributes<HTMLDivElement> {
  collapsed: boolean;
  onToggle: () => void;
}

type NavItem = 
  | { type?: 'link'; title: string; href: string; icon: LucideIcon }
  | { type: 'heading'; title: string };

const navItems: NavItem[] = [
  {
    title: 'Dashboard',
    href: '/dashboard',
    icon: Home,
  },
  {
    type: 'heading',
    title: 'SCHEDULING',
  },
  {
    title: 'Sessions',
    href: '/session-logs',
    icon: ClipboardList,
  },
  {
    title: 'Classes',
    href: '/classes',
    icon: Calendar,
  },
  {
    title: 'Blockout Dates',
    href: '/settings/blockouts',
    icon: Ban,
  },
  {
    type: 'heading',
    title: 'RESOURCES',
  },
  {
    title: 'Resources',
    href: '/resources',
    icon: BookOpen,
  },
];

const navHoverStyles = "hover:bg-brand-lightBlue/10 dark:hover:bg-brand-dark-card/70";

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

  // Close menu when route changes
  useEffect(() => {
    onClose();
  }, [pathname, onClose]);

  return (
    <>
      {/* Overlay */}
      {isOpen && (
        <div
          data-mobile-menu-overlay
          className="fixed inset-0 bg-black/50 z-40 md:hidden transition-opacity"
          onClick={onClose}
        />
      )}
      
      {/* Slide-in menu */}
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
              {navItems.map((item, index) => {
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
          
          <div className="border-t dark:border-brand-dark-border p-2">
            <Link 
              href="/my-account"
              className={cn(
                "flex items-center gap-3 px-3 py-2 rounded-md text-sm transition-colors",
                pathname === '/my-account'
                  ? "bg-brand-darkBlue text-white hover:bg-brand-mediumBlue dark:bg-brand-lightBlue dark:text-brand-dark-bg dark:hover:bg-brand-lightBlue/90" 
                  : navHoverStyles
              )}
            >
              <Settings className="h-5 w-5" />
              <span>My Account</span>
            </Link>
          </div>
        </div>
      </div>
    </>
  );
}

function SidebarNav({ className, collapsed, onToggle, ...props }: SidebarNavProps) {
  const pathname = usePathname();
  
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
          <div className="flex items-center">
            <h2 className="text-lg font-semibold">Tutor Portal</h2>
          </div>
        )}
      </div>
      
      <ScrollArea className="flex-1">
        <nav className="flex flex-col gap-1 p-2">
          {navItems.map((item, index) => {
            if (item.type === 'heading') {
              return (
                <div 
                  key={`heading-${index}`}
                  className={cn(
                    "text-xs font-semibold text-muted-foreground px-3 pt-4 pb-2",
                    collapsed && "text-center px-0"
                  )}
                >
                  {!collapsed && item.title}
                  {collapsed && <div className="h-px bg-border" />}
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
                {!collapsed && <span>{item.title}</span>}
              </Link>
            );
          })}
        </nav>
      </ScrollArea>
      
      <div className="border-t dark:border-brand-dark-border p-2">
        <Link 
          href="/my-account"
          className={cn(
            "flex items-center gap-3 px-3 py-2 rounded-md text-sm transition-colors",
            pathname === '/my-account'
              ? "bg-brand-darkBlue text-white hover:bg-brand-mediumBlue dark:bg-brand-lightBlue dark:text-brand-dark-bg dark:hover:bg-brand-lightBlue/90" 
              : navHoverStyles,
            collapsed && "justify-center px-0"
          )}
        >
          <Settings className={cn("h-5 w-5", collapsed && "h-6 w-6")} />
          {!collapsed && <span>My Account</span>}
        </Link>
      </div>
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
  
  const toggleSidebar = () => {
    setCollapsed(!collapsed);
  };
  
  return (
    <>
      <MobileMenu isOpen={isMobileMenuOpen} onClose={closeMobileMenu} />
      <div className="flex h-[calc(100vh-var(--navbar-height))] overflow-hidden">
        <SidebarNav collapsed={collapsed} onToggle={toggleSidebar} />
        <div className="flex-1 overflow-auto">
          {children}
        </div>
      </div>
    </>
  );
}

