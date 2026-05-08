'use client';

import { useState, useEffect, useMemo } from 'react';
import { Checkbox, SearchableSelect } from '@altitutor/ui';
import { Button } from '@altitutor/ui';
import { Input } from '@altitutor/ui';
import { Plus, Search } from 'lucide-react';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@altitutor/ui';
import { MeetingEntitySearchAdd } from '@/features/sessions/components/MeetingEntitySearchAdd';
import { AttendanceCell } from '@/features/sessions/components/AttendanceCell';
import { staffApi, type StaffListItem } from '@/features/staff/api/staff';
import { useSessionForLogging } from '../../hooks';
import { useQueryClient } from '@tanstack/react-query';
import { sessionsKeys } from '@/features/sessions/hooks/useSessionsQuery';
import { filterAvailableStaff } from '@/shared/utils/filtering';
import { processSessionStaff } from '@/features/sessions/utils/sessionDataProcessing';
import { buildStaffSessionItemsForTutorLog } from '../../utils/logSessionAttendanceRows';

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

type Step2StaffAttendanceProps = {
  title?: string;
  sessionId: string;
  currentStaffId: string;
  staffAttendance: StaffAttendanceItem[];
  onUpdate: (staffAttendance: StaffAttendanceItem[]) => void;
  onAddStaffToSession?: (staffId: string) => Promise<void>;
  /** Use SearchableSelect-based add (meeting log flow). Default: legacy search input + cards. */
  addStaffVariant?: 'legacy' | 'search';
};

export function Step2StaffAttendance({
  title,
  sessionId,
  currentStaffId,
  staffAttendance,
  onUpdate,
  onAddStaffToSession,
  addStaffVariant = 'legacy',
}: Step2StaffAttendanceProps) {
  const queryClient = useQueryClient();
  const { data: sessionData, isLoading } = useSessionForLogging(sessionId);
  const [showAddStaff, setShowAddStaff] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [availableStaff, setAvailableStaff] = useState<StaffListItem[]>([]);
  const [isLoadingStaff, setIsLoadingStaff] = useState(false);

  const allowAbsenceLogging = Boolean(
    sessionData?.session?.class_id || sessionData?.session?.admin_shift_id
  );

  const staffSessionItems = useMemo(
    () => (sessionData?.staff?.length ? buildStaffSessionItemsForTutorLog(sessionData.staff) : []),
    [sessionData?.staff]
  );

  const actualStaffMap = useMemo(() => {
    const m: Record<string, { attended: boolean; type?: string }> = {};
    for (const a of staffAttendance) {
      m[a.staffId] = { attended: a.attended, type: a.type };
    }
    return m;
  }, [staffAttendance]);

  const staffProcessed = useMemo(
    () => processSessionStaff(staffSessionItems, actualStaffMap, true, undefined),
    [staffSessionItems, actualStaffMap]
  );

  // Initialize form data if empty
  useEffect(() => {
    if (staffAttendance.length === 0 && staffProcessed.length > 0) {
      const initialAttendance = staffProcessed.map((row) => ({
        staffId: row.staff.id,
        attended: !row.plannedAbsence,
        type:
          row.staff.id === currentStaffId
            ? ('MAIN_TUTOR' as const)
            : ('SECONDARY_TUTOR' as const),
      }));
      onUpdate(initialAttendance);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [staffProcessed.length, currentStaffId]);

  const handleAttendanceChange = (staffId: string, attended: boolean) => {
    const updated = staffAttendance.map((sa) =>
      sa.staffId === staffId ? { ...sa, attended } : sa
    );

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
    const updated = staffAttendance.map((sa) => (sa.staffId === staffId ? { ...sa, type } : sa));

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
        statuses: ['ACTIVE', 'TRIAL'],
        limit: 20,
        offset: 0,
        orderBy: 'first_name',
        ascending: true,
      });
      const existingStaffIds = new Set(staffProcessed.map((d) => d.staff.id));
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
      queryClient.invalidateQueries({
        queryKey: [...sessionsKeys.detail(sessionId), 'forLogging'],
      });
      handleAttendanceChange(staffId, true);
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
      {title && <h2 className="text-xl font-semibold">{title}</h2>}

      {staffProcessed.length === 0 ? (
        <div className="text-center py-8 text-muted-foreground">No staff assigned to this session.</div>
      ) : (
        <div className="border rounded-lg overflow-hidden w-full min-w-0">
          <Table className="w-full table-fixed">
            <TableHeader>
              <TableRow>
                <TableHead className="min-w-0 w-[36%]">Staff</TableHead>
                {allowAbsenceLogging ? (
                  <>
                    <TableHead className="min-w-0 w-[32%]">Planned attendance</TableHead>
                    <TableHead className="min-w-0 w-[32%]">Actual attendance</TableHead>
                  </>
                ) : (
                  <TableHead className="min-w-0">Attendance</TableHead>
                )}
              </TableRow>
            </TableHeader>
            <TableBody>
              {staffProcessed.map((data) => {
                const attendance = getStaffAttendance(data.staff.id);
                const isAttended = attendance?.attended ?? !data.plannedAbsence;
                const type =
                  attendance?.type ??
                  (data.staff.id === currentStaffId ? 'MAIN_TUTOR' : 'SECONDARY_TUTOR');

                const actualCell = (
                  <div className="flex flex-wrap items-center gap-2 min-w-0">
                    <Checkbox
                      id={`staff-${data.staff.id}`}
                      checked={isAttended}
                      onCheckedChange={(checked) =>
                        handleAttendanceChange(data.staff.id, checked === true)
                      }
                    />
                    {isAttended ? (
                      <div className="min-w-0 flex-1 basis-[12rem] max-w-full">
                        <SearchableSelect<StaffTypeOption>
                          items={[...STAFF_TYPE_OPTIONS]}
                          value={
                            STAFF_TYPE_OPTIONS.find((o) => o.value === type) ?? STAFF_TYPE_OPTIONS[0]
                          }
                          onValueChange={(item) =>
                            item && handleTypeChange(data.staff.id, item.value)
                          }
                          getItemLabel={(o) => o.label}
                          getItemId={(o) => o.value}
                          triggerClassName="w-full min-w-0 max-w-full"
                        />
                      </div>
                    ) : (
                      <span className="text-muted-foreground text-sm">—</span>
                    )}
                  </div>
                );

                return (
                  <TableRow key={data.staff.id}>
                    <TableCell className="font-medium min-w-0 align-middle">
                      <span className="truncate block">
                        {data.staff.first_name} {data.staff.last_name}
                      </span>
                    </TableCell>
                    {allowAbsenceLogging ? (
                      <>
                        <TableCell className="min-w-0 align-middle">
                          <AttendanceCell
                            status={data.plannedStatus}
                            linkText={data.swappedStaffName || undefined}
                          />
                        </TableCell>
                        <TableCell className="min-w-0 align-middle">{actualCell}</TableCell>
                      </>
                    ) : (
                      <TableCell className="min-w-0 align-middle">{actualCell}</TableCell>
                    )}
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </div>
      )}

      {addStaffVariant === 'search' && onAddStaffToSession ? (
        <MeetingEntitySearchAdd
          kind="staff"
          placeholder="Search staff…"
          existingIds={staffProcessed.map((d) => d.staff.id)}
          onPick={async (row) => {
            await handleAddStaff(row.id);
          }}
        />
      ) : (
        <>
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
                <div className="max-h-60 overflow-y-auto space-y-1">
                  {availableStaff.map((staffMember) => (
                    <button
                      key={staffMember.id}
                      type="button"
                      onClick={() => handleAddStaff(staffMember.id)}
                      className="w-full text-left rounded-md px-2 py-2 text-sm font-medium hover:bg-muted/80"
                    >
                      {staffMember.first_name} {staffMember.last_name}
                    </button>
                  ))}
                </div>
              ) : searchTerm ? (
                <div className="text-center py-4 text-muted-foreground text-sm">No staff found</div>
              ) : null}

              <Button
                variant="outline"
                size="sm"
                onClick={() => {
                  setShowAddStaff(false);
                  setSearchTerm('');
                  setAvailableStaff([]);
                }}
              >
                Cancel
              </Button>
            </div>
          )}
        </>
      )}
    </div>
  );
}
