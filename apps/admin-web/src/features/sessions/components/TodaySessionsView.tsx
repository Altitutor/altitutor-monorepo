'use client';

import { TodaySessionsCalendarView } from './TodaySessionsCalendarView';
import { SessionsTable } from './SessionsTable';
import { format } from 'date-fns';

export type ViewMode = 'calendar' | 'table';

type TodaySessionsViewProps = {
  viewMode: ViewMode;
  onOpenSession?: (id: string) => void;
  onOpenStudent?: (id: string) => void;
  onOpenStaff?: (id: string) => void;
};

export function TodaySessionsView({ viewMode, onOpenSession, onOpenStudent, onOpenStaff }: TodaySessionsViewProps) {
  const today = new Date();
  const todayStr = format(today, 'yyyy-MM-dd');

  return (
    <div className="flex flex-col">
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

