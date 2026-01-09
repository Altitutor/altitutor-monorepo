'use client';

import { useState, useEffect } from 'react';
import { Checkbox } from '@altitutor/ui';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@altitutor/ui';
import { Label } from '@altitutor/ui';
import type { Tables } from '@altitutor/shared';
import { getSupabaseClient } from '@/shared/lib/supabase/client';
import type { Database } from '@altitutor/shared';
import type { SupabaseClient } from '@supabase/supabase-js';

type StaffAttendanceItem = {
  staffId: string;
  attended: boolean;
  type: 'MAIN_TUTOR' | 'SECONDARY_TUTOR' | 'TRIAL_TUTOR';
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
      const supabase = (getSupabaseClient() as SupabaseClient<Database>);
      
      // Use vtutor_session_detail view to get staff (tutors can't access sessions_staff directly)
      const { data, error } = await supabase
        .from('vtutor_session_detail')
        .select('*')
        .eq('session_id', sessionId)
        .maybeSingle();

      if (error) {
        console.error('Error fetching session staff:', error);
        setIsLoading(false);
        return;
      }

      if (!data) {
        setIsLoading(false);
        return;
      }

      // Extract staff from vtutor_session_detail (staff is an array in the view)
      const staffArray = (data.staff || []) as any[];
      
      // Transform to match expected format
      // Note: vtutor_session_detail doesn't include planned_absence, so we default to false
      const transformedStaff = staffArray.map((staffMember: any) => ({
        staff_id: staffMember.id,
        staff: {
          id: staffMember.id,
          first_name: staffMember.first_name,
          last_name: staffMember.last_name,
          role: staffMember.role,
          subjects: staffMember.subjects || [],
        },
        planned_absence: false, // Not available in tutor view, default to false
        type: staffMember.type || null,
      }));

      setSessionStaff(transformedStaff as any);

      // Initialize form data if empty
      if (staffAttendance.length === 0 && transformedStaff.length > 0) {
        const initialAttendance = transformedStaff.map((ss: any) => ({
          staffId: ss.staff_id,
          attended: true, // Default to true (planned_absence not available in tutor view)
          type:
            ss.staff_id === currentStaffId
              ? ('MAIN_TUTOR' as const)
              : (ss.type || ('SECONDARY_TUTOR' as const)),
        }));
        onUpdate(initialAttendance);
      }

      setIsLoading(false);
    };

    fetchSessionStaff();
  }, [sessionId, currentStaffId, staffAttendance.length, onUpdate]);

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
        {sessionStaff.map((ss: any) => {
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

