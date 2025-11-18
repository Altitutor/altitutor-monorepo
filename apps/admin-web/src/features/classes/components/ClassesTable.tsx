'use client';

import React, { useState, Dispatch, SetStateAction, useEffect, useRef } from 'react';
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
  Search
} from 'lucide-react';
import { TablePagination } from '@/shared/components/TablePagination';
import { useClassesMinimalPaginated } from '../hooks/useClassesQuery';
import type { Tables } from '@altitutor/shared';
import { cn, formatSubjectDisplay, formatSubjectShortName, getSubjectColorStyle } from '@/shared/utils/index';
import { AddClassModal } from './AddClassModal';
import { EditClassModal } from './EditClassModal';
import { ViewClassModal } from './modal';
import { ViewStaffModal } from '@/features/staff';
import { ViewStudentModal } from '@/features/students';
import { formatTime } from '@/shared/utils/datetime';
// import { useVirtualizer } from '@tanstack/react-virtual';

interface ClassesTableProps {
  addModalState?: [boolean, Dispatch<SetStateAction<boolean>>];
  viewMode?: 'table';
}

export function ClassesTable({ addModalState }: ClassesTableProps) {
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(50);
  
  const [searchTerm, setSearchTerm] = useState('');
  const [dayFilter, setDayFilter] = useState<number[]>([]);

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

  // Ensure hooks are declared before any early returns
  const parentRef = useRef<HTMLDivElement | null>(null);

  // Helper function to convert time to minutes for sorting - moved before useMemo
  const timeToMinutes = (timeString: string): number => {
    if (!timeString) return 0;
    const [hours, minutes] = timeString.split(':').map(Number);
    return hours * 60 + minutes;
  };

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

  const _getStatusBadgeColor = (status: string) => {
    switch (status) {
      case 'ACTIVE':
        return 'bg-green-100 text-green-800';
      case 'INACTIVE':
        return 'bg-gray-100 text-gray-800';
      case 'FULL':
        return 'bg-orange-100 text-orange-800';
      default:
        return 'bg-gray-100 text-gray-800';
    }
  };
  
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
        return next;
      } else {
        const next = [...prev, day];
        setPage(1);
        return next;
      }
    });
  };

  const clearDayFilter = () => {
    setDayFilter([]);
    setPage(1);
  };

  // Loading state
  if (isLoading && classes.length === 0) {
    return (
      <div className="space-y-4">
        <div className="flex justify-between items-center">
          <div className="flex items-center gap-4">
            <div className="relative w-64">
              <Search className="absolute left-2 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search by subject, student, or staff..."
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
      <div className="flex justify-between items-center">
        <div className="flex items-center gap-4">
          <div className="relative w-64">
            <Search className="absolute left-2 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search by subject, student, or staff..."
              className="pl-8"
              value={searchTerm || ''}
              onChange={(e) => {
                setSearchTerm(e.target.value);
                setPage(1);
              }}
            />
          </div>
          
          <div className="flex items-center gap-1">
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
              </TableRow>
            </TableHeader>
            <TableBody>
              {classes.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={6} className="text-center h-24">
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
        onPageChange={setPage}
        onPageSizeChange={(size) => {
          setPageSize(size);
          setPage(1);
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
    </div>
  );
} 