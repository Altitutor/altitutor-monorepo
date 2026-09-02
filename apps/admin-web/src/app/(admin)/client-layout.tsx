'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Users, Calendar, GraduationCap, Settings, FileText, Home, CreditCard, CheckSquare, AlertTriangle, FolderKanban } from 'lucide-react';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@altitutor/ui';
import { cn, navLinkActiveStyles, navLinkInactiveStyles } from '@/shared/utils/index';
import { ScrollArea } from '@altitutor/ui';
import { Beaker, Newspaper, ClipboardList, MessageCircle, Monitor, UserRound, TrendingUp, MessageSquareText } from 'lucide-react';
import { useQuickActions } from '@/shared/contexts/QuickActionsContext';
import { useQueryClient } from '@tanstack/react-query';
import { useToast } from '@altitutor/ui';
import { CheckInBookSessionModal } from '@/features/sessions/components/CheckInBookSessionModal';
import { payTiersKeys } from '@/features/pay-tiers/api/queryKeys';
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
import { Breadcrumb, AdminUrlSyncBoundary } from '@/shared/components';
import { useBreadcrumbs } from '@/shared/hooks/useBreadcrumbs';
import { useAdminShell } from '@/shared/contexts/AdminShellContext';
import { invalidateCheckInSurfaces } from '@/shared/lib/query-invalidation';
import { format } from 'date-fns';
import type { LucideIcon } from 'lucide-react';

