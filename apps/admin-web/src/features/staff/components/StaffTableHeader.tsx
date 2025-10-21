'use client';

import { memo, useCallback } from 'react';
import { TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { ArrowUpDown } from 'lucide-react';
import type { Tables } from '@altitutor/shared';
import { cn } from '@/shared/utils/index';

interface StaffTableHeaderProps {
  sortField: keyof Tables<'staff'>;
  sortDirection: 'asc' | 'desc';
  onSort: (field: keyof Tables<'staff'>) => void;
}

const sortableFields: Array<{ key: keyof Tables<'staff'>; label: string }> = [
  { key: 'first_name', label: 'First Name' },
  { key: 'last_name', label: 'Last Name' },
  { key: 'email', label: 'Email' },
  { key: 'role', label: 'Role' },
  { key: 'status', label: 'Status' },
];

export const StaffTableHeader = memo(function StaffTableHeader({
  sortField,
  sortDirection,
  onSort,
}: StaffTableHeaderProps) {
  const handleSort = useCallback((field: keyof Tables<'staff'>) => {
    onSort(field);
  }, [onSort]);

  const renderSortableHeader = useCallback((field: keyof Tables<'staff'>, label: string) => (
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