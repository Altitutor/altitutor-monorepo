'use client';

import { Checkbox } from '@altitutor/ui';
import { formatDate, formatTimeHHMM } from '@/shared/utils/datetime';
import type { StudentSession } from '../types/absence';
import { Calendar, BookOpen } from 'lucide-react';

interface AbsenceSessionSelectorProps {
  sessions: StudentSession[];
  selectedSessionIds: Set<string>;
  onToggleSession: (sessionId: string) => void;
  isLoading?: boolean;
}

export function AbsenceSessionSelector({
  sessions,
  selectedSessionIds,
  onToggleSession,
  isLoading = false,
}: AbsenceSessionSelectorProps) {
  if (isLoading) {
    return (
      <div className="py-8 text-center text-muted-foreground">
        Loading sessions...
      </div>
    );
  }

  if (sessions.length === 0) {
    return (
      <div className="py-8 text-center text-muted-foreground">
        No future sessions found for this student.
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <div className="space-y-2 max-h-96 overflow-y-auto">
        {sessions.map((session) => {
          const isSelected = selectedSessionIds.has(session.id);
          const sessionDate = session.start_at ? new Date(session.start_at) : null;
          
          // Build subject display
          const subject = session.subject;
          const subjectParts = [];
          if (subject?.curriculum) subjectParts.push(subject.curriculum);
          if (subject?.year_level) subjectParts.push(`Year ${subject.year_level}`);
          if (subject?.name) subjectParts.push(subject.name);
          if (subject?.level) subjectParts.push(subject.level);
          const subjectDisplay = subjectParts.join(' ') || 'Unknown Subject';

          // Format date and time
          const dateTimeDisplay = sessionDate
            ? `${formatDate(sessionDate)} ${formatTimeHHMM(session.start_at)}${
                session.end_at ? ` - ${formatTimeHHMM(session.end_at)}` : ''
              }`
            : 'TBD';

          return (
            <div
              key={session.id}
              className={`
                flex items-start gap-3 p-4 rounded-lg border-2 transition-all cursor-pointer
                ${isSelected 
                  ? 'border-primary bg-primary/5' 
                  : 'border-border hover:border-primary/50 hover:bg-primary/5'
                }
              `}
              onClick={() => onToggleSession(session.id)}
            >
              <Checkbox
                checked={isSelected}
                onCheckedChange={() => onToggleSession(session.id)}
                className="mt-1"
              />
              <div className="flex-1 min-w-0">
                {/* Title */}
                <div className="font-semibold text-sm mb-2 flex items-center gap-2">
                  <BookOpen className="h-4 w-4 text-muted-foreground flex-shrink-0" />
                  <span>{subjectDisplay}</span>
                </div>
                {/* Date and Time */}
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <Calendar className="h-3.5 w-3.5 flex-shrink-0" />
                  <span>{dateTimeDisplay}</span>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
