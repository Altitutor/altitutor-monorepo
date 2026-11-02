'use client';

import { useState } from 'react';
import {
  Button,
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSub,
  DropdownMenuSubContent,
  DropdownMenuSubTrigger,
  DropdownMenuTrigger,
  SearchableSelectInline,
} from '@altitutor/ui';
import { Mail } from 'lucide-react';
import { cn } from '@/shared/utils';
import type { AdminStaffOption } from '../api/queries';

function staffName(staff: AdminStaffOption): string {
  const name = `${staff.first_name ?? ''} ${staff.last_name ?? ''}`.trim();
  return name || 'Admin staff';
}

interface UnreadConversationMenuProps {
  unread: boolean;
  staff: AdminStaffOption[];
  staffLoading?: boolean;
  assigneeId: string | null;
  onMarkRead: () => void;
  onMarkUnread: () => void;
  onAssign: (staffId: string) => void;
}

export function UnreadConversationMenu({
  unread,
  staff,
  staffLoading = false,
  assigneeId,
  onMarkRead,
  onMarkUnread,
  onAssign,
}: UnreadConversationMenuProps) {
  const [open, setOpen] = useState(false);
  const assignee = staff.find((member) => member.id === assigneeId) ?? null;
  const assignedLabel = assignee ? `Assigned to ${staffName(assignee)}` : assigneeId ? 'Assigned' : null;

  if (!unread) {
    return (
      <Button
        size="sm"
        variant="outline"
        className="h-6 w-6 p-0 shrink-0 transition-none"
        title="Mark as unread"
        aria-label="Mark as unread"
        onClick={(event) => {
          event.stopPropagation();
          onMarkUnread();
        }}
      >
        <Mail className="h-3 w-3" />
      </Button>
    );
  }

  return (
    <DropdownMenu open={open} onOpenChange={setOpen}>
      <DropdownMenuTrigger asChild>
        <Button
          size="sm"
          variant="default"
          className={cn('h-6 w-6 p-0 shrink-0 transition-none bg-red-500 text-white hover:bg-red-600 border-transparent')}
          title={assignedLabel ? `${assignedLabel}. Mark as read or reassign` : 'Mark as read or assign'}
          aria-label={assignedLabel ? `Conversation actions, ${assignedLabel}` : 'Conversation actions'}
          onClick={(event) => event.stopPropagation()}
        >
          <Mail className="h-3 w-3" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" onClick={(event) => event.stopPropagation()}>
        <DropdownMenuItem
          onSelect={() => {
            onMarkRead();
          }}
        >
          Mark as read
        </DropdownMenuItem>
        <DropdownMenuSub>
          <DropdownMenuSubTrigger>Assign to</DropdownMenuSubTrigger>
          <DropdownMenuSubContent className="w-64 p-0">
            <SearchableSelectInline<AdminStaffOption>
              items={staff}
              value={assignee}
              onValueChange={(member) => {
                if (!member) return;
                onAssign(member.id);
                setOpen(false);
              }}
              getItemId={(member) => member.id}
              getItemLabel={staffName}
              searchPlaceholder="Search admin staff..."
              emptyMessage={staffLoading ? 'Loading admin staff...' : 'No admin staff found'}
              loading={staffLoading}
              className="max-h-60"
            />
          </DropdownMenuSubContent>
        </DropdownMenuSub>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
