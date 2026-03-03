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
import { AttendanceCell } from '@/features/sessions/components/AttendanceCell';
import { processStaffSessionData } from '@/features/sessions/utils/modalSessionProcessing';
import { LogStaffAbsenceDialog } from '@/features/sessions/components/absences/LogStaffAbsenceDialog';
import { ViewClassModal } from '@/features/classes';
import { TutorLogAvatar } from '@/features/sessions/components/TutorLogAvatar';
import { LogSessionModal } from '@/features/tutor-logs/components/LogSessionModal';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  useToast,
} from '@altitutor/ui';
import { MoreVertical, ExternalLink, Calendar, FileText, Copy } from 'lucide-react';
import { createTagMarker } from '@/shared/utils/tagParsing';

type StaffModalSessionsTableProps = {
  staffId: string;
  rangeStart?: string;
  rangeEnd?: string;
  onFromChange?: (date: string) => void;
  onToChange?: (date: string) => void;
  onResetDates?: () => void;
  onOpenSession?: (id: string) => void;
};

export function StaffModalSessionsTable({
  staffId,
  rangeStart,
  rangeEnd,
  onFromChange,
  onToChange,
  onResetDates,
  onOpenSession,
}: StaffModalSessionsTableProps) {
  const { toast } = useToast();
  const { data: currentStaff } = useCurrentStaff();
  const [actionSessionId, setActionSessionId] = useState<string | null>(null);
  const [isLogAbsenceDialogOpen, setIsLogAbsenceDialogOpen] = useState(false);
  const [selectedClassId, setSelectedClassId] = useState<string | null>(null);
  const [isClassModalOpen, setIsClassModalOpen] = useState(false);
  const [logSessionId, setLogSessionId] = useState<string | null>(null);
  const [isLogSessionModalOpen, setIsLogSessionModalOpen] = useState(false);

  const { state, setSort, setPage, setPageSize } = useDataTable({
    defaultSort: { field: 'start_at', direction: 'desc' },
    pageSize: 50,
    skipUrlSync: true,
  });

  const {
    allSessions,
    filteredSessions,
    paginatedSessions,
    classesById,
    sessionStaff,
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
    staffId,
    rangeStart,
    rangeEnd,
    hideStudentFilter: true,
    onResetDates,
    state,
  });

  // Process sessions with staff-specific attendance data
  const processedSessions = useMemo(() => {
    return paginatedSessions
      .map((session) => {
        const staffData = sessionStaff[session.id] || [];
        const hasTutorLog = !!tutorLogs[session.id];
        const tutorLogCreatedBy = tutorLogs[session.id]?.created_by;
        const processed = processStaffSessionData(
          session,
          staffData,
          staffId,
          hasTutorLog,
          tutorLogCreatedBy
        );
        return processed;
      })
      .filter((p): p is NonNullable<typeof p> => p !== null);
  }, [paginatedSessions, sessionStaff, staffId, tutorLogs]);

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
              <TableHead>Tutor Log</TableHead>
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
                      <AttendanceCell status={processed.plannedStatus} />
                    </TableCell>
                    <TableCell>
                      <AttendanceCell status={processed.actualStatus} />
                    </TableCell>
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
                          {!tutorLogs[session.id] && (
                            <DropdownMenuItem onClick={() => {
                              setLogSessionId(session.id);
                              setIsLogSessionModalOpen(true);
                            }}>
                              <FileText className="h-4 w-4 mr-2" />
                              Log session
                            </DropdownMenuItem>
                          )}
                          {!tutorLogs[session.id] && processed.plannedStatus !== 'absent' && processed.plannedStatus !== 'swapped' && (
                            <DropdownMenuItem onClick={() => {
                              setActionSessionId(session.id);
                              setIsLogAbsenceDialogOpen(true);
                            }}>
                              <Calendar className="h-4 w-4 mr-2" />
                              Log staff absence
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

      {/* Log Staff Absence Dialog */}
      {currentStaff && actionSessionId && (
        <LogStaffAbsenceDialog
          isOpen={isLogAbsenceDialogOpen}
          onClose={async () => {
            setIsLogAbsenceDialogOpen(false);
            setActionSessionId(null);
            await refetch();
          }}
          staffId={currentStaff.id}
          initialStaffId={staffId}
          initialSessionId={actionSessionId}
          allowPastSessions={true}
        />
      )}

      {/* Log Session Modal */}
      {currentStaff && logSessionId && (
        <LogSessionModal
          isOpen={isLogSessionModalOpen}
          onClose={async () => {
            setIsLogSessionModalOpen(false);
            setLogSessionId(null);
            await refetch();
          }}
          currentStaffId={currentStaff.id}
          adminMode={true}
          initialSessionId={logSessionId}
          initialStaffId={staffId}
        />
      )}
    </div>
  );
}
