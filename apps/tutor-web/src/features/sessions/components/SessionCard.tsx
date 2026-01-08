'use client';

import React, { useState, useEffect } from 'react';
import { Users } from 'lucide-react';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@altitutor/ui';
import type { Tables } from '@altitutor/shared';
import { formatTime } from '@/shared/utils/datetime';
import { formatSubjectDisplay, formatSubjectShortName, getSubjectColorHex, getIconStrokeColor, formatSessionType, cn } from '@/shared/utils';
import { useElementSize } from '@/shared/hooks/useElementSize';

// Session data from vtutor_sessions view
interface TutorSession {
  session_id: string;
  session_type: string;
  class_id: string | null;
  subject_id: string | null;
  start_at: string | null;
  end_at: string | null;
  // Class details
  class_day_of_week: number | null;
  class_start_time: string | null;
  class_end_time: string | null;
  class_room: string | null;
  class_level: string | null;
  class_status: string | null;
  // Subject details (flattened)
  subject_name: string | null;
  subject_curriculum: string | null;
  subject_discipline: string | null;
  subject_level: string | null;
  subject_color: string | null;
  subject_year_level: number | null;
}

interface StaffMember {
  id: string;
  first_name: string;
  last_name: string;
  role?: string;
}

interface StudentMember {
  id: string;
  first_name: string;
  last_name: string;
  year_level?: number;
}

interface SessionCardProps {
  session: TutorSession;
  staff?: StaffMember[];
  students?: StudentMember[];
  onClick?: () => void;
  isCalendarView?: boolean;
  cardHeight?: number;
  cardWidth?: number;
}

// Helper function to get initials from a name
function getInitials(firstName: string, lastName: string): string {
  const first = firstName?.[0] || '';
  const last = lastName?.[0] || '';
  return `${first}${last}`.toUpperCase();
}

