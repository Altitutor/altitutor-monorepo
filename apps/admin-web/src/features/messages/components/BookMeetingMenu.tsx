'use client';

import {
  Button,
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSub,
  DropdownMenuSubContent,
  DropdownMenuSubTrigger,
  DropdownMenuTrigger,
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '@altitutor/ui';
import { Calendar } from 'lucide-react';
import { useQuickActions } from '@/shared/contexts/QuickActionsContext';
import {
  getBookMeetingOptions,
  type BookMeetingContact,
  type BookMeetingKind,
} from '../utils/getBookMeetingOptions';

type PhoneOwner = 'student' | 'parent';

interface BookMeetingMenuProps {
  contact: BookMeetingContact;
  expanded?: boolean;
  variant?: 'button' | 'menu';
  onAction?: () => void;
}

export function BookMeetingMenu({
  contact,
  expanded = false,
  variant = 'button',
  onAction,
}: BookMeetingMenuProps) {
  const options = getBookMeetingOptions(contact);
  const { openBookingModal, openCheckInModal } = useQuickActions();
  const phone = contact?.phone_e164 ?? null;

  if (options.length === 0) return null;

  const personName = (person?: { first_name?: string | null; last_name?: string | null } | null) => ({
    first_name: person?.first_name ?? null,
    last_name: person?.last_name ?? null,
  });

  const run = (kind: BookMeetingKind, phoneOwner?: PhoneOwner) => {
    onAction?.();
    switch (kind) {
      case 'trial':
        openBookingModal('TRIAL_SESSION', {
          createNewStudent: phone ? { phone, phoneOwner: phoneOwner ?? 'student' } : undefined,
        });
        return;
      case 'subsidy':
        openBookingModal('SUBSIDY_INTERVIEW', {
          createNewStudent: phone ? { phone, phoneOwner: phoneOwner ?? 'student' } : undefined,
        });
        return;
      case 'staff-interview':
        openBookingModal('STAFF_INTERVIEW', {
          initialStaffPhone: phone ?? undefined,
        });
        return;
      case 'drafting':
        if (contact?.students?.id) {
          openBookingModal('DRAFTING', { initialStudentId: contact.students.id });
        }
        return;
      case 'check-in':
        if (contact?.students?.id) {
          openCheckInModal({ students: [{ id: contact.students.id, ...personName(contact.students) }] });
        } else if (contact?.parents?.id) {
          openCheckInModal({ parents: [{ id: contact.parents.id, ...personName(contact.parents) }] });
        } else if (contact?.staff?.id) {
          openCheckInModal({ staff: [{ id: contact.staff.id, ...personName(contact.staff) }] });
        }
        return;
      case 'admin-meeting':
        if (contact?.staff?.id) {
          openCheckInModal(
            { staff: [{ id: contact.staff.id, ...personName(contact.staff) }] },
            'ADMIN_MEETING'
          );
        }
        return;
    }
  };

  const items = options.map((option) =>
    option.requiresPhoneOwner ? (
      <DropdownMenuSub key={option.kind}>
        <DropdownMenuSubTrigger>{option.label}</DropdownMenuSubTrigger>
        <DropdownMenuSubContent>
          <DropdownMenuItem onSelect={() => run(option.kind, 'student')}>
            This number is a student
          </DropdownMenuItem>
          <DropdownMenuItem onSelect={() => run(option.kind, 'parent')}>
            This number is a parent
          </DropdownMenuItem>
        </DropdownMenuSubContent>
      </DropdownMenuSub>
    ) : (
      <DropdownMenuItem key={option.kind} onSelect={() => run(option.kind)}>
        {option.label}
      </DropdownMenuItem>
    )
  );

  if (variant === 'menu') {
    return <>{items}</>;
  }

  const trigger = (
    <Button
      variant="outline"
      size={expanded ? 'sm' : 'icon'}
      className={expanded ? 'flex-shrink-0 gap-1.5' : 'flex-shrink-0'}
      aria-label="Book meeting"
    >
      <Calendar className="h-4 w-4" />
      {expanded && <span>Book meeting</span>}
    </Button>
  );

  return (
    <DropdownMenu>
      {expanded ? (
        <DropdownMenuTrigger asChild>{trigger}</DropdownMenuTrigger>
      ) : (
        <Tooltip>
          <TooltipTrigger asChild>
            <DropdownMenuTrigger asChild>{trigger}</DropdownMenuTrigger>
          </TooltipTrigger>
          <TooltipContent side="bottom">Book meeting</TooltipContent>
        </Tooltip>
      )}
      <DropdownMenuContent align="end" className="w-56">
        {items}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
