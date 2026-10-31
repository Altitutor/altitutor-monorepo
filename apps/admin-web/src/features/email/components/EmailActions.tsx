"use client";
import { useEffect, useRef, useState } from "react";
import {
  Mail,
  MailOpen,
  FolderInput,
  Trash2,
  UserRound,
  Reply,
  Forward,
} from "lucide-react";
import { SearchableSelect } from "@altitutor/ui";
import { useEmailCommand } from "../api/client";
import type { EmailFolder, MailboxData } from "../types";
import { useAccessoryTab } from "@/shared/contexts/AccessoryTabContext";
import { EmailIconButton } from "./EmailIconButton";

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
      className="inline-flex shrink-0 items-center rounded-full border bg-muted/25 p-0.5 [&_button]:rounded-full [&_button]:border-0 [&_button]:bg-transparent [&_button]:shadow-none"
    >
      {children}
    </div>
  );
}
export function EmailActions({
  ids,
  threadId,
  read,
  assignedStaffId,
  mailbox,
  hovered = false,
  onReply,
  onForward,
  compact = false,
}: {
  ids: string[];
  threadId: string;
  read: boolean;
  assignedStaffId: string | null;
  mailbox: MailboxData;
  hovered?: boolean;
  onReply?: () => void;
  onForward?: () => void;
  compact?: boolean;
}) {
  const command = useEmailCommand();
  const scope = useAccessoryTab();
  const root = useRef<HTMLDivElement>(null);
  const [moveOpen, setMoveOpen] = useState(false);
  const [assignOpen, setAssignOpen] = useState(false);
  const current = useRef({
    ids,
    read,
    hovered: hovered && scope?.active !== false,
    onReply,
    onForward,
    busy: command.isPending,
  });
  current.current = {
    ids,
    read,
    hovered: hovered && scope?.active !== false,
    onReply,
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
      const ownsInput = owner
        ? hoveredOwner
          ? owner === hoveredOwner
          : owner.contains(document.activeElement)
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
      if (!["r", "f", "m", "backspace", "u", "a"].includes(action)) return;
      if (!state.ids.length && ["m", "backspace", "u"].includes(action)) return;
      if (
        (action === "r" && !state.onReply) ||
        (action === "f" && !state.onForward)
      )
        return;
      event.preventDefault();
      if (action === "r") state.onReply?.();
      if (action === "f") state.onForward?.();
      if (action === "m") setMoveOpen(true);
      if (action === "a") setAssignOpen(true);
      if (action === "u")
        mutate({ action: "read", ids: state.ids, read: !state.read });
      if (action === "backspace")
        mutate({ action: "move", ids: state.ids, folderId: "deleteditems" });
    };
    document.addEventListener("keydown", key);
    return () => document.removeEventListener("keydown", key);
  }, [mutate, scope?.active]);
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
  return (
    <div
      ref={root}
      className="flex items-center gap-1"
      onClick={(event) => event.stopPropagation()}
    >
      <EmailActionGroup label="Email actions">
        {onReply && !compact && (
          <EmailIconButton
            label="Reply (R)"
            disabled={command.isPending}
            onClick={onReply}
          >
            <Reply className="h-4 w-4" />
          </EmailIconButton>
        )}
        {onForward && !compact && (
          <EmailIconButton
            label="Forward (F)"
            disabled={command.isPending}
            onClick={onForward}
          >
            <Forward className="h-4 w-4" />
          </EmailIconButton>
        )}
        <EmailIconButton
          label={read ? "Mark unread (U)" : "Mark read (U)"}
          disabled={!ids.length || command.isPending}
          onClick={() => command.mutate({ action: "read", ids, read: !read })}
        >
          {read ? (
            <Mail className="h-4 w-4" />
          ) : (
            <MailOpen className="h-4 w-4" />
          )}
        </EmailIconButton>
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
            <EmailIconButton
              label={`Assign (A)${selected ? ` · ${name(selected)}` : ""}`}
              disabled={command.isPending}
            >
              <UserRound
                className={`h-4 w-4 ${selected ? "text-primary" : ""}`}
              />
            </EmailIconButton>
          }
        />
        <SearchableSelect
          items={folders}
          value={null}
          open={moveOpen}
          onOpenChange={setMoveOpen}
          getItemId={(folder) => folder.id}
          getItemLabel={(folder) => folder.name}
          searchPlaceholder="Search Microsoft folders…"
          disabled={!ids.length || command.isPending}
          onValueChange={(folder) => {
            if (folder)
              command.mutate(
                { action: "move", ids, folderId: folder.id },
                { onSuccess: () => rememberEmailFolder(folder.id) },
              );
          }}
          trigger={
            <EmailIconButton
              label="Move to folder (M)"
              disabled={!ids.length || command.isPending}
            >
              <FolderInput className="h-4 w-4" />
            </EmailIconButton>
          }
        />
        <EmailIconButton
          label="Delete (Backspace)"
          disabled={!ids.length || command.isPending}
          onClick={() =>
            command.mutate({ action: "move", ids, folderId: "deleteditems" })
          }
        >
          <Trash2 className="h-4 w-4" />
        </EmailIconButton>
      </EmailActionGroup>
      {command.error && (
        <span role="alert" className="max-w-40 text-xs text-destructive">
          {command.error.message}
        </span>
      )}
    </div>
  );
}
