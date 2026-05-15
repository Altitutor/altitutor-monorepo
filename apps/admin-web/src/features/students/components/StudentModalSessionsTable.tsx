'use client';

import { useState, useMemo } from 'react';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@altitutor/ui';
import { Button } from '@altitutor/ui';
import { Badge } from '@altitutor/ui';
import { SkeletonTable } from '@altitutor/ui';
import { ArrowUpDown } from 'lucide-react';
import { formatSessionType, getSessionTypeBadgeColor } from '@/shared/utils/index';
import { cn } from '@/shared/utils/index';
import { DateRangePicker } from '@altitutor/ui';
import { TablePagination } from '@/shared/components/TablePagination';
import { useCurrentStaff } from '@/shared/hooks';
import { useSessionsTable } from '@/features/sessions/hooks/useSessionsTable';
import { useDataTable } from '@/shared/hooks/useDataTable';
import { getInvoiceStatusBadge } from '@/features/billing/utils/invoiceFormatters';
import { AttendanceCell } from '@/features/sessions/components/AttendanceCell';
import { processStudentSessionData } from '@/features/sessions/utils/modalSessionProcessing';
import { openAdminInvoiceModal } from '@/features/sessions/utils/openAdminInvoiceModal';
import { LogAbsenceDialog } from '@/features/sessions/components/absences/LogAbsenceDialog';
import { ViewClassModal } from '@/features/classes';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  useToast,
} from '@altitutor/ui';
import { MoreVertical, ExternalLink, Calendar, Copy } from 'lucide-react';
import { createTagMarker } from '@/shared/utils/tagParsing';

type StudentModalSessionsTableProps = {
  studentId: string;
  rangeStart?: string;
  rangeEnd?: string;
  onFromChange?: (date: string) => void;
  onToChange?: (date: string) => void;
  onResetDates?: () => void;
  onOpenSession?: (id: string) => void;
};

