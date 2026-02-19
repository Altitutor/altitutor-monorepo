'use client';

import { useEffect, useState } from 'react';
import { Checkbox } from '@altitutor/ui';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@altitutor/ui';
import { Label } from '@altitutor/ui';
import { Button } from '@altitutor/ui';
import { Input } from '@altitutor/ui';
import { Plus, Search } from 'lucide-react';
import { useTutorLogStep2Data } from '../../hooks/useTutorLogStep2Data';
import { staffApi } from '@/features/staff/api/staff';
import { sessionsApi } from '@/features/sessions/api/sessions';
import { useQueryClient } from '@tanstack/react-query';
import { sessionsKeys } from '@/features/sessions/hooks/useSessionsQuery';
import { filterAvailableStaff } from '@/shared/utils/filtering';
import type { Tables } from '@altitutor/shared';
import { StaffCard } from '@/shared/components/StaffCard';

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
  const [showAddStaff, setShowAddStaff] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
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

  const handleSearchStaff = async (search: string) => {
    setSearchTerm(search);
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
      // Filter out staff already in session
      const existingStaffIds = new Set(sessionStaff.map((ss) => ss.staff_id));
      setAvailableStaff(filterAvailableStaff(result.staff, existingStaffIds));
    } catch (error) {
      console.error('Error searching staff:', error);
    } finally {
      setIsLoadingStaff(false);
    }
  };

  const handleAddStaff = async (staffId: string) => {
    if (onAddStaffToSession) {
      await onAddStaffToSession(staffId);
    } else {
      // Fallback: use sessionsApi directly
      await sessionsApi.assignStaffToSession(sessionId, staffId);
    }
    // Invalidate session data to refetch with new staff
    queryClient.invalidateQueries({ queryKey: sessionsKeys.detail(sessionId) });
    // Initialize attendance for new staff
    handleAttendanceChange(staffId, true);
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
                    staff={staffMember}
                    showSubjects={false}
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

