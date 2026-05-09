'use client';

import { cn } from '@/shared/utils';
import { TUTOR_CONTENT_MAX, TUTOR_SHELL_PAD_X, TUTOR_SHELL_PAD_Y } from '@/shared/lib/tutor-layout';

export default function TutorMessagesPage() {
  return (
    <div className={cn('mx-auto w-full min-w-0', TUTOR_CONTENT_MAX, TUTOR_SHELL_PAD_X, TUTOR_SHELL_PAD_Y)}>
      <h1 className="mb-2 text-3xl font-bold tracking-tight">Messages</h1>
      <p className="text-muted-foreground">This page is under construction.</p>
    </div>
  );
}


