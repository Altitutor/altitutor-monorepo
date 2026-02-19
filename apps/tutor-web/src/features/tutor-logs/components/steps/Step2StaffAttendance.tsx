'use client';

import { useEffect } from 'react';
import { Checkbox } from '@altitutor/ui';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@altitutor/ui';
import { Label } from '@altitutor/ui';
import { useTutorLogStep2Data } from '../../hooks/useTutorLogStep2Data';

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
};

export function Step2StaffAttendance({
  sessionId,
  currentStaffId,
  staffAttendance,
  onUpdate,
}: Step2StaffAttendanceProps) {
  const { sessionStaff, isLoading } = useTutorLogStep2Data(sessionId);

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

  if (isLoading) {
    return <div className="text-center py-8 text-muted-foreground">Loading...</div>;
  }

  if (sessionStaff.length === 0) {
    return (
      <div className="text-center py-8 text-muted-foreground">
        No staff assigned to this session.
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <p className="text-sm text-muted-foreground">
        Select which staff members attended this session.
      </p>
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
                <Select
                  value={type}
                    onValueChange={(value) =>
                      handleTypeChange(ss.staff_id, value as 'MAIN_TUTOR' | 'SECONDARY_TUTOR' | 'TRIAL_TUTOR')
                    }
                  >
                    <SelectTrigger className="w-32">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="MAIN_TUTOR">Main Tutor</SelectItem>
                      <SelectItem value="SECONDARY_TUTOR">Secondary Tutor</SelectItem>
                      <SelectItem value="TRIAL_TUTOR">Trial Tutor</SelectItem>
                    </SelectContent>
                  </Select>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

