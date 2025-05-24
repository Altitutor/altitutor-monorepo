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
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { 
  Search, 
  ArrowUpDown,
  Filter,
  Plus,
  RefreshCw
} from 'lucide-react';
import type { Student, Subject, Class } from '@/lib/supabase/db/types';
import { StudentStatus } from '@/lib/supabase/db/types';
import { studentsApi } from '../api';
import { cn, formatSubjectDisplay } from '@/lib/utils/index';
import { getStudentStatusColor, getSubjectCurriculumColor } from '@/lib/utils/enum-colors';
import { AddStudentModal } from './AddStudentModal';
import { ViewStudentModal } from './ViewStudentModal';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { ViewClassModal } from '@/features/classes';

interface StudentsTableProps {
  onRefresh?: number;
  onStudentSelect?: (studentId: string) => void;
  addModalState?: [boolean, (open: boolean) => void];
}

export function StudentsTable({ onRefresh, onStudentSelect, addModalState }: StudentsTableProps = {}) {
  const router = useRouter();
  const [students, setStudents] = useState<Student[]>([]);
  const [studentSubjects, setStudentSubjects] = useState<Record<string, Subject[]>>({});
  const [studentClasses, setStudentClasses] = useState<Record<string, Class[]>>({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [filteredStudents, setFilteredStudents] = useState<Student[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<StudentStatus | 'ALL'>('ALL');
  const [sortField, setSortField] = useState<keyof Student>('lastName');
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('asc');
  const [selectedStudentId, setSelectedStudentId] = useState<string | null>(null);
  const [isViewModalOpen, setIsViewModalOpen] = useState(false);
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [selectedClassId, setSelectedClassId] = useState<string | null>(null);
  const [isClassModalOpen, setIsClassModalOpen] = useState(false);

  // Load data
  const loadStudents = async () => {
    try {
      setLoading(true);
      // Use the new optimized method that gets students, subjects, and classes
      const { students: studentsData, studentSubjects: subjectsData, studentClasses: classesData } = await studentsApi.getAllStudentsWithDetails();
      console.log("Student data loaded:", studentsData); // Debug log to check data structure
      setStudents(studentsData);
      setStudentSubjects(subjectsData);
      setStudentClasses(classesData);
    } catch (err) {
      console.error('Failed to load students:', err);
      setError('Failed to load students. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  // Initialize and refresh data
  useEffect(() => {
    loadStudents();
  }, [onRefresh]);

  // Apply filters and sorting
  useEffect(() => {
    if (!students) return;
    
    let result = [...students];
    
    // Apply search term
    if (searchTerm) {
      const searchLower = searchTerm.toLowerCase();
      result = result.filter(student => 
        (student.firstName?.toLowerCase() || '').includes(searchLower) ||
        (student.lastName?.toLowerCase() || '').includes(searchLower) ||
        (student.studentEmail?.toLowerCase() || '').includes(searchLower) ||
        (student.parentEmail?.toLowerCase() || '').includes(searchLower) ||
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
    
    setFilteredStudents(result);
  }, [students, searchTerm, statusFilter, sortField, sortDirection]);

  const handleSort = (field: keyof Student) => {
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
    loadStudents();
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

  if (loading && students.length === 0) {
    return <div className="flex justify-center p-4">Loading students...</div>;
  }

  if (error && students.length === 0) {
    return <div className="text-red-500 p-4">{error}</div>;
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
              <DropdownMenuItem onClick={() => setStatusFilter(StudentStatus.ACTIVE)}>
                Active
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => setStatusFilter(StudentStatus.INACTIVE)}>
                Inactive
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => setStatusFilter(StudentStatus.TRIAL)}>
                Trial
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => setStatusFilter(StudentStatus.DISCONTINUED)}>
                Discontinued
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>

          <Button variant="outline" size="sm" onClick={loadStudents} className="flex items-center">
            <RefreshCw className="h-4 w-4 mr-2" />
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
              <TableHead className="cursor-pointer" onClick={() => handleSort('yearLevel')}>
                Year Level
                <ArrowUpDown className={cn(
                  "ml-2 h-4 w-4 inline",
                  sortField === 'yearLevel' ? "opacity-100" : "opacity-40"
                )} />
              </TableHead>
              <TableHead className="cursor-pointer" onClick={() => handleSort('firstName')}>
                First Name
                <ArrowUpDown className={cn(
                  "ml-2 h-4 w-4 inline",
                  sortField === 'firstName' ? "opacity-100" : "opacity-40"
                )} />
              </TableHead>
              <TableHead className="cursor-pointer" onClick={() => handleSort('lastName')}>
                Last Name
                <ArrowUpDown className={cn(
                  "ml-2 h-4 w-4 inline",
                  sortField === 'lastName' ? "opacity-100" : "opacity-40"
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
                  {searchTerm || statusFilter !== 'ALL' 
                    ? "No students match your filters" 
                    : "No students found"}
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
                      <Badge className={cn("text-xs", getStudentStatusColor(student.status))}>
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
                      {student.yearLevel ? (
                        <Badge variant="secondary" className="text-xs">
                          Year {student.yearLevel}
                        </Badge>
                      ) : (
                        <span className="text-muted-foreground text-sm">-</span>
                      )}
                    </TableCell>
                    <TableCell className="font-medium">
                      {student.firstName || '-'}
                    </TableCell>
                    <TableCell className="font-medium">
                      {student.lastName || '-'}
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
                            .sort((a, b) => a.dayOfWeek - b.dayOfWeek || a.startTime.localeCompare(b.startTime))
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
                                {cls.level} - {getDayOfWeek(cls.dayOfWeek)} {formatTime(cls.startTime)}
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
            loadStudents();
          }}
        />
      )}
    </div>
  );
} 