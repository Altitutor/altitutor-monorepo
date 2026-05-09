'use client';

import type { KeyboardEvent } from 'react';
import { useEffect, useState } from 'react';
import { Users } from 'lucide-react';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@altitutor/ui';
import type { Tables } from '@altitutor/shared';
import { formatSessionDate } from '@altitutor/shared';
import { getIconStrokeColor, getSubjectColorHex, formatSessionType, cn } from '@/shared/utils';
import { useElementSize } from '@/shared/hooks/useElementSize';

type TutorSessionShape = {
  session_id: string;
  session_type: string | null;
  start_at: string | null;
  end_at: string | null;
  class_level: string | null;
  subject_name: string | null;
  subject_curriculum: string | null;
  subject_level: string | null;
  subject_color: string | null;
  subject_year_level: number | null;
};

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
  planned_absence?: boolean;
}

export type TutorDashboardSessionCardProps = {
  session: TutorSessionShape;
  staff?: StaffMember[];
  students?: StudentMember[];
  /** Opens session details (e.g. SessionModal) when the card is activated */
  onOpen?: () => void;
};

function getInitials(firstName: string, lastName: string): string {
  const first = firstName?.[0] || '';
  const last = lastName?.[0] || '';
  return `${first}${last}`.toUpperCase();
}

