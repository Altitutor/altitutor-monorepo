'use client';

import React, { useState, useEffect } from 'react';
import { Users } from 'lucide-react';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@altitutor/ui';
import type { Database } from '@altitutor/shared';
import { formatTime } from '@/shared/utils/datetime';
import { getSubjectColorHex, getIconStrokeColor, formatSessionType, cn } from '@/shared/utils';
import { useElementSize } from '@/shared/hooks/useElementSize';

type StudentSession = Database['public']['Views']['vstudent_session_base']['Row'];

// Helper function to get initials from a name
function getInitials(firstName: string, lastName: string): string {
  const first = firstName?.[0] || '';
  const last = lastName?.[0] || '';
  return `${first}${last}`.toUpperCase();
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

interface StudentSessionsCardProps {
  session: StudentSession;
  staff?: StaffMember[];
  students?: StudentMember[];
  onClick?: () => void;
  isCalendarView?: boolean;
  cardHeight?: number;
  cardWidth?: number;
  isExtra?: boolean;
  isNotAttending?: boolean;
}

export function StudentSessionsCard({
  session,
  staff = [],
  students = [],
  onClick,
  isCalendarView = false,
  cardHeight,
  cardWidth,
  isExtra = false,
  isNotAttending = false,
}: StudentSessionsCardProps) {
  const [cardRef, cardSize] = useElementSize<HTMLDivElement>();
  
  const actualWidth = cardSize.width > 0 ? cardSize.width : (cardWidth ?? Infinity);
  const actualHeight = cardSize.height > 0 ? cardSize.height : (cardHeight ?? Infinity);
  
  const showIcon = actualWidth >= 200 && actualHeight >= 60;
  const [iconVisible, setIconVisible] = useState(showIcon);
  useEffect(() => {
    if (showIcon && actualWidth >= 210 && actualHeight >= 65) {
      setIconVisible(true);
    } else if (!showIcon || actualWidth < 200 || actualHeight < 60) {
      setIconVisible(false);
    }
  }, [showIcon, actualWidth, actualHeight]);
  
  const showFullNames = actualWidth >= 150 && (staff.length + students.length) <= 5;
  const shouldUseCompact = !iconVisible;
  
  // Build subject display from view data: {curriculum} {year_level} {name} {level}
  const subjectParts: string[] = [];
  if (session.subject_curriculum) {
    subjectParts.push(session.subject_curriculum);
  }
  // Use subject_year_level if available, otherwise fallback to subject_level
  const yearLevel = (session as any).subject_year_level ?? session.subject_level;
  if (yearLevel !== null && yearLevel !== undefined) {
    subjectParts.push(String(yearLevel));
  }
  if (session.subject_name) {
    subjectParts.push(session.subject_name);
  }
  // Add class level if available
  if ((session as any).class_level) {
    subjectParts.push((session as any).class_level);
  }
  const subjectDisplay = subjectParts.length > 0 
    ? subjectParts.join(' ') 
    : formatSessionType(session.session_type);
  
  const subjectDisplayShort = session.subject_name || formatSessionType(session.session_type);
  
  const timeRange = session.start_at && session.end_at
    ? `${formatTime(new Date(session.start_at).toTimeString().slice(0, 5))} - ${formatTime(new Date(session.end_at).toTimeString().slice(0, 5))}`
    : '';
  
  const subjectColorHex = (session as any).subject_color || null;
  const defaultBorderClass = !subjectColorHex ? 'border-gray-200 dark:border-gray-700' : '';
  const iconBackgroundColor = subjectColorHex ? { backgroundColor: subjectColorHex } : undefined;
  const iconStrokeColor = getIconStrokeColor(subjectColorHex);

  // Determine styling based on state
  const isGreyedOut = isNotAttending;
  const isExtraSession = isExtra;
  
  return (
    <div
      ref={cardRef}
      className={cn(
        'relative border rounded-lg transition-colors h-full w-full overflow-hidden bg-card',
        shouldUseCompact ? 'p-1.5' : 'p-3',
        defaultBorderClass,
        onClick ? 'hover:bg-muted/50 cursor-pointer' : '',
        isGreyedOut && 'opacity-50',
        isExtraSession && 'ring-2 ring-yellow-400 dark:ring-yellow-500'
      )}
      style={{
        ...(subjectColorHex && !isGreyedOut ? { borderColor: subjectColorHex } : {}),
        ...(isGreyedOut ? { borderColor: '#9ca3af' } : {})
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
                {shouldUseCompact ? (
                  <span className={cn('font-semibold text-xs', isCalendarView ? 'break-words' : 'truncate')}>
                    {subjectDisplayShort}
                  </span>
                ) : (
                  <TooltipProvider delayDuration={100}>
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <span className={cn('font-semibold text-sm', isCalendarView ? 'break-words' : 'truncate')} title={subjectDisplay}>
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
                  (session as any).room ? `Room: ${(session as any).room}` : ''
                ) : (
                  <>
                    {timeRange}
                    {(session as any).room && ` • Room: ${(session as any).room}`}
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
