'use client';

import { useState } from 'react';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@altitutor/ui";
import { Button } from "@altitutor/ui";
import { Input } from "@altitutor/ui";
import { Badge } from "@altitutor/ui";
import { SkeletonTable } from "@altitutor/ui";
import { Popover, PopoverContent, PopoverTrigger } from "@altitutor/ui";
import { Checkbox } from "@altitutor/ui";
import { ScrollArea } from "@altitutor/ui";
import { 
  Search, 
  ArrowUpDown,
  Check,
  X,
  Filter
} from 'lucide-react';
import type { Tables } from '@altitutor/shared';
import { cn, formatSessionType, getSessionTypeBadgeColor } from '@/shared/utils/index';
import { ViewClassModal } from '@/features/classes';
import { TutorLogAvatar } from './TutorLogAvatar';
import { DateRangePicker } from '@altitutor/ui';
import { TablePagination } from '@/shared/components/TablePagination';
import { ActionsMenu } from '@/shared/components/ActionsMenu';
import { useCurrentStaff } from '@/features/staff/hooks/useStaffQuery';
import { LogSessionModal } from '@/features/tutor-logs';
import { useRouter } from 'next/navigation';
import { BookSessionModal } from '@/features/bookings/components/BookSessionModal';
import { useSessionsTable } from '../hooks/useSessionsTable';
import { getInvoiceStatusBadgeVariant } from '../utils/sessionsTableHelpers';

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
  onFromChange?: (date: string) => void;
  onToChange?: (date: string) => void;
  onResetDates?: () => void; // Callback to reset dates to default
  hideBilling?: boolean; // Hide invoice status badges
  hideStudentFilter?: boolean; // Hide student filter UI
  hideTypeFilter?: boolean; // Hide type filter UI
  hideTutorLogFilter?: boolean; // Hide tutor log filter UI
  hideSearch?: boolean; // Hide search input
  hideTypeColumn?: boolean; // Hide Type column
  hideClassColumn?: boolean; // Hide Class column
  hideStudentsColumn?: boolean; // Hide Students column
  initialStudentFilters?: string[]; // Initial student filters (for external filter control)
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
  onFromChange,
  onToChange,
  onResetDates,
  hideBilling = false,
  hideStudentFilter = false,
  hideTypeFilter = false,
  hideTutorLogFilter = false,
  hideSearch = false,
  hideTypeColumn = false,
  hideClassColumn = false,
  hideStudentsColumn = false,
  initialStudentFilters = [],
}: SessionsTableProps) {
  const router = useRouter();
  const { data: currentStaff } = useCurrentStaff();

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
    // Filter state
    searchTerm,
    setSearchTerm,
    studentFilters,
    toggleStudentFilter,
    typeFilters,
    toggleTypeFilter,
    showLogged,
    setShowLogged,
    showUnlogged,
    setShowUnlogged,
    sortDirection,
    toggleSort,

    // Student search
    studentSearchQuery,
    setStudentSearchQuery,
    filteredStudents,

    // Pagination
    page,
    setPage,
    pageSize,
    setPageSize,

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

    // Computed
    isDefaultState,
    clearAllFilters,

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
    onResetDates,
  });

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
        <div className="flex flex-wrap items-center gap-2">
          {!hideSearch && (
            <div className="relative flex-1 min-w-[200px]">
              <Search className="absolute left-2 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search sessions..."
                className="pl-8"
                value={searchTerm}
                onChange={(e) => {
                  const value = e.target.value;
                  setSearchTerm(value);
                }}
              />
            </div>
          )}
          
          <div className="flex flex-wrap items-center gap-2 justify-between">
            <div className="flex flex-wrap items-center gap-2">
              {/* Clear Filters */}
              {!isDefaultState && (
                <Button 
                  variant="ghost" 
                  size="sm" 
                  onClick={clearAllFilters}
                >
                  <X className="h-4 w-4 mr-2" />
                  Clear
                </Button>
              )}
              
              {/* Student Filter */}
              {!hideStudentFilter && (
              <Popover>
                <PopoverTrigger asChild>
                  <Button 
                    variant={studentFilters.length > 0 ? "secondary" : "outline"} 
                    size="sm"
                  >
                    <Filter className="h-4 w-4 mr-2" />
                    Student {studentFilters.length > 0 && `(${studentFilters.length})`}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="p-0 w-[400px]" align="end">
                  <div className="p-3">
                    <Input
                      placeholder="Search students..."
                      value={studentSearchQuery}
                      onChange={(e) => setStudentSearchQuery(e.target.value)}
                      className="mb-3"
                    />
                    <ScrollArea className="h-[300px]">
                      <div className="space-y-1 pr-4">
                        {filteredStudents.length === 0 ? (
                          <div className="p-3 text-center text-sm text-muted-foreground">
                            {studentSearchQuery
                              ? 'No students match your search'
                              : 'No students found'}
                          </div>
                        ) : (
                          filteredStudents.map((student) => (
                            <label
                              key={student.id}
                              className="flex items-center gap-2 cursor-pointer p-2 hover:bg-muted rounded"
                            >
                              <Checkbox
                                checked={studentFilters.includes(student.id)}
                                onCheckedChange={() => toggleStudentFilter(student.id)}
                              />
                              <div className="flex flex-col items-start flex-1">
                                <div className="font-medium text-sm">
                                  {student.first_name} {student.last_name}
                                </div>
                                {student.school && (
                                  <div className="text-xs text-muted-foreground">
                                    {student.school}
                                  </div>
                                )}
                              </div>
                            </label>
                          ))
                        )}
                      </div>
                    </ScrollArea>
                  </div>
                </PopoverContent>
              </Popover>
              )}

              {/* Session Type Filter */}
              {!hideTypeFilter && (
              <Popover>
                <PopoverTrigger asChild>
                  <Button 
                    variant={typeFilters.length > 0 ? "secondary" : "outline"} 
                    size="sm"
                  >
                    <Filter className="h-4 w-4 mr-2" />
                    Type {typeFilters.length > 0 && `(${typeFilters.length})`}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-56" align="end">
                  <div className="space-y-2">
                    <div className="font-medium text-sm mb-2">Session Type</div>
                    {SESSION_TYPES.map((type) => (
                      <label key={type} className="flex items-center gap-2 cursor-pointer">
                        <Checkbox
                          checked={typeFilters.includes(type)}
                          onCheckedChange={() => toggleTypeFilter(type)}
                        />
                        <span className="text-sm">{formatSessionType(type)}</span>
                      </label>
                    ))}
                  </div>
                </PopoverContent>
              </Popover>
              )}

              {/* Tutor Log Filter */}
              {!hideTutorLogFilter && (
                <Popover>
                  <PopoverTrigger asChild>
                    <Button 
                      variant={!showLogged || !showUnlogged ? "secondary" : "outline"} 
                      size="sm"
                    >
                      <Filter className="h-4 w-4 mr-2" />
                      Tutor Log
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-56" align="end">
                    <div className="space-y-2">
                      <div className="font-medium text-sm mb-2">Tutor Log</div>
                      <label className="flex items-center gap-2 cursor-pointer">
                        <Checkbox
                          checked={showLogged}
                          onCheckedChange={(checked) => setShowLogged(checked === true)}
                        />
                        <span className="text-sm">Tutor log</span>
                      </label>
                      <label className="flex items-center gap-2 cursor-pointer">
                        <Checkbox
                          checked={showUnlogged}
                          onCheckedChange={(checked) => setShowUnlogged(checked === true)}
                        />
                        <span className="text-sm">Unlogged</span>
                      </label>
                    </div>
                  </PopoverContent>
                </Popover>
              )}
            </div>

            {/* Date Range Filter - Right aligned */}
            {onFromChange && onToChange && (
              <div className="ml-auto">
                <DateRangePicker
                  from={rangeStart || ''}
                  to={rangeEnd || ''}
                  onFromChange={onFromChange}
                  onToChange={onToChange}
                />
              </div>
            )}
          </div>
        </div>
      )}

      <div className="rounded-md border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="cursor-pointer" onClick={toggleSort}>
                Date
                <ArrowUpDown className="ml-2 h-4 w-4 inline opacity-100" />
              </TableHead>
              <TableHead>Time</TableHead>
              {!hideTypeColumn && (
                <TableHead>
                  Type
                </TableHead>
              )}
              {!classId && !hideClassColumn && (
                <TableHead>Class</TableHead>
              )}
              <TableHead>Staff</TableHead>
              {!hideStudentsColumn && (
                <TableHead>Students</TableHead>
              )}
              <TableHead>Tutor Log</TableHead>
              <TableHead></TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {paginatedSessions.length === 0 ? (
              <TableRow>
                <TableCell colSpan={
                  5 + 
                  (!hideTypeColumn ? 1 : 0) + 
                  (!classId && !hideClassColumn ? 1 : 0) + 
                  (!hideStudentsColumn ? 1 : 0)
                } className="text-center h-24">
                  {searchTerm || studentFilters.length > 0 || typeFilters.length > 0
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
                  {!hideTypeColumn && (
                    <TableCell>
                      <Badge className={getSessionTypeBadgeColor(session.type)}>
                        {formatSessionType(session.type)}
                      </Badge>
                    </TableCell>
                  )}
                  {!classId && !hideClassColumn && (
                  <TableCell>
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
                        return <span className="text-muted-foreground text-sm">-</span>;
                      })() : (
                        <span className="text-muted-foreground text-sm">-</span>
                      )}
                    </TableCell>
                  )}
                  <TableCell>
                    {(() => {
                      const staffList: any[] = (sessionStaff[session.id] || []) as any[];
                      if (!staffList.length) return <span className="text-muted-foreground text-sm">-</span>;
                      return (
                        <div className="flex flex-col gap-1">
                          {staffList.map((s) => {
                            const plannedAbsence = s.planned_absence === true;
                            const actualAttended = s.actual_attended;
                            const nameClass = plannedAbsence 
                              ? "text-muted-foreground line-through" 
                              : "";
                            
                            return (
                              <div key={s.id} className="flex items-center gap-1">
                                <Button
                                  variant="link"
                                  size="sm"
                                  className={cn("h-auto p-0 text-xs justify-start", nameClass)}
                                  onClick={(e) => { e.stopPropagation(); (onOpenStaff as any)?.(s.id); }}
                                >
                                  {s.first_name} {s.last_name}
                                </Button>
                                {actualAttended !== null && (
                                  actualAttended ? (
                                    <Check className="h-3 w-3 text-green-600 flex-shrink-0" />
                                  ) : (
                                    <X className="h-3 w-3 text-red-600 flex-shrink-0" />
                                  )
                                )}
                              </div>
                            );
                          })}
                        </div>
                      );
                    })()}
                  </TableCell>
                  {!hideStudentsColumn && (
                    <TableCell>
                      {(() => {
                        const studentList: any[] = (sessionStudents[session.id] || []) as any[];
                        if (!studentList.length) return <span className="text-muted-foreground text-sm">-</span>;
                        
                        return (
                          <div className="flex flex-col gap-1">
                            {studentList.map((s) => {
                              const plannedAbsence = s.planned_absence === true;
                              const actualAttended = s.actual_attended;
                              const invoiceStatus = s.invoice_status;
                              const isExtra = s.is_extra === true;
                              const nameClass = plannedAbsence 
                                ? "text-muted-foreground line-through" 
                                : isExtra
                                ? "text-orange-600 dark:text-orange-400"
                                : "";
                              
                              const badgeInfo = getInvoiceStatusBadgeVariant(invoiceStatus);
                              
                              return (
                                <div key={s.id} className="flex items-center gap-1 flex-wrap">
                                  <Button
                                    variant="link"
                                    size="sm"
                                    className={cn("h-auto p-0 text-xs justify-start", nameClass)}
                                    onClick={(e) => { e.stopPropagation(); (onOpenStudent as any)?.(s.id); }}
                                  >
                                    {s.first_name} {s.last_name}
                                  </Button>
                                  {actualAttended !== null && (
                                    actualAttended ? (
                                      <Check className="h-3 w-3 text-green-600 flex-shrink-0" />
                                    ) : (
                                      <X className="h-3 w-3 text-red-600 flex-shrink-0" />
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
                    {(() => {
                      const sessionCanReschedule = canReschedule(session);
                      const rescheduleStudentId = getRescheduleStudentId(session.id);
                      
                      return (
                        <ActionsMenu
                          type="session"
                          onOpenInPage={() => {
                            router.push(`/sessions/${session.id}`);
                          }}
                          onLogSession={() => {
                            setActionSessionId(session.id);
                            setIsLogSessionModalOpen(true);
                          }}
                          hasTutorLog={!!tutorLogs[session.id]}
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
          page={page}
          pageSize={pageSize}
          total={filteredSessions.length}
          isFetching={isFetching}
          onPageChange={(newPage) => {
            setPage(newPage);
          }}
          onPageSizeChange={(newSize) => {
            setPageSize(newSize);
            setPage(1);
          }}
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
    </div>
  );
} 