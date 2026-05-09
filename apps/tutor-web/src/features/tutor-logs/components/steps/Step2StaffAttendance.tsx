'use client';

import { useCallback, useEffect, useState } from 'react';
import { Checkbox } from '@altitutor/ui';
import { SearchableSelect } from '@altitutor/ui';
import { Label } from '@altitutor/ui';
import { Button } from '@altitutor/ui';
import { Plus } from 'lucide-react';
import { useTutorLogStep2Data } from '../../hooks/useTutorLogStep2Data';
import { staffApi } from '@/features/staff/api/staff';
import { sessionsApi } from '@/features/sessions/api/sessions';
import { useQueryClient } from '@tanstack/react-query';
import { sessionsKeys } from '@/features/sessions/hooks/useSessionsQuery';
import { filterAvailableStaff } from '@/shared/utils/filtering';
import type { Tables } from '@altitutor/shared';

const STAFF_TYPE_OPTIONS = [
  { value: 'MAIN_TUTOR' as const, label: 'Main Tutor' },
  { value: 'SECONDARY_TUTOR' as const, label: 'Secondary Tutor' },
  { value: 'TRIAL_TUTOR' as const, label: 'Trial Tutor' },
] as const;
type StaffTypeOption = (typeof STAFF_TYPE_OPTIONS)[number];

type StaffAttendanceItem = {
  staffId: string;
  attended: boolean;
  type: 'MAIN_TUTOR' | 'SECONDARY_TUTOR' | 'TRIAL_TUTOR';
};

function isValidStaffType(type: string | null | undefined): type is 'MAIN_TUTOR' | 'SECONDARY_TUTOR' | 'TRIAL_TUTOR' {
  return type === 'MAIN_TUTOR' || type === 'SECONDARY_TUTOR' || type === 'TRIAL_TUTOR';
}

type Step2StaffAttendanceProps = {
  sessionId: string;
  currentStaffId: string;
  staffAttendance: StaffAttendanceItem[];
  onUpdate: (staffAttendance: StaffAttendanceItem[]) => void;
  onAddStaffToSession?: (staffId: string) => Promise<void>;
};

