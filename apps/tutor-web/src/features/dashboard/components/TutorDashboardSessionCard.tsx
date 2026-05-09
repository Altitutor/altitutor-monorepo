'use client';

import { format } from 'date-fns';
import { Users } from 'lucide-react';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@altitutor/ui';
import type { Tables } from '@altitutor/shared';
import { formatTime } from '@/shared/utils/datetime';
import { getIconStrokeColor, getSubjectColorHex, formatSessionType, cn } from '@/shared/utils';
import { tutorCardCn, tutorTransition } from '@/shared/lib/tutor-visual';

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
}: TutorDashboardSessionCardProps) {
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

  const timeRange =
    session.start_at && session.end_at
      ? `${formatTime(new Date(session.start_at).toTimeString().slice(0, 5))} – ${formatTime(new Date(session.end_at).toTimeString().slice(0, 5))}`
      : '';

  const subjectForColor = session.subject_color
    ? ({ color: session.subject_color } as Tables<'subjects'>)
    : null;
  const subjectColorHex = getSubjectColorHex(subjectForColor);
  const iconBackgroundColor = subjectColorHex ? { backgroundColor: subjectColorHex } : undefined;
  const iconStrokeColor = getIconStrokeColor(subjectColorHex);

  const start = session.start_at ? new Date(session.start_at) : null;
  const dateLine = start ? format(start, 'EEEE, d MMMM yyyy') : null;

  const showFullNames = staff.length + students.length <= 6;

  return (
    <div
      className={cn(
        tutorCardCn('p-4 sm:p-5'),
        tutorTransition,
        'hover:-translate-y-0.5 hover:shadow-[0_12px_40px_rgb(0,0,0,0.08)]',
      )}
      style={{
        ...(subjectColorHex
          ? { borderLeftWidth: 4, borderLeftColor: subjectColorHex, borderLeftStyle: 'solid' }
          : {}),
      }}
    >
      <div className="flex items-start gap-4">
        <div className="flex-shrink-0">
          <div
            className={cn(
              'flex h-11 w-11 items-center justify-center rounded-xl',
              iconBackgroundColor ? '' : 'bg-muted/80 text-muted-foreground ring-1 ring-black/[0.06] dark:ring-white/10',
            )}
            style={iconBackgroundColor}
          >
            <Users
              className="h-5 w-5"
              style={iconBackgroundColor ? { stroke: iconStrokeColor } : undefined}
            />
          </div>
        </div>

        <div className="min-w-0 flex-1 space-y-2">
          {dateLine ? (
            <p className="text-xs font-medium tabular-nums text-muted-foreground">{dateLine}</p>
          ) : null}

          <TooltipProvider delayDuration={100}>
            <Tooltip>
              <TooltipTrigger asChild>
                <p className="text-base font-semibold leading-snug tracking-tight text-card-foreground">
                  {subjectDisplay}
                </p>
              </TooltipTrigger>
              <TooltipContent>
                <p>{subjectDisplay}</p>
              </TooltipContent>
            </Tooltip>
          </TooltipProvider>

          <p className="text-sm text-muted-foreground">
            {timeRange}
            {session.session_type
              ? ` · ${formatSessionType(session.session_type)}`
              : ''}
          </p>

          {staff.length > 0 ? (
            <div className="flex flex-wrap gap-1.5 pt-1">
              {staff.map((staffMember) => {
                const fullName = `${staffMember.first_name} ${staffMember.last_name}`;
                const display = showFullNames
                  ? fullName
                  : getInitials(staffMember.first_name, staffMember.last_name);
                return (
                  <TooltipProvider key={staffMember.id} delayDuration={100}>
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <span className="rounded-lg bg-blue-100 px-2 py-0.5 text-xs text-blue-800 dark:bg-blue-900/30 dark:text-blue-300">
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
          ) : null}

          {students.length > 0 ? (
            <div className="flex flex-wrap gap-1.5">
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
                            'rounded-lg px-2 py-0.5 text-xs',
                            isAbsent
                              ? 'bg-red-100 text-red-600 line-through dark:bg-red-900/30 dark:text-red-400'
                              : 'bg-muted/80 text-muted-foreground ring-1 ring-black/[0.06] dark:ring-white/10',
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
          ) : null}
        </div>
      </div>
    </div>
  );
}
