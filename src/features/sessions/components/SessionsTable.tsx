'use client';

import { useState, useEffect } from 'react';
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
import { 
  ChevronDown, 
  Search, 
  MoreHorizontal,
  ArrowUpDown,
  Filter,
  CalendarIcon
} from 'lucide-react';
import { useSessions } from '../hooks';
import { useStudents } from '@/features/students/hooks';
import { useStaff } from '@/features/staff/hooks';
import { useClasses } from '@/features/classes/hooks';
import { Session, SessionType } from '../types';
import type { Student, Staff, Class } from '@/shared/lib/supabase/db/types';
import { cn } from '@/shared/utils/index';

type SessionsTableProps = {
  studentId?: string;
  staffId?: string;
  classId?: string;
  limit?: number;
};

export function SessionsTable({ studentId, staffId, classId, limit }: SessionsTableProps) {
  const router = useRouter();
  const { items: allSessions, loading, error, fetchAll } = useSessions();
  const { items: students } = useStudents();
  const { items: staffMembers } = useStaff();
  const { items: classes } = useClasses();
  
  const [filteredSessions, setFilteredSessions] = useState<Session[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [typeFilter, setTypeFilter] = useState<SessionType | 'ALL'>('ALL');
  const [sortField, setSortField] = useState<keyof Session>('date');
  const [sortDirection, setSortDirection] = useState<'desc' | 'asc'>('desc');

  useEffect(() => {
    fetchAll();
  }, [fetchAll]);

  useEffect(() => {
    if (!allSessions) return;
    
    let result = [...allSessions];
    
    // Apply entity filters if provided
    if (studentId) {
      // Logic to filter by student will be implemented when we have session attendances
    }
    
    if (staffId) {
      result = result.filter(session => session.staffId === staffId);
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
    
    setFilteredSessions(result);
  }, [allSessions, searchTerm, typeFilter, sortField, sortDirection, studentId, staffId, classId, limit]);

  const handleSort = (field: keyof Session) => {
    if (sortField === field) {
      setSortDirection(prev => prev === 'asc' ? 'desc' : 'asc');
    } else {
      setSortField(field);
      setSortDirection('desc');
    }
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
  
  const getStaffName = (staffId: string | null | undefined) => {
    if (!staffId) return 'Unassigned';
    const staff = staffMembers?.find(s => s.id === staffId);
    return staff ? `${staff.firstName} ${staff.lastName}` : 'Unknown Staff';
  };
  
  const getClassSubject = (classId: string | null | undefined) => {
    if (!classId) return '-';
    const cls = classes?.find(c => c.id === classId);
    return cls ? cls.level : 'Unknown Class';
  };
  
  const handleSessionClick = (id: string) => {
    router.push(`/dashboard/sessions/${id}`);
  };

  if (loading) {
    return <div>Loading sessions...</div>;
  }

  if (error) {
    return <div className="text-red-500">Error loading sessions: {error}</div>;
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
          
          <div className="flex items-center gap-2">
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="outline" size="sm">
                  <Filter className="h-4 w-4 mr-2" />
                  Type: {typeFilter}
                  <ChevronDown className="h-4 w-4 ml-1" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem onClick={() => setTypeFilter('ALL')}>
                  All Types
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => setTypeFilter(SessionType.CLASS)}>
                  Class
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => setTypeFilter(SessionType.DRAFTING)}>
                  Drafting
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => setTypeFilter(SessionType.SUBSIDY_INTERVIEW)}>
                  Subsidy Interview
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => setTypeFilter(SessionType.TRIAL_SESSION)}>
                  Trial Session
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => setTypeFilter(SessionType.TRIAL_SHIFT)}>
                  Trial Shift
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>

            <Button onClick={() => router.push('/dashboard/sessions/new')}>
              Record Session
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
                    <TableCell>{getClassSubject(session.classId)}</TableCell>
                  )}
                  {!staffId && (
                    <TableCell>{getStaffName(session.staffId)}</TableCell>
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