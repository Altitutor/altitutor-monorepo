'use client';

import { useMemo } from 'react';
import { ChevronDown } from 'lucide-react';
import { SearchableSelect } from '@altitutor/ui';
import { StaffCard } from '@/shared/components/StaffCard';
import { useAvailableReplacementStaff } from '../../hooks';
import type { ReplacementStaff } from '../../types/staff-absence';

interface ReplacementStaffDropdownProps {
  sessionId: string;
  subjectId?: string;
  excludeStaffIds: string[];
  onSelect: (staffId: string, staff: ReplacementStaff) => void;
  selectedStaffId?: string;
}

export function ReplacementStaffDropdown({
  sessionId,
  subjectId,
  excludeStaffIds,
  onSelect,
  selectedStaffId,
}: ReplacementStaffDropdownProps) {
  const { data: availableStaff, isLoading } = useAvailableReplacementStaff({
    sessionId,
    subjectId: subjectId || undefined,
    excludeStaffIds,
  });

  const selectedStaff = useMemo(() => {
    if (!selectedStaffId || !availableStaff) return null;
    return availableStaff.find((s) => s.id === selectedStaffId) || null;
  }, [selectedStaffId, availableStaff]);

  const hasNoAvailableStaff =
    !isLoading && availableStaff && availableStaff.length === 0;

  if (hasNoAvailableStaff) {
    return (
      <div className="w-full p-3 rounded-lg border-2 border-yellow-500 bg-yellow-50 dark:bg-yellow-950/20">
        <div className="text-sm text-yellow-700 dark:text-yellow-300 font-medium">
          No available replacement staff
        </div>
        <div className="text-xs text-yellow-600 dark:text-yellow-400 mt-1">
          All active staff are already assigned to this session or excluded
        </div>
      </div>
    );
  }

  const trigger = (
    <button
      type="button"
      className="w-full p-3 rounded-lg border-2 border-border hover:border-primary/50 hover:bg-primary/5 transition-all text-left flex items-center justify-between"
    >
      <span className="text-sm text-muted-foreground">
        {selectedStaff
          ? `${selectedStaff.first_name} ${selectedStaff.last_name}`
          : 'Select replacement staff...'}
      </span>
      <ChevronDown className="h-4 w-4 text-muted-foreground" />
    </button>
  );

  return (
    <SearchableSelect<ReplacementStaff>
      items={availableStaff ?? []}
      value={selectedStaff}
      onValueChange={(staff) => staff && onSelect(staff.id, staff)}
      getItemId={(s) => s.id}
      getItemLabel={(s) => `${s.first_name} ${s.last_name}`}
      getItemValue={(s) =>
        `${s.first_name} ${s.last_name} ${s.email ?? ''}`.toLowerCase()
      }
      placeholder="Select replacement staff..."
      searchPlaceholder="Search staff by name or email..."
      emptyMessage="No staff found matching your search"
      trigger={trigger}
      loading={isLoading}
      contentWidth="400px"
      renderItem={(staff, isSelected) => (
        <div className="w-full -mx-1 -my-0.5">
          <StaffCard
            staff={staff}
            subjects={staff.subjects}
            isSelecting
            isSelected={isSelected}
            showActions={false}
          />
        </div>
      )}
    />
  );
}
