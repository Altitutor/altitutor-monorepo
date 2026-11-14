'use client';

import { AdminToolbarViewsProvider } from '@/features/quick-filters/components/ToolbarViewsService';
import { AdminShortcuts } from '@/shared/shortcuts/AdminShortcuts';
import { useUnreadConversationCount } from '@/features/messages/api/queries';
import { useUnreadMailCount } from '@/features/email/api/client';
import { ProfileMenu } from '@/shared/components/layouts/ProfileMenu';
import { MobileSidebar } from '@/shared/components/layouts/MobileSidebar';
import { AccessoryPanelLayout } from '@/shared/components/accessory-panel/AccessoryPanelLayout';

import React, { useState, useEffect, useMemo } from 'react';
import { AdminPageActionsTarget } from '@/shared/components/AdminPageActions';
import Link from 'next/link';
import { usePaneNavigation, accessoryDestination } from '@/shared/hooks/usePaneNavigation';
import { usePathname } from 'next/navigation';
import { ChevronDown } from 'lucide-react';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@altitutor/ui';
import { cn, navLinkActiveStyles, navLinkInactiveStyles } from '@/shared/utils/index';
import { ScrollArea } from '@altitutor/ui';
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
import { Breadcrumb, AdminUrlSyncBoundary, Navbar } from '@/shared/components';
import { useBreadcrumbs } from '@/shared/hooks/useBreadcrumbs';
import { useAdminShell } from '@/shared/contexts/AdminShellContext';
import { SettingsNavMenu } from '@/features/settings/SettingsNavMenu';
import { isSettingsRoute } from '@/features/settings/settings-nav';
import { invalidateCheckInSurfaces } from '@/shared/lib/query-invalidation';
import { useReconciliationCounts } from '@/features/reconciliation/api/useReconciliationCounts';
import { ReconciliationCountBadge } from '@/features/reconciliation/components/ReconciliationCountBadge';
import { reconciliationCountSummary, sidebarReconciliationQueues, type ReconciliationCounts } from '@/features/reconciliation/utils/countSummary';
import { RedCountBadge } from '@/shared/components/RedCountBadge';

interface SidebarNavProps extends React.HTMLAttributes<HTMLDivElement> {
  collapsed: boolean;
}

import { navItems, type NavItem } from '@/shared/constants/adminNavigation';

type NavLink = Extract<NavItem, { type?: 'link' }>;

type NavSection = {
  title: string | null;
  items: NavLink[];
};

function groupNavItems(items: NavItem[]): NavSection[] {
  const sections: NavSection[] = [];
  let current: NavSection = { title: null, items: [] };
  for (const item of items) {
    if (item.type === 'heading') {
      sections.push(current);
      current = { title: item.title, items: [] };
    } else {
      current.items.push(item);
    }
  }
  sections.push(current);
  return sections.filter((section) => section.title !== null || section.items.length > 0);
}

function SidebarExpandablePanel({
  expanded,
  children,
}: {
  expanded: boolean;
  children: React.ReactNode;
}) {
  return (
    <div
      className={cn(
        'grid transition-[grid-template-rows] duration-200 ease-out motion-reduce:transition-none',
        expanded ? 'grid-rows-[1fr]' : 'grid-rows-[0fr]',
      )}
    >
      <div className="min-h-0 overflow-hidden" inert={!expanded}>
        <div className="flex flex-col gap-1">{children}</div>
      </div>
    </div>
  );
}

function NavSectionHeading({ title }: { title: string }) {
  const { collapsedGroups, toggleGroup } = useAdminShell();
  const expanded = !collapsedGroups.includes(title);
  return (
    <button
      type="button"
      aria-expanded={expanded}
      onClick={() => toggleGroup(title)}
      className={cn(
        'mt-2 flex w-full items-center justify-between rounded-md px-3 py-2 text-xs font-semibold text-muted-foreground hover:text-foreground',
        navLinkInactiveStyles,
      )}
    >
      <span>{title}</span>
      <ChevronDown
        className={cn('h-3 w-3 transition-transform duration-200', !expanded && '-rotate-90')}
      />
    </button>
  );
}

const isNavItemActive = (
  pathname: string,
  item: Extract<NavItem, { type?: "link" }>,
) => {
  if (item.title === "Dashboard") {
    return pathname === "/dashboard" || pathname.startsWith("/dashboard/");
  }
  if (item.href.startsWith("/ucat/")) {
    return pathname === item.href || pathname.startsWith(`${item.href}/`);
  }
  return pathname === item.href;
};

