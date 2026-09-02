'use client';

import { useState } from 'react';
import {
  Button,
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  Input,
  Label,
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '@altitutor/ui';
import { AdminDialogShell } from '@/shared/components';
import { Users } from 'lucide-react';
import { useImessageControl } from './hooks';
import { ImessageCommandDialog } from './ImessageCommandDialog';
import type { ImessageCommandType } from './types';

type EditableAction = 'update_chat' | 'add_participant' | 'remove_participant';
type DestructiveAction =
  | 'leave_chat'
  | 'delete_chat'
  | 'remove_participant'
  | 'remove_group_icon';

interface GroupConversationActionsProps {
  conversationId: string;
  currentName: string | null;
  expanded?: boolean;
  variant?: 'button' | 'menu';
}

export function GroupConversationActions({
  conversationId,
  currentName,
  expanded = false,
  variant = 'button',
}: GroupConversationActionsProps) {
  const control = useImessageControl();
  const [editableAction, setEditableAction] = useState<EditableAction | null>(null);
  const [destructiveAction, setDestructiveAction] = useState<DestructiveAction | null>(null);
  const [value, setValue] = useState('');

  const openEditable = (action: EditableAction) => {
    setValue(action === 'update_chat' ? currentName ?? '' : '');
    setEditableAction(action);
  };

  const runEditable = async () => {
    if (!editableAction) return;
    if (editableAction === 'remove_participant') {
      setEditableAction(null);
      setDestructiveAction('remove_participant');
      return;
    }
    const payload =
      editableAction === 'update_chat'
        ? { name: value.trim() }
        : { participant: value.trim() };
    await control.mutateAsync({ commandType: editableAction, conversationId, payload });
    setEditableAction(null);
  };

  const runDestructive = async (reason?: string) => {
    if (!destructiveAction) return;
    await control.mutateAsync({
      commandType: destructiveAction,
      conversationId,
      payload: destructiveAction === 'remove_participant' ? { participant: value.trim() } : undefined,
      reason,
    });
    setDestructiveAction(null);
  };

  const editableLabel = (action: EditableAction | null): string => {
    switch (action) {
      case 'update_chat':
        return 'Group name';
      case 'add_participant':
        return 'Participant phone or handle';
      case 'remove_participant':
        return 'Participant phone or handle';
      case null:
        return '';
      default: {
        const exhaustive: never = action;
        return exhaustive;
      }
    }
  };

  const destructiveCommand: ImessageCommandType | null = destructiveAction;

  const menuItems = (
    <>
      <DropdownMenuItem onClick={() => openEditable('update_chat')}>Rename group</DropdownMenuItem>
      <DropdownMenuItem onClick={() => openEditable('add_participant')}>Add participant</DropdownMenuItem>
      <DropdownMenuItem onClick={() => openEditable('remove_participant')}>Remove participant</DropdownMenuItem>
      <DropdownMenuItem onClick={() => setDestructiveAction('remove_group_icon')}>Remove group icon…</DropdownMenuItem>
      <DropdownMenuItem onClick={() => setDestructiveAction('leave_chat')}>Leave group…</DropdownMenuItem>
      <DropdownMenuItem onClick={() => setDestructiveAction('delete_chat')}>Delete chat…</DropdownMenuItem>
    </>
  );

  const triggerButton = (
    <Button
      variant="outline"
      size={expanded ? 'sm' : 'icon'}
      className={expanded ? 'flex-shrink-0 gap-1.5' : 'flex-shrink-0'}
      aria-label="Group details and actions"
    >
      <Users className="h-4 w-4" />
      {expanded && <span>Group</span>}
    </Button>
  );

  return (
    <>
      {variant === 'menu' ? (
        menuItems
      ) : expanded ? (
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            {triggerButton}
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            {menuItems}
          </DropdownMenuContent>
        </DropdownMenu>
      ) : (
        <DropdownMenu>
          <Tooltip>
            <TooltipTrigger asChild>
              <DropdownMenuTrigger asChild>
                {triggerButton}
              </DropdownMenuTrigger>
            </TooltipTrigger>
            <TooltipContent side="bottom">Group</TooltipContent>
          </Tooltip>
          <DropdownMenuContent align="end">
            {menuItems}
          </DropdownMenuContent>
        </DropdownMenu>
      )}

      <AdminDialogShell
        open={editableAction !== null}
        onClose={() => setEditableAction(null)}
        title={editableLabel(editableAction)}
        footer={
          <>
            <Button variant="outline" onClick={() => setEditableAction(null)}>Cancel</Button>
            <Button disabled={!value.trim() || control.isPending} onClick={runEditable}>Queue change</Button>
          </>
        }
      >
        <div className="space-y-2">
          <Label htmlFor="group-action-value">{editableLabel(editableAction)}</Label>
          <Input id="group-action-value" value={value} onChange={(event) => setValue(event.target.value)} />
        </div>
      </AdminDialogShell>

      <ImessageCommandDialog
        open={destructiveCommand !== null}
        onOpenChange={(open) => !open && setDestructiveAction(null)}
        title={
          destructiveAction === 'leave_chat'
            ? 'Leave this iMessage group?'
            : destructiveAction === 'remove_participant'
              ? `Remove ${value.trim()} from this group?`
              : destructiveAction === 'remove_group_icon'
                ? 'Remove this group icon?'
              : 'Delete this iMessage chat?'
        }
        description={
          destructiveAction === 'leave_chat'
            ? 'The dedicated Mac will leave this group conversation.'
            : destructiveAction === 'remove_participant'
              ? 'The participant will be removed from the iMessage group.'
              : destructiveAction === 'remove_group_icon'
                ? 'The group icon will be removed for iMessage participants.'
              : 'This requests deletion of the chat from the dedicated Mac.'
        }
        confirmLabel={
          destructiveAction === 'leave_chat'
            ? 'Leave group'
            : destructiveAction === 'remove_participant'
              ? 'Remove participant'
              : destructiveAction === 'remove_group_icon'
                ? 'Remove group icon'
              : 'Delete chat'
        }
        destructive
        pending={control.isPending}
        onConfirm={runDestructive}
      />
    </>
  );
}
