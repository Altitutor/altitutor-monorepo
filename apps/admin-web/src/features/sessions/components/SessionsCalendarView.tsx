'use client';

import { useMemo, useState } from 'react';
import { Button, Card } from '@altitutor/ui';
import { addDays, startOfWeek, endOfWeek, format } from 'date-fns';
import { usePrecreateSessions } from '../hooks/usePrecreateSessions';
import { useSessionsWithDetails } from '../hooks/useSessionsQuery';

export function SessionsCalendarView() {
  const [anchor, setAnchor] = useState<Date>(new Date());
  const weekStart = useMemo(() => startOfWeek(anchor, { weekStartsOn: 1 }), [anchor]);
  const weekEnd = useMemo(() => endOfWeek(anchor, { weekStartsOn: 1 }), [anchor]);
  const { mutate: precreate } = usePrecreateSessions();
  const { data } = useSessionsWithDetails();

  // Precreate a bit ahead/behind for smoothness
  const preStart = format(addDays(weekStart, -7), 'yyyy-MM-dd');
  const preEnd = format(addDays(weekEnd, 21), 'yyyy-MM-dd');

  useMemo(() => {
    precreate({ start_date: preStart, end_date: preEnd });
  }, [preStart, preEnd]);

  const days = Array.from({ length: 7 }, (_, i) => addDays(weekStart, i));

  return (
    <div className="space-y-4">
      <div className="flex gap-2">
        <Button variant="outline" onClick={() => setAnchor(addDays(anchor, -7))}>Previous</Button>
        <Button variant="outline" onClick={() => setAnchor(new Date())}>Today</Button>
        <Button variant="outline" onClick={() => setAnchor(addDays(anchor, 7))}>Next</Button>
      </div>

      <div className="grid grid-cols-7 gap-2">
        {days.map((d) => (
          <Card key={d.toISOString()} className="p-3 min-h-[160px]">
            <div className="text-sm mb-2 font-medium">{format(d, 'EEE dd MMM')}</div>
            {/* Basic placeholder; we will refine to position by time */}
          </Card>
        ))}
      </div>
    </div>
  );
}