function useSectionExpanded(pathname: string, href: string) {
  const [expanded, setExpanded] = useState(() => pathname.startsWith(href));
  useEffect(() => {
    if (pathname === href || pathname.startsWith(`${href}/`)) {
      setExpanded(true);
    }
  }, [href, pathname]);
  return [expanded, () => setExpanded((current) => !current)] as const;
}

function childNavActive(
  pathname: string,
  parentHref: string,
  childHref: string,
) {
  if (childHref === parentHref) return pathname === parentHref;
  return pathname === childHref || pathname.startsWith(`${childHref}/`);
}

function ExpandableNavGroup({
  item,
  pathname,
  collapsed = false,
  counts,
}: {
  item: Extract<NavItem, { type?: "link" }> & {
    children: { title: string; href: string }[];
  };
  pathname: string;
  collapsed?: boolean;
  counts: ReconciliationCounts;
}) {
  const activePath = item.href === '/billing' && pathname.startsWith('/invoices/') ? '/billing/invoices' : pathname;
  const [expanded, toggleExpanded] = useSectionExpanded(activePath, item.href);
  const active = activePath === item.href || activePath.startsWith(`${item.href}/`);
  const Icon = item.icon;
  const queues = sidebarReconciliationQueues[item.href];

  if (collapsed) {
    return (
      <TooltipProvider delayDuration={0}>
        <Tooltip>
          <TooltipTrigger asChild>
            <Link
              href={item.href}
              prefetch={false}
              className={cn(
                "relative flex items-center justify-center rounded-md px-0 py-2 text-sm",
                active ? navLinkActiveStyles : navLinkInactiveStyles,
              )}
            >
              <Icon className="h-6 w-6" />
              <span className="sr-only">{item.title}</span>
              {queues && <ReconciliationCountBadge queues={queues} counts={counts} className="absolute right-0.5 top-0 text-[10px]" />}
            </Link>
          </TooltipTrigger>
          <TooltipContent side="right" sideOffset={10} className="max-w-sm whitespace-pre-line">
            {queues ? `${item.title}\n${reconciliationCountSummary(queues, counts).tooltip}` : item.title}
          </TooltipContent>
        </Tooltip>
      </TooltipProvider>
    );
  }

  return (
    <div className="space-y-0.5">
      <div
        className={cn(
          "flex items-center rounded-md text-sm",
          active ? navLinkActiveStyles : navLinkInactiveStyles,
        )}
      >
        <Link
          href={item.href}
          prefetch={false}
          className="flex min-w-0 flex-1 items-center gap-3 px-3 py-2"
        >
          <Icon className="h-5 w-5 shrink-0" />
          <span className="truncate">{item.title}</span>
          {queues && <ReconciliationCountBadge queues={queues} counts={counts} className="ml-auto" />}
        </Link>
        <button
          type="button"
          aria-expanded={expanded}
          aria-label={
            expanded ? `Collapse ${item.title}` : `Expand ${item.title}`
          }
          className="mr-1 rounded p-1 text-muted-foreground hover:text-foreground"
          onClick={toggleExpanded}
        >
          <ChevronDown
            className={cn(
              "h-4 w-4 transition-transform duration-200",
              expanded ? "rotate-0" : "-rotate-90",
            )}
          />
        </button>
      </div>
      <SidebarExpandablePanel expanded={expanded}>
        <div className="ml-4 space-y-0.5 border-l border-border pl-2">
          {item.children.map((child) => (
            <Link
              key={child.href}
              href={child.href}
              prefetch={false}
              className={cn(
                "flex items-center rounded-md px-2 py-1.5 text-sm",
                childNavActive(activePath, item.href, child.href)
                  ? navLinkActiveStyles
                  : navLinkInactiveStyles,
              )}
            >
              {child.title}
              {sidebarReconciliationQueues[child.href] && <ReconciliationCountBadge queues={sidebarReconciliationQueues[child.href]} counts={counts} className="ml-auto" />}
            </Link>
          ))}
        </div>
      </SidebarExpandablePanel>
    </div>
  );
}

