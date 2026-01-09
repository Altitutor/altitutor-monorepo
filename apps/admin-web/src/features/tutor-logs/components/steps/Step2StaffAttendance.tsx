'use client';

import { useState, useEffect } from 'react';
import { Checkbox } from '@altitutor/ui';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@altitutor/ui';
import { Button } from '@altitutor/ui';
import { Input } from '@altitutor/ui';
import { Plus, Search, X } from 'lucide-react';
import { StaffCard } from '@/shared/components/StaffCard';
import { staffApi, type StaffListItem } from '@/features/staff/api/staff';
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
  onAddStaffToSession?: (staffId: string) => Promise<void>;
};

export function Step2StaffAttendance({
  sessionId,
  currentStaffId,
  staffAttendance,
  onUpdate,
  onAddStaffToSession,
}: Step2StaffAttendanceProps) {
  const [sessionStaff, setSessionStaff] = useState<
    Array<Tables<'sessions_staff'> & { staff: Tables<'staff'> }>
  >([]);
  const [isLoading, setIsLoading] = useState(true);
  const [showAddStaff, setShowAddStaff] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [availableStaff, setAvailableStaff] = useState<StaffListItem[]>([]);
  const [isLoadingStaff, setIsLoadingStaff] = useState(false);

  useEffect(() => {
    const fetchSessionStaff = async () => {
      const supabase = (getSupabaseClient() as SupabaseClient<Database>);
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

  const handleSearchStaff = async (search: string) => {
    setSearchTerm(search);
    if (!search.trim()) {
      setAvailableStaff([]);
      return;
    }

    setIsLoadingStaff(true);
    try {
      const result = await staffApi.listMinimal({
        search,
        limit: 20,
        offset: 0,
        orderBy: 'first_name',
        ascending: true,
      });
      // Filter out staff already in session
      const existingStaffIds = new Set(sessionStaff.map((ss: any) => ss.staff_id));
      setAvailableStaff(result.staff.filter((s) => !existingStaffIds.has(s.id)));
    } catch (error) {
      console.error('Error searching staff:', error);
    } finally {
      setIsLoadingStaff(false);
    }
  };

  const handleAddStaff = async (staffId: string) => {
    if (onAddStaffToSession) {
      await onAddStaffToSession(staffId);
      // Refresh session staff
      const supabase = getSupabaseClient() as SupabaseClient<Database>;
      const { data } = await supabase
        .from('sessions_staff')
        .select('*, staff:staff!sessions_staff_staff_id_fkey(*)')
        .eq('session_id', sessionId);
      if (data) {
        setSessionStaff(data as any);
        // Initialize attendance for new staff
        const newStaff = data.find((ss: any) => ss.staff_id === staffId);
        if (newStaff) {
          handleAttendanceChange(staffId, true);
        }
      }
    }
    setShowAddStaff(false);
    setSearchTerm('');
    setAvailableStaff([]);
  };

  if (isLoading) {
    return <div className="text-center py-8 text-muted-foreground">Loading...</div>;
  }

  return (
    <div className="space-y-4">
      <p className="text-sm text-muted-foreground">
        Select which staff members attended this session.
      </p>
      
      {sessionStaff.length === 0 ? (
        <div className="text-center py-8 text-muted-foreground">
          No staff assigned to this session.
        </div>
      ) : (
        <div className="space-y-3">
          {sessionStaff.map((ss: any) => {
            const staff = ss.staff;
            const attendance = getStaffAttendance(ss.staff_id);
            const isAttended = attendance?.attended ?? !ss.planned_absence;
            const type = attendance?.type ?? (ss.staff_id === currentStaffId ? 'MAIN_TUTOR' : (ss.type || 'SECONDARY_TUTOR'));

            return (
              <div key={ss.staff_id} className="flex items-center gap-3">
                <Checkbox
                  id={`staff-${ss.staff_id}`}
                  checked={isAttended}
                  onCheckedChange={(checked) =>
                    handleAttendanceChange(ss.staff_id, checked === true)
                  }
                />
                <div className="flex-1">
                  <StaffCard
                    staff={staff}
                    showSubjects={false}
                    showActions={false}
                  />
                </div>
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
      )}

      {!showAddStaff && (
        <Button variant="outline" onClick={() => setShowAddStaff(true)}>
          <Plus className="h-4 w-4 mr-2" />
          Add Staff
        </Button>
      )}

      {showAddStaff && (
        <div className="space-y-2 border rounded-md p-4 bg-muted/30">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search staff by name..."
              value={searchTerm}
              onChange={(e) => handleSearchStaff(e.target.value)}
              className="pl-10"
              autoFocus
            />
          </div>
          
          {isLoadingStaff ? (
            <div className="text-center py-4 text-muted-foreground text-sm">Searching...</div>
          ) : availableStaff.length > 0 ? (
            <div className="max-h-60 overflow-y-auto space-y-2">
              {availableStaff.map((staffMember) => (
                <div
                  key={staffMember.id}
                  onClick={() => handleAddStaff(staffMember.id)}
                  className="cursor-pointer"
                >
                  <StaffCard
                    staff={staffMember as Tables<'staff'>}
                    showSubjects={false}
                    showActions={false}
                  />
                </div>
              ))}
            </div>
          ) : searchTerm ? (
            <div className="text-center py-4 text-muted-foreground text-sm">
              No staff found
            </div>
          ) : null}

          <Button variant="outline" size="sm" onClick={() => {
            setShowAddStaff(false);
            setSearchTerm('');
            setAvailableStaff([]);
          }}>
            Cancel
          </Button>
        </div>
      )}
    </div>
  );
}

