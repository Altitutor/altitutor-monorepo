'use client';

import { Badge } from '@altitutor/ui';
import { formatDate, formatTimeHHMM } from '@/shared/utils/datetime';
import type { AbsenceDecision, StudentSession, RescheduleSession } from '../types/absence';
import { Calendar, ArrowRight, BookOpen } from 'lucide-react';

interface AbsenceSummaryProps {
  decisions: AbsenceDecision[];
  sessionsMap: Map<string, StudentSession>;
  rescheduledSessionsMap: Map<string, RescheduleSession>;
}

export function AbsenceSummary({
  decisions,
  sessionsMap,
  rescheduledSessionsMap,
}: AbsenceSummaryProps) {
  if (decisions.length === 0) {
    return (
      <div className="py-8 text-center text-muted-foreground">
        No absence actions configured yet.
      </div>
    );
  }

  const renderSessionCard = (
    session: StudentSession | RescheduleSession | null,
    title: string,
    isCredit: boolean = false
  ) => {
    if (isCredit) {
      return (
        <div className="flex-1 p-4 rounded-lg border-2 border-red-500 bg-red-50 dark:bg-red-950/20 flex items-center justify-center">
          <div className="text-center">
            <div className="font-semibold text-red-700 dark:text-red-300">Session Credited</div>
            <div className="text-xs text-red-600 dark:text-red-400 mt-1">No charge for this session</div>
          </div>
        </div>
      );
    }

    if (!session) return null;

    const sessionDate = session.start_at ? new Date(session.start_at) : null;
    
    // Build subject display
    const subject = session.subject;
    const subjectParts = [];
    if (subject?.curriculum) subjectParts.push(subject.curriculum);
    if (subject?.year_level) subjectParts.push(`Year ${subject.year_level}`);
    if (subject?.name) subjectParts.push(subject.name);
    if (subject?.level) subjectParts.push(subject.level);
    const subjectDisplay = subjectParts.join(' ') || 'Unknown Subject';

    const dateTimeDisplay = sessionDate
      ? `${formatDate(sessionDate)} ${formatTimeHHMM(session.start_at)}${
          session.end_at ? ` - ${formatTimeHHMM(session.end_at)}` : ''
        }`
      : 'TBD';

    return (
      <div className="flex-1 p-4 rounded-lg border-2 border-border bg-card">
        <div className="font-semibold text-xs text-muted-foreground mb-3">{title}</div>
        <div className="space-y-2">
          {/* Subject */}
          <div className="flex items-start gap-2">
            <BookOpen className="h-4 w-4 text-muted-foreground flex-shrink-0 mt-0.5" />
            <span className="text-sm font-medium leading-tight">{subjectDisplay}</span>
          </div>
          {/* Date and Time */}
          <div className="flex items-start gap-2">
            <Calendar className="h-4 w-4 text-muted-foreground flex-shrink-0 mt-0.5" />
            <span className="text-sm text-muted-foreground leading-tight">{dateTimeDisplay}</span>
          </div>
        </div>
      </div>
    );
  };

  return (
    <div className="space-y-4">
      {decisions.map((decision) => {
        const originalSession = sessionsMap.get(decision.sessionId);
        if (!originalSession) return null;

        const targetSession =
          decision.action === 'reschedule' && decision.targetSessionId
            ? rescheduledSessionsMap.get(decision.targetSessionId)
            : null;

        const isCredit = decision.action === 'credit';

        return (
          <div key={decision.sessionId} className="flex items-center gap-4">
            {/* Original Session */}
            {renderSessionCard(originalSession, 'Original Session')}

            {/* Arrow or Action Badge */}
            <div className="flex flex-col items-center justify-center px-2">
              <ArrowRight className="h-6 w-6 text-muted-foreground mb-1" />
              <Badge variant={isCredit ? "destructive" : "default"} className="text-xs">
                {isCredit ? 'Credit' : 'Reschedule'}
              </Badge>
            </div>

            {/* New Session or Credit Box */}
            {isCredit ? (
              renderSessionCard(null, '', true)
            ) : (
              renderSessionCard(targetSession || null, 'Rescheduled Session')
            )}
          </div>
        );
      })}

      {/* Summary Stats */}
      <div className="pt-4 border-t">
        <div className="flex gap-6 text-sm">
          <div>
            <span className="text-muted-foreground">Total absences: </span>
            <span className="font-semibold">{decisions.length}</span>
          </div>
          <div>
            <span className="text-muted-foreground">Reschedules: </span>
            <span className="font-semibold">
              {decisions.filter((d) => d.action === 'reschedule').length}
            </span>
          </div>
          <div>
            <span className="text-muted-foreground">Credits: </span>
            <span className="font-semibold">
              {decisions.filter((d) => d.action === 'credit').length}
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}
