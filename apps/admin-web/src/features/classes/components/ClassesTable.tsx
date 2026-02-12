'use client';

import React, { useState, Dispatch, SetStateAction, useEffect, useRef } from 'react';
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
import { useToast } from "@altitutor/ui";
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
import { 
  Search,
  Loader2,
} from 'lucide-react';
import { TablePagination } from '@/shared/components/TablePagination';
import { useClassesMinimalPaginated, useDeleteClass } from '../hooks/useClassesQuery';
import type { Tables } from '@altitutor/shared';
import { cn, formatSubjectDisplay, formatSubjectShortName, getSubjectColorStyle } from '@/shared/utils/index';
import { AddClassModal } from './AddClassModal';
import { EditClassModal } from './EditClassModal';
import { ViewClassModal } from './modal';
import { ViewStaffModal } from '@/features/staff';
import { ViewStudentModal } from '@/features/students';
import { formatTime } from '@/shared/utils/datetime';
import { ActionsMenu } from '@/shared/components/ActionsMenu';
// import { useVirtualizer } from '@tanstack/react-virtual';

interface ClassesTableProps {
  addModalState?: [boolean, Dispatch<SetStateAction<boolean>>];
  viewMode?: 'table';
}

export function ClassesTable({ addModalState }: ClassesTableProps) {
  const router = useRouter();
  const searchParams = useSearchParams();
  
  // Initialize from URL params
  const getSearchFromUrl = () => searchParams.get('search') || '';
  const getNumberArrayFromUrl = (key: string): number[] => {
    const param = searchParams.get(key);
    return param ? param.split(',').map(Number).filter(n => !isNaN(n)) : [];
  };
  
  const updateUrlParams = (updates: Record<string, string | null>) => {
    const params = new URLSearchParams(searchParams.toString());
    Object.entries(updates).forEach(([key, value]) => {
      if (value === null || value === '') {
        params.delete(key);
      } else {
        params.set(key, value);
      }
    });
    router.push(`/classes?${params.toString()}`);
  };
  
  const [page, setPage] = useState(Number(searchParams.get('page')) || 1);
  const [pageSize, setPageSize] = useState(Number(searchParams.get('pageSize')) || 50);
  
  const [searchTerm, setSearchTerm] = useState(getSearchFromUrl);
  const [dayFilter, setDayFilter] = useState<number[]>(getNumberArrayFromUrl('day'));
  
  // Sync from URL params
  useEffect(() => {
    setSearchTerm(getSearchFromUrl());
    setDayFilter(getNumberArrayFromUrl('day'));
    const pageParam = Number(searchParams.get('page'));
    if (pageParam) setPage(pageParam);
    const pageSizeParam = Number(searchParams.get('pageSize'));
    if (pageSizeParam) setPageSize(pageSizeParam);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchParams]);

  const { 
    data, 
    isLoading, 
    error, 
    refetch,
    isFetching 
  } = useClassesMinimalPaginated({
    search: searchTerm,
    daysOfWeek: dayFilter,
    page,
    pageSize,
    orderBy: 'day_of_week',
    ascending: true,
  });

  const classes: (Tables<'classes'> & {
    subject?: Tables<'subjects'> | null;
    students?: Tables<'students'>[];
    staff?: Tables<'staff'>[];
  })[] = (data?.classes as any) || [];
  const total = data?.total ?? 0;
  
  // Modal states - manage internally and use external state only when provided
  const [internalAddModalOpen, setInternalAddModalOpen] = useState(false);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [isDetailModalOpen, setIsDetailModalOpen] = useState(false);
  const [selectedClass, setSelectedClass] = useState<Tables<'classes'> | null>(null);

  // Use external modal state if provided, otherwise use internal state
  const isAddModalOpen = addModalState ? addModalState[0] : internalAddModalOpen;
  const setIsAddModalOpen = addModalState ? addModalState[1] : setInternalAddModalOpen;

  // Cross-feature modal states
  const [selectedStaffId, setSelectedStaffId] = useState<string | null>(null);
  const [isStaffModalOpen, setIsStaffModalOpen] = useState(false);
  const [selectedStudentId, setSelectedStudentId] = useState<string | null>(null);
  const [isStudentModalOpen, setIsStudentModalOpen] = useState(false);

  // Delete dialog state
  const [classToDelete, setClassToDelete] = useState<typeof classes[0] | null>(null);
  const [isClassDeleteDialogOpen, setIsClassDeleteDialogOpen] = useState(false);
  const [deleteConfirmText, setDeleteConfirmText] = useState('');
  const deleteClassMutation = useDeleteClass();
  const { toast } = useToast();

  // Ensure hooks are declared before any early returns
  const parentRef = useRef<HTMLDivElement | null>(null);

  const getSubjectDisplay = (classItem: Tables<'classes'>): string => {
    const subject = (classItem as any).subject as Tables<'subjects'> | null | undefined;
    return subject ? formatSubjectDisplay(subject) : '-';
  };

  const getSubjectBadgeStyle = (classItem: Tables<'classes'>): { style: React.CSSProperties; textColorClass: string; defaultClass: string } => {
    const subject = (classItem as any).subject as Tables<'subjects'> | null | undefined;
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
  }, [searchTerm, dayFilter]);
  
  const getDayOfWeek = (day: number) => {
    const days = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
    return days[day] || 'Unknown';
  };

  

  const getClassStudents = (classItem: Tables<'classes'>): Tables<'students'>[] => {
    return ((classItem as any).students || []) as Tables<'students'>[];
  };

  const getClassStaff = (classItem: Tables<'classes'>): Tables<'staff'>[] => {
    return ((classItem as any).staff || []) as Tables<'staff'>[];
  };
  
  const handleClassClick = (cls: Tables<'classes'>) => {
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

  // Day filter toggle function
  const toggleDay = (day: number) => {
    setDayFilter(prev => {
      if (prev.includes(day)) {
        const next = prev.filter(d => d !== day);
        setPage(1);
        updateUrlParams({ 
          day: next.length > 0 ? next.join(',') : null,
          page: null 
        });
        return next;
      } else {
        const next = [...prev, day];
        setPage(1);
        updateUrlParams({ 
          day: next.join(','),
          page: null 
        });
        return next;
      }
    });
  };

  const clearDayFilter = () => {
    setDayFilter([]);
    setPage(1);
    updateUrlParams({ 
      day: null,
      page: null 
    });
  };

  // Loading state
  if (isLoading && classes.length === 0) {
    return (
      <div className="space-y-4">
        <div className="flex justify-between items-center">
          <div className="relative w-64">
            <Search className="absolute left-2 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search classes"
              className="pl-8"
              value={""}
              disabled
            />
          </div>
          
          <div className="flex items-center gap-1">
            {['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'].map((day) => (
              <Button key={day} variant="outline" size="sm" disabled>
                {day}
              </Button>
            ))}
          </div>
        </div>
        
        <SkeletonTable rows={8} columns={6} />
        
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
      {/* Search and filters with dynamic wrapping */}
      <div className="flex flex-wrap items-center gap-2">
        <div className="relative flex-1 min-w-[200px]">
          <Search className="absolute left-2 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search classes"
            className="pl-8"
            value={searchTerm || ''}
            onChange={(e) => {
              const value = e.target.value;
              setSearchTerm(value);
              setPage(1);
              updateUrlParams({ 
                search: value || null,
                page: null 
              });
            }}
          />
        </div>
        
        <div className="flex flex-wrap items-center gap-1">
          <Button 
            variant={dayFilter.includes(1) ? 'default' : 'outline'} 
            size="sm"
            onClick={() => toggleDay(1)}
          >
            Mon
          </Button>
          <Button 
            variant={dayFilter.includes(2) ? 'default' : 'outline'} 
            size="sm"
            onClick={() => toggleDay(2)}
          >
            Tue
          </Button>
          <Button 
            variant={dayFilter.includes(3) ? 'default' : 'outline'} 
            size="sm"
            onClick={() => toggleDay(3)}
          >
            Wed
          </Button>
          <Button 
            variant={dayFilter.includes(4) ? 'default' : 'outline'} 
            size="sm"
            onClick={() => toggleDay(4)}
          >
            Thu
          </Button>
          <Button 
            variant={dayFilter.includes(5) ? 'default' : 'outline'} 
            size="sm"
            onClick={() => toggleDay(5)}
          >
            Fri
          </Button>
          <Button 
            variant={dayFilter.includes(6) ? 'default' : 'outline'} 
            size="sm"
            onClick={() => toggleDay(6)}
          >
            Sat
          </Button>
          <Button 
            variant={dayFilter.includes(0) ? 'default' : 'outline'} 
            size="sm"
            onClick={() => toggleDay(0)}
          >
            Sun
          </Button>
          {dayFilter.length > 0 && (
            <Button 
              variant="ghost" 
              size="sm"
              onClick={clearDayFilter}
              className="text-muted-foreground hover:text-foreground"
            >
              Clear
            </Button>
          )}
        </div>
      </div>

      <div className="rounded-md border" ref={parentRef}>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>
                  Day
                </TableHead>
                <TableHead>Time</TableHead>
                <TableHead>
                  Subject
                </TableHead>
                <TableHead>Students</TableHead>
                <TableHead>Staff</TableHead>
                <TableHead></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {classes.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={7} className="text-center h-24">
                    {isLoading ? (
                      "Loading classes..."
                    ) : searchTerm || dayFilter.length > 0 ? (
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
                      <TableCell>{getDayOfWeek(cls.day_of_week)}</TableCell>
                      <TableCell>
                        {formatTime(cls.start_time)} - {formatTime(cls.end_time)}
                      </TableCell>
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
                            const subject = (cls as any).subject as Tables<'subjects'> | null | undefined;
                            return subject ? formatSubjectShortName(subject) : '-';
                          })()}</span>
                          <span className="hidden 2xl:inline">{getSubjectDisplay(cls)}</span>
                        </Badge>
                      </TableCell>
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
                      <TableCell onClick={(e) => e.stopPropagation()}>
                        <ActionsMenu
                          type="class"
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
        page={page}
        pageSize={pageSize}
        total={total}
        isFetching={isFetching}
        onPageChange={(newPage) => {
          setPage(newPage);
          updateUrlParams({ page: newPage === 1 ? null : String(newPage) });
        }}
        onPageSizeChange={(size) => {
          setPageSize(size);
          setPage(1);
          updateUrlParams({ 
            pageSize: size === 50 ? null : String(size),
            page: null 
          });
        }}
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