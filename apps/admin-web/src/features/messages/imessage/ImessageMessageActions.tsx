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
  DropdownMenuSub,
  DropdownMenuSubContent,
  DropdownMenuSubTrigger,
  DropdownMenuTrigger,
  Input,
} from '@altitutor/ui';
import { MoreHorizontal } from 'lucide-react';
import { useImessageControl } from './hooks';
import { ImessageCommandDialog } from './ImessageCommandDialog';

interface ImessageMessageActionsProps {
  messageId: string;
  imessageGuid: string;
  body: string;
  isOwnMessage: boolean;
}

type DestructiveAction = 'unsend_message' | 'delete_message';

const TAPBACKS = [
  ['love', 'Love', '❤️'],
  ['like', 'Like', '👍'],
  ['dislike', 'Dislike', '👎'],
  ['laugh', 'Laugh', '😂'],
  ['emphasize', 'Emphasize', '‼️'],
  ['question', 'Question', '❓'],
] as const;

export function ImessageMessageActions({
  messageId,
  imessageGuid,
  body,
  isOwnMessage,
}: ImessageMessageActionsProps) {
  const control = useImessageControl();
  const [editOpen, setEditOpen] = useState(false);
  const [editedBody, setEditedBody] = useState(body);
  const [destructiveAction, setDestructiveAction] = useState<DestructiveAction | null>(null);

  const editMessage = async () => {
    await control.mutateAsync({
      commandType: 'edit_message',
      messageId,
      payload: { imessageGuid, text: editedBody.trim() },
    });
    setEditOpen(false);
  };

  const confirmDestructive = async (reason?: string) => {
    if (!destructiveAction) return;
    await control.mutateAsync({
      commandType: destructiveAction,
      messageId,
      payload: { imessageGuid, scope: destructiveAction === 'delete_message' ? 'local_chat_record' : 'imessage' },
      reason,
    });
    setDestructiveAction(null);
  };

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="ghost" size="icon" className="h-7 w-7" aria-label="iMessage actions">
            <MoreHorizontal className="h-4 w-4" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align={isOwnMessage ? 'end' : 'start'}>
          <DropdownMenuSub>
            <DropdownMenuSubTrigger>React / Tapback</DropdownMenuSubTrigger>
            <DropdownMenuSubContent>
              {TAPBACKS.map(([reaction, label, emoji]) => (
                <DropdownMenuItem
                  key={reaction}
                  onClick={() => control.mutate({
                    commandType: 'react',
                    messageId,
                    payload: { imessageGuid, reaction },
                  })}
                >
                  <span className="mr-2" aria-hidden>{emoji}</span>
                  {label}
                </DropdownMenuItem>
              ))}
            </DropdownMenuSubContent>
          </DropdownMenuSub>
          {isOwnMessage && (
            <>
              <DropdownMenuItem onClick={() => setEditOpen(true)}>Edit sent message</DropdownMenuItem>
              <DropdownMenuItem onClick={() => setDestructiveAction('unsend_message')}>
                Unsend for everyone…
              </DropdownMenuItem>
            </>
          )}
          <DropdownMenuItem onClick={() => setDestructiveAction('delete_message')}>
            Delete local/chat record…
          </DropdownMenuItem>
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
        open={destructiveAction !== null}
        onOpenChange={(open) => !open && setDestructiveAction(null)}
        title={destructiveAction === 'unsend_message' ? 'Unsend this iMessage?' : 'Delete local/chat record?'}
        description={
          destructiveAction === 'unsend_message'
            ? 'This requests removal for all iMessage participants.'
            : 'This deletes the message from the connector chat record. It is not labelled as an unsend.'
        }
        confirmLabel={destructiveAction === 'unsend_message' ? 'Unsend message' : 'Delete local/chat record'}
        destructive
        pending={control.isPending}
        onConfirm={confirmDestructive}
      />
    </>
  );
}
