'use client';

import { Badge } from '@altitutor/ui';
import type { Tables } from '@altitutor/shared';
import { formatSubjectShortName, getSubjectColorStyle } from '@/shared/utils';

interface StaffCardProps {
  staff: {
    id: string;
    first_name: string | null;
    last_name: string | null;
    role: string | null;
  };
  subjects?: Tables<'subjects'>[];
  onClick?: () => void;
  
  // Visual states
  isSelecting?: boolean;
  isSelected?: boolean;
  showSubjects?: boolean;
}

export function StaffCard({
  staff,
  subjects = [],
  onClick,
  isSelecting = false,
  isSelected = false,
  showSubjects = true
}: StaffCardProps) {
  const initials = `${staff.first_name?.[0] || ''}${staff.last_name?.[0] || ''}`.toUpperCase();
  const roleDisplay = staff.role === 'TUTOR' ? 'Tutor' : staff.role === 'ADMINSTAFF' ? 'Admin Staff' : staff.role || '';

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
              {staff.first_name} {staff.last_name}
            </h4>
            <div className="flex items-center gap-2 mt-1">
              <span className="text-xs text-muted-foreground">
                {roleDisplay}
              </span>
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

