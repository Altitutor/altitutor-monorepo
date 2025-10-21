'use client';

import React, { useState, useEffect, Dispatch, SetStateAction, useMemo, useRef } from 'react';
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
  Grid3X3,
  Plus,
  RefreshCw
} from 'lucide-react';
import { useClassesWithDetails } from '../hooks/useClassesQuery';
import type { Tables } from '@altitutor/shared';
import { cn, formatSubjectDisplay } from '@/shared/utils/index';
import { getSubjectCurriculumColor, getSubjectDisciplineColor } from '@/shared/utils/enum-colors';
import { AddClassModal } from './AddClassModal';
import { EditClassModal } from './EditClassModal';
import { ViewClassModal } from './modal';
import { ViewStaffModal } from '@/features/staff';
import { ViewStudentModal } from '@/features/students';
import { TimetableView } from './TimetableView';
import { formatTime } from '@/shared/utils/datetime';
// import { useVirtualizer } from '@tanstack/react-virtual';

interface ClassesTableProps {
  addModalState?: [boolean, Dispatch<SetStateAction<boolean>>];
}

type ViewMode = 'table' | 'timetable';

export function ClassesTable({ addModalState }: ClassesTableProps) {
  const router = useRouter();
  
  // React Query hook for data fetching
  const { 
    data, 
    isLoading, 
    error, 
    refetch,
    isFetching 
  } = useClassesWithDetails();

  const classes: Tables<'classes'>[] = (data?.classes as Tables<'classes'>[]) || [];
  const classSubjects: Record<string, Tables<'subjects'>> = (data?.classSubjects as Record<string, Tables<'subjects'>>) || {};
  const classStudents: Record<string, Tables<'students'>[]> = (data?.classStudents as Record<string, Tables<'students'>[]>) || {};
  const classStaff: Record<string, Tables<'staff'>[]> = (data?.classStaff as Record<string, Tables<'staff'>[]>) || {};
  
  // Local state for UI
  const [searchTerm, setSearchTerm] = useState('');
  const [dayFilter, setDayFilter] = useState<number[]>([1, 2, 3, 4, 5, 6, 7]);
  const [viewMode, setViewMode] = useState<ViewMode>('table');
  
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
    const subject = classSubjects[classItem.id];
    if (subject) {
      return formatSubjectDisplay(subject);
    }
    return '-';
  };

  const getSubjectBadgeClass = (classItem: Tables<'classes'>): string => {
    const subject = classSubjects[classItem.id];
    if (!subject) return 'bg-gray-100 text-gray-800';
    if ((subject as any).discipline) {
      return getSubjectDisciplineColor((subject as any).discipline as any);
    }
    if ((subject as any).curriculum) {
      return getSubjectCurriculumColor((subject as any).curriculum as any);
    }
    return 'bg-gray-100 text-gray-800';
  };

  // Memoized filtered and sorted classes
  const filteredClasses = useMemo(() => {
    if (!classes.length) return [];
    
    let result = [...classes];
    
    // Apply search term
    if (searchTerm) {
      const searchLower = searchTerm.toLowerCase();
      result = result.filter(cls => {
        const subjectDisplay = getSubjectDisplay(cls).toLowerCase();
        return subjectDisplay.includes(searchLower) ||
               cls.notes?.toLowerCase().includes(searchLower);
      });
    }
    
    // Apply day filter (multi-select)
    if (dayFilter.length > 0) {
      result = result.filter(cls => dayFilter.includes(cls.day_of_week));
    }
    
    // Default sorting: by day (Monday-Sunday), then by start time (earliest to latest)
    result.sort((a, b) => {
      // First sort by day (Monday=1, Tuesday=2, etc., Sunday=0 should be last)
      const dayA = a.day_of_week === 0 ? 7 : a.day_of_week; // Move Sunday to end
      const dayB = b.day_of_week === 0 ? 7 : b.day_of_week;
      
      if (dayA !== dayB) {
        return dayA - dayB;
      }
      
      // If same day, sort by start time
      const timeA = timeToMinutes(a.start_time);
      const timeB = timeToMinutes(b.start_time);
      return timeA - timeB;
    });
    
    return result;
  }, [classes, searchTerm, dayFilter, classSubjects]);

  const getStatusBadgeColor = (status: string) => {
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

  

  const getClassStudents = (classId: string): Tables<'students'>[] => {
    return classStudents[classId] || [];
  };

  const getClassStaff = (classId: string): Tables<'staff'>[] => {
    return classStaff[classId] || [];
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
        return prev.filter(d => d !== day);
      } else {
        return [...prev, day];
      }
    });
  };

  const clearDayFilter = () => {
    setDayFilter([]);
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
                placeholder="Search subject or level..."
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
          
          <div className="flex items-center gap-2">
            <div className="flex rounded-md border">
              <Button variant="default" size="sm" disabled className="rounded-r-none">
                Table
              </Button>
              <Button variant="ghost" size="sm" disabled className="rounded-l-none">
                <Grid3X3 className="h-4 w-4 mr-1" />
                Timetable
              </Button>
            </div>
            <Button variant="outline" size="sm" disabled>
              <RefreshCw className="h-4 w-4 mr-2" />
              Refresh
            </Button>
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
              placeholder="Search subject or level..."
              className="pl-8"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
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
        
        <div className="flex items-center gap-2">
          <div className="flex rounded-md border">
            <Button 
              variant={viewMode === 'table' ? 'default' : 'ghost'} 
              size="sm"
              onClick={() => setViewMode('table')}
              className="rounded-r-none"
            >
              Table
            </Button>
            <Button 
              variant={viewMode === 'timetable' ? 'default' : 'ghost'} 
              size="sm"
              onClick={() => setViewMode('timetable')}
              className="rounded-l-none"
            >
              <Grid3X3 className="h-4 w-4 mr-1" />
              Timetable
            </Button>
          </div>
          
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

      {viewMode === 'table' && (
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
              {filteredClasses.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={6} className="text-center h-24">
                    {isLoading ? (
                      "Loading classes..."
                    ) : searchTerm || dayFilter.length < 7 ? (
                      "No classes match your filters"
                    ) : (
                      "No classes found"
                    )}
                  </TableCell>
                </TableRow>
              ) : (
                filteredClasses.map((cls, index) => {
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
                        <Badge className={cn("text-xs", getSubjectBadgeClass(cls))}>
                          {getSubjectDisplay(cls)}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <div className="space-y-1">
                          {getClassStudents(cls.id).length === 0 ? (
                            <div className="text-muted-foreground text-sm">No students</div>
                          ) : (
                            getClassStudents(cls.id).map((student) => (
                              <div 
                                key={student.id} 
                                className="text-sm text-blue-600 hover:text-blue-800 cursor-pointer hover:underline"
                                onClick={(e) => handleStudentClick(student.id, e)}
                              >
                                {student.first_name} {student.last_name}
                              </div>
                            ))
                          )}
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="space-y-1">
                          {getClassStaff(cls.id).length === 0 ? (
                            <div className="text-muted-foreground text-sm">No staff</div>
                          ) : (
                            getClassStaff(cls.id).map((staff) => (
                              <div 
                                key={staff.id} 
                                className="text-sm text-blue-600 hover:text-blue-800 cursor-pointer hover:underline"
                                onClick={(e) => handleStaffClick(staff.id, e)}
                              >
                                {staff.first_name} {staff.last_name}
                              </div>
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
      )}

      {viewMode === 'timetable' && (
        <TimetableView
          classes={filteredClasses}
          classSubjects={classSubjects}
          classStudents={classStudents}
          classStaff={classStaff}
          onClassClick={handleClassClick}
        />
      )}
      
      <div className="text-sm text-muted-foreground">
        {filteredClasses.length} classes displayed
        {isFetching && <span className="ml-2">(Refreshing...)</span>}
      </div>

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
      {selectedStudentId && (
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
      )}
    </div>
  );
} 