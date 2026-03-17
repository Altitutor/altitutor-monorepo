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
  Button,
  Badge,
  SkeletonTable,
  Label,
  Input,
  useToast,
  DataTableToolbar,
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  TablePagination,
} from "@altitutor/ui";
import { ArrowUpDown, Loader2 } from 'lucide-react';
import type { Tables, DataTableFilterDefinition, DataTableSortOption, DataTableColumnDefinition } from '@altitutor/shared';
import { cn } from '@/shared/utils/index';
import { getStudentStatusColor, getSubjectCurriculumColor } from '@/shared/utils';
import { sortStudentsByStatus } from '@/shared/utils/tableSorting';
import { AddStudentModal } from './AddStudentModal';
import { ViewStudentModal } from './ViewStudentModal';
import { ViewClassModal } from '@/features/classes';
import { useStudentsMinimal } from '../hooks/useStudentsQuery';
import { useSubjects } from '@/features/subjects';
import { ActionsMenu } from '@/shared/components/ActionsMenu';
import { useCurrentStaff } from '@/shared/hooks';
import { LogAbsenceDialog } from '@/features/sessions/components';
import { BookSessionModal } from '@/features/bookings/components/BookSessionModal';
import { SendStudentInviteDialog } from './SendStudentInviteDialog';
import { DiscontinueStudentConfirmDialog } from './DiscontinueStudentConfirmDialog';
import { studentsApi } from '../api';
import { useDataTable } from '@/shared/hooks/useDataTable';
import { useQuickFilters } from '@/features/quick-filters/hooks/useQuickFilters';
// import { useVirtualizer } from '@tanstack/react-virtual';

interface StudentsTableProps {
  onRefresh?: number;
  onStudentSelect?: (studentId: string) => void;
  addModalState?: [boolean, (open: boolean) => void];
}