export function TutorDashboardSessionCard({
  session,
  staff = [],
  students = [],
  onOpen,
}: TutorDashboardSessionCardProps) {
  const [cardRef, cardSize] = useElementSize<HTMLDivElement>();

  const actualWidth = cardSize.width > 0 ? cardSize.width : Infinity;
  const actualHeight = cardSize.height > 0 ? cardSize.height : Infinity;

  const showIcon = actualWidth >= 200 && actualHeight >= 60;
  const [iconVisible, setIconVisible] = useState(showIcon);
  useEffect(() => {
    if (showIcon && actualWidth >= 210 && actualHeight >= 65) {
      setIconVisible(true);
    } else if (!showIcon || actualWidth < 200 || actualHeight < 60) {
      setIconVisible(false);
    }
  }, [showIcon, actualWidth, actualHeight]);

  const showFullNames = actualWidth >= 150 && staff.length + students.length <= 5;
  const shouldUseCompact = !iconVisible;

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
  const subjectDisplay =
    subjectParts.length > 0
      ? subjectParts.join(' ')
      : formatSessionType(session.session_type ?? '');

  const subjectDisplayShort =
    session.subject_name || formatSessionType(session.session_type ?? '');

  const timeRange =
    session.start_at && session.end_at
      ? (() => {
          const startDate = new Date(session.start_at);
          const endDate = new Date(session.end_at);
          const startTime = startDate.toLocaleTimeString('en-AU', {
            hour: 'numeric',
            minute: '2-digit',
            timeZone: 'Australia/Adelaide',
            hour12: true,
          });
          const endTime = endDate.toLocaleTimeString('en-AU', {
            hour: 'numeric',
            minute: '2-digit',
            timeZone: 'Australia/Adelaide',
            hour12: true,
          });
          return `${startTime} - ${endTime}`;
        })()
      : '';

  const subjectForColor = session.subject_color
    ? ({ color: session.subject_color } as Tables<'subjects'>)
    : null;
  const subjectColorHex = getSubjectColorHex(subjectForColor);
  const defaultBorderClass = !subjectColorHex
    ? 'ring-1 ring-black/[0.06] dark:ring-white/10'
    : '';
  const iconBackgroundColor = subjectColorHex ? { backgroundColor: subjectColorHex } : undefined;
  const iconStrokeColor = getIconStrokeColor(subjectColorHex);

  const dateLabel = session.start_at ? formatSessionDate(session.start_at) : '';

  const handleKeyDown = (e: KeyboardEvent) => {
    if (!onOpen) return;
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      onOpen();
    }
  };

  return (
    <div
      ref={cardRef}
      className={cn(
        'relative h-full w-full overflow-hidden rounded-xl border-0 bg-card shadow-[0_6px_24px_rgb(0,0,0,0.05)] transition-colors duration-300 ease-out dark:shadow-[0_6px_24px_rgb(0,0,0,0.35)]',
        shouldUseCompact ? 'p-1.5' : 'p-3',
        defaultBorderClass,
        onOpen
          ? 'cursor-pointer hover:bg-muted/45 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring'
          : '',
      )}
      style={{
        ...(subjectColorHex
          ? { borderLeftWidth: 4, borderLeftColor: subjectColorHex, borderLeftStyle: 'solid' }
          : {}),
      }}
      role={onOpen ? 'button' : undefined}
      tabIndex={onOpen ? 0 : undefined}
      aria-label={onOpen ? `View session: ${subjectDisplay}` : undefined}
      onClick={onOpen}
      onKeyDown={handleKeyDown}
    >
      <div className={cn('flex items-start', shouldUseCompact ? 'gap-1.5' : 'gap-3')}>
        {iconVisible && (
          <div className="flex-shrink-0">
            <div
              className={cn(
                'flex h-10 w-10 items-center justify-center rounded-lg',
                iconBackgroundColor ? '' : 'bg-muted text-muted-foreground',
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

        <div className="min-w-0 flex-1 overflow-hidden">
          <div className="flex items-start justify-between gap-2">
            <div className="min-w-0 flex-1 overflow-hidden">
              <div className="flex items-center gap-2">
                {shouldUseCompact ? (
                  <span className="truncate text-xs font-semibold">{subjectDisplayShort}</span>
                ) : (
                  <TooltipProvider delayDuration={100}>
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <span className="truncate text-sm font-semibold" title={subjectDisplay}>
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
              <p className="mt-1 truncate text-xs text-muted-foreground">
                {dateLabel ? `${dateLabel} · ` : ''}
                {timeRange}
                {session.session_type ? ` • ${formatSessionType(session.session_type)}` : ''}
              </p>
            </div>
          </div>

          {staff.length > 0 ? (
            <div className={cn('flex flex-wrap items-center gap-2', shouldUseCompact ? 'mt-1' : 'mt-2')}>
              <div className="flex flex-wrap gap-1">
                {staff.map((staffMember) => {
                  const fullName = `${staffMember.first_name} ${staffMember.last_name}`;
                  const display = showFullNames
                    ? fullName
                    : getInitials(staffMember.first_name, staffMember.last_name);
                  return (
                    <TooltipProvider key={staffMember.id} delayDuration={100}>
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <span
                            className={cn(
                              'rounded bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300',
                              shouldUseCompact ? 'px-1 py-0.5 text-[10px]' : 'px-2 py-0.5 text-xs',
                            )}
                          >
                            {display}
                          </span>
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
          ) : null}

          {students.length > 0 ? (
            <div className={cn('flex flex-wrap items-center gap-2', shouldUseCompact ? 'mt-1' : 'mt-2')}>
              <div className="flex flex-wrap gap-1">
                {students.map((student) => {
                  const fullName = `${student.first_name} ${student.last_name}`;
                  const display = showFullNames
                    ? fullName
                    : getInitials(student.first_name, student.last_name);
                  const isAbsent = Boolean(student.planned_absence);
                  return (
                    <TooltipProvider key={student.id} delayDuration={100}>
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <span
                            className={cn(
                              'rounded',
                              isAbsent
                                ? 'bg-red-100 text-red-600 line-through dark:bg-red-900/30 dark:text-red-400'
                                : 'bg-muted text-muted-foreground',
                              shouldUseCompact ? 'px-1 py-0.5 text-[10px]' : 'px-2 py-0.5 text-xs',
                            )}
                          >
                            {display}
                          </span>
                        </TooltipTrigger>
                        <TooltipContent>
                          <p>
                            {fullName}
                            {isAbsent ? ' (absent)' : ''}
                          </p>
                        </TooltipContent>
                      </Tooltip>
                    </TooltipProvider>
                  );
                })}
              </div>
            </div>
          ) : null}
        </div>
      </div>
    </div>
  );
}
