"use client";

import { useEffect, useState } from "react";
import {
  Tooltip,
  TooltipProvider,
  TooltipTrigger,
  TooltipContent,
  Button,
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuSub,
  DropdownMenuSubContent,
  DropdownMenuSubTrigger,
  DropdownMenuTrigger,
} from "@altitutor/ui";
import { MoreHorizontal, CheckSquare, AlertTriangle } from "lucide-react";
import { useQuickActions } from "@/shared/contexts/QuickActionsContext";
import { useImessageControl } from "./hooks";
import { ImessageCommandDialog } from "./ImessageCommandDialog";
import { ImessageEditDialog } from "./ImessageEditDialog";
import {
  IMESSAGE_EDIT_WINDOW_MS,
  IMESSAGE_UNSEND_WINDOW_MS,
  canEditImessage,
  canUnsendImessage,
  formatImessageWindowRemaining,
  imessageWindowRemainingMs,
  messageSentAtMs,
} from "./imessageWindows";
import type { IssueWithTags } from "@/features/issues/types";

interface ImessageMessageActionsProps {
  messageId: string;
  conversationId?: string | null;
  contactId?: string | null;
  imessageGuid?: string | null;
  body: string;
  sentAt?: string | null;
  createdAt?: string | null;
  isOwnMessage: boolean;
  showCreateIssue?: boolean;
  matchedIssues?: IssueWithTags[];
  issueActionLoading?: boolean;
  onAddToIssue?: (issue: IssueWithTags) => void;
}

const TAPBACKS = [
  ["love", "❤️"],
  ["like", "👍"],
  ["dislike", "👎"],
  ["laugh", "😂"],
  ["emphasize", "‼️"],
  ["question", "❓"],
] as const;

export function ImessageMessageActions({
  messageId,
  conversationId,
  contactId,
  imessageGuid,
  body,
  sentAt,
  createdAt,
  isOwnMessage,
  showCreateIssue = false,
  matchedIssues = [],
  issueActionLoading = false,
  onAddToIssue,
}: ImessageMessageActionsProps) {
  const quickActions = useQuickActions();
  const reference = {
    type: "message",
    id: messageId,
    label: body.slice(0, 120) || "Message",
  };
  const createIssue = () => quickActions.openCreateIssueDialog(reference);
  const control = useImessageControl();
  const [editOpen, setEditOpen] = useState(false);
  const [unsendOpen, setUnsendOpen] = useState(false);
  const [now, setNow] = useState(Date.now());

  const hasImessageActions = Boolean(imessageGuid);
  const hasIssueActions = showCreateIssue && matchedIssues.length > 0;
  const sentAtMs = messageSentAtMs(sentAt, createdAt);
  const canEdit =
    isOwnMessage && hasImessageActions && canEditImessage(sentAtMs, now);
  const canUnsend =
    isOwnMessage && hasImessageActions && canUnsendImessage(sentAtMs, now);
  const editRemaining = imessageWindowRemainingMs(
    sentAtMs,
    IMESSAGE_EDIT_WINDOW_MS,
    now,
  );
  const unsendRemaining = imessageWindowRemainingMs(
    sentAtMs,
    IMESSAGE_UNSEND_WINDOW_MS,
    now,
  );

  useEffect(() => {
    if (!isOwnMessage || !hasImessageActions) return;
    if (!canEditImessage(sentAtMs) && !canUnsendImessage(sentAtMs)) return;
    const id = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(id);
  }, [isOwnMessage, hasImessageActions, sentAtMs]);

  const editMessage = async (text: string) => {
    if (!imessageGuid || !canEditImessage(messageSentAtMs(sentAt, createdAt)))
      return;
    await control.mutateAsync({
      commandType: "edit_message",
      messageId,
      conversationId: conversationId ?? undefined,
      payload: { imessageGuid, text },
    });
    setEditOpen(false);
  };

  const confirmUnsend = async (reason?: string) => {
    if (!imessageGuid || !canUnsendImessage(messageSentAtMs(sentAt, createdAt)))
      return;
    await control.mutateAsync({
      commandType: "unsend_message",
      messageId,
      conversationId: conversationId ?? undefined,
      payload: { imessageGuid },
      reason,
    });
    setUnsendOpen(false);
  };

  return (
    <>
      <TooltipProvider delayDuration={200}>
        <div
          role="toolbar"
          aria-label="Message actions"
          className={`absolute -top-4 z-20 inline-flex items-center rounded-full border bg-background p-0.5 shadow-sm opacity-0 transition-opacity group-hover:opacity-100 focus-within:opacity-100 [@media(hover:none)]:opacity-100 ${isOwnMessage ? "right-0" : "left-0"}`}
        >
          {hasImessageActions &&
            TAPBACKS.filter(([reaction]) =>
              ["love", "like", "laugh"].includes(reaction),
            ).map(([reaction, emoji]) => (
              <Tooltip key={reaction}>
                <TooltipTrigger asChild>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-7 w-7"
                    aria-label={`React ${emoji}`}
                    disabled={control.isPending}
                    onClick={() =>
                      control.mutate({
                        commandType: "react",
                        messageId,
                        conversationId: conversationId ?? undefined,
                        payload: { imessageGuid, reaction },
                      })
                    }
                  >
                    {emoji}
                  </Button>
                </TooltipTrigger>
                <TooltipContent>React {emoji}</TooltipContent>
              </Tooltip>
            ))}
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant="ghost"
                size="icon"
                className="h-7 w-7"
                aria-label="Create task"
                onClick={() => quickActions.openCreateTaskDialog(reference)}
              >
                <CheckSquare className="h-4 w-4" />
              </Button>
            </TooltipTrigger>
            <TooltipContent>Create task</TooltipContent>
          </Tooltip>
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant="ghost"
                size="icon"
                className="h-7 w-7"
                aria-label="Create issue"
                onClick={createIssue}
              >
                <AlertTriangle className="h-4 w-4" />
              </Button>
            </TooltipTrigger>
            <TooltipContent>Create issue</TooltipContent>
          </Tooltip>
          {(hasImessageActions || hasIssueActions) && (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-7 w-7"
                  aria-label="Message actions"
                >
                  <MoreHorizontal className="h-4 w-4" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align={isOwnMessage ? "end" : "start"}>
                {hasIssueActions && (
                  <>
                    <DropdownMenuItem
                      disabled={issueActionLoading}
                      onClick={createIssue}
                    >
                      Create issue
                    </DropdownMenuItem>
                    {matchedIssues.map((issue) => (
                      <DropdownMenuItem
                        key={issue.id}
                        disabled={issueActionLoading}
                        onClick={() => onAddToIssue?.(issue)}
                      >
                        Add to open issue: {issue.name ?? ""}
                      </DropdownMenuItem>
                    ))}
                    {hasImessageActions && <DropdownMenuSeparator />}
                  </>
                )}
                {hasImessageActions && (
                  <>
                    <DropdownMenuSub>
                      <DropdownMenuSubTrigger>React</DropdownMenuSubTrigger>
                      <DropdownMenuSubContent>
                        {TAPBACKS.map(([reaction, emoji]) => (
                          <DropdownMenuItem
                            key={reaction}
                            onClick={() =>
                              control.mutate({
                                commandType: "react",
                                messageId,
                                conversationId: conversationId ?? undefined,
                                payload: { imessageGuid, reaction },
                              })
                            }
                          >
                            <span className="text-base leading-none">
                              {emoji}
                            </span>
                          </DropdownMenuItem>
                        ))}
                      </DropdownMenuSubContent>
                    </DropdownMenuSub>
                    {canEdit && (
                      <DropdownMenuItem onClick={() => setEditOpen(true)}>
                        Edit sent message (
                        {formatImessageWindowRemaining(editRemaining)})
                      </DropdownMenuItem>
                    )}
                    {canUnsend && (
                      <DropdownMenuItem onClick={() => setUnsendOpen(true)}>
                        Unsend for everyone… (
                        {formatImessageWindowRemaining(unsendRemaining)})
                      </DropdownMenuItem>
                    )}
                  </>
                )}
              </DropdownMenuContent>
            </DropdownMenu>
          )}
        </div>
      </TooltipProvider>

      <ImessageEditDialog
        open={editOpen}
        onClose={() => setEditOpen(false)}
        initialBody={body}
        contactId={contactId}
        sentAt={sentAt}
        createdAt={createdAt}
        pending={control.isPending}
        onSave={editMessage}
      />

      <ImessageCommandDialog
        open={unsendOpen}
        onOpenChange={(open) => !open && setUnsendOpen(false)}
        title="Unsend this iMessage?"
        description={`This requests removal for all iMessage participants. Apple only allows unsending for 2 minutes after send (${formatImessageWindowRemaining(unsendRemaining)}).`}
        confirmLabel="Unsend message"
        destructive
        pending={control.isPending}
        onConfirm={confirmUnsend}
      />
    </>
  );
}