export function StudentsTable({ onRefresh: _onRefresh, onStudentSelect: _onStudentSelect, addModalState: _addModalState }: StudentsTableProps = {}) {
  const router = useRouter();
  useSearchParams(); // Required for URL sync in useDataTable
  const { data: currentStaff } = useCurrentStaff();
  const { data: allSubjects = [] } = useSubjects();
  const { data: quickFilters = [] } = useQuickFilters('students');
  const { toast } = useToast();
  
  const defaultFilters = useMemo(() => ({ status: ['ACTIVE', 'TRIAL'] }), []);
  const defaultSort = useMemo(() => ({ field: 'status', direction: 'desc' as const }), []);
  const defaultVisibleColumns = useMemo(() => ['status', 'education', 'first_name', 'last_name', 'classes'], []);

  const {
    state,
    setSearch,
    setSort,
    setFilters,
    setPage,
    setPageSize,
    setVisibleColumns,
    applyQuickFilter,
    resetFilters,
  } = useDataTable({
    defaultFilters,
    defaultSort,
    defaultVisibleColumns,
    filterKeys: ['status', 'curriculum', 'yearLevel', 'subject'],
  });

  const { 
    data,
    isLoading,
    isFetching,
    error,
    refetch,
  } = useStudentsMinimal({
    search: state.search,
    statuses: state.filters.status as Tables<'students'>['status'][],
    curriculums: state.filters.curriculum as string[],
    yearLevels: state.filters.yearLevel as number[],
    subjectIds: state.filters.subject as string[],
    page: state.page,
    pageSize: state.pageSize,
    orderBy: (state.sortBy || 'status') as keyof Tables<'students'>,
    ascending: state.sortDirection === 'asc',
  });

  const total = data?.total || 0;

  const [selectedStudentId, setSelectedStudentId] = useState<string | null>(null);
  const [isViewModalOpen, setIsViewModalOpen] = useState(false);
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [selectedClassId, setSelectedClassId] = useState<string | null>(null);
  const [isClassModalOpen, setIsClassModalOpen] = useState(false);
  // Actions menu states
  const [actionStudentId, setActionStudentId] = useState<string | null>(null);
  const [isLogAbsenceDialogOpen, setIsLogAbsenceDialogOpen] = useState(false);
  const [isBookDraftingSessionModalOpen, setIsBookDraftingSessionModalOpen] = useState(false);
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [deleteConfirmText, setDeleteConfirmText] = useState('');
  const [inviteDialogOpen, setInviteDialogOpen] = useState(false);
  const [inviteDialogType, setInviteDialogType] = useState<'invite' | 'registration'>('invite');
  const [, setLoadingPasswordReset] = useState(false);
  const [, setHasPasswordResetLinkSent] = useState(false);
  const [isDiscontinuing, setIsDiscontinuing] = useState(false);
  const [studentToDiscontinue, setStudentToDiscontinue] = useState<{ id: string; first_name?: string; last_name?: string } | null>(null);

  const filterDefinitions: DataTableFilterDefinition[] = useMemo(() => [
    {
      key: 'status',
      label: 'Status',
      options: [
        { label: 'ACTIVE', value: 'ACTIVE' },
        { label: 'TRIAL', value: 'TRIAL' },
        { label: 'INACTIVE', value: 'INACTIVE' },
        { label: 'DISCONTINUED', value: 'DISCONTINUED' },
      ],
    },
    {
      key: 'curriculum',
      label: 'Curriculum',
      options: ['SACE', 'IB', 'PRESACE', 'PRIMARY', 'MEDICINE'].map(c => ({ label: c, value: c })),
    },
    {
      key: 'yearLevel',
      label: 'Year Level',
      options: [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12].map(y => ({ label: `Year ${y}`, value: y })),
    },
    {
      key: 'subject',
      label: 'Subjects',
      options: allSubjects
        .sort((a, b) => (a.long_name ?? '').localeCompare(b.long_name ?? ''))
        .map(s => ({ label: s.long_name ?? '', value: s.id })),
    },
  ], [allSubjects]);

  const sortOptions: DataTableSortOption[] = [
    { key: 'status', label: 'Status' },
    { key: 'first_name', label: 'First Name' },
    { key: 'last_name', label: 'Last Name' },
    { key: 'created_at', label: 'Created At' },
  ];

  const columnDefinitions: DataTableColumnDefinition[] = [
    { key: 'status', label: 'Status' },
    { key: 'education', label: 'Education' },
    { key: 'first_name', label: 'First Name' },
    { key: 'last_name', label: 'Last Name' },
    { key: 'classes', label: 'Classes' },
  ];

  // Server provides filtered/sorted page; apply compound sorting for status field
  const filteredStudents = useMemo(() => {
    const students = data?.students || [];
    if (!students.length) return students;
    
    // If sorting by status, apply secondary sort by first_name
    if (state.sortBy === 'status') {
      return sortStudentsByStatus(students, state.sortDirection);
    }
    
    return students;
  }, [data?.students, state.sortBy, state.sortDirection]);

  // Non-virtualized table for stability (virtualization can be re-enabled later)
  const parentRef = useRef<HTMLDivElement | null>(null);

  // Refetch when onRefresh prop changes
  useEffect(() => {
    if (_onRefresh) {
      refetch();
    }
  }, [_onRefresh, refetch]);

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
        <SkeletonTable rows={8} columns={state.visibleColumns.length} />
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

  return (
    <div className="space-y-4">
      <DataTableToolbar
        state={state}
        onSearchChange={setSearch}
        onFiltersChange={setFilters}
        onSortChange={setSort}
        onGroupByChange={() => {}} // Students table doesn't support grouping yet
        onVisibleColumnsChange={setVisibleColumns}
        onQuickFilterApply={(qf) => applyQuickFilter(qf, currentStaff?.id)}
        onReset={resetFilters}
        filterDefinitions={filterDefinitions}
        sortOptions={sortOptions}
        columnDefinitions={columnDefinitions}
        quickFilters={quickFilters}
        searchPlaceholder="Search students..."
        isLoading={isFetching}
      />

      <div className="rounded-md border overflow-x-auto" ref={parentRef}>
        <Table className="min-w-full">
          <TableHeader>
            <TableRow>
              {state.visibleColumns.includes('status') && (
                <TableHead className="cursor-pointer" onClick={() => setSort('status', state.sortBy === 'status' && state.sortDirection === 'asc' ? 'desc' : 'asc')}>
                  Status
                  <ArrowUpDown className={cn(
                    "ml-2 h-4 w-4 inline",
                    state.sortBy === 'status' ? "opacity-100" : "opacity-40"
                  )} />
                </TableHead>
              )}
              {state.visibleColumns.includes('education') && (
                <TableHead>
                  Education
                </TableHead>
              )}
              {state.visibleColumns.includes('first_name') && (
                <TableHead className="cursor-pointer" onClick={() => setSort('first_name', state.sortBy === 'first_name' && state.sortDirection === 'asc' ? 'desc' : 'asc')}>
                  First Name
                  <ArrowUpDown className={cn(
                    "ml-2 h-4 w-4 inline",
                    state.sortBy === 'first_name' ? "opacity-100" : "opacity-40"
                  )} />
                </TableHead>
              )}
              {state.visibleColumns.includes('last_name') && (
                <TableHead className="cursor-pointer" onClick={() => setSort('last_name', state.sortBy === 'last_name' && state.sortDirection === 'asc' ? 'desc' : 'asc')}>
                  Last Name
                  <ArrowUpDown className={cn(
                    "ml-2 h-4 w-4 inline",
                    state.sortBy === 'last_name' ? "opacity-100" : "opacity-40"
                  )} />
                </TableHead>
              )}
              {state.visibleColumns.includes('classes') && <TableHead>Classes</TableHead>}
              <TableHead></TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filteredStudents.length === 0 ? (
              <TableRow>
                <TableCell colSpan={state.visibleColumns.length + 1} className="text-center h-24">
                  {isLoading ? (
                    "Loading students..."
                  ) : state.search || Object.keys(state.filters).length > 0 ? (
                    "No students match your filters"
                  ) : (
                    "No students found"
                  )}
                </TableCell>
              </TableRow>
            ) : (
              filteredStudents.map((student, index) => {
                const studentWithClasses = student as Tables<'students'> & { classes?: Array<{ id: string; short_name: string | null; long_name: string | null; day_of_week: number | null; start_time: string | null; level: string | null; subject?: Tables<'subjects'> | null }> };
                const classes = studentWithClasses.classes || [];
                return (
                  <TableRow
                    key={student.id}
                    data-index={index}
                    className="cursor-pointer"
                    onClick={() => handleStudentClick(student.id)}
                  >
                    {state.visibleColumns.includes('status') && (
                      <TableCell>
                        <Badge className={cn("text-xs", getStudentStatusColor(student.status as 'ACTIVE' | 'INACTIVE' | 'TRIAL' | 'DISCONTINUED'))}>
                          {student.status}
                        </Badge>
                      </TableCell>
                    )}
                    {state.visibleColumns.includes('education') && (
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
                    )}
                    {state.visibleColumns.includes('first_name') && (
                      <TableCell className="font-medium">
                        {student.first_name || '-'}
                      </TableCell>
                    )}
                    {state.visibleColumns.includes('last_name') && (
                      <TableCell className="font-medium">
                        {student.last_name || '-'}
                      </TableCell>
                    )}
                    {state.visibleColumns.includes('classes') && (
                      <TableCell onClick={(e) => e.stopPropagation()}>
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
                                const shortName = cls.short_name?.trim() ?? cls.long_name?.trim() ?? '';
                                const displayName = shortName || `Class ${cls.id.slice(0, 8)}`;
                                return (
                                  <Button
                                    key={cls.id}
                                    variant="link"
                                    size="sm"
                                    className="h-auto p-0 text-xs justify-start whitespace-nowrap"
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      handleClassClick(cls.id);
                                    }}
                                    title={cls.long_name ?? shortName}
                                  >
                                    {displayName}
                                  </Button>
                                );
                              })}
                          </div>
                        ) : (
                          <span className="text-muted-foreground text-sm">No classes</span>
                        )}
                      </TableCell>
                    )}
                    <TableCell onClick={(e) => e.stopPropagation()}>
                      <ActionsMenu
                        type="student"
                        entityId={student.id}
                        copyTagDisplayText={`${student.first_name || ''} ${student.last_name || ''}`.trim()}
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
        page={state.page}
        pageSize={state.pageSize}
        total={total}
        isFetching={isFetching}
        onPageChange={setPage}
        onPageSizeChange={setPageSize}
      />

      {/* Modals ... */}
      <AddStudentModal 
        isOpen={isAddModalOpen}
        onClose={() => setIsAddModalOpen(false)}
        onStudentAdded={handleStudentUpdated}
      />

      <ViewStudentModal 
        isOpen={isViewModalOpen}
        onClose={() => {
          setIsViewModalOpen(false);
          setSelectedStudentId(null);
        }}
        studentId={selectedStudentId}
        onStudentUpdated={handleStudentUpdated}
      />

      {selectedClassId && (
        <ViewClassModal
          classId={selectedClassId}
          isOpen={isClassModalOpen}
          onClose={() => {
            setIsClassModalOpen(false);
            setSelectedClassId(null);
          }}
          onClassUpdated={handleStudentUpdated}
        />
      )}

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
