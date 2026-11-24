'use client';
import { GoHintsContext, type PaletteModifier } from "@/shared/shortcuts/context";
import { GoHint } from "@/shared/shortcuts/GoHint";

import { AdminToolbarViewsProvider } from '@/features/quick-filters/components/ToolbarViewsService';
import { AdminShortcuts } from '@/shared/shortcuts/AdminShortcuts';
import { useUnreadConversationCount } from '@/features/messages/api/queries';
import { useUnreadMailCount } from '@/features/email/api/client';
import { ProfileMenu } from '@/shared/components/layouts/ProfileMenu';
import { MobileSidebar } from '@/shared/components/layouts/MobileSidebar';
import { adminPageHeaderClass } from "@/shared/components/adminPageHeaderStyle";
import { EmbeddedPaneEvents, PaneWorkspace, useEmbeddedPane } from "@/shared/components/pane-workspace/PaneWorkspace";

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
import { adminSidebarWidth, useAdminShell } from '@/shared/contexts/AdminShellContext';
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

const ActivePanePath = React.createContext<string | null>(null);

const isNavItemActive = (pathname: string, item: Extract<NavItem, { type?: "link" }>) =>
  pathname === item.href || pathname.startsWith(`${item.href}/`);

function useSectionExpanded(active: boolean) {
  const [expanded, setExpanded] = useState(active);
  useEffect(() => {
    if (active) setExpanded(true);
  }, [active]);
  return [expanded, () => setExpanded((current) => !current)] as const;
}

function childNavActive(
  pathname: string,
  childHref: string,
) {
  return pathname === childHref || pathname.startsWith(`${childHref}/`);
}

function SidebarSignals({
  href,
  label,
  collapsed = false,
  children,
}: {
  href: string;
  label: string;
  collapsed?: boolean;
  children?: React.ReactNode;
}) {
  return (
    <span className={collapsed ? "contents" : "ml-auto hidden shrink-0 items-center gap-1.5 has-[>span:not(:empty)]:flex"}>
      <span className={collapsed ? "absolute right-0.5 top-0 empty:hidden" : "inline-flex empty:hidden"}>
        {children}
      </span>
      <span className={collapsed ? "absolute bottom-0 left-0.5 empty:hidden" : "inline-flex empty:hidden"}>
        <GoHint href={href} label={label} />
      </span>
    </span>
  );
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
  const activePath = pathname.replace(/^\/invoices(?=\/|$)/, "/billing/invoices")
    .replace(/^\/notes(?=\/|$)/, "/documents");
  const active =
    activePath === item.href ||
    activePath.startsWith(`${item.href}/`) ||
    item.children.some((child) => childNavActive(activePath, child.href));
  const [expanded, toggleExpanded] = useSectionExpanded(active);
  const goHints = React.useContext(GoHintsContext);
  const Icon = item.icon;
  const queues = sidebarReconciliationQueues[item.href];

  if (collapsed) {
    return (
      <TooltipProvider delayDuration={0}>
        <Tooltip>
          <TooltipTrigger asChild>
            <Link
              href={item.href}
              aria-current={active ? "page" : undefined}
              prefetch={false}
              className={cn(
                "relative flex items-center justify-center rounded-md px-0 py-2 text-sm",
                active ? navLinkActiveStyles : navLinkInactiveStyles,
              )}
            >
              <Icon className="h-6 w-6" />
              <span className="sr-only">{item.title}</span>
              <SidebarSignals href={item.href} label={item.title} collapsed>
                {queues && <ReconciliationCountBadge queues={queues} counts={counts} className="text-[10px]" />}
              </SidebarSignals>
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
          className="flex min-w-0 flex-1 items-center gap-3 py-2 pl-3"
        >
          <Icon className="h-5 w-5 shrink-0" />
          <span className="truncate">{item.title}</span>
          <SidebarSignals href={item.href} label={item.title}>
            {queues && <ReconciliationCountBadge queues={queues} counts={counts} />}
          </SidebarSignals>
        </Link>
        <button
          type="button"
          aria-expanded={expanded}
          aria-label={
            expanded ? `Collapse ${item.title}` : `Expand ${item.title}`
          }
          className="mx-1 shrink-0 rounded p-1 text-muted-foreground hover:text-foreground"
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
      <SidebarExpandablePanel expanded={expanded || goHints}>
        <div className="ml-4 space-y-0.5 border-l border-border pl-2">
          {item.children.map((child) => (
            <Link
              key={child.href}
              href={child.href}
              aria-current={childNavActive(activePath, child.href) ? "page" : undefined}
              prefetch={false}
              className={cn(
                "flex items-center gap-2 rounded-md py-1.5 pl-2 pr-8 text-sm",
                childNavActive(activePath, child.href)
                  ? navLinkActiveStyles
                  : navLinkInactiveStyles,
              )}
            >
              <span className="truncate">{child.title}</span>
              <SidebarSignals href={child.href} label={child.title}>
                {sidebarReconciliationQueues[child.href] && <ReconciliationCountBadge queues={sidebarReconciliationQueues[child.href]} counts={counts} />}
              </SidebarSignals>
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
  const currentPath = usePathname();
  const pathname = React.useContext(ActivePanePath) ?? currentPath;
  const { data: unreadMessages = 0 } = useUnreadConversationCount();
  const { data: unreadMail = 0 } = useUnreadMailCount();
  const counts = useReconciliationCounts();
  const sections = groupNavItems(navItems);
  const goHints = React.useContext(GoHintsContext);

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
          goHints || collapsed ||
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
              aria-current={isNavItemActive(pathname, item) ? "page" : undefined}
              className={cn(
                "relative flex items-center gap-3 rounded-md py-2 pl-3 pr-8 text-sm",
                isNavItemActive(pathname, item)
                  ? navLinkActiveStyles
                  : navLinkInactiveStyles,
                collapsed && "justify-center pl-0 pr-0",
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
              <SidebarSignals href={itemHref} label={item.title} collapsed={collapsed}>
                {count > 0 ? (
                  <RedCountBadge
                    count={collapsed && count > 99 ? "99+" : count}
                    tooltip={`${count} ${countLabel}`}
                    className={collapsed ? "text-[10px]" : undefined}
                  />
                ) : sidebarReconciliationQueues[itemHref] ? (
                  <ReconciliationCountBadge queues={sidebarReconciliationQueues[itemHref]} counts={counts} className={collapsed ? "text-[10px]" : undefined} />
                ) : null}
              </SidebarSignals>
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
  const primaryPath = usePathname();
  const pathname = React.useContext(ActivePanePath) ?? primaryPath;
  if (isSettingsRoute(pathname))
    return <SettingsNavMenu collapsed={collapsed} activePath={pathname} />;
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
        "hidden h-full w-[var(--admin-sidebar-width)] shrink-0 flex-col bg-card md:flex",
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
  const embeddedPane = useEmbeddedPane();
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
    announcementStaffIds,
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
  const [activePanePath, setActivePanePath] = useState<string | null>(null);
  const [peerGoHintsActive, setPeerGoHintsActive] = useState(false);
  const [peerPaletteModifier, setPeerPaletteModifier] = useState<PaletteModifier>(null);
  const [tabsTarget, setTabsTarget] = useState<HTMLDivElement | null>(null);
  const showBreadcrumbs =
    pathname !== "/messages" &&
    pathname !== "/email" &&
    !/^\/(tasks|issues|projects|documents|notes|email)\/[^/]+$/.test(pathname) &&
    !/^\/subjects\/[^/]+\/topics\/[^/]+$/.test(pathname) &&
    !/^\/(students|parents|staff|classes|sessions|invoices|subjects|topics|admin-shifts)\/[^/]+$/.test(
      pathname,
    );

  const wrapWorkspace = (content: React.ReactNode) => embeddedPane
    ? content
    : <PaneWorkspace staffId={currentStaff?.id} tabsTarget={tabsTarget} onActivePathChange={setActivePanePath} onPeerGoHintsChange={setPeerGoHintsActive} onPeerPaletteChange={setPeerPaletteModifier}>{content}</PaneWorkspace>;

  return (
    <AdminToolbarViewsProvider>
      <AdminShortcuts peerGoHintsActive={peerGoHintsActive} peerPaletteModifier={peerPaletteModifier}>
        <ActivePanePath.Provider value={activePanePath}>
        <div className="flex h-dvh flex-col overflow-hidden bg-card" style={{ "--admin-sidebar-width": `${collapsed ? adminSidebarWidth.collapsed : adminSidebarWidth.expanded}px` } as React.CSSProperties}>
        {embeddedPane ? <EmbeddedPaneEvents /> : <Navbar tabsRef={setTabsTarget} />}
        <MobileMenu isOpen={isMobileMenuOpen} onClose={closeMobileMenu} />
        <CommandPaletteModal
          isOpen={isCommandPaletteOpen}
          onClose={closeCommandPalette}
        />
        <div data-admin-workspace-row data-admin-embedded-pane={embeddedPane || undefined} className="flex min-h-0 flex-1 overflow-hidden">
          {!embeddedPane && <SidebarNav collapsed={collapsed} />}
          {wrapWorkspace(
            <div className="flex h-full min-h-0 min-w-0 flex-1 flex-col overflow-hidden">
            <div
              data-admin-main
              className="relative flex h-full min-h-0 flex-1 flex-col overflow-hidden bg-background"
            >
              {showBreadcrumbs && (
                <div
                  data-admin-page-header
                  className={cn(adminPageHeaderClass, "flex-wrap")}
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
                  initialStaffIds={announcementStaffIds}
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
            </div>
          )}
        </div>
        </div>
        </ActivePanePath.Provider>
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
