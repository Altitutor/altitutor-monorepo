'use client';

import React, { useState, useEffect } from 'react';
import { Users, Calendar, Clock, MoreVertical } from 'lucide-react';
import { Badge } from '@altitutor/ui';
import { Button } from '@altitutor/ui';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@altitutor/ui';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@altitutor/ui';
import type { Tables, ClassWithExpandedSubject } from '@altitutor/shared';
import type { ClassEnrollmentWithAudit } from '@altitutor/shared';
import { formatTime, getDayOfWeek, formatDate } from '@/shared/utils/datetime';
import { formatSubjectDisplay, formatSubjectShortName, getSubjectColorHex, getIconStrokeColor, cn } from '@/shared/utils';
import { useElementSize } from '@/shared/hooks/useElementSize';

// Helper function to get initials from a name
function getInitials(firstName: string, lastName: string): string {
  const first = firstName?.[0] || '';
  const last = lastName?.[0] || '';
  return `${first}${last}`.toUpperCase();
}


interface ClassCardProps {
  class: Tables<'classes'> | ClassWithExpandedSubject;
  subject?: Tables<'subjects'>;
  staff: Tables<'staff'>[];
  students?: Tables<'students'>[];
  onClick?: () => void;
  
  // Optional enrollment context (when displayed in a student context)
  enrollment?: ClassEnrollmentWithAudit;
  onChangeClass?: () => void;
  onUnenroll?: () => void;
  
  // Visual states
  isSelecting?: boolean;
  isSelected?: boolean;
  compact?: boolean; // Compact mode for calendar views
  isCalendarView?: boolean; // If true, subtitle shows only room (no date/time)
  hideActions?: boolean; // If true, hide the action menu button
  // Smart sizing props
  cardHeight?: number; // Height in pixels
  cardWidth?: number; // Width in pixels
}

export function ClassCard({
  class: classData,
  subject,
  staff,
  students = [],
  onClick,
  enrollment,
  onChangeClass,
  onUnenroll,
  isSelecting = false,
  isSelected = false,
  compact: forceCompact = false,
  isCalendarView = false,
  hideActions = false,
  cardHeight,
  cardWidth
}: ClassCardProps) {
  // Measure actual card dimensions using ResizeObserver
  const [, cardSize] = useElementSize<HTMLDivElement>();
  
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
  
  // 4. Names truncate to initials: width < 150px OR too many people
  const showFullNames = !forceCompact && actualWidth >= 150 && students.length <= 4 && staff.length <= 3;
  
  // Determine if we should use compact mode overall
  const shouldUseCompact = forceCompact || !iconVisible;
  const subjectDisplay = shouldUseCompact && subject 
    ? formatSubjectShortName(subject) 
    : subject 
      ? formatSubjectDisplay(subject) 
      : '-';
  const day = getDayOfWeek(classData.day_of_week);
  const timeRange = `${formatTime(classData.start_time)} - ${formatTime(classData.end_time)}`;
  const isFutureEnrollment = enrollment?.enrolled_at && new Date(enrollment.enrolled_at) > new Date();
  const hasMenuActions = !hideActions && (onChangeClass || onUnenroll);
  
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
      className={cn(
        'relative border rounded-lg transition-colors h-full w-full overflow-hidden bg-card',
        shouldUseCompact ? 'p-1.5' : 'p-3',
        defaultBorderClass,
        isSelecting
          ? isSelected
            ? 'bg-primary/10 border-primary border-2'
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
                {!shouldUseCompact && classData.level && (
                  <span className="text-xs text-muted-foreground">• {classData.level}</span>
                )}
              </div>
              <p className="text-xs text-muted-foreground mt-1 truncate">
                {isCalendarView ? (
                  classData.room ? `Room: ${classData.room}` : ''
                ) : (
                  <>
                    {day} {timeRange}
                    {classData.room && ` • Room: ${classData.room}`}
                  </>
                )}
              </p>
            </div>
            
            {hasMenuActions && (
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button 
                    variant="ghost" 
                    size="icon" 
                    className="h-8 w-8 flex-shrink-0"
                    onClick={(e) => e.stopPropagation()}
                  >
                    <MoreVertical className="h-4 w-4" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                  {onChangeClass && (
                    <DropdownMenuItem onClick={(e) => {
                      e.stopPropagation();
                      onChangeClass();
                    }}>
                      Change Class
                    </DropdownMenuItem>
                  )}
                  {onUnenroll && (
                    <DropdownMenuItem onClick={(e) => {
                      e.stopPropagation();
                      onUnenroll();
                    }}>
                      Unenroll Student
                    </DropdownMenuItem>
                  )}
                </DropdownMenuContent>
              </DropdownMenu>
            )}
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
                        'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300'
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
                  const fullName = `${student.first_name} ${student.last_name}`;
                  const display = !showFullNames ? getInitials(student.first_name, student.last_name) : fullName;
                  
                  const badge = (
                    <span
                      key={student.id}
                      className={cn(
                        'rounded',
                        shouldUseCompact 
                          ? 'text-[10px] px-1 py-0.5' 
                          : 'text-xs px-2 py-0.5',
                        'bg-muted'
                      )}
                    >
                      {display}
                    </span>
                  );
                  
                  if (!showFullNames) {
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
                  }
                  
                  return badge;
                })}
              </div>
            </div>
          )}
          
          {/* Enrollment Info */}
          {enrollment && (
            <div className="flex items-center gap-2 mt-2 text-xs text-muted-foreground">
              <Calendar className="h-3 w-3" />
              <span>
                Enrolled: {formatDate(new Date(enrollment.enrolled_at))}
              </span>
              {isFutureEnrollment && (
                <Badge variant="secondary" className="text-xs bg-blue-100 text-blue-800">
                  <Clock className="h-3 w-3 mr-1 inline" />
                  Future
                </Badge>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

