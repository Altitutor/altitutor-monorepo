'use client';

import React from 'react';
import { Users, Clock, MapPin } from 'lucide-react';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@altitutor/ui';
import type { Tables } from '@altitutor/shared';
import { formatTime, formatDate } from '@/shared/utils/datetime';
import { getSubjectColorHex, getIconStrokeColor, formatSessionType, cn } from '@/shared/utils';

interface SessionCardProps {
  session: Tables<'sessions'> & {
    subject?: {
      name: string;
      color: string | null;
    } | null;
    class?: {
      level: string | null;
      room: string | null;
    } | null;
  };
  onClick?: () => void;
  className?: string;
}

export function SessionCard({
  session,
  onClick,
  className
}: SessionCardProps) {
  const subjectColorHex = getSubjectColorHex(session.subject as any);
  const iconStrokeColor = getIconStrokeColor(subjectColorHex);
  
  const timeRange = session.start_at && session.end_at
    ? `${formatTime(new Date(session.start_at).toTimeString().slice(0, 5))} - ${formatTime(new Date(session.end_at).toTimeString().slice(0, 5))}`
    : '';

  return (
    <div
      className={cn(
        'relative border rounded-lg transition-colors p-3 bg-card overflow-hidden',
        onClick ? 'hover:bg-muted/50 cursor-pointer' : '',
        className
      )}
      style={{
        borderColor: subjectColorHex || undefined,
      }}
      onClick={onClick}
    >
      <div className="flex items-start gap-3">
        <div 
          className="h-10 w-10 rounded-lg flex items-center justify-center flex-shrink-0"
          style={{ backgroundColor: subjectColorHex || 'var(--muted)' }}
        >
          <Users 
            className="h-5 w-5" 
            style={{ stroke: subjectColorHex ? iconStrokeColor : 'var(--muted-foreground)' }}
          />
        </div>
        
        <div className="flex-1 min-w-0">
          <div className="flex items-start justify-between gap-2">
            <div className="flex-1 min-w-0">
              <h4 className="font-semibold text-sm truncate">
                {session.subject?.name || formatSessionType(session.type || '')}
              </h4>
              <div className="flex flex-col gap-0.5 mt-1">
                <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                  <Clock className="h-3 w-3" />
                  <span>{formatDate(session.start_at || '')} • {timeRange}</span>
                </div>
                {session.class?.room && (
                  <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                    <MapPin className="h-3 w-3" />
                    <span>{session.class.room}</span>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
