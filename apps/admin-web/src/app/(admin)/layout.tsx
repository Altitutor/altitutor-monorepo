'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Users, Calendar, GraduationCap, Settings, Menu, X, FileText, Home, CreditCard, MessageSquarePlus, Clock, Ban } from 'lucide-react';
import { Button } from '@altitutor/ui';
import { cn, navHoverStyles } from '@/shared/utils/index';
import { ScrollArea } from '@altitutor/ui';
import { Beaker, Newspaper, ClipboardList, MessageCircle, LayoutGrid } from 'lucide-react';
import dynamic from 'next/dynamic';
import { QuickActionsProvider, useQuickActions } from '@/shared/contexts/QuickActionsContext';
import { QuickActionsMenu } from '@/shared/components/QuickActionsMenu';
import { LogSessionModal } from '@/features/tutor-logs';
import { LogAbsenceDialog, LogStaffAbsenceDialog } from '@/features/sessions';
import { useCurrentStaff } from '@/features/staff/hooks/useStaffQuery';

const ChatDock = dynamic(() => import('@/features/messages/floating/ChatDock').then(mod => ({ default: mod.ChatDock })), {
  ssr: false,
});
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
    title: 'Students',
    href: '/students',
    icon: GraduationCap,
  },
  {
    title: 'Staff',
    href: '/staff',
    icon: Users,
  },
  {
    title: 'Classes',
    href: '/classes',
    icon: Calendar,
  },
  {
    title: 'Sessions',
    href: '/sessions',
    icon: ClipboardList,
  },
  {
    title: 'Class Planner',
    href: '/class-planner',
    icon: LayoutGrid,
  },
  {
    title: 'Opening Hours',
    href: '/settings/opening-hours',
    icon: Clock,
  },
  {
    title: 'Blockout Dates',
    href: '/settings/blockouts',
    icon: Ban,
  },
  {
    type: 'heading',
    title: 'COMMUNICATIONS',
  },
  {
    title: 'Communications',
    href: '/communications',
    icon: MessageCircle,
  },
  {
    title: 'Bulk Messaging',
    href: '/communications/bulk',
    icon: MessageSquarePlus,
  },
  {
    title: 'Templates',
    href: '/communications/templates',
    icon: FileText,
  },
  {
    type: 'heading',
    title: 'FINANCIAL',
  },
  {
    title: 'Billing',
    href: '/billing/payments',
    icon: CreditCard,
  },
  {
    title: 'Reports',
    href: '/reports',
    icon: FileText,
  },
  {
    type: 'heading',
    title: 'RESOURCES',
  },
  {
    title: 'Subjects',
    href: '/subjects',
    icon: Beaker,
  },
  {
    title: 'Topics',
    href: '/topics',
    icon: Newspaper,
  },
];

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
          href="/settings"
          className={cn(
            "flex items-center gap-3 px-3 py-2 rounded-md text-sm transition-colors",
            pathname === '/settings'
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

function AdminLayoutContent({
  children,
}: {
  children: React.ReactNode;
}) {
  const [collapsed, setCollapsed] = useState(false);
  const { isTutorLogModalOpen, isLogAbsenceDialogOpen, isLogStaffAbsenceDialogOpen, closeTutorLogModal, closeLogAbsenceDialog, closeLogStaffAbsenceDialog } = useQuickActions();
  const { data: currentStaff } = useCurrentStaff();
  
  // #region agent log
  useEffect(() => {
    if (currentStaff) {
      fetch('http://127.0.0.1:7242/ingest/03d835b2-9f2b-42e2-a795-53809de736bc',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'layout.tsx:214',message:'Current staff record before passing to dialog',data:{currentStaff:{id:currentStaff.id,role:currentStaff.role,status:currentStaff.status}},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'B'})}).catch(()=>{});
    }
  }, [currentStaff]);
  // #endregion
  
  const toggleSidebar = () => {
    setCollapsed(!collapsed);
  };
  
  return (
    <div className="flex h-[calc(100vh-var(--navbar-height))] overflow-hidden">
      <SidebarNav collapsed={collapsed} onToggle={toggleSidebar} />
      <div className="flex-1 overflow-auto relative">
        {children}
        {/* Floating quick actions menu */}
        <QuickActionsMenu />
        {/* Floating chat dock (admin-only) */}
        <ChatDock />
        {/* Quick action modals */}
        {currentStaff?.id && (
          <>
            <LogSessionModal
              isOpen={isTutorLogModalOpen}
              onClose={closeTutorLogModal}
              currentStaffId={currentStaff.id}
              adminMode={true}
            />
            <LogAbsenceDialog
              isOpen={isLogAbsenceDialogOpen}
              onClose={closeLogAbsenceDialog}
              staffId={currentStaff.id}
            />
            <LogStaffAbsenceDialog
              isOpen={isLogStaffAbsenceDialogOpen}
              onClose={closeLogStaffAbsenceDialog}
              staffId={currentStaff.id}
            />
          </>
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
  return (
    <QuickActionsProvider>
      <AdminLayoutContent>{children}</AdminLayoutContent>
    </QuickActionsProvider>
  );
}

