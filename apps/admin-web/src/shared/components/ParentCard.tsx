'use client';

import type { Tables } from '@altitutor/shared';

interface ParentCardProps {
  parent: Tables<'parents'>;
  students?: Tables<'students'>[];
  onClick?: () => void;
}

export function ParentCard({
  parent,
  students = [],
  onClick
}: ParentCardProps) {
  const initials = `${parent.first_name?.[0] || ''}${parent.last_name?.[0] || ''}`.toUpperCase();

  return (
    <div
      className={`relative flex items-start gap-3 p-3 border rounded-lg transition-colors ${
        onClick
          ? 'hover:bg-muted/50 cursor-pointer'
          : 'bg-background'
      }`}
      onClick={onClick}
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
              {parent.first_name} {parent.last_name}
            </h4>
            {(parent.email || parent.phone) && (
              <div className="flex items-center gap-2 mt-1">
                {parent.email && (
                  <span className="text-xs text-muted-foreground truncate">
                    {parent.email}
                  </span>
                )}
                {parent.email && parent.phone && (
                  <span className="text-xs text-muted-foreground">•</span>
                )}
                {parent.phone && (
                  <span className="text-xs text-muted-foreground truncate">
                    {parent.phone}
                  </span>
                )}
              </div>
            )}
          </div>
        </div>
        
        {/* Students */}
        {students.length > 0 && (
          <div className="mt-2">
            <p className="text-xs font-medium text-muted-foreground mb-1">Students:</p>
            <div className="flex flex-wrap gap-1">
              {students.map((student) => (
                <span
                  key={student.id}
                  className="text-xs px-2 py-0.5 bg-muted rounded"
                >
                  {student.first_name} {student.last_name}
                </span>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

