'use client';

import Link from 'next/link';
import { format } from 'date-fns';
import { Button, Card, CardContent, CardHeader, CardTitle } from '@altitutor/ui';
import { ExternalLink, Loader2 } from 'lucide-react';
import { clickableCardFocusRingCn, clickableCardHoverCn, cn } from '@/shared/utils';
import { useDashboardDayUpdates } from '../hooks/useDashboardDayUpdates';
import {
  hasDashboardDayUpdates,
  type DashboardDayUpdateItem,
  type DashboardDayUpdates,
} from '../utils/dashboardDayUpdates';

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
        'flex w-full flex-col rounded-md px-4 py-2 text-left transition-colors',
        clickableCardHoverCn,
        clickableCardFocusRingCn
      )}
    >
      <span className="truncate text-sm font-medium leading-5">{primary}</span>
      {secondary ? (
        <span className="truncate text-xs leading-5 text-muted-foreground">{secondary}</span>
      ) : null}
    </button>
  );
}

export function DashboardUpdatesCard({
  date,
  onOpenSession,
}: {
  date: string;
  onOpenSession: (sessionId: string) => void;
}) {
  const { updates, isLoading, isError } = useDashboardDayUpdates(date);
  const sessionsHref = `/sessions?view=table&from=${date}&to=${date}`;

  return (
    <Card className="flex w-full max-h-[520px] flex-col overflow-hidden">
      <CardHeader className="flex flex-row items-center justify-between gap-4 px-4 pb-2 pt-3">
        <CardTitle className="text-lg font-semibold">Updates</CardTitle>
        <Button variant="outline" size="sm" asChild>
          <Link href={sessionsHref} className="gap-1.5">
            <ExternalLink className="h-3.5 w-3.5" />
            Sessions
          </Link>
        </Button>
      </CardHeader>
      <CardContent className="min-h-0 flex-1 overflow-auto p-0">
        {isLoading ? (
          <div className="flex items-center justify-center border-t py-8">
            <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
          </div>
        ) : isError ? (
          <div className="border-t px-4 py-3 text-sm text-destructive">Could not load updates.</div>
        ) : !hasDashboardDayUpdates(updates) ? (
          <div className="border-t px-4 py-3 text-sm text-muted-foreground">No updates for this day.</div>
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
      </CardContent>
    </Card>
  );
}
