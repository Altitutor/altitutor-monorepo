'use client';

import React, { useState, useEffect } from 'react';
import { Users } from 'lucide-react';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@altitutor/ui';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@altitutor/ui';
import type { Tables } from '@altitutor/shared';
import { formatTime, getDayOfWeek, formatDate } from '@/shared/utils/datetime';
import { formatSubjectDisplay, formatSubjectShortName, getSubjectColorStyle, getSubjectColorHex, getIconStrokeColor, cn } from '@/shared/utils';
import { useElementSize } from '@/shared/hooks/useElementSize';

// Helper function to get initials from a name
function getInitials(firstName: string, lastName: string): string {
  const first = firstName?.[0] || '';
  const last = lastName?.[0] || '';
  return `${first}${last}`.toUpperCase();
}


interface SessionsCardProps {
  session: Tables<'sessions'>;
  classData?: Tables<'classes'>;
  subject?: Tables<'subjects'>;
  staff: Array<Tables<'staff'> & { planned_absence?: boolean }>;
  students?: Array<Tables<'students'> & { planned_absence?: boolean; is_extra?: boolean }>;
  onClick?: () => void;
  
  // Visual states
  isSelecting?: boolean;
  isSelected?: boolean;
  compact?: boolean; // Compact mode for calendar views
  isCalendarView?: boolean; // If true, subtitle shows only room (no date/time)
  // Smart sizing props
  cardHeight?: number; // Height in pixels
  cardWidth?: number; // Width in pixels
}

