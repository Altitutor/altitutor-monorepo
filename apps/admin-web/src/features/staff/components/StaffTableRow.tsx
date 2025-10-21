'use client';

import { memo, useCallback } from 'react';
import { TableCell, TableRow } from "@altitutor/ui";
import type { Tables } from '@altitutor/shared';
import { StaffRoleBadge, StaffStatusBadge } from '@altitutor/ui';

interface StaffTableRowProps {
  staff: Tables<'staff'>;
  onStaffClick: (id: string) => void;
}

export const StaffTableRow = memo(function StaffTableRow({
  staff,
  onStaffClick,
}: StaffTableRowProps) {
  const handleClick = useCallback(() => {
    onStaffClick(staff.id);
  }, [staff.id, onStaffClick]);

  return (
    <TableRow 
      className="cursor-pointer hover:bg-muted/50 transition-colors"
      onClick={handleClick}
    >
      <TableCell className="font-medium">
        {staff.first_name || '-'}
      </TableCell>
      <TableCell className="font-medium">
        {staff.last_name || '-'}
      </TableCell>
      <TableCell>{staff.email || '-'}</TableCell>
      <TableCell>{staff.phone_number || '-'}</TableCell>
      <TableCell>
        <StaffRoleBadge value={staff.role as any} />
      </TableCell>
      <TableCell>
        <StaffStatusBadge value={staff.status as any} />
      </TableCell>
    </TableRow>
  );
}); 