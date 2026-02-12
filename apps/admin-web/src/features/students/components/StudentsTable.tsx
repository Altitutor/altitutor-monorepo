'use client';

import React, { useState, useEffect, useMemo, useRef } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
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
import { Label } from "@altitutor/ui";
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
import { sortStudentsByStatus } from '@/shared/utils/tableSorting';
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
import { ActionsMenu } from '@/shared/components/ActionsMenu';
import { useCurrentStaff } from '@/features/staff/hooks/useStaffQuery';
import { LogAbsenceDialog } from '@/features/sessions/components';
import { BookSessionModal } from '@/features/bookings/components/BookSessionModal';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@altitutor/ui";
import { Loader2 } from "lucide-react";
import { SendStudentInviteDialog } from './SendStudentInviteDialog';
import { DiscontinueStudentConfirmDialog } from './DiscontinueStudentConfirmDialog';
import { studentsApi } from '../api';
import { useToast } from "@altitutor/ui";
// import { useVirtualizer } from '@tanstack/react-virtual';

interface StudentsTableProps {
  onRefresh?: number;
  onStudentSelect?: (studentId: string) => void;
  addModalState?: [boolean, (open: boolean) => void];
}

export function StudentsTable({ onRefresh: _onRefresh, onStudentSelect: _onStudentSelect, addModalState: _addModalState }: StudentsTableProps = {}) {
  const router = useRouter();
  const searchParams = useSearchParams();
  
  // Initialize state from URL params
  const getSearchFromUrl = () => searchParams.get('search') || '';
  const getStatusFiltersFromUrl = (): Tables<'students'>['status'][] => {
    const statusParam = searchParams.get('status');
    if (!statusParam) return ['ACTIVE', 'TRIAL'];
    return statusParam.split(',').filter((s): s is Tables<'students'>['status'] => 
      ['ACTIVE', 'TRIAL', 'INACTIVE'].includes(s)
    );
  };
  const getArrayFromUrl = (key: string): string[] => {
    const param = searchParams.get(key);
    return param ? param.split(',').filter(Boolean) : [];
  };
  const getNumberArrayFromUrl = (key: string): number[] => {
    const param = searchParams.get(key);
    return param ? param.split(',').map(Number).filter(n => !isNaN(n)) : [];
  };
  const getSortFromUrl = (): { field: keyof Tables<'students'>; direction: 'asc' | 'desc' } => {
    const field = (searchParams.get('sort') || 'status') as keyof Tables<'students'>;
    const direction = (searchParams.get('order') || 'desc') as 'asc' | 'desc';
    return { field, direction };
  };
  
  // Local UI state initialized from URL
  const [searchTerm, setSearchTerm] = useState(getSearchFromUrl);
  const [statusFilters, setStatusFilters] = useState<Tables<'students'>['status'][]>(getStatusFiltersFromUrl);
  const [curriculumFilters, setCurriculumFilters] = useState<string[]>(getArrayFromUrl('curriculum'));
  const [yearLevelFilters, setYearLevelFilters] = useState<number[]>(getNumberArrayFromUrl('yearLevel'));
  const [subjectFilters, setSubjectFilters] = useState<string[]>(getArrayFromUrl('subject'));
  const sortFromUrl = getSortFromUrl();
  const [sortField, setSortField] = useState<keyof Tables<'students'>>(sortFromUrl.field);
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>(sortFromUrl.direction);
  const [page, setPage] = useState(Number(searchParams.get('page')) || 1);
  const [pageSize, setPageSize] = useState(Number(searchParams.get('pageSize')) || 50);
  
  // Sync URL params when state changes
  const updateUrlParams = (updates: Record<string, string | null>) => {
    const params = new URLSearchParams(searchParams.toString());
    Object.entries(updates).forEach(([key, value]) => {
      if (value === null || value === '') {
        params.delete(key);
      } else {
        params.set(key, value);
      }
    });
    router.push(`/students?${params.toString()}`);
  };

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

  const total = data?.total || 0;

  const [selectedStudentId, setSelectedStudentId] = useState<string | null>(null);
  const [isViewModalOpen, setIsViewModalOpen] = useState(false);
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [selectedClassId, setSelectedClassId] = useState<string | null>(null);
  const [isClassModalOpen, setIsClassModalOpen] = useState(false);
  const { data: currentStaff } = useCurrentStaff();
  const { toast } = useToast();
  
  // Actions menu states
  const [actionStudentId, setActionStudentId] = useState<string | null>(null);
  const [isLogAbsenceDialogOpen, setIsLogAbsenceDialogOpen] = useState(false);
  const [isBookDraftingSessionModalOpen, setIsBookDraftingSessionModalOpen] = useState(false);
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [deleteConfirmText, setDeleteConfirmText] = useState('');
  const [inviteDialogOpen, setInviteDialogOpen] = useState(false);
  const [inviteDialogType, setInviteDialogType] = useState<'invite' | 'registration'>('invite');
  const [loadingPasswordReset, setLoadingPasswordReset] = useState(false);
  const [hasPasswordResetLinkSent, setHasPasswordResetLinkSent] = useState(false);
  const [isDiscontinuing, setIsDiscontinuing] = useState(false);
  const [studentToDiscontinue, setStudentToDiscontinue] = useState<{ id: string; first_name?: string; last_name?: string } | null>(null);

  // Server provides filtered/sorted page; apply compound sorting for status field
  const filteredStudents = useMemo(() => {
    const students = data?.students || [];
    if (!students.length) return students;
    
    // If sorting by status, apply secondary sort by first_name
    if (sortField === 'status') {
      return sortStudentsByStatus(students, sortDirection);
    }
    
    return students;
  }, [data?.students, sortField, sortDirection]);

  // Non-virtualized table for stability (virtualization can be re-enabled later)
  const parentRef = useRef<HTMLDivElement | null>(null);

  // Refetch when onRefresh prop changes
  useEffect(() => {
    if (_onRefresh) {
      refetch();
    }
  }, [_onRefresh, refetch]);

  // Sync state from URL params on mount and when URL changes
  useEffect(() => {
    setSearchTerm(getSearchFromUrl());
    setStatusFilters(getStatusFiltersFromUrl());
    setCurriculumFilters(getArrayFromUrl('curriculum'));
    setYearLevelFilters(getNumberArrayFromUrl('yearLevel'));
    setSubjectFilters(getArrayFromUrl('subject'));
    const sort = getSortFromUrl();
    setSortField(sort.field);
    setSortDirection(sort.direction);
    const pageParam = Number(searchParams.get('page'));
    if (pageParam) setPage(pageParam);
    const pageSizeParam = Number(searchParams.get('pageSize'));
    if (pageSizeParam) setPageSize(pageSizeParam);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchParams]);

  // Filter toggle handlers
  const toggleStatusFilter = (status: Tables<'students'>['status']) => {
    const newFilters = statusFilters.includes(status) 
      ? statusFilters.filter(s => s !== status)
      : [...statusFilters, status];
    setStatusFilters(newFilters);
    updateUrlParams({ 
      status: newFilters.length > 0 ? newFilters.join(',') : null,
      page: null 
    });
    setPage(1);
  };

  const toggleCurriculumFilter = (curriculum: string) => {
    const newFilters = curriculumFilters.includes(curriculum) 
      ? curriculumFilters.filter(c => c !== curriculum)
      : [...curriculumFilters, curriculum];
    setCurriculumFilters(newFilters);
    updateUrlParams({ 
      curriculum: newFilters.length > 0 ? newFilters.join(',') : null,
      page: null 
    });
    setPage(1);
  };

  const toggleYearLevelFilter = (yearLevel: number) => {
    const newFilters = yearLevelFilters.includes(yearLevel) 
      ? yearLevelFilters.filter(y => y !== yearLevel)
      : [...yearLevelFilters, yearLevel];
    setYearLevelFilters(newFilters);
    updateUrlParams({ 
      yearLevel: newFilters.length > 0 ? newFilters.join(',') : null,
      page: null 
    });
    setPage(1);
  };

  const toggleSubjectFilter = (subjectId: string) => {
    const newFilters = subjectFilters.includes(subjectId) 
      ? subjectFilters.filter(s => s !== subjectId)
      : [...subjectFilters, subjectId];
    setSubjectFilters(newFilters);
    updateUrlParams({ 
      subject: newFilters.length > 0 ? newFilters.join(',') : null,
      page: null 
    });
    setPage(1);
  };

  const clearAllFilters = () => {
    setStatusFilters(['ACTIVE', 'TRIAL']);
    setCurriculumFilters([]);
    setYearLevelFilters([]);
    setSubjectFilters([]);
    setSearchTerm('');
    setPage(1);
    updateUrlParams({ 
      search: null,
      status: null,
      curriculum: null,
      yearLevel: null,
      subject: null,
      page: null 
    });
  };

  const handleSort = (field: keyof Tables<'students'>) => {
    const newDirection = sortField === field && sortDirection === 'asc' ? 'desc' : 'asc';
    const newField = sortField === field ? field : field;
    setSortField(newField);
    setSortDirection(newDirection);
    setPage(1);
    updateUrlParams({ 
      sort: newField,
      order: newDirection,
      page: null 
    });
  };
  
  const handleStudentClick = (id: string) => {
    setSelectedStudentId(id);
    setIsViewModalOpen(true);
  };

  const handleDiscontinueStudent = async (): Promise<boolean> => {
    if (!currentStaff || !studentToDiscontinue) return false;
    try {
      setIsDiscontinuing(true);
      const result = await studentsApi.discontinueStudent(studentToDiscontinue.id, currentStaff.id);

      if (!result.success) {
        if (result.error === 'Unenroll student from classes first') {
          toast({
            title: 'Cannot Discontinue',
            description: 'Cannot discontinue student while still enrolled in classes. Please unenroll from all classes first.',
            variant: 'destructive',
          });
        } else if (result.error === 'Student has future sessions') {
          const sessionCount = result.sessions?.length || 0;
          toast({
            title: 'Cannot Discontinue',
            description: `Student has ${sessionCount} future session${sessionCount !== 1 ? 's' : ''}. Please cancel or reschedule them first.`,
            variant: 'destructive',
          });
        } else {
          toast({
            title: 'Cannot Discontinue',
            description: result.error || 'Failed to discontinue student',
            variant: 'destructive',
          });
        }
        return false;
      }

      refetch();
      setStudentToDiscontinue(null);
      toast({
        title: 'Success',
        description: 'Student discontinued successfully.',
      });
      return true;
    } catch (error) {
      console.error('Failed to discontinue student:', error);
      toast({
        title: 'Discontinue failed',
        description: error instanceof Error ? error.message : 'There was an error discontinuing the student. Please try again.',
        variant: 'destructive',
      });
      return false;
    } finally {
      setIsDiscontinuing(false);
    }
  };

  const handleStudentUpdated = () => {
    refetch();
  };


  const handleClassClick = (classId: string) => {
    setSelectedClassId(classId);
    setIsClassModalOpen(true);
  };

  // Actions menu handlers
  const handlePasswordResetOrRegistration = (student: Tables<'students'>) => {
    const isRegistered = student.status === 'ACTIVE';
    const hasAccount = !!student.user_id;
    
    if (isRegistered && !hasAccount) {
      setInviteDialogType('invite');
      setInviteDialogOpen(true);
    } else if ((hasAccount && !isRegistered) || (!hasAccount && !isRegistered)) {
      setInviteDialogType('registration');
      setInviteDialogOpen(true);
    } else {
      handlePasswordResetRequest(student);
    }
  };

  const getPasswordResetLabel = (student: Tables<'students'>) => {
    const isRegistered = student.status === 'ACTIVE';
    const hasAccount = !!student.user_id;
    
    if (isRegistered && !hasAccount) {
      return 'Send invite';
    } else if ((hasAccount && !isRegistered) || (!hasAccount && !isRegistered)) {
      return 'Send registration link';
    } else {
      return 'Send password reset';
    }
  };

  const handlePasswordResetRequest = async (student: Tables<'students'>) => {
    if (!student.email) {
      toast({
        title: "Error",
        description: "No email address found for this student.",
        variant: "destructive",
      });
      return;
    }

    try {
      setLoadingPasswordReset(true);
      // TODO: Implement password reset API call
      setHasPasswordResetLinkSent(true);
      toast({
        title: "Success",
        description: "Password reset link sent successfully.",
      });
    } catch (error) {
      console.error('Failed to send password reset:', error);
      toast({
        title: "Error",
        description: "Failed to send password reset link. Please try again.",
        variant: "destructive",
      });
    } finally {
      setLoadingPasswordReset(false);
    }
  };

  const handleDeleteStudent = async (studentId: string) => {
    try {
      setIsDeleting(true);
      await studentsApi.deleteStudent(studentId);
      setIsDeleteDialogOpen(false);
      setActionStudentId(null);
      setDeleteConfirmText('');
      handleStudentUpdated();
      toast({
        title: "Success",
        description: "Student deleted successfully.",
      });
    } catch (error) {
      console.error('Failed to delete student:', error);
      toast({
        title: "Error",
        description: "Failed to delete student. Please try again.",
        variant: "destructive",
      });
    } finally {
      setIsDeleting(false);
    }
  };

  

  // Loading state
  if (isLoading && filteredStudents.length === 0) {
    return (
      <div className="space-y-4">
        <div className="flex flex-wrap items-center gap-2">
          <div className="relative flex-1 min-w-[200px]">
            <Search className="absolute left-2 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search students..."
              className="pl-8"
              value=""
              disabled
            />
          </div>
          
          <div className="flex flex-wrap items-center gap-2">
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
  if (error && filteredStudents.length === 0) {
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
      {/* Search and filters with dynamic wrapping */}
      <div className="flex flex-wrap items-center gap-2">
        <div className="relative flex-1 min-w-[200px]">
          <Search className="absolute left-2 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search students..."
            className="pl-8"
            value={searchTerm || ''}
            onChange={(e) => {
              const value = e.target.value;
              setSearchTerm(value);
              updateUrlParams({ search: value || null });
            }}
          />
        </div>
        
        <div className="flex flex-wrap items-center gap-2">
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
              <TableHead></TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filteredStudents.length === 0 ? (
              <TableRow>
                <TableCell colSpan={6} className="text-center h-24">
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
                const studentWithClasses = student as Tables<'students'> & { classes?: Array<{ id: string; day_of_week: number | null; start_time: string | null; level: string | null; subject?: Tables<'subjects'> | null }> };
                const classes = studentWithClasses.classes || [];
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
                            .sort((a, b) => {
                              const aDay = a.day_of_week ?? 0;
                              const bDay = b.day_of_week ?? 0;
                              if (aDay !== bDay) return aDay - bDay;
                              const aTime = a.start_time ?? '';
                              const bTime = b.start_time ?? '';
                              return aTime.localeCompare(bTime);
                            })
                            .map((cls) => {
                              // Use utility to format the class short name (includes subject short name)
                              const clsTable = cls as unknown as Tables<'classes'>;
                              const shortName = formatClassShortName(clsTable, cls.subject || null);
                              // Use utility for full name (hover tooltip)
                              const longName = formatClassName(clsTable, cls.subject || null);
                              
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
                    <TableCell onClick={(e) => e.stopPropagation()}>
                      <ActionsMenu
                        type="student"
                        onOpenInPage={() => {
                          router.push(`/students/${student.id}`);
                        }}
                        onEditDetails={() => {
                          handleStudentClick(student.id);
                        }}
                        onPasswordResetOrRegistration={() => {
                          setActionStudentId(student.id);
                          handlePasswordResetOrRegistration(student);
                        }}
                        passwordResetLabel={getPasswordResetLabel(student)}
                        onLogAbsence={() => {
                          setActionStudentId(student.id);
                          setIsLogAbsenceDialogOpen(true);
                        }}
                        onBookDraftingSession={() => {
                          setActionStudentId(student.id);
                          setIsBookDraftingSessionModalOpen(true);
                        }}
                        // For table context, these actions open the modal where they can be performed
                        onAddClass={() => {
                          handleStudentClick(student.id);
                        }}
                        onDiscontinue={student.status === 'TRIAL' || student.status === 'ACTIVE'
                          ? () => {
                              setStudentToDiscontinue(student);
                            }
                          : undefined}
                        onDelete={() => {
                          setActionStudentId(student.id);
                          setIsDeleteDialogOpen(true);
                        }}
                      />
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
        onPageChange={(newPage) => {
          setPage(newPage);
          updateUrlParams({ page: newPage === 1 ? null : String(newPage) });
        }}
        onPageSizeChange={(newSize) => {
          setPageSize(newSize);
          setPage(1);
          updateUrlParams({ 
            pageSize: newSize === 50 ? null : String(newSize),
            page: null 
          });
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

      {/* Log Absence Dialog */}
      {currentStaff && actionStudentId && (
        <LogAbsenceDialog
          isOpen={isLogAbsenceDialogOpen}
          onClose={() => {
            setIsLogAbsenceDialogOpen(false);
            setActionStudentId(null);
          }}
          staffId={currentStaff.id}
          initialStudentId={actionStudentId}
          allowPastSessions={true}
        />
      )}

      {/* Book Drafting Session Modal */}
      {actionStudentId && (
        <BookSessionModal
          isOpen={isBookDraftingSessionModalOpen}
          onClose={() => {
            setIsBookDraftingSessionModalOpen(false);
            setActionStudentId(null);
          }}
          sessionType="DRAFTING"
          initialStudentId={actionStudentId}
          onBookingCreated={() => {
            setIsBookDraftingSessionModalOpen(false);
            setActionStudentId(null);
            handleStudentUpdated();
          }}
        />
      )}

      {/* Send Invite Dialog */}
      {actionStudentId && filteredStudents.find(s => s.id === actionStudentId) && (
        <SendStudentInviteDialog
          isOpen={inviteDialogOpen}
          onClose={() => {
            setInviteDialogOpen(false);
            setActionStudentId(null);
          }}
          student={filteredStudents.find(s => s.id === actionStudentId)!}
          linkType={inviteDialogType}
        />
      )}

      {/* Delete Confirmation Dialog */}
      {actionStudentId && filteredStudents.find(s => s.id === actionStudentId) && (() => {
        const studentToDelete = filteredStudents.find(s => s.id === actionStudentId)!;
        const studentFullName = `${studentToDelete.first_name} ${studentToDelete.last_name}`;
        return (
          <AlertDialog open={isDeleteDialogOpen} onOpenChange={(open) => {
            setIsDeleteDialogOpen(open);
            if (!open) {
              setDeleteConfirmText('');
            }
          }}>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>Are you absolutely sure?</AlertDialogTitle>
                <AlertDialogDescription>
                  This action cannot be undone. This will permanently delete the student
                  "{studentFullName}" and all associated data from the database.
                </AlertDialogDescription>
              </AlertDialogHeader>
              <div className="py-4">
                <div className="space-y-2">
                  <Label>
                    Type <strong>{studentFullName}</strong> to confirm deletion
                  </Label>
                  <Input
                    type="text"
                    placeholder={studentFullName}
                    value={deleteConfirmText}
                    onChange={(e) => setDeleteConfirmText(e.target.value)}
                    className="mt-2"
                  />
                </div>
              </div>
              <AlertDialogFooter>
                <AlertDialogCancel>Cancel</AlertDialogCancel>
                <AlertDialogAction
                  onClick={() => {
                    if (actionStudentId) {
                      handleDeleteStudent(actionStudentId);
                      setDeleteConfirmText('');
                    }
                  }}
                  disabled={isDeleting || deleteConfirmText !== studentFullName}
                  className="bg-destructive text-destructive-foreground hover:bg-destructive/90 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {isDeleting ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Deleting...
                    </>
                  ) : (
                    'Delete'
                  )}
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        );
      })()}

      {/* Discontinue Confirmation Dialog */}
      {studentToDiscontinue && (
        <DiscontinueStudentConfirmDialog
          isOpen={!!studentToDiscontinue}
          onOpenChange={(open) => {
            if (!open) setStudentToDiscontinue(null);
          }}
          studentName={[studentToDiscontinue.first_name, studentToDiscontinue.last_name].filter(Boolean).join(' ') || 'this student'}
          onConfirm={handleDiscontinueStudent}
          isDiscontinuing={isDiscontinuing}
        />
      )}
    </div>
  );
} 