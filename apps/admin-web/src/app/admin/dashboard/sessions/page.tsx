'use client';

import { Suspense, useMemo, useState } from 'react';
import { SessionsTable } from '@/features/sessions';
import { SessionsCalendarView } from '@/features/sessions';
import { Button, Input, Tabs, TabsList, TabsTrigger, TabsContent } from '@altitutor/ui';
import { useSearchParams, useRouter } from 'next/navigation';
import { usePrecreateSessions } from '@/features/sessions';

export default function SessionsPage() {
  const search = useSearchParams();
  const router = useRouter();
  const viewParam = search.get('view') || 'table';
  const [startDate, setStartDate] = useState<string>('');
  const [endDate, setEndDate] = useState<string>('');
  const { mutate: precreate, isPending } = usePrecreateSessions();

  const setView = (v: 'table' | 'calendar') => {
    const params = new URLSearchParams(search.toString());
    params.set('view', v);
    router.push(`/admin/dashboard/sessions?${params.toString()}`);
  };

  const onPrecreate = () => {
    if (!startDate || !endDate) return;
    precreate({ start_date: startDate, end_date: endDate });
  };

  return (
    <div className="p-6 space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-3xl font-bold tracking-tight">Sessions</h1>
        <Tabs value={viewParam} onValueChange={(v) => setView(v as any)}>
          <TabsList>
            <TabsTrigger value="table">Table</TabsTrigger>
            <TabsTrigger value="calendar">Calendar</TabsTrigger>
          </TabsList>
        </Tabs>
      </div>

      {viewParam === 'table' && (
        <div className="flex items-end gap-2">
          <div>
            <label className="block text-sm mb-1">Start</label>
            <Input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} />
          </div>
          <div>
            <label className="block text-sm mb-1">End</label>
            <Input type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)} />
          </div>
          <Button onClick={onPrecreate} disabled={!startDate || !endDate || isPending}>
            Precreate
          </Button>
        </div>
      )}

      <Suspense>
        {viewParam === 'table' ? (
          <SessionsTable rangeStart={startDate || undefined} rangeEnd={endDate || undefined} />
        ) : (
          <SessionsCalendarView />
        )}
      </Suspense>
    </div>
  );
}


