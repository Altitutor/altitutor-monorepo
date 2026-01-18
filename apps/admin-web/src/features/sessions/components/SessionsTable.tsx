'use client';

import { useState, useMemo, useCallback, useEffect } from 'react';
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
import { useSessionsWithDetails } from '../hooks/useSessionsQuery';
import type { Tables } from '@altitutor/shared';
import { cn, formatSessionType } from '@/shared/utils/index';
import { ViewClassModal } from '@/features/classes';
import { TutorLogAvatar } from './TutorLogAvatar';
import { useQuery } from '@tanstack/react-query';
import { getSupabaseClient } from '@/shared/lib/supabase/client';
import type { Database } from '@altitutor/shared';
import type { SupabaseClient } from '@supabase/supabase-js';
import { DateRangePicker } from '@altitutor/ui';
import { TablePagination } from '@/shared/components/TablePagination';
import { ActionsMenu } from '@/shared/components/ActionsMenu';
import { useCurrentStaff } from '@/features/staff/hooks/useStaffQuery';
import { LogSessionModal } from '@/features/tutor-logs';
import { useRouter } from 'next/navigation';
import { BookSessionModal } from '@/features/bookings/components/BookSessionModal';

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
  onFromChange?: (date: string) => void;
  onToChange?: (date: string) => void;
  onResetDates?: () => void; // Callback to reset dates to default
  hideBilling?: boolean; // Hide invoice status badges
  hideStudentFilter?: boolean; // Hide student filter UI
  hideTypeFilter?: boolean; // Hide type filter UI
  hideSearch?: boolean; // Hide search input
  initialStudentFilters?: string[]; // Initial student filters (for external filter control)
};

export function SessionsTable({ studentId, staffId, classId, limit, rangeStart, rangeEnd, onOpenSession, onOpenStudent, onOpenStaff, onFromChange, onToChange, onResetDates, hideBilling = false, hideStudentFilter = false, hideTypeFilter = false, hideSearch = false, initialStudentFilters = [] }: SessionsTableProps) {
  const router = useRouter();
  const { data: currentStaff } = useCurrentStaff();
  
  // Filter and sort state
  const [searchTerm, setSearchTerm] = useState<string>('');
  const [debouncedSearchTerm, setDebouncedSearchTerm] = useState<string>('');
  const [studentFilters, setStudentFilters] = useState<string[]>(initialStudentFilters);
  const [typeFilters, setTypeFilters] = useState<string[]>([]);
  const [studentSearchQuery, setStudentSearchQuery] = useState('');
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(50);
  const [sortField, setSortField] = useState<'start_at'>('start_at');
  const [sortDirection, setSortDirection] = useState<'desc' | 'asc'>('asc');
  const [showLogged, setShowLogged] = useState(true);
  const [showUnlogged, setShowUnlogged] = useState(true);
  
  // Actions menu state
  const [actionSessionId, setActionSessionId] = useState<string | null>(null);
  const [isLogSessionModalOpen, setIsLogSessionModalOpen] = useState(false);
  const [isRescheduleModalOpen, setIsRescheduleModalOpen] = useState(false);
  const [selectedSessionForReschedule, setSelectedSessionForReschedule] = useState<Tables<'sessions'> | null>(null);
  const [selectedStudentForReschedule, setSelectedStudentForReschedule] = useState<string | null>(null);
  
  // Session types
  const SESSION_TYPES = ['CLASS', 'DRAFTING', 'EXAM_COURSE', 'SUBSIDY_INTERVIEW', 'TRIAL_SESSION', 'STAFF_INTERVIEW', 'TRIAL_SHIFT'] as const;
  
  // Fetch students for the filter using server-side search
  const { data: studentSearchResults } = useQuery({
    queryKey: ['students', 'search', studentSearchQuery.trim()],
    queryFn: async () => {
      const trimmed = studentSearchQuery.trim();
      const supabase = getSupabaseClient() as SupabaseClient<Database>;
      
      // Use server-side search function to avoid pagination limits
      const { data: rpcResult, error: rpcError } = await supabase.rpc('search_students_admin', {
        p_search: trimmed.length > 0 ? trimmed : undefined,
        p_statuses: ['ACTIVE', 'TRIAL'], // Include both ACTIVE and TRIAL students
        p_include_relationships: false,
        p_limit: 100, // Limit to 100 results for filter dropdown
        p_offset: 0,
        p_order_by: 'last_name',
        p_ascending: true,
      });

      if (rpcError) throw rpcError;
      if (!rpcResult) return { students: [], total: 0 };

      const rpcData = rpcResult as { students: any[]; total: number };
      const students = (rpcData.students || []).map((s: any) => ({
        id: s.id,
        first_name: s.first_name,
        last_name: s.last_name,
        status: s.status,
        curriculum: s.curriculum || null,
        year_level: s.year_level || null,
        school: s.school || null,
        email: s.email || null,
        phone: s.phone || null,
        created_at: s.created_at || null,
        updated_at: s.updated_at || null,
      })) as Tables<'students'>[];
      
      return { students, total: rpcData.total || 0 };
    },
    staleTime: 1000 * 30, // 30 seconds stale time
  });

  const allStudents = studentSearchResults?.students || [];
  
  // Filter students based on search query
  const filteredStudents = useMemo(() => {
    if (!studentSearchQuery.trim()) return allStudents;
    const query = studentSearchQuery.toLowerCase().trim();
    return allStudents.filter((student) => {
      const fullName = `${student.first_name} ${student.last_name}`.toLowerCase();
      const school = student.school?.toLowerCase() || '';
      return fullName.includes(query) || school.includes(query);
    });
  }, [allStudents, studentSearchQuery]);
  
  // Toggle student filter
  const toggleStudentFilter = useCallback((studentId: string) => {
    setStudentFilters(prev => {
      const newFilters = prev.includes(studentId) 
        ? prev.filter(id => id !== studentId)
        : [...prev, studentId];
      setPage(1); // Reset to first page when filter changes
      return newFilters;
    });
  }, []);
  
  // Toggle type filter
  const toggleTypeFilter = useCallback((type: string) => {
    setTypeFilters(prev => {
      const newFilters = prev.includes(type) 
        ? prev.filter(t => t !== type)
        : [...prev, type];
      setPage(1); // Reset to first page when filter changes
      return newFilters;
    });
  }, []);

  // Check if filters are in default state
  // Default: no student/type filters, no search, dates are today
  const isDefaultState = useMemo(() => {
    const today = new Date();
    const year = today.getFullYear();
    const month = String(today.getMonth() + 1).padStart(2, '0');
    const day = String(today.getDate()).padStart(2, '0');
    const todayString = `${year}-${month}-${day}`;
    
    return (
      studentFilters.length === 0 &&
      typeFilters.length === 0 &&
      searchTerm === '' &&
      rangeStart === todayString &&
      rangeEnd === todayString
    );
  }, [studentFilters, typeFilters, searchTerm, rangeStart, rangeEnd]);

  // Clear all filters
  const clearAllFilters = useCallback(() => {
    setStudentFilters([]);
    setTypeFilters([]);
    setSearchTerm('');
    setStudentSearchQuery('');
    setPage(1);
    // Reset dates to default (today) via callback
    if (onResetDates) {
      onResetDates();
    }
  }, [onResetDates]);
  
  // Debounce search term
  useEffect(() => {
    const timeoutId = setTimeout(() => {
      setDebouncedSearchTerm(searchTerm);
      setPage(1); // Reset to first page when search changes
    }, 300);
    return () => clearTimeout(timeoutId);
  }, [searchTerm]);
  
  // Determine which student filters to use for API call
  const activeStudentFilters = hideStudentFilter ? initialStudentFilters : studentFilters;
  const apiStudentId = studentId || (activeStudentFilters.length === 1 ? activeStudentFilters[0] : undefined);
  
  // React Query hook for data fetching
  const { 
    data, 
    isLoading, 
    error, 
    refetch,
    isFetching: _isFetching 
  } = useSessionsWithDetails({ 
    rangeStart: rangeStart || undefined, // Convert empty string to undefined
    rangeEnd: rangeEnd || undefined, // Convert empty string to undefined
    includeInactive: false,
    search: debouncedSearchTerm,
    studentId: apiStudentId,
    staffId,
    classId,
    types: typeFilters.length > 0 ? typeFilters : undefined,
    orderBy: 'start_at',
    ascending: sortDirection === 'asc',
  });
  
  const isFetching = _isFetching;
  
  // Extract sessions array from the data structure
  const allSessions: Tables<'sessions'>[] = (data?.sessions as Tables<'sessions'>[]) || [];
  const classesById: Record<string, Tables<'classes'>> = (data as any)?.classesById || {};
  const subjectsById: Record<string, Tables<'subjects'>> = (data as any)?.subjectsById || {};
  const tutorLogs: Record<string, { id: string; created_by: string; created_by_name: { first_name: string; last_name: string } }> = (data as any)?.tutorLogs || {};
  
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

  // Memoized sessions (filtering and sorting is now done server-side via RPC)
  // Apply client-side filtering for multiple student IDs if needed
  const filteredSessions = useMemo(() => {
    if (!allSessions.length) return [];
    
    let result = [...allSessions];
    
    // Client-side filter for multiple student IDs (if more than one selected)
    // Also handle initialStudentFilters when hideStudentFilter is true
    const activeStudentFilters = hideStudentFilter ? initialStudentFilters : studentFilters;
    if (activeStudentFilters.length > 1) {
      result = result.filter(session => {
        const sessionStudents = (data?.sessionStudents?.[session.id] || []) as Tables<'students'>[];
        return sessionStudents.some(s => activeStudentFilters.includes(s.id));
      });
    }
    
    // Filter by tutor log status
    if (!showLogged || !showUnlogged) {
      result = result.filter(session => {
        const hasTutorLog = !!tutorLogs[session.id];
        if (hasTutorLog) {
          return showLogged;
        } else {
          return showUnlogged;
        }
      });
    }
    
    return result;
  }, [allSessions, studentFilters, initialStudentFilters, hideStudentFilter, data?.sessionStudents, showLogged, showUnlogged, tutorLogs]);

  // Paginated sessions
  const paginatedSessions = useMemo(() => {
    if (limit && limit > 0) {
      // If limit is provided, use it instead of pagination
      return filteredSessions.slice(0, limit);
    }
    
    const start = (page - 1) * pageSize;
    const end = start + pageSize;
    return filteredSessions.slice(start, end);
  }, [filteredSessions, page, pageSize, limit]);

  // Reset page when filters change
  useEffect(() => {
    setPage(1);
  }, [studentFilters, initialStudentFilters, typeFilters, debouncedSearchTerm, rangeStart, rangeEnd, showLogged, showUnlogged]);

  const handleSort = () => {
    setSortDirection(prev => prev === 'asc' ? 'desc' : 'asc');
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
      case 'EXAM_COURSE':
        return 'bg-indigo-100 text-indigo-800';
      case 'STAFF_INTERVIEW':
        return 'bg-pink-100 text-pink-800';
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
    const formatTime = (date: Date) => {
      const hours = date.getHours();
      const minutes = date.getMinutes();
      const period = hours >= 12 ? 'pm' : 'am';
      const displayHours = hours % 12 || 12;
      const displayMinutes = minutes.toString().padStart(2, '0');
      return `${displayHours}:${displayMinutes}${period}`;
    };
    
    if (!session.start_at || !session.end_at) {
      if (session.start_at) {
        return formatTime(new Date(session.start_at));
      }
      if (session.end_at) {
        return formatTime(new Date(session.end_at));
      }
      return '-';
    }
    
    const startDate = new Date(session.start_at);
    const endDate = new Date(session.end_at);
    
    return `${formatTime(startDate)} - ${formatTime(endDate)}`;
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
      )}

      <div className="rounded-md border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="cursor-pointer" onClick={handleSort}>
                Date
                <ArrowUpDown className="ml-2 h-4 w-4 inline opacity-100" />
              </TableHead>
              <TableHead>Time</TableHead>
              <TableHead>
                Type
              </TableHead>
              {!classId && (
                <TableHead>Class</TableHead>
              )}
              <TableHead>Staff</TableHead>
              <TableHead>Students</TableHead>
              <TableHead>Tutor Log</TableHead>
              <TableHead></TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {paginatedSessions.length === 0 ? (
              <TableRow>
                <TableCell colSpan={(classId ? 7 : 8)} className="text-center h-24">
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
                  <TableCell>
                    <Badge className={getSessionTypeBadgeColor(session.type)}>
                      {formatSessionType(session.type)}
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
                                {!hideBilling && getInvoiceStatusBadge(invoiceStatus)}
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
                  <TableCell onClick={(e) => e.stopPropagation()}>
                    {(() => {
                      // Check if rescheduling is possible (only for DRAFTING, TRIAL_SESSION, SUBSIDY_INTERVIEW)
                      const canReschedule = session.type && ['DRAFTING', 'TRIAL_SESSION', 'SUBSIDY_INTERVIEW'].includes(session.type);
                      
                      // Get the first student ID for rescheduling (if multiple students, use the first one without planned absence)
                      const getFirstStudentIdForReschedule = () => {
                        const studentList: any[] = ((data as any)?.sessionStudents?.[session.id] || []) as any[];
                        if (studentList.length > 0) {
                          const firstStudent = studentList.find((ss: any) => ss.student_id && !ss.planned_absence);
                          return firstStudent?.student_id || null;
                        }
                        return null;
                      };
                      
                      // Get subject ID from session's class
                      const getSubjectId = () => {
                        if (session.class_id) {
                          const cls = classesById[session.class_id];
                          return cls?.subject_id || null;
                        }
                        return null;
                      };
                      
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
                            const studentId = getFirstStudentIdForReschedule();
                            if (studentId) {
                              setSelectedStudentForReschedule(studentId);
                              setSelectedSessionForReschedule(session);
                              setIsRescheduleModalOpen(true);
                            }
                          }}
                          canReschedule={canReschedule}
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
            if (selectedSessionForReschedule.class_id) {
              const cls = classesById[selectedSessionForReschedule.class_id];
              return cls?.subject_id || null;
            }
            return null;
          })()}
          onBookingCreated={(newSessionId) => {
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