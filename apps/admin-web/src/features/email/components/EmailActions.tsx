"use client";
import { useEffect, useRef, useState } from "react";
import {
  Mail,
  MailOpen,
  FolderInput,
  Trash2,
  UserRound,
  Reply,
  ReplyAll,
  Forward,
  Search,
  MoreHorizontal,
  Archive,
} from "lucide-react";
import { EnquiryAction } from "@/features/onboarding/components/EnquiryAction";
import { useQuickActions } from "@/shared/contexts/QuickActionsContext";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuSub, DropdownMenuSubContent, DropdownMenuSubTrigger, DropdownMenuTrigger, EntityChipIcon, SearchableSelect, keyboardPane, keyboardPointerTarget } from "@altitutor/ui";
import { useRegisterRecordActions } from "@/features/command-palette/RecordActionsContext";
import { useEmailCommand } from "../api/client";
import type { EmailFolder, MailboxData } from "../types";
import { useAccessoryTab } from "@/shared/contexts/AccessoryTabContext";
import { EmailIconButton } from "./EmailIconButton";
import styles from "./email-action-group.module.css";

// Deliberately session-only; all selectors share the latest successful moves.
let recentFolders: string[] = [];
export function rememberEmailFolder(id: string) {
  recentFolders = [id, ...recentFolders.filter((item) => item !== id)].slice(
    0,
    12,
  );
}
export function EmailActionGroup({
  children,
  label,
}: {
  children: React.ReactNode;
  label: string;
}) {
  return (
    <div
      role="group"
      aria-label={label}
      className={`admin-action-group shrink-0 ${styles.group}`}
    >
      {children}
    </div>
  );
}
export function EmailActions({
  ids,
  messageId,
  messageLabel,
  threadId,
  read,
  assignedStaffId,
  mailbox,
  hovered = false,
  onReply,
  onForward,
  onReplyAll,
  level = "thread",
  hideAssignee = false,
  captureWhenIdle = false,
  onSearchToggle,
  moreMenuItems,
  enquiryEligible = false,
}: {
  ids: string[];
  messageId?: string;
  messageLabel?: string;
  threadId: string;
  read: boolean;
  assignedStaffId: string | null;
  mailbox: MailboxData;
  hovered?: boolean;
  onReply?: () => void;
  onForward?: () => void;
  onReplyAll?: () => void;
  level?: "thread" | "message";
  compact?: boolean;
  hideAssignee?: boolean;
  /** Handles R, Shift+R, and F for the latest message when no message is hovered or focused. */
  captureWhenIdle?: boolean;
  onSearchToggle?: () => void;
  moreMenuItems?: React.ReactNode;
  enquiryEligible?: boolean;
}) {
  const quickActions = useQuickActions();
  const taskMessageId = messageId ?? ids[0];
  const command = useEmailCommand();
  const scope = useAccessoryTab();
  const root = useRef<HTMLDivElement>(null);
  const [moveOpen, setMoveOpen] = useState(false);
  const [moreOpen, setMoreOpen] = useState(false);
  const [assignOpen, setAssignOpen] = useState(false);
  const [actionsFocused, setActionsFocused] = useState(false);
  const current = useRef({
    ids,
    taskMessageId,
    read,
    hovered: hovered && scope?.active !== false,
    captureWhenIdle,
    onReply,
    onReplyAll,
    onForward,
    busy: command.isPending,
  });
  current.current = {
    ids,
    taskMessageId,
    read,
    hovered: hovered && scope?.active !== false,
    captureWhenIdle,
    onReply,
    onReplyAll,
    onForward,
    busy: command.isPending,
  };
  const mutate = command.mutate;
  useRegisterRecordActions('email', messageId, messageLabel, [
    ...(onReply ? [{ id: 'reply', title: 'Reply to email', icon: Reply, action: onReply, disabled: command.isPending }] : []),
    ...(onReplyAll ? [{ id: 'reply-all', title: 'Reply all', icon: ReplyAll, action: onReplyAll, disabled: command.isPending }] : []),
    ...(onForward ? [{ id: 'forward', title: 'Forward email', icon: Forward, action: onForward, disabled: command.isPending }] : []),
    { id: 'mark-read', title: 'Mark as read', icon: MailOpen, disabled: command.isPending || !ids.length, action: () => command.mutate({ action: 'read', ids, read: true }) },
    { id: 'unread', title: 'Mark as unread', icon: Mail, disabled: command.isPending || !ids.length, action: () => command.mutate({ action: 'read', ids, read: false }) },
    { id: 'archive', title: 'Archive email', icon: Archive, disabled: command.isPending || !ids.length, action: () => command.mutate({ action: 'move', ids, folderId: 'archive' }) },
    { id: 'move-folder', title: 'Move to folder', icon: FolderInput, disabled: command.isPending || !ids.length, action: () => setMoveOpen(true) },
    { id: 'assign', title: 'Assign email', icon: UserRound, disabled: command.isPending, action: () => setAssignOpen(true) },
    { id: 'delete-email', title: 'Delete email', icon: Trash2, destructive: true, disabled: command.isPending || !ids.length, action: () => command.mutate({ action: 'move', ids, folderId: 'deleteditems' }) },
  ], { active: level === 'message', runOnly: true });

  useEffect(() => {
    const key = (event: KeyboardEvent) => {
      const state = current.current;
      if (!root.current || !keyboardPane().contains(root.current)) return;
      const owner = root.current?.closest("[data-email-shortcut-target]");
      const hoveredOwner = keyboardPointerTarget()?.closest("[data-email-shortcut-target]") ?? document.querySelector(
        "[data-email-shortcut-target]:hover",
      );
      const focusedOwner = document.activeElement?.closest(
        "[data-email-shortcut-target]",
      );
      const ownsInput = owner
        ? hoveredOwner
          ? owner === hoveredOwner
          : focusedOwner
            ? owner === focusedOwner
            : state.captureWhenIdle || state.hovered
        : state.hovered;
      if (
        !ownsInput ||
        scope?.active === false ||
        !root.current?.isConnected ||
        Boolean(root.current.closest("[hidden],[inert]")) ||
        state.busy ||
        event.repeat ||
        event.defaultPrevented ||
        event.metaKey ||
        event.ctrlKey ||
        event.altKey ||
        event.isComposing
      )
        return;
      const target = event.target;
      if (
        target instanceof Element &&
        target.closest(
          "input,textarea,select,[contenteditable=true],[role=combobox],[role=dialog],[role=menu],[data-email-shortcut-scope=typing]",
        )
      )
        return;
      if (
        document.querySelector(
          '[data-state="open"][role="dialog"], [data-state="open"][role="menu"]',
        )
      )
        return;
      const action = event.key.toLowerCase();
      if (!["r", "f", "v", "backspace", "u", "a", "t", "i"].includes(action)) return;
      if (event.shiftKey && !["r", "f"].includes(action)) return;
      if (action === "f" && !event.shiftKey) return;
      if (["t", "i"].includes(action) && !state.taskMessageId) return;
      if (!state.ids.length && ["v", "backspace", "u"].includes(action)) return;
      if (
        (action === "r" && !state.onReply) ||
        (action === "f" && !state.onForward)
      )
        return;
      event.preventDefault();
      if (action === "r") {
        if (event.shiftKey && state.onReplyAll) state.onReplyAll();
        else state.onReply?.();
      }
      if (action === "f") state.onForward?.();
      if (action === "t" || action === "i") {
        const reference = { type: "email", id: state.taskMessageId!, label: messageLabel || "Email" };
        if (action === "t") quickActions.openCreateTaskDialog(reference);
        else quickActions.openCreateIssueDialog(reference);
      }
      if (action === "v") setMoveOpen(true);
      if (action === "a") setAssignOpen(true);
      if (action === "u")
        mutate({ action: "read", ids: state.ids, read: !state.read });
      if (action === "backspace")
        mutate({ action: "move", ids: state.ids, folderId: "deleteditems" });
    };
    document.addEventListener("keydown", key);
    return () => document.removeEventListener("keydown", key);
  }, [mutate, scope?.active, level, messageLabel, quickActions]);
  const name = (person: MailboxData["staff"][number]) =>
    [person.first_name, person.last_name].filter(Boolean).join(" ");
  const selected =
    mailbox.staff.find((person) => person.id === assignedStaffId) ?? null;
  const folders = [...mailbox.folders].sort((a, b) => {
    const rank = (folder: EmailFolder) => {
      const index = recentFolders.indexOf(folder.id);
      return index < 0 ? Number.MAX_SAFE_INTEGER : index;
    };
    return rank(a) - rank(b) || a.name.localeCompare(b.name);
  });
  const assigneeControl = (
    <SearchableSelect
      items={mailbox.staff}
      value={selected}
      open={assignOpen}
      onOpenChange={setAssignOpen}
      allowClear
      clearLabel="Unassigned"
      getItemId={(person) => person.id}
      getItemLabel={name}
      searchPlaceholder="Search active adminstaff…"
      onValueChange={(person) =>
        command.mutate({
          action: "assign",
          threadId,
          staffId: person?.id ?? null,
        })
      }
      trigger={
        level === "message" ? (
          <span aria-hidden="true" />
        ) : (
          <EmailIconButton
            label={selected ? `Assign · ${name(selected)}` : "Assign"}
            shortcut="A"
            className={selected ? "w-auto max-w-40 px-2" : ""}
            disabled={command.isPending}
          >
            <UserRound
              className={`h-4 w-4 ${selected ? "text-primary" : ""}`}
            />
            {selected && (
              <span className="truncate text-xs">{name(selected)}</span>
            )}
          </EmailIconButton>
        )
      }
    />
  );
  return (
    <div
      ref={root}
      className="flex items-center gap-1"
      onClick={(event) => event.stopPropagation()}
      onFocusCapture={() => setActionsFocused(true)}
    >
      <EmailActionGroup label={level === "thread" ? "Conversation actions" : "Email actions"}>
        {enquiryEligible && messageId && (
          <EnquiryAction source={{ kind: "email", id: messageId }} active={hovered || actionsFocused} />
        )}
        {level === "thread" && onSearchToggle && <EmailIconButton data-shortcut-search label="Search" shortcut={["Alt", "F"]} onClick={onSearchToggle}><Search className="h-4 w-4" /></EmailIconButton>}
        {level === "message" && taskMessageId && (
          <EmailIconButton
            label="Create task"
            onClick={() =>
              quickActions.openCreateTaskDialog({
                type: "email",
                id: taskMessageId,
                label: messageLabel || "Email",
              })
            }
          >
            <EntityChipIcon entityType="task" />
          </EmailIconButton>
        )}
        {level === "thread" && (
          <EmailIconButton
            label={read ? "Mark as unread" : "Mark as read"}
            shortcut="U"
            data-unread={read ? undefined : "true"}
            disabled={!ids.length || command.isPending}
            onClick={() => command.mutate({ action: "read", ids, read: !read })}
          >
            {read ? (
              <Mail className="h-4 w-4" />
            ) : (
              <MailOpen className="h-4 w-4" />
            )}
          </EmailIconButton>
        )}
        {(level === "thread" || onReply || onReplyAll || onForward) && (
          <DropdownMenu open={moreOpen} onOpenChange={setMoreOpen}>
            <DropdownMenuTrigger asChild>
              <EmailIconButton data-shortcut-menu={level === "thread" ? "" : undefined} shortcut={level === "thread" ? "M" : undefined} label="More">
                <MoreHorizontal className="size-4" />
              </EmailIconButton>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="[&_[role=menuitem]]:gap-2 [&_[role=menuitem]>svg]:size-4 [&_[role=menuitem]>svg]:shrink-0">
              {onReply && <DropdownMenuItem disabled={command.isPending} onSelect={onReply}><Reply className="size-4 shrink-0" />Reply</DropdownMenuItem>}
              {onReplyAll && <DropdownMenuItem disabled={command.isPending} onSelect={onReplyAll}><ReplyAll className="size-4 shrink-0" />Reply all</DropdownMenuItem>}
              {onForward && <DropdownMenuItem disabled={command.isPending} onSelect={onForward}><Forward className="size-4 shrink-0" />Forward</DropdownMenuItem>}
              {level === "thread" && (
                <>
                  {(onReply || onReplyAll || onForward) && <DropdownMenuSeparator />}
                  <DropdownMenuItem disabled={!taskMessageId} onSelect={() => quickActions.openCreateTaskDialog({ type: "email", id: taskMessageId!, label: messageLabel || "Email" })}>
                    <EntityChipIcon entityType="task" />Create task
                  </DropdownMenuItem>
                  <DropdownMenuItem disabled={!taskMessageId} onSelect={() => quickActions.openCreateIssueDialog({ type: "email", id: taskMessageId!, label: messageLabel || "Email" })}>
                    <EntityChipIcon entityType="issue" />Create issue
                  </DropdownMenuItem>
                  {moreMenuItems}
                  <DropdownMenuSeparator />
                  <DropdownMenuSub>
                    <DropdownMenuSubTrigger disabled={!ids.length || command.isPending}>
                      <FolderInput className="size-4 shrink-0" />Move to folder
                    </DropdownMenuSubTrigger>
                    <DropdownMenuSubContent>
                      {folders.map((folder) => (
                        <DropdownMenuItem key={folder.id} onSelect={() => command.mutate({ action: "move", ids, folderId: folder.id }, { onSuccess: () => rememberEmailFolder(folder.id) })}>
                          {folder.name}
                        </DropdownMenuItem>
                      ))}
                    </DropdownMenuSubContent>
                  </DropdownMenuSub>
                  <DropdownMenuItem disabled={!ids.length || command.isPending} className="text-destructive" onSelect={() => command.mutate({ action: "move", ids, folderId: "deleteditems" })}>
                    <Trash2 className="size-4 shrink-0" />Delete
                  </DropdownMenuItem>
                </>
              )}
            </DropdownMenuContent>
          </DropdownMenu>
        )}
        <SearchableSelect items={folders} value={null} open={moveOpen} onOpenChange={setMoveOpen} getItemId={(folder) => folder.id} getItemLabel={(folder) => folder.name} searchPlaceholder="Search Microsoft folders…" disabled={!ids.length || command.isPending} onValueChange={(folder) => { if (folder) command.mutate({ action: "move", ids, folderId: folder.id }, { onSuccess: () => rememberEmailFolder(folder.id) }); }} trigger={<span aria-hidden="true" />} />
      </EmailActionGroup>
      {!hideAssignee &&
        (level === "thread" ? (
          <EmailActionGroup label="Email responsibility">
            {assigneeControl}
          </EmailActionGroup>
        ) : (
          assigneeControl
        ))}
      {command.error && (
        <span role="alert" className="max-w-40 text-xs text-destructive">
          {command.error.message}
        </span>
      )}
    </div>
  );
}
