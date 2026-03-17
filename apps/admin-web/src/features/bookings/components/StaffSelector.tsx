'use client';

import { useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { SearchableSelect } from '@altitutor/ui';
import { Loader2 } from 'lucide-react';
import { staffApi } from '@/features/staff/api/staff';

type StaffItem = { id: string; first_name: string; last_name: string; email?: string | null };

interface StaffSelectorProps {
  availableStaffIds: string[];
  selectedStaffId?: string;
  onSelect: (staffId: string) => void;
  disabled?: boolean;
}

function formatStaffName(staff: StaffItem) {
  return `${staff.first_name} ${staff.last_name}${staff.email ? ` (${staff.email})` : ''}`;
}

export function StaffSelector({
  availableStaffIds,
  selectedStaffId,
  onSelect,
  disabled = false,
}: StaffSelectorProps) {
  const { data: allStaff, isLoading } = useQuery({
    queryKey: ['staff', 'minimal'],
    queryFn: () => staffApi.listMinimal({ limit: 1000 }),
    staleTime: 5 * 60 * 1000,
  });

  const availableStaff = useMemo(() => {
    if (!allStaff?.staff) return [];
    const availableSet = new Set(availableStaffIds);
    return allStaff.staff.filter((s) => availableSet.has(s.id));
  }, [allStaff, availableStaffIds]);

  const selectedStaff = useMemo(
    () => availableStaff.find((s) => s.id === selectedStaffId) ?? null,
    [availableStaff, selectedStaffId]
  );

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-4">
        <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (availableStaff.length === 0) {
    return (
      <div className="text-center py-4 text-sm text-muted-foreground">
        No staff available for this time slot
      </div>
    );
  }

  return (
    <div className="space-y-2">
      <SearchableSelect<StaffItem>
        items={availableStaff}
        value={selectedStaff}
        onValueChange={(item) => item && onSelect(item.id)}
        getItemLabel={formatStaffName}
        getItemId={(s) => s.id}
        placeholder={
          availableStaff.length === 1 ? 'Only one staff available' : 'Select staff member'
        }
        disabled={disabled || availableStaff.length === 0}
      />
      {availableStaff.length === 1 && !selectedStaffId && (
        <p className="text-xs text-muted-foreground">
          Only one staff member available - will be auto-selected
        </p>
      )}
    </div>
  );
}
