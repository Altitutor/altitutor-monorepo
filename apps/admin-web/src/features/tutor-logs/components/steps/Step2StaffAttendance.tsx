'use client';

import { useState, useEffect } from 'react';
import { Checkbox } from '@altitutor/ui';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@altitutor/ui';
import { Label } from '@altitutor/ui';
import type { Tables } from '@altitutor/shared';
import { getSupabaseClient } from '@/shared/lib/supabase/client';

type StaffAttendanceItem = {
  staffId: string;
  attended: boolean;
  type: 'PRIMARY' | 'ASSISTANT' | 'TRIAL';
};

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
  const [sessionStaff, setSessionStaff] = useState<
    Array<Tables<'sessions_staff'> & { staff: Tables<'staff'> }>
  >([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const fetchSessionStaff = async () => {
      const supabase = getSupabaseClient();
      const { data, error } = await supabase
        .from('sessions_staff')
        .select('*, staff:staff!sessions_staff_staff_id_fkey(*)')
        .eq('session_id', sessionId);

      if (error) {
        console.error('Error fetching session staff:', error);
        return;
      }

      setSessionStaff(data as any);

      // Initialize form data if empty
      if (staffAttendance.length === 0 && data) {
        const initialAttendance = data.map((ss: any) => ({
          staffId: ss.staff_id,
          attended: !ss.planned_absence, // Default to true unless planned absence
          type:
            ss.staff_id === currentStaffId
              ? ('PRIMARY' as const)
              : ('ASSISTANT' as const),
        }));
        onUpdate(initialAttendance);
      }

      setIsLoading(false);
    };

    fetchSessionStaff();
  }, [sessionId]);

  const handleAttendanceChange = (staffId: string, attended: boolean) => {
    const updated = staffAttendance.map((sa) =>
      sa.staffId === staffId ? { ...sa, attended } : sa
    );

    // If we're adding attendance for a staff not yet in the list
    if (!staffAttendance.find((sa) => sa.staffId === staffId)) {
      updated.push({
        staffId,
        attended,
        type: staffId === currentStaffId ? 'PRIMARY' : 'ASSISTANT',
      });
    }

    onUpdate(updated);
  };

  const handleTypeChange = (staffId: string, type: 'PRIMARY' | 'ASSISTANT' | 'TRIAL') => {
    // Only one PRIMARY allowed
    const updated = staffAttendance.map((sa) => {
      if (sa.staffId === staffId) {
        return { ...sa, type };
      }
      // If setting this to PRIMARY, change other PRIMARY to ASSISTANT
      if (type === 'PRIMARY' && sa.type === 'PRIMARY') {
        return { ...sa, type: 'ASSISTANT' as const };
      }
      return sa;
    });

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
        Select which staff members attended this session. Only one PRIMARY tutor is allowed.
      </p>
      <div className="space-y-3">
        {sessionStaff.map((ss: any) => {
          const staff = ss.staff;
          const attendance = getStaffAttendance(ss.staff_id);
          const isAttended = attendance?.attended ?? !ss.planned_absence;
          const type = attendance?.type ?? (ss.staff_id === currentStaffId ? 'PRIMARY' : 'ASSISTANT');

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
                    handleTypeChange(ss.staff_id, value as 'PRIMARY' | 'ASSISTANT' | 'TRIAL')
                  }
                >
                  <SelectTrigger className="w-32">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="PRIMARY">Primary</SelectItem>
                    <SelectItem value="ASSISTANT">Assistant</SelectItem>
                    <SelectItem value="TRIAL">Trial</SelectItem>
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

