'use client';

import { format } from 'date-fns';
import { Loader2 } from 'lucide-react';
import { formatSessionDate } from '@altitutor/shared';
import type { StudentSessionWithStaff } from '@/shared/api/sessions';
import {
  studentCardCn,
  studentClickableCardFocusRingCn,
  studentClickableCardHoverCn,
} from '@/shared/lib/student-visual';
import { cn, formatSessionType } from '@/shared/utils';

function formatTimeRange(startAt: string | null, endAt: string | null): string {
  if (!startAt) return 'Time not set';
  const start = new Date(startAt);
  const end = endAt ? new Date(endAt) : null;
  if (end) return `${format(start, 'h:mm a')} – ${format(end, 'h:mm a')}`;
  return format(start, 'h:mm a');
}

function sessionLabel(session: StudentSessionWithStaff): string {
  const parts: string[] = [];
  if (session.subject_curriculum) parts.push(session.subject_curriculum);
  const yearLevel = session.subject_year_level ?? session.subject_level;
  if (yearLevel !== null && yearLevel !== undefined) parts.push(String(yearLevel));
  if (session.subject_name) parts.push(session.subject_name);
  if (session.class_level) parts.push(session.class_level);
  return parts.length > 0 ? parts.join(' ') : formatSessionType(session.session_type ?? '');
}

function RecentSessionRow({
  session,
  onOpenSession,
}: {
  session: StudentSessionWithStaff;
  onOpenSession: (sessionId: string) => void;
}) {
  const label = sessionLabel(session);
  const dateLabel = session.start_at ? formatSessionDate(session.start_at) : null;
  const timeLabel = formatTimeRange(session.start_at, session.end_at);
  const secondary = [dateLabel, timeLabel].filter(Boolean).join(' · ');

  return (
    <button
      type="button"
      onClick={() => session.session_id && onOpenSession(session.session_id)}
      className={cn(
        'flex w-full flex-col rounded-xl px-4 py-2 text-left',
        studentClickableCardHoverCn,
        studentClickableCardFocusRingCn,
      )}
    >
      <span className="truncate text-sm font-medium leading-5">{label}</span>
      {secondary ? (
        <span className="truncate text-xs leading-5 text-muted-foreground">{secondary}</span>
      ) : null}
    </button>
  );
}

export function StudentDashboardRecentSessionsCard({
  sessions,
  isLoading,
  isError,
  onOpenSession,
}: {
  sessions: StudentSessionWithStaff[];
  isLoading: boolean;
  isError: boolean;
  onOpenSession: (sessionId: string) => void;
}) {
  return (
    <section
      aria-labelledby="recent-sessions-heading"
      className={studentCardCn('flex max-h-[520px] w-full flex-col overflow-hidden')}
    >
      <div className="flex items-center justify-between gap-4 px-4 pb-2 pt-3">
        <h2 id="recent-sessions-heading" className="text-lg font-semibold">
          Recent sessions
        </h2>
      </div>
      <div className="min-h-0 flex-1 overflow-auto">
        {isLoading ? (
          <div className="flex items-center justify-center border-t py-8">
            <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
          </div>
        ) : isError ? (
          <div className="border-t px-4 py-3 text-sm text-destructive">Could not load sessions.</div>
        ) : sessions.length === 0 ? (
          <div className="border-t px-4 py-3 text-sm text-muted-foreground">
            When you have completed classes, your most recent session for each class will show here.
          </div>
        ) : (
          <div className="divide-y border-t">
            {sessions.map((session) => (
              <RecentSessionRow
                key={session.session_id!}
                session={session}
                onOpenSession={onOpenSession}
              />
            ))}
          </div>
        )}
      </div>
    </section>
  );
}
