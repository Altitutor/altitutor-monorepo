'use client';

import { useUnloggedSessions } from '../../hooks';
import { Card } from '@altitutor/ui';
import { Badge } from '@altitutor/ui';
import { format } from 'date-fns';
import { CalendarIcon, Clock } from 'lucide-react';
import { cn } from '@/shared/utils/index';

type Step1SessionPickerProps = {
  staffId: string;
  selectedSessionId?: string;
  onSelectSession: (sessionId: string) => void;
};

export function Step1SessionPicker({
  staffId,
  selectedSessionId,
  onSelectSession,
}: Step1SessionPickerProps) {
  const { data: sessions, isLoading } = useUnloggedSessions(staffId);

  if (isLoading) {
    return <div className="text-center py-8 text-muted-foreground">Loading sessions...</div>;
  }

  if (!sessions || sessions.length === 0) {
    return (
      <div className="text-center py-8">
        <p className="text-muted-foreground">No sessions available to log.</p>
        <p className="text-sm text-muted-foreground mt-2">
          All past sessions have been logged or you have no sessions assigned.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <p className="text-sm text-muted-foreground">
        Select a session to log. Only past or current sessions are shown.
      </p>
      <div className="grid gap-3 max-h-[500px] overflow-y-auto">
        {sessions.map((session) => {
          const isSelected = session.id === selectedSessionId;
          const startDate = session.start_at ? new Date(session.start_at) : null;
          const endDate = session.end_at ? new Date(session.end_at) : null;
          const subject = session.class?.subject;

          return (
            <Card
              key={session.id}
              className={cn(
                'p-4 cursor-pointer transition-all hover:shadow-md',
                isSelected && 'ring-2 ring-primary shadow-md'
              )}
              onClick={() => onSelectSession(session.id)}
            >
              <div className="flex items-start justify-between">
                <div className="space-y-2 flex-1">
                  <div className="flex items-center gap-2">
                    <Badge>{session.type}</Badge>
                    {isSelected && (
                      <Badge variant="outline" className="bg-primary/10">
                        Selected
                      </Badge>
                    )}
                  </div>
                  
                  {subject && (
                    <div className="font-medium">
                      {subject.curriculum && `${subject.curriculum} `}
                      {subject.year_level != null && `Year ${subject.year_level} `}
                      {subject.name}
                      {session.class?.level && ` - ${session.class.level}`}
                    </div>
                  )}

                  <div className="flex items-center gap-4 text-sm text-muted-foreground">
                    {startDate && (
                      <div className="flex items-center gap-1">
                        <CalendarIcon className="h-4 w-4" />
                        {format(startDate, 'EEE, dd MMM yyyy')}
                      </div>
                    )}
                    {startDate && endDate && (
                      <div className="flex items-center gap-1">
                        <Clock className="h-4 w-4" />
                        {format(startDate, 'HH:mm')} - {format(endDate, 'HH:mm')}
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </Card>
          );
        })}
      </div>
    </div>
  );
}

