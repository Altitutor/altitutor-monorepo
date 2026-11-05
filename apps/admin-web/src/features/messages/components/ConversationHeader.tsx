"use client";

import {
  useEffect,
  useRef,
  useState,
  type ReactNode,
} from "react";
import {
  Button,
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSub,
  DropdownMenuSubContent,
  DropdownMenuSubTrigger,
  DropdownMenuTrigger,
  EntityChip,
  SearchableSelect,
  SearchableSelectInline,
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@altitutor/ui";
import {
  Search,
  ArrowLeft,
  Mail,
  MoreHorizontal,
  Link2,
  User,
  UserPlus,
} from "lucide-react";
import { EmailActionGroup } from "@/features/email/components/EmailActions";
import { EmailIconButton } from "@/features/email/components/EmailIconButton";
import { StudentContextChips } from "@/features/parents/components/StudentContextChips";
import { useAccessoryTab } from "@/shared/contexts/AccessoryTabContext";
import { cn } from "@/shared/utils";
import { IssuePill } from "@/features/issues";
import { useConversationMeetingActions } from "../hooks/useConversationMeetingActions";
import { useQuickActions } from "@/shared/contexts/QuickActionsContext";

interface EntityOption {
  id: string;
  label: string;
}

interface FromNumberOption {
  id: string;
  label: string;
}

interface Props {
  title?: string;
  onSearchToggle?: () => void;
  onBack?: () => void;
  showBackButton?: boolean;
  onTitleClick?: () => void;
  isUnread?: boolean;
  onToggleRead?: () => void;
  contact?: {
    id?: string;
    phone_e164?: string | null;
    email?: string | null;
    contact_type: string;
    students?: {
      id: string;
      first_name?: string | null;
      last_name?: string | null;
    } | null;
    parents?: {
      id: string;
      first_name?: string | null;
      last_name?: string | null;
    } | null;
    staff?: {
      id: string;
      first_name?: string | null;
      last_name?: string | null;
      role?: string | null;
    } | null;
  } | null;
  showUnknownNumberActions?: boolean;
  isLinkingPhone?: boolean;
  studentOptionsWithoutPhone?: EntityOption[];
  parentOptionsWithoutPhone?: EntityOption[];
  staffOptionsWithoutPhone?: EntityOption[];
  onCreateStudent?: () => void;
  onCreateParent?: () => void;
  onCreateStaff?: () => void;
  onAssignStudent?: (studentId: string) => Promise<void> | void;
  onAssignParent?: (parentId: string) => Promise<void> | void;
  onAssignStaff?: (staffId: string) => Promise<void> | void;
  fromNumberOptions?: FromNumberOption[];
  selectedFromNumber?: FromNumberOption | null;
  onFromNumberChange?: (option: FromNumberOption | null) => void;
  extraActions?: ReactNode;
  extraMenuItems?: ReactNode;
  compactActions?: boolean;
  paneHeader?: boolean;
  titleSlot?: ReactNode;
  filterControl?: ReactNode;
  backButtonClassName?: string;
  messageId?: string | null;
  assigneeId?: string | null;
  staffOptions?: Array<{ id: string; first_name: string | null; last_name: string | null }>;
  onAssign?: (staffId: string | null) => void;
}

const TITLE_MIN_WIDTH = 128;
const PANE_TITLE_MIN_WIDTH = 180;

function ActionLabel({
  expanded,
  label,
  children,
}: {
  expanded: boolean;
  label: string;
  children: ReactNode;
}) {
  if (expanded) return <>{children}</>;
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <span className="inline-flex flex-shrink-0">{children}</span>
      </TooltipTrigger>
      <TooltipContent side="bottom">{label}</TooltipContent>
    </Tooltip>
  );
}

