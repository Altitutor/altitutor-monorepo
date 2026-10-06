"use client";

import { Button } from "@altitutor/ui";
import { useUnreadConversationCount } from "@/features/messages/api/queries";
import {
  useAccessoryPanel,
  type AccessoryKind,
} from "@/shared/contexts/AccessoryPanelContext";
import { AccessoryIcon } from "./AccessoryIcon";
import { MessageUnreadBadge } from "@/features/messages/components/MessageUnreadBadge";

export const accessoryRootViews: { kind: AccessoryKind; title: string }[] = [
  { kind: "messages", title: "Messages" },
  { kind: "today", title: "Today" },
  { kind: "tasks", title: "Tasks" },
  { kind: "issues", title: "Issues" },
  { kind: "projects", title: "Projects" },
  { kind: "documents", title: "Documents" },
];

export function AccessoryRootViews() {
  const panel = useAccessoryPanel();
  const { data: unreadCount = 0 } = useUnreadConversationCount();
  return (
    <div className="grid w-full max-w-xs gap-2">
      {accessoryRootViews.map((view) => (
        <Button
          key={view.kind}
          variant="outline"
          className="justify-start gap-2"
          onClick={() => panel?.openTab(view)}
        >
          <AccessoryIcon kind={view.kind} className="h-4 w-4" />
          {view.title}
          {view.kind === "messages" && (
            <MessageUnreadBadge count={unreadCount} className="ml-auto" />
          )}
        </Button>
      ))}
    </div>
  );
}
