'use client';

import React, { useState, useCallback, Dispatch, SetStateAction, useEffect, useRef, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
  Button,
  Input,
  Label,
  Badge,
  SkeletonTable,
  useToast,
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  DataTableToolbar,
  TablePagination,
  SearchableSelectInline,
} from "@altitutor/ui";
import { Loader2 } from 'lucide-react';
import { useClassesMinimalPaginated, useDeleteClass } from '../hooks/useClassesQuery';
import { useSubjectsSearchForFilter } from '../hooks/useSubjectsSearchForFilter';
import { useStudentSearchForFilter } from '@/features/sessions/hooks/useStudentSearchForFilter';
import { useStaffSearchForFilter } from '@/features/sessions/hooks/useStaffSearchForFilter';
import type { MinimalClass } from '../api/classes';
import type { Tables, DataTableFilterDefinition, DataTableSortOption, DataTableColumnDefinition } from '@altitutor/shared';
import { cn, getSubjectColorStyle } from '@/shared/utils/index';
import { AddClassModal } from './AddClassModal';
import { EditClassModal } from './EditClassModal';
import { ViewClassModal } from './modal';
import { ViewStaffModal } from '@/features/staff';
import { ViewStudentModal } from '@/features/students';
import { formatTime } from '@/shared/utils/datetime';
import { ActionsMenu } from '@/shared/components/ActionsMenu';
import { useDataTable } from '@/shared/hooks/useDataTable';
import { useQuickFilters } from '@/features/quick-filters/hooks/useQuickFilters';
import { useCurrentStaff } from '@/shared/hooks';
// import { useVirtualizer } from '@tanstack/react-virtual';

interface ClassesTableProps {
  addModalState?: [boolean, Dispatch<SetStateAction<boolean>>];
  viewMode?: 'table';
}

export function ClassesTable({ addModalState }: ClassesTableProps) {
  const router = useRouter();
  const { data: currentStaff } = useCurrentStaff();
  const { data: quickFilters = [] } = useQuickFilters('classes');
  
  const defaultFilters = useMemo(() => ({}), []);
  const defaultSort = useMemo(() => ({ field: 'day_of_week', direction: 'asc' as const }), []);
  const defaultVisibleColumns = useMemo(() => ['day', 'time', 'subject', 'students', 'staff'], []);

  const [subjectFilterSearch, setSubjectFilterSearch] = useState('');
  const [studentFilterSearch, setStudentFilterSearch] = useState('');
  const [staffFilterSearch, setStaffFilterSearch] = useState('');

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
    filterKeys: ['day', 'subject', 'student', 'staff'],
  });

  const { data: subjectSearchData, isFetching: isSubjectSearching } = useSubjectsSearchForFilter(subjectFilterSearch);
  const { data: studentSearchData, isFetching: isStudentSearching } = useStudentSearchForFilter(studentFilterSearch, ['ACTIVE', 'TRIAL']);
  const { data: staffSearchData, isFetching: isStaffSearching } = useStaffSearchForFilter(staffFilterSearch);

  const subjects = useMemo(
    () => subjectSearchData?.subjects ?? [],
    [subjectSearchData?.subjects]
  );
  const students = useMemo(
    () => studentSearchData?.students ?? [],
    [studentSearchData?.students]
  );
  const staffList = useMemo(
    () => staffSearchData?.staff ?? [],
    [staffSearchData?.staff]
  );

  const subjectIds = useMemo(
    () => (state.filters.subject as string[]) ?? [],
    [state.filters.subject]
  );
  const studentIds = useMemo(
    () => (state.filters.student as string[]) ?? [],
    [state.filters.student]
  );
  const staffIds = useMemo(
    () => (state.filters.staff as string[]) ?? [],
    [state.filters.staff]
  );

  const selectedSubjects = useMemo(
    () => subjects.filter((s) => subjectIds.includes(s.id)),
    [subjects, subjectIds]
  );
  const selectedStudents = useMemo(
    () => students.filter((s) => studentIds.includes(s.id)),
    [students, studentIds]
  );
  const selectedStaffList = useMemo(
    () => staffList.filter((s) => staffIds.includes(s.id)),
    [staffList, staffIds]
  );

  const handleSubjectFilterChange = useCallback(
    (subjectsList: Tables<'subjects'>[]) => {
      setFilters({ ...state.filters, subject: subjectsList.map((s) => s.id) });
    },
    [setFilters, state.filters]
  );

  const handleStudentFilterChange = useCallback(
    (studentsList: Tables<'students'>[]) => {
      setFilters({ ...state.filters, student: studentsList.map((s) => s.id) });
    },
    [setFilters, state.filters]
  );

  const handleStaffFilterChange = useCallback(
    (staffListSelected: Tables<'staff'>[]) => {
      setFilters({ ...state.filters, staff: staffListSelected.map((s) => s.id) });
    },
    [setFilters, state.filters]
  );

  const getSubjectLabel = useCallback((s: Tables<'subjects'>) => {
    const base = `${s.curriculum ?? ''} ${s.year_level ? `Year ${s.year_level}` : ''} ${s.name ?? ''}`.trim();
    return base || (s.long_name ?? s.short_name ?? s.id);
  }, []);

  const { 
    data, 
    isLoading, 
    error, 
    refetch,
    isFetching 
  } = useClassesMinimalPaginated({
    search: state.search,
    daysOfWeek: state.filters.day as number[],
    subjectIds: (state.filters.subject as string[]) ?? undefined,
    studentIds: (state.filters.student as string[]) ?? undefined,
    staffIds: (state.filters.staff as string[]) ?? undefined,
    page: state.page,
    pageSize: state.pageSize,
    orderBy: (state.sortBy as keyof Tables<'classes'>) || 'day_of_week',
    ascending: state.sortDirection === 'asc',
  });

  const customFilterContent = useMemo(
    () => ({
      subject: (
        <SearchableSelectInline<Tables<'subjects'>>
          items={subjects}
          value={selectedSubjects}
          onValueChange={handleSubjectFilterChange}
          getItemId={(s) => s.id}
          getItemLabel={getSubjectLabel}
          searchPlaceholder="Search subjects..."
          emptyMessage="No subjects found"
          multiSelect
          loading={isSubjectSearching}
          onSearchChange={setSubjectFilterSearch}
        />
      ),
      student: (
        <SearchableSelectInline<Tables<'students'>>
          items={students}
          value={selectedStudents}
          onValueChange={handleStudentFilterChange}
          getItemId={(s) => s.id}
          getItemLabel={(s) => `${s.first_name ?? ''} ${s.last_name ?? ''}`.trim() || 'Unnamed'}
          searchPlaceholder="Search students..."
          emptyMessage="No students found"
          multiSelect
          loading={isStudentSearching}
          onSearchChange={setStudentFilterSearch}
        />
      ),
      staff: (
        <SearchableSelectInline<Tables<'staff'>>
          items={staffList}
          value={selectedStaffList}
          onValueChange={handleStaffFilterChange}
          getItemId={(s) => s.id}
          getItemLabel={(s) => `${s.first_name ?? ''} ${s.last_name ?? ''}`.trim() || 'Unnamed'}
          searchPlaceholder="Search staff..."
          emptyMessage="No staff found"
          multiSelect
          loading={isStaffSearching}
          onSearchChange={setStaffFilterSearch}
        />
      ),
    }),
    [
      subjects,
      selectedSubjects,
      handleSubjectFilterChange,
      getSubjectLabel,
      isSubjectSearching,
      students,
      selectedStudents,
      handleStudentFilterChange,
      isStudentSearching,
      staffList,
      selectedStaffList,
      handleStaffFilterChange,
      isStaffSearching,
    ]
  );

  const filterDefinitions: DataTableFilterDefinition[] = useMemo(() => [
    {
      key: 'day',
      label: 'Day',
      options: [
        { label: 'Monday', value: 1 },
        { label: 'Tuesday', value: 2 },
        { label: 'Wednesday', value: 3 },
        { label: 'Thursday', value: 4 },
        { label: 'Friday', value: 5 },
        { label: 'Saturday', value: 6 },
        { label: 'Sunday', value: 0 },
      ],
    },
    {
      key: 'subject',
      label: 'Subject',
      options: subjectIds.map((id) => {
        const s = subjects.find((x) => x.id === id);
        return { label: s ? getSubjectLabel(s) : id, value: id };
      }),
    },
    {
      key: 'student',
      label: 'Student',
      options: studentIds.map((id) => {
        const s = students.find((x) => x.id === id);
        return {
          label: s
            ? `${s.first_name ?? ''} ${s.last_name ?? ''}`.trim() || 'Unnamed'
            : id,
          value: id,
        };
      }),
    },
    {
      key: 'staff',
      label: 'Staff',
      options: staffIds.map((id) => {
        const s = staffList.find((x) => x.id === id);
        return {
          label: s
            ? `${s.first_name ?? ''} ${s.last_name ?? ''}`.trim() || 'Unnamed'
            : id,
          value: id,
        };
      }),
    },
  ], [subjectIds, studentIds, staffIds, subjects, students, staffList, getSubjectLabel]);

  const sortOptions: DataTableSortOption[] = [
    { key: 'day_of_week', label: 'Day of Week' },
    { key: 'start_time', label: 'Start Time' },
    { key: 'created_at', label: 'Created At' },
  ];

  const columnDefinitions: DataTableColumnDefinition[] = [
    { key: 'day', label: 'Day' },
    { key: 'time', label: 'Time' },
    { key: 'subject', label: 'Subject' },
    { key: 'students', label: 'Students' },
    { key: 'staff', label: 'Staff' },
  ];

  const classes: MinimalClass[] = data?.classes ?? [];
  const total = data?.total ?? 0;
  
  // Modal states - manage internally and use external state only when provided
  const [internalAddModalOpen, setInternalAddModalOpen] = useState(false);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [isDetailModalOpen, setIsDetailModalOpen] = useState(false);
  const [selectedClass, setSelectedClass] = useState<MinimalClass | null>(null);

  // Use external modal state if provided, otherwise use internal state
  const isAddModalOpen = addModalState ? addModalState[0] : internalAddModalOpen;
  const setIsAddModalOpen = addModalState ? addModalState[1] : setInternalAddModalOpen;

  // Cross-feature modal states
  const [selectedStaffId, setSelectedStaffId] = useState<string | null>(null);
  const [isStaffModalOpen, setIsStaffModalOpen] = useState(false);
  const [selectedStudentId, setSelectedStudentId] = useState<string | null>(null);
  const [isStudentModalOpen, setIsStudentModalOpen] = useState(false);

  // Delete dialog state
  const [classToDelete, setClassToDelete] = useState<MinimalClass | null>(null);
  const [isClassDeleteDialogOpen, setIsClassDeleteDialogOpen] = useState(false);
  const [deleteConfirmText, setDeleteConfirmText] = useState('');
  const deleteClassMutation = useDeleteClass();
  const { toast } = useToast();

  // Ensure hooks are declared before any early returns
  const parentRef = useRef<HTMLDivElement | null>(null);

  type ClassWithSubject = MinimalClass;
  const getSubjectDisplay = (classItem: ClassWithSubject): string => {
    const subject = classItem.subject;
    return subject?.long_name ?? '-';
  };

  const getSubjectBadgeStyle = (classItem: ClassWithSubject): { style: React.CSSProperties; textColorClass: string; defaultClass: string } => {
    const subject = classItem.subject;
    if (!subject) {
      return { style: {}, textColorClass: 'text-gray-800', defaultClass: 'bg-gray-100 text-gray-800' };
    }
    const { style, textColorClass } = getSubjectColorStyle(subject as Tables<'subjects'>);
    const defaultClass = !subject.color ? 'bg-gray-100 text-gray-800' : '';
    return { style, textColorClass, defaultClass };
  };

  // Reset to page 1 when search term or filters change
  useEffect(() => {
    setPage(1);
  }, [state.search, state.filters, setPage]);
  
  const getDayOfWeek = (day: number) => {
    const days = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
    return days[day] || 'Unknown';
  };

  const getClassStudents = (classItem: ClassWithSubject): Tables<'students'>[] => {
    return classItem.students ?? [];
  };

  const getClassStaff = (classItem: ClassWithSubject): Tables<'staff'>[] => {
    return classItem.staff ?? [];
  };
  
  const handleClassClick = (cls: MinimalClass) => {
    setSelectedClass(cls);
    setIsDetailModalOpen(true);
  };

  const handleStaffClick = (staffId: string, e: React.MouseEvent) => {
    e.stopPropagation(); // Prevent class modal from opening
    setSelectedStaffId(staffId);
    setIsStaffModalOpen(true);
  };

  const handleStudentClick = (studentId: string, e: React.MouseEvent) => {
    e.stopPropagation(); // Prevent class modal from opening
    setSelectedStudentId(studentId);
    setIsStudentModalOpen(true);
  };

  const handleClassUpdated = () => {
    refetch();
  };

  // Loading state
  if (isLoading && classes.length === 0) {
    return (
      <div className="space-y-4">
        <DataTableToolbar
          state={state}
          onSearchChange={setSearch}
          onFiltersChange={setFilters}
          onSortChange={setSort}
          onGroupByChange={() => {}}
          onVisibleColumnsChange={setVisibleColumns}
          onQuickFilterApply={(qf) => applyQuickFilter(qf, currentStaff?.id)}
          onReset={resetFilters}
          filterDefinitions={filterDefinitions}
          sortOptions={sortOptions}
          columnDefinitions={columnDefinitions}
          quickFilters={quickFilters}
          customFilterContent={customFilterContent}
          searchPlaceholder="Search classes"
          isLoading={true}
        />
        
        <SkeletonTable rows={8} columns={state.visibleColumns.length} />
        
        <div className="text-sm text-muted-foreground">
          Loading classes...
        </div>
      </div>
    );
  }

  // Error state
  if (error && classes.length === 0) {
    return (
      <div className="text-red-500 p-4">
        Failed to load classes. Please try again.
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

  // Non-virtualized list for stability for now (can re-enable later)
  // parentRef declared above to keep hook order

  return (
    <div className="space-y-4">
      <DataTableToolbar
        state={state}
        onSearchChange={setSearch}
        onFiltersChange={setFilters}
        onSortChange={setSort}
        onGroupByChange={() => {}}
        onVisibleColumnsChange={setVisibleColumns}
        onQuickFilterApply={(qf) => applyQuickFilter(qf, currentStaff?.id)}
        onReset={resetFilters}
        filterDefinitions={filterDefinitions}
        sortOptions={sortOptions}
        columnDefinitions={columnDefinitions}
        quickFilters={quickFilters}
        customFilterContent={customFilterContent}
        searchPlaceholder="Search classes"
        isLoading={isFetching}
      />

      <div className="rounded-md border" ref={parentRef}>
          <Table>
            <TableHeader>
              <TableRow>
                {state.visibleColumns.includes('day') && (
                  <TableHead>
                    Day
                  </TableHead>
                )}
                {state.visibleColumns.includes('time') && <TableHead>Time</TableHead>}
                {state.visibleColumns.includes('subject') && (
                  <TableHead>
                    Subject
                  </TableHead>
                )}
                {state.visibleColumns.includes('students') && <TableHead>Students</TableHead>}
                {state.visibleColumns.includes('staff') && <TableHead>Staff</TableHead>}
                <TableHead></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {classes.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={state.visibleColumns.length + 1} className="text-center h-24">
                    {isLoading ? (
                      "Loading classes..."
                    ) : state.search || Object.keys(state.filters).length > 0 ? (
                      "No classes match your filters"
                    ) : (
                      "No classes found"
                    )}
                  </TableCell>
                </TableRow>
              ) : (
                classes.map((cls, index) => {
                  return (
                    <TableRow
                      key={cls.id}
                      data-index={index}
                      className="cursor-pointer hover:bg-muted/50"
                      onClick={() => handleClassClick(cls)}
                    >
                      {state.visibleColumns.includes('day') && (
                        <TableCell>{getDayOfWeek(cls.day_of_week)}</TableCell>
                      )}
                      {state.visibleColumns.includes('time') && (
                        <TableCell>
                          {formatTime(cls.start_time)} - {formatTime(cls.end_time)}
                        </TableCell>
                      )}
                      {state.visibleColumns.includes('subject') && (
                        <TableCell className="font-medium">
                          <Badge 
                            className={cn("text-xs whitespace-nowrap", (() => {
                              const { textColorClass, defaultClass } = getSubjectBadgeStyle(cls);
                              return defaultClass || textColorClass;
                            })())}
                            style={(() => {
                              const { style } = getSubjectBadgeStyle(cls);
                              return style.backgroundColor ? style : undefined;
                            })()}
                            title={getSubjectDisplay(cls)}
                          >
                            {/* Default to short names, only show full on 2xl+ screens */}
                            <span className="2xl:hidden">{(() => {
                              const subject = (cls as ClassWithSubject).subject;
                              return subject?.short_name ?? subject?.long_name ?? subject?.name ?? '-';
                            })()}</span>
                            <span className="hidden 2xl:inline">{getSubjectDisplay(cls)}</span>
                          </Badge>
                        </TableCell>
                      )}
                      {state.visibleColumns.includes('students') && (
                        <TableCell>
                          <div className="flex flex-col gap-1">
                            {getClassStudents(cls).length === 0 ? (
                              <span className="text-muted-foreground text-sm">No students</span>
                            ) : (
                              getClassStudents(cls).map((student, studentIndex) => (
                                <Button
                                  key={`${cls.id}-${student.id}-${studentIndex}`}
                                  variant="link"
                                  size="sm"
                                  className="h-auto p-0 text-xs justify-start"
                                  onClick={(e) => handleStudentClick(student.id, e)}
                                >
                                  {student.first_name} {student.last_name}
                                </Button>
                              ))
                            )}
                          </div>
                        </TableCell>
                      )}
                      {state.visibleColumns.includes('staff') && (
                        <TableCell>
                          <div className="flex flex-col gap-1">
                            {getClassStaff(cls).length === 0 ? (
                              <span className="text-muted-foreground text-sm">No staff</span>
                            ) : (
                              getClassStaff(cls).map((staff, staffIndex) => (
                                <Button
                                  key={`${cls.id}-${staff.id}-${staffIndex}`}
                                  variant="link"
                                  size="sm"
                                  className="h-auto p-0 text-xs justify-start"
                                  onClick={(e) => handleStaffClick(staff.id, e)}
                                >
                                  {staff.first_name} {staff.last_name}
                                </Button>
                              ))
                            )}
                          </div>
                        </TableCell>
                      )}
                      <TableCell onClick={(e) => e.stopPropagation()}>
                        <ActionsMenu
                          type="class"
                          entityId={cls.id}
                          copyTagDisplayText={cls.short_name?.trim() ?? ''}
                          onOpenInPage={() => {
                            router.push(`/classes/${cls.id}`);
                          }}
                          onDelete={() => {
                            setClassToDelete(cls);
                            setDeleteConfirmText('');
                            setIsClassDeleteDialogOpen(true);
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

      {/* Add Class Modal */}
      <AddClassModal 
        isOpen={isAddModalOpen} 
        onClose={() => setIsAddModalOpen(false)} 
        onClassAdded={() => {
          refetch();
        }}
      />

      {/* Edit Class Modal */}
      {selectedClass && (
        <EditClassModal
          isOpen={isEditModalOpen}
          onClose={() => setIsEditModalOpen(false)}
          onClassUpdated={handleClassUpdated}
          classData={selectedClass}
        />
      )}

      {/* Class Detail Modal */}
      {selectedClass && (
        <ViewClassModal 
          isOpen={isDetailModalOpen}
          onClose={() => setIsDetailModalOpen(false)}
          classId={selectedClass.id}
          onClassUpdated={handleClassUpdated}
        />
      )}
      
      {/* Staff Modal */}
      {selectedStaffId && (
        <ViewStaffModal
          staffId={selectedStaffId}
          isOpen={isStaffModalOpen}
          onClose={() => {
            setIsStaffModalOpen(false);
            setSelectedStaffId(null);
          }}
          onStaffUpdated={() => {
            // Refresh class data to show updated staff information
            refetch();
          }}
        />
      )}
      
      {/* Student Modal */}
      <ViewStudentModal
        studentId={selectedStudentId}
        isOpen={isStudentModalOpen}
        onClose={() => {
          setIsStudentModalOpen(false);
          setSelectedStudentId(null);
        }}
        onStudentUpdated={() => {
          // Refresh class data to show updated student information
          refetch();
        }}
      />

      {/* Delete class confirmation dialog */}
      <AlertDialog open={isClassDeleteDialogOpen} onOpenChange={(open) => {
        if (!open) {
          setClassToDelete(null);
          setDeleteConfirmText('');
        }
        setIsClassDeleteDialogOpen(open);
      }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Are you absolutely sure?</AlertDialogTitle>
            <AlertDialogDescription>
              This action cannot be undone. This will permanently delete the class
              {classToDelete?.level ? ` "${classToDelete.level}"` : ''} and all associated data from the database.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <div className="py-4">
            <div className="space-y-2">
              <Label>
                {classToDelete?.level ? (
                  <>Type <strong>{classToDelete.level}</strong> to confirm deletion</>
                ) : (
                  <>Type <strong>DELETE</strong> to confirm deletion</>
                )}
              </Label>
              <Input
                type="text"
                placeholder={classToDelete?.level || 'DELETE'}
                value={deleteConfirmText}
                onChange={(e) => setDeleteConfirmText(e.target.value)}
                className="mt-2"
              />
            </div>
          </div>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={async () => {
                if (!classToDelete) return;
                try {
                  await deleteClassMutation.mutateAsync(classToDelete.id);
                  refetch();
                  setClassToDelete(null);
                  setIsClassDeleteDialogOpen(false);
                  setDeleteConfirmText('');
                  toast({
                    title: 'Class deleted',
                    description: 'Class has been deleted successfully.',
                  });
                } catch {
                  toast({
                    title: 'Delete failed',
                    description: 'There was an error deleting the class. Please try again.',
                    variant: 'destructive',
                  });
                }
              }}
              disabled={deleteClassMutation.isPending || (classToDelete?.level ? deleteConfirmText !== classToDelete.level : deleteConfirmText !== 'DELETE')}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {deleteClassMutation.isPending ? (
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
    </div>
  );
} 