export function ConversationHeader({
  title,
  onSearchToggle,
  onBack,
  showBackButton = false,
  onTitleClick,
  isUnread,
  onToggleRead,
  contact,
  showUnknownNumberActions = false,
  isLinkingPhone = false,
  studentOptionsWithoutPhone = [],
  parentOptionsWithoutPhone = [],
  staffOptionsWithoutPhone = [],
  onCreateStudent,
  onCreateParent,
  onCreateStaff,
  onAssignStudent,
  onAssignParent,
  onAssignStaff,
  fromNumberOptions = [],
  selectedFromNumber = null,
  onFromNumberChange,
  extraActions,
  extraMenuItems,
  compactActions: _compactActions = false,
  paneHeader = false,
  titleSlot,
  filterControl,
  backButtonClassName,
  messageId,
  assigneeId = null,
  staffOptions = [],
  onAssign,
}: Props) {
  const [isOverflowOpen, setIsOverflowOpen] = useState(false);
  const [selectedStudentOption, setSelectedStudentOption] =
    useState<EntityOption | null>(null);
  const [selectedParentOption, setSelectedParentOption] =
    useState<EntityOption | null>(null);
  const [selectedStaffOption, setSelectedStaffOption] =
    useState<EntityOption | null>(null);
  const rowRef = useRef<HTMLDivElement>(null);
  const quickActions = useQuickActions();
  const tabScope = useAccessoryTab();
  const meetings = useConversationMeetingActions(contact, () => setIsOverflowOpen(false));

  const getIssuePillProps = () => {
    if (!contact) return null;

    if (contact.contact_type === "STUDENT" && contact.students?.id) {
      return { entityType: "student" as const, entityId: contact.students.id };
    }
    if (contact.contact_type === "STAFF" && contact.staff?.id) {
      return { entityType: "staff" as const, entityId: contact.staff.id };
    }
    if (contact.contact_type === "PARENT" && contact.parents?.id) {
      return { entityType: "parent" as const, entityId: contact.parents.id };
    }
    return null;
  };

  const issuePillProps = getIssuePillProps();
  const hasUnknownPhone = Boolean(contact?.phone_e164 || contact?.email);
  const canShowLinkActions = showUnknownNumberActions && hasUnknownPhone;
  const readLabel = isUnread ? "Mark as read" : "Mark as unread";
  const person = contact?.students
    ? { type: "student", id: contact.students.id }
    : contact?.parents
      ? { type: "parent", id: contact.parents.id }
      : contact?.staff
        ? { type: "staff", id: contact.staff.id }
        : null;
  const openReferenced = (kind: "task" | "issue") => {
    if (!messageId) return;
    const reference = { type: "message", id: messageId, label: title || "Message" };
    if (kind === "task") quickActions.openCreateTaskDialog(reference);
    else quickActions.openCreateIssueDialog(reference);
  };
  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (tabScope?.active === false || event.isComposing || rowRef.current?.closest('[hidden],[inert]')) return;
      const key = event.key.toLowerCase();
      if ((key !== "t" && key !== "i") || event.metaKey || event.ctrlKey || event.altKey || event.shiftKey || event.defaultPrevented) return;
      if (document.querySelector("[data-conversation-row]:hover")) return;
      const target = event.target;
      if (target instanceof Element && target.closest("input,textarea,select,[contenteditable=true],[role=combobox],[role=dialog],[role=menu]")) return;
      event.preventDefault();
      openReferenced(key === "t" ? "task" : "issue");
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  });

  const handleAssignStudent = async (option: EntityOption | null) => {
    setSelectedStudentOption(option);
    if (!option || !onAssignStudent) return;
    await onAssignStudent(option.id);
    setSelectedStudentOption(null);
    setIsOverflowOpen(false);
  };

  const handleAssignParent = async (option: EntityOption | null) => {
    setSelectedParentOption(option);
    if (!option || !onAssignParent) return;
    await onAssignParent(option.id);
    setSelectedParentOption(null);
    setIsOverflowOpen(false);
  };

  const handleAssignStaff = async (option: EntityOption | null) => {
    setSelectedStaffOption(option);
    if (!option || !onAssignStaff) return;
    await onAssignStaff(option.id);
    setSelectedStaffOption(null);
    setIsOverflowOpen(false);
  };

  const fromNumberMenu = onFromNumberChange ? (
    <SearchableSelectInline<FromNumberOption>
      items={fromNumberOptions}
      value={selectedFromNumber}
      onValueChange={(option) => {
        onFromNumberChange(option);
            setIsOverflowOpen(false);
      }}
      getItemId={(item) => item.id}
      getItemLabel={(item) => item.label}
      searchPlaceholder="Search from number..."
      emptyMessage="No numbers found"
      allowClear
      clearLabel="All numbers"
    />
  ) : null;

  const linkMenuItems = (
    <>
      <DropdownMenuItem
        disabled={isLinkingPhone}
        onSelect={(event) => {
          event.preventDefault();
          onCreateStudent?.();
                setIsOverflowOpen(false);
        }}
      >
        <UserPlus className="mr-2 h-4 w-4" />
        Create new student
      </DropdownMenuItem>
      <DropdownMenuItem
        disabled={isLinkingPhone}
        onSelect={(event) => {
          event.preventDefault();
          onCreateParent?.();
                setIsOverflowOpen(false);
        }}
      >
        <UserPlus className="mr-2 h-4 w-4" />
        Create new parent
      </DropdownMenuItem>
      <DropdownMenuItem
        disabled={isLinkingPhone}
        onSelect={(event) => {
          event.preventDefault();
          onCreateStaff?.();
                setIsOverflowOpen(false);
        }}
      >
        <UserPlus className="mr-2 h-4 w-4" />
        Create new staff member
      </DropdownMenuItem>
      <DropdownMenuSub>
        <DropdownMenuSubTrigger disabled={isLinkingPhone}>
          <User className="mr-2 h-4 w-4" />
          Add to existing student
        </DropdownMenuSubTrigger>
        <DropdownMenuSubContent className="w-80 p-0">
          <SearchableSelectInline<EntityOption>
            items={studentOptionsWithoutPhone}
            value={selectedStudentOption}
            onValueChange={handleAssignStudent}
            getItemId={(item) => item.id}
            getItemLabel={(item) => item.label}
            searchPlaceholder="Search students..."
            emptyMessage={contact?.phone_e164 ? "No students without mobile number" : "No students found"}
          />
        </DropdownMenuSubContent>
      </DropdownMenuSub>
      <DropdownMenuSub>
        <DropdownMenuSubTrigger disabled={isLinkingPhone}>
          <User className="mr-2 h-4 w-4" />
          Add to existing parent
        </DropdownMenuSubTrigger>
        <DropdownMenuSubContent className="w-80 p-0">
          <SearchableSelectInline<EntityOption>
            items={parentOptionsWithoutPhone}
            value={selectedParentOption}
            onValueChange={handleAssignParent}
            getItemId={(item) => item.id}
            getItemLabel={(item) => item.label}
            searchPlaceholder="Search parents..."
            emptyMessage={contact?.phone_e164 ? "No parents without mobile number" : "No parents found"}
          />
        </DropdownMenuSubContent>
      </DropdownMenuSub>
      <DropdownMenuSub>
        <DropdownMenuSubTrigger disabled={isLinkingPhone}>
          <User className="mr-2 h-4 w-4" />
          Add to existing staff member
        </DropdownMenuSubTrigger>
        <DropdownMenuSubContent className="w-80 p-0">
          <SearchableSelectInline<EntityOption>
            items={staffOptionsWithoutPhone}
            value={selectedStaffOption}
            onValueChange={handleAssignStaff}
            getItemId={(item) => item.id}
            getItemLabel={(item) => item.label}
            searchPlaceholder="Search staff..."
            emptyMessage={contact?.phone_e164 ? "No staff without mobile number" : "No staff found"}
          />
        </DropdownMenuSubContent>
      </DropdownMenuSub>
    </>
  );


  return (
    <TooltipProvider delayDuration={200}>
      <div
        data-pane-toolbar={paneHeader ? "" : undefined}
          className={cn(
            "flex-shrink-0 border-b bg-background",
            paneHeader
              ? "px-4 py-2"
              : "flex flex-col gap-2 px-6 py-3 dark:border-brand-dark-border",
          )}
        >
          {/* Row 1: back | contact name / breadcrumbs | mark as read | filter | actions */}
          <div
            ref={rowRef}
            className={cn(
              "flex items-center gap-2 min-w-0 flex-nowrap",
              paneHeader && "min-h-9",
            )}
          >
          {showBackButton && onBack && (
            <Button
              variant="outline"
              size="icon"
              onClick={onBack}
              className={cn("flex-shrink-0", backButtonClassName)}
            >
              <ArrowLeft className="h-4 w-4" />
            </Button>
          )}
          <div
            className="min-w-0 flex-1 flex items-center justify-start overflow-hidden"
            style={{ minWidth: paneHeader ? PANE_TITLE_MIN_WIDTH : TITLE_MIN_WIDTH }}
          >
            {paneHeader && titleSlot ? (
              titleSlot
            ) : onTitleClick ? (
              <button
                onClick={onTitleClick}
                className="font-medium hover:underline cursor-pointer truncate text-left w-full"
                title={title || "Conversation"}
              >
                {title || "Conversation"}
              </button>
            ) : (
              <div
                className="font-medium truncate"
                title={title || "Conversation"}
              >
                {title || "Conversation"}
              </div>
            )}
          </div>
          </div>
          <div className="flex min-w-0 items-center justify-between gap-2">
            <div className="flex min-w-0 flex-1 flex-wrap items-center gap-1">
            {person ? (
              <EntityChip
                entityType={person.type}
                entityId={person.id}
                label={title || "Conversation"}
                onClick={onTitleClick}
              />
            ) : (
              <EntityChip entityType="message" label={title || "Conversation"} onClick={onTitleClick} />
            )}
            {contact?.parents && <StudentContextChips students={meetings.students} />}
            </div>
            <div className="flex shrink-0 flex-wrap items-center justify-end gap-2">
              <EmailActionGroup label="Conversation actions">
                {onSearchToggle && <EmailIconButton label="Search" onClick={onSearchToggle}><Search className="h-4 w-4" /></EmailIconButton>}
                {onToggleRead && <EmailIconButton label={readLabel} data-unread={isUnread ? "true" : undefined} onClick={onToggleRead}><Mail className="h-4 w-4" /></EmailIconButton>}
          <DropdownMenu
              modal={false}
              open={isOverflowOpen}
              onOpenChange={setIsOverflowOpen}
            >
              <ActionLabel expanded={false} label="More">
                <DropdownMenuTrigger asChild>
                  <Button
                    variant="outline"
                    size="icon"
                    className="h-8 w-8 flex-shrink-0"
                    aria-label="More"
                  >
                    <MoreHorizontal className="h-4 w-4" />
                  </Button>
                </DropdownMenuTrigger>
              </ActionLabel>
              <DropdownMenuContent
                forceMount
                align="end"
                className="w-64 data-[state=closed]:hidden"
              >
                <DropdownMenuItem disabled={!messageId} onSelect={() => openReferenced("task")}>
                  Create task
                  <span className="ml-auto text-xs text-muted-foreground">T</span>
                </DropdownMenuItem>
                <DropdownMenuItem disabled={!messageId} onSelect={() => openReferenced("issue")}>
                  Create issue
                  <span className="ml-auto text-xs text-muted-foreground">I</span>
                </DropdownMenuItem>
                {onSearchToggle && (
                  <DropdownMenuItem
                    onSelect={() => {
                      onSearchToggle();
                      setIsOverflowOpen(false);
                    }}
                  >
                    <Search className="mr-2 h-4 w-4" />
                    Search
                  </DropdownMenuItem>
                )}
                {extraMenuItems}
                {onFromNumberChange && <DropdownMenuSub><DropdownMenuSubTrigger>From number</DropdownMenuSubTrigger><DropdownMenuSubContent className="w-80 p-0">{fromNumberMenu}</DropdownMenuSubContent></DropdownMenuSub>}
                {meetings.menuItems}
                {canShowLinkActions && (
                  <DropdownMenuSub>
                    <DropdownMenuSubTrigger disabled={isLinkingPhone}>
                      <Link2 className="mr-2 h-4 w-4" />
                      Link this number
                    </DropdownMenuSubTrigger>
                    <DropdownMenuSubContent className="w-64">
                      {linkMenuItems}
                    </DropdownMenuSubContent>
                  </DropdownMenuSub>
                )}
              </DropdownMenuContent>
            </DropdownMenu>

              </EmailActionGroup>
              {onAssign && <EmailActionGroup label="Conversation responsibility"><SearchableSelect
                items={staffOptions}
                value={staffOptions.find((member) => member.id === assigneeId) ?? null}
                onValueChange={(member) => onAssign(member?.id ?? null)}
                getItemId={(member) => member.id}
                getItemLabel={(member) => `${member.first_name ?? ""} ${member.last_name ?? ""}`.trim() || "Admin staff"}
                allowClear clearLabel="Unassigned" searchPlaceholder="Search admin staff..."
                trigger={<EmailIconButton label="Assign conversation" className="w-auto max-w-40 gap-1 px-2"><User className="h-4 w-4" /><span className="truncate text-xs">{staffOptions.find((member) => member.id === assigneeId) ? `${staffOptions.find((member) => member.id === assigneeId)?.first_name ?? ""} ${staffOptions.find((member) => member.id === assigneeId)?.last_name ?? ""}`.trim() : "Unassigned"}</span></EmailIconButton>}
              /></EmailActionGroup>}
              {extraActions}
              {filterControl}
            </div>
        </div>
        {/* Issue pills stay under the conversation actions. */}
        {!paneHeader && issuePillProps && (
          <div className="flex items-center gap-2 min-w-0 max-w-full">
            <IssuePill
              entityType={issuePillProps.entityType}
              entityId={issuePillProps.entityId}
              className="min-w-0 max-w-full flex-wrap"
              truncateWithTitle
            />
          </div>
        )}
      </div>
      {meetings.dialogs}
    </TooltipProvider>
  );
}
