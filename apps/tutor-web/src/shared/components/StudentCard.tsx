'use client';

import { Badge } from '@altitutor/ui';
import type { Tables } from '@altitutor/shared';
import { formatSubjectShortName, getSubjectColorStyle } from '@/shared/utils';

interface StudentCardProps {
  student: {
    id: string;
    first_name: string | null;
    last_name: string | null;
    year_level: number | null;
    school: string | null;
    curriculum?: string | null;
  };
  subjects?: Tables<'subjects'>[];
  onClick?: () => void;
  
  // Visual states
  isSelecting?: boolean;
  isSelected?: boolean;
  showSubjects?: boolean;
}

export function StudentCard({
  student,
  subjects = [],
  onClick,
  isSelecting = false,
  isSelected = false,
  showSubjects = true
}: StudentCardProps) {
  const initials = `${student.first_name?.[0] || ''}${student.last_name?.[0] || ''}`.toUpperCase();

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
        <div className="h-10 w-10 rounded-full bg-muted flex items-center justify-center text-sm font-medium text-muted-foreground">
          {initials}
        </div>
      </div>
      
      <div className="flex-1 min-w-0">
        <div className="flex items-start justify-between gap-2">
          <div className="flex-1 min-w-0">
            <h4 className="font-semibold text-sm">
              {student.first_name} {student.last_name}
            </h4>
            <div className="flex items-center gap-2 mt-1">
              {student.year_level && (
                <span className="text-xs text-muted-foreground">
                  Year {student.year_level}
                </span>
              )}
              {student.school && (
                <>
                  {student.year_level && <span className="text-xs text-muted-foreground">•</span>}
                  <span className="text-xs text-muted-foreground truncate">
                    {student.school}
                  </span>
                </>
              )}
            </div>
          </div>
        </div>
        
        {/* Subjects */}
        {showSubjects && subjects.length > 0 && (
          <div className="flex flex-wrap gap-1 mt-2">
            {subjects.map((subject) => {
              const { style, textColorClass } = getSubjectColorStyle(subject);
              const defaultClass = !subject.color ? 'bg-gray-100 text-gray-800' : '';
              
              return (
                <Badge
                  key={subject.id}
                  variant="secondary"
                  className={defaultClass || `text-xs px-2 py-0.5 ${textColorClass}`}
                  style={style.backgroundColor ? style : undefined}
                >
                  {formatSubjectShortName(subject)}
                </Badge>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}

