'use client';

import { cn } from '@/shared/utils';
import { TUTOR_SHELL_PAD_Y } from '@/shared/lib/tutor-layout';

type TutorPageContainerProps = {
  children: React.ReactNode;
  className?: string;
};

/**
 * Vertical rhythm for a tutor route section.
 * Horizontal padding and max width are applied once in `(tutor)/layout.tsx`.
 */
export function TutorPageContainer({ children, className }: TutorPageContainerProps) {
  return <div className={cn(TUTOR_SHELL_PAD_Y, className)}>{children}</div>;
}
