'use client';

import { useMemo } from 'react';
import { Input } from '@altitutor/ui';
import { Label } from '@altitutor/ui';
import { format } from 'date-fns';
import { useSessionsWithDetails } from '@/features/sessions/hooks/useSessionsQuery';
import { BookingConfirmationCalendar } from '../BookingConfirmationCalendar';

const DURATION_MINUTES = 45;

export interface StaffInterviewTimeStepProps {
  startAt: string;
  endAt: string;
  onStartAtChange: (value: string) => void;
  onEndAtChange: (value: string) => void;
}

export function StaffInterviewTimeStep({
  startAt,
  onStartAtChange,
  onEndAtChange,
}: StaffInterviewTimeStepProps) {
  const now = new Date();
  const defaultDate = format(now, 'yyyy-MM-dd');
  const defaultTime = format(now, 'HH:mm');

  const startAtDate = startAt ? format(new Date(startAt), 'yyyy-MM-dd') : defaultDate;
  const startAtTime = startAt ? format(new Date(startAt), 'HH:mm') : defaultTime;

  const buildStartAt = (date: string, time: string) => {
    return new Date(`${date}T${time}:00`).toISOString();
  };

  const handleDateTimeChange = (date: string, time: string) => {
    const newStart = buildStartAt(date, time);
    const newEnd = new Date(new Date(newStart).getTime() + DURATION_MINUTES * 60 * 1000).toISOString();
    onStartAtChange(newStart);
    onEndAtChange(newEnd);
  };

  const sessionDate = useMemo(() => {
    const d = startAt ? new Date(startAt) : new Date();
    d.setHours(0, 0, 0, 0);
    return d;
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

  const effectiveEndAt = useMemo(() => {
    if (startAt) {
      return new Date(new Date(startAt).getTime() + DURATION_MINUTES * 60 * 1000).toISOString();
    }
    return '';
  }, [startAt]);

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

  return (
    <div className="space-y-4">
      <p className="text-sm text-muted-foreground">
        Set the date and time for the staff interview (45 minutes)
      </p>

      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label htmlFor="interview-date">Date</Label>
          <Input
            id="interview-date"
            type="date"
            value={startAtDate}
            onChange={(e) => {
              const date = e.target.value;
              handleDateTimeChange(date, startAtTime);
            }}
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="interview-time">Time</Label>
          <Input
            id="interview-time"
            type="time"
            value={startAtTime}
            onChange={(e) => {
              const time = e.target.value;
              handleDateTimeChange(startAtDate, time);
            }}
          />
        </div>
      </div>

      {sessionsData && startAt && effectiveEndAt && (
        <div className="mt-6">
          <h3 className="font-semibold mb-4">Session in Calendar</h3>
          <BookingConfirmationCalendar
            newSession={{
              start_at: startAt,
              end_at: effectiveEndAt,
              type: 'STAFF_INTERVIEW',
              subject_id: null,
            }}
            existingSessions={existingSessions}
            subjectsById={sessionsData.subjectsById ?? {}}
            classesById={sessionsData.classesById ?? {}}
            sessionStaff={sessionsData.sessionStaff ?? {}}
            sessionStudents={sessionsData.sessionStudents ?? {}}
          />
        </div>
      )}
    </div>
  );
}