export function SessionsCard({
  session,
  classData,
  subject,
  staff = [],
  students = [],
  onClick,
  isSelecting = false,
  isSelected = false,
  compact: forceCompact = false,
  isCalendarView = false,
  cardHeight,
  cardWidth
}: SessionsCardProps) {
  // Measure actual card dimensions using ResizeObserver
  const [cardRef, cardSize] = useElementSize<HTMLDivElement>();
  
  // Use actual measured size if available, otherwise fall back to props
  const actualWidth = cardSize.width > 0 ? cardSize.width : (cardWidth ?? Infinity);
  const actualHeight = cardSize.height > 0 ? cardSize.height : (cardHeight ?? Infinity);
  
  // Progressive responsive breakpoints with hysteresis to prevent flickering:
  // Use different thresholds for showing vs hiding (add buffer to prevent oscillation)
  // 1. Icon disappears first: width < 210px OR height < 65px (higher threshold to hide)
  //    Icon appears: width >= 200px AND height >= 60px (lower threshold to show)
  const showIcon = !forceCompact && actualWidth >= 200 && actualHeight >= 60;
  // Use state to prevent flickering - once hidden, require more space to show again
  const [iconVisible, setIconVisible] = useState(showIcon);
  useEffect(() => {
    if (showIcon && actualWidth >= 210 && actualHeight >= 65) {
      setIconVisible(true);
    } else if (!showIcon || actualWidth < 200 || actualHeight < 60) {
      setIconVisible(false);
    }
  }, [showIcon, actualWidth, actualHeight]);
  
  // 2. Labels removed - never show "Tutor:" or "Student:" labels
  
  // 3. Subtitle always shown but truncated (never disappears)
  const showSubtitle = true; // Always show subtitle, just truncate it
  
  // 4. Names truncate to initials: width < 150px OR too many people
  const showFullNames = !forceCompact && actualWidth >= 150 && students.length <= 4 && staff.length <= 3;
  
  // Determine if we should use compact mode overall
  const shouldUseCompact = forceCompact || !iconVisible;
  
  const subjectDisplay = shouldUseCompact && subject 
    ? formatSubjectShortName(subject) 
    : subject 
      ? formatSubjectDisplay(subject) 
      : session.type === 'CLASS' ? 'Class' : 'Meeting';
  const day = classData ? getDayOfWeek(classData.day_of_week) : '';
  const timeRange = session.start_at && session.end_at
    ? `${formatTime(new Date(session.start_at).toTimeString().slice(0, 5))} - ${formatTime(new Date(session.end_at).toTimeString().slice(0, 5))}`
    : '';
  
  // Get subject color for the card (border and icon only)
  const subjectColorHex = getSubjectColorHex(subject);
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
        isSelecting
          ? isSelected
            ? 'bg-primary/5 border-primary'
            : 'hover:bg-muted/50 cursor-pointer'
          : onClick
          ? 'hover:bg-muted/50 cursor-pointer'
          : ''
      )}
      style={{
        ...(subjectColorHex ? { borderColor: subjectColorHex } : {})
      }}
      onClick={isSelecting || onClick ? onClick : undefined}
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
        
        <div className="flex-1 min-w-0 overflow-hidden">
          <div className="flex items-start justify-between gap-2">
            <div className="flex-1 min-w-0 overflow-hidden">
              <div className="flex items-center gap-2">
                {shouldUseCompact ? (
                  <span className={cn('font-semibold truncate', 'text-xs')}>
                    {subjectDisplay}
                  </span>
                ) : (
                  <TooltipProvider delayDuration={100}>
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <span className={cn('font-semibold truncate', 'text-sm')} title={subjectDisplay}>
                          {subjectDisplay}
                        </span>
                      </TooltipTrigger>
                      <TooltipContent>
                        <p>{subjectDisplay}</p>
                      </TooltipContent>
                    </Tooltip>
                  </TooltipProvider>
                )}
                {!shouldUseCompact && classData?.level && (
                  <span className="text-xs text-muted-foreground">• {classData.level}</span>
                )}
              </div>
              <p className="text-xs text-muted-foreground mt-1 truncate">
                {isCalendarView ? (
                  classData?.room ? `Room: ${classData.room}` : ''
                ) : (
                  <>
                    {day && timeRange && (
                      <>
                        {day} {timeRange}
                        {classData?.room && ` • Room: ${classData.room}`}
                      </>
                    )}
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
                        'rounded',
                        shouldUseCompact 
                          ? 'text-[10px] px-1 py-0.5' 
                          : 'text-xs px-2 py-0.5',
                        staffMember.planned_absence
                          ? 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-300'
                          : 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300'
                      )}
                    >
                      {display}
                    </span>
                  );
                  
                  if (!showFullNames) {
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
                  }
                  
                  return badge;
                })}
              </div>
            </div>
          )}
          
          {/* Students */}
          {students.length > 0 && (
            <div className={cn('flex items-center gap-2 flex-wrap', shouldUseCompact ? 'mt-1' : 'mt-2')}>
              <div className="flex flex-wrap gap-1">
                {students.map((student) => {
                  // #region agent log
                  if (student.first_name === 'Elliot' && student.last_name === 'Koh') {
                    fetch('http://127.0.0.1:7242/ingest/03d835b2-9f2b-42e2-a795-53809de736bc',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'SessionsCard.tsx:238',message:'Elliot Koh in SessionsCard',data:{is_extra:student.is_extra,is_extra_type:typeof student.is_extra,planned_absence:student.planned_absence,student},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'D'})}).catch(()=>{});
                  }
                  // #endregion
                  const fullName = `${student.first_name} ${student.last_name}`;
                  const display = !showFullNames ? getInitials(student.first_name, student.last_name) : fullName;
                  
                  // Determine status for tooltip
                  const status = student.planned_absence 
                    ? 'Planned Absence' 
                    : student.is_extra 
                    ? 'Attending (extra)' 
                    : 'Attending';
                  // #region agent log
                  if (student.first_name === 'Elliot' && student.last_name === 'Koh') {
                    fetch('http://127.0.0.1:7242/ingest/03d835b2-9f2b-42e2-a795-53809de736bc',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'SessionsCard.tsx:247',message:'Elliot Koh status calculation',data:{status,planned_absence:student.planned_absence,is_extra:student.is_extra},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'D'})}).catch(()=>{});
                  }
                  // #endregion
                  
                  const badge = (
                    <span
                      key={student.id}
                      className={cn(
                        'rounded',
                        shouldUseCompact 
                          ? 'text-[10px] px-1 py-0.5' 
                          : 'text-xs px-2 py-0.5',
                        student.planned_absence
                          ? 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-300'
                          : student.is_extra
                          ? 'bg-orange-100 text-orange-800 dark:bg-orange-900/30 dark:text-orange-300'
                          : 'bg-muted'
                      )}
                    >
                      {display}
                    </span>
                  );
                  
                  // Always show tooltip with name and status
                  return (
                    <TooltipProvider key={student.id} delayDuration={100}>
                      <Tooltip>
                        <TooltipTrigger asChild>
                          {badge}
                        </TooltipTrigger>
                        <TooltipContent>
                          <p>{fullName} - {status}</p>
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