export function StudentModalSessionsTable({
  studentId,
  rangeStart,
  rangeEnd,
  onFromChange,
  onToChange,
  onResetDates,
  onOpenSession,
}: StudentModalSessionsTableProps) {
  const { toast } = useToast();
  const { data: currentStaff } = useCurrentStaff();
  const [actionSessionId, setActionSessionId] = useState<string | null>(null);
  const [isLogAbsenceDialogOpen, setIsLogAbsenceDialogOpen] = useState(false);
  const [selectedClassId, setSelectedClassId] = useState<string | null>(null);
  const [isClassModalOpen, setIsClassModalOpen] = useState(false);

  const {
    state,
    setSort,
    setPage,
    setPageSize,
  } = useDataTable({
    defaultSort: { field: 'start_at', direction: 'desc' },
    pageSize: 50,
    skipUrlSync: true,
  });

  const {
    allSessions,
    filteredSessions,
    paginatedSessions,
    classesById,
    sessionStudents,
    tutorLogs,
    isLoading,
    error,
    isFetching,
    refetch,
    formatDate,
    getTimeRange,
    getClassDisplayName,
    getClassShortDisplayName,
  } = useSessionsTable({
    studentId,
    rangeStart,
    rangeEnd,
    hideStudentFilter: true,
    onResetDates,
    state,
  });

  // Process sessions with student-specific attendance data
  const processedSessions = useMemo(() => {
    return paginatedSessions
      .map((session) => {
        const studentData = sessionStudents[session.id] || [];
        const hasTutorLog = !!tutorLogs[session.id];
        const processed = processStudentSessionData(
          session,
          studentData,
          studentId,
          hasTutorLog
        );
        return processed;
      })
      .filter((p): p is NonNullable<typeof p> => p !== null);
  }, [paginatedSessions, sessionStudents, studentId, tutorLogs]);

  const handleSessionClick = (id: string) => {
    if (onOpenSession) onOpenSession(id);
  };

  const handleClassClick = (classId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    setSelectedClassId(classId);
    setIsClassModalOpen(true);
  };

  const handleCopySessionId = async (sessionId: string, displayText: string) => {
    try {
      await navigator.clipboard.writeText(createTagMarker('session', sessionId, displayText || sessionId));
      toast({
        title: 'Copied ID',
        description: 'Copied taggable ID to clipboard',
      });
    } catch {
      toast({
        title: 'Failed to copy',
        description: 'Please try again',
        variant: 'destructive',
      });
    }
  };

  // Loading state
  if (isLoading && allSessions.length === 0) {
    return (
      <div className="space-y-4">
        <SkeletonTable rows={8} columns={7} />
        <div className="text-sm text-muted-foreground">Loading sessions...</div>
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
      <div className="flex flex-wrap items-center gap-2 justify-between">
        <div className="flex flex-wrap items-center gap-2">
          {/* Date Range Filter */}
          {onFromChange && onToChange && (
            <DateRangePicker
              from={rangeStart || ''}
              to={rangeEnd || ''}
              onFromChange={onFromChange}
              onToChange={onToChange}
            />
          )}
        </div>
      </div>

      <div className="rounded-md border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead 
                className="cursor-pointer" 
                onClick={() => setSort('start_at', state.sortBy === 'start_at' && state.sortDirection === 'asc' ? 'desc' : 'asc')}
              >
                Date
                <ArrowUpDown className={cn(
                  "ml-2 h-4 w-4 inline",
                  state.sortBy === 'start_at' ? "opacity-100" : "opacity-40"
                )} />
              </TableHead>
              <TableHead>Time</TableHead>
              <TableHead>Class</TableHead>
              <TableHead>Planned Attendance</TableHead>
              <TableHead>Actual Attendance</TableHead>
              <TableHead>Invoice</TableHead>
              <TableHead></TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {processedSessions.length === 0 ? (
              <TableRow>
                <TableCell colSpan={7} className="text-center h-24">
                  {state.search ? 'No sessions match your search' : 'No sessions found'}
                </TableCell>
              </TableRow>
            ) : (
              processedSessions.map((processed) => {
                const session = processed.session;
                return (
                  <TableRow
                    key={session.id}
                    className="cursor-pointer hover:bg-muted/50"
                    onClick={() => handleSessionClick(session.id)}
                  >
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
                    <TableCell className="font-medium">{getTimeRange(session)}</TableCell>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <Badge className={getSessionTypeBadgeColor(session.type)}>
                          {formatSessionType(session.type)}
                        </Badge>
                        {session.class_id ? (() => {
                          const cls = classesById[session.class_id];
                          const shortDisplay = getClassShortDisplayName(session);
                          const fullDisplay = getClassDisplayName(session);
                          if (cls) {
                            return (
                              <Button
                                variant="link"
                                size="sm"
                                className="h-auto p-0 text-xs justify-start whitespace-nowrap font-medium"
                                onClick={(e) => handleClassClick(session.class_id!, e)}
                                title={fullDisplay || 'Class'}
                              >
                                <span className="2xl:hidden">{shortDisplay || 'Class'}</span>
                                <span className="hidden 2xl:inline">{fullDisplay || 'Class'}</span>
                              </Button>
                            );
                          }
                          return null;
                        })() : null}
                      </div>
                    </TableCell>
                    <TableCell>
                      <AttendanceCell
                        status={processed.plannedStatus}
                        linkTo={
                          processed.plannedStatus === 'rescheduled' && processed.rescheduledSessionId
                            ? {
                                type: 'session',
                                id: processed.rescheduledSessionId,
                                onClick: () =>
                                  processed.rescheduledSessionId && handleSessionClick(processed.rescheduledSessionId),
                              }
                            : undefined
                        }
                        linkText={
                          processed.plannedStatus === 'rescheduled'
                            ? processed.rescheduledDate
                            : processed.plannedStatus === 'credited' && processed.creditedDisplayDate
                              ? processed.creditedDisplayDate
                              : undefined
                        }
                      />
                    </TableCell>
                    <TableCell>
                      <AttendanceCell status={processed.actualStatus} />
                    </TableCell>
                    <TableCell>
                      {(() => {
                        const badge = getInvoiceStatusBadge(processed.invoiceStatus, {
                          onOpenInvoice: openAdminInvoiceModal,
                        });
                        if (!badge) {
                          return <span className="text-xs text-muted-foreground">-</span>;
                        }
                        return badge;
                      })()}
                    </TableCell>
                    <TableCell onClick={(e) => e.stopPropagation()}>
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="outline" size="icon" className="shrink-0">
                            <MoreVertical className="h-4 w-4" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuItem onClick={() => {
                            window.location.href = `/sessions/${session.id}`;
                          }}>
                            <ExternalLink className="h-4 w-4 mr-2" />
                            Open in page
                          </DropdownMenuItem>
                          <DropdownMenuItem onClick={() => handleCopySessionId(session.id, getClassShortDisplayName(session) || session.id)}>
                            <Copy className="h-4 w-4 mr-2" />
                            Copy ID
                          </DropdownMenuItem>
                          {!processed.invoiceStatus && !tutorLogs[session.id] && processed.plannedStatus !== 'absent' && processed.plannedStatus !== 'rescheduled' && processed.plannedStatus !== 'credited' && (
                            <DropdownMenuItem onClick={() => {
                              setActionSessionId(session.id);
                              setIsLogAbsenceDialogOpen(true);
                            }}>
                              <Calendar className="h-4 w-4 mr-2" />
                              Log student absence
                            </DropdownMenuItem>
                          )}
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </TableCell>
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
        total={filteredSessions.length}
        isFetching={isFetching}
        onPageChange={setPage}
        onPageSizeChange={setPageSize}
      />

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
            refetch();
          }}
        />
      )}

      {/* Log Student Absence Dialog */}
      {currentStaff && actionSessionId && (
        <LogAbsenceDialog
          isOpen={isLogAbsenceDialogOpen}
          onClose={async () => {
            setIsLogAbsenceDialogOpen(false);
            setActionSessionId(null);
            await refetch();
          }}
          staffId={currentStaff.id}
          initialStudentId={studentId}
          initialSessionId={actionSessionId}
          allowPastSessions={true}
        />
      )}
    </div>
  );
}
