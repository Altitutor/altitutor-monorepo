'use client';

import { cn } from '@/shared/utils';
import { STUDENT_SHELL_PAD_Y } from '@/shared/lib/student-layout';

type StudentPageContainerProps = {
  children: React.ReactNode;
  className?: string;
};

/**
 * Vertical rhythm for a student route section.
 * Horizontal padding and max width are applied once in `(student)/layout.tsx`.
 */
export function StudentPageContainer({ children, className }: StudentPageContainerProps) {
  return <div className={cn(STUDENT_SHELL_PAD_Y, className)}>{children}</div>;
}
