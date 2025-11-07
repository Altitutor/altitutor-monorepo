'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Users, Calendar, GraduationCap, Settings, Menu, X, FileText, Home, CreditCard } from 'lucide-react';
import { Button } from '@altitutor/ui';
import { useAuthStore } from '@/shared/lib/supabase/auth';
import { cn, navHoverStyles } from '@/shared/utils/index';
import { ScrollArea } from '@altitutor/ui';
import { Beaker, Newspaper, ClipboardList, MessageCircle } from 'lucide-react';
import { ChatDock } from '@/features/messages/floating/ChatDock';
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
    href: '/admin/dashboard',
    icon: Home,
  },
  {
    type: 'heading',
    title: 'SCHEDULING',
  },
  {
    title: 'Students',
    href: '/admin/students',
    icon: GraduationCap,
  },
  {
    title: 'Staff',
    href: '/admin/staff',
    icon: Users,
  },
  {
    title: 'Classes',
    href: '/admin/classes',
    icon: Calendar,
  },
  {
    title: 'Sessions',
    href: '/admin/sessions',
    icon: ClipboardList,
  },
  {
    type: 'heading',
    title: 'RESOURCES',
  },
  {
    title: 'Subjects',
    href: '/admin/subjects',
    icon: Beaker,
  },
  {
    title: 'Topics',
    href: '/admin/topics',
    icon: Newspaper,
  },
  {
    type: 'heading',
    title: 'COMMUNICATIONS',
  },
  {
    title: 'Communications',
    href: '/admin/communications',
    icon: MessageCircle,
  },
  {
    type: 'heading',
    title: 'FINANCIAL',
  },
  {
    title: 'Billing',
    href: '/admin/billing/payments',
    icon: CreditCard,
  },
  {
    title: 'Reports',
    href: '/admin/reports',
    icon: FileText,
  },
];

function SidebarNav({ className, collapsed, onToggle, ...props }: SidebarNavProps) {
  const pathname = usePathname();
  const { user } = useAuthStore();
  
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
            <h2 className="text-lg font-semibold">Altitutor Admin</h2>
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
          href="/admin/settings"
          className={cn(
            "flex items-center gap-3 px-3 py-2 rounded-md text-sm transition-colors",
            pathname === '/admin/settings'
              ? "bg-brand-darkBlue text-white hover:bg-brand-mediumBlue dark:bg-brand-lightBlue dark:text-brand-dark-bg dark:hover:bg-brand-lightBlue/90" 
              : navHoverStyles,
            collapsed && "justify-center px-0"
          )}
        >
          <Settings className={cn("h-5 w-5", collapsed && "h-6 w-6")} />
          {!collapsed && <span>Settings</span>}
        </Link>
      </div>
    </div>
  );
}

export default function AdminLayout({
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
      <div className="flex-1 overflow-auto relative">
        {children}
        {/* Floating chat dock (admin-only) */}
        <ChatDock />
      </div>
    </div>
  );
}


