'use client';

import { DatePickerPill } from '@/shared/components/DatePickerPill';
import { isIssueOverdue } from '../utils/issueUtils';

interface IssueDueDateEntityPillProps {
  dueDate: string | null;
  collapsed?: boolean;
  onChange: (dueDate: string | null) => void;
}

export function IssueDueDateEntityPill({ dueDate, onChange }: IssueDueDateEntityPillProps) {
  return (
    <DatePickerPill
      value={dueDate}
      onChange={onChange}
      valueFormat="iso"
      overdue={isIssueOverdue(dueDate)}
    />
  );
}