interface SidebarNavProps extends React.HTMLAttributes<HTMLDivElement> {
  collapsed: boolean;
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
    title: 'Feedback',
    href: '/feedback',
    icon: MessageSquareText,
  },
  {
    type: 'heading',
    title: 'SCHEDULING',
  },
  {
    title: 'In-person Students',
    href: '/students',
    icon: GraduationCap,
  },
  {
    title: 'Online Students',
    href: '/online-students',
    icon: Monitor,
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
    title: 'Pay tiers',
    href: '/pay-tiers',
    icon: TrendingUp,
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
  const dragStartYRef = React.useRef<number | null>(null);
  const dragOffsetRef = React.useRef(0);
  const [dragOffset, setDragOffset] = useState(0);
  
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

  return (
    <>
      {/* Overlay */}
      {isOpen && (
        <div
          data-mobile-menu-overlay
          className="fixed inset-0 z-[70] bg-black/60 transition-opacity md:hidden"
          onClick={onClose}
        />
      )}
      
      <div
        className={cn(
          "fixed inset-x-0 bottom-0 z-[80] flex h-[88dvh] flex-col overflow-hidden rounded-t-3xl bg-card ring-1 ring-black/10 transition-transform duration-300 ease-out dark:ring-white/10 md:hidden",
          dragStartYRef.current != null && "transition-none",
          isOpen ? "translate-y-0" : "translate-y-full"
        )}
        style={isOpen && dragOffset > 0 ? { transform: `translateY(${dragOffset}px)` } : undefined}
      >
        <div className="flex flex-col h-full">
          <div
            className="flex h-14 touch-pan-y items-center border-b px-4"
            onTouchStart={handleTouchStart}
            onTouchMove={handleTouchMove}
            onTouchEnd={handleTouchEnd}
            onTouchCancel={handleTouchEnd}
          >
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
                    prefetch={false}
                    className={cn(
                      "flex items-center gap-3 px-3 py-2 rounded-md text-sm",
                      isNavItemActive(pathname, item)
                        ? navLinkActiveStyles
                        : navLinkInactiveStyles
                    )}
                  >
                    <Icon className="h-5 w-5" />
                    <span>{item.title}</span>
                  </Link>
                );
              })}
            </nav>
          </ScrollArea>
          
          <div className="border-t p-2">
            <Link 
              href="/settings"
              prefetch={false}
              className={cn(
                "flex items-center gap-3 px-3 py-2 rounded-md text-sm",
                pathname === '/settings'
                  ? navLinkActiveStyles
                  : navLinkInactiveStyles
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

function SidebarNav({ className, collapsed, ...props }: SidebarNavProps) {
  const pathname = usePathname();
  
  return (
    <div 
      className={cn(
        "hidden md:flex flex-col bg-card h-[calc(100dvh-var(--navbar-height))] transition-all duration-300",
        collapsed ? "w-[70px]" : "w-[250px]",
        className
      )} 
      {...props}
    >
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
            const link = (
              <Link
                key={item.href} 
                href={itemHref}
                prefetch={false}
                className={cn(
                  "flex items-center gap-3 px-3 py-2 rounded-md text-sm",
                  isNavItemActive(pathname, item)
                    ? navLinkActiveStyles
                    : navLinkInactiveStyles,
                  collapsed && "justify-center px-0"
                )}
              >
                <Icon className={cn("h-5 w-5", collapsed && "h-6 w-6")} />
                {!collapsed && (
                  <span className="whitespace-nowrap overflow-hidden">{item.title}</span>
                )}
              </Link>
            );

            if (!collapsed) {
              return link;
            }

            return (
              <TooltipProvider key={item.href} delayDuration={150}>
                <Tooltip>
                  <TooltipTrigger asChild>{link}</TooltipTrigger>
                  <TooltipContent side="right" sideOffset={10}>
                    {item.title}
                  </TooltipContent>
                </Tooltip>
              </TooltipProvider>
            );
          })}
        </nav>
      </ScrollArea>
      
      <div className="border-t p-2">
        {collapsed ? (
          <TooltipProvider delayDuration={150}>
            <Tooltip>
              <TooltipTrigger asChild>
                <Link
                  href="/settings"
                  prefetch={false}
                  className={cn(
                    "flex items-center gap-3 px-3 py-2 rounded-md text-sm",
                    pathname === '/settings'
                      ? navLinkActiveStyles
                      : navLinkInactiveStyles,
                    "justify-center px-0"
                  )}
                >
                  <Settings className="h-6 w-6" />
                  <span className="sr-only">Settings</span>
                </Link>
              </TooltipTrigger>
              <TooltipContent side="right" sideOffset={10}>
                Settings
              </TooltipContent>
            </Tooltip>
          </TooltipProvider>
        ) : (
          <Link 
          href="/settings"
          prefetch={false}
          className={cn(
            "flex items-center gap-3 px-3 py-2 rounded-md text-sm",
            pathname === '/settings'
              ? navLinkActiveStyles
              : navLinkInactiveStyles,
          )}
        >
          <Settings className="h-5 w-5" />
          <span className="whitespace-nowrap overflow-hidden">Settings</span>
          </Link>
        )}
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
    bookingPrefill,
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
  const { sidebarCollapsed: collapsed } = useAdminShell();
  const { isOpen: isMobileMenuOpen, close: closeMobileMenu } = useMobileMenu();
  const { isOpen: isCommandPaletteOpen, close: closeCommandPalette } = useCommandPalette();
  const { data: currentStaff } = useCurrentStaff();
  const breadcrumbs = useBreadcrumbs();
  const pathname = usePathname();
  const showBreadcrumbs = pathname !== '/messages';
  
  return (
    <>
      <MobileMenu isOpen={isMobileMenuOpen} onClose={closeMobileMenu} />
      <CommandPaletteModal
        isOpen={isCommandPaletteOpen}
        onClose={closeCommandPalette}
      />
      <div className="flex h-[calc(100dvh-var(--navbar-height))] overflow-hidden bg-card">
        <SidebarNav collapsed={collapsed} />
        <div className="min-w-0 flex-1 overflow-hidden">
          <div className="relative h-full overflow-auto rounded-tl-2xl rounded-tr-2xl bg-background ring-1 ring-border/70 md:rounded-tr-none">
            {showBreadcrumbs && (
              <div className="px-6 pt-6 pb-0">
                <Breadcrumb items={breadcrumbs} />
              </div>
            )}
            <AdminUrlSyncBoundary>{children}</AdminUrlSyncBoundary>
          </div>
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
                  initialPhone={bookingPrefill?.initialStaffPhone}
                />
              ) : (
                bookingSessionType && (
                  <BookSessionModal
                    isOpen={isBookingModalOpen}
                    onClose={closeBookingModal}
                    sessionType={bookingSessionType}
                    onBookingCreated={closeBookingModal}
                    initialStudentId={bookingPrefill?.initialStudentId}
                    initialCreateStudent={bookingPrefill?.createNewStudent}
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
                onCreated={(sessionId, staffIds) => {
                  void invalidateCheckInSurfaces(queryClient);
                  if (checkInSessionType === 'CHECK_IN') {
                    for (const staffId of staffIds) {
                      void queryClient.invalidateQueries({
                        queryKey: payTiersKeys.staffProgress(staffId),
                      });
                      void queryClient.invalidateQueries({
                        queryKey: payTiersKeys.staffCheckIns(staffId),
                      });
                    }
                    void queryClient.invalidateQueries({ queryKey: payTiersKeys.staffSummaries() });
                  }
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

export default function AdminClientLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <AdminLayoutContent>{children}</AdminLayoutContent>;
}
