'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Home, Calendar, BookOpen, CreditCard, User, Menu, X } from 'lucide-react';
import { Button } from '@altitutor/ui';
import { cn } from '@/shared/utils';
import { ScrollArea } from '@altitutor/ui';
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
    title: 'Classes',
    href: '/classes',
    icon: Calendar,
  },
  {
    title: 'Resources',
    href: '/resources',
    icon: BookOpen,
  },
  {
    title: 'Billing',
    href: '/billing',
    icon: CreditCard,
  },
  {
    title: 'My Profile',
    href: '/my-profile',
    icon: User,
  },
];

const navHoverStyles = "hover:bg-brand-lightBlue/10 dark:hover:bg-brand-dark-card/70";

function SidebarNav({ className, collapsed, onToggle, ...props }: SidebarNavProps) {
  const pathname = usePathname();
  
  return (
    <div 
      className={cn(
        "flex flex-col border-r bg-background dark:bg-brand-dark-bg dark:border-brand-dark-border h-[calc(100vh-var(--navbar-height))] transition-all duration-300",
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
          {collapsed ? <Menu className="h-5 w-5" /> : <X className="h-5 w-5" />}
        </Button>
        {!collapsed && (
          <div className="flex items-center">
            <h2 className="text-lg font-semibold">Altitutor Student</h2>
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
    </div>
  );
}

export default function StudentLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const [collapsed, setCollapsed] = useState(false);
  
  const toggleSidebar = () => {
    setCollapsed(!collapsed);
  };
  
  return (
    <div className="flex h-[calc(100vh-var(--navbar-height))] overflow-hidden">
      <SidebarNav collapsed={collapsed} onToggle={toggleSidebar} />
      <div className="flex-1 overflow-auto">
        {children}
      </div>
    </div>
  );
}

