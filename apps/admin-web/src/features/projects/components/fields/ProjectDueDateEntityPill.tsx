'use client';

import { isOverdue } from '@/shared/utils/datetime';
import { DatePickerPill } from '@/shared/components/DatePickerPill';

interface ProjectDueDateEntityPillProps {
  targetDate: string | null;
  collapsed?: boolean;
  onChange: (targetDate: string | null) => void;
}

export function ProjectDueDateEntityPill({
  targetDate,
  onChange,
}: ProjectDueDateEntityPillProps) {
  return (
    <DatePickerPill
      value={targetDate}
      onChange={onChange}
      valueFormat="iso"
      overdue={isOverdue(targetDate)}
    />
  );
}
