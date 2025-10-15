'use client';

import { memo, useCallback } from 'react';
import { TableCell, TableRow } from "@/components/ui/table";
import { Staff } from '@/shared/lib/supabase/database/types';
import { StaffRoleBadge, StaffStatusBadge } from '@/components/ui/enum-badge';

interface StaffTableRowProps {
  staff: Staff;
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
        {staff.firstName || '-'}
      </TableCell>
      <TableCell className="font-medium">
        {staff.lastName || '-'}
      </TableCell>
      <TableCell>{staff.email || '-'}</TableCell>
      <TableCell>{staff.phoneNumber || '-'}</TableCell>
      <TableCell>
        <StaffRoleBadge value={staff.role} />
      </TableCell>
      <TableCell>
        <StaffStatusBadge value={staff.status} />
      </TableCell>
    </TableRow>
  );
}); 