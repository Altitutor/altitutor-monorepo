'use client';

import { useState, useEffect, useMemo } from 'react';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  SearchableSelect,
} from '@altitutor/ui';
import { Button } from '@altitutor/ui';
import { Input } from '@altitutor/ui';
import { MoreHorizontal, Plus, Search, Trash2 } from 'lucide-react';
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
import {
  CHECK_IN_HOST,
  CHECK_IN_RECEIVER,
  CHECK_IN_STAFF_TYPE_OPTIONS,
  CLASS_STAFF_TYPE_OPTIONS,
  toCheckInStaffRole,
} from '@altitutor/shared/pay-tiers';
import type { TutorLogFormData } from '../../types';
import { cn } from '@/shared/utils';

type StaffTypeOption =
  | (typeof CLASS_STAFF_TYPE_OPTIONS)[number]
  | (typeof CHECK_IN_STAFF_TYPE_OPTIONS)[number];

type StaffAttendanceItem = TutorLogFormData['staffAttendance'][number];

type Step2StaffAttendanceProps = {
  title?: string;
  sessionId: string;
  currentStaffId: string;
  staffAttendance: StaffAttendanceItem[];
  onUpdate: (staffAttendance: StaffAttendanceItem[]) => void;
  onAddStaffToSession?: (staffId: string) => Promise<void>;
  onRemoveStaffFromSession?: (staffId: string) => Promise<void>;
  /** Use SearchableSelect-based add (meeting log flow). Default: legacy search input + cards. */
  addStaffVariant?: 'legacy' | 'search';
};

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

export function Step2StaffAttendance({
  title,
  sessionId,
  currentStaffId,
  staffAttendance,
  onUpdate,
  onAddStaffToSession,
  onRemoveStaffFromSession,
  addStaffVariant = 'legacy',
}: Step2StaffAttendanceProps) {
  const queryClient = useQueryClient();
  const { data: sessionData, isLoading } = useSessionForLogging(sessionId);
  const [showAddStaff, setShowAddStaff] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [availableStaff, setAvailableStaff] = useState<StaffListItem[]>([]);
  const [isLoadingStaff, setIsLoadingStaff] = useState(false);

  const isCheckIn = sessionData?.session?.type === 'CHECK_IN';
  const staffTypeOptions: StaffTypeOption[] = isCheckIn
    ? [...CHECK_IN_STAFF_TYPE_OPTIONS]
    : [...CLASS_STAFF_TYPE_OPTIONS];

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

  const resolveInitialType = (
    staffId: string,
    sessionsStaffType: string | null | undefined
  ): StaffAttendanceItem['type'] => {
    if (isCheckIn) {
      if (sessionsStaffType) return toCheckInStaffRole(sessionsStaffType);
      return staffId === currentStaffId ? CHECK_IN_HOST : CHECK_IN_RECEIVER;
    }
    if (staffId === currentStaffId) return 'MAIN_TUTOR';
    if (isClassStaffType(sessionsStaffType)) return sessionsStaffType;
    return 'SECONDARY_TUTOR';
  };

  // Initialize form data if empty
  useEffect(() => {
    if (staffAttendance.length === 0 && staffProcessed.length > 0) {
      const initialAttendance = staffProcessed.map((row) => ({
        staffId: row.staff.id,
        attended: !row.plannedAbsence,
        type: resolveInitialType(row.staff.id, row.sessionsStaffType),
      }));
      onUpdate(initialAttendance);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [staffProcessed.length, currentStaffId, isCheckIn]);

  const handleAttendanceChange = (staffId: string, attended: boolean) => {
    const updated = staffAttendance.map((sa) =>
      sa.staffId === staffId ? { ...sa, attended } : sa
    );

    if (!staffAttendance.find((sa) => sa.staffId === staffId)) {
      const sessionsStaffType = staffProcessed.find((row) => row.staff.id === staffId)?.sessionsStaffType;
      updated.push({
        staffId,
        attended,
        type: resolveInitialType(staffId, sessionsStaffType),
      });
    }

    onUpdate(updated);
  };

  const handleTypeChange = (staffId: string, type: StaffAttendanceItem['type']) => {
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

  const handleRemoveStaff = async (staffId: string) => {
    if (onRemoveStaffFromSession) {
      await onRemoveStaffFromSession(staffId);
      queryClient.invalidateQueries({
        queryKey: [...sessionsKeys.detail(sessionId), 'forLogging'],
      });
    }
    onUpdate(staffAttendance.filter((sa) => sa.staffId !== staffId));
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
                <TableHead className="min-w-0 w-[34%]">Staff</TableHead>
                {allowAbsenceLogging ? (
                  <>
                    <TableHead className="min-w-0 w-[30%]">Planned attendance</TableHead>
                    <TableHead className="min-w-0 w-[28%]">Actual attendance</TableHead>
                  </>
                ) : (
                  <TableHead className="min-w-0">Attendance</TableHead>
                )}
                <TableHead className="w-12" aria-label="Actions" />
              </TableRow>
            </TableHeader>
            <TableBody>
              {staffProcessed.map((data) => {
                const attendance = getStaffAttendance(data.staff.id);
                const isAttended = attendance?.attended ?? !data.plannedAbsence;
                const type =
                  attendance?.type ?? resolveInitialType(data.staff.id, data.sessionsStaffType);
                const selectedOption =
                  staffTypeOptions.find((o) => o.value === type) ?? staffTypeOptions[0];

                const actualCell = (
                  <div className="flex flex-wrap items-center gap-2 min-w-0">
                    <AttendanceToggle
                      attended={isAttended}
                      onChange={(next) => handleAttendanceChange(data.staff.id, next)}
                    />
                    {isAttended ? (
                      <div className="min-w-0 flex-1 basis-[12rem] max-w-full">
                        <SearchableSelect<StaffTypeOption>
                          items={staffTypeOptions}
                          value={selectedOption}
                          onValueChange={(item) =>
                            item && handleTypeChange(data.staff.id, item.value)
                          }
                          getItemLabel={(o) => o.label}
                          getItemId={(o) => o.value}
                          triggerClassName="w-full min-w-0 max-w-full"
                        />
                      </div>
                    ) : null}
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
                    <TableCell className="align-middle text-right">
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button
                            type="button"
                            variant="outline"
                            size="icon"
                            className="h-8 w-8"
                            aria-label={`Actions for ${data.staff.first_name} ${data.staff.last_name}`}
                          >
                            <MoreHorizontal className="h-4 w-4" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuItem
                            className="text-destructive focus:text-destructive"
                            onClick={() => void handleRemoveStaff(data.staff.id)}
                          >
                            <Trash2 className="mr-2 h-4 w-4" />
                            Remove staff
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </TableCell>
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
