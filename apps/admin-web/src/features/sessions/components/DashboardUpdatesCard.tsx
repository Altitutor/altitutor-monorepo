'use client';

import { useMemo, useState } from 'react';
import { format } from 'date-fns';
import { Card, CardContent, CardHeader, CardTitle, SearchableSelect } from '@altitutor/ui';
import { Loader2 } from 'lucide-react';
import { clickableCardFocusRingCn, clickableCardHoverCn, cn } from '@/shared/utils';
import { useDashboardDayUpdates } from '../hooks/useDashboardDayUpdates';
import {
  DASHBOARD_UPDATES_SORT_OPTIONS,
  groupDashboardDayUpdateItems,
  hasDashboardDayUpdates,
  type DashboardDayUpdateItem,
  type DashboardUpdatesSortMode,
} from '../utils/dashboardDayUpdates';

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

function updateRowKey(item: DashboardDayUpdateItem, index: number): string {
  return `${item.kind}-${item.sessionId}-${item.personName ?? ''}-${item.incomingName ?? index}`;
}

export function DashboardUpdatesCard({
  date,
  onOpenSession,
}: {
  date: string;
  onOpenSession: (sessionId: string) => void;
}) {
  const { updates, isLoading, isError } = useDashboardDayUpdates(date);
  const [sortMode, setSortMode] = useState<DashboardUpdatesSortMode>('time');

  const selectedSortOption =
    DASHBOARD_UPDATES_SORT_OPTIONS.find((option) => option.id === sortMode) ??
    DASHBOARD_UPDATES_SORT_OPTIONS[0];

  const groups = useMemo(
    () => groupDashboardDayUpdateItems(updates, sortMode),
    [updates, sortMode]
  );

  return (
    <Card className="flex w-full max-h-[520px] flex-col overflow-hidden">
      <CardHeader className="flex flex-row items-center justify-between gap-4 px-4 pb-2 pt-3">
        <CardTitle className="text-lg font-semibold">Updates</CardTitle>
        <SearchableSelect<(typeof DASHBOARD_UPDATES_SORT_OPTIONS)[number]>
          items={DASHBOARD_UPDATES_SORT_OPTIONS}
          value={selectedSortOption}
          onValueChange={(option) => option && setSortMode(option.id)}
          getItemId={(option) => option.id}
          getItemLabel={(option) => option.label}
          placeholder="Sort by"
          searchPlaceholder="Search sort..."
          emptyMessage="No options found"
          className="w-[140px] shrink-0"
          fullWidth
          triggerClassName="h-9"
        />
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
            {groups.map((group) => (
              <section key={group.key} className="py-2">
                <div className="px-4 pb-1 pt-1 text-xs font-medium uppercase tracking-wide text-muted-foreground">
                  {group.title}
                </div>
                <div>
                  {group.items.map((item, index) => (
                    <UpdateRow
                      key={updateRowKey(item, index)}
                      item={item}
                      onOpenSession={onOpenSession}
                    />
                  ))}
                </div>
              </section>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