function AdminNavMenu({
  collapsed = false,
  onAccessoryNavigate,
}: {
  collapsed?: boolean;
  onAccessoryNavigate?: () => void;
}) {
  const { router: paneRouter } = usePaneNavigation();
  const { collapsedGroups } = useAdminShell();
  const pathname = usePathname();
  const { data: unreadMessages = 0 } = useUnreadConversationCount();
  const { data: unreadMail = 0 } = useUnreadMailCount();
  const counts = useReconciliationCounts();
  const sections = groupNavItems(navItems);

  const openAccessory = (event: React.MouseEvent, href: string) => {
    if (!accessoryDestination(href)) return;
    event.preventDefault();
    paneRouter.push(href);
    onAccessoryNavigate?.();
  };

  return (
    <>
      {sections.map((section) => {
        const sectionExpanded =
          collapsed ||
          !section.title ||
          !collapsedGroups.includes(section.title);
        const links = section.items.map((item) => {
          const Icon = item.icon;
          const itemHref = item.href;
          if (item.children?.length) {
            return (
              <ExpandableNavGroup
                key={item.href}
                item={{ ...item, children: item.children }}
                pathname={pathname}
                collapsed={collapsed}
                counts={counts}
              />
            );
          }

          const count = item.href === "/messages" ? unreadMessages : item.href === "/email" ? unreadMail : 0;
          const countLabel = item.href === "/messages"
            ? (count === 1 ? "unread conversation" : "unread conversations")
            : (count === 1 ? "unread Inbox email" : "unread Inbox emails");
          const linkLabel = count > 0 ? `${item.title}, ${count} ${countLabel}` : item.title;
          const link = (
            <Link
              href={itemHref}
              onClick={(event) => openAccessory(event, itemHref)}
              prefetch={false}
              aria-label={linkLabel}
              className={cn(
                "relative flex items-center gap-3 rounded-md px-3 py-2 text-sm",
                isNavItemActive(pathname, item)
                  ? navLinkActiveStyles
                  : navLinkInactiveStyles,
                collapsed && "justify-center px-0",
              )}
            >
              <Icon className={cn("size-5 shrink-0", collapsed && "size-6")} aria-hidden />
              {collapsed ? (
                <span className="sr-only">{item.title}</span>
              ) : (
                <span className="overflow-hidden whitespace-nowrap">
                  {item.title}
                </span>
              )}
              {count > 0 ? (
                <RedCountBadge
                  count={collapsed && count > 99 ? '99+' : count}
                  tooltip={`${count} ${countLabel}`}
                  className={cn(
                    collapsed ? "absolute right-0.5 top-0 text-[10px]" : "ml-auto",
                  )}
                />
              ) : sidebarReconciliationQueues[itemHref] ? <ReconciliationCountBadge queues={sidebarReconciliationQueues[itemHref]} counts={counts} className={collapsed ? "absolute right-0.5 top-0 text-[10px]" : "ml-auto"} /> : null}
            </Link>
          );

          if (!collapsed) {
            return <React.Fragment key={item.href}>{link}</React.Fragment>;
          }

          return (
            <TooltipProvider key={item.href} delayDuration={0}>
              <Tooltip>
                <TooltipTrigger asChild>{link}</TooltipTrigger>
                <TooltipContent side="right" sideOffset={10} className="max-w-sm whitespace-pre-line">
                  {sidebarReconciliationQueues[itemHref] ? `${item.title}\n${reconciliationCountSummary(sidebarReconciliationQueues[itemHref], counts).tooltip}` : linkLabel}
                </TooltipContent>
              </Tooltip>
            </TooltipProvider>
          );
        });

        return (
          <div key={section.title ?? "root"} className="flex flex-col gap-1">
            {section.title ? (
              collapsed ? (
                <div className="my-2 h-px bg-border" />
              ) : (
                <NavSectionHeading title={section.title} />
              )
            ) : null}
            {collapsed || !section.title ? (
              links
            ) : (
              <SidebarExpandablePanel expanded={sectionExpanded}>
                {links}
              </SidebarExpandablePanel>
            )}
          </div>
        );
      })}
    </>
  );
}

function ShellNav({
  collapsed = false,
  onAccessoryNavigate,
}: {
  collapsed?: boolean;
  onAccessoryNavigate?: () => void;
}) {
  const pathname = usePathname();
  if (isSettingsRoute(pathname))
    return <SettingsNavMenu collapsed={collapsed} />;
  return (
    <AdminNavMenu
      collapsed={collapsed}
      onAccessoryNavigate={onAccessoryNavigate}
    />
  );
}

function MobileMenu({
  isOpen,
  onClose,
}: {
  isOpen: boolean;
  onClose: () => void;
}) {
  return (
    <MobileSidebar isOpen={isOpen} onClose={onClose}>
      <ScrollArea className="min-h-0 flex-1">
        <nav className="flex flex-col gap-1 p-2">
          <ShellNav onAccessoryNavigate={onClose} />
        </nav>
      </ScrollArea>
      <div className="border-t p-2">
        <ProfileMenu onNavigate={onClose} />
      </div>
    </MobileSidebar>
  );
}

function SidebarNav({ className, collapsed, ...props }: SidebarNavProps) {
  return (
    <div
      data-admin-sidebar
      className={cn(
        "hidden md:flex shrink-0 flex-col bg-card h-[calc(100dvh-var(--navbar-height))] transition-all duration-300",
        collapsed ? "w-[70px]" : "w-[250px]",
        className,
      )}
      {...props}
    >
      <ScrollArea className="flex-1">
        <nav className="flex flex-col gap-1 p-2">
          <ShellNav collapsed={collapsed} />
        </nav>
      </ScrollArea>

      <div className="border-t p-2">
        <ProfileMenu collapsed={collapsed} />
      </div>
    </div>
  );
}

