'use client';

import { useState, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@altitutor/ui";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@altitutor/ui";
import { Button } from "@altitutor/ui";
import { Input } from "@altitutor/ui";
import { Badge } from "@altitutor/ui";
import { SkeletonTable } from "@altitutor/ui";
import { 
  ChevronDown, 
  Search, 
  MoreHorizontal,
  ArrowUpDown,
  Filter,
  CalendarIcon,
  RefreshCw
} from 'lucide-react';
import { isWithinInterval, parseISO, startOfDay, endOfDay } from 'date-fns';
import { useSessionsWithDetails } from '../hooks/useSessionsQuery';
import type { Tables } from '@altitutor/shared';
import { cn } from '@/shared/utils/index';

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
  const router = useRouter();
  
  // React Query hook for data fetching
  const { 
    data, 
    isLoading, 
    error, 
    refetch,
    isFetching 
  } = useSessionsWithDetails({ rangeStart, rangeEnd });
  
  // Extract sessions array from the data structure
  const allSessions: Tables<'sessions'>[] = (data?.sessions as Tables<'sessions'>[]) || [];
  const classesById: Record<string, Tables<'classes'>> = (data as any)?.classesById || {};
  const subjectsById: Record<string, Tables<'subjects'>> = (data as any)?.subjectsById || {};
  
  // Filter and sort state
  const [searchTerm, setSearchTerm] = useState<string>('');
  const [typeFilter, setTypeFilter] = useState<string | 'ALL'>('ALL');
  type SortField = 'start_at' | 'type';
  const [sortField, setSortField] = useState<SortField>('start_at');
  const [sortDirection, setSortDirection] = useState<'desc' | 'asc'>('desc');

  const getClassSubject = (session: Tables<'sessions'>) => {
    const cls = session.class_id ? classesById[session.class_id] : undefined;
    if (!cls) return '-';
    const subj = cls.subject_id ? subjectsById[cls.subject_id] : undefined;
    return subj ? subj.name : '-';
  };

  const getClassDisplay = (session: Tables<'sessions'>) => {
    const cls: any = session.class_id ? (classesById as any)[session.class_id] : undefined;
    const subj: any = cls?.subject_id ? (subjectsById as any)[cls.subject_id] : undefined;
    const parts: string[] = [];
    if (subj?.curriculum) parts.push(String(subj.curriculum));
    if (subj?.year_level != null) parts.push(String(subj.year_level));
    if (subj?.name) parts.push(subj.name);
    if (cls?.level) parts.push(String(cls.level));
    return parts.join(' ');
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
          if (!(session as any).start_at) return false;
          try {
            const sessionDate = parseISO((session as any).start_at);
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
  }, [allSessions, data, searchTerm, typeFilter, sortField, sortDirection, studentId, staffId, classId, limit]);

  const handleSort = (field: SortField) => {
    if (sortField === field) {
      setSortDirection(prev => prev === 'asc' ? 'desc' : 'asc');
    } else {
      setSortField(field);
      setSortDirection('desc');
    }
  };
  
  const handleRefresh = () => {
    refetch();
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
  const getStaffName = (session: Tables<'sessions'>) => {
    const staffList: Tables<'staff'>[] = (data?.sessionStaff?.[session.id] as Tables<'staff'>[]) || [];
    if (!staffList.length) return '-';
    return staffList.map(s => `${(s as any).first_name} ${(s as any).last_name}`).join(', ');
  };
  
  // helpers defined once (avoid redefinition)
  // (removed duplicate helper definitions)

  const getTimeRange = (session: Tables<'sessions'>) => {
    const s = (session as any).start_at ? new Date((session as any).start_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : '';
    const e = (session as any).end_at ? new Date((session as any).end_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : '';
    return s && e ? `${s}–${e}` : s || e || '-';
  };
  
  const handleSessionClick = (id: string) => {
    if (onOpenSession) onOpenSession(id);
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
            <Button variant="outline" size="sm" disabled className="flex items-center">
              <RefreshCw className="h-4 w-4 mr-2" />
              Refresh
            </Button>
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
        <div className="flex justify-between items-center">
          <div className="relative w-64">
            <Search className="absolute left-2 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search sessions..."
              className="pl-8"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </div>
          
          <div className="flex space-x-2 items-center">
            <Button 
              variant="outline" 
              size="sm" 
              onClick={handleRefresh} 
              className="flex items-center"
              disabled={isFetching}
            >
              <RefreshCw className={cn("h-4 w-4 mr-2", isFetching && "animate-spin")} />
              Refresh
            </Button>
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
              {/* Taught By removed as requested */}
              <TableHead>Students</TableHead>
              <TableHead>Staff</TableHead>
              
              <TableHead className="w-10"></TableHead>
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
                    <div className="flex items-center">
                      <CalendarIcon className="h-4 w-4 mr-2 text-muted-foreground" />
                      {(session as any).start_at ? formatDate((session as any).start_at) : '-'}
                    </div>
                  </TableCell>
                  <TableCell className="font-medium">{getTimeRange(session)}</TableCell>
                  <TableCell>
                    <Badge className={getSessionTypeBadgeColor(session.type)}>
                      {session.type === 'CLASS' ? 'CLASS' : 'MEETING'}
                    </Badge>
                  </TableCell>
                  {!classId && (
                    <TableCell className="font-medium">{getClassDisplay(session)}</TableCell>
                  )}
                  <TableCell className="text-sm">
                    {(() => {
                      const planned: any[] = ((data as any)?.sessionStudents?.[session.id] || []) as any[];
                      if (!planned.length) return '-';
                      return (
                        <div className="flex flex-col gap-1">
                          {planned.map((s) => (
                            <button
                              key={s.id}
                              type="button"
                              className="text-blue-600 hover:underline text-left"
                              onClick={(e) => { e.stopPropagation(); (onOpenStudent as any)?.(s.id); }}
                            >
                              {s.first_name} {s.last_name}
                            </button>
                          ))}
                        </div>
                      );
                    })()}
                  </TableCell>
                  <TableCell className="text-sm">
                    {(() => {
                      const planned: any[] = ((data as any)?.sessionStaff?.[session.id] || []) as any[];
                      if (!planned.length) return '-';
                      return (
                        <div className="flex flex-col gap-1">
                          {planned.map((s) => (
                            <button
                              key={s.id}
                              type="button"
                              className="text-blue-600 hover:underline text-left"
                              onClick={(e) => { e.stopPropagation(); (onOpenStaff as any)?.(s.id); }}
                            >
                              {s.first_name} {s.last_name}
                            </button>
                          ))}
                        </div>
                      );
                    })()}
                  </TableCell>
                  
                  
                  <TableCell className="text-right">
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild onClick={(e) => e.stopPropagation()}>
                        <Button variant="ghost" className="h-8 w-8 p-0">
                          <MoreHorizontal className="h-4 w-4" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuItem onClick={(e) => {
                          e.stopPropagation();
                          router.push(`/dashboard/sessions/${session.id}/edit`);
                        }}>
                          Edit
                        </DropdownMenuItem>
                        <DropdownMenuItem onClick={(e) => {
                          e.stopPropagation();
                          // Handle attendance
                        }}>
                          Manage Attendance
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
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
    </div>
  );
} 