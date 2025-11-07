'use client';

import { Users, Calendar, Clock, MoreVertical } from 'lucide-react';
import { Badge } from '@altitutor/ui';
import { Button } from '@altitutor/ui';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@altitutor/ui';
import type { Tables } from '@altitutor/shared';
import type { ClassEnrollmentWithAudit } from '@altitutor/shared';
import { SUBJECT_DISCIPLINE_COLORS } from '@altitutor/ui';
import { formatTime, getDayOfWeek, formatDate } from '@/shared/utils/datetime';
import { formatSubjectDisplay } from '@/shared/utils';

interface ClassCardProps {
  class: Tables<'classes'>;
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
  isSelected = false
}: ClassCardProps) {
  const subjectDisplay = subject ? formatSubjectDisplay(subject) : '-';
  const day = getDayOfWeek(classData.day_of_week);
  const timeRange = `${formatTime(classData.start_time)} - ${formatTime(classData.end_time)}`;
  const staffNames = staff.map(s => `${s.first_name} ${s.last_name}`).join(', ');
  const isFutureEnrollment = enrollment?.enrolled_at && new Date(enrollment.enrolled_at) > new Date();
  const hasEnrollmentContext = enrollment && (onChangeClass || onUnenroll);
  
  // Get discipline color for the card
  const disciplineColor = subject?.discipline
    ? SUBJECT_DISCIPLINE_COLORS[subject.discipline as keyof typeof SUBJECT_DISCIPLINE_COLORS]
    : 'bg-gray-100 text-gray-800';
  
  // Extract background color for border
  const borderColorClass = disciplineColor.split(' ')[0].replace('bg-', 'border-');

  return (
    <div
      className={`relative p-3 border-2 rounded-lg transition-colors ${borderColorClass} ${
        isSelecting
          ? isSelected
            ? 'bg-primary/5 border-primary'
            : 'hover:bg-muted/50 cursor-pointer'
          : onClick
          ? 'hover:bg-muted/50 cursor-pointer'
          : 'bg-background'
      }`}
      onClick={isSelecting || onClick ? onClick : undefined}
    >
      <div className="flex items-start gap-3">
        <div className="flex-shrink-0">
          <div className={`h-10 w-10 rounded-lg flex items-center justify-center ${disciplineColor}`}>
            <Users className="h-5 w-5" />
          </div>
        </div>
        
        <div className="flex-1 min-w-0">
          <div className="flex items-start justify-between gap-2">
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2">
                <span className="font-semibold text-sm">{subjectDisplay}</span>
                {classData.level && (
                  <span className="text-xs text-muted-foreground">• {classData.level}</span>
                )}
              </div>
              <p className="text-xs text-muted-foreground mt-1">
                {day} {timeRange}
              </p>
              {classData.room && (
                <p className="text-xs text-muted-foreground">
                  Room: {classData.room}
                </p>
              )}
            </div>
            
            {hasEnrollmentContext && (
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
            <p className="text-xs text-muted-foreground mt-2">
              <span className="font-medium">Tutor:</span> {staffNames}
            </p>
          )}
          
          {/* Students */}
          {students.length > 0 && (
            <div className="mt-2">
              <p className="text-xs font-medium text-muted-foreground mb-1">
                Students: {students.length}
              </p>
              <div className="flex flex-wrap gap-1">
                {students.slice(0, 5).map((student) => (
                  <span
                    key={student.id}
                    className="text-xs px-2 py-0.5 bg-muted rounded"
                  >
                    {student.first_name} {student.last_name.charAt(0)}.
                  </span>
                ))}
                {students.length > 5 && (
                  <span className="text-xs px-2 py-0.5 bg-muted rounded">
                    +{students.length - 5} more
                  </span>
                )}
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

