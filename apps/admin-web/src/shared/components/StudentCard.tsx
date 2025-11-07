'use client';

import { User, Calendar, Clock, MoreVertical } from 'lucide-react';
import { Badge } from '@altitutor/ui';
import { Button } from '@altitutor/ui';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@altitutor/ui';
import type { Tables } from '@altitutor/shared';
import type { ClassEnrollmentWithAudit } from '@altitutor/shared';
import { SUBJECT_DISCIPLINE_COLORS } from '@altitutor/ui';
import { formatDate } from '@/shared/utils/datetime';

interface StudentCardProps {
  student: Tables<'students'>;
  subjects?: Tables<'subjects'>[];
  onClick?: () => void;
  
  // Optional enrollment context (when displayed in a class context)
  enrollment?: ClassEnrollmentWithAudit;
  onChangeClass?: () => void;
  onUnenroll?: () => void;
  
  // Visual states
  isSelecting?: boolean;
  isSelected?: boolean;
}

export function StudentCard({
  student,
  subjects = [],
  onClick,
  enrollment,
  onChangeClass,
  onUnenroll,
  isSelecting = false,
  isSelected = false
}: StudentCardProps) {
  const isFutureEnrollment = enrollment?.enrolled_at && new Date(enrollment.enrolled_at) > new Date();
  const hasEnrollmentContext = enrollment && (onChangeClass || onUnenroll);

  return (
    <div
      className={`relative flex items-start gap-3 p-3 border rounded-lg transition-colors ${
        isSelecting
          ? isSelected
            ? 'border-primary bg-primary/5'
            : 'hover:bg-muted/50 cursor-pointer'
          : onClick
          ? 'hover:bg-muted/50 cursor-pointer'
          : 'bg-background'
      }`}
      onClick={isSelecting || onClick ? onClick : undefined}
    >
      <div className="flex-shrink-0">
        <div className="h-10 w-10 rounded-full bg-muted flex items-center justify-center">
          <User className="h-5 w-5 text-muted-foreground" />
        </div>
      </div>
      
      <div className="flex-1 min-w-0">
        <div className="flex items-start justify-between gap-2">
          <div className="flex-1 min-w-0">
            <h4 className="font-semibold text-sm">
              {student.first_name} {student.last_name}
            </h4>
            <div className="flex items-center gap-2 mt-1">
              <span className="text-xs text-muted-foreground">
                Year {student.year_level}
              </span>
              {student.school && (
                <>
                  <span className="text-xs text-muted-foreground">•</span>
                  <span className="text-xs text-muted-foreground truncate">
                    {student.school}
                  </span>
                </>
              )}
            </div>
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
        
        {/* Subjects */}
        {subjects.length > 0 && (
          <div className="flex flex-wrap gap-1 mt-2">
            {subjects.map((subject) => {
              const colorClass = subject.discipline 
                ? SUBJECT_DISCIPLINE_COLORS[subject.discipline as keyof typeof SUBJECT_DISCIPLINE_COLORS] 
                : 'bg-gray-100 text-gray-800';
              
              return (
                <Badge
                  key={subject.id}
                  variant="secondary"
                  className={`text-xs px-2 py-0.5 ${colorClass}`}
                >
                  {subject.name}
                </Badge>
              );
            })}
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
  );
}

