'use client';

import React from 'react';
import { Users, MapPin } from 'lucide-react';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@altitutor/ui';
import type { Tables } from '@altitutor/shared';
import { formatTime, formatDate } from '@/shared/utils/datetime';
import { getSubjectColorHex, getIconStrokeColor, formatSessionType, cn } from '@/shared/utils';
import { getSessionTitle, type SessionWithDetails } from '@/features/sessions/utils/session-helpers';

function getInitials(firstName: string | null | undefined, lastName: string | null | undefined): string {
  const first = firstName?.[0] || '';
  const last = lastName?.[0] || '';
  return `${first}${last}`.toUpperCase();
}

type SessionStudentBadge = {
  id?: string;
  first_name?: string | null;
  last_name?: string | null;
  planned_absence?: boolean;
  is_extra?: boolean;
  sessions_students_id?: string | null;
};

type SessionStaffBadge = {
  id?: string;
  first_name?: string | null;
  last_name?: string | null;
  planned_absence?: boolean;
  is_swapped_in?: boolean;
};

interface SessionCardProps {
  session: Tables<'sessions'> & {
    subject?: {
      name: string;
      color: string | null;
    } | null;
    class?: {
      level: string | null;
      room: string | null;
      day_of_week?: number | null;
      start_time?: string | null;
      end_time?: string | null;
      subject?: {
        curriculum?: string | null;
        year_level?: number | null;
        name?: string | null;
      } | null;
    } | null;
  };
  title?: string;
  students?: SessionStudentBadge[];
  staff?: SessionStaffBadge[];
  onClick?: () => void;
  className?: string;
}

export function SessionCard({
  session,
  title,
  students,
  staff,
  onClick,
  className
}: SessionCardProps) {
  const subjectColorHex = getSubjectColorHex(session.subject as Tables<'subjects'> | null | undefined);
  const iconStrokeColor = getIconStrokeColor(subjectColorHex);
  const sessionTitle = title || getSessionTitle(session as SessionWithDetails) || session.subject?.name || formatSessionType(session.type || '');
  const showFullNames = (students?.length || 0) <= 4 && (staff?.length || 0) <= 3;
  
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
              <h4 className="font-semibold text-sm leading-5">
                {sessionTitle}
              </h4>
              <div className="flex flex-col gap-0.5 mt-1">
                <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                  <span>{formatDate(session.start_at || '')} • {timeRange}</span>
                </div>
                {session.class?.room && (
                  <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                    <MapPin className="h-3 w-3" />
                    <span>{session.class.room}</span>
                  </div>
                )}

                {staff && staff.length > 0 && (
                  <div className="flex flex-wrap gap-1 mt-1">
                    {staff.map((staffMember, index) => {
                      const fullName = `${staffMember.first_name || ''} ${staffMember.last_name || ''}`.trim() || 'Staff';
                      const display = showFullNames ? fullName : getInitials(staffMember.first_name, staffMember.last_name);
                      const status = staffMember.planned_absence
                        ? 'Planned Absence'
                        : staffMember.is_swapped_in
                        ? 'Swapped In'
                        : 'Attending';
                      const colorClass = staffMember.planned_absence
                        ? 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-300'
                        : staffMember.is_swapped_in
                        ? 'bg-orange-100 text-orange-800 dark:bg-orange-900/30 dark:text-orange-300'
                        : 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300';

                      return (
                        <TooltipProvider key={staffMember.id || `${fullName}-${index}`} delayDuration={100}>
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <span className={cn('rounded text-xs px-2 py-0.5', colorClass)}>
                                {display}
                              </span>
                            </TooltipTrigger>
                            <TooltipContent>
                              <p>{fullName} - {status}</p>
                            </TooltipContent>
                          </Tooltip>
                        </TooltipProvider>
                      );
                    })}
                  </div>
                )}

                {students && students.length > 0 && (
                  <div className="flex flex-wrap gap-1 mt-1">
                    {students.map((student, index) => {
                      const fullName = `${student.first_name || ''} ${student.last_name || ''}`.trim() || 'Student';
                      const display = showFullNames ? fullName : getInitials(student.first_name, student.last_name);
                      const isUnplanned = student.is_extra && (student.sessions_students_id === null || student.sessions_students_id === undefined);
                      const isUnplannedFromRPC = student.is_extra && student.planned_absence && (student.sessions_students_id === null || student.sessions_students_id === undefined);
                      const status = isUnplanned || isUnplannedFromRPC
                        ? 'Unplanned'
                        : student.planned_absence && !student.is_extra
                        ? 'Planned Absence'
                        : student.is_extra && !isUnplanned && !isUnplannedFromRPC
                        ? 'Attending (extra)'
                        : 'Attending';
                      const colorClass = (isUnplanned || isUnplannedFromRPC) || (student.planned_absence && !student.is_extra)
                        ? 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-300'
                        : student.is_extra && !isUnplanned && !isUnplannedFromRPC
                        ? 'bg-orange-100 text-orange-800 dark:bg-orange-900/30 dark:text-orange-300'
                        : 'bg-muted';

                      return (
                        <TooltipProvider key={student.id || `${fullName}-${index}`} delayDuration={100}>
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <span className={cn('rounded text-xs px-2 py-0.5', colorClass)}>
                                {display}
                              </span>
                            </TooltipTrigger>
                            <TooltipContent>
                              <p>{fullName} - {status}</p>
                            </TooltipContent>
                          </Tooltip>
                        </TooltipProvider>
                      );
                    })}
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
