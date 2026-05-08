'use client';

import React, { useState, useMemo, useEffect, useCallback } from 'react';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
  Input,
  SkeletonTable,
  DataTableToolbar,
  TablePagination,
} from '@altitutor/ui';
import { ArrowUpDown, Search } from 'lucide-react';
import type { DataTableFilterDefinition, DataTableSortOption, DataTableColumnDefinition } from '@altitutor/shared';
import { cn, formatSessionType } from '@/shared/utils/index';
import { ViewClassModal } from '@/features/classes';
import { useCurrentStaff } from '@/shared/hooks';
import { LogSessionModal, EditTutorLogDialog } from '@/features/tutor-logs';
import { useRouter } from 'next/navigation';
import { useSessionsTable } from '../hooks/useSessionsTable';
import { useSessionsTableModals } from '../hooks/useSessionsTableModals';
import { useDataTable } from '@/shared/hooks/useDataTable';
import { useQuickFilters } from '@/features/quick-filters/hooks/useQuickFilters';
import { LogAbsenceDialog } from './absences';
import { SessionsTableRow } from './SessionsTableRow';
import { useUninvoicedSessions } from '@/features/reconciliation/api/queries';

const SESSION_TYPES = [
  'CLASS',
  'DRAFTING',
  'EXAM_COURSE',
  'SUBSIDY_INTERVIEW',
  'TRIAL_SESSION',
  'STAFF_INTERVIEW',
  'CHECK_IN',
  'ADMIN_MEETING',
] as const;

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
  attendanceView?: 'student' | 'staff'; // Specialized attendance table mode for student/staff tabs
  onUndoLogAbsenceStudent?: (payload: {
    studentId: string;
    studentName: string;
    sessionsStudentsId: string;
    action: 'credit' | 'reschedule';
    rescheduledSessionTitle?: string;
    sessionShortName: string;
  }) => void;
  onUndoLogAbsenceStaff?: (payload: {
    staffId: string;
    staffName: string;
    sessionsStaffId: string;
    action: 'log' | 'swap';
    swappedStaffName?: string;
    sessionShortName: string;
  }) => void;
  onRemoveStudentFromSession?: (sessionId: string, studentId: string, studentName: string, sessionShortName?: string) => void;
  onRemoveStaffFromSession?: (sessionId: string, staffId: string, staffName: string, sessionShortName?: string) => void;
};

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
  hideSearch: _hideSearch = false,
  hideTypeColumn = false,
  hideClassColumn = false,
  hideStudentsColumn = false,
  initialStudentFilters = [],
  attendanceView,
  onUndoLogAbsenceStudent,
  onUndoLogAbsenceStaff,
  onRemoveStudentFromSession,
  onRemoveStaffFromSession,
}: SessionsTableProps) {
  const isStudentAttendanceView = attendanceView === 'student';
  const isStaffAttendanceView = attendanceView === 'staff';
  const router = useRouter();
  const { data: currentStaff } = useCurrentStaff();
  const { data: quickFilters = [] } = useQuickFilters('sessions');
  const [studentFilterSearch, setStudentFilterSearch] = useState('');
  const [staffFilterSearch, setStaffFilterSearch] = useState('');
  const [subjectFilterSearch, setSubjectFilterSearch] = useState('');

  const defaultFilters = useMemo(() => ({}), []);
  const defaultSort = useMemo(() => ({ field: 'start_at', direction: 'asc' as const }), []);
  const defaultVisibleColumns = useMemo(() => {
    if (isStudentAttendanceView) {
      return ['date', 'time', 'class', 'planned_attendance', 'actual_attendance', 'invoice'];
    }
    if (isStaffAttendanceView) {
      return ['date', 'time', 'class', 'planned_attendance', 'actual_attendance', 'tutor_log'];
    }
    return ['date', 'time', 'class', 'staff', 'students', 'tutor_log'];
  }, [isStaffAttendanceView, isStudentAttendanceView]);

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
    filterKeys: ['type', 'subject', 'student', 'staff', 'tutor_log', 'from', 'to'],
  });

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
    subjectsById,
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

  const modals = useSessionsTableModals(refetch);

  const { data: uninvoicedSessions = [] } = useUninvoicedSessions();
  const uninvoicedSessionsStudentsIds = useMemo(() => {
    if (!studentId) return undefined;
    return new Set(
      uninvoicedSessions
        .filter((s) => s.student_id === studentId)
        .map((s) => s.sessions_students_id)
    );
  }, [uninvoicedSessions, studentId]);

  const subjectFilterOptions = useMemo(() => {
    const list = Object.values(subjectsById);
    const q = subjectFilterSearch.trim().toLowerCase();
    const filtered = q
      ? list.filter((s) => {
          const longName = (s.long_name ?? '').toLowerCase();
          const shortName = (s.short_name ?? '').toLowerCase();
          const name = (s.name ?? '').toLowerCase();
          return longName.includes(q) || shortName.includes(q) || name.includes(q);
        })
      : list;
    return filtered
      .sort((a, b) => (a.long_name ?? '').localeCompare(b.long_name ?? ''))
      .map((s) => ({ label: s.long_name ?? '', value: s.id }));
  }, [subjectsById, subjectFilterSearch]);

  const filterDefinitions: DataTableFilterDefinition[] = useMemo(() => [
    ...(hideTypeFilter ? [] : [{
      key: 'type',
      label: 'Session Type',
      options: SESSION_TYPES.map(t => ({ label: formatSessionType(t), value: t })),
    }]),
    {
      key: 'subject',
      label: 'Subject',
      options: subjectFilterOptions,
      searchable: true,
      searchPlaceholder: 'Search subjects...',
    },
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
    {
      key: 'date',
      label: 'Date',
      type: 'date-range',
      fromKey: 'from',
      toKey: 'to',
    },
  ], [filteredStaff, filteredStudents, hideStudentFilter, hideTutorLogFilter, hideTypeFilter, subjectFilterOptions]);

  const sortOptions: DataTableSortOption[] = [
    { key: 'start_at', label: 'Date' },
  ];

  const columnDefinitions: DataTableColumnDefinition[] = useMemo(() => {
    if (isStudentAttendanceView) {
      return [
        { key: 'date', label: 'Date' },
        { key: 'time', label: 'Time' },
        { key: 'class', label: 'Class' },
        { key: 'planned_attendance', label: 'Planned Attendance' },
        { key: 'actual_attendance', label: 'Actual Attendance' },
        { key: 'invoice', label: 'Invoice' },
      ];
    }
    if (isStaffAttendanceView) {
      return [
        { key: 'date', label: 'Date' },
        { key: 'time', label: 'Time' },
        { key: 'class', label: 'Class' },
        { key: 'planned_attendance', label: 'Planned Attendance' },
        { key: 'actual_attendance', label: 'Actual Attendance' },
        { key: 'tutor_log', label: 'Tutor Log' },
      ];
    }
    return [
      { key: 'date', label: 'Date' },
      { key: 'time', label: 'Time' },
      { key: 'class', label: 'Class' },
      { key: 'staff', label: 'Staff' },
      { key: 'students', label: 'Students' },
      { key: 'tutor_log', label: 'Tutor Log' },
    ];
  }, [isStaffAttendanceView, isStudentAttendanceView]);

  // Reset to page 1 when search term or filters change
  useEffect(() => {
    setPage(1);
  }, [state.search, state.filters, setPage]);

  const handleSessionClick = useCallback(
    (id: string) => {
      onOpenSession?.(id);
    },
    [onOpenSession]
  );

  const handleClassClick = useCallback(
    (classId: string, e: React.MouseEvent) => {
      e.stopPropagation();
      modals.openClassModal(classId);
    },
    [modals]
  );

  const handleCopySessionId = useCallback(async (id: string, displayText: string) => {
    const sanitizedDisplay = displayText.replace(/\]/g, '');
    await navigator.clipboard.writeText(`@[session:${id}:${sanitizedDisplay}]`);
  }, []);

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
            hideSearch={_hideSearch}
            filterSearchValues={{
              student: studentFilterSearch,
              staff: staffFilterSearch,
              subject: subjectFilterSearch,
            }}
            onFilterSearchChange={(filterKey, value) => {
              if (filterKey === 'student') setStudentFilterSearch(value);
              if (filterKey === 'staff') setStaffFilterSearch(value);
              if (filterKey === 'subject') setSubjectFilterSearch(value);
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
              {state.visibleColumns.includes('staff') && !isStudentAttendanceView && !isStaffAttendanceView && <TableHead>Staff</TableHead>}
              {state.visibleColumns.includes('students') && !hideStudentsColumn && !isStudentAttendanceView && !isStaffAttendanceView && (
                <TableHead>Students</TableHead>
              )}
              {state.visibleColumns.includes('planned_attendance') && <TableHead>Planned Attendance</TableHead>}
              {state.visibleColumns.includes('actual_attendance') && <TableHead>Actual Attendance</TableHead>}
              {state.visibleColumns.includes('invoice') && <TableHead>Invoice</TableHead>}
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
                <SessionsTableRow
                  key={session.id}
                  session={session}
                  visibleColumns={state.visibleColumns}
                  classId={classId}
                  hideClassColumn={hideClassColumn}
                  hideTypeColumn={hideTypeColumn}
                  hideStudentsColumn={hideStudentsColumn}
                  hideBilling={hideBilling}
                  isStudentAttendanceView={isStudentAttendanceView}
                  isStaffAttendanceView={isStaffAttendanceView}
                  studentId={studentId}
                  staffId={staffId}
                  classesById={classesById}
                  sessionStudents={sessionStudents}
                  sessionStaff={sessionStaff}
                  tutorLogs={tutorLogs}
                  allSessions={allSessions}
                  formatDate={formatDate}
                  getTimeRange={getTimeRange}
                  getClassDisplayName={getClassDisplayName}
                  getClassShortDisplayName={getClassShortDisplayName}
                  onOpenSession={onOpenSession}
                  onOpenStudent={onOpenStudent}
                  onOpenStaff={onOpenStaff}
                  onUndoLogAbsenceStudent={onUndoLogAbsenceStudent}
                  onUndoLogAbsenceStaff={onUndoLogAbsenceStaff}
                  onRemoveStudentFromSession={onRemoveStudentFromSession}
                  onRemoveStaffFromSession={onRemoveStaffFromSession}
                  modals={modals}
                  currentStaff={currentStaff}
                  onSessionClick={handleSessionClick}
                  onClassClick={handleClassClick}
                  onCopySessionId={handleCopySessionId}
                  router={router}
                  uninvoicedSessionsStudentsIds={uninvoicedSessionsStudentsIds}
                />
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
      {modals.selectedClassId && (
        <ViewClassModal
          classId={modals.selectedClassId}
          isOpen={modals.isClassModalOpen}
          onClose={modals.closeClassModal}
          onClassUpdated={refetch}
        />
      )}

      {/* Log Session Modal */}
      {currentStaff && modals.actionSessionId && (
        <LogSessionModal
          isOpen={modals.isLogSessionModalOpen}
          onClose={modals.closeLogSessionModal}
          currentStaffId={currentStaff.id}
          adminMode={true}
          initialSessionId={modals.actionSessionId ?? undefined}
          initialSessionKind={modals.logSessionInitialKind}
        />
      )}

      {/* Log Student Absence Dialog (student attendance view) */}
      {currentStaff && modals.studentAbsenceSessionId && studentId && (
        <LogAbsenceDialog
          isOpen={modals.isLogAbsenceDialogOpen}
          onClose={modals.closeLogAbsenceDialog}
          staffId={currentStaff.id}
          initialStudentId={studentId}
          initialSessionId={modals.studentAbsenceSessionId}
          allowPastSessions={true}
        />
      )}

      {/* Edit Tutor Log Modal */}
      {modals.selectedTutorLogId && (
        <EditTutorLogDialog
          tutorLogId={modals.selectedTutorLogId}
          isOpen={modals.isEditTutorLogModalOpen}
          onClose={modals.closeEditTutorLogModal}
          onTutorLogUpdated={refetch}
        />
      )}
    </div>
  );
}
