'use client';

import React, { useState, useEffect, useMemo, useRef } from 'react';
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
} from "@altitutor/ui";
import { ViewClassModal } from '@/features/classes';
import { useStudentsPageWithDetails } from '../hooks/useStudentsQuery';
// import { useVirtualizer } from '@tanstack/react-virtual';
import { formatTime, getDayShortName } from '@/shared/utils/datetime';

interface StudentsTableProps {
  onRefresh?: number;
  onStudentSelect?: (studentId: string) => void;
  addModalState?: [boolean, (open: boolean) => void];
}

export function StudentsTable({ onRefresh, onStudentSelect, addModalState }: StudentsTableProps = {}) {
  const router = useRouter();
  
  // Local UI state
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<Tables<'students'>['status'] | 'ALL'>('ALL');
  const [sortField, setSortField] = useState<keyof Tables<'students'>>('last_name');
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('asc');
  const [page, setPage] = useState(1);
  const pageSize = 20;

  const { 
    data,
    isLoading,
    isFetching,
    error,
    refetch,
  } = useStudentsPageWithDetails({
    search: searchTerm,
    status: statusFilter,
    page,
    pageSize,
    orderBy: sortField,
    ascending: sortDirection === 'asc',
  });

  const students: Tables<'students'>[] = (data as any)?.students || [];
  const studentSubjects: Record<string, Tables<'subjects'>[]> = (data as any)?.studentSubjects || {};
  const studentClasses: Record<string, Tables<'classes'>[]> = (data as any)?.studentClasses || {};
  const total = (data as any)?.total || 0;

  const [selectedStudentId, setSelectedStudentId] = useState<string | null>(null);
  const [isViewModalOpen, setIsViewModalOpen] = useState(false);
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [selectedClassId, setSelectedClassId] = useState<string | null>(null);
  const [isClassModalOpen, setIsClassModalOpen] = useState(false);

  // Server provides filtered/sorted page; just display
  const filteredStudents = students;

  // Non-virtualized table for stability (virtualization can be re-enabled later)
  const parentRef = useRef<HTMLDivElement | null>(null);

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
    setPage(1);
  };
  
  const handleStudentClick = (id: string) => {
    setSelectedStudentId(id);
    setIsViewModalOpen(true);
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

      <div className="rounded-md border" ref={parentRef}>
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
              filteredStudents.map((student, index) => {
                const subjects = studentSubjects[student.id] || [];
                const classes = studentClasses[student.id] || [];
                return (
                  <TableRow
                    key={student.id}
                    data-index={index}
                    className="cursor-pointer"
                    onClick={() => handleStudentClick(student.id)}
                  >
                    <TableCell>
                      <Badge className={cn("text-xs", getStudentStatusColor(student.status as Tables<'students'>['status']))}>
                        {student.status}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      {student.curriculum ? (
                        <Badge className={cn("text-xs", getSubjectCurriculumColor(student.curriculum as Tables<'students'>['curriculum']))}>
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
                                {getDayShortName(cls.day_of_week)} {formatTime(cls.start_time)}
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
      
      <div className="flex items-center justify-between text-sm text-muted-foreground">
        <div>
          Page {page} of {Math.max(1, Math.ceil(total / pageSize))} • {total} total
          {isFetching && <span className="ml-2">(Refreshing...)</span>}
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" disabled={page <= 1} onClick={() => setPage(p => Math.max(1, p - 1))}>Prev</Button>
          <Button variant="outline" size="sm" disabled={page >= Math.ceil(total / pageSize)} onClick={() => setPage(p => p + 1)}>Next</Button>
        </div>
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