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
import { Checkbox } from "@altitutor/ui";
import { 
  Search, 
  ArrowUpDown,
  Filter,
  X
} from 'lucide-react';
import type { Tables } from '@altitutor/shared';
import { cn, formatSubjectDisplay, formatClassName, formatClassShortName } from '@/shared/utils/index';
import { getStudentStatusColor, getSubjectCurriculumColor } from '@/shared/utils';
import { AddStudentModal } from './AddStudentModal';
import { ViewStudentModal } from './ViewStudentModal';
import { 
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@altitutor/ui";
import { ViewClassModal } from '@/features/classes';
import { TablePagination } from '@/shared/components/TablePagination';
import { useStudentsMinimal } from '../hooks/useStudentsQuery';
import { useSubjects } from '@/features/subjects';
// import { useVirtualizer } from '@tanstack/react-virtual';

interface StudentsTableProps {
  onRefresh?: number;
  onStudentSelect?: (studentId: string) => void;
  addModalState?: [boolean, (open: boolean) => void];
}

export function StudentsTable({ onRefresh: _onRefresh, onStudentSelect: _onStudentSelect, addModalState: _addModalState }: StudentsTableProps = {}) {
  const _router = useRouter();
  
  // Local UI state
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilters, setStatusFilters] = useState<Tables<'students'>['status'][]>(['ACTIVE', 'TRIAL']);
  const [curriculumFilters, setCurriculumFilters] = useState<string[]>([]);
  const [yearLevelFilters, setYearLevelFilters] = useState<number[]>([]);
  const [subjectFilters, setSubjectFilters] = useState<string[]>([]);
  const [sortField, setSortField] = useState<keyof Tables<'students'>>('status');
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('desc');
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(50);

  const { 
    data,
    isLoading,
    isFetching,
    error,
    refetch,
  } = useStudentsMinimal({
    search: searchTerm,
    statuses: statusFilters,
    curriculums: curriculumFilters,
    yearLevels: yearLevelFilters,
    subjectIds: subjectFilters,
    page,
    pageSize,
    orderBy: sortField,
    ascending: sortDirection === 'asc',
  });

  // Get all subjects for the filter dropdown
  const { data: allSubjects = [] } = useSubjects();

  const students = data?.students || [];
  const total = data?.total || 0;

  const [selectedStudentId, setSelectedStudentId] = useState<string | null>(null);
  const [isViewModalOpen, setIsViewModalOpen] = useState(false);
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [selectedClassId, setSelectedClassId] = useState<string | null>(null);
  const [isClassModalOpen, setIsClassModalOpen] = useState(false);

  // Server provides filtered/sorted page; apply compound sorting for status field
  const filteredStudents = useMemo(() => {
    if (!students.length) return students;
    
    // If sorting by status, apply secondary sort by first_name
    if (sortField === 'status') {
      const sorted = [...students].sort((a, b) => {
        const aStatus = String(a.status || '');
        const bStatus = String(b.status || '');
        
        const statusComparison = aStatus.localeCompare(bStatus);
        const primarySort = sortDirection === 'asc' ? statusComparison : -statusComparison;
        
        // If status values are equal, sort by first_name
        if (statusComparison === 0) {
          const aFirstName = String(a.first_name || '');
          const bFirstName = String(b.first_name || '');
          return aFirstName.localeCompare(bFirstName);
        }
        
        return primarySort;
      });
      return sorted;
    }
    
    return students;
  }, [students, sortField, sortDirection]);

  // Non-virtualized table for stability (virtualization can be re-enabled later)
  const parentRef = useRef<HTMLDivElement | null>(null);

  // Refetch when onRefresh prop changes
  useEffect(() => {
    if (_onRefresh) {
      refetch();
    }
  }, [_onRefresh, refetch]);

  // Reset to page 1 when search term or filters change
  useEffect(() => {
    setPage(1);
  }, [searchTerm, statusFilters, curriculumFilters, yearLevelFilters, subjectFilters]);

  // Filter toggle handlers
  const toggleStatusFilter = (status: Tables<'students'>['status']) => {
    setStatusFilters(prev => 
      prev.includes(status) 
        ? prev.filter(s => s !== status)
        : [...prev, status]
    );
    setPage(1);
  };

  const toggleCurriculumFilter = (curriculum: string) => {
    setCurriculumFilters(prev => 
      prev.includes(curriculum) 
        ? prev.filter(c => c !== curriculum)
        : [...prev, curriculum]
    );
    setPage(1);
  };

  const toggleYearLevelFilter = (yearLevel: number) => {
    setYearLevelFilters(prev => 
      prev.includes(yearLevel) 
        ? prev.filter(y => y !== yearLevel)
        : [...prev, yearLevel]
    );
    setPage(1);
  };

  const toggleSubjectFilter = (subjectId: string) => {
    setSubjectFilters(prev => 
      prev.includes(subjectId) 
        ? prev.filter(s => s !== subjectId)
        : [...prev, subjectId]
    );
    setPage(1);
  };

  const clearAllFilters = () => {
    setStatusFilters(['ACTIVE', 'TRIAL']);
    setCurriculumFilters([]);
    setYearLevelFilters([]);
    setSubjectFilters([]);
    setSearchTerm('');
    setPage(1);
  };

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
              value=""
              disabled
            />
          </div>
          
          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" disabled>
              <Filter className="h-4 w-4 mr-2" />
              Filters
            </Button>
          </div>
        </div>
        
        <SkeletonTable rows={8} columns={6} />
        
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

  

  // Count active filters
  const activeFiltersCount = 
    (statusFilters.length !== 2 || !statusFilters.includes('ACTIVE') || !statusFilters.includes('TRIAL') ? 1 : 0) +
    (curriculumFilters.length > 0 ? 1 : 0) +
    (yearLevelFilters.length > 0 ? 1 : 0) +
    (subjectFilters.length > 0 ? 1 : 0);

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <div className="relative w-64">
          <Search className="absolute left-2 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search students..."
            className="pl-8"
            value={searchTerm || ''}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
        </div>
        
        <div className="flex items-center gap-2">
          {/* Clear Filters */}
          {activeFiltersCount > 0 && (
            <Button 
              variant="ghost" 
              size="sm" 
              onClick={clearAllFilters}
            >
              <X className="h-4 w-4 mr-2" />
              Clear
            </Button>
          )}

          {/* Status Filter */}
          <Popover>
            <PopoverTrigger asChild>
              <Button 
                variant={statusFilters.length > 0 ? "secondary" : "outline"} 
                size="sm"
              >
                <Filter className="h-4 w-4 mr-2" />
                Status {statusFilters.length > 0 && `(${statusFilters.length})`}
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-56" align="end">
              <div className="space-y-2">
                <div className="font-medium text-sm mb-2">Student Status</div>
                {(['ACTIVE', 'TRIAL', 'INACTIVE', 'DISCONTINUED'] as const).map((status) => (
                  <label key={status} className="flex items-center gap-2 cursor-pointer">
                    <Checkbox
                      checked={statusFilters.includes(status)}
                      onCheckedChange={() => toggleStatusFilter(status)}
                    />
                    <span className="text-sm">{status}</span>
                  </label>
                ))}
              </div>
            </PopoverContent>
          </Popover>

          {/* Curriculum Filter */}
          <Popover>
            <PopoverTrigger asChild>
              <Button 
                variant={curriculumFilters.length > 0 ? "secondary" : "outline"} 
                size="sm"
              >
                <Filter className="h-4 w-4 mr-2" />
                Curriculum {curriculumFilters.length > 0 && `(${curriculumFilters.length})`}
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-56" align="end">
              <div className="space-y-2">
                <div className="font-medium text-sm mb-2">Curriculum</div>
                {['SACE', 'IB', 'PRESACE', 'PRIMARY', 'MEDICINE'].map((curriculum) => (
                  <label key={curriculum} className="flex items-center gap-2 cursor-pointer">
                    <Checkbox
                      checked={curriculumFilters.includes(curriculum)}
                      onCheckedChange={() => toggleCurriculumFilter(curriculum)}
                    />
                    <span className="text-sm">{curriculum}</span>
                  </label>
                ))}
              </div>
            </PopoverContent>
          </Popover>

          {/* Year Level Filter */}
          <Popover>
            <PopoverTrigger asChild>
              <Button 
                variant={yearLevelFilters.length > 0 ? "secondary" : "outline"} 
                size="sm"
              >
                <Filter className="h-4 w-4 mr-2" />
                Year {yearLevelFilters.length > 0 && `(${yearLevelFilters.length})`}
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-56" align="end">
              <div className="space-y-2">
                <div className="font-medium text-sm mb-2">Year Level</div>
                <div className="grid grid-cols-3 gap-2">
                  {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12].map((year) => (
                    <label key={year} className="flex items-center gap-2 cursor-pointer">
                      <Checkbox
                        checked={yearLevelFilters.includes(year)}
                        onCheckedChange={() => toggleYearLevelFilter(year)}
                      />
                      <span className="text-sm">{year}</span>
                    </label>
                  ))}
                </div>
              </div>
            </PopoverContent>
          </Popover>

          {/* Subject Filter */}
          <Popover>
            <PopoverTrigger asChild>
              <Button 
                variant={subjectFilters.length > 0 ? "secondary" : "outline"} 
                size="sm"
              >
                <Filter className="h-4 w-4 mr-2" />
                Subjects {subjectFilters.length > 0 && `(${subjectFilters.length})`}
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-80" align="end">
              <div className="space-y-2">
                <div className="font-medium text-sm mb-2">Subjects</div>
                <div className="max-h-64 overflow-y-auto space-y-1">
                  {allSubjects
                    .sort((a, b) => formatSubjectDisplay(a).localeCompare(formatSubjectDisplay(b)))
                    .map((subject) => (
                      <label key={subject.id} className="flex items-center gap-2 cursor-pointer">
                        <Checkbox
                          checked={subjectFilters.includes(subject.id)}
                          onCheckedChange={() => toggleSubjectFilter(subject.id)}
                        />
                        <span className="text-sm">{formatSubjectDisplay(subject)}</span>
                      </label>
                    ))}
                </div>
              </div>
            </PopoverContent>
          </Popover>
        </div>
      </div>

      <div className="rounded-md border overflow-x-auto" ref={parentRef}>
        <Table className="min-w-full">
          <TableHeader>
            <TableRow>
              <TableHead className="cursor-pointer" onClick={() => handleSort('status')}>
                Status
                <ArrowUpDown className={cn(
                  "ml-2 h-4 w-4 inline",
                  sortField === 'status' ? "opacity-100" : "opacity-40"
                )} />
              </TableHead>
              <TableHead>
                Education
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
              <TableHead>Classes</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filteredStudents.length === 0 ? (
              <TableRow>
                <TableCell colSpan={5} className="text-center h-24">
                  {isLoading ? (
                    "Loading students..."
                  ) : searchTerm || activeFiltersCount > 0 ? (
                    "No students match your filters"
                  ) : (
                    "No students found"
                  )}
                </TableCell>
              </TableRow>
            ) : (
              filteredStudents.map((student, index) => {
                // Classes are now nested in the student object from minimal query
                const classes = (student as any).classes || [];
                return (
                  <TableRow
                    key={student.id}
                    data-index={index}
                    className="cursor-pointer"
                    onClick={() => handleStudentClick(student.id)}
                  >
                    <TableCell>
                      <Badge className={cn("text-xs", getStudentStatusColor(student.status as 'ACTIVE' | 'INACTIVE' | 'TRIAL' | 'DISCONTINUED'))}>
                        {student.status}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <div className="flex flex-wrap gap-1 items-center">
                        {student.curriculum ? (
                          <Badge className={cn("text-xs", getSubjectCurriculumColor(student.curriculum as 'SACE' | 'IB' | 'PRESACE' | 'PRIMARY' | 'MEDICINE'))}>
                            {student.curriculum}
                          </Badge>
                        ) : null}
                        {student.year_level ? (
                          <Badge variant="outline" className="text-xs bg-transparent">
                            Year {student.year_level}
                          </Badge>
                        ) : null}
                        {!student.curriculum && !student.year_level && (
                          <span className="text-muted-foreground text-sm">-</span>
                        )}
                      </div>
                    </TableCell>
                    <TableCell className="font-medium">
                      {student.first_name || '-'}
                    </TableCell>
                    <TableCell className="font-medium">
                      {student.last_name || '-'}
                    </TableCell>
                    <TableCell>
                      {classes.length > 0 ? (
                        <div className="flex flex-col gap-1">
                          {classes
                            .sort((a: { day_of_week: number; start_time: string }, b: { day_of_week: number; start_time: string }) => a.day_of_week - b.day_of_week || a.start_time.localeCompare(b.start_time))
                            .map((cls: { id: string; day_of_week: number; start_time: string; level: string | null; subject?: Tables<'subjects'> | null }) => {
                              // Use utility to format the class short name (includes subject short name)
                              const shortName = formatClassShortName(cls as any, cls.subject || null);
                              // Use utility for full name (hover tooltip)
                              const longName = formatClassName(cls as any, cls.subject || null);
                              
                              return (
                                <Button
                                  key={cls.id}
                                  variant="link"
                                  size="sm"
                                  className="h-auto p-0 text-xs justify-start whitespace-nowrap"
                                  onClick={(event) => {
                                    event.stopPropagation();
                                    handleClassClick(cls.id);
                                  }}
                                  title={longName}
                                >
                                  <span>{shortName}</span>
                                </Button>
                              );
                            })}
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
      
      <TablePagination
        page={page}
        pageSize={pageSize}
        total={total}
        isFetching={isFetching}
        onPageChange={(newPage) => setPage(newPage)}
        onPageSizeChange={(newSize) => {
          setPageSize(newSize);
          setPage(1);
        }}
      />

      {/* Add Student Modal */}
      <AddStudentModal 
        isOpen={isAddModalOpen}
        onClose={() => setIsAddModalOpen(false)}
        onStudentAdded={handleStudentUpdated}
      />

      {/* View/Edit Student Modal */}
      <ViewStudentModal 
        isOpen={isViewModalOpen}
        onClose={() => {
          setIsViewModalOpen(false);
          setSelectedStudentId(null);
        }}
        studentId={selectedStudentId}
        onStudentUpdated={handleStudentUpdated}
      />

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