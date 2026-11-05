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
  CheckSquare,
  Search,
  MoreHorizontal,
  AlertTriangle,
} from "lucide-react";
import { useQuickActions } from "@/shared/contexts/QuickActionsContext";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuSub, DropdownMenuSubContent, DropdownMenuSubTrigger, DropdownMenuTrigger, SearchableSelect } from "@altitutor/ui";
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
}) {
  const quickActions = useQuickActions();
  const taskMessageId = messageId ?? ids[0];
  const command = useEmailCommand();
  const scope = useAccessoryTab();
  const root = useRef<HTMLDivElement>(null);
  const [moveOpen, setMoveOpen] = useState(false);
  const [moreOpen, setMoreOpen] = useState(false);
  const [assignOpen, setAssignOpen] = useState(false);
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
  useEffect(() => {
    const key = (event: KeyboardEvent) => {
      const state = current.current;
      const owner = root.current?.closest("[data-email-shortcut-target]");
      const hoveredOwner = document.querySelector(
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
      if (!["r", "f", "m", "backspace", "u", "a", "t", "i"].includes(action)) return;
      if (event.shiftKey && action !== "r") return;
      if (["t", "i"].includes(action) && !state.taskMessageId) return;
      if (!state.ids.length && ["m", "backspace", "u"].includes(action)) return;
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
      if (action === "m") { if (level === "thread") setMoreOpen(true); else setMoveOpen(true); }
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
    >
      <EmailActionGroup label={level === "thread" ? "Conversation actions" : "Email actions"}>
        {level === "thread" && onSearchToggle && <EmailIconButton label="Search" onClick={onSearchToggle}><Search className="h-4 w-4" /></EmailIconButton>}
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
            <CheckSquare className="h-4 w-4" />
          </EmailIconButton>
        )}
        {level === "message" && onReply && (
          <EmailIconButton
            label="Reply"
            shortcut="R"
            disabled={command.isPending}
            onClick={onReply}
          >
            <Reply className="h-4 w-4" />
          </EmailIconButton>
        )}
        {level === "message" && onReplyAll && (
          <EmailIconButton
            label="Reply all"
            shortcut={["Shift", "R"]}
            disabled={command.isPending}
            onClick={onReplyAll}
          >
            <ReplyAll className="h-4 w-4" />
          </EmailIconButton>
        )}
        {level === "message" && onForward && (
          <EmailIconButton
            label="Forward"
            shortcut="F"
            disabled={command.isPending}
            onClick={onForward}
          >
            <Forward className="h-4 w-4" />
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
        {level === "thread" && <DropdownMenu open={moreOpen} onOpenChange={setMoreOpen}>
          <DropdownMenuTrigger asChild><EmailIconButton label="More"><MoreHorizontal className="h-4 w-4" /></EmailIconButton></DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuItem disabled={!taskMessageId} onSelect={() => quickActions.openCreateTaskDialog({ type: "email", id: taskMessageId!, label: messageLabel || "Email" })}><CheckSquare className="mr-2 h-4 w-4" />Create task<span className="ml-auto text-xs text-muted-foreground">T</span></DropdownMenuItem>
            <DropdownMenuItem disabled={!taskMessageId} onSelect={() => quickActions.openCreateIssueDialog({ type: "email", id: taskMessageId!, label: messageLabel || "Email" })}><AlertTriangle className="mr-2 h-4 w-4" />Create issue<span className="ml-auto text-xs text-muted-foreground">I</span></DropdownMenuItem>
            {moreMenuItems}
            <DropdownMenuSeparator />
            <DropdownMenuSub><DropdownMenuSubTrigger disabled={!ids.length || command.isPending}><FolderInput className="mr-2 h-4 w-4" />Move to folder</DropdownMenuSubTrigger><DropdownMenuSubContent>{folders.map((folder) => <DropdownMenuItem key={folder.id} onSelect={() => command.mutate({ action: "move", ids, folderId: folder.id }, { onSuccess: () => rememberEmailFolder(folder.id) })}>{folder.name}</DropdownMenuItem>)}</DropdownMenuSubContent></DropdownMenuSub>
            <DropdownMenuItem disabled={!ids.length || command.isPending} className="text-destructive" onSelect={() => command.mutate({ action: "move", ids, folderId: "deleteditems" })}><Trash2 className="mr-2 h-4 w-4" />Delete</DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>}
        {level === "message" && <SearchableSelect items={folders} value={null} open={moveOpen} onOpenChange={setMoveOpen} getItemId={(folder) => folder.id} getItemLabel={(folder) => folder.name} searchPlaceholder="Search Microsoft folders…" disabled={!ids.length || command.isPending} onValueChange={(folder) => { if (folder) command.mutate({ action: "move", ids, folderId: folder.id }, { onSuccess: () => rememberEmailFolder(folder.id) }); }} trigger={<span aria-hidden="true" />} />}
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
