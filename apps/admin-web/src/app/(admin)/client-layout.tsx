"use client";

import { ProfileMenu } from "@/shared/components/layouts/ProfileMenu";
import { AccessoryPanelLayout } from "@/shared/components/accessory-panel/AccessoryPanelLayout";

import React, { useState, useEffect } from "react";
import Link from "next/link";
import {
  usePaneNavigation,
  accessoryDestination,
} from "@/shared/hooks/usePaneNavigation";
import { usePathname } from "next/navigation";
import {
  Users,
  Calendar,
  GraduationCap,
  FileText,
  Home,
  CreditCard,
  AlertTriangle,
  ChevronDown,
} from "lucide-react";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@altitutor/ui";
import {
  cn,
  navLinkActiveStyles,
  navLinkInactiveStyles,
} from "@/shared/utils/index";
import { ScrollArea } from "@altitutor/ui";
import {
  Beaker,
  Newspaper,
  ClipboardList,
  Monitor,
  UserRound,
  TrendingUp,
  MessageSquareText,
} from "lucide-react";
import { useQuickActions } from "@/shared/contexts/QuickActionsContext";
import { useQueryClient } from "@tanstack/react-query";
import { useToast } from "@altitutor/ui";
import { CheckInBookSessionModal } from "@/features/sessions/components/CheckInBookSessionModal";
import { payTiersKeys } from "@/features/pay-tiers/api/queryKeys";
import { CommandPaletteModal } from "@/features/command-palette/components/CommandPaletteModal";
import { useCommandPalette } from "@/shared/contexts/CommandPaletteContext";
import { LogSessionModal } from "@/features/tutor-logs";
import { LogAbsenceDialog, LogStaffAbsenceDialog } from "@/features/sessions";
import { AnnouncementsModal } from "@/features/messages/components/announcements/AnnouncementsModal";
import { BookSessionModal } from "@/features/bookings/components";
import { StaffInterviewBookSessionModal } from "@/features/bookings/components/staff-interview/StaffInterviewBookSessionModal";
import { CreateTaskDialog } from "@/features/tasks/components/CreateTaskDialog";
import { CreateIssueDialog } from "@/features/issues/components/CreateIssueDialog";
import { CreateProjectDialog } from "@/features/projects/components/CreateProjectDialog";
import { useCurrentStaff } from "@/shared/hooks";
import { useMobileMenu } from "@/shared/contexts/MobileMenuContext";
import { Breadcrumb, AdminUrlSyncBoundary, Navbar } from "@/shared/components";
import { useBreadcrumbs } from "@/shared/hooks/useBreadcrumbs";
import { useAdminShell } from "@/shared/contexts/AdminShellContext";
import { invalidateCheckInSurfaces } from "@/shared/lib/query-invalidation";
import { format } from "date-fns";
import type { LucideIcon } from "lucide-react";

interface SidebarNavProps extends React.HTMLAttributes<HTMLDivElement> {
  collapsed: boolean;
}

type NavItem =
  | {
      type?: "link";
      title: string;
      href: string;
      icon: LucideIcon;
      children?: { title: string; href: string }[];
    }
  | { type: "heading"; title: string };

