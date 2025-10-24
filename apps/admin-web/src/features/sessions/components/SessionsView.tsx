'use client';

import { useState } from 'react';
import { Button } from '@altitutor/ui';
import { Calendar, Table as TableIcon } from 'lucide-react';
import { SessionsCalendarView } from './SessionsCalendarView';
import { SessionsTable } from './SessionsTable';
import { cn } from '@/shared/utils/index';

type ViewMode = 'calendar' | 'table';

type SessionsViewProps = {
  onOpenSession?: (id: string) => void;
  onOpenStudent?: (id: string) => void;
  onOpenStaff?: (id: string) => void;
};

export function SessionsView({ onOpenSession, onOpenStudent, onOpenStaff }: SessionsViewProps) {
  const [viewMode, setViewMode] = useState<ViewMode>('calendar');

  return (
    <div className="space-y-4">
      {/* View toggle */}
      <div className="flex justify-between items-center">
        <h2 className="text-2xl font-bold">Sessions</h2>
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
      {viewMode === 'calendar' ? (
        <SessionsCalendarView onOpenSession={onOpenSession} />
      ) : (
        <SessionsTable 
          onOpenSession={onOpenSession}
          onOpenStudent={onOpenStudent}
          onOpenStaff={onOpenStaff}
        />
      )}
    </div>
  );
}

