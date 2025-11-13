'use client';

import { useState } from 'react';
import { Button } from '@altitutor/ui';
import { Calendar, Table as TableIcon } from 'lucide-react';
import { TodaySessionsCalendarView } from './TodaySessionsCalendarView';
import { SessionsTable } from './SessionsTable';
import { cn } from '@/shared/utils/index';
import { format } from 'date-fns';

type ViewMode = 'calendar' | 'table';

type TodaySessionsViewProps = {
  onOpenSession?: (id: string) => void;
  onOpenStudent?: (id: string) => void;
  onOpenStaff?: (id: string) => void;
};

export function TodaySessionsView({ onOpenSession, onOpenStudent, onOpenStaff }: TodaySessionsViewProps) {
  const [viewMode, setViewMode] = useState<ViewMode>('calendar');
  const today = new Date();
  const todayStr = format(today, 'yyyy-MM-dd');

  return (
    <div className="flex flex-col">
      {/* View toggle */}
      <div className="flex justify-end items-center mb-4">
        <div className="flex gap-2">
          <Button
            variant={viewMode === 'calendar' ? 'default' : 'outline'}
            size="sm"
            onClick={() => setViewMode('calendar')}
            className={cn(viewMode === 'calendar' && 'shadow-sm')}
          >
            <Calendar className="h-4 w-4 mr-2" />
            Calendar
          </Button>
          <Button
            variant={viewMode === 'table' ? 'default' : 'outline'}
            size="sm"
            onClick={() => setViewMode('table')}
            className={cn(viewMode === 'table' && 'shadow-sm')}
          >
            <TableIcon className="h-4 w-4 mr-2" />
            Table
          </Button>
        </div>
      </div>

      {/* Render view based on mode */}
      <div>
        {viewMode === 'calendar' ? (
          <TodaySessionsCalendarView onOpenSession={onOpenSession} />
        ) : (
          <SessionsTable 
            rangeStart={todayStr}
            rangeEnd={todayStr}
            onOpenSession={onOpenSession}
            onOpenStudent={onOpenStudent}
            onOpenStaff={onOpenStaff}
          />
        )}
      </div>
    </div>
  );
}

