'use client';

import { MoreVertical } from 'lucide-react';
import { Badge } from '@altitutor/ui';
import { Button } from '@altitutor/ui';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@altitutor/ui';
import type { Tables } from '@altitutor/shared';
import { SUBJECT_DISCIPLINE_COLORS } from '@altitutor/ui';
import { formatSubjectShortName } from '@/shared/utils';

interface StaffCardProps {
  staff: Tables<'staff'>;
  subjects?: Tables<'subjects'>[];
  onClick?: () => void;
  
  // Optional actions
  onRemoveStaff?: () => void;
  onViewStaff?: () => void;
  
  // Visual states
  isSelecting?: boolean;
  isSelected?: boolean;
}

export function StaffCard({
  staff,
  subjects = [],
  onClick,
  onRemoveStaff,
  onViewStaff,
  isSelecting = false,
  isSelected = false
}: StaffCardProps) {
  const hasMenuActions = onRemoveStaff || onViewStaff;
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
                {onViewStaff && (
                  <DropdownMenuItem onClick={(e) => {
                    e.stopPropagation();
                    onViewStaff();
                  }}>
                    View Staff
                  </DropdownMenuItem>
                )}
                {onRemoveStaff && (
                  <DropdownMenuItem onClick={(e) => {
                    e.stopPropagation();
                    onRemoveStaff();
                  }}>
                    Remove Staff
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

