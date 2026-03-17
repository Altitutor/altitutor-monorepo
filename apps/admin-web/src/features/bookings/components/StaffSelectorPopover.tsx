'use client';

import { useState } from 'react';
import { SearchableSelect } from '@altitutor/ui';
import { Check } from 'lucide-react';
import { useStaffSearch } from '../hooks/useStaffSearch';
import type { Tables } from '@altitutor/shared';

interface StaffSelectorPopoverProps {
  selectedStaff: Tables<'staff'> | null;
  onSelectStaff: (staff: Tables<'staff'>) => void;
  disabled?: boolean;
}

export function StaffSelectorPopover({
  selectedStaff,
  onSelectStaff,
  disabled = false,
}: StaffSelectorPopoverProps) {
  const [searchQuery, setSearchQuery] = useState('');
  const [open, setOpen] = useState(false);

  const { data: searchResults, isLoading } = useStaffSearch(searchQuery, {
    enabled: open || searchQuery.trim().length > 0,
    limit: 100,
  });

  const staffList = searchResults?.staff ?? [];

  return (
    <SearchableSelect<Tables<'staff'>>
      items={staffList}
      value={selectedStaff}
      onValueChange={(staff) => staff && onSelectStaff(staff)}
      getItemId={(s) => s.id}
      getItemLabel={(s) => `${s.first_name} ${s.last_name}`}
      getItemValue={(s) =>
        `${s.first_name} ${s.last_name} ${s.email ?? ''}`.trim()
      }
      placeholder="Select staff member"
      searchPlaceholder="Search staff by name..."
      emptyMessage={
        searchQuery.trim()
          ? 'No staff found'
          : 'Start typing to search for staff'
      }
      disabled={disabled}
      loading={isLoading}
      contentWidth="400px"
      onSearchChange={setSearchQuery}
      open={open}
      onOpenChange={setOpen}
      renderItem={(staff, isSelected) => (
        <>
          <Check
            className={
              isSelected ? 'h-4 w-4 flex-shrink-0 opacity-100' : 'h-4 w-4 flex-shrink-0 opacity-0'
            }
          />
          <div className="flex flex-col items-start flex-1">
            <span className={isSelected ? 'font-medium' : ''}>
              {staff.first_name} {staff.last_name}
            </span>
            {staff.email && (
              <span className="text-xs text-muted-foreground">
                {staff.email}
              </span>
            )}
          </div>
        </>
      )}
    />
  );
}
