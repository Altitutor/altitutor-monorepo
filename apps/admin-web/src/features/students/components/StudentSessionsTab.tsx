'use client';

import { useState, useMemo, useCallback, useEffect } from 'react';
import type { Tables } from '@altitutor/shared';
import { 
  Table, 
  TableBody, 
  TableCell, 
  TableHead, 
  TableHeader, 
  TableRow,
  Badge,
  Button,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
  SkeletonTable,
  Tabs,
  TabsList,
  TabsTrigger,
} from '@altitutor/ui';
import { useSessionsWithDetails } from '@/features/sessions/hooks/useSessionsQuery';
import { useStudentClasses } from '../hooks/useStudentClasses';
import { TablePagination } from '@/shared/components/TablePagination';
import { ViewClassModal } from '@/features/classes';
import { cn, formatSessionType, getSessionTypeBadgeColor } from '@/shared/utils';
import { CalendarIcon, Check, X, ArrowUpDown } from 'lucide-react';
import { StudentSessionsCalendarView } from './StudentSessionsCalendarView';
import { DateRangePicker } from '@altitutor/ui';

interface StudentSessionsTabProps {
  student: Tables<'students'>;
}

// Get today's date in local timezone (YYYY-MM-DD format)
const getTodayLocalDate = (): string => {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const day = String(now.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
};

export function StudentSessionsTab({ student }: StudentSessionsTabProps) {
  // View mode state
  const [viewMode, setViewMode] = useState<'table' | 'calendar'>('table');

  // Pagination state
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(50);

  // Filter state - default: both dates today
  const today = getTodayLocalDate();
  const [dateRangeStart, setDateRangeStart] = useState<string>(today);
  const [dateRangeEnd, setDateRangeEnd] = useState<string>(today);
  const [selectedClassId, setSelectedClassId] = useState<string>('ALL');

  // Sort state
  type SortField = 'start_at' | 'type';
  const [sortField, setSortField] = useState<SortField>('start_at');
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('desc');

  // Modal state
  const [isClassModalOpen, setIsClassModalOpen] = useState(false);
  const [viewingClassId, setViewingClassId] = useState<string | null>(null);

  // Get student classes for filter
  const { data: studentClassesData = [] } = useStudentClasses(student.id);

  // Prepare date range for API (YYYY-MM-DD format)
  const rangeStart = dateRangeStart || undefined;
  const rangeEnd = dateRangeEnd || undefined;
  const classId = selectedClassId !== 'ALL' ? selectedClassId : undefined;

  // Fetch sessions using RPC
  const { 
    data, 
    isLoading, 
    error, 
    refetch,
    isFetching 
  } = useSessionsWithDetails({ 
    rangeStart,
    rangeEnd,
    studentId: student.id,
    classId,
    includeInactive: false,
    orderBy: sortField === 'start_at' ? 'start_at' : 'type',
    ascending: sortDirection === 'asc',
  });

  // Extract data from response
  type SessionData = {
    sessions?: Tables<'sessions'>[];
    classesById?: Record<string, Tables<'classes'>>;
    subjectsById?: Record<string, Tables<'subjects'>>;
    sessionStudents?: Record<string, Array<Tables<'students'> & { planned_absence?: boolean; actual_attended?: boolean | null; invoice_status?: string | null; sessions_students_id?: string; is_extra?: boolean }>>;
    sessionStaff?: Record<string, Array<Tables<'staff'> & { planned_absence?: boolean; actual_attended?: boolean | null; is_swapped_in?: boolean }>>;
  };
  const sessionData = (data as unknown as SessionData) || {};
  const allSessions: Tables<'sessions'>[] = (sessionData.sessions as Tables<'sessions'>[]) || [];
  const classesById: Record<string, Tables<'classes'>> = sessionData.classesById || {};
  const subjectsById: Record<string, Tables<'subjects'>> = sessionData.subjectsById || {};
  const sessionStudents: Record<string, Array<Tables<'students'> & { planned_absence?: boolean; actual_attended?: boolean | null; invoice_status?: string | null; sessions_students_id?: string; is_extra?: boolean }>> = sessionData.sessionStudents || {};
  const sessionStaff: Record<string, Array<Tables<'staff'> & { planned_absence?: boolean; actual_attended?: boolean | null; is_swapped_in?: boolean }>> = sessionData.sessionStaff || {};

  // Client-side pagination
  const totalSessions = allSessions.length;
  const paginatedSessions = useMemo(() => {
    const start = (page - 1) * pageSize;
    const end = start + pageSize;
    return allSessions.slice(start, end);
  }, [allSessions, page, pageSize]);

  // Reset to page 1 when filters change
  useEffect(() => {
    setPage(1);
  }, [dateRangeStart, dateRangeEnd, selectedClassId]);

  // Helper functions
  const getClassShortDisplay = useCallback((session: Tables<'sessions'>) => {
    const cls = session.class_id ? classesById[session.class_id] : undefined;
    const subj = cls?.subject_id ? subjectsById[cls.subject_id] : undefined;
    const parts: string[] = [];
    if (subj?.curriculum) parts.push(String(subj.curriculum));
    const yearLevel = subj?.year_level != null ? String(subj.year_level) : '';
    const nickname = subj?.name ? subj.name.substring(0, 4).toUpperCase() : '';
    if (yearLevel || nickname) parts.push(`${yearLevel}${nickname}`);
    return parts.filter(Boolean).join(' ');
  }, [classesById, subjectsById]);

  const getClassDisplay = useCallback((session: Tables<'sessions'>) => {
    const cls = session.class_id ? classesById[session.class_id] : undefined;
    const subj = cls?.subject_id ? subjectsById[cls.subject_id] : undefined;
    const parts: string[] = [];
    if (subj?.curriculum) parts.push(String(subj.curriculum));
    if (subj?.year_level != null) parts.push(String(subj.year_level));
    if (subj?.name) parts.push(subj.name);
    if (cls?.level) parts.push(String(cls.level));
    return parts.join(' ');
  }, [classesById, subjectsById]);

  const getTimeRange = useCallback((session: Tables<'sessions'>) => {
    const s = session.start_at ? new Date(session.start_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : '';
    const e = session.end_at ? new Date(session.end_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : '';
    return s && e ? `${s}–${e}` : s || e || '-';
  }, []);

  const getInvoiceStatusBadge = useCallback((status: string | null | undefined) => {
    if (!status) return null;
    
    let label = '';
    let variant: 'default' | 'secondary' | 'destructive' | 'outline' = 'secondary';
    
    if (status === 'draft' || status === 'open') {
      label = 'Sent';
      variant = 'secondary';
    } else if (status === 'paid') {
      label = 'Paid';
      variant = 'default';
    } else if (status === 'void' || status === 'uncollectible' || status === 'disputed') {
      label = 'Failed';
      variant = 'destructive';
    } else {
      label = status;
      variant = 'outline';
    }
    
    return <Badge variant={variant} className="text-xs ml-1">{label}</Badge>;
  }, []);

  const handleSort = useCallback((field: SortField) => {
    if (sortField === field) {
      setSortDirection(prev => prev === 'asc' ? 'desc' : 'asc');
    } else {
      setSortField(field);
      setSortDirection('desc');
    }
  }, [sortField]);

  const handleClassClick = useCallback((classId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    setViewingClassId(classId);
    setIsClassModalOpen(true);
  }, []);

  const handleOpenStudent = useCallback((studentId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    window.dispatchEvent(new CustomEvent('open-student-modal', { detail: { id: studentId } }));
  }, []);

  const handleOpenStaff = useCallback((staffId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    window.dispatchEvent(new CustomEvent('open-staff-modal', { detail: { id: staffId } }));
  }, []);

  const handleOpenSession = useCallback((sessionId: string) => {
    window.dispatchEvent(new CustomEvent('open-session-modal', { detail: { id: sessionId } }));
  }, []);

  // Format date for display
  const formatDate = useCallback((dateString: string) => {
    try {
      const date = new Date(dateString);
      return date.toLocaleDateString(undefined, {
        weekday: 'short',
        year: 'numeric',
        month: 'short',
        day: 'numeric'
      });
    } catch (e) {
      return dateString;
    }
  }, []);

  // Loading state
  if (isLoading && allSessions.length === 0) {
    return (
      <div className="h-full flex flex-col space-y-4">
        <div className="flex items-center justify-between">
          <Tabs value={viewMode} onValueChange={(v) => setViewMode(v as 'table' | 'calendar')}>
            <TabsList>
              <TabsTrigger value="table">Table</TabsTrigger>
              <TabsTrigger value="calendar">Calendar</TabsTrigger>
            </TabsList>
          </Tabs>
        </div>
        {viewMode === 'table' ? (
          <>
            <div className="flex flex-wrap items-center gap-2">
              <div>
                <label className="block text-sm mb-1">Start Date</label>
                <DateRangePicker
                  from={today}
                  to={today}
                  onFromChange={() => {}}
                  onToChange={() => {}}
                />
              </div>
              <div>
                <label className="block text-sm mb-1">Class</label>
                <Select disabled>
                  <SelectTrigger className="w-[200px]">
                    <SelectValue placeholder="All Classes" />
                  </SelectTrigger>
                </Select>
              </div>
            </div>
            <SkeletonTable rows={8} columns={7} />
          </>
        ) : (
          <div className="flex-1 flex items-center justify-center">
            <div className="text-muted-foreground">Loading calendar...</div>
          </div>
        )}
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
    <div className="h-full flex flex-col space-y-4">
      {/* View Selector */}
      <div className="flex items-center justify-between">
        <Tabs value={viewMode} onValueChange={(v) => setViewMode(v as 'table' | 'calendar')}>
          <TabsList>
            <TabsTrigger value="table">Table</TabsTrigger>
            <TabsTrigger value="calendar">Calendar</TabsTrigger>
          </TabsList>
        </Tabs>
      </div>

      {/* Filters - only show in table view */}
      {viewMode === 'table' && (
        <div className="flex flex-wrap items-center gap-2">
          <div>
            <label className="block text-sm mb-1">Date Range</label>
            <DateRangePicker
              from={dateRangeStart}
              to={dateRangeEnd}
              onFromChange={setDateRangeStart}
              onToChange={setDateRangeEnd}
            />
          </div>
          <div>
            <label className="block text-sm mb-1">Class</label>
            <Select value={selectedClassId} onValueChange={setSelectedClassId}>
              <SelectTrigger className="w-[200px]">
                <SelectValue placeholder="All Classes" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="ALL">All Classes</SelectItem>
                {studentClassesData.map((sc) => (
                  <SelectItem key={sc.class.id} value={sc.class.id}>
                    {sc.subject ? `${sc.subject.curriculum || ''} ${sc.subject.year_level || ''} ${sc.subject.name || ''}`.trim() : `Class ${sc.class.id.substring(0, 8)}`}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>
      )}

      {/* Calendar View */}
      {viewMode === 'calendar' && (
        <div className="flex-1 min-h-0">
          <StudentSessionsCalendarView
            studentId={student.id}
            onOpenSession={handleOpenSession}
            classId={selectedClassId !== 'ALL' ? selectedClassId : undefined}
          />
        </div>
      )}

      {/* Table View */}
      {viewMode === 'table' && (
      <div className="flex-1 overflow-y-auto rounded-md border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="cursor-pointer" onClick={() => handleSort('start_at')}>
                Date
                <ArrowUpDown className={cn(
                  "ml-2 h-4 w-4 inline",
                  sortField === 'start_at' ? "opacity-100" : "opacity-40"
                )} />
              </TableHead>
              <TableHead>Time</TableHead>
              <TableHead className="cursor-pointer" onClick={() => handleSort('type')}>
                Type
                <ArrowUpDown className={cn(
                  "ml-2 h-4 w-4 inline",
                  sortField === 'type' ? "opacity-100" : "opacity-40"
                )} />
              </TableHead>
              <TableHead>Class</TableHead>
              <TableHead>Staff</TableHead>
              <TableHead>Students</TableHead>
              <TableHead>Invoice Status</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {paginatedSessions.length === 0 ? (
              <TableRow>
                <TableCell colSpan={7} className="text-center h-24">
                  {dateRangeStart || dateRangeEnd || selectedClassId !== 'ALL'
                    ? "No sessions match your filters" 
                    : "No sessions found"}
                </TableCell>
              </TableRow>
            ) : (
              paginatedSessions.map((session) => {
                const students = sessionStudents[session.id] || [];
                const staff = sessionStaff[session.id] || [];
                // Get invoice status from the student in this session (should only be one since we're filtering by student)
                const studentInSession = students.find(s => s.id === student.id);
                const invoiceStatus = studentInSession?.invoice_status;

                return (
                  <TableRow 
                    key={session.id} 
                    className="cursor-pointer hover:bg-muted/50"
                    onClick={() => handleOpenSession(session.id)}
                  >
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <CalendarIcon className="h-4 w-4 text-muted-foreground" />
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
                      <Badge className={getSessionTypeBadgeColor(session.type)}>
                        {formatSessionType(session.type)}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      {session.class_id ? (() => {
                        const cls = classesById[session.class_id];
                        const shortDisplay = getClassShortDisplay(session);
                        const fullDisplay = getClassDisplay(session);
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
                        return <span className="text-muted-foreground text-sm">-</span>;
                      })() : (
                        <span className="text-muted-foreground text-sm">-</span>
                      )}
                    </TableCell>
                    <TableCell>
                      {staff.length > 0 ? (
                        <div className="flex flex-col gap-1">
                          {staff.map((s) => {
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
                                  onClick={(e) => handleOpenStaff(s.id, e)}
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
                      ) : (
                        <span className="text-muted-foreground text-sm">-</span>
                      )}
                    </TableCell>
                    <TableCell>
                      {students.length > 0 ? (
                        <div className="flex flex-col gap-1">
                          {students.map((s) => {
                            const plannedAbsence = s.planned_absence === true;
                            const actualAttended = s.actual_attended;
                            const isExtra = s.is_extra === true;
                            const nameClass = plannedAbsence 
                              ? "text-muted-foreground line-through" 
                              : isExtra
                              ? "text-orange-600 dark:text-orange-400"
                              : "";
                            
                            return (
                              <div key={s.id} className="flex items-center gap-1 flex-wrap">
                                <Button
                                  variant="link"
                                  size="sm"
                                  className={cn("h-auto p-0 text-xs justify-start", nameClass)}
                                  onClick={(e) => handleOpenStudent(s.id, e)}
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
                      ) : (
                        <span className="text-muted-foreground text-sm">-</span>
                      )}
                    </TableCell>
                    <TableCell>
                      {getInvoiceStatusBadge(invoiceStatus) || (
                        <span className="text-muted-foreground text-sm">-</span>
                      )}
                    </TableCell>
                  </TableRow>
                );
              })
            )}
          </TableBody>
        </Table>
      </div>
      )}

      {/* Pagination - only show in table view */}
      {viewMode === 'table' && totalSessions > 0 && (
        <TablePagination
          page={page}
          pageSize={pageSize}
          total={totalSessions}
          isFetching={isFetching}
          onPageChange={setPage}
          onPageSizeChange={setPageSize}
        />
      )}

      {/* Class Modal */}
      {viewingClassId && (
        <ViewClassModal
          classId={viewingClassId}
          isOpen={isClassModalOpen}
          onClose={() => {
            setIsClassModalOpen(false);
            setViewingClassId(null);
          }}
          onClassUpdated={() => {
            refetch();
          }}
        />
      )}
    </div>
  );
}
