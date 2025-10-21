'use client';

import { useState, useEffect, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { SkeletonTable } from "@/components/ui/skeleton-table";
import { 
  Search, 
  ArrowUpDown,
  Filter,
  Plus,
  RefreshCw
} from 'lucide-react';
import type { Tables } from '@altitutor/shared';
import { cn, formatSubjectDisplay } from '@/shared/utils/index';
import { getStudentStatusColor, getSubjectCurriculumColor } from '@/shared/utils/enum-colors';
import { AddStudentModal } from './AddStudentModal';
import { ViewStudentModal } from './ViewStudentModal';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { ViewClassModal } from '@/features/classes';
import { useStudentsWithDetails } from '../hooks/useStudentsQuery';

interface StudentsTableProps {
  onRefresh?: number;
  onStudentSelect?: (studentId: string) => void;
  addModalState?: [boolean, (open: boolean) => void];
}

export function StudentsTable({ onRefresh, onStudentSelect, addModalState }: StudentsTableProps = {}) {
  const router = useRouter();
  
  // React Query hook for data fetching
  const { 
    data, 
    isLoading, 
    error, 
    refetch,
    isFetching 
  } = useStudentsWithDetails();

  const students: Tables<'students'>[] = data?.students || [];
  const studentSubjects: Record<string, Tables<'subjects'>[]> = data?.studentSubjects || {};
  const studentClasses: Record<string, Tables<'classes'>[]> = data?.studentClasses || {};

  // Local state for UI
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<Tables<'students'>['status'] | 'ALL'>('ALL');
  const [sortField, setSortField] = useState<keyof Tables<'students'>>('last_name');
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('asc');
  const [selectedStudentId, setSelectedStudentId] = useState<string | null>(null);
  const [isViewModalOpen, setIsViewModalOpen] = useState(false);
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [selectedClassId, setSelectedClassId] = useState<string | null>(null);
  const [isClassModalOpen, setIsClassModalOpen] = useState(false);

  // Memoized filtered and sorted students
  const filteredStudents = useMemo(() => {
    if (!students) return [];
    
    let result = [...students];
    
    // Apply search term
    if (searchTerm) {
      const searchLower = searchTerm.toLowerCase();
      result = result.filter(student => 
        (student.first_name?.toLowerCase() || '').includes(searchLower) ||
        (student.last_name?.toLowerCase() || '').includes(searchLower) ||
        (student.student_email?.toLowerCase() || '').includes(searchLower) ||
        (student.parent_email?.toLowerCase() || '').includes(searchLower) ||
        (student.school?.toLowerCase() || '').includes(searchLower)
      );
    }
    
    // Apply status filter
    if (statusFilter !== 'ALL') {
      result = result.filter(student => student.status === statusFilter);
    }
    
    // Apply sorting
    result.sort((a, b) => {
      const valueA = a[sortField] || '';
      const valueB = b[sortField] || '';
      
      if (typeof valueA === 'string' && typeof valueB === 'string') {
        return sortDirection === 'asc' 
          ? valueA.localeCompare(valueB) 
          : valueB.localeCompare(valueA);
      }
      
      if (typeof valueA === 'number' && typeof valueB === 'number') {
        return sortDirection === 'asc' ? valueA - valueB : valueB - valueA;
      }
      
      return 0;
    });
    
    return result;
  }, [students, searchTerm, statusFilter, sortField, sortDirection]);

  // Refetch when onRefresh prop changes
  useEffect(() => {
    if (onRefresh) {
      refetch();
    }
  }, [onRefresh, refetch]);

  const handleSort = (field: keyof Tables<'students'>) => {
    if (sortField === field) {
      setSortDirection(prev => prev === 'asc' ? 'desc' : 'asc');
    } else {
      setSortField(field);
      setSortDirection('asc');
    }
  };
  
  const handleStudentClick = (id: string) => {
    // Clear any previous student data to prevent showing old data
    setSelectedStudentId(null);
    setIsViewModalOpen(false);
    
    // Set new student after a brief delay to ensure clean state
    setTimeout(() => {
      setSelectedStudentId(id);
      setIsViewModalOpen(true);
    }, 50);
  };

  const handleStudentUpdated = () => {
    refetch();
  };

  const handleAddStudentClick = () => {
    setIsAddModalOpen(true);
  };

  const handleClassClick = (classId: string) => {
    setSelectedClassId(classId);
    setIsClassModalOpen(true);
  };

  const getDayOfWeek = (dayOfWeek: number) => {
    const days = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
    return days[dayOfWeek] || '';
  };

  const formatTime = (timeString: string) => {
    if (!timeString) return '';
    
    if (/^\d{1,2}:\d{2}(:\d{2})?$/.test(timeString)) {
      const [hours, minutes] = timeString.split(':').map(Number);
      const ampm = hours >= 12 ? 'PM' : 'AM';
      const hour12 = hours % 12 || 12;
      return `${hour12}:${minutes.toString().padStart(2, '0')} ${ampm}`;
    }
    
    return timeString;
  };

  // Loading state
  if (isLoading && students.length === 0) {
    return (
      <div className="space-y-4">
        <div className="flex justify-between items-center">
          <div className="relative w-64">
            <Search className="absolute left-2 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search students..."
              className="pl-8"
              disabled
            />
          </div>
          
          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" disabled>
              <Filter className="h-4 w-4 mr-2" />
              Status: ALL
            </Button>
            <Button variant="outline" size="sm" disabled>
              <RefreshCw className="h-4 w-4 mr-2" />
              Refresh
            </Button>
          </div>
        </div>
        
        <SkeletonTable rows={8} columns={7} />
        
        <div className="text-sm text-muted-foreground">
          Loading students...
        </div>
      </div>
    );
  }

  // Error state
  if (error && students.length === 0) {
    return (
      <div className="text-red-500 p-4">
        Failed to load students. Please try again.
        <Button 
          variant="outline" 
          size="sm" 
          onClick={() => refetch()} 
          className="ml-2"
        >
          Retry
        </Button>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <div className="relative w-64">
          <Search className="absolute left-2 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search students..."
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
                Status: {statusFilter}
              </Button>
            </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
              <DropdownMenuItem onClick={() => setStatusFilter('ALL')}>
                All Statuses
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => setStatusFilter('ACTIVE')}>
                Active
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => setStatusFilter('INACTIVE')}>
                Inactive
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => setStatusFilter('TRIAL')}>
                Trial
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => setStatusFilter('DISCONTINUED')}>
                Discontinued
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>

          <Button 
            variant="outline" 
            size="sm" 
            onClick={() => refetch()} 
            className="flex items-center"
            disabled={isFetching}
          >
            <RefreshCw className={cn("h-4 w-4 mr-2", isFetching && "animate-spin")} />
            Refresh
          </Button>
        </div>
      </div>

      <div className="rounded-md border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="cursor-pointer" onClick={() => handleSort('status')}>
                Status
                <ArrowUpDown className={cn(
                  "ml-2 h-4 w-4 inline",
                  sortField === 'status' ? "opacity-100" : "opacity-40"
                )} />
              </TableHead>
              <TableHead className="cursor-pointer" onClick={() => handleSort('curriculum')}>
                Curriculum
                <ArrowUpDown className={cn(
                  "ml-2 h-4 w-4 inline",
                  sortField === 'curriculum' ? "opacity-100" : "opacity-40"
                )} />
              </TableHead>
              <TableHead className="cursor-pointer" onClick={() => handleSort('year_level')}>
                Year Level
                <ArrowUpDown className={cn(
                  "ml-2 h-4 w-4 inline",
                  sortField === 'year_level' ? "opacity-100" : "opacity-40"
                )} />
              </TableHead>
              <TableHead className="cursor-pointer" onClick={() => handleSort('first_name')}>
                First Name
                <ArrowUpDown className={cn(
                  "ml-2 h-4 w-4 inline",
                  sortField === 'first_name' ? "opacity-100" : "opacity-40"
                )} />
              </TableHead>
              <TableHead className="cursor-pointer" onClick={() => handleSort('last_name')}>
                Last Name
                <ArrowUpDown className={cn(
                  "ml-2 h-4 w-4 inline",
                  sortField === 'last_name' ? "opacity-100" : "opacity-40"
                )} />
              </TableHead>
              <TableHead>Subjects</TableHead>
              <TableHead>Classes</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filteredStudents.length === 0 ? (
              <TableRow>
                <TableCell colSpan={7} className="text-center h-24">
                  {isLoading ? (
                    "Loading students..."
                  ) : searchTerm || statusFilter !== 'ALL' ? (
                    "No students match your filters"
                  ) : (
                    "No students found"
                  )}
                </TableCell>
              </TableRow>
            ) : (
              filteredStudents.map((student) => {
                const subjects = studentSubjects[student.id] || [];
                const classes = studentClasses[student.id] || [];
                return (
                  <TableRow 
                    key={student.id} 
                    className="cursor-pointer"
                    onClick={() => handleStudentClick(student.id)}
                  >
                    <TableCell>
                      <Badge className={cn("text-xs", getStudentStatusColor(student.status as any))}>
                        {student.status}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      {student.curriculum ? (
                        <Badge className={cn("text-xs", getSubjectCurriculumColor(student.curriculum as any))}>
                          {student.curriculum}
                        </Badge>
                      ) : (
                        <span className="text-muted-foreground text-sm">-</span>
                      )}
                    </TableCell>
                    <TableCell>
                      {student.year_level ? (
                        <Badge variant="secondary" className="text-xs">
                          Year {student.year_level}
                        </Badge>
                      ) : (
                        <span className="text-muted-foreground text-sm">-</span>
                      )}
                    </TableCell>
                    <TableCell className="font-medium">
                      {student.first_name || '-'}
                    </TableCell>
                    <TableCell className="font-medium">
                      {student.last_name || '-'}
                    </TableCell>
                    <TableCell>
                      {subjects.length > 0 ? (
                        <div className="flex flex-col gap-1">
                          {subjects
                            .sort((a, b) => a.name.localeCompare(b.name))
                            .map((subject) => (
                              <Badge key={subject.id} variant="outline" className="text-xs w-fit">
                                {formatSubjectDisplay(subject)}
                              </Badge>
                            ))}
                        </div>
                      ) : (
                        <span className="text-muted-foreground text-sm">No subjects</span>
                      )}
                    </TableCell>
                    <TableCell>
                      {classes.length > 0 ? (
                        <div className="flex flex-col gap-1">
                          {classes
                            .sort((a, b) => a.day_of_week - b.day_of_week || a.start_time.localeCompare(b.start_time))
                            .map((cls) => (
                              <Button
                                key={cls.id}
                                variant="link"
                                size="sm"
                                className="h-auto p-0 text-xs justify-start"
                                onClick={(event) => {
                                  event.stopPropagation();
                                  handleClassClick(cls.id);
                                }}
                              >
                                {cls.subject} - {getDayOfWeek(cls.day_of_week)} {formatTime(cls.start_time)}
                              </Button>
                            ))}
                        </div>
                      ) : (
                        <span className="text-muted-foreground text-sm">No classes</span>
                      )}
                    </TableCell>
                  </TableRow>
                );
              })
            )}
          </TableBody>
        </Table>
      </div>
      
      <div className="text-sm text-muted-foreground">
        {filteredStudents.length} students displayed
        {isFetching && <span className="ml-2">(Refreshing...)</span>}
      </div>

      {/* Add Student Modal */}
      <AddStudentModal 
        isOpen={isAddModalOpen}
        onClose={() => setIsAddModalOpen(false)}
        onStudentAdded={handleStudentUpdated}
      />

      {/* View/Edit Student Modal - only render when we have a selected student ID */}
      {selectedStudentId && (
        <ViewStudentModal 
          isOpen={isViewModalOpen}
          onClose={() => {
            setIsViewModalOpen(false);
            setSelectedStudentId(null);
          }}
          studentId={selectedStudentId}
          onStudentUpdated={handleStudentUpdated}
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
            // Refresh student data to show updated class information
            refetch();
          }}
        />
      )}
    </div>
  );
} 