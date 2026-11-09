"use client";

import { useEffect, useRef } from "react";
import { EntityChipIcon, SearchableSelect } from "@altitutor/ui";
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
  const assignee = staff.find((member) => member.id === assigneeId) ?? null;
  const assignedLabel = assignee ? staffName(assignee) : assigneeId ? "Assigned" : "Unassigned";
  const createTask = useRef(onCreateTask);
  createTask.current = onCreateTask;

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key.toLowerCase() !== "t" || event.metaKey || event.ctrlKey || event.altKey || event.shiftKey || event.defaultPrevented || event.isComposing) return;
      const row = root.current?.closest("[data-conversation-row]");
      const hovered = document.querySelector("[data-conversation-row]:hover");
      if (!row || hovered !== row) return;
      const target = event.target;
      if (target instanceof Element && target.closest("input,textarea,select,[contenteditable=true],[role=combobox],[role=dialog],[role=menu]")) return;
      event.preventDefault();
      createTask.current();
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, []);

  return (
    <div ref={root} className="flex items-center gap-1" onClick={(event) => event.stopPropagation()}>
      {unread ? <span aria-label="Unread" className="h-2 w-2 shrink-0 rounded-full bg-blue-500" /> : null}
      <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 focus-within:opacity-100 [@media(hover:none)]:opacity-100">
        <EmailActionGroup label="Conversation actions">
          <EmailIconButton label="Create task" shortcut="T" onClick={onCreateTask}>
            <EntityChipIcon entityType="task" />
          </EmailIconButton>
          <EmailIconButton
            label={unread ? "Mark as read" : "Mark as unread"}
            data-unread={unread ? "true" : undefined}
            onClick={unread ? onMarkRead : onMarkUnread}
          >
            <Mail className="h-4 w-4" />
          </EmailIconButton>
        </EmailActionGroup>
      </div>
      <div className={showAssignee ? undefined : "hidden group-hover:block group-focus-within:block [@media(hover:none)]:block"}>
        <EmailActionGroup label="Conversation assignee">
          <SearchableSelect
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
                className={assigneeId ? "w-auto gap-1 px-2" : undefined}
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
