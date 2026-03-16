'use client';

import { useMemo } from 'react';
import { format } from 'date-fns';
import { useStaffById } from '@/features/staff/hooks/useStaffQuery';
import { useSessionsWithDetails } from '@/features/sessions/hooks/useSessionsQuery';
import { BookingConfirmationCalendar } from '../BookingConfirmationCalendar';
import { formatSlotDateTime } from '../../utils/dateTimeHelpers';

export interface StaffInterviewConfirmStepProps {
  intervieweeStaffId: string;
  interviewerStaffId: string;
  startAt: string;
  endAt: string;
}

export function StaffInterviewConfirmStep({
  intervieweeStaffId,
  interviewerStaffId,
  startAt,
  endAt,
}: StaffInterviewConfirmStepProps) {
  const { data: interviewee } = useStaffById(intervieweeStaffId);
  const { data: interviewer } = useStaffById(interviewerStaffId);

  const sessionDate = useMemo(() => {
    if (!startAt) return new Date();
    const date = new Date(startAt);
    date.setHours(0, 0, 0, 0);
    return date;
  }, [startAt]);

  const dayStart = useMemo(() => sessionDate, [sessionDate]);
  const dayEnd = useMemo(() => {
    const end = new Date(sessionDate);
    end.setHours(23, 59, 59, 999);
    return end;
  }, [sessionDate]);

  const { data: sessionsData } = useSessionsWithDetails({
    rangeStart: format(dayStart, 'yyyy-MM-dd'),
    rangeEnd: format(dayEnd, 'yyyy-MM-dd'),
    includeInactive: false,
  });

  const existingSessions = useMemo(() => {
    const sessions = sessionsData?.sessions ?? [];
    return sessions
      .filter((s) => s.start_at && s.end_at)
      .map((s) => ({
        id: s.id,
        start_at: s.start_at!,
        end_at: s.end_at!,
        type: s.type,
        subject_id: s.subject_id,
        class_id: s.class_id,
      }));
  }, [sessionsData?.sessions]);

  const sessionStaffForNew = useMemo(() => {
    const staff = [];
    if (interviewee) staff.push(interviewee);
    if (interviewer) staff.push(interviewer);
    return staff;
  }, [interviewee, interviewer]);

  return (
    <div className="space-y-4">
      <div>
        <h3 className="text-lg font-semibold mb-4">Booking Details</h3>
        <div className="grid grid-cols-2 gap-x-4 gap-y-3">
          <div className="text-sm font-medium text-muted-foreground">Candidate (interviewee)</div>
          <div className="text-sm">
            {interviewee
              ? `${interviewee.first_name} ${interviewee.last_name}`
              : 'Loading...'}
          </div>

          <div className="text-sm font-medium text-muted-foreground">Interviewer</div>
          <div className="text-sm">
            {interviewer
              ? `${interviewer.first_name} ${interviewer.last_name}`
              : 'Loading...'}
          </div>

          <div className="text-sm font-medium text-muted-foreground">Date & Time</div>
          <div className="text-sm">
            {startAt && endAt
              ? formatSlotDateTime(startAt)
              : '—'}
          </div>

          <div className="text-sm font-medium text-muted-foreground">Duration</div>
          <div className="text-sm">45 minutes</div>
        </div>
      </div>

      {sessionsData && startAt && endAt && (
        <div className="mt-6">
          <h3 className="font-semibold mb-4">Session in Calendar</h3>
          <BookingConfirmationCalendar
            newSession={{
              start_at: startAt,
              end_at: endAt,
              type: 'STAFF_INTERVIEW',
              subject_id: null,
            }}
            existingSessions={existingSessions}
            subjectsById={sessionsData.subjectsById ?? {}}
            classesById={sessionsData.classesById ?? {}}
            sessionStaff={{
              ...sessionsData.sessionStaff,
              'new-session-preview': sessionStaffForNew,
            }}
            sessionStudents={sessionsData.sessionStudents ?? {}}
          />
        </div>
      )}
    </div>
  );
}
