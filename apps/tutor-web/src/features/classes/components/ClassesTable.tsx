'use client';

import React, { useState, Dispatch, SetStateAction, useMemo, useRef } from 'react';
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
  Grid3X3
} from 'lucide-react';
import { useClasses } from '../hooks/useClassesQuery';
import type { Tables, Database } from '@altitutor/shared';
import { cn, formatSubjectDisplay, formatSubjectShortName, getSubjectColorStyle } from '@/shared/utils/index';

type TutorClass = Database['public']['Views']['vtutor_classes']['Row'];
import { filterClassesBySearch, filterClassesByDay, sortClassesByDayAndTime } from '@/shared/utils/tableSorting';
// import { AddClassModal } from './AddClassModal'; // TODO: Tutors can't create classes - removed
// import { EditClassModal } from './EditClassModal'; // TODO: Tutors can't edit classes - removed
import { ViewClassModal } from './modal';
// import { ViewStaffModal } from '@/features/staff'; // Tutors can't view other staff - removed
// import { ViewStudentModal } from '@/features/students'; // TODO: Tutor-web doesn't have students feature
import { TimetableView } from './TimetableView';
import { formatTime } from '@/shared/utils/datetime';
// import { useVirtualizer } from '@tanstack/react-virtual';

interface ClassesTableProps {
  addModalState?: [boolean, Dispatch<SetStateAction<boolean>>];
}

type ViewMode = 'table' | 'timetable';

export function ClassesTable({ addModalState }: ClassesTableProps) {
  const router = useRouter();
  
  // React Query hook for data fetching - uses vtutor_classes view
  const { 
    data: classesData, 
    isLoading, 
    error, 
    refetch,
    isFetching 
  } = useClasses();

  // vtutor_classes returns classes with flattened subject fields
  const tutorClasses = (classesData || []) as TutorClass[];
  
  // Convert TutorClass to Tables<'classes'> format for compatibility with helper functions
  // Filter out classes missing required fields (start_time, end_time, status are required in Tables<'classes'>)
  const classes: Tables<'classes'>[] = tutorClasses
    .filter((cls): cls is TutorClass & { 
      id: string; 
      day_of_week: number;
      start_time: string;
      end_time: string;
      status: string;
    } => 
      cls.id !== null && 
      cls.day_of_week !== null &&
      cls.start_time !== null &&
      cls.end_time !== null &&
      cls.status !== null
    )
    .map((cls) => ({
      id: cls.id!,
      day_of_week: cls.day_of_week!,
      start_time: cls.start_time!,
      end_time: cls.end_time!,
      level: cls.level,
      room: cls.room,
      status: cls.status!,
      subject_id: cls.subject_id,
      created_at: cls.created_at,
      updated_at: cls.updated_at,
      created_by: null, // Not available in vtutor_classes view
      session_start_date: null, // Not available in vtutor_classes view
      session_end_date: null, // Not available in vtutor_classes view
    }));
  
  // Build subject objects from flattened fields for compatibility
  const classSubjects: Record<string, Tables<'subjects'>> = {};
  tutorClasses.forEach((cls) => {
    // Only create subject if we have required fields (id and name are required)
    if (cls.subject_id && cls.id && cls.subject_name) {
      classSubjects[cls.id] = {
        id: cls.subject_id,
        name: cls.subject_name,
        curriculum: cls.subject_curriculum,
        discipline: cls.subject_discipline,
        level: cls.subject_level,
        color: cls.subject_color,
        year_level: cls.subject_year_level,
        short_name: null,
        long_name: null,
        created_at: null,
        updated_at: null,
      };
    }
  });
  
  // Students and staff are not in vtutor_classes - they're in vtutor_class_detail
  // These will be fetched when viewing individual class details
  const classStudents: Record<string, Tables<'students'>[]> = {};
  const classStaff: Record<string, Tables<'staff'>[]> = {};
  
  // Local state for UI
  const [searchTerm, setSearchTerm] = useState('');
  const [dayFilter, setDayFilter] = useState<number[]>([1, 2, 3, 4, 5, 6, 7]);
  const [viewMode, setViewMode] = useState<ViewMode>('table');
  
  // Modal states - tutors can only view, not edit
  const [isDetailModalOpen, setIsDetailModalOpen] = useState(false);
  const [selectedClass, setSelectedClass] = useState<Tables<'classes'> | null>(null);

  // Ensure hooks are declared before any early returns
  const parentRef = useRef<HTMLDivElement | null>(null);

  const getSubjectDisplay = (classItem: Tables<'classes'>): string => {
    const subject = classSubjects[classItem.id];
    if (subject) {
      return formatSubjectDisplay(subject);
    }
    return '-';
  };

  const getSubjectBadgeStyle = (classItem: Tables<'classes'>): { style: React.CSSProperties; textColorClass: string; defaultClass: string } => {
    const subject = classSubjects[classItem.id];
    if (!subject) {
      return { style: {}, textColorClass: 'text-gray-800', defaultClass: 'bg-gray-100 text-gray-800' };
    }
    const { style, textColorClass } = getSubjectColorStyle(subject as Tables<'subjects'>);
    const defaultClass = !subject.color ? 'bg-gray-100 text-gray-800' : '';
    return { style, textColorClass, defaultClass };
  };

  // Memoized filtered and sorted classes
  const filteredClasses = useMemo(() => {
    if (!classes.length) return [];
    
    let result = [...classes];
    
    // Apply search term
    result = filterClassesBySearch(result, searchTerm, getSubjectDisplay);
    
    // Apply day filter (multi-select)
    result = filterClassesByDay(result, dayFilter);
    
    // Default sorting: by day (Monday-Sunday), then by start time (earliest to latest)
    result = sortClassesByDayAndTime(result);
    
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

  

  // Note: Students and staff are not available in list view
  // They're only available when viewing individual class details via vtutor_class_detail
  
  const handleClassClick = (cls: any) => {
    setSelectedClass(cls);
    setIsDetailModalOpen(true);
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
          </div>
        </div>
        
        <SkeletonTable rows={8} columns={5} />
        
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
                <TableHead>Room</TableHead>
                <TableHead>Status</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredClasses.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={5} className="text-center h-24">
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
                      <TableCell>{cls.day_of_week !== null ? getDayOfWeek(cls.day_of_week) : '-'}</TableCell>
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
                            const subject = cls.id ? classSubjects[cls.id] : undefined;
                            return subject ? formatSubjectShortName(subject) : '-';
                          })()}</span>
                          <span className="hidden 2xl:inline">{getSubjectDisplay(cls)}</span>
                        </Badge>
                      </TableCell>
                      <TableCell>{cls.room || '-'}</TableCell>
                      <TableCell>
                        <Badge className={cls.status ? getStatusBadgeColor(cls.status) : 'bg-gray-100 text-gray-800'}>
                          {cls.status || '-'}
                        </Badge>
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

      {/* Class Detail Modal - Tutors can only view, not edit */}
      {selectedClass && (
        <ViewClassModal 
          isOpen={isDetailModalOpen}
          onClose={() => setIsDetailModalOpen(false)}
          classId={selectedClass.id}
          onClassUpdated={handleClassUpdated}
        />
      )}
      
      {/* Staff Modal */}
      {/* Staff Modal - removed for tutors */}
      {/* {selectedStaffId && (
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
      )} */}
      
      {/* Student Modal - TODO: Tutor-web doesn't have students feature */}
      {/* <ViewStudentModal
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
      /> */}
    </div>
  );
} 