'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Users, Calendar, GraduationCap, Settings, FileText, Home, CreditCard, Clock, Ban } from 'lucide-react';
import { Button, AnimatedHamburgerIcon } from '@altitutor/ui';
import { cn, navHoverStyles } from '@/shared/utils/index';
import { ScrollArea } from '@altitutor/ui';
import { Beaker, Newspaper, ClipboardList, MessageCircle, LayoutGrid } from 'lucide-react';
import dynamic from 'next/dynamic';
import { QuickActionsProvider, useQuickActions } from '@/shared/contexts/QuickActionsContext';
import { QuickActionsMenu } from '@/shared/components/QuickActionsMenu';
import { LogSessionModal } from '@/features/tutor-logs';
import { LogAbsenceDialog, LogStaffAbsenceDialog } from '@/features/sessions';
import { AnnouncementsModal } from '@/features/messages/components/announcements/AnnouncementsModal';
import { useCurrentStaff } from '@/features/staff/hooks/useStaffQuery';
import { useMobileMenu } from '@/shared/contexts/MobileMenuContext';
import { Breadcrumb } from '@/shared/components';
import { useBreadcrumbs } from '@/shared/hooks/useBreadcrumbs';

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
    type: 'heading',
    title: 'MESSAGING',
  },
  {
    title: 'Messages',
    href: '/messages',
    icon: MessageCircle,
  },
  {
    type: 'heading',
    title: 'FINANCIAL',
  },
  {
    title: 'Invoices',
    href: '/invoices',
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
];

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
            <h2 className="text-lg font-semibold">Altitutor Admin</h2>
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
              href="/settings"
              className={cn(
                "flex items-center gap-3 px-3 py-2 rounded-md text-sm transition-colors",
                pathname === '/settings'
                  ? "bg-brand-darkBlue text-white hover:bg-brand-mediumBlue dark:bg-brand-lightBlue dark:text-brand-dark-bg dark:hover:bg-brand-lightBlue/90" 
                  : navHoverStyles
              )}
            >
              <Settings className="h-5 w-5" />
              <span>Settings</span>
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
  const { isOpen: isMobileMenuOpen, close: closeMobileMenu } = useMobileMenu();
  const { isTutorLogModalOpen, isLogAbsenceDialogOpen, isLogStaffAbsenceDialogOpen, isAnnouncementsModalOpen, closeTutorLogModal, closeLogAbsenceDialog, closeLogStaffAbsenceDialog, closeAnnouncementsModal } = useQuickActions();
  const { data: currentStaff } = useCurrentStaff();
  const breadcrumbs = useBreadcrumbs();
  
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
    <>
      <MobileMenu isOpen={isMobileMenuOpen} onClose={closeMobileMenu} />
      <div className="flex h-[calc(100vh-var(--navbar-height))] overflow-hidden">
        <SidebarNav collapsed={collapsed} onToggle={toggleSidebar} />
        <div className="flex-1 overflow-auto relative">
          <div className="px-6 pt-6 pb-0">
            <Breadcrumb items={breadcrumbs} />
          </div>
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
              <AnnouncementsModal
                isOpen={isAnnouncementsModalOpen}
                onClose={closeAnnouncementsModal}
              />
            </>
          )}
        </div>
      </div>
    </>
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

