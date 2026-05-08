'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Users, Calendar, GraduationCap, Settings, FileText, Home, CreditCard, CheckSquare, AlertTriangle, FolderKanban, Layers } from 'lucide-react';
import { Button, AnimatedHamburgerIcon } from '@altitutor/ui';
import { cn, navHoverStyles } from '@/shared/utils/index';
import { ScrollArea } from '@altitutor/ui';
import { Beaker, Newspaper, ClipboardList, MessageCircle, UserRound } from 'lucide-react';
import { useQuickActions } from '@/shared/contexts/QuickActionsContext';
import { useQueryClient } from '@tanstack/react-query';
import { useToast } from '@altitutor/ui';
import { CheckInBookSessionModal } from '@/features/sessions/components/CheckInBookSessionModal';
import { sessionsKeys } from '@/features/sessions/hooks/useSessionsQuery';
import { reconciliationKeys } from '@/features/reconciliation/api/queryKeys';
import { CommandPaletteModal } from '@/features/command-palette/components/CommandPaletteModal';
import { useCommandPalette } from '@/shared/contexts/CommandPaletteContext';
import { LogSessionModal } from '@/features/tutor-logs';
import { LogAbsenceDialog, LogStaffAbsenceDialog } from '@/features/sessions';
import { AnnouncementsModal } from '@/features/messages/components/announcements/AnnouncementsModal';
import { BookSessionModal } from '@/features/bookings/components';
import { StaffInterviewBookSessionModal } from '@/features/bookings/components/staff-interview/StaffInterviewBookSessionModal';
import { CreateTaskDialog } from '@/features/tasks/components/CreateTaskDialog';
import { CreateIssueDialog } from '@/features/issues/components/CreateIssueDialog';
import { CreateProjectDialog } from '@/features/projects/components/CreateProjectDialog';
import { useCurrentStaff } from '@/shared/hooks';
import { useMobileMenu } from '@/shared/contexts/MobileMenuContext';
import { Breadcrumb } from '@/shared/components';
import { useBreadcrumbs } from '@/shared/hooks/useBreadcrumbs';
import { format } from 'date-fns';
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
    title: 'OPERATIONS',
  },
  {
    title: 'Tasks',
    href: '/tasks',
    icon: CheckSquare,
  },
  {
    title: 'Issues',
    href: '/issues',
    icon: AlertTriangle,
  },
  {
    title: 'Projects',
    href: '/projects',
    icon: FolderKanban,
  },
  {
    title: 'Reconciliation',
    href: '/reconciliation',
    icon: AlertTriangle,
  },
  {
    title: 'Documents',
    href: '/documents',
    icon: FileText,
  },
  {
    type: 'heading',
    title: 'COMMUNICATION',
  },
  {
    title: 'Messages',
    href: '/messages',
    icon: MessageCircle,
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
    title: 'Parents',
    href: '/parents',
    icon: UserRound,
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
    title: 'Admin Shifts',
    href: '/admin-shifts',
    icon: Calendar,
  },
  {
    title: 'Sessions',
    href: '/sessions',
    icon: ClipboardList,
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
    title: 'Tutor logs',
    href: '/tutor-logs',
    icon: ClipboardList,
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
  {
    title: 'Online access',
    href: '/manual-online-access',
    icon: Layers,
  },
];

const getTodayDashboardHref = () => `/dashboard/${format(new Date(), 'yyyy-MM-dd')}`;

const getNavItemHref = (item: Extract<NavItem, { type?: 'link' }>) => {
  if (item.title === 'Dashboard') {
    return getTodayDashboardHref();
  }
  return item.href;
};

const isNavItemActive = (pathname: string, item: Extract<NavItem, { type?: 'link' }>) => {
  if (item.title === 'Dashboard') {
    return pathname === '/dashboard' || pathname.startsWith('/dashboard/');
  }
  if (item.href.startsWith('/ucat/')) {
    return pathname === item.href || pathname.startsWith(`${item.href}/`);
  }
  return pathname === item.href;
};

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
                const itemHref = getNavItemHref(item);
                return (
                  <Link 
                    key={item.href} 
                    href={itemHref}
                    className={cn(
                      "flex items-center gap-3 px-3 py-2 rounded-md text-sm transition-colors",
                      isNavItemActive(pathname, item)
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
        "hidden md:flex flex-col border-r bg-background dark:bg-brand-dark-bg dark:border-brand-dark-border h-[calc(100dvh-var(--navbar-height))] transition-all duration-300",
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
            <h2 className="text-lg font-semibold whitespace-nowrap">Altitutor Admin</h2>
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
                  {!collapsed && (
                    <span className="whitespace-nowrap overflow-hidden">{item.title}</span>
                  )}
                  {collapsed && <div className="h-px bg-border" />}
                </div>
              );
            }
            
            const Icon = item.icon;
            const itemHref = getNavItemHref(item);
            return (
              <Link 
                key={item.href} 
                href={itemHref}
                className={cn(
                  "flex items-center gap-3 px-3 py-2 rounded-md text-sm transition-colors",
                  isNavItemActive(pathname, item)
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
          {!collapsed && (
            <span className="whitespace-nowrap overflow-hidden">Settings</span>
          )}
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
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const {
    bookingSessionType,
    isBookingModalOpen,
    closeBookingModal,
    isCreateTaskDialogOpen,
    closeCreateTaskDialog,
    isCreateIssueDialogOpen,
    closeCreateIssueDialog,
    isCreateProjectDialogOpen,
    closeCreateProjectDialog,
    isTutorLogModalOpen,
    isLogAbsenceDialogOpen,
    isLogStaffAbsenceDialogOpen,
    isAnnouncementsModalOpen,
    closeTutorLogModal,
    closeLogAbsenceDialog,
    closeLogStaffAbsenceDialog,
    closeAnnouncementsModal,
    isCheckInModalOpen,
    checkInSessionType,
    checkInPrefill,
    closeCheckInModal,
  } = useQuickActions();
  const [collapsed, setCollapsed] = useState(false);
  const { isOpen: isMobileMenuOpen, close: closeMobileMenu } = useMobileMenu();
  const { isOpen: isCommandPaletteOpen, close: closeCommandPalette } = useCommandPalette();
  const { data: currentStaff } = useCurrentStaff();
  const breadcrumbs = useBreadcrumbs();
  const pathname = usePathname();
  const showBreadcrumbs = pathname !== '/messages';
  
  const toggleSidebar = () => {
    setCollapsed(!collapsed);
  };
  
  return (
    <>
      <MobileMenu isOpen={isMobileMenuOpen} onClose={closeMobileMenu} />
      <CommandPaletteModal
        isOpen={isCommandPaletteOpen}
        onClose={closeCommandPalette}
      />
      <div className="flex h-[calc(100dvh-var(--navbar-height))] overflow-hidden">
        <SidebarNav collapsed={collapsed} onToggle={toggleSidebar} />
        <div className="flex-1 overflow-auto relative">
          {showBreadcrumbs && (
            <div className="px-6 pt-6 pb-0">
              <Breadcrumb items={breadcrumbs} />
            </div>
          )}
          {children}
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
              {bookingSessionType === 'STAFF_INTERVIEW' ? (
                <StaffInterviewBookSessionModal
                  isOpen={isBookingModalOpen}
                  onClose={closeBookingModal}
                  onBookingCreated={closeBookingModal}
                />
              ) : (
                bookingSessionType && (
                  <BookSessionModal
                    isOpen={isBookingModalOpen}
                    onClose={closeBookingModal}
                    sessionType={bookingSessionType}
                    onBookingCreated={closeBookingModal}
                  />
                )
              )}
              <CreateTaskDialog
                isOpen={isCreateTaskDialogOpen}
                onClose={closeCreateTaskDialog}
              />
              <CreateIssueDialog
                isOpen={isCreateIssueDialogOpen}
                onClose={closeCreateIssueDialog}
              />
              <CreateProjectDialog
                isOpen={isCreateProjectDialogOpen}
                onClose={closeCreateProjectDialog}
              />
              <CheckInBookSessionModal
                isOpen={isCheckInModalOpen}
                onClose={closeCheckInModal}
                sessionType={checkInSessionType}
                initialPrefill={checkInPrefill}
                onCreated={(sessionId) => {
                  void queryClient.invalidateQueries({ queryKey: sessionsKeys.all });
                  void queryClient.invalidateQueries({ queryKey: reconciliationKeys.familyCheckIns() });
                  closeCheckInModal();
                  toast({
                    title:
                      checkInSessionType === 'ADMIN_MEETING'
                        ? 'Admin meeting scheduled'
                        : 'Check-in scheduled',
                    description: 'Session was created.',
                    action: {
                      label: 'View session',
                      onClick: () =>
                        window.dispatchEvent(
                          new CustomEvent('open-session-modal', { detail: { id: sessionId } })
                        ),
                    },
                    duration: 12_000,
                  });
                }}
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
  return <AdminLayoutContent>{children}</AdminLayoutContent>;
}
