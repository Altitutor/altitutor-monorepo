'use client';

import { useMemo, useState, useEffect } from 'react';
import { format } from 'date-fns';
import { useSessionWithTutorLog } from '@/features/sessions/hooks/useSessionsQuery';
import { useCurrentStaff } from '@/shared/hooks';
import { getBookingConfirmationUrl } from '@/shared/utils/invites';
import {
  getBookingConfirmationMessageForClient,
  getSenderNameFromStaff,
} from '@/features/messages/api/systemTemplates';
import { BookingNotifyMessageScreen } from '../BookingNotifyMessageScreen';
import type { NotifyRecipient } from '../BookingNotifyMessageScreen';

export interface StaffInterviewMessageStepProps {
  sessionId: string;
}

export function StaffInterviewMessageStep({
  sessionId,
}: StaffInterviewMessageStepProps) {
  const { data: currentStaff } = useCurrentStaff();
  const { data: sessionData, isLoading } = useSessionWithTutorLog(
    sessionId,
    !!sessionId
  );

  const sessionsStaff = sessionData?.sessionsStaff ?? [];
  const staffList = sessionsStaff
    .map((row) =>
      (
        row as {
          staff?: {
            id: string;
            first_name: string | null;
            last_name: string | null;
            phone_number?: string | null;
          } | null;
        }
      ).staff
    )
    .filter((s): s is NonNullable<typeof s> => !!s);

  const recipients: NotifyRecipient[] = useMemo(
    () =>
      staffList.map((staff) => ({
        type: 'staff' as const,
        id: staff.id,
        label: `${staff.first_name ?? ''} ${staff.last_name ?? ''}`.trim() || 'Staff',
        value: staff.phone_number ?? undefined,
      })),
    [staffList]
  );

  const [defaultDraft, setDefaultDraft] = useState('');
  useEffect(() => {
    if (!sessionData || recipients.length === 0) return;
    const session = (sessionData as { session?: { start_at?: string; end_at?: string } }).session
      ?? (sessionData as { start_at?: string; end_at?: string });
    const sessionDate = session?.start_at
      ? format(new Date(session.start_at), 'EEEE, dd MMMM yyyy')
      : undefined;
    const sessionTime =
      session?.start_at && session?.end_at
        ? `${format(new Date(session.start_at), 'h:mm a')} - ${format(new Date(session.end_at), 'h:mm a')}`
        : session?.start_at
          ? format(new Date(session.start_at), 'h:mm a')
          : undefined;
    const bookingUrl = getBookingConfirmationUrl(sessionId);
    const firstName = recipients[0]?.label?.split(' ')[0] || 'there';
    const senderName = getSenderNameFromStaff(currentStaff);

    let cancelled = false;
    (async () => {
      const draft = await getBookingConfirmationMessageForClient({
        firstName,
        bookingUrl,
        sessionDate,
        sessionTime,
        sessionType: 'STAFF_INTERVIEW',
        senderName,
      });
      if (cancelled) return;
      setDefaultDraft(draft);
    })();
    return () => {
      cancelled = true;
    };
  }, [sessionData, sessionId, recipients, currentStaff]);

  if (isLoading) {
    return (
      <div className="py-8 text-center text-muted-foreground">
        Loading session staff...
      </div>
    );
  }

  return (
    <BookingNotifyMessageScreen
      successMessage="Staff interview has been booked successfully"
      recipients={recipients}
      defaultDraft={defaultDraft}
    />
  );
}
