'use client';

import { useState, useEffect, Dispatch, SetStateAction, useCallback } from 'react';
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
  Grid3X3,
  Plus
} from 'lucide-react';
import { useClasses } from '../hooks';
import { classesApi } from '../api';
import { Class, ClassStatus, Subject, Student, Staff } from '@/shared/lib/supabase/db/types';
import { cn, formatSubjectDisplay } from '@/shared/utils/index';
import { AddClassModal } from './AddClassModal';
import { EditClassModal } from './EditClassModal';
import { ViewClassModal } from './modal';
import { ViewStaffModal } from '@/features/staff';
import { ViewStudentModal } from '@/features/students';
import { TimetableView } from './TimetableView';

interface ClassesTableProps {
  addModalState?: [boolean, Dispatch<SetStateAction<boolean>>];
}

type ViewMode = 'table' | 'timetable';

export function ClassesTable({ addModalState }: ClassesTableProps) {
  const router = useRouter();
  const { 
    items: classes, 
    loading, 
    error, 
    fetchAll, 
    update, 
    remove 
  } = useClasses();
  
  const [filteredClasses, setFilteredClasses] = useState<Class[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [dayFilter, setDayFilter] = useState<number[]>([1, 2, 3, 4, 5, 6, 7]);
  const [viewMode, setViewMode] = useState<ViewMode>('table');
  
  // Additional state for detailed data
  const [classesWithDetails, setClassesWithDetails] = useState<{
    classes: Class[];
    classSubjects: Record<string, Subject>;
    classStudents: Record<string, Student[]>;
    classStaff: Record<string, Staff[]>;
  } | null>(null);
  const [detailsLoading, setDetailsLoading] = useState(false);
  
  // Modal states - manage internally and use external state only when provided
  const [internalAddModalOpen, setInternalAddModalOpen] = useState(false);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [isDetailModalOpen, setIsDetailModalOpen] = useState(false);
  const [selectedClass, setSelectedClass] = useState<Class | null>(null);

  // Use external modal state if provided, otherwise use internal state
  const isAddModalOpen = addModalState ? addModalState[0] : internalAddModalOpen;
  const setIsAddModalOpen = addModalState ? addModalState[1] : setInternalAddModalOpen;

  // Cross-feature modal states
  const [selectedStaffId, setSelectedStaffId] = useState<string | null>(null);
  const [isStaffModalOpen, setIsStaffModalOpen] = useState(false);
  const [selectedStudentId, setSelectedStudentId] = useState<string | null>(null);
  const [isStudentModalOpen, setIsStudentModalOpen] = useState(false);

  // Function to fetch detailed data
  const fetchAllWithDetails = useCallback(async () => {
    setDetailsLoading(true);
    try {
      const details = await classesApi.getAllClassesWithDetails();
      setClassesWithDetails(details);
    } catch (err) {
      console.error('Error fetching classes with details:', err);
    } finally {
      setDetailsLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchAllWithDetails();
  }, [fetchAllWithDetails]);

  useEffect(() => {
    const sourceClasses = classesWithDetails?.classes || [];
    if (!sourceClasses.length) return;
    
    let result = [...sourceClasses];
    
    // Apply search term
    if (searchTerm) {
      const searchLower = searchTerm.toLowerCase();
      result = result.filter(cls => {
        const subjectDisplay = getSubjectDisplay(cls).toLowerCase();
        return cls.level.toLowerCase().includes(searchLower) ||
               subjectDisplay.includes(searchLower) ||
               cls.notes?.toLowerCase().includes(searchLower);
      });
    }
    
    // Apply day filter (multi-select)
    if (dayFilter.length > 0) {
      result = result.filter(cls => dayFilter.includes(cls.dayOfWeek));
    }
    
    // Default sorting: by day (Monday-Sunday), then by start time (earliest to latest)
    result.sort((a, b) => {
      // First sort by day (Monday=1, Tuesday=2, etc., Sunday=0 should be last)
      const dayA = a.dayOfWeek === 0 ? 7 : a.dayOfWeek; // Move Sunday to end
      const dayB = b.dayOfWeek === 0 ? 7 : b.dayOfWeek;
      
      if (dayA !== dayB) {
        return dayA - dayB;
      }
      
      // If same day, sort by start time
      const timeA = timeToMinutes(a.startTime);
      const timeB = timeToMinutes(b.startTime);
      return timeA - timeB;
    });
    
    setFilteredClasses(result);
  }, [classesWithDetails, searchTerm, dayFilter]);

  // Helper function to convert time to minutes for sorting
  const timeToMinutes = (timeString: string): number => {
    if (!timeString) return 0;
    const [hours, minutes] = timeString.split(':').map(Number);
    return hours * 60 + minutes;
  };

  const getStatusBadgeColor = (status: ClassStatus) => {
    switch (status) {
      case ClassStatus.ACTIVE:
        return 'bg-green-100 text-green-800';
      case ClassStatus.INACTIVE:
        return 'bg-gray-100 text-gray-800';
      case ClassStatus.FULL:
        return 'bg-orange-100 text-orange-800';
      default:
        return 'bg-gray-100 text-gray-800';
    }
  };
  
  const getDayOfWeek = (day: number) => {
    const days = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
    return days[day] || 'Unknown';
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

  const getSubjectDisplay = (classItem: Class): string => {
    if (!classesWithDetails || !classItem.subjectId) {
      return classItem.level;
    }
    
    const subject = classesWithDetails.classSubjects[classItem.id];
    if (subject) {
      return formatSubjectDisplay(subject);
    }
    
    return classItem.level;
  };

  const getClassStudents = (classId: string): Student[] => {
    return classesWithDetails?.classStudents[classId] || [];
  };

  const getClassStaff = (classId: string): Staff[] => {
    return classesWithDetails?.classStaff[classId] || [];
  };
  
  const handleClassClick = (cls: Class) => {
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

  const handleClassUpdated = useCallback(() => {
    setIsEditModalOpen(false);
    setIsDetailModalOpen(false);
    setSelectedClass(null);
    fetchAll();
    fetchAllWithDetails(); // Refresh detailed data too
  }, [fetchAll, fetchAllWithDetails]);

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

  if (loading || detailsLoading) {
    return <div>Loading classes...</div>;
  }

  if (error) {
    return <div className="text-red-500">Error loading classes: {error}</div>;
  }

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
          
          <Button onClick={() => setIsAddModalOpen(true)}>
            <Plus className="h-4 w-4 mr-2" />
            Add Class
          </Button>
        </div>
      </div>

      {viewMode === 'table' && (
        <div className="rounded-md border">
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
                <TableHead>Level</TableHead>
                <TableHead>Students</TableHead>
                <TableHead>Staff</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredClasses.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={6} className="text-center h-24">
                    {searchTerm || dayFilter.length < 7 
                      ? "No classes match your filters" 
                      : "No classes found"}
                  </TableCell>
                </TableRow>
              ) : (
                filteredClasses.map((cls) => (
                  <TableRow 
                    key={cls.id} 
                    className="cursor-pointer hover:bg-muted/50"
                    onClick={() => handleClassClick(cls)}
                  >
                    <TableCell>{getDayOfWeek(cls.dayOfWeek)}</TableCell>
                    <TableCell>
                      {formatTime(cls.startTime)} - {formatTime(cls.endTime)}
                    </TableCell>
                    <TableCell className="font-medium">
                      {getSubjectDisplay(cls)}
                    </TableCell>
                    <TableCell>{cls.level}</TableCell>
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
                              {student.firstName} {student.lastName}
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
                              {staff.firstName} {staff.lastName}
                            </div>
                          ))
                        )}
                      </div>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </div>
      )}

      {viewMode === 'timetable' && (
        <div className="h-[600px]">
          <TimetableView
            classes={filteredClasses}
            classSubjects={classesWithDetails?.classSubjects}
            classStudents={classesWithDetails?.classStudents}
            classStaff={classesWithDetails?.classStaff}
            onClassClick={handleClassClick}
          />
        </div>
      )}

      {/* Add Class Modal */}
      <AddClassModal 
        isOpen={isAddModalOpen} 
        onClose={() => setIsAddModalOpen(false)} 
        onClassAdded={() => {
          fetchAll();
          fetchAllWithDetails();
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
            fetchAll();
            fetchAllWithDetails();
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
            fetchAll();
            fetchAllWithDetails();
          }}
        />
      )}
    </div>
  );
} 