"use client";

import { useEffect, useRef, useState } from "react";
import { EntityChipIcon, SearchableSelect, keyboardPane, keyboardPointerTarget, isTypingTarget } from "@altitutor/ui";
import { Mail, UserRound } from "lucide-react";
import { EmailActionGroup } from "@/features/email/components/EmailActions";
import { EmailIconButton } from "@/features/email/components/EmailIconButton";
import type { AdminStaffOption } from "../api/queries";

function staffName(staff: AdminStaffOption): string {
  const name = `${staff.first_name ?? ""} ${staff.last_name ?? ""}`.trim();
  return name || "Admin staff";
}

export function ConversationRowActions({
  unread,
  staff,
  staffLoading = false,
  assigneeId,
  showAssignee = true,
  onMarkRead,
  onMarkUnread,
  onAssign,
  onCreateTask,
}: {
  unread: boolean;
  staff: AdminStaffOption[];
  staffLoading?: boolean;
  assigneeId: string | null;
  showAssignee?: boolean;
  onMarkRead: () => void;
  onMarkUnread: () => void;
  onAssign: (staffId: string | null) => void;
  onCreateTask: () => void;
}) {
  const root = useRef<HTMLDivElement>(null);
  const [assigneeOpen, setAssigneeOpen] = useState(false);
  const assignee = staff.find((member) => member.id === assigneeId) ?? null;
  const assignedLabel = assignee ? staffName(assignee) : assigneeId ? "Assigned" : "Unassigned";
  const current = useRef({onCreateTask, onMarkRead, onMarkUnread, unread});
  current.current = {onCreateTask, onMarkRead, onMarkUnread, unread};

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      const key = event.key.toLowerCase();
      if (!["t", "a", "u"].includes(key) || event.repeat || event.metaKey || event.ctrlKey || event.altKey || event.shiftKey || event.defaultPrevented || event.isComposing || isTypingTarget(event.target)) return;
      const row = root.current?.closest("[data-conversation-row]");
      const pane = keyboardPane();
      if (!row || row.closest('[hidden],[inert]') || !pane.contains(row) || pane.matches('[role="dialog"],[role="menu"],[role="alertdialog"]')) return;
      const focused = document.activeElement?.closest("[data-conversation-row]");
      const hovered = keyboardPointerTarget()?.closest("[data-conversation-row]") ?? document.querySelector("[data-conversation-row]:hover");
      if (row !== (hovered ?? focused)) return;
      event.preventDefault();
      if (key === "t") current.current.onCreateTask();
      if (key === "a") setAssigneeOpen(true);
      if (key === "u") {
        if (current.current.unread) current.current.onMarkRead();
        else current.current.onMarkUnread();
      }
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, []);

  return (
    <div ref={root} className="flex items-center gap-1" onClick={(event) => event.stopPropagation()}>
      <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 group-has-[:focus-visible]:opacity-100 [@media(hover:none)]:opacity-100">
        <EmailActionGroup label="Conversation actions">
          <EmailIconButton label="Create task" shortcut="T" className="size-6" onClick={onCreateTask}>
            <EntityChipIcon entityType="task" />
          </EmailIconButton>
          <EmailIconButton
            label={unread ? "Mark as read" : "Mark as unread"}
            shortcut="U"
            className="size-6"
            data-unread={unread ? "true" : undefined}
            onClick={unread ? onMarkRead : onMarkUnread}
          >
            <Mail className="h-4 w-4" />
          </EmailIconButton>
        </EmailActionGroup>
      </div>
      <div className={(showAssignee && assigneeId) || assigneeOpen ? undefined : "hidden group-hover:block group-has-[:focus-visible]:block [@media(hover:none)]:block"}>
        <EmailActionGroup label="Conversation assignee">
          <SearchableSelect
            open={assigneeOpen}
            onOpenChange={setAssigneeOpen}
            items={staff}
            value={assignee}
            onValueChange={(member) => onAssign(member?.id ?? null)}
            getItemId={(member) => member.id}
            getItemLabel={staffName}
            allowClear
            clearLabel="Unassigned"
            loading={staffLoading}
            searchPlaceholder="Search admin staff..."
            emptyMessage={staffLoading ? "Loading admin staff..." : "No admin staff found"}
            trigger={
              <EmailIconButton
                label={assigneeId ? `Assign conversation, ${assignedLabel}` : "Assign conversation"}
                className={assigneeId ? "h-6 w-auto gap-1 px-2" : "size-6"}
              >
                <UserRound className="h-4 w-4" />
                {assigneeId && <span className="max-w-[min(12rem,35vw)] truncate text-xs">{assignedLabel}</span>}
              </EmailIconButton>
            }
          />
        </EmailActionGroup>
      </div>
    </div>
  );
}
