'use client';

import { useState, useMemo } from 'react';
import { Button } from '@altitutor/ui';
import { ArrowRight, X } from 'lucide-react';
import type { StudentSession, RescheduleSession } from '../types/absence';
import { useAvailableRescheduleSessions } from '../hooks/useAbsences';
import { WeekViewCalendar } from './WeekViewCalendar';
import { StudentSessionsCard } from './StudentSessionsCard';
import { useCurrentStudentId } from '@/shared/hooks';
import { cn } from '@/shared/utils';
import { studentModalHairline } from '@/shared/lib/student-visual';
import type { Database } from '@altitutor/shared';

type StudentSessionView = Database['public']['Views']['vstudent_session_base']['Row'];

interface RescheduleSessionSelectorProps {
  originalSession: StudentSession;
  selectedTargetSessionId: string | null;
  onSelectTargetSession: (sessionId: string, session: RescheduleSession) => void;
  onClearTargetSession: () => void;
}

export function RescheduleSessionSelector({
  originalSession,
  selectedTargetSessionId,
  onSelectTargetSession,
  onClearTargetSession,
}: RescheduleSessionSelectorProps) {
  const { data: studentId } = useCurrentStudentId();
  const [rescheduleWeekStart, setRescheduleWeekStart] = useState<Date>(() => {
    const today = new Date();
    const dayOfWeek = today.getDay();
    const currentWeekStart = new Date(today);
    const diff = currentWeekStart.getDate() - dayOfWeek + (dayOfWeek === 0 ? -6 : 1);
    currentWeekStart.setDate(diff);
    currentWeekStart.setHours(0, 0, 0, 0);
    return currentWeekStart;
  });

  const minDate = useMemo(() => {
    const today = new Date();
    const dayOfWeek = today.getDay();
    const min = new Date(today);
    const diff = min.getDate() - dayOfWeek + (dayOfWeek === 0 ? -6 : 1);
    min.setDate(diff);
    min.setHours(0, 0, 0, 0);
    return min;
  }, []);

  // Get reschedule sessions
  const { data: rescheduleSessions, isLoading: loadingRescheduleSessions } = useAvailableRescheduleSessions(
    studentId && originalSession.id
      ? {
          originalSessionId: originalSession.id,
          studentId,
          dateRangeDays: 7,
        }
      : null
  );

  // Find selected target session
  const selectedTargetSession = useMemo(() => {
    if (!selectedTargetSessionId || !rescheduleSessions) return null;
    return rescheduleSessions.find((s) => s.id === selectedTargetSessionId) || null;
  }, [selectedTargetSessionId, rescheduleSessions]);

  // Convert sessions to base format for WeekViewCalendar
  const baseSessions = useMemo(() => {
    if (!rescheduleSessions) return [];
    return rescheduleSessions.map((s) => ({
      id: s.id,
      start_at: s.start_at,
      end_at: s.end_at,
      class_id: s.class_id,
      type: s.type,
      subject_name: s.subject?.name || null,
      subject_curriculum: s.subject?.curriculum || null,
      subject_level: s.subject?.level || null,
      subject_year_level: s.subject?.year_level || null,
      session_type: s.type,
    }));
  }, [rescheduleSessions]);

  const selectedSessionIds = useMemo(() => {
    return selectedTargetSessionId ? new Set([selectedTargetSessionId]) : new Set<string>();
  }, [selectedTargetSessionId]);

  // Convert original session to StudentSession format
  const originalSessionForCard: StudentSessionView = {
    session_id: originalSession.id,
    start_at: originalSession.start_at,
    end_at: originalSession.end_at,
    class_id: originalSession.class_id ?? null,
    session_type: originalSession.type || 'CLASS',
    subject_id: originalSession.subject?.id ?? null,
    session_created_at: originalSession.created_at || new Date().toISOString(),
    session_updated_at: originalSession.updated_at || new Date().toISOString(),
    session_student_id: originalSession.id,
    planned_absence: false,
    planned_absence_logged_at: null,
    is_rescheduled: false,
    rescheduled_at: null,
    is_credited: false,
    credited_at: null,
    day_of_week: null,
    start_time: null,
    end_time: null,
    room: null,
    class_level: originalSession.class?.level ?? null,
    class_status: null,
    subject_name: originalSession.subject?.name ?? null,
    subject_curriculum: originalSession.subject?.curriculum ?? null,
    subject_discipline: null,
    subject_level: originalSession.subject?.level ?? null,
    subject_color: null,
    subject_year_level: originalSession.subject?.year_level ?? null,
    subject_short_name: null,
    subject_long_name: null,
    students: null,
    staff: null,
  } as StudentSessionView;

  // Convert target session to StudentSession format
  const targetSessionForCard: StudentSessionView | null = selectedTargetSession ? {
    session_id: selectedTargetSession.id,
    start_at: selectedTargetSession.start_at,
    end_at: selectedTargetSession.end_at,
    class_id: selectedTargetSession.class_id ?? null,
    session_type: selectedTargetSession.type || 'CLASS',
    subject_id: selectedTargetSession.subject?.id ?? null,
    session_created_at: selectedTargetSession.created_at || new Date().toISOString(),
    session_updated_at: selectedTargetSession.updated_at || new Date().toISOString(),
    session_student_id: selectedTargetSession.id,
    planned_absence: false,
    planned_absence_logged_at: null,
    is_rescheduled: false,
    rescheduled_at: null,
    is_credited: false,
    credited_at: null,
    day_of_week: null,
    start_time: null,
    end_time: null,
    room: null,
    class_level: selectedTargetSession.class?.level ?? null,
    class_status: null,
    subject_name: selectedTargetSession.subject?.name ?? null,
    subject_curriculum: selectedTargetSession.subject?.curriculum ?? null,
    subject_discipline: null,
    subject_level: selectedTargetSession.subject?.level ?? null,
    subject_color: null,
    subject_year_level: selectedTargetSession.subject?.year_level ?? null,
    subject_short_name: null,
    subject_long_name: null,
    students: null,
    staff: null,
  } as StudentSessionView : null;

  return (
    <div className="space-y-6">
      {/* Session Cards Row */}
      <div className="flex items-start gap-4">
        {/* Left: Original Session Card */}
        <div className="flex-1 min-w-0">
          <div className="mb-2 text-sm font-medium text-muted-foreground">Original Session</div>
          <StudentSessionsCard
            session={originalSessionForCard}
            staff={[]}
            students={[]}
          />
        </div>

        {/* Middle: Arrow */}
        <div className="flex items-center px-2 pt-8">
          <ArrowRight className="h-5 w-5 text-muted-foreground" />
        </div>

        {/* Right: Target Session Card or Empty */}
        <div className="flex-1 min-w-0">
          <div className="mb-2 text-sm font-medium text-muted-foreground">New Session</div>
          {targetSessionForCard ? (
            <div className="relative">
              <StudentSessionsCard
                session={targetSessionForCard}
                staff={[]}
                students={[]}
              />
              <Button
                variant="ghost"
                size="sm"
                onClick={onClearTargetSession}
                className="absolute right-2 top-2 h-8 w-8 rounded-xl p-0 hover:bg-muted/80"
              >
                <X className="h-4 w-4" />
              </Button>
            </div>
          ) : (
            <div className="rounded-2xl bg-muted/30 p-8 text-center text-muted-foreground ring-1 ring-black/[0.08] dark:ring-white/15">
              Select a session below
            </div>
          )}
        </div>
      </div>

      {/* Calendar for Selecting Target Session */}
      <div className="space-y-4 pt-2">
        <div className={cn(studentModalHairline)} />
        <div className="text-sm font-medium">Select a session to reschedule to:</div>
        {loadingRescheduleSessions ? (
          <div className="text-sm text-muted-foreground py-4 text-center">Loading sessions...</div>
        ) : rescheduleSessions && rescheduleSessions.length > 0 ? (
          <WeekViewCalendar
            sessions={baseSessions}
            selectedSessionIds={selectedSessionIds}
            onToggleSession={(targetId) => {
              if (selectedTargetSessionId === targetId) {
                onClearTargetSession();
              } else {
                const session = rescheduleSessions?.find((s) => s.id === targetId);
                if (session) {
                  onSelectTargetSession(targetId, session);
                }
              }
            }}
            currentWeekStart={rescheduleWeekStart}
            onWeekChange={setRescheduleWeekStart}
            minDate={minDate}
          />
        ) : (
          <div className="text-sm text-muted-foreground py-4 text-center">
            No available sessions found. Try adjusting the week.
          </div>
        )}
      </div>
    </div>
  );
}