function AdminLayoutContent({ children }: { children: React.ReactNode }) {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const {
    bookingSessionType,
    isBookingModalOpen,
    bookingPrefill,
    closeBookingModal,
    taskReference,
    issueReference,
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
    announcementStudentIds,
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
  const { isOpen: isCommandPaletteOpen, close: closeCommandPalette } =
    useCommandPalette();
  const { data: currentStaff } = useCurrentStaff();
  const breadcrumbs = useBreadcrumbs();
  const pathname = usePathname();
  const [actionsTarget, setActionsTarget] = useState<HTMLDivElement | null>(
    null,
  );
  const [secondaryActionsTarget, setSecondaryActionsTarget] =
    useState<HTMLDivElement | null>(null);
  const actionTargets = useMemo(
    () => ({ primary: actionsTarget, secondary: secondaryActionsTarget }),
    [actionsTarget, secondaryActionsTarget],
  );
  const showBreadcrumbs =
    !/^\/(students|parents|staff|classes|sessions|invoices|subjects|topics|admin-shifts)\/[^/]+$/.test(
      pathname,
    );

  return (
    <AdminToolbarViewsProvider>
      <AdminShortcuts>
        <Navbar />
        <MobileMenu isOpen={isMobileMenuOpen} onClose={closeMobileMenu} />
        <CommandPaletteModal
          isOpen={isCommandPaletteOpen}
          onClose={closeCommandPalette}
        />
        <div className="mt-[var(--navbar-height)] flex h-[calc(100dvh-var(--navbar-height))] overflow-hidden bg-card">
          <SidebarNav collapsed={collapsed} />
          <AccessoryPanelLayout>
            <div
              data-admin-main
              className="relative flex h-full min-h-0 flex-col overflow-hidden rounded-tl-2xl rounded-tr-2xl bg-background ring-1 ring-border/70"
            >
              {showBreadcrumbs && (
                <div
                  data-admin-page-header
                  className="flex min-h-16 shrink-0 flex-wrap items-center justify-between gap-3 border-b px-6 py-3"
                >
                  <Breadcrumb
                    items={breadcrumbs}
                    className="mb-0 min-w-0 flex-1"
                  />
                  <div
                    ref={setSecondaryActionsTarget}
                    className="flex max-w-full flex-wrap items-center gap-2"
                  />
                  <div
                    ref={setActionsTarget}
                    className="flex max-w-full flex-wrap items-center justify-end gap-2"
                  />
                </div>
              )}
              <div className="flex min-h-0 flex-1 flex-col overflow-auto">
                <AdminPageActionsTarget.Provider value={actionTargets}>
                  <AdminUrlSyncBoundary>{children}</AdminUrlSyncBoundary>
                </AdminPageActionsTarget.Provider>
              </div>
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
                  initialStudentIds={announcementStudentIds}
                  onClose={closeAnnouncementsModal}
                />
                {bookingSessionType === "STAFF_INTERVIEW" ? (
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
                  reference={taskReference}
                  isOpen={isCreateTaskDialogOpen}
                  onClose={closeCreateTaskDialog}
                />
                <CreateIssueDialog
                  reference={issueReference}
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
                    if (checkInSessionType === "CHECK_IN") {
                      for (const staffId of staffIds) {
                        void queryClient.invalidateQueries({
                          queryKey: payTiersKeys.staffProgress(staffId),
                        });
                        void queryClient.invalidateQueries({
                          queryKey: payTiersKeys.staffCheckIns(staffId),
                        });
                      }
                      void queryClient.invalidateQueries({
                        queryKey: payTiersKeys.staffSummaries(),
                      });
                    }
                    closeCheckInModal();
                    toast({
                      title:
                        checkInSessionType === "ADMIN_MEETING"
                          ? "Admin meeting scheduled"
                          : "Check-in scheduled",
                      description: "Session was created.",
                      action: {
                        label: "View session",
                        onClick: () =>
                          window.dispatchEvent(
                            new CustomEvent("open-session-modal", {
                              detail: { id: sessionId },
                            }),
                          ),
                      },
                      duration: 12_000,
                    });
                  }}
                />
              </>
            )}
          </AccessoryPanelLayout>
        </div>
      </AdminShortcuts>
    </AdminToolbarViewsProvider>
  );
}

export default function AdminClientLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <AdminLayoutContent>{children}</AdminLayoutContent>;
}
