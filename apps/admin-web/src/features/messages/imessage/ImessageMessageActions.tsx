'use client';

import { useEffect, useState } from 'react';
import {
  Button,
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuSub,
  DropdownMenuSubContent,
  DropdownMenuSubTrigger,
  DropdownMenuTrigger,
} from '@altitutor/ui';
import { MoreHorizontal } from 'lucide-react';
import { useImessageControl } from './hooks';
import { ImessageCommandDialog } from './ImessageCommandDialog';
import { ImessageEditDialog } from './ImessageEditDialog';
import {
  IMESSAGE_EDIT_WINDOW_MS,
  IMESSAGE_UNSEND_WINDOW_MS,
  canEditImessage,
  canUnsendImessage,
  formatImessageWindowRemaining,
  imessageWindowRemainingMs,
  messageSentAtMs,
} from './imessageWindows';
import type { IssueWithTags } from '@/features/issues/types';

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
  onCreateIssue?: () => void;
  onAddToIssue?: (issue: IssueWithTags) => void;
}

const TAPBACKS = [
  ['love', '❤️'],
  ['like', '👍'],
  ['dislike', '👎'],
  ['laugh', '😂'],
  ['emphasize', '‼️'],
  ['question', '❓'],
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
  onCreateIssue,
  onAddToIssue,
}: ImessageMessageActionsProps) {
  const control = useImessageControl();
  const [editOpen, setEditOpen] = useState(false);
  const [unsendOpen, setUnsendOpen] = useState(false);
  const [now, setNow] = useState(Date.now());

  const hasImessageActions = Boolean(imessageGuid);
  const hasIssueActions = showCreateIssue && Boolean(onCreateIssue);
  const sentAtMs = messageSentAtMs(sentAt, createdAt);
  const canEdit = isOwnMessage && hasImessageActions && canEditImessage(sentAtMs, now);
  const canUnsend = isOwnMessage && hasImessageActions && canUnsendImessage(sentAtMs, now);
  const editRemaining = imessageWindowRemainingMs(sentAtMs, IMESSAGE_EDIT_WINDOW_MS, now);
  const unsendRemaining = imessageWindowRemainingMs(sentAtMs, IMESSAGE_UNSEND_WINDOW_MS, now);

  useEffect(() => {
    if (!isOwnMessage || !hasImessageActions) return;
    if (!canEditImessage(sentAtMs) && !canUnsendImessage(sentAtMs)) return;
    const id = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(id);
  }, [isOwnMessage, hasImessageActions, sentAtMs]);

  if (!hasImessageActions && !hasIssueActions) return null;

  const editMessage = async (text: string) => {
    if (!imessageGuid || !canEditImessage(messageSentAtMs(sentAt, createdAt))) return;
    await control.mutateAsync({
      commandType: 'edit_message',
      messageId,
      conversationId: conversationId ?? undefined,
      payload: { imessageGuid, text },
    });
    setEditOpen(false);
  };

  const confirmUnsend = async (reason?: string) => {
    if (!imessageGuid || !canUnsendImessage(messageSentAtMs(sentAt, createdAt))) return;
    await control.mutateAsync({
      commandType: 'unsend_message',
      messageId,
      conversationId: conversationId ?? undefined,
      payload: { imessageGuid },
      reason,
    });
    setUnsendOpen(false);
  };

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="ghost" size="icon" className="h-7 w-7" aria-label="Message actions">
            <MoreHorizontal className="h-4 w-4" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align={isOwnMessage ? 'end' : 'start'}>
          {hasIssueActions && (
            <>
              <DropdownMenuItem
                disabled={issueActionLoading}
                onClick={() => onCreateIssue?.()}
              >
                Create issue
              </DropdownMenuItem>
              {matchedIssues.map((issue) => (
                <DropdownMenuItem
                  key={issue.id}
                  disabled={issueActionLoading}
                  onClick={() => onAddToIssue?.(issue)}
                >
                  Add to open issue: {issue.name ?? ''}
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
                      onClick={() => control.mutate({
                        commandType: 'react',
                        messageId,
                        conversationId: conversationId ?? undefined,
                        payload: { imessageGuid, reaction },
                      })}
                    >
                      <span className="text-base leading-none">{emoji}</span>
                    </DropdownMenuItem>
                  ))}
                </DropdownMenuSubContent>
              </DropdownMenuSub>
              {canEdit && (
                <DropdownMenuItem onClick={() => setEditOpen(true)}>
                  Edit sent message ({formatImessageWindowRemaining(editRemaining)})
                </DropdownMenuItem>
              )}
              {canUnsend && (
                <DropdownMenuItem onClick={() => setUnsendOpen(true)}>
                  Unsend for everyone… ({formatImessageWindowRemaining(unsendRemaining)})
                </DropdownMenuItem>
              )}
            </>
          )}
        </DropdownMenuContent>
      </DropdownMenu>

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