export function Step2StaffAttendance({
  sessionId,
  currentStaffId,
  staffAttendance,
  onUpdate,
  onAddStaffToSession,
}: Step2StaffAttendanceProps) {
  const queryClient = useQueryClient();
  const { sessionStaff, isLoading } = useTutorLogStep2Data(sessionId);
  const [availableStaff, setAvailableStaff] = useState<Tables<'staff'>[]>([]);
  const [isLoadingStaff, setIsLoadingStaff] = useState(false);

  // Initialize form data if empty when staff data loads
  useEffect(() => {
    if (!isLoading && staffAttendance.length === 0 && sessionStaff.length > 0) {
      const initialAttendance: StaffAttendanceItem[] = sessionStaff.map((ss) => {
        let type: 'MAIN_TUTOR' | 'SECONDARY_TUTOR' | 'TRIAL_TUTOR';
        if (ss.staff_id === currentStaffId) {
          type = 'MAIN_TUTOR';
        } else if (isValidStaffType(ss.type)) {
          type = ss.type;
        } else {
          type = 'SECONDARY_TUTOR';
        }
        return {
          staffId: ss.staff_id,
          attended: true, // Default to true (planned_absence not available in tutor view)
          type,
        };
      });
      onUpdate(initialAttendance);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isLoading, staffAttendance.length, sessionStaff.length, currentStaffId]);

  const handleAttendanceChange = (staffId: string, attended: boolean) => {
    const updated = staffAttendance.map((sa) =>
      sa.staffId === staffId ? { ...sa, attended } : sa
    );

    // If we're adding attendance for a staff not yet in the list
    if (!staffAttendance.find((sa) => sa.staffId === staffId)) {
      updated.push({
        staffId,
        attended,
        type: staffId === currentStaffId ? 'MAIN_TUTOR' : 'SECONDARY_TUTOR',
      });
    }

    onUpdate(updated);
  };

  const handleTypeChange = (staffId: string, type: 'MAIN_TUTOR' | 'SECONDARY_TUTOR' | 'TRIAL_TUTOR') => {
    const updated = staffAttendance.map((sa) =>
      sa.staffId === staffId ? { ...sa, type } : sa
    );

    onUpdate(updated);
  };

  const getStaffAttendance = (staffId: string) => {
    return staffAttendance.find((sa) => sa.staffId === staffId);
  };

  const handleSearchStaff = useCallback(async (search: string) => {
    if (!search.trim()) {
      setAvailableStaff([]);
      return;
    }

    setIsLoadingStaff(true);
    try {
      const result = await staffApi.search({
        search,
        limit: 20,
      });
      const existingStaffIds = new Set(sessionStaff.map((ss) => ss.staff_id));
      setAvailableStaff(filterAvailableStaff(result.staff, existingStaffIds));
    } catch (error) {
      console.error('Error searching staff:', error);
    } finally {
      setIsLoadingStaff(false);
    }
  }, [sessionStaff]);

  const handleAddStaff = async (staffId: string) => {
    if (onAddStaffToSession) {
      await onAddStaffToSession(staffId);
    } else {
      // Fallback: use sessionsApi directly
      await sessionsApi.assignStaffToSession(sessionId, staffId);
    }
    // Invalidate session data to refetch with new staff
    queryClient.invalidateQueries({ queryKey: sessionsKeys.detail(sessionId) });
    handleAttendanceChange(staffId, true);
    setAvailableStaff([]);
  };

  const addStaffTrigger = (
    <Button variant="outline" className="w-full sm:w-auto">
      <Plus className="h-4 w-4 mr-2" />
      Add Staff
    </Button>
  );

  if (isLoading) {
    return <div className="text-center py-8 text-muted-foreground">Loading...</div>;
  }

  return (
    <div className="space-y-4">
      
      {sessionStaff.length === 0 ? (
        <div className="text-center py-8 text-muted-foreground">
          No staff assigned to this session.
        </div>
      ) : (
        <div className="space-y-3">
          {sessionStaff.map((ss) => {
            const staff = ss.staff;
            const attendance = getStaffAttendance(ss.staff_id);
            const isAttended = attendance?.attended ?? !ss.planned_absence;
            const type = attendance?.type ?? (ss.staff_id === currentStaffId ? 'MAIN_TUTOR' : (ss.type || 'SECONDARY_TUTOR'));

            return (
              <div
                key={ss.staff_id}
                className="flex items-center gap-4 p-3 border rounded-md"
              >
                <Checkbox
                  id={`staff-${ss.staff_id}`}
                  checked={isAttended}
                  onCheckedChange={(checked) =>
                    handleAttendanceChange(ss.staff_id, checked === true)
                  }
                />
                <Label htmlFor={`staff-${ss.staff_id}`} className="flex-1 cursor-pointer">
                  {staff.first_name} {staff.last_name}
                  {ss.planned_absence && (
                    <span className="ml-2 text-xs text-muted-foreground">(Planned Absence)</span>
                  )}
                </Label>
                {isAttended && (
                  <SearchableSelect<StaffTypeOption>
                    items={[...STAFF_TYPE_OPTIONS]}
                    value={STAFF_TYPE_OPTIONS.find((o) => o.value === type) ?? STAFF_TYPE_OPTIONS[0]}
                    onValueChange={(item) =>
                      item && handleTypeChange(ss.staff_id, item.value)
                    }
                    getItemLabel={(o) => o.label}
                    getItemId={(o) => o.value}
                    triggerClassName="w-32"
                  />
                )}
              </div>
            );
          })}
        </div>
      )}

      <div className="mt-6">
        <SearchableSelect<Tables<'staff'>>
          items={availableStaff}
          value={null}
          onValueChange={(staffMember) => {
            if (staffMember) void handleAddStaff(staffMember.id);
          }}
          getItemId={(s) => s.id}
          getItemLabel={(s) =>
            `${s.first_name ?? ''} ${s.last_name ?? ''}`.trim() || 'Staff'
          }
          getItemValue={(s) =>
            `${s.first_name ?? ''} ${s.last_name ?? ''} ${s.email ?? ''}`.toLowerCase()
          }
          onSearchChange={handleSearchStaff}
          loading={isLoadingStaff}
          searchPlaceholder="Search staff by name..."
          emptyMessage="Type to search staff. Results exclude people already on this session."
          trigger={addStaffTrigger}
          align="start"
          contentWidth="min(380px, 92vw)"
        />
      </div>
    </div>
  );
}

