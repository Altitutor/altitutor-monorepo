'use client';

import { Users } from 'lucide-react';
import { Card, CardHeader, CardContent } from '@altitutor/ui';
import type { Tables } from '@altitutor/shared';
import { formatTime, getDayOfWeek } from '@/shared/utils/datetime';
import { formatSubjectDisplay } from '@/shared/utils';

interface ClassCardProps {
  class: Tables<'classes'>;
  subject?: Tables<'subjects'>;
  staff: Tables<'staff'>[];
  onClick?: () => void;
  isEnrolling?: boolean;
}

export function ClassCard({
  class: classData,
  subject,
  staff,
  onClick,
  isEnrolling = false
}: ClassCardProps) {
  const subjectDisplay = subject ? formatSubjectDisplay(subject) : '-';
  const day = getDayOfWeek(classData.day_of_week);
  const timeRange = `${formatTime(classData.start_time)} - ${formatTime(classData.end_time)}`;
  const staffNames = staff.map(s => `${s.first_name} ${s.last_name}`).join(', ');

  return (
    <div
      className={`flex items-center justify-between p-3 border rounded-lg transition-colors ${
        isEnrolling 
          ? 'border-dashed bg-muted/50 cursor-default' 
          : 'hover:bg-muted/50 cursor-pointer'
      }`}
      onClick={isEnrolling ? undefined : onClick}
    >
      <div className="flex items-center gap-3 flex-1 min-w-0">
        <Users className="h-5 w-5 text-muted-foreground flex-shrink-0" />
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <span className="font-medium">{subjectDisplay}</span>
            {classData.level && (
              <span className="text-sm text-muted-foreground">• {classData.level}</span>
            )}
          </div>
          <p className="text-xs text-muted-foreground">
            {day} {timeRange}
          </p>
          {staff.length > 0 && (
            <p className="text-xs text-muted-foreground">
              Tutor: {staffNames}
            </p>
          )}
        </div>
      </div>
    </div>
  );
}

