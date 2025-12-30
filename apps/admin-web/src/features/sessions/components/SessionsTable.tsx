'use client';

import { useState, useMemo, useCallback } from 'react';
import { useRouter } from 'next/navigation';
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
import { Checkbox } from "@altitutor/ui";
import { Label } from "@altitutor/ui";
import { 
  Search, 
  ArrowUpDown,
  CalendarIcon,
  Check,
  X
} from 'lucide-react';
import { isWithinInterval, parseISO, startOfDay, endOfDay } from 'date-fns';
import { useSessionsWithDetails } from '../hooks/useSessionsQuery';
import type { Tables } from '@altitutor/shared';
import { cn } from '@/shared/utils/index';
import { ViewClassModal } from '@/features/classes';
import { TutorLogAvatar } from './TutorLogAvatar';

type SessionsTableProps = {
  studentId?: string;
  staffId?: string;
  classId?: string;
  limit?: number;
  rangeStart?: string; // YYYY-MM-DD
  rangeEnd?: string;   // YYYY-MM-DD
  onOpenSession?: (id: string) => void;
  onOpenStudent?: (id: string) => void;
  onOpenStaff?: (id: string) => void;
};

export function SessionsTable({ studentId, staffId, classId, limit, rangeStart, rangeEnd, onOpenSession, onOpenStudent, onOpenStaff }: SessionsTableProps) {
  const _router = useRouter();
  
  // Filter and sort state
  const [searchTerm, setSearchTerm] = useState<string>('');
  const [typeFilter, setTypeFilter] = useState<string | 'ALL'>('ALL');
  const [showInactive, setShowInactive] = useState<boolean>(false);
  
  // React Query hook for data fetching
  const { 
    data, 
    isLoading, 
    error, 
    refetch,
    isFetching: _isFetching 
  } = useSessionsWithDetails({ rangeStart, rangeEnd, includeInactive: showInactive });
  
  // Extract sessions array from the data structure
  const allSessions: Tables<'sessions'>[] = (data?.sessions as Tables<'sessions'>[]) || [];
  const classesById: Record<string, Tables<'classes'>> = (data as any)?.classesById || {};
  const subjectsById: Record<string, Tables<'subjects'>> = (data as any)?.subjectsById || {};
  const tutorLogs: Record<string, { id: string; created_by: string; created_by_name: { first_name: string; last_name: string } }> = (data as any)?.tutorLogs || {};
  type SortField = 'start_at' | 'type';
  const [sortField, setSortField] = useState<SortField>('start_at');
  const [sortDirection, setSortDirection] = useState<'desc' | 'asc'>('desc');
  
  // Class modal state
  const [selectedClassId, setSelectedClassId] = useState<string | null>(null);
  const [isClassModalOpen, setIsClassModalOpen] = useState(false);

  const _getClassSubject = (session: Tables<'sessions'>) => {
    const cls = session.class_id ? classesById[session.class_id] : undefined;
    if (!cls) return '-';
    const subj = cls.subject_id ? subjectsById[cls.subject_id] : undefined;
    return subj ? subj.name : '-';
  };

  const getClassDisplay = useCallback((session: Tables<'sessions'>) => {
    const cls: any = session.class_id ? (classesById as any)[session.class_id] : undefined;
    const subj: any = cls?.subject_id ? (subjectsById as any)[cls.subject_id] : undefined;
    const parts: string[] = [];
    if (subj?.curriculum) parts.push(String(subj.curriculum));
    if (subj?.year_level != null) parts.push(String(subj.year_level));
    if (subj?.name) parts.push(subj.name);
    if (cls?.level) parts.push(String(cls.level));
    return parts.join(' ');
  }, [classesById, subjectsById]);

  const getClassShortDisplay = (session: Tables<'sessions'>) => {
    const cls: any = session.class_id ? (classesById as any)[session.class_id] : undefined;
    const subj: any = cls?.subject_id ? (subjectsById as any)[cls.subject_id] : undefined;
    const parts: string[] = [];
    if (subj?.curriculum) parts.push(String(subj.curriculum));
    const yearLevel = subj?.year_level != null ? String(subj.year_level) : '';
    const nickname = subj?.name ? subj.name.substring(0, 4).toUpperCase() : '';
    if (yearLevel || nickname) parts.push(`${yearLevel}${nickname}`);
    return parts.filter(Boolean).join(' ');
  };

  // Memoized filtered and sorted sessions
  const filteredSessions = useMemo(() => {
    if (!allSessions.length) return [];
    
    let result = [...allSessions];
    
    // Apply entity filters if provided
    if (studentId && data?.sessionStudents) {
      // Filter by student attendance using the sessionStudents mapping
      result = result.filter(session => 
        data.sessionStudents[session.id]?.some((student: any) => student.id === studentId)
      );
    }
    
    if (staffId && data?.sessionStaff) {
      // Filter by staff using the sessionStaff mapping
      result = result.filter(session => 
        data.sessionStaff[session.id]?.some((staff: any) => staff.id === staffId)
      );
    }
    
    if (classId) {
      result = result.filter(session => session.class_id === classId);
    }
    
    // Apply range filter (start_at within [rangeStart, rangeEnd]) if provided
    if (rangeStart && rangeEnd) {
      try {
        const start = startOfDay(parseISO(rangeStart));
        const end = endOfDay(parseISO(rangeEnd));
        result = result.filter((session) => {
          if (!session.start_at) return false;
          try {
            const sessionDate = parseISO(session.start_at);
            return isWithinInterval(sessionDate, { start, end });
          } catch {
            return false;
          }
        });
      } catch {
        // If date parsing fails, skip filtering
        console.error('Invalid date range provided to SessionsTable');
      }
    }

    // Apply search term (class display OR student names OR staff names)
    if (searchTerm) {
      const searchLower = searchTerm.toLowerCase();
      result = result.filter(session => {
        const classMatches = (getClassDisplay(session) || '').toLowerCase().includes(searchLower);
        const students = ((data as any)?.sessionStudents?.[session.id] || []) as any[];
        const staff = ((data as any)?.sessionStaff?.[session.id] || []) as any[];
        const studentsMatch = students.some((s) => `${s.first_name} ${s.last_name}`.toLowerCase().includes(searchLower));
        const staffMatch = staff.some((s) => `${s.first_name} ${s.last_name}`.toLowerCase().includes(searchLower));
        return classMatches || studentsMatch || staffMatch;
      });
    }
    
    // Apply type filter
    if (typeFilter !== 'ALL') {
      result = result.filter(session => session.type === typeFilter);
    }
    
    // Apply sorting
    result.sort((a, b) => {
      if (sortField === 'start_at') {
        const tsA = (a as any).start_at ? new Date((a as any).start_at).getTime() : 0;
        const tsB = (b as any).start_at ? new Date((b as any).start_at).getTime() : 0;
        return sortDirection === 'asc' ? tsA - tsB : tsB - tsA;
      }
      // sortField === 'type'
      const va = (a.type || '').toString();
      const vb = (b.type || '').toString();
      return sortDirection === 'asc' ? va.localeCompare(vb) : vb.localeCompare(va);
    });
    
    // Apply limit if provided
    if (limit && limit > 0) {
      result = result.slice(0, limit);
    }
    
    return result;
  }, [allSessions, data, searchTerm, typeFilter, sortField, sortDirection, studentId, staffId, classId, limit, rangeStart, rangeEnd, getClassDisplay]);

  const handleSort = (field: SortField) => {
    if (sortField === field) {
      setSortDirection(prev => prev === 'asc' ? 'desc' : 'asc');
    } else {
      setSortField(field);
      setSortDirection('desc');
    }
  };
  
  const getSessionTypeBadgeColor = (type: string) => {
    switch (type) {
      case 'CLASS':
        return 'bg-blue-100 text-blue-800';
      case 'DRAFTING':
        return 'bg-purple-100 text-purple-800';
      case 'SUBSIDY_INTERVIEW':
        return 'bg-yellow-100 text-yellow-800';
      case 'TRIAL_SESSION':
        return 'bg-green-100 text-green-800';
      case 'TRIAL_SHIFT':
        return 'bg-orange-100 text-orange-800';
      default:
        return 'bg-gray-100 text-gray-800';
    }
  };
  
  const formatDate = (dateString: string) => {
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
  };
  
  // Staff/name display relies on details map from hook; keep simple for now
  const _getStaffName = (session: Tables<'sessions'>) => {
    const staffList: Tables<'staff'>[] = (data?.sessionStaff?.[session.id] as Tables<'staff'>[]) || [];
    if (!staffList.length) return '-';
    return staffList.map(s => `${(s as any).first_name} ${(s as any).last_name}`).join(', ');
  };
  
  // helpers defined once (avoid redefinition)
  // (removed duplicate helper definitions)

  const getTimeRange = (session: Tables<'sessions'>) => {
    const s = session.start_at ? new Date(session.start_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : '';
    const e = session.end_at ? new Date(session.end_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : '';
    return s && e ? `${s}–${e}` : s || e || '-';
  };
  
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
        <div className="flex justify-between items-center gap-4">
          <div className="relative w-64">
            <Search className="absolute left-2 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search sessions..."
              className="pl-8"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </div>
          <div className="flex items-center gap-2">
            <Checkbox
              id="show-inactive"
              checked={showInactive}
              onCheckedChange={(checked) => setShowInactive(checked === true)}
            />
            <Label htmlFor="show-inactive" className="text-sm font-normal cursor-pointer">
              Show inactive sessions
            </Label>
          </div>
        </div>
      )}

      <div className="rounded-md border">
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
              {!classId && (
                <TableHead>Class</TableHead>
              )}
              <TableHead>Staff</TableHead>
              <TableHead>Students</TableHead>
              <TableHead>Tutor Log</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filteredSessions.length === 0 ? (
              <TableRow>
                <TableCell colSpan={(classId ? 6 : 7)} className="text-center h-24">
                  {searchTerm || typeFilter !== 'ALL' 
                    ? "No sessions match your filters" 
                    : "No sessions found"}
                </TableCell>
              </TableRow>
            ) : (
              filteredSessions.map((session) => (
                <TableRow 
                  key={session.id} 
                  className="cursor-pointer hover:bg-muted/50"
                  onClick={() => handleSessionClick(session.id)}
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
                      {session.type === 'CLASS' ? 'CLASS' : 'MEETING'}
                    </Badge>
                  </TableCell>
                  {!classId && (
                    <TableCell>
                      {session.class_id ? (() => {
                        const cls = classesById[session.class_id];
                        const shortDisplay = getClassShortDisplay(session);
                        const fullDisplay = getClassDisplay(session);
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
                      const staffList: any[] = ((data as any)?.sessionStaff?.[session.id] || []) as any[];
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
                  <TableCell>
                    {(() => {
                      const studentList: any[] = ((data as any)?.sessionStudents?.[session.id] || []) as any[];
                      if (!studentList.length) return <span className="text-muted-foreground text-sm">-</span>;
                      
                      const getInvoiceStatusBadge = (status: string | null | undefined) => {
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
                      };
                      
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
                                {getInvoiceStatusBadge(invoiceStatus)}
                              </div>
                            );
                          })}
                        </div>
                      );
                    })()}
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
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>
      
      {!limit && (
        <div className="text-sm text-muted-foreground">
          {filteredSessions.length} sessions displayed
        </div>
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
    </div>
  );
} 