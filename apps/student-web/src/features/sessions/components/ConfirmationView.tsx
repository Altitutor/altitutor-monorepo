'use client';

import { ArrowRight } from 'lucide-react';
import type { StudentSession, RescheduleSession } from '../types/absence';
import { StudentSessionsCard } from './StudentSessionsCard';

interface ConfirmationViewProps {
  originalSession: StudentSession;
  targetSession: RescheduleSession;
  allSessions: StudentSession[];
}

export function ConfirmationView({
  originalSession,
  targetSession,
  allSessions: _allSessions,
}: ConfirmationViewProps) {
  // Convert original session to StudentSession format
  const originalSessionForCard: any = {
    session_id: originalSession.id,
    start_at: originalSession.start_at,
    end_at: originalSession.end_at,
    class_id: originalSession.class_id,
    session_type: originalSession.type || 'CLASS',
    subject_name: originalSession.subject?.name,
    subject_curriculum: originalSession.subject?.curriculum,
    subject_level: originalSession.subject?.level,
    subject_year_level: originalSession.subject?.year_level,
  };

  // Convert target session to StudentSession format
  const targetSessionForCard: any = {
    session_id: targetSession.id,
    start_at: targetSession.start_at,
    end_at: targetSession.end_at,
    class_id: targetSession.class_id,
    session_type: targetSession.type || 'CLASS',
    subject_name: targetSession.subject?.name,
    subject_curriculum: targetSession.subject?.curriculum,
    subject_level: targetSession.subject?.level,
    subject_year_level: targetSession.subject?.year_level,
  };

  return (
    <div className="space-y-6">
      {/* Session Cards Row */}
      <div className="flex items-start gap-4">
        {/* Left: Original Session Card (crossed out) */}
        <div className="flex-1 min-w-0">
          <div className="mb-2 text-sm font-medium text-muted-foreground">Original Session</div>
          <div className="relative">
            <StudentSessionsCard
              session={originalSessionForCard}
              staff={[]}
              students={[]}
              isNotAttending={true}
            />
            <div className="absolute inset-0 pointer-events-none flex items-center justify-center">
              <div className="w-full h-0.5 bg-red-500 rotate-12 transform origin-center" />
            </div>
          </div>
        </div>

        {/* Middle: Arrow */}
        <div className="flex items-center px-2 pt-8">
          <ArrowRight className="h-5 w-5 text-muted-foreground" />
        </div>

        {/* Right: Target Session Card (highlighted) */}
        <div className="flex-1 min-w-0">
          <div className="mb-2 text-sm font-medium text-muted-foreground">New Session</div>
          <div className="ring-2 ring-primary rounded-lg">
            <StudentSessionsCard
              session={targetSessionForCard}
              staff={[]}
              students={[]}
            />
          </div>
        </div>
      </div>

      {/* Calendar View with All Sessions */}
      <div className="pt-4 border-t">
        <div className="mb-4 text-sm font-medium">Your updated schedule:</div>
        {/* Note: We'll need to modify StudentSessionsCalendarView to accept highlighted/crossed out sessions */}
        {/* For now, we'll render a simple list or use the calendar view */}
        <div className="text-sm text-muted-foreground mb-4">
          The original session will be marked as absent and the new session will be added to your schedule.
        </div>
        {/* TODO: Enhance StudentSessionsCalendarView to show crossed out and highlighted sessions */}
        <div className="rounded-lg border p-4 bg-muted/30">
          <div className="text-sm text-muted-foreground text-center">
            Calendar view will show your updated schedule after confirmation
          </div>
        </div>
      </div>
    </div>
  );
}
