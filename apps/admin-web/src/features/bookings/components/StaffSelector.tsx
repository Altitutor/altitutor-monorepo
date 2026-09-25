'use client';

import { useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { SearchableSelect } from '@altitutor/ui';
import { Check, Loader2 } from 'lucide-react';
import { staffApi } from '@/features/staff/api/staff';
import { cn } from '@/shared/utils';

type StaffItem = { id: string; first_name: string; last_name: string; email?: string | null };

interface StaffSelectorProps {
  availableStaffIds: string[];
  selectedStaffId?: string;
  onSelect: (staffId: string) => void;
  disabled?: boolean;
}

export const UNAVAILABLE_STAFF_WARNING =
  'This staff member is not available at the selected time. You can still book them.';

function formatStaffName(staff: StaffItem) {
  return `${staff.first_name} ${staff.last_name}${staff.email ? ` (${staff.email})` : ''}`;
}

function matchesSearch(staff: StaffItem, query: string) {
  return formatStaffName(staff).toLowerCase().includes(query);
}

export function StaffSelector({
  availableStaffIds,
  selectedStaffId,
  onSelect,
  disabled = false,
}: StaffSelectorProps) {
  const [search, setSearch] = useState('');
  const { data: allStaff, isLoading } = useQuery({
    queryKey: ['staff', 'minimal'],
    queryFn: () => staffApi.listMinimal({ limit: 1000 }),
    staleTime: 5 * 60 * 1000,
  });

  const availableSet = useMemo(() => new Set(availableStaffIds), [availableStaffIds]);

  const visibleStaff = useMemo(() => {
    const staff = allStaff?.staff ?? [];
    const query = search.trim().toLowerCase();
    if (!query) return staff.filter((member) => availableSet.has(member.id));
    return staff.filter((member) => matchesSearch(member, query));
  }, [allStaff, availableSet, search]);

  const selectedStaff = useMemo(
    () => allStaff?.staff.find((member) => member.id === selectedStaffId) ?? null,
    [allStaff, selectedStaffId]
  );

  const selectedIsUnavailable = !!selectedStaff && !availableSet.has(selectedStaff.id);
  const query = search.trim();

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-4">
        <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="space-y-2">
      <SearchableSelect<StaffItem>
        items={visibleStaff}
        value={selectedStaff}
        onValueChange={(item) => item && onSelect(item.id)}
        onSearchChange={setSearch}
        getItemLabel={formatStaffName}
        getItemId={(member) => member.id}
        placeholder="Select staff member"
        searchPlaceholder="Search all staff..."
        emptyMessage={
          query
            ? 'No staff found'
            : 'No staff available for this time. Search to assign someone else.'
        }
        disabled={disabled}
        renderItem={(item, isSelected) => {
          const unavailable = !availableSet.has(item.id);
          return (
            <>
              <Check className={cn('h-4 w-4 flex-shrink-0', isSelected ? 'opacity-100' : 'opacity-0')} />
              <span className={cn('min-w-0 truncate', isSelected && 'font-medium')}>
                {formatStaffName(item)}
              </span>
              {unavailable && (
                <span className="ml-auto shrink-0 text-xs text-amber-700 dark:text-amber-300">
                  Unavailable
                </span>
              )}
            </>
          );
        }}
      />
      {!query && availableSet.size === 1 && !selectedStaffId && (
        <p className="text-xs text-muted-foreground">
          Only one staff member available - will be auto-selected
        </p>
      )}
      {selectedIsUnavailable && (
        <p
          role="status"
          className="rounded-md border border-amber-300 bg-amber-50 px-3 py-2 text-sm text-amber-950 dark:border-amber-800 dark:bg-amber-950/40 dark:text-amber-100"
        >
          {UNAVAILABLE_STAFF_WARNING}
        </p>
      )}
    </div>
  );
}