export function SessionCard({
  session,
  staff = [],
  students = [],
  onClick,
  isCalendarView = false,
  cardHeight,
  cardWidth
}: SessionCardProps) {
  // Measure actual card dimensions using ResizeObserver
  const [cardRef, cardSize] = useElementSize<HTMLDivElement>();
  
  // Use actual measured size if available, otherwise fall back to props
  const actualWidth = cardSize.width > 0 ? cardSize.width : (cardWidth ?? Infinity);
  const actualHeight = cardSize.height > 0 ? cardSize.height : (cardHeight ?? Infinity);
  
  // Progressive responsive breakpoints
  const showIcon = actualWidth >= 200 && actualHeight >= 60;
  const [iconVisible, setIconVisible] = useState(false);
  
  useEffect(() => {
    if (showIcon && actualWidth >= 210 && actualHeight >= 65) {
      setIconVisible(true);
    } else if (!showIcon || actualWidth < 200 || actualHeight < 60) {
      setIconVisible(false);
    }
  }, [showIcon, actualWidth, actualHeight]);
  
  const showFullNames = actualWidth >= 150 && (staff.length + students.length) <= 5;
  const shouldUseCompact = !iconVisible;
  
  // Build subject display from flattened fields
  const subjectParts: string[] = [];
  if (session.subject_curriculum) {
    subjectParts.push(session.subject_curriculum);
  }
  if (session.subject_year_level !== null && session.subject_year_level !== undefined) {
    subjectParts.push(String(session.subject_year_level));
  }
  if (session.subject_name) {
    subjectParts.push(session.subject_name);
  }
  if (session.class_level) {
    subjectParts.push(session.class_level);
  }
  const subjectDisplay = subjectParts.length > 0 
    ? subjectParts.join(' ') 
    : formatSessionType(session.session_type);
  
  const subjectDisplayShort = session.subject_name || formatSessionType(session.session_type);
  
  const timeRange = session.start_at && session.end_at
    ? `${formatTime(new Date(session.start_at).toTimeString().slice(0, 5))} - ${formatTime(new Date(session.end_at).toTimeString().slice(0, 5))}`
    : '';
  
  // Get subject color for the card - create a minimal subject-like object
  const subjectForColor = session.subject_color 
    ? { color: session.subject_color } as Tables<'subjects'>
    : null;
  const subjectColorHex = getSubjectColorHex(subjectForColor);
  const defaultBorderClass = !subjectColorHex ? 'border-gray-200 dark:border-gray-700' : '';
  
  // Icon background color (use subject color)
  const iconBackgroundColor = subjectColorHex 
    ? { backgroundColor: subjectColorHex }
    : undefined;
  
  // Icon stroke color (adapts to background luminance)
  const iconStrokeColor = getIconStrokeColor(subjectColorHex);

  return (
    <div
      ref={cardRef}
      className={cn(
        'relative border rounded-lg transition-colors h-full w-full overflow-hidden bg-card',
        shouldUseCompact ? 'p-1.5' : 'p-3',
        defaultBorderClass,
        onClick ? 'hover:bg-muted/50 cursor-pointer' : ''
      )}
      style={{
        ...(subjectColorHex && !defaultBorderClass ? { borderColor: subjectColorHex } : {}),
      }}
      onClick={onClick}
    >
      <div className={cn('flex items-start', shouldUseCompact ? 'gap-1.5' : 'gap-3')}>
        {iconVisible && (
          <div className="flex-shrink-0">
            <div 
              className={cn(
                'h-10 w-10 rounded-lg flex items-center justify-center',
                iconBackgroundColor ? '' : 'bg-muted text-muted-foreground'
              )}
              style={iconBackgroundColor}
            >
              <Users 
                className="h-5 w-5" 
                style={iconBackgroundColor ? { stroke: iconStrokeColor } : undefined}
              />
            </div>
          </div>
        )}
        
        <div className={cn('flex-1 min-w-0', isCalendarView ? 'overflow-visible' : 'overflow-hidden')}>
          <div className="flex items-start justify-between gap-2">
            <div className={cn('flex-1 min-w-0', isCalendarView ? 'overflow-visible' : 'overflow-hidden')}>
              <div className={cn('flex items-center gap-2', isCalendarView && 'flex-wrap')}>
                {shouldUseCompact && !isCalendarView ? (
                  <span className={cn('font-semibold text-xs', isCalendarView ? 'break-words' : 'truncate')}>
                    {subjectDisplayShort}
                  </span>
                ) : (
                  <TooltipProvider delayDuration={100}>
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <span className={cn(
                          'font-semibold',
                          isCalendarView ? 'text-xs break-words' : 'text-sm truncate'
                        )} title={subjectDisplay}>
                          {subjectDisplay}
                        </span>
                      </TooltipTrigger>
                      <TooltipContent>
                        <p>{subjectDisplay}</p>
                      </TooltipContent>
                    </Tooltip>
                  </TooltipProvider>
                )}
              </div>
              <p className="text-xs text-muted-foreground mt-1 truncate">
                {isCalendarView ? (
                  formatSessionType(session.session_type)
                ) : (
                  <>
                    {timeRange}
                    {formatSessionType(session.session_type) && ` • ${formatSessionType(session.session_type)}`}
                  </>
                )}
              </p>
            </div>
          </div>
          
          {/* Staff */}
          {staff.length > 0 && (
            <div className={cn('flex items-center gap-2 flex-wrap', shouldUseCompact ? 'mt-1' : 'mt-2')}>
              <div className="flex flex-wrap gap-1">
                {staff.map((staffMember) => {
                  const fullName = `${staffMember.first_name} ${staffMember.last_name}`;
                  const display = !showFullNames ? getInitials(staffMember.first_name, staffMember.last_name) : fullName;
                  
                  const badge = (
                    <span
                      key={staffMember.id}
                      className={cn(
                        'rounded bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300',
                        shouldUseCompact 
                          ? 'text-[10px] px-1 py-0.5' 
                          : 'text-xs px-2 py-0.5'
                      )}
                    >
                      {display}
                    </span>
                  );
                  
                  return (
                    <TooltipProvider key={staffMember.id} delayDuration={100}>
                      <Tooltip>
                        <TooltipTrigger asChild>
                          {badge}
                        </TooltipTrigger>
                        <TooltipContent>
                          <p>{fullName}</p>
                        </TooltipContent>
                      </Tooltip>
                    </TooltipProvider>
                  );
                })}
              </div>
            </div>
          )}
          
          {/* Students */}
          {students.length > 0 && (
            <div className={cn('flex items-center gap-2 flex-wrap', shouldUseCompact ? 'mt-1' : 'mt-2')}>
              <div className="flex flex-wrap gap-1">
                {students.map((student) => {
                  const fullName = `${student.first_name} ${student.last_name}`;
                  const display = !showFullNames ? getInitials(student.first_name, student.last_name) : fullName;
                  
                  const badge = (
                    <span
                      key={student.id}
                      className={cn(
                        'rounded bg-muted text-muted-foreground',
                        shouldUseCompact 
                          ? 'text-[10px] px-1 py-0.5' 
                          : 'text-xs px-2 py-0.5'
                      )}
                    >
                      {display}
                    </span>
                  );
                  
                  return (
                    <TooltipProvider key={student.id} delayDuration={100}>
                      <Tooltip>
                        <TooltipTrigger asChild>
                          {badge}
                        </TooltipTrigger>
                        <TooltipContent>
                          <p>{fullName}</p>
                        </TooltipContent>
                      </Tooltip>
                    </TooltipProvider>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

