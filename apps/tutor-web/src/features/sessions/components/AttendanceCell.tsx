'use client';

import { cn } from '@/shared/utils/index';

type AttendanceCellProps = {
  status: 'attending' | 'absent' | 'rescheduled' | 'credited' | 'swapped' | 'attended' | 'did-not-attend' | 'not-logged';
  linkTo?: {
    type: 'session' | 'staff';
    id: string;
    onClick: () => void;
  };
  linkText?: string;
  staffType?: 'PRIMARY' | 'ASSISTANT' | 'TRIAL';
};

export function AttendanceCell({ status, linkTo, linkText, staffType }: AttendanceCellProps) {
  const getStatusConfig = () => {
    switch (status) {
      case 'attending':
        return {
          text: 'Attending',
          className: 'bg-green-50 text-green-700 dark:bg-green-900/20 dark:text-green-400',
        };
      case 'absent':
        return {
          text: 'Absent',
          className: 'bg-red-50 text-red-700 dark:bg-red-900/20 dark:text-red-400',
        };
      case 'rescheduled':
        return {
          text: `Rescheduled${linkText ? `: ${linkText}` : ''}`,
          className: 'bg-yellow-50 text-yellow-700 dark:bg-yellow-900/20 dark:text-yellow-400',
        };
      case 'credited':
        return {
          text: 'Credited',
          className: 'bg-blue-50 text-blue-700 dark:bg-blue-900/20 dark:text-blue-400',
        };
      case 'swapped':
        return {
          text: `Swapped${linkText ? `: ${linkText}` : ''}`,
          className: 'bg-yellow-50 text-yellow-700 dark:bg-yellow-900/20 dark:text-yellow-400',
        };
      case 'attended':
        const typeText = staffType ? ` (${staffType})` : '';
        return {
          text: `Attended${typeText}`,
          className: 'bg-green-50 text-green-700 dark:bg-green-900/20 dark:text-green-400',
        };
      case 'did-not-attend':
        return {
          text: 'Did not attend',
          className: 'bg-red-50 text-red-700 dark:bg-red-900/20 dark:text-red-400',
        };
      case 'not-logged':
        return {
          text: '—',
          className: 'text-muted-foreground',
        };
    }
  };
  
  const config = getStatusConfig();
  
  const content = (
    <span className={cn('px-2 py-1 rounded-md text-sm inline-block', config.className)}>
      {config.text}
    </span>
  );
  
  if (linkTo && linkText) {
    return (
      <button
        type="button"
        onClick={linkTo.onClick}
        className="text-left hover:opacity-80 transition-opacity"
      >
        {content}
      </button>
    );
  }
  
  return content;
}


