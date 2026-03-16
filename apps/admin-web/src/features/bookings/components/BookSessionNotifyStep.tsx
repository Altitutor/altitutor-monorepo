'use client';

import { useMemo, useState, useEffect } from 'react';
import { format } from 'date-fns';
import { useSessionWithTutorLog } from '@/features/sessions/hooks/useSessionsQuery';
import { useCurrentStaff } from '@/shared/hooks';
import { useParentsForStudent } from '@/features/enrollments/hooks/useParentsForStudent';
import { getBookingConfirmationUrl } from '@/shared/utils/invites';
import {
  getBookingConfirmationMessageForClient,
  getSenderNameFromStaff,
} from '@/features/messages/api/systemTemplates';
import { BookingNotifyMessageScreen } from './BookingNotifyMessageScreen';
import type { NotifyRecipient } from './BookingNotifyMessageScreen';

export type BookSessionType = 'DRAFTING' | 'TRIAL_SESSION' | 'SUBSIDY_INTERVIEW';

export interface BookSessionNotifyStepProps {
  sessionId: string;
  sessionType: BookSessionType;
  successMessage: string;
}

export function BookSessionNotifyStep({
  sessionId,
  sessionType,
  successMessage,
}: BookSessionNotifyStepProps) {
  const { data: sessionData, isLoading } = useSessionWithTutorLog(
    sessionId,
    !!sessionId
  );

  const sessionsStudents = useMemo(
    () => sessionData?.sessionsStudents ?? [],
    [sessionData?.sessionsStudents]
  );
  const sessionsStaff = useMemo(
    () => sessionData?.sessionsStaff ?? [],
    [sessionData?.sessionsStaff]
  );

  const studentIds = useMemo(
    () =>
      sessionsStudents
        .map((row) => (row as { student_id?: string }).student_id)
        .filter((id): id is string => !!id),
    [sessionsStudents]
  );
  const firstStudentId = studentIds[0];

  const { data: currentStaff } = useCurrentStaff();
  const { data: parents = [] } = useParentsForStudent(
    firstStudentId,
    !!firstStudentId && (sessionType === 'SUBSIDY_INTERVIEW' || sessionType === 'TRIAL_SESSION')
  );

  const recipients: NotifyRecipient[] = useMemo(() => {
    const result: NotifyRecipient[] = [];

    if (sessionType === 'DRAFTING') {
      // Drafting: students + staff
      const seenStudents = new Set<string>();
      sessionsStudents.forEach((row) => {
        const student = (row as { student?: { id: string; first_name: string | null; last_name: string | null; phone?: string | null } | null }).student;
        if (student && !seenStudents.has(student.id)) {
          seenStudents.add(student.id);
          result.push({
            type: 'student',
            id: student.id,
            label: `${student.first_name ?? ''} ${student.last_name ?? ''}`.trim() || 'Student',
            value: student.phone ?? undefined,
          });
        }
      });
      sessionsStaff.forEach((row) => {
        const staff = (row as { staff?: { id: string; first_name: string | null; last_name: string | null; phone_number?: string | null } | null }).staff;
        if (staff) {
          result.push({
            type: 'staff',
            id: staff.id,
            label: `${staff.first_name ?? ''} ${staff.last_name ?? ''}`.trim() || 'Staff',
            value: staff.phone_number ?? undefined,
          });
        }
      });
    } else {
      // Subsidy / Trial: student + parents
      const student = (sessionsStudents[0] as { student?: { id: string; first_name: string | null; last_name: string | null; phone?: string | null } | null })?.student;
      if (student) {
        if (student.phone) {
          result.push({
            type: 'student',
            id: student.id,
            label: 'Student Phone',
            value: student.phone,
          });
        }
        parents.forEach((p) => {
          if (p.phone) {
            result.push({
              type: 'parent',
              id: p.id,
              label: `${p.first_name} ${p.last_name} Phone`,
              value: p.phone,
            });
          }
        });
      }
    }

    return result;
  }, [sessionType, sessionsStudents, sessionsStaff, parents]);

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
    const firstName = (() => {
      const r0 = recipients[0];
      if (!r0) return 'there';
      if (r0.label === 'Student Phone' && sessionsStudents[0]) {
        const student = (sessionsStudents[0] as { student?: { first_name?: string | null } | null })?.student;
        return student?.first_name || 'there';
      }
      return r0.label?.split(' ')[0] || 'there';
    })();
    const senderName = getSenderNameFromStaff(currentStaff);

    let cancelled = false;
    (async () => {
      const draft = await getBookingConfirmationMessageForClient({
        firstName,
        bookingUrl,
        sessionDate,
        sessionTime,
        sessionType,
        senderName,
      });
      if (cancelled) return;
      setDefaultDraft(draft);
    })();
    return () => {
      cancelled = true;
    };
  }, [sessionData, sessionId, sessionType, recipients, sessionsStudents, currentStaff]);

  if (isLoading) {
    return (
      <div className="py-8 text-center text-muted-foreground">
        Loading session...
      </div>
    );
  }

  return (
    <BookingNotifyMessageScreen
      successMessage={successMessage}
      recipients={recipients}
      defaultDraft={defaultDraft}
    />
  );
}
