'use client';

import React, { useState, useEffect } from 'react';
import { Briefcase } from 'lucide-react';
import { Badge } from '@altitutor/ui';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@altitutor/ui';
import type { Tables } from '@altitutor/shared';
import { formatTime, getDayOfWeek } from '@/shared/utils/datetime';
import { cn } from '@/shared/utils';
import { useElementSize } from '@/shared/hooks/useElementSize';

// Helper function to get initials from a name
function getInitials(firstName: string, lastName: string): string {
  const first = firstName?.[0] || '';
  const last = lastName?.[0] || '';
  return `${first}${last}`.toUpperCase();
}

interface AdminShiftCardProps {
  adminShift: Tables<'admin_shifts'>;
  staff: Tables<'staff'>[];
  onClick?: () => void;
  
  // Visual states
  compact?: boolean; // Compact mode for calendar views
  isCalendarView?: boolean; // If true, subtitle shows only time (no day)
  // Smart sizing props
  cardHeight?: number; // Height in pixels
  cardWidth?: number; // Width in pixels
}

export function AdminShiftCard({
  adminShift,
  staff = [],
  onClick,
  compact: forceCompact = false,
  isCalendarView = false,
  cardHeight,
  cardWidth
}: AdminShiftCardProps) {
  // Measure actual card dimensions using ResizeObserver
  const [cardRef, cardSize] = useElementSize<HTMLDivElement>();
  
  // Use actual measured size if available, otherwise fall back to props
  const actualWidth = cardSize.width > 0 ? cardSize.width : (cardWidth ?? Infinity);
  const actualHeight = cardSize.height > 0 ? cardSize.height : (cardHeight ?? Infinity);
  
  // Progressive responsive breakpoints with hysteresis to prevent flickering:
  const showIcon = !forceCompact && actualWidth >= 200 && actualHeight >= 60;
  const [iconVisible, setIconVisible] = useState(showIcon);
  useEffect(() => {
    if (showIcon && actualWidth >= 210 && actualHeight >= 65) {
      setIconVisible(true);
    } else if (!showIcon || actualWidth < 200 || actualHeight < 60) {
      setIconVisible(false);
    }
  }, [showIcon, actualWidth, actualHeight]);
  
  // Names truncate to initials: width < 150px OR too many people
  const showFullNames = !forceCompact && actualWidth >= 150 && staff.length <= 3;
  
  // Determine if we should use compact mode overall
  const shouldUseCompact = forceCompact || !iconVisible;
  const day = getDayOfWeek(adminShift.day_of_week);
  const timeRange = `${formatTime(adminShift.start_time)} - ${formatTime(adminShift.end_time)}`;
  
  // Status badge color
  const getStatusBadgeColor = (status: string) => {
    switch (status) {
      case 'ACTIVE':
        return 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300';
      case 'INACTIVE':
        return 'bg-gray-100 text-gray-800 dark:bg-gray-800 dark:text-gray-300';
      default:
        return 'bg-gray-100 text-gray-800 dark:bg-gray-800 dark:text-gray-300';
    }
  };

  // Admin shift color (use a distinct color - purple/indigo)
  const adminShiftColorHex = '#6366f1'; // indigo-500
  const defaultBorderClass = 'border-indigo-200 dark:border-indigo-800';
  const iconBackgroundColor = { backgroundColor: adminShiftColorHex };

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
        borderColor: adminShiftColorHex
      }}
      onClick={onClick}
    >
      <div className={cn('flex items-start', shouldUseCompact ? 'gap-1.5' : 'gap-3')}>
        {iconVisible && (
          <div className="flex-shrink-0">
            <div 
              className="h-10 w-10 rounded-lg flex items-center justify-center"
              style={iconBackgroundColor}
            >
              <Briefcase 
                className="h-5 w-5" 
                style={{ stroke: 'white' }}
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
                    Admin Shift
                  </span>
                ) : (
                  <TooltipProvider delayDuration={100}>
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <span className={cn('font-semibold truncate', 'text-sm')} title="Admin Shift">
                          Admin Shift
                        </span>
                      </TooltipTrigger>
                      <TooltipContent>
                        <p>Admin Shift</p>
                      </TooltipContent>
                    </Tooltip>
                  </TooltipProvider>
                )}
                {!shouldUseCompact && (
                  <Badge className={cn('text-xs', getStatusBadgeColor(adminShift.status))}>
                    {adminShift.status}
                  </Badge>
                )}
              </div>
              <p className="text-xs text-muted-foreground mt-1 truncate">
                {isCalendarView ? (
                  timeRange
                ) : (
                  <>
                    {day} {timeRange}
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
          
          {staff.length === 0 && !shouldUseCompact && (
            <div className="text-xs text-muted-foreground mt-2">
              No staff assigned
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
