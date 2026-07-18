'use client';

import { useState } from 'react';
import {
  Button,
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuSub,
  DropdownMenuSubContent,
  DropdownMenuSubTrigger,
  DropdownMenuTrigger,
  Input,
} from '@altitutor/ui';
import { MoreHorizontal } from 'lucide-react';
import { useImessageControl } from './hooks';
import { ImessageCommandDialog } from './ImessageCommandDialog';
import type { IssueWithTags } from '@/features/issues/types';

interface ImessageMessageActionsProps {
  messageId: string;
  conversationId?: string | null;
  imessageGuid?: string | null;
  body: string;
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
  imessageGuid,
  body,
  isOwnMessage,
  showCreateIssue = false,
  matchedIssues = [],
  issueActionLoading = false,
  onCreateIssue,
  onAddToIssue,
}: ImessageMessageActionsProps) {
  const control = useImessageControl();
  const [editOpen, setEditOpen] = useState(false);
  const [editedBody, setEditedBody] = useState(body);
  const [unsendOpen, setUnsendOpen] = useState(false);

  const hasImessageActions = Boolean(imessageGuid);
  const hasIssueActions = showCreateIssue && Boolean(onCreateIssue);
  if (!hasImessageActions && !hasIssueActions) return null;

  const editMessage = async () => {
    if (!imessageGuid) return;
    await control.mutateAsync({
      commandType: 'edit_message',
      messageId,
      conversationId: conversationId ?? undefined,
      payload: { imessageGuid, text: editedBody.trim() },
    });
    setEditOpen(false);
  };

  const confirmUnsend = async (reason?: string) => {
    if (!imessageGuid) return;
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
              {isOwnMessage && (
                <>
                  <DropdownMenuItem onClick={() => setEditOpen(true)}>Edit sent message</DropdownMenuItem>
                  <DropdownMenuItem onClick={() => setUnsendOpen(true)}>
                    Unsend for everyone…
                  </DropdownMenuItem>
                </>
              )}
            </>
          )}
        </DropdownMenuContent>
      </DropdownMenu>

      <Dialog open={editOpen} onOpenChange={setEditOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>Edit iMessage</DialogTitle></DialogHeader>
          <Input value={editedBody} onChange={(event) => setEditedBody(event.target.value)} />
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditOpen(false)}>Cancel</Button>
            <Button disabled={!editedBody.trim() || control.isPending} onClick={editMessage}>Queue edit</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <ImessageCommandDialog
        open={unsendOpen}
        onOpenChange={(open) => !open && setUnsendOpen(false)}
        title="Unsend this iMessage?"
        description="This requests removal for all iMessage participants."
        confirmLabel="Unsend message"
        destructive
        pending={control.isPending}
        onConfirm={confirmUnsend}
      />
    </>
  );
}