const navItems: NavItem[] = [
  {
    title: "Dashboard",
    href: "/dashboard",
    icon: Home,
  },
  {
    type: "heading",
    title: "COMMUNICATION",
  },
  {
    title: "Feedback",
    href: "/feedback",
    icon: MessageSquareText,
  },
  {
    title: "Trial students",
    href: "/trial-students",
    icon: Users,
    children: [
      { title: "Work queue", href: "/trial-students" },
      { title: "Conversion insights", href: "/trial-students/insights" },
    ],
  },
  {
    type: "heading",
    title: "SCHEDULING",
  },
  {
    title: "In-person Students",
    href: "/students",
    icon: GraduationCap,
  },
  {
    title: "Online Students",
    href: "/online-students",
    icon: Monitor,
  },
  {
    title: "Parents",
    href: "/parents",
    icon: UserRound,
  },
  {
    title: "Staff",
    href: "/staff",
    icon: Users,
  },
  {
    title: "Classes",
    href: "/classes",
    icon: Calendar,
  },
  {
    title: "Admin Shifts",
    href: "/admin-shifts",
    icon: Calendar,
  },
  {
    title: "Sessions",
    href: "/sessions",
    icon: ClipboardList,
  },
  {
    type: "heading",
    title: "FINANCIAL",
  },
  {
    title: "Reconciliation",
    href: "/reconciliation",
    icon: AlertTriangle,
  },
  {
    title: "Invoices",
    href: "/invoices",
    icon: CreditCard,
  },
  {
    title: "Reports",
    href: "/reports",
    icon: FileText,
  },
  {
    title: "Tutor logs",
    href: "/tutor-logs",
    icon: ClipboardList,
  },
  {
    title: "Pay tiers",
    href: "/pay-tiers",
    icon: TrendingUp,
  },
  {
    type: "heading",
    title: "RESOURCES",
  },
  {
    title: "Subjects",
    href: "/subjects",
    icon: Beaker,
  },
  {
    title: "Topics",
    href: "/topics",
    icon: Newspaper,
  },
];

type NavLink = Extract<NavItem, { type?: "link" }>;

type NavSection = {
  title: string | null;
  items: NavLink[];
};

function groupNavItems(items: NavItem[]): NavSection[] {
  const sections: NavSection[] = [];
  let current: NavSection = { title: null, items: [] };
  for (const item of items) {
    if (item.type === "heading") {
      sections.push(current);
      current = { title: item.title, items: [] };
    } else {
      current.items.push(item);
    }
  }
  sections.push(current);
  return sections.filter(
    (section) => section.title !== null || section.items.length > 0,
  );
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
        "grid transition-[grid-template-rows] duration-200 ease-out motion-reduce:transition-none",
        expanded ? "grid-rows-[1fr]" : "grid-rows-[0fr]",
      )}
    >
      <div className="min-h-0 overflow-hidden">
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
        "mt-2 flex w-full items-center justify-between rounded-md px-3 py-2 text-xs font-semibold text-muted-foreground hover:text-foreground",
        navLinkInactiveStyles,
      )}
    >
      <span>{title}</span>
      <ChevronDown
        className={cn(
          "h-3 w-3 transition-transform duration-200",
          !expanded && "-rotate-90",
        )}
      />
    </button>
  );
}

const getTodayDashboardHref = () =>
  `/dashboard/${format(new Date(), "yyyy-MM-dd")}`;

const getNavItemHref = (item: Extract<NavItem, { type?: "link" }>) => {
  if (item.title === "Dashboard") {
    return getTodayDashboardHref();
  }
  return item.href;
};

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
}: {
  item: Extract<NavItem, { type?: "link" }> & {
    children: { title: string; href: string }[];
  };
  pathname: string;
  collapsed?: boolean;
}) {
  const [expanded, toggleExpanded] = useSectionExpanded(pathname, item.href);
  const active = pathname === item.href || pathname.startsWith(`${item.href}/`);
  const Icon = item.icon;

  if (collapsed) {
    return (
      <TooltipProvider delayDuration={150}>
        <Tooltip>
          <TooltipTrigger asChild>
            <Link
              href={item.href}
              prefetch={false}
              className={cn(
                "flex items-center justify-center rounded-md px-0 py-2 text-sm",
                active ? navLinkActiveStyles : navLinkInactiveStyles,
              )}
            >
              <Icon className="h-6 w-6" />
              <span className="sr-only">{item.title}</span>
            </Link>
          </TooltipTrigger>
          <TooltipContent side="right" sideOffset={10}>
            {item.title}
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
                childNavActive(pathname, item.href, child.href)
                  ? navLinkActiveStyles
                  : navLinkInactiveStyles,
              )}
            >
              {child.title}
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
          const itemHref = getNavItemHref(item);
          if (item.children?.length) {
            return (
              <ExpandableNavGroup
                key={item.href}
                item={{ ...item, children: item.children }}
                pathname={pathname}
                collapsed={collapsed}
              />
            );
          }

          const link = (
            <Link
              href={itemHref}
              onClick={(event) => openAccessory(event, itemHref)}
              prefetch={false}
              className={cn(
                "flex items-center gap-3 rounded-md px-3 py-2 text-sm",
                isNavItemActive(pathname, item)
                  ? navLinkActiveStyles
                  : navLinkInactiveStyles,
                collapsed && "justify-center px-0",
              )}
            >
              <Icon className={cn("h-5 w-5", collapsed && "h-6 w-6")} />
              {collapsed ? (
                <span className="sr-only">{item.title}</span>
              ) : (
                <span className="overflow-hidden whitespace-nowrap">
                  {item.title}
                </span>
              )}
            </Link>
          );

          if (!collapsed) {
            return <React.Fragment key={item.href}>{link}</React.Fragment>;
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

function MobileMenu({
  isOpen,
  onClose,
}: {
  isOpen: boolean;
  onClose: () => void;
}) {
  const pathname = usePathname();
  const dragStartYRef = React.useRef<number | null>(null);
  const dragOffsetRef = React.useRef(0);
  const [dragOffset, setDragOffset] = useState(0);

  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = "hidden";
    } else {
      document.body.style.overflow = "";
    }
    return () => {
      document.body.style.overflow = "";
    };
  }, [isOpen]);

  useEffect(() => {
    if (!isOpen) return;

    const handleClickOutside = (event: MouseEvent) => {
      const target = event.target as HTMLElement;
      if (target.hasAttribute("data-mobile-menu-overlay")) {
        onClose();
      }
    };

    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
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
    const nextOffset = Math.max(
      0,
      (event.touches[0]?.clientY ?? dragStartYRef.current) -
        dragStartYRef.current,
    );
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
          className="fixed inset-x-0 bottom-0 top-[var(--navbar-height)] z-[70] bg-black/60 transition-opacity md:hidden"
          onClick={onClose}
        />
      )}

      <div
        className={cn(
          "fixed inset-x-0 bottom-0 z-[80] flex h-[88dvh] max-h-[calc(100dvh-var(--navbar-height))] flex-col overflow-hidden rounded-t-3xl bg-card ring-1 ring-black/10 transition-transform duration-300 ease-out dark:ring-white/10 md:hidden",
          dragStartYRef.current != null && "transition-none",
          isOpen ? "translate-y-0" : "translate-y-full",
        )}
        style={
          isOpen && dragOffset > 0
            ? { transform: `translateY(${dragOffset}px)` }
            : undefined
        }
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
              <AdminNavMenu onAccessoryNavigate={onClose} />
            </nav>
          </ScrollArea>

          <div className="border-t p-2">
            <ProfileMenu onNavigate={onClose} />
          </div>
        </div>
      </div>
    </>
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
          <AdminNavMenu collapsed={collapsed} />
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
  const { isOpen: isCommandPaletteOpen, close: closeCommandPalette } =
    useCommandPalette();
  const { data: currentStaff } = useCurrentStaff();
  const breadcrumbs = useBreadcrumbs();
  const pathname = usePathname();
  const showBreadcrumbs =
    pathname !== "/messages" &&
    !/^\/(students|parents|staff|classes|sessions|invoices|subjects|topics|admin-shifts)\/[^/]+/.test(
      pathname,
    );

  return (
    <>
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
              <div className="shrink-0 px-6 pt-6 pb-0">
                <Breadcrumb items={breadcrumbs} />
              </div>
            )}
            <div className="flex min-h-0 flex-1 flex-col overflow-auto">
              <AdminUrlSyncBoundary>{children}</AdminUrlSyncBoundary>
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
