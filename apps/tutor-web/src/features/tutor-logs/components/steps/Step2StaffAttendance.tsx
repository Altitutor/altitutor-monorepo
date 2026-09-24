'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { SearchableSelect } from '@altitutor/ui';
import { Button } from '@altitutor/ui';
import { Plus } from 'lucide-react';
import { useTutorLogStep2Data } from '../../hooks/useTutorLogStep2Data';
import { staffApi } from '@/features/staff/api/staff';
import { sessionsApi } from '@/features/sessions/api/sessions';
import { useQueryClient } from '@tanstack/react-query';
import { sessionsKeys } from '@/features/sessions/hooks/useSessionsQuery';
import { filterAvailableStaff } from '@/shared/utils/filtering';
import type { Tables } from '@altitutor/shared';
import {
  CHECK_IN_HOST,
  CHECK_IN_STAFF_TYPE_OPTIONS,
  CLASS_STAFF_TYPE_OPTIONS,
  defaultCheckInSessionsStaffType,
  toCheckInStaffRole,
} from '@altitutor/shared/pay-tiers';
import { cn } from '@/shared/utils';
import { tutorBtnOutline, tutorCardCn } from '@/shared/lib/tutor-visual';
import type { TutorLogFormData } from '../../types';

type StaffTypeOption =
  | (typeof CLASS_STAFF_TYPE_OPTIONS)[number]
  | (typeof CHECK_IN_STAFF_TYPE_OPTIONS)[number];

type StaffAttendanceItem = TutorLogFormData['staffAttendance'][number];

function AttendanceToggle({
  attended,
  onChange,
}: {
  attended: boolean;
  onChange: (attended: boolean) => void;
}) {
  return (
    <div className="inline-flex shrink-0 overflow-hidden rounded-md border" role="group" aria-label="Attendance">
      <button
        type="button"
        aria-pressed={attended}
        onClick={() => onChange(true)}
        className={cn(
          'px-2.5 py-1 text-sm transition-colors',
          attended
            ? 'bg-green-50 font-medium text-green-700 dark:bg-green-900/30 dark:text-green-400'
            : 'bg-background text-muted-foreground hover:bg-muted/60'
        )}
      >
        Attended
      </button>
      <button
        type="button"
        aria-pressed={!attended}
        onClick={() => onChange(false)}
        className={cn(
          'border-l px-2.5 py-1 text-sm transition-colors',
          !attended
            ? 'bg-red-50 font-medium text-red-700 dark:bg-red-900/30 dark:text-red-400'
            : 'bg-background text-muted-foreground hover:bg-muted/60'
        )}
      >
        Did not attend
      </button>
    </div>
  );
}

function isClassStaffType(
  type: string | null | undefined
): type is 'MAIN_TUTOR' | 'SECONDARY_TUTOR' | 'TRIAL_TUTOR' {
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
  const { sessionStaff, sessionType, hasStudentsOrParents, isLoading } =
    useTutorLogStep2Data(sessionId);
  const [availableStaff, setAvailableStaff] = useState<Tables<'staff'>[]>([]);
  const [isLoadingStaff, setIsLoadingStaff] = useState(false);

  const isCheckIn = sessionType === 'CHECK_IN';
  const staffTypeOptions: StaffTypeOption[] = useMemo(
    () => (isCheckIn ? [...CHECK_IN_STAFF_TYPE_OPTIONS] : [...CLASS_STAFF_TYPE_OPTIONS]),
    [isCheckIn]
  );

  const resolveInitialType = useCallback(
    (staffId: string, sessionsStaffType: string | null | undefined): StaffAttendanceItem['type'] => {
      if (isCheckIn) {
        if (sessionsStaffType) return toCheckInStaffRole(sessionsStaffType);
        if (staffId === currentStaffId) return CHECK_IN_HOST;
        return defaultCheckInSessionsStaffType(hasStudentsOrParents);
      }
      if (staffId === currentStaffId) return 'MAIN_TUTOR';
      if (isClassStaffType(sessionsStaffType)) return sessionsStaffType;
      return 'SECONDARY_TUTOR';
    },
    [currentStaffId, hasStudentsOrParents, isCheckIn]
  );

  // Initialize form data if empty when staff data loads — default to planned attendance
  useEffect(() => {
    if (!isLoading && staffAttendance.length === 0 && sessionStaff.length > 0) {
      const initialAttendance: StaffAttendanceItem[] = sessionStaff.map((ss) => ({
        staffId: ss.staff_id,
        attended: !ss.planned_absence,
        type: resolveInitialType(ss.staff_id, ss.type),
      }));
      onUpdate(initialAttendance);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isLoading, staffAttendance.length, sessionStaff.length, currentStaffId, isCheckIn]);

  const handleAttendanceChange = (staffId: string, attended: boolean) => {
    const updated = staffAttendance.map((sa) =>
      sa.staffId === staffId ? { ...sa, attended } : sa
    );

    // If we're adding attendance for a staff not yet in the list
    if (!staffAttendance.find((sa) => sa.staffId === staffId)) {
      const sessionsStaffType = sessionStaff.find((ss) => ss.staff_id === staffId)?.type;
      updated.push({
        staffId,
        attended,
        type: resolveInitialType(staffId, sessionsStaffType),
      });
    }

    onUpdate(updated);
  };

  const handleTypeChange = (staffId: string, type: StaffAttendanceItem['type']) => {
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
    const assignType = isCheckIn
      ? defaultCheckInSessionsStaffType(hasStudentsOrParents)
      : 'MAIN_TUTOR';
    if (onAddStaffToSession) {
      await onAddStaffToSession(staffId);
    } else {
      // Fallback: use sessionsApi directly
      await sessionsApi.assignStaffToSession(sessionId, staffId, assignType);
    }
    // Invalidate session data to refetch with new staff
    queryClient.invalidateQueries({ queryKey: sessionsKeys.detail(sessionId) });
    handleAttendanceChange(staffId, true);
    setAvailableStaff([]);
  };

  const addStaffTrigger = (
    <Button variant="outline" className={cn(tutorBtnOutline, 'w-full sm:w-auto')}>
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
            const type = attendance?.type ?? resolveInitialType(ss.staff_id, ss.type);
            const selectedOption =
              staffTypeOptions.find((o) => o.value === type) ?? staffTypeOptions[0];

            return (
              <div
                key={ss.staff_id}
                className={tutorCardCn('flex flex-wrap items-center gap-3 p-3')}
              >
                <div className="min-w-0 flex-1">
                  <span className="font-medium">
                    {staff.first_name} {staff.last_name}
                  </span>
                  {ss.planned_absence && (
                    <span className="ml-2 text-xs text-muted-foreground">(Planned Absence)</span>
                  )}
                </div>
                <AttendanceToggle
                  attended={isAttended}
                  onChange={(next) => handleAttendanceChange(ss.staff_id, next)}
                />
                {isAttended ? (
                  <SearchableSelect<StaffTypeOption>
                    items={staffTypeOptions}
                    value={selectedOption}
                    onValueChange={(item) =>
                      item && handleTypeChange(ss.staff_id, item.value)
                    }
                    getItemLabel={(o) => o.label}
                    getItemId={(o) => o.value}
                    triggerClassName="w-auto min-w-[10.5rem] shrink-0"
                  />
                ) : null}
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
