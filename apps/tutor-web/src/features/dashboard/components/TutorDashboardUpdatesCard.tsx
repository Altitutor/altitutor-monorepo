'use client';

import { format } from 'date-fns';
import { Loader2 } from 'lucide-react';
import { tutorClickableCardFocusRingCn, tutorClickableCardHoverCn, tutorCardCn } from '@/shared/lib/tutor-visual';
import { cn } from '@/shared/utils';
import { useTutorDashboardDayUpdates } from '@/features/sessions/hooks/useTutorDashboardDayUpdates';
import {
  hasDashboardDayUpdates,
  type DashboardDayUpdateItem,
  type DashboardDayUpdates,
} from '@/features/sessions/utils/dashboardDayUpdates';

const SECTIONS: Array<{
  key: keyof DashboardDayUpdates;
  title: string;
}> = [
  { key: 'meetings', title: 'Meetings' },
  { key: 'timeChanges', title: 'Rescheduled sessions' },
  { key: 'studentAbsences', title: 'Student absences' },
  { key: 'extraStudents', title: 'Extra students' },
  { key: 'staffSwaps', title: 'Staff swaps' },
  { key: 'staffAbsences', title: 'Staff absences' },
  { key: 'extraStaff', title: 'Extra staff' },
];

function formatTimeRange(startAt: string | null, endAt: string | null): string {
  if (!startAt) return 'Time not set';
  const start = new Date(startAt);
  const end = endAt ? new Date(endAt) : null;
  if (end) return `${format(start, 'h:mm a')} – ${format(end, 'h:mm a')}`;
  return format(start, 'h:mm a');
}

function datesDiffer(a: string | null | undefined, b: string | null | undefined): boolean {
  if (!a || !b) return false;
  return format(new Date(a), 'yyyy-MM-dd') !== format(new Date(b), 'yyyy-MM-dd');
}

function formatCurrentTime(item: DashboardDayUpdateItem): string {
  const range = formatTimeRange(item.startAt, item.endAt);
  if (!item.startAt || !datesDiffer(item.startAt, item.originalStartAt)) return range;
  return `${format(new Date(item.startAt), 'EEE d MMM')}, ${range}`;
}

function formatUsualTime(item: DashboardDayUpdateItem): string | null {
  if (!item.originalStartAt) return null;
  const range = formatTimeRange(item.originalStartAt, item.originalEndAt ?? null);
  if (datesDiffer(item.startAt, item.originalStartAt)) {
    return `usually ${format(new Date(item.originalStartAt), 'EEE d MMM')}, ${range}`;
  }
  return `usually ${range}`;
}

function UpdateRow({
  item,
  onOpenSession,
}: {
  item: DashboardDayUpdateItem;
  onOpenSession: (sessionId: string) => void;
}) {
  const timeLabel = formatCurrentTime(item);
  const usualLabel = item.kind === 'time_change' ? formatUsualTime(item) : null;
  const primary =
    item.kind === 'meeting'
      ? item.sessionLabel
      : item.kind === 'time_change'
        ? item.sessionLabel
        : item.kind === 'staff_swap'
          ? [item.personName, item.incomingName].filter(Boolean).join(' → ')
          : item.personName ?? item.sessionLabel;
  const secondary =
    item.kind === 'meeting'
      ? item.attendeeNames
      : item.kind === 'time_change'
        ? [timeLabel, usualLabel].filter(Boolean).join(' · ')
        : `${item.sessionLabel} · ${formatTimeRange(item.startAt, item.endAt)}`;

  return (
    <button
      type="button"
      onClick={() => onOpenSession(item.sessionId)}
      className={cn(
        'flex w-full flex-col rounded-xl px-4 py-2 text-left',
        tutorClickableCardHoverCn,
        tutorClickableCardFocusRingCn
      )}
    >
      <span className="truncate text-sm font-medium leading-5">{primary}</span>
      {secondary ? (
        <span className="truncate text-xs leading-5 text-muted-foreground">{secondary}</span>
      ) : null}
    </button>
  );
}

export function TutorDashboardUpdatesCard({
  date,
  onOpenSession,
}: {
  date: string;
  onOpenSession: (sessionId: string) => void;
}) {
  const { updates, isLoading, isError } = useTutorDashboardDayUpdates(date);

  return (
    <section
      aria-labelledby="tutor-updates-heading"
      className={tutorCardCn('flex max-h-[520px] w-full flex-col overflow-hidden')}
    >
      <div className="flex items-center justify-between gap-4 px-4 pb-2 pt-3">
        <h2 id="tutor-updates-heading" className="text-lg font-semibold">
          Updates
        </h2>
      </div>
      <div className="min-h-0 flex-1 overflow-auto">
        {isLoading ? (
          <div className="flex items-center justify-center border-t py-8">
            <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
          </div>
        ) : isError ? (
          <div className="border-t px-4 py-3 text-sm text-destructive">Could not load updates.</div>
        ) : !hasDashboardDayUpdates(updates) ? (
          <div className="border-t px-4 py-3 text-sm text-muted-foreground">No updates for today.</div>
        ) : (
          <div className="divide-y border-t">
            {SECTIONS.map(({ key, title }) => {
              const items = updates[key];
              if (items.length === 0) return null;
              return (
                <section key={key} className="py-2">
                  <div className="px-4 pb-1 pt-1 text-xs font-medium uppercase tracking-wide text-muted-foreground">
                    {title}
                  </div>
                  <div>
                    {items.map((item, index) => (
                      <UpdateRow
                        key={`${item.kind}-${item.sessionId}-${item.personName ?? ''}-${item.incomingName ?? index}`}
                        item={item}
                        onOpenSession={onOpenSession}
                      />
                    ))}
                  </div>
                </section>
              );
            })}
          </div>
        )}
      </div>
    </section>
  );
}
