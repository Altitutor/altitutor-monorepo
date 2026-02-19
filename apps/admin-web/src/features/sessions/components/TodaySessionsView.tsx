'use client';

import { TodaySessionsCalendarView } from './TodaySessionsCalendarView';
import { SessionsTable } from './SessionsTable';
import { format } from 'date-fns';

export type ViewMode = 'calendar' | 'table';

type TodaySessionsViewProps = {
  viewMode: ViewMode;
  date?: string;
  onOpenSession?: (id: string) => void;
  onOpenStudent?: (id: string) => void;
  onOpenStaff?: (id: string) => void;
};

export function TodaySessionsView({ date, viewMode, onOpenSession, onOpenStudent, onOpenStaff }: TodaySessionsViewProps) {
  const dateStr = date || format(new Date(), 'yyyy-MM-dd');

  return (
    <div className="flex flex-col">
      {/* Render view based on mode */}
      <div>
        {viewMode === 'calendar' ? (
          <TodaySessionsCalendarView date={dateStr} onOpenSession={onOpenSession} />
        ) : (
          <SessionsTable 
            rangeStart={dateStr}
            rangeEnd={dateStr}
            onOpenSession={onOpenSession}
            onOpenStudent={onOpenStudent}
            onOpenStaff={onOpenStaff}
          />
        )}
      </div>
    </div>
  );
}
