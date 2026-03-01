'use client';

import { memo, useCallback } from 'react';
import { TableCell, TableRow, Button } from "@altitutor/ui";
import type { Tables } from '@altitutor/shared';
import { StaffRoleBadge, StaffStatusBadge } from '@altitutor/ui';
import { formatClassName, formatClassShortName } from '@/shared/utils';

interface StaffTableRowProps {
  staff: Tables<'staff'>;
  classes: (Tables<'classes'> & { subject?: Tables<'subjects'> })[];
  onStaffClick: (id: string) => void;
  onClassClick: (id: string) => void;
}

export const StaffTableRow = memo(function StaffTableRow({
  staff,
  classes,
  onStaffClick,
  onClassClick,
}: StaffTableRowProps) {
  const handleClick = useCallback(() => {
    onStaffClick(staff.id);
  }, [staff.id, onStaffClick]);

  return (
    <TableRow 
      className="cursor-pointer hover:bg-muted/50 transition-colors"
      onClick={handleClick}
    >
      <TableCell>
        <StaffStatusBadge value={staff.status as 'ACTIVE' | 'INACTIVE' | 'TRIAL' | null} />
      </TableCell>
      <TableCell>
        <StaffRoleBadge value={staff.role as 'ADMIN' | 'TUTOR' | 'ADMINSTAFF' | null} />
      </TableCell>
      <TableCell className="font-medium">
        {staff.first_name || '-'}
      </TableCell>
      <TableCell className="font-medium">
        {staff.last_name || '-'}
      </TableCell>
      <TableCell>
        {classes.length > 0 ? (
          <div className="flex flex-col gap-1">
            {classes
              .sort((a, b) => a.day_of_week - b.day_of_week || a.start_time.localeCompare(b.start_time))
              .map((cls) => (
                <Button
                  key={cls.id}
                  variant="link"
                  size="sm"
                  className="h-auto p-0 text-xs justify-start whitespace-nowrap"
                  onClick={(event) => {
                    event.stopPropagation();
                    onClassClick(cls.id);
                  }}
                  title={formatClassName(cls, cls.subject)}
                >
                  {/* Default to short names, only show full on 2xl+ screens */}
                  <span className="2xl:hidden">{formatClassShortName(cls, cls.subject)}</span>
                  <span className="hidden 2xl:inline">{formatClassName(cls, cls.subject)}</span>
                </Button>
              ))}
          </div>
        ) : (
          <span className="text-muted-foreground text-sm">No classes</span>
        )}
      </TableCell>
    </TableRow>
  );
}); 