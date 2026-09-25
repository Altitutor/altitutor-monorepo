'use client';

import { cn } from '@/shared/utils';

type AttendanceToggleProps = {
  value: boolean | null;
  disabled?: boolean;
  onChange: (attended: boolean) => void;
};

export function AttendanceToggle({ value, disabled, onChange }: AttendanceToggleProps) {
  const attendedSelected = value === true;
  const didNotAttendSelected = value === false;

  return (
    <div className="inline-flex shrink-0 overflow-hidden rounded-md border" role="group" aria-label="Attendance">
      <button
        type="button"
        disabled={disabled}
        aria-pressed={attendedSelected}
        onClick={() => onChange(true)}
        className={cn(
          'px-2.5 py-1 text-sm transition-colors disabled:opacity-50',
          attendedSelected
            ? 'bg-green-50 font-medium text-green-700 dark:bg-green-900/30 dark:text-green-400'
            : 'bg-background text-muted-foreground hover:bg-muted/60'
        )}
      >
        Attended
      </button>
      <button
        type="button"
        disabled={disabled}
        aria-pressed={didNotAttendSelected}
        onClick={() => onChange(false)}
        className={cn(
          'border-l px-2.5 py-1 text-sm transition-colors disabled:opacity-50',
          didNotAttendSelected
            ? 'bg-red-50 font-medium text-red-700 dark:bg-red-900/30 dark:text-red-400'
            : 'bg-background text-muted-foreground hover:bg-muted/60'
        )}
      >
        Did not attend
      </button>
    </div>
  );
}
