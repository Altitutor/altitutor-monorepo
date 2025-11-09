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
import { Button } from "@altitutor/ui";
import { Input } from "@altitutor/ui";
import { Badge } from "@altitutor/ui";
import { SkeletonTable } from "@altitutor/ui";
import { 
  Search, 
  ArrowUpDown,
  CalendarIcon,
  RefreshCw
} from 'lucide-react';
import { isWithinInterval, parseISO, startOfDay, endOfDay } from 'date-fns';
import { useSessions } from '../hooks/useSessionsQuery';
import type { Tables } from '@altitutor/shared';
import { cn } from '@/shared/utils/index';
import { ViewClassModal } from '@/features/classes';

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
  
  // React Query hook for data fetching - uses vtutor_sessions view
  const { 
    data: sessions = [], 
    isLoading, 
    error, 
    refetch,
    isFetching 
  } = useSessions();
  
  // vtutor_sessions returns sessions with flattened subject fields
  const allSessions: any[] = sessions as any[];
  
  // Filter and sort state
  const [searchTerm, setSearchTerm] = useState<string>('');
  const [typeFilter, setTypeFilter] = useState<string | 'ALL'>('ALL');
  type SortField = 'start_at' | 'type';
  const [sortField, setSortField] = useState<SortField>('start_at');
  const [sortDirection, setSortDirection] = useState<'desc' | 'asc'>('desc');
  
  // Class modal state
  const [selectedClassId, setSelectedClassId] = useState<string | null>(null);
  const [isClassModalOpen, setIsClassModalOpen] = useState(false);

  const getClassSubject = (session: any) => {
    return session.subject_name || '-';
  };

  const getClassDisplay = (session: any) => {
    const parts: string[] = [];
    if (session.subject_curriculum) parts.push(String(session.subject_curriculum));
    if (session.subject_year_level != null) parts.push(String(session.subject_year_level));
    if (session.subject_name) parts.push(session.subject_name);
    if (session.class_level) parts.push(String(session.class_level));
    return parts.join(' ');
  };

  const getClassShortDisplay = (session: any) => {
    const parts: string[] = [];
    if (session.subject_curriculum) parts.push(String(session.subject_curriculum));
    const yearLevel = session.subject_year_level != null ? String(session.subject_year_level) : '';
    const nickname = session.subject_name ? session.subject_name.substring(0, 4).toUpperCase() : '';
    if (yearLevel || nickname) parts.push(`${yearLevel}${nickname}`);
    return parts.filter(Boolean).join(' ');
  };

  // Memoized filtered and sorted sessions
  const filteredSessions = useMemo(() => {
    if (!allSessions.length) return [];
    
    let result = [...allSessions];
    
    // Apply entity filters if provided
    // Note: vtutor_sessions view doesn't include student/staff arrays, so filtering by studentId/staffId
    // would require fetching session details individually - simplified for now
    // TODO: If needed, can fetch vtutor_session_detail for each session
    
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

    // Apply search term (class display only - student/staff names not in vtutor_sessions view)
    if (searchTerm) {
      const searchLower = searchTerm.toLowerCase();
      result = result.filter(session => {
        const classMatches = (getClassDisplay(session) || '').toLowerCase().includes(searchLower);
        return classMatches;
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
  }, [allSessions, searchTerm, typeFilter, sortField, sortDirection, classId, limit]);

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
  
  // Staff/name display - vtutor_sessions doesn't include staff array
  const getStaffName = (session: any) => {
    return '-'; // Would need to fetch vtutor_session_detail for staff list
  };
  
  // helpers defined once (avoid redefinition)
  // (removed duplicate helper definitions)

  const getTimeRange = (session: any) => {
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
            </TableRow>
          </TableHeader>
          <TableBody>
            {filteredSessions.length === 0 ? (
              <TableRow>
                <TableCell colSpan={(classId ? 5 : 6)} className="text-center h-24">
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
                      {session.start_at ? formatDate(session.start_at) : '-'}
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
                      {session.class_id ? (
                        <Button
                          variant="link"
                          size="sm"
                          className="h-auto p-0 text-xs justify-start whitespace-nowrap font-medium"
                          onClick={(e) => handleClassClick(session.class_id!, e)}
                          title={getClassDisplay(session)}
                        >
                          {/* Default to short names, only show full on 2xl+ screens */}
                          <span className="2xl:hidden">{getClassShortDisplay(session)}</span>
                          <span className="hidden 2xl:inline">{getClassDisplay(session)}</span>
                        </Button>
                      ) : (
                        <span className="text-muted-foreground text-sm">-</span>
                      )}
                    </TableCell>
                  )}
                  <TableCell>
                    <span className="text-muted-foreground text-sm">-</span>
                  </TableCell>
                  <TableCell>
                    <span className="text-muted-foreground text-sm">-</span>
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