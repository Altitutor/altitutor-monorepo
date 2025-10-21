'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Users, Calendar, GraduationCap, Settings, Menu, X, FileText, Home } from 'lucide-react';
import { Button } from '@altitutor/ui';
import { useAuthStore } from '@/shared/lib/supabase/auth';
import { cn, navHoverStyles } from '@/shared/utils/index';
import { ScrollArea } from '@altitutor/ui';
import { Beaker, Newspaper, ClipboardList, MessageCircle } from 'lucide-react';
import { ChatDock } from '@/features/messages/floating/ChatDock';

interface SidebarNavProps extends React.HTMLAttributes<HTMLDivElement> {
  collapsed: boolean;
  onToggle: () => void;
}

const navItems = [
  {
    title: 'Dashboard',
    href: '/admin/dashboard',
    icon: Home,
  },
  {
    title: 'Students',
    href: '/admin/dashboard/students',
    icon: GraduationCap,
  },
  {
    title: 'Staff',
    href: '/admin/dashboard/staff',
    icon: Users,
  },
  {
    title: 'Classes',
    href: '/admin/dashboard/classes',
    icon: Calendar,
  },
  {
    title: 'Subjects',
    href: '/admin/dashboard/subjects',
    icon: Beaker,
  },
  {
    title: 'Topics & Resources',
    href: '/admin/dashboard/topics',
    icon: Newspaper,
  },
  {
    title: 'Sessions',
    href: '/admin/dashboard/sessions',
    icon: ClipboardList,
  },
  {
    title: 'Communications',
    href: '/admin/dashboard/communications',
    icon: MessageCircle,
  },
  {
    title: 'Reports',
    href: '/admin/dashboard/reports',
    icon: FileText,
  },
  {
    title: 'Settings',
    href: '/admin/dashboard/settings',
    icon: Settings,
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
          {navItems.map((item) => (
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
              <item.icon className={cn("h-5 w-5", collapsed && "h-6 w-6")} />
              {!collapsed && <span>{item.title}</span>}
            </Link>
          ))}
        </nav>
      </ScrollArea>
      
      <div className="border-t dark:border-brand-dark-border p-4">
        {!collapsed ? (
          <Link href="/admin/dashboard/my-account" className="flex items-center gap-3 text-sm hover:bg-accent/10 rounded-md p-2 transition-colors">
            <div className="h-8 w-8 rounded-full bg-brand-lightBlue flex items-center justify-center text-brand-dark-bg">
              {(user?.user_metadata?.name as string)?.charAt(0) || user?.email?.charAt(0) || 'U'}
            </div>
            <div className="truncate">
              <p className="font-medium">{(user?.user_metadata?.name as string) || user?.email?.split('@')[0] || 'User'}</p>
              <p className="text-muted-foreground text-xs truncate">{user?.email || ''}</p>
            </div>
          </Link>
        ) : (
          <Link href="/admin/dashboard/my-account" className="flex justify-center hover:bg-accent rounded-md p-2 transition-colors">
            <div className="h-8 w-8 rounded-full bg-brand-lightBlue flex items-center justify-center text-brand-dark-bg">
              {(user?.user_metadata?.name as string)?.charAt(0) || user?.email?.charAt(0) || 'U'}
            </div>
          </Link>
        )}
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


