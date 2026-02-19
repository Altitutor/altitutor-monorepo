'use client';

import React, { useState, useMemo, useEffect } from 'react';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
  Button,
  Input,
  Badge,
  SkeletonTable,
  DataTableToolbar,
  TablePagination,
} from "@altitutor/ui";
import { 
  ArrowUpDown,
  Check,
  X,
  Search,
} from 'lucide-react';
import { format } from 'date-fns';
import type { Tables, DataTableFilterDefinition, DataTableSortOption, DataTableColumnDefinition } from '@altitutor/shared';
import { cn, formatSessionType, getSessionTypeBadgeColor } from '@/shared/utils/index';
import { ViewClassModal } from '@/features/classes';
import { TutorLogAvatar } from './TutorLogAvatar';
import { AttendanceCell } from './AttendanceCell';
import { ActionsMenu } from '@/shared/components/ActionsMenu';
import { useCurrentStaff } from '@/features/staff/hooks/useStaffQuery';
import { LogSessionModal, EditTutorLogDialog } from '@/features/tutor-logs';
import { useRouter } from 'next/navigation';
import { BookSessionModal } from '@/features/bookings/components/BookSessionModal';
import { useSessionsTable } from '../hooks/useSessionsTable';
import { getInvoiceStatusBadgeVariant } from '../utils/sessionsTableHelpers';
import { useDataTable } from '@/shared/hooks/useDataTable';
import { useQuickFilters } from '@/features/quick-filters/hooks/useQuickFilters';

type SessionsTableProps = {
  studentId?: string;
  staffId?: string;
  classId?: string;
  adminShiftId?: string;
  limit?: number;
  rangeStart?: string; // YYYY-MM-DD
  rangeEnd?: string;   // YYYY-MM-DD
  onOpenSession?: (id: string) => void;
  onOpenStudent?: (id: string) => void;
  onOpenStaff?: (id: string) => void;
  hideBilling?: boolean; // Hide invoice status badges
  hideStudentFilter?: boolean; // Hide student filter UI
  hideTypeFilter?: boolean; // Hide type filter UI
  hideTutorLogFilter?: boolean; // Hide tutor log filter UI
  hideSearch?: boolean; // Hide search input
  hideTypeColumn?: boolean; // Hide Type column
  hideClassColumn?: boolean; // Hide Class column
  hideStudentsColumn?: boolean; // Hide Students column
  initialStudentFilters?: string[]; // Initial student filters (for external filter control)
  showAttendanceBreakdown?: boolean; // Show planned and actual attendance badges per person
};

type SessionTableStudent = Tables<'students'> & {
  planned_absence?: boolean;
  actual_attended?: boolean | null;
  actual_was_trial?: boolean | null;
  invoice_status?: string | null;
  sessions_students_id?: string | null;
  is_extra?: boolean;
  was_trial?: boolean;
  is_rescheduled?: boolean;
  is_credited?: boolean;
  rescheduled_session?: {
    session?: {
      id: string;
      start_at?: string;
      class?: {
        start_time?: string | null;
      } | null;
    } | null;
  } | null;
};

type SessionTableStaff = Tables<'staff'> & {
  planned_absence?: boolean;
  actual_attended?: boolean | null;
  actual_type?: 'MAIN_TUTOR' | 'SECONDARY_TUTOR' | 'TRIAL_TUTOR' | null;
  is_swapped_in?: boolean;
  is_swapped?: boolean;
  swapped_staff?: {
    id: string;
    first_name: string;
    last_name: string;
  } | null;
};

function getStudentAttendanceStatus(student: SessionTableStudent, hasTutorLog: boolean, plannedStudentIds: Set<string>) {
  const isUnplanned = (student.sessions_students_id === null || student.sessions_students_id === undefined) && student.is_extra;
  const wasTrialPlanned = student.was_trial ?? false;

  let plannedStatus: 'attending' | 'attending-extra' | 'attending-trial' | 'attending-extra-trial' | 'absent' | 'rescheduled' | 'credited' | 'unplanned' = 'attending';
  let rescheduledSessionId = '';
  let rescheduledDate = '';

  if (student.planned_absence && !isUnplanned) {
    plannedStatus = 'absent';
    if (student.is_rescheduled && student.rescheduled_session?.session) {
      plannedStatus = 'rescheduled';
      rescheduledSessionId = student.rescheduled_session.session.id;
      if (student.rescheduled_session.session.start_at) {
        rescheduledDate = `${format(new Date(student.rescheduled_session.session.start_at), 'EEE dd/MM')} ${student.rescheduled_session.session.class?.start_time || ''}`.trim();
      }
    } else if (student.is_credited) {
      plannedStatus = 'credited';
    }
  } else if (isUnplanned) {
    plannedStatus = 'unplanned';
  } else if (student.is_extra && plannedStudentIds.has(student.id)) {
    plannedStatus = wasTrialPlanned ? 'attending-extra-trial' : 'attending-extra';
  } else {
    plannedStatus = wasTrialPlanned ? 'attending-trial' : 'attending';
  }

  const wasTrialActual = student.actual_was_trial ?? false;
  const actualStatus: 'not-logged' | 'attended' | 'attended-trial' | 'did-not-attend' = !hasTutorLog
    ? 'not-logged'
    : student.actual_attended
    ? (wasTrialActual ? 'attended-trial' : 'attended')
    : 'did-not-attend';

  return {
    plannedStatus,
    actualStatus,
    rescheduledSessionId,
    rescheduledDate,
  };
}

function getStaffAttendanceStatus(staff: SessionTableStaff, hasTutorLog: boolean) {
  let plannedStatus: 'attending' | 'absent' | 'swapped' = 'attending';
  let swappedStaffId = '';
  let swappedStaffName = '';

  if (staff.planned_absence) {
    plannedStatus = 'absent';
    if (staff.is_swapped && staff.swapped_staff) {
      plannedStatus = 'swapped';
      swappedStaffId = staff.swapped_staff.id;
      swappedStaffName = `${staff.swapped_staff.first_name} ${staff.swapped_staff.last_name}`.trim();
    }
  }

  const actualStatus: 'not-logged' | 'attended' | 'did-not-attend' = !hasTutorLog
    ? 'not-logged'
    : staff.actual_attended
    ? 'attended'
    : 'did-not-attend';

  return {
    plannedStatus,
    actualStatus,
    swappedStaffId,
    swappedStaffName,
  };
}

export function SessionsTable({
  studentId,
  staffId,
  classId,
  adminShiftId,
  limit,
  rangeStart,
  rangeEnd,
  onOpenSession,
  onOpenStudent,
  onOpenStaff,
  hideBilling = false,
  hideStudentFilter = false,
  hideTypeFilter = false,
  hideTutorLogFilter = false,
  hideSearch = false,
  hideTypeColumn = false,
  hideClassColumn = false,
  hideStudentsColumn = false,
  initialStudentFilters = [],
  showAttendanceBreakdown = false,
}: SessionsTableProps) {
  const router = useRouter();
  const { data: currentStaff } = useCurrentStaff();
  const { data: quickFilters = [] } = useQuickFilters('sessions');
  
  const defaultFilters = useMemo(() => ({}), []);
  const defaultSort = useMemo(() => ({ field: 'start_at', direction: 'desc' as const }), []);
  const defaultVisibleColumns = useMemo(() => ['date', 'time', 'class', 'staff', 'students', 'tutor_log'], []);

  const {
    state,
    setSearch,
    setSort,
    setFilters,
    setPage,
    setPageSize,
    setVisibleColumns,
    applyQuickFilter,
    resetFilters,
  } = useDataTable({
    defaultFilters,
    defaultSort,
    defaultVisibleColumns,
    filterKeys: ['type', 'student', 'staff', 'tutor_log', 'from', 'to'],
  });

  // Modal state (UI-specific, stays in component)
  const [actionSessionId, setActionSessionId] = useState<string | null>(null);
  const [isLogSessionModalOpen, setIsLogSessionModalOpen] = useState(false);
  const [isRescheduleModalOpen, setIsRescheduleModalOpen] = useState(false);
  const [selectedSessionForReschedule, setSelectedSessionForReschedule] =
    useState<Tables<'sessions'> | null>(null);
  const [selectedStudentForReschedule, setSelectedStudentForReschedule] =
    useState<string | null>(null);
  const [selectedClassId, setSelectedClassId] = useState<string | null>(null);
  const [isClassModalOpen, setIsClassModalOpen] = useState(false);
  const [selectedTutorLogId, setSelectedTutorLogId] = useState<string | null>(null);
  const [isEditTutorLogModalOpen, setIsEditTutorLogModalOpen] = useState(false);
  const [studentFilterSearch, setStudentFilterSearch] = useState('');
  const [staffFilterSearch, setStaffFilterSearch] = useState('');

  // Session types constant
  const SESSION_TYPES = [
    'CLASS',
    'DRAFTING',
    'EXAM_COURSE',
    'SUBSIDY_INTERVIEW',
    'TRIAL_SESSION',
    'STAFF_INTERVIEW',
    'TRIAL_SHIFT',
  ] as const;

  // Use the main hook for all business logic
  const {
    // Data
    allSessions,
    filteredSessions,
    paginatedSessions,
    classesById,
    sessionStudents,
    sessionStaff,
    tutorLogs,
    isLoading,
    error,
    isFetching,
    refetch,
    filteredStudents,
    filteredStaff,

    // Formatting helpers
    formatDate,
    getTimeRange,
    getClassDisplayName,
    getClassShortDisplayName,
    canReschedule,
    getRescheduleStudentId,
  } = useSessionsTable({
    studentId,
    staffId,
    classId,
    adminShiftId,
    limit,
    rangeStart,
    rangeEnd,
    hideStudentFilter,
    initialStudentFilters,
    studentSearchQuery: studentFilterSearch,
    staffSearchQuery: staffFilterSearch,
    state, // Pass the data table state
  });

  // Bridge useDataTable state to useSessionsTable
  // We'll update the useSessionsTable hook next to use these values
  // For now, we'll manually filter if needed or just let useDataTable handle the URL

  const filterDefinitions: DataTableFilterDefinition[] = useMemo(() => [
    ...(hideTypeFilter ? [] : [{
      key: 'type',
      label: 'Session Type',
      options: SESSION_TYPES.map(t => ({ label: formatSessionType(t), value: t })),
    }]),
    ...(hideStudentFilter ? [] : [{
      key: 'student',
      label: 'Student',
      options: filteredStudents.map(s => ({ label: `${s.first_name} ${s.last_name}`, value: s.id })),
      searchable: true,
      searchPlaceholder: 'Search students...',
    }]),
    ...[{
      key: 'staff',
      label: 'Staff',
      options: filteredStaff.map(s => ({ label: `${s.first_name} ${s.last_name}`, value: s.id })),
      searchable: true,
      searchPlaceholder: 'Search staff...',
    }],
    ...(hideTutorLogFilter ? [] : [{
      key: 'tutor_log',
      label: 'Tutor Log',
      options: [
        { label: 'Logged', value: 'logged' },
        { label: 'Unlogged', value: 'unlogged' },
      ],
    }]),
    { key: 'from', label: 'From date', type: 'date' },
    { key: 'to', label: 'To date', type: 'date' },
  ], [filteredStaff, filteredStudents, hideStudentFilter, hideTutorLogFilter, hideTypeFilter]);

  const sortOptions: DataTableSortOption[] = [
    { key: 'start_at', label: 'Date' },
  ];

  const columnDefinitions: DataTableColumnDefinition[] = [
    { key: 'date', label: 'Date' },
    { key: 'time', label: 'Time' },
    { key: 'class', label: 'Class' },
    { key: 'staff', label: 'Staff' },
    { key: 'students', label: 'Students' },
    { key: 'tutor_log', label: 'Tutor Log' },
  ];

  // Reset to page 1 when search term or filters change
  useEffect(() => {
    setPage(1);
  }, [state.search, state.filters, setPage]);

  const handleSessionClick = (id: string) => {
    if (onOpenSession) onOpenSession(id);
  };

  const handleClassClick = (classId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    setSelectedClassId(classId);
    setIsClassModalOpen(true);
  };

  // Loading state
  if (isLoading && allSessions.length === 0) {
    return (
      <div className="space-y-4">
        {!limit && (
          <div className="flex justify-between items-center">
            <div className="relative w-64">
              <Search className="absolute left-2 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search sessions..."
                className="pl-8"
                disabled
              />
            </div>
          </div>
        )}

        <SkeletonTable rows={limit || 8} columns={6} />

        <div className="text-sm text-muted-foreground">
          Loading sessions...
        </div>
      </div>
    );
  }

  // Error state
  if (error && allSessions.length === 0) {
    return (
      <div className="text-red-500 p-4">
        Failed to load sessions. Please try again.
        <button
          onClick={() => refetch()}
          className="ml-2 text-blue-600 hover:text-blue-800 underline"
        >
          Retry
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {!limit && (
        <div className="flex flex-col gap-2">
          <DataTableToolbar
            state={state}
            onSearchChange={setSearch}
            onFiltersChange={setFilters}
            onSortChange={setSort}
            onGroupByChange={() => {}}
            onVisibleColumnsChange={setVisibleColumns}
            onQuickFilterApply={(qf) => applyQuickFilter(qf, currentStaff?.id)}
            onReset={resetFilters}
            filterDefinitions={filterDefinitions}
            sortOptions={sortOptions}
            columnDefinitions={columnDefinitions}
            quickFilters={quickFilters}
            filterSearchValues={{
              student: studentFilterSearch,
              staff: staffFilterSearch,
            }}
            onFilterSearchChange={(filterKey, value) => {
              if (filterKey === 'student') setStudentFilterSearch(value);
              if (filterKey === 'staff') setStaffFilterSearch(value);
            }}
            searchPlaceholder="Search sessions..."
            isLoading={isFetching}
          />
        </div>
      )}

      <div className="rounded-md border">
        <Table>
          <TableHeader>
            <TableRow>
              {state.visibleColumns.includes('date') && (
                <TableHead className="cursor-pointer" onClick={() => setSort('start_at', state.sortBy === 'start_at' && state.sortDirection === 'asc' ? 'desc' : 'asc')}>
                  Date
                  <ArrowUpDown className={cn(
                    "ml-2 h-4 w-4 inline",
                    state.sortBy === 'start_at' ? "opacity-100" : "opacity-40"
                  )} />
                </TableHead>
              )}
              {state.visibleColumns.includes('time') && <TableHead>Time</TableHead>}
              {state.visibleColumns.includes('class') && !classId && !hideClassColumn && !hideTypeColumn && (
                <TableHead>Class</TableHead>
              )}
              {state.visibleColumns.includes('staff') && <TableHead>Staff</TableHead>}
              {state.visibleColumns.includes('students') && !hideStudentsColumn && (
                <TableHead>Students</TableHead>
              )}
              {state.visibleColumns.includes('tutor_log') && <TableHead>Tutor Log</TableHead>}
              <TableHead></TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {paginatedSessions.length === 0 ? (
              <TableRow>
                <TableCell colSpan={state.visibleColumns.length + 1} className="text-center h-24">
                  {state.search || Object.keys(state.filters).length > 0
                    ? "No sessions match your filters"
                    : "No sessions found"}
                </TableCell>
              </TableRow>
            ) : (
              paginatedSessions.map((session) => (
                <TableRow 
                  key={session.id} 
                  className="cursor-pointer hover:bg-muted/50"
                  onClick={() => handleSessionClick(session.id)}
                >
                  {state.visibleColumns.includes('date') && (
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <span>{session.start_at ? formatDate(session.start_at) : '-'}</span>
                        {session.status === 'INACTIVE' && (
                          <Badge variant="secondary" className="text-xs">
                            Inactive
                          </Badge>
                        )}
                      </div>
                    </TableCell>
                  )}
                  {state.visibleColumns.includes('time') && (
                    <TableCell className="font-medium">{getTimeRange(session)}</TableCell>
                  )}
                  {state.visibleColumns.includes('class') && !classId && !hideClassColumn && !hideTypeColumn && (
                  <TableCell>
                    <div className="flex items-center gap-2">
                      <Badge className={getSessionTypeBadgeColor(session.type)}>
                        {formatSessionType(session.type)}
                      </Badge>
                      {session.class_id ? (() => {
                        const cls = classesById[session.class_id];
                        const shortDisplay = getClassShortDisplayName(session);
                        const fullDisplay = getClassDisplayName(session);
                        // Show button if class exists, even if display is empty (fallback to "Class")
                        if (cls) {
                          return (
                            <Button
                              variant="link"
                              size="sm"
                              className="h-auto p-0 text-xs justify-start whitespace-nowrap font-medium"
                              onClick={(e) => handleClassClick(session.class_id!, e)}
                              title={fullDisplay || 'Class'}
                            >
                              {/* Default to short names, only show full on 2xl+ screens */}
                              <span className="2xl:hidden">{shortDisplay || 'Class'}</span>
                              <span className="hidden 2xl:inline">{fullDisplay || 'Class'}</span>
                            </Button>
                          );
                        }
                        return null;
                      })() : null}
                    </div>
                  </TableCell>
                  )}
                  {state.visibleColumns.includes('staff') && (
                    <TableCell>
                      {(() => {
                        const staffList = (sessionStaff[session.id] || []) as SessionTableStaff[];
                        const hasTutorLog = !!tutorLogs[session.id];
                        if (!staffList.length) return <span className="text-muted-foreground text-sm">-</span>;
                        return (
                          <div className="flex flex-col gap-1">
                            {staffList.map((s) => {
                              const planned_absence = s.planned_absence === true;
                              const nameClass = planned_absence ? "text-muted-foreground line-through" : "";
                              const attendance = getStaffAttendanceStatus(s, hasTutorLog);
                              
                              return (
                                <div key={s.id} className="flex items-center gap-2 flex-wrap">
                                  <Button
                                    variant="link"
                                    size="sm"
                                    className={cn("h-auto p-0 text-xs justify-start", nameClass)}
                                    onClick={(e) => { e.stopPropagation(); (onOpenStaff as any)?.(s.id); }}
                                  >
                                    {s.first_name} {s.last_name}
                                  </Button>
                                  {showAttendanceBreakdown ? (
                                    <>
                                      <AttendanceCell
                                        status={attendance.plannedStatus}
                                        linkTo={
                                          attendance.plannedStatus === 'swapped' && attendance.swappedStaffId
                                            ? {
                                                type: 'staff',
                                                id: attendance.swappedStaffId,
                                                onClick: () => (onOpenStaff as any)?.(attendance.swappedStaffId),
                                              }
                                            : undefined
                                        }
                                        linkText={attendance.swappedStaffName}
                                      />
                                      <AttendanceCell
                                        status={attendance.actualStatus}
                                        staffType={s.actual_type ?? undefined}
                                      />
                                    </>
                                  ) : (
                                    s.actual_attended !== null && (
                                      s.actual_attended ? (
                                        <Check className="h-3 w-3 text-green-600 flex-shrink-0" />
                                      ) : (
                                        <X className="h-3 w-3 text-red-600 flex-shrink-0" />
                                      )
                                    )
                                  )}
                                </div>
                              );
                            })}
                          </div>
                        );
                      })()}
                    </TableCell>
                  )}
                  {state.visibleColumns.includes('students') && !hideStudentsColumn && (
                    <TableCell>
                      {(() => {
                        const studentList = (sessionStudents[session.id] || []) as SessionTableStudent[];
                        const hasTutorLog = !!tutorLogs[session.id];
                        const plannedStudentIds = new Set(
                          studentList
                            .filter((student) => student.sessions_students_id !== null && student.sessions_students_id !== undefined)
                            .map((student) => student.id)
                        );
                        if (!studentList.length) return <span className="text-muted-foreground text-sm">-</span>;
                        
                        return (
                          <div className="flex flex-col gap-1">
                            {studentList.map((s) => {
                              const planned_absence = s.planned_absence === true;
                              const invoiceStatus = s.invoice_status;
                              const isExtra = s.is_extra === true;
                              const nameClass = planned_absence 
                                ? "text-muted-foreground line-through" 
                                : isExtra
                                ? "text-orange-600 dark:text-orange-400"
                                : "";
                              const attendance = getStudentAttendanceStatus(s, hasTutorLog, plannedStudentIds);
                              
                              const badgeInfo = getInvoiceStatusBadgeVariant(invoiceStatus);
                              
                              return (
                                <div key={s.id} className="flex items-center gap-2 flex-wrap">
                                  <Button
                                    variant="link"
                                    size="sm"
                                    className={cn("h-auto p-0 text-xs justify-start", nameClass)}
                                    onClick={(e) => { e.stopPropagation(); (onOpenStudent as any)?.(s.id); }}
                                  >
                                    {s.first_name} {s.last_name}
                                  </Button>
                                  {showAttendanceBreakdown ? (
                                    <>
                                      <AttendanceCell
                                        status={attendance.plannedStatus}
                                        linkTo={
                                          attendance.plannedStatus === 'rescheduled' && attendance.rescheduledSessionId
                                            ? {
                                                type: 'session',
                                                id: attendance.rescheduledSessionId,
                                                onClick: () => onOpenSession?.(attendance.rescheduledSessionId),
                                              }
                                            : undefined
                                        }
                                        linkText={attendance.rescheduledDate}
                                      />
                                      <AttendanceCell status={attendance.actualStatus} />
                                    </>
                                  ) : (
                                    s.actual_attended !== null && (
                                      s.actual_attended ? (
                                        <Check className="h-3 w-3 text-green-600 flex-shrink-0" />
                                      ) : (
                                        <X className="h-3 w-3 text-red-600 flex-shrink-0" />
                                      )
                                    )
                                  )}
                                  {!hideBilling && badgeInfo && (
                                    <Badge variant={badgeInfo.variant} className="text-xs ml-1">
                                      {badgeInfo.label}
                                    </Badge>
                                  )}
                                </div>
                              );
                            })}
                          </div>
                        );
                      })()}
                    </TableCell>
                  )}
                  {state.visibleColumns.includes('tutor_log') && (
                    <TableCell>
                      {tutorLogs[session.id] ? (
                        <TutorLogAvatar
                          firstName={tutorLogs[session.id].created_by_name.first_name}
                          lastName={tutorLogs[session.id].created_by_name.last_name}
                        />
                      ) : (
                        <span className="text-muted-foreground text-sm">-</span>
                      )}
                    </TableCell>
                  )}
                  <TableCell onClick={(e) => e.stopPropagation()}>
                    {(() => {
                      const sessionCanReschedule = canReschedule(session);
                      const rescheduleStudentId = getRescheduleStudentId(session.id);
                      
                      return (
                        <ActionsMenu
                          type="session"
                          entityId={session.id}
                          copyTagDisplayText={getClassShortDisplayName(session) || session.id}
                          onOpenInPage={() => {
                            router.push(`/sessions/${session.id}`);
                          }}
                          onLogSession={() => {
                            setActionSessionId(session.id);
                            setIsLogSessionModalOpen(true);
                          }}
                          hasTutorLog={!!tutorLogs[session.id]}
                          onEditTutorLog={tutorLogs[session.id] ? () => {
                            setSelectedTutorLogId(tutorLogs[session.id].id);
                            setIsEditTutorLogModalOpen(true);
                          } : undefined}
                          onReschedule={() => {
                            if (rescheduleStudentId) {
                              setSelectedStudentForReschedule(rescheduleStudentId);
                              setSelectedSessionForReschedule(session);
                              setIsRescheduleModalOpen(true);
                            } else {
                              // This shouldn't happen if canReschedule is working correctly,
                              // but handle gracefully just in case
                              console.warn('Cannot reschedule: no valid student found for session', session.id);
                            }
                          }}
                          canReschedule={sessionCanReschedule}
                        />
                      );
                    })()}
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>
      
      {!limit && (
        <TablePagination
          page={state.page}
          pageSize={state.pageSize}
          total={filteredSessions.length}
          isFetching={isFetching}
          onPageChange={setPage}
          onPageSizeChange={setPageSize}
        />
      )}

      {/* Class Modal */}
      {selectedClassId && (
        <ViewClassModal
          classId={selectedClassId}
          isOpen={isClassModalOpen}
          onClose={() => {
            setIsClassModalOpen(false);
            setSelectedClassId(null);
          }}
          onClassUpdated={() => {
            // Refresh sessions when class is updated
            refetch();
          }}
        />
      )}

      {/* Log Session Modal */}
      {currentStaff && actionSessionId && (
        <LogSessionModal
          isOpen={isLogSessionModalOpen}
          onClose={() => {
            setIsLogSessionModalOpen(false);
            setActionSessionId(null);
            refetch();
          }}
          currentStaffId={currentStaff.id}
          adminMode={true}
          initialSessionId={actionSessionId}
        />
      )}

      {/* Reschedule Session Modal */}
      {selectedSessionForReschedule && selectedStudentForReschedule && (
        <BookSessionModal
          isOpen={isRescheduleModalOpen}
          onClose={async () => {
            setIsRescheduleModalOpen(false);
            setSelectedSessionForReschedule(null);
            setSelectedStudentForReschedule(null);
            refetch();
          }}
          sessionType={selectedSessionForReschedule.type as 'DRAFTING' | 'TRIAL_SESSION' | 'SUBSIDY_INTERVIEW'}
          initialStudentId={selectedStudentForReschedule}
          originalSessionId={selectedSessionForReschedule.id}
          originalSubjectId={(() => {
            // Check session.subject_id first (for DRAFTING sessions)
            if (selectedSessionForReschedule.subject_id) {
              return selectedSessionForReschedule.subject_id;
            }
            // Fall back to class.subject_id if session doesn't have subject_id
            if (selectedSessionForReschedule.class_id) {
              const cls = classesById[selectedSessionForReschedule.class_id];
              return cls?.subject_id || null;
            }
            return null;
          })()}
          onBookingCreated={(_newSessionId) => {
            setIsRescheduleModalOpen(false);
            setSelectedSessionForReschedule(null);
            setSelectedStudentForReschedule(null);
            refetch();
          }}
        />
      )}

      {/* Edit Tutor Log Modal */}
      {selectedTutorLogId && (
        <EditTutorLogDialog
          tutorLogId={selectedTutorLogId}
          isOpen={isEditTutorLogModalOpen}
          onClose={() => {
            setIsEditTutorLogModalOpen(false);
            setSelectedTutorLogId(null);
          }}
          onTutorLogUpdated={() => {
            refetch();
          }}
        />
      )}
    </div>
  );
}
