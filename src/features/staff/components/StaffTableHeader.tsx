'use client';

import { memo, useCallback } from 'react';
import { TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { ArrowUpDown } from 'lucide-react';
import { Staff } from '@/shared/lib/supabase/db/types';
import { cn } from '@/shared/utils/index';

interface StaffTableHeaderProps {
  sortField: keyof Staff;
  sortDirection: 'asc' | 'desc';
  onSort: (field: keyof Staff) => void;
}

const sortableFields: Array<{ key: keyof Staff; label: string }> = [
  { key: 'firstName', label: 'First Name' },
  { key: 'lastName', label: 'Last Name' },
  { key: 'email', label: 'Email' },
  { key: 'role', label: 'Role' },
  { key: 'status', label: 'Status' },
];

export const StaffTableHeader = memo(function StaffTableHeader({
  sortField,
  sortDirection,
  onSort,
}: StaffTableHeaderProps) {
  const handleSort = useCallback((field: keyof Staff) => {
    onSort(field);
  }, [onSort]);

  const renderSortableHeader = useCallback((field: keyof Staff, label: string) => (
    <TableHead 
      key={field}
      className="cursor-pointer select-none hover:bg-muted/50 transition-colors" 
      onClick={() => handleSort(field)}
    >
      <div className="flex items-center">
        {label}
        <ArrowUpDown className={cn(
          "ml-2 h-4 w-4",
          sortField === field ? "opacity-100" : "opacity-40"
        )} />
      </div>
    </TableHead>
  ), [sortField, handleSort]);

  return (
    <TableHeader>
      <TableRow>
        {sortableFields.map(({ key, label }) => renderSortableHeader(key, label))}
        <TableHead>Phone</TableHead>
      </TableRow>
    </TableHeader>
  );
}); 