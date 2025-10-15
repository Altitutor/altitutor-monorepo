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
} from "@/components/ui/table";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { SkeletonTable } from "@/components/ui/skeleton-table";
import { 
  ChevronDown, 
  Search, 
  MoreHorizontal,
  ArrowUpDown,
  Filter,
  CalendarIcon,
  RefreshCw
} from 'lucide-react';
import { useSessionsWithDetails } from '../hooks/useSessionsQuery';
import { Session, SessionType } from '@/shared/lib/supabase/database/types';
import { cn } from '@/shared/utils/index';

type SessionsTableProps = {
  studentId?: string;
  staffId?: string;
  classId?: string;
  limit?: number;
};

export function SessionsTable({ studentId, staffId, classId, limit }: SessionsTableProps) {
  const router = useRouter();
  
  // React Query hook for data fetching
  const { 
    data, 
    isLoading, 
    error, 
    refetch,
    isFetching 
  } = useSessionsWithDetails();
  
  // Extract sessions array from the data structure
  const allSessions = data?.sessions || [];
  
  // Filter and sort state
  const [searchTerm, setSearchTerm] = useState('');
  const [typeFilter, setTypeFilter] = useState<SessionType | 'ALL'>('ALL');
  const [sortField, setSortField] = useState<keyof Session>('date');
  const [sortDirection, setSortDirection] = useState<'desc' | 'asc'>('desc');

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
      result = result.filter(session => session.classId === classId);
    }
    
    // Apply search term
    if (searchTerm) {
      const searchLower = searchTerm.toLowerCase();
      result = result.filter(session => 
        session.subject.toLowerCase().includes(searchLower) ||
        session.teachingContent?.toLowerCase().includes(searchLower) ||
        session.notes?.toLowerCase().includes(searchLower)
      );
    }
    
    // Apply type filter
    if (typeFilter !== 'ALL') {
      result = result.filter(session => session.type === typeFilter);
    }
    
    // Apply sorting
    result.sort((a, b) => {
      const valueA = a[sortField] || '';
      const valueB = b[sortField] || '';
      
      if (sortField === 'date') {
        const dateA = new Date(a.date).getTime();
        const dateB = new Date(b.date).getTime();
        return sortDirection === 'asc' ? dateA - dateB : dateB - dateA;
      }
      
      if (typeof valueA === 'string' && typeof valueB === 'string') {
        return sortDirection === 'asc' 
          ? valueA.localeCompare(valueB) 
          : valueB.localeCompare(valueA);
      }
      
      return 0;
    });
    
    // Apply limit if provided
    if (limit && limit > 0) {
      result = result.slice(0, limit);
    }
    
    return result;
  }, [allSessions, data, searchTerm, typeFilter, sortField, sortDirection, studentId, staffId, classId, limit]);

  const handleSort = (field: keyof Session) => {
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
  
  const getSessionTypeBadgeColor = (type: SessionType) => {
    switch (type) {
      case SessionType.CLASS:
        return 'bg-blue-100 text-blue-800';
      case SessionType.DRAFTING:
        return 'bg-purple-100 text-purple-800';
      case SessionType.SUBSIDY_INTERVIEW:
        return 'bg-yellow-100 text-yellow-800';
      case SessionType.TRIAL_SESSION:
        return 'bg-green-100 text-green-800';
      case SessionType.TRIAL_SHIFT:
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
  
  const getStaffName = (session: Session) => {
    if (!session.staff) return 'Unassigned';
    return `${session.staff.firstName} ${session.staff.lastName}`;
  };
  
  const getClassSubject = (session: Session) => {
    if (!session.class) return '-';
    return session.class.level;
  };
  
  const handleSessionClick = (id: string) => {
    router.push(`/dashboard/sessions/${id}`);
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
              <TableHead className="cursor-pointer" onClick={() => handleSort('date')}>
                Date
                <ArrowUpDown className={cn(
                  "ml-2 h-4 w-4 inline",
                  sortField === 'date' ? "opacity-100" : "opacity-40"
                )} />
              </TableHead>
              <TableHead className="cursor-pointer" onClick={() => handleSort('subject')}>
                Subject
                <ArrowUpDown className={cn(
                  "ml-2 h-4 w-4 inline",
                  sortField === 'subject' ? "opacity-100" : "opacity-40"
                )} />
              </TableHead>
              {!classId && (
                <TableHead>Class</TableHead>
              )}
              {!staffId && (
                <TableHead>Taught By</TableHead>
              )}
              <TableHead className="cursor-pointer" onClick={() => handleSort('type')}>
                Type
                <ArrowUpDown className={cn(
                  "ml-2 h-4 w-4 inline",
                  sortField === 'type' ? "opacity-100" : "opacity-40"
                )} />
              </TableHead>
              <TableHead>Notes</TableHead>
              <TableHead className="w-10"></TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filteredSessions.length === 0 ? (
              <TableRow>
                <TableCell colSpan={6} className="text-center h-24">
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
                      {formatDate(session.date)}
                    </div>
                  </TableCell>
                  <TableCell className="font-medium">
                    {session.subject}
                  </TableCell>
                  {!classId && (
                    <TableCell>{getClassSubject(session)}</TableCell>
                  )}
                  {!staffId && (
                    <TableCell>{getStaffName(session)}</TableCell>
                  )}
                  <TableCell>
                    <Badge className={getSessionTypeBadgeColor(session.type)}>
                      {session.type}
                    </Badge>
                  </TableCell>
                  <TableCell className="max-w-[200px] truncate">
                    {session.notes || '-'}
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