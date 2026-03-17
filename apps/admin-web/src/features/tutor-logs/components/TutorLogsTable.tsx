'use client';

import React, { useState, useMemo } from 'react';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
  Badge,
  SkeletonTable,
  DataTableToolbar,
  TablePagination,
  Input,
} from "@altitutor/ui";
import { ArrowUpDown, Search } from 'lucide-react';
import type { DataTableFilterDefinition, DataTableSortOption, DataTableColumnDefinition } from '@altitutor/shared';
import { cn, formatSessionType, getSessionTypeBadgeColor } from '@/shared/utils/index';
import { useCurrentStaff } from '@/shared/hooks';
import { useTutorLogsTable } from '../hooks/useTutorLogsTable';
import { useDataTable } from '@/shared/hooks/useDataTable';
import { useQuickFilters } from '@/features/quick-filters/hooks/useQuickFilters';
import { EditTutorLogDialog } from './EditTutorLogDialog';
import { formatClassDisplayName } from '../utils/tutorLogsTableHelpers';

type TutorLogsTableProps = {
  rangeStart?: string; // YYYY-MM-DD
  rangeEnd?: string;   // YYYY-MM-DD
  onOpenSession?: (id: string) => void;
  onOpenStaff?: (id: string) => void;
};

export function TutorLogsTable({
  rangeStart,
  rangeEnd,
  onOpenSession: _onOpenSession,
  onOpenStaff: _onOpenStaff,
}: TutorLogsTableProps) {
  const { data: currentStaff } = useCurrentStaff();
  const { data: quickFilters = [] } = useQuickFilters('tutor_logs');

  const defaultFilters = useMemo(() => ({}), []);
  const defaultSort = useMemo(() => ({ field: 'session_start_at', direction: 'desc' as const }), []);
  const defaultVisibleColumns = useMemo(() => ['date', 'class', 'staff', 'students', 'topics'], []);
  const [staffFilterSearch, setStaffFilterSearch] = useState('');
  const [studentFilterSearch, setStudentFilterSearch] = useState('');

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
    filterKeys: ['staff', 'student', 'from', 'to'],
  });

  const {
    sessions,
    classesById,
    subjectsById,
    staffAttendance,
    studentAttendance,
    topics,
    filteredStaff,
    filteredStudents,
    filteredTutorLogs,
    paginatedTutorLogs,
    isLoading,
    isFetching,
    error,
    refetch,
  } = useTutorLogsTable({
    rangeStart,
    rangeEnd,
    staffSearchQuery: staffFilterSearch,
    studentSearchQuery: studentFilterSearch,
    state,
  });

  const filterDefinitions: DataTableFilterDefinition[] = useMemo(() => [
    {
      key: 'staff',
      label: 'Staff',
      options: filteredStaff.map(s => ({ label: `${s.first_name} ${s.last_name}`, value: s.id })),
      searchable: true,
      searchPlaceholder: 'Search staff...',
    },
    {
      key: 'student',
      label: 'Student',
      options: filteredStudents.map(s => ({ label: `${s.first_name} ${s.last_name}`, value: s.id })),
      searchable: true,
      searchPlaceholder: 'Search students...',
    },
    {
      key: 'date',
      label: 'Date',
      type: 'date-range',
      fromKey: 'from',
      toKey: 'to',
    },
  ], [filteredStaff, filteredStudents]);

  const sortOptions: DataTableSortOption[] = [
    { key: 'session_start_at', label: 'Session Date' },
  ];

  const columnDefinitions: DataTableColumnDefinition[] = [
    { key: 'date', label: 'Session Date' },
    { key: 'class', label: 'Class' },
    { key: 'staff', label: 'Staff' },
    { key: 'students', label: 'Students' },
    { key: 'topics', label: 'Topics' },
  ];

  const [selectedTutorLogId, setSelectedTutorLogId] = useState<string | null>(null);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);

  const handleRowClick = (tutorLogId: string) => {
    setSelectedTutorLogId(tutorLogId);
    setIsEditModalOpen(true);
  };

  if (isLoading && filteredTutorLogs.length === 0) {
    return (
      <div className="space-y-4">
        <div className="flex flex-col gap-2">
          <div className="relative w-64">
            <Search className="absolute left-2 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input placeholder="Search tutor logs..." className="pl-8" disabled />
          </div>
        </div>
        <SkeletonTable rows={8} columns={5} />
        <div className="text-sm text-muted-foreground">Loading tutor logs...</div>
      </div>
    );
  }

  if (error && filteredTutorLogs.length === 0) {
    return (
      <div className="text-red-500 p-4">
        Failed to load tutor logs. Please try again.
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
            staff: staffFilterSearch,
            student: studentFilterSearch,
          }}
          onFilterSearchChange={(filterKey, value) => {
            if (filterKey === 'staff') setStaffFilterSearch(value);
            if (filterKey === 'student') setStudentFilterSearch(value);
          }}
          searchPlaceholder="Search tutor logs..."
          isLoading={isFetching}
        />
      </div>

      <div className="rounded-md border">
        <Table>
          <TableHeader>
            <TableRow>
              {state.visibleColumns.includes('date') && (
                <TableHead 
                  className="cursor-pointer" 
                  onClick={() => setSort('session_start_at', state.sortBy === 'session_start_at' && state.sortDirection === 'asc' ? 'desc' : 'asc')}
                >
                  Session Date
                  <ArrowUpDown className={cn(
                    "ml-2 h-4 w-4 inline",
                    state.sortBy === 'session_start_at' ? "opacity-100" : "opacity-40"
                  )} />
                </TableHead>
              )}
              {state.visibleColumns.includes('class') && <TableHead>Class</TableHead>}
              {state.visibleColumns.includes('staff') && <TableHead>Staff</TableHead>}
              {state.visibleColumns.includes('students') && <TableHead>Students</TableHead>}
              {state.visibleColumns.includes('topics') && <TableHead>Topics</TableHead>}
            </TableRow>
          </TableHeader>
          <TableBody>
            {paginatedTutorLogs.length === 0 ? (
              <TableRow>
                <TableCell colSpan={state.visibleColumns.length} className="text-center h-24">
                  {state.search || Object.keys(state.filters).length > 0
                    ? "No tutor logs match your filters"
                    : "No tutor logs found"}
                </TableCell>
              </TableRow>
            ) : (
              paginatedTutorLogs.map((log) => {
                const session = sessions[log.session_id];
                const staffAtt = staffAttendance[log.id] || [];
                const studentAtt = studentAttendance[log.id] || [];
                const logTopics = topics[log.id] || [];
                
                return (
                  <TableRow 
                    key={log.id} 
                    className="cursor-pointer hover:bg-muted/50"
                    onClick={() => handleRowClick(log.id)}
                  >
                    {state.visibleColumns.includes('date') && (
                      <TableCell>
                        <div className="flex flex-col">
                          <span className="font-medium">
                            {session?.start_at ? new Date(session.start_at).toLocaleDateString('en-AU', {
                              day: '2-digit',
                              month: '2-digit',
                              year: '2-digit',
                            }) : '-'}
                          </span>
                          <span className="text-xs text-muted-foreground">
                            {session?.start_at ? new Date(session.start_at).toLocaleTimeString('en-AU', {
                              hour: '2-digit',
                              minute: '2-digit',
                            }) : '-'}
                          </span>
                        </div>
                      </TableCell>
                    )}
                    {state.visibleColumns.includes('class') && (
                      <TableCell>
                        <div className="flex items-center gap-2">
                          <Badge className={session?.class_id ? getSessionTypeBadgeColor(session.type) : session?.type === 'ADMIN_SHIFT' ? getSessionTypeBadgeColor('ADMIN_SHIFT') : getSessionTypeBadgeColor(null)}>
                            {session?.class_id ? formatSessionType(session?.type) : session?.type === 'ADMIN_SHIFT' ? 'Admin Shift' : 'Meeting'}
                          </Badge>
                          {session?.class_id ? (
                            <span className="text-sm font-medium">
                              {formatClassDisplayName(session.class_id, classesById, subjectsById)}
                            </span>
                          ) : session?.type !== 'ADMIN_SHIFT' && formatSessionType(session?.type) !== 'Meeting' ? (
                            <span className="text-sm font-medium">
                              {formatSessionType(session?.type)}
                            </span>
                          ) : null}
                        </div>
                      </TableCell>
                    )}
                    {state.visibleColumns.includes('staff') && (
                      <TableCell>
                        <div className="flex flex-wrap gap-1">
                          {staffAtt.map((att) => (
                            <Badge key={att.staff_id} variant="secondary" className="text-xs">
                              {att.first_name} {att.last_name}
                            </Badge>
                          ))}
                        </div>
                      </TableCell>
                    )}
                    {state.visibleColumns.includes('students') && (
                      <TableCell>
                        <div className="flex flex-wrap gap-1">
                          {studentAtt.map((att) => (
                            <Badge 
                              key={att.student_id} 
                              variant={att.attended ? "default" : "destructive"} 
                              className="text-xs"
                            >
                              {att.first_name} {att.last_name}
                            </Badge>
                          ))}
                        </div>
                      </TableCell>
                    )}
                    {state.visibleColumns.includes('topics') && (
                      <TableCell>
                        <div className="flex flex-wrap gap-1">
                          {logTopics.map((topic) => (
                            <Badge key={topic.topic_id} variant="outline" className="text-xs">
                              {topic.code}
                            </Badge>
                          ))}
                        </div>
                      </TableCell>
                    )}
                  </TableRow>
                );
              })
            )}
          </TableBody>
        </Table>
      </div>

      <TablePagination
        page={state.page}
        pageSize={state.pageSize}
        total={filteredTutorLogs.length}
        isFetching={isFetching}
        onPageChange={setPage}
        onPageSizeChange={setPageSize}
      />

      {selectedTutorLogId && (
        <EditTutorLogDialog
          tutorLogId={selectedTutorLogId}
          isOpen={isEditModalOpen}
          onClose={() => {
            setIsEditModalOpen(false);
            setSelectedTutorLogId(null);
          }}
          onTutorLogUpdated={refetch}
        />
      )}
    </div>
  );
}
