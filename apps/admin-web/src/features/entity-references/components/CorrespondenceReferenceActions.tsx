"use client";
import { useState, useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  Reply,
  Forward,
  Archive,
  Mail,
  MailOpen,
  Pencil,
  Undo2,
  Smile,
  UserRound,
  UserRoundPlus,
  CheckSquare,
  AlertTriangle,
  FolderInput,
  Trash2,
} from "lucide-react";
import { useRunRecordAction } from "@/features/command-palette/RecordActionsContext";
import { useQuickActions } from "@/shared/contexts/QuickActionsContext";
import { openEntityReference } from "@/shared/utils/entityReference";
import { getEnquirySender } from "@/features/onboarding/api/enquiries";
import { useActiveAdminStaff } from "@/features/messages/api/queries";
import {
  canEditImessage,
  canUnsendImessage,
  messageSentAtMs,
  IMESSAGE_TAPBACKS,
} from "@/features/messages/imessage/imessageWindows";
import type { RecordMenuAction } from "@/shared/components/recordMenuActions";
import type { ReferenceDetails } from "../types";
import { ReferenceActionList } from "./ReferenceActionList";

export function CorrespondenceReferenceActions({
  type,
  id,
  details,
  onActivate,
}: {
  type: "message" | "email";
  id: string;
  details: ReferenceDetails;
  onActivate?: () => void;
}) {
  const launch = useRunRecordAction();
  const quick = useQuickActions();
  const [now, setNow] = useState(Date.now());
  const actionTargetId =
    type === "email" ? (details.actionState?.emailMessageId ?? id) : id;
  const sender = useQuery({
    queryKey: ["onboarding", "enquiry-source", type, actionTargetId],
    queryFn: () => getEnquirySender({ kind: type, id: actionTargetId }),
    staleTime: 30_000,
  });
  const navigate = () => openEntityReference(type, id);
  const run = (actionId: string) =>
    launch?.(type, actionTargetId, actionId, navigate);
  const message = details.actionState?.message;
  const sentAt = messageSentAtMs(message?.sentAt, message?.createdAt);
  useEffect(() => {
    if (!message?.own || !message.hasImessage) return;
    const timer = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(timer);
  }, [message?.own, message?.hasImessage]);
  const actions: RecordMenuAction[] = [
    {
      id: "add-task",
      title: "Create task",
      icon: CheckSquare,
      action: () =>
        quick.openCreateTaskDialog({ type, id, label: details.title }),
    },
    {
      id: "add-issue",
      title: "Create issue",
      icon: AlertTriangle,
      action: () =>
        quick.openCreateIssueDialog({ type, id, label: details.title }),
    },
    ...(sender.data
      ? [
          {
            id: "new-enquiry",
            title: "New enquiry",
            icon: UserRoundPlus,
            action: () => run("new-enquiry"),
          },
        ]
      : []),
  ];
  if (type === "email")
    actions.push(
      {
        id: "reply",
        title: "Reply to email",
        icon: Reply,
        action: () => run("reply"),
      },
      {
        id: "reply-all",
        title: "Reply all",
        icon: Reply,
        action: () => run("reply-all"),
      },
      {
        id: "forward",
        title: "Forward email",
        icon: Forward,
        action: () => run("forward"),
      },
      {
        id: "archive",
        title: "Archive email",
        icon: Archive,
        action: () => run("archive"),
      },
      {
        id: "unread",
        title: "Mark email unread",
        icon: Mail,
        action: () => run("unread"),
      },
    );
  else {
    actions.push(
      {
        id: "mark-read",
        title: "Mark as read",
        icon: MailOpen,
        action: () => run("mark-read"),
      },
      {
        id: "mark-unread",
        title: "Mark as unread",
        icon: Mail,
        action: () => run("mark-unread"),
      },
    );
    if (message?.hasImessage)
      actions.push(
        ...IMESSAGE_TAPBACKS.map(([reaction, emoji]) => ({
          id: `react-${reaction}`,
          title: `React ${emoji}`,
          icon: Smile,
          action: () => run(`react-${reaction}`),
        })),
      );
    if (message?.own && message.hasImessage && canEditImessage(sentAt, now))
      actions.push({
        id: "edit-message",
        title: "Edit sent message",
        icon: Pencil,
        action: () => run("edit-message"),
      });
    if (message?.own && message.hasImessage && canUnsendImessage(sentAt, now))
      actions.push({
        id: "unsend-message",
        title: "Unsend for everyone",
        icon: Undo2,
        action: () => run("unsend-message"),
        destructive: true,
      });
  }
  if (type === "email")
    actions.push(
      {
        id: "mark-read",
        title: "Mark as read",
        icon: MailOpen,
        action: () => run("mark-read"),
      },
      {
        id: "move-folder",
        title: "Move to folder",
        icon: FolderInput,
        action: () => run("move-folder"),
      },
      {
        id: "assign",
        title: "Assign email",
        icon: UserRound,
        action: () => run("assign"),
      },
      {
        id: "delete-email",
        title: "Delete email",
        icon: Trash2,
        destructive: true,
        action: () => run("delete-email"),
      },
    );
  return (
    <>
      <ReferenceActionList actions={actions} onActivate={onActivate} />
      {type === "message" && (
        <MessageAssignments run={run} onActivate={onActivate} />
      )}
    </>
  );
}

function MessageAssignments({
  run,
  onActivate,
}: {
  run: (id: string) => void;
  onActivate?: () => void;
}) {
  const { data: staff = [] } = useActiveAdminStaff();
  return (
    <details className="px-3 py-1.5">
      <summary className="cursor-pointer text-sm">Assign conversation</summary>
      <ReferenceActionList
        onActivate={onActivate}
        actions={[
          {
            id: "unassign",
            title: "Unassign",
            icon: UserRound,
            action: () => run("unassign"),
          },
          ...staff.map((person) => ({
            id: `assign-${person.id}`,
            title: `${person.first_name} ${person.last_name}`,
            icon: UserRound,
            action: () => run(`assign-${person.id}`),
          })),
        ]}
      />
    </details>
  );
}
