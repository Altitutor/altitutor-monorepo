'use client';

import { useEffect, useMemo, useState } from 'react';
import { addDays, format, startOfWeek } from 'date-fns';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { Button, Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@altitutor/ui';
import type { ClassSchedulePlanOccurrence } from '../types/schedule';

interface GeneratedTimetablePreviewProps {
  occurrences: ClassSchedulePlanOccurrence[];
}

const ADELAIDE_DATE = new Intl.DateTimeFormat('en-CA', {
  timeZone: 'Australia/Adelaide', year: 'numeric', month: '2-digit', day: '2-digit',
});
const ADELAIDE_TIME = new Intl.DateTimeFormat('en-AU', {
  timeZone: 'Australia/Adelaide', hour: 'numeric', minute: '2-digit',
});

function occurrenceDateKey(iso: string): string {
  return ADELAIDE_DATE.format(new Date(iso));
}

export function GeneratedTimetablePreview({ occurrences }: GeneratedTimetablePreviewProps) {
  const sortedOccurrences = useMemo(
    () => [...occurrences].sort((left, right) => left.start_at.localeCompare(right.start_at)),
    [occurrences]
  );
  const firstDate = sortedOccurrences[0] ? occurrenceDateKey(sortedOccurrences[0].start_at) : '2000-01-03';
  const [anchor, setAnchor] = useState(() => new Date(`${firstDate}T12:00:00`));

  useEffect(() => {
    setAnchor(new Date(`${firstDate}T12:00:00`));
  }, [firstDate]);

  const weekStart = startOfWeek(anchor, { weekStartsOn: 1 });
  const days = Array.from({ length: 7 }, (_, index) => addDays(weekStart, index));
  const occurrencesByDate = useMemo(() => {
    const result = new Map<string, ClassSchedulePlanOccurrence[]>();
    for (const occurrence of sortedOccurrences) {
      const key = occurrenceDateKey(occurrence.start_at);
      result.set(key, [...(result.get(key) ?? []), occurrence]);
    }
    return result;
  }, [sortedOccurrences]);

  if (sortedOccurrences.length === 0) {
    return <div className="rounded-md border p-4 text-sm text-muted-foreground">No Sessions will be generated.</div>;
  }

  return (
    <div className="space-y-5">
      <div className="space-y-2">
        <div className="flex items-center justify-between gap-3">
          <h3 className="font-medium">Generated timetable</h3>
          <div className="flex items-center gap-2">
            <Button type="button" variant="outline" size="icon" aria-label="Previous week" onClick={() => setAnchor((current) => addDays(current, -7))}><ChevronLeft className="h-4 w-4" /></Button>
            <Button type="button" variant="outline" size="sm" onClick={() => setAnchor(new Date(`${firstDate}T12:00:00`))}>First week</Button>
            <Button type="button" variant="outline" size="icon" aria-label="Next week" onClick={() => setAnchor((current) => addDays(current, 7))}><ChevronRight className="h-4 w-4" /></Button>
          </div>
        </div>
        <div className="overflow-x-auto rounded-md border">
          <div className="grid min-w-[700px] grid-cols-7 overflow-hidden">
            {days.map((day) => {
              const key = format(day, 'yyyy-MM-dd');
              const dayOccurrences = occurrencesByDate.get(key) ?? [];
              return (
                <div key={key} className="min-h-36 border-r last:border-r-0">
                  <div className="border-b bg-muted/40 p-2 text-center text-xs font-medium">{format(day, 'EEE dd MMM')}</div>
                  <div className="space-y-2 p-2">
                    {dayOccurrences.map((occurrence) => (
                      <div key={`${occurrence.source_key}-${occurrence.start_at}`} className="rounded-md border border-primary/30 bg-primary/5 p-2 text-xs">
                        <div className="font-medium">{ADELAIDE_TIME.format(new Date(occurrence.start_at))}–{ADELAIDE_TIME.format(new Date(occurrence.end_at))}</div>
                        <div className="truncate text-muted-foreground">{occurrence.room ?? 'No room'}</div>
                      </div>
                    ))}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      <div className="space-y-2">
        <h3 className="font-medium">All potential Sessions ({sortedOccurrences.length})</h3>
        <div className="max-h-72 overflow-auto rounded-md border">
          <Table>
            <TableHeader><TableRow><TableHead>Date</TableHead><TableHead>Time</TableHead><TableHead>Room</TableHead><TableHead>Action</TableHead></TableRow></TableHeader>
            <TableBody>
              {sortedOccurrences.map((occurrence) => (
                <TableRow key={`${occurrence.source_key}-${occurrence.start_at}`}>
                  <TableCell>{new Date(occurrence.start_at).toLocaleDateString('en-AU', { timeZone: 'Australia/Adelaide', dateStyle: 'medium' })}</TableCell>
                  <TableCell>{ADELAIDE_TIME.format(new Date(occurrence.start_at))}–{ADELAIDE_TIME.format(new Date(occurrence.end_at))}</TableCell>
                  <TableCell>{occurrence.room ?? '—'}</TableCell>
                  <TableCell className="capitalize">{occurrence.action.toLowerCase()}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      </div>
    </div>
  );
}
