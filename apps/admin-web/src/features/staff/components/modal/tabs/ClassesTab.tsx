import { useState, useMemo } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import type { Tables } from "@altitutor/shared";
import { Button } from "@altitutor/ui";
import { Input } from "@altitutor/ui";
import { ScrollArea } from "@altitutor/ui";
import { Popover, PopoverContent, PopoverTrigger } from "@altitutor/ui";
import { useToast } from "@altitutor/ui";
import { Loader2, Calendar, Plus, Grid3X3 } from "lucide-react";
import { classesApi } from '@/shared/api';
import { formatSubjectDisplay } from '@/shared/utils';
import { ViewClassModal, TimetableView } from '@/features/classes';
import { ClassCard } from '@/shared/components/ClassCard';
import { getDayOfWeek } from '@/shared/utils/datetime';
import { formatTime } from '@/shared/utils/datetime';
import { useStaffClasses, type StaffClass } from '@/features/staff/hooks/useStaffClasses';
import { useClassesWithDetails } from '@/features/classes/hooks/useClassesQuery';

type ViewMode = 'table' | 'timetable';

interface ClassesTabProps {
  staff: Tables<'staff'>;
  onStaffUpdated?: () => void;
}

// Sort classes by day of week, then by start time
const sortClasses = (classes: StaffClass[]): StaffClass[] => {
  return [...classes].sort((a, b) => {
    const dayA = a.class.day_of_week === 0 ? 7 : a.class.day_of_week;
    const dayB = b.class.day_of_week === 0 ? 7 : b.class.day_of_week;
    
    if (dayA !== dayB) {
      return dayA - dayB;
    }
    
    return a.class.start_time.localeCompare(b.class.start_time);
  });
};

export function ClassesTab({
  staff,
  onStaffUpdated
}: ClassesTabProps) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  
  // Use React Query hooks for data fetching
  const { data: classesData = [], isLoading, error } = useStaffClasses(staff.id);
  const { data: allClassesWithDetailsData } = useClassesWithDetails();
  
  // Transform all classes data to StaffClass format
  const allClasses = useMemo(() => {
    if (!allClassesWithDetailsData) return [];
    const { classes, classSubjects, classStaff, classStudents } = allClassesWithDetailsData;
    return sortClasses(classes.map(cls => ({
      class: cls,
      subject: classSubjects[cls.id],
      staff: classStaff[cls.id] || [],
      studentCount: (classStudents[cls.id] || []).length
    })));
  }, [allClassesWithDetailsData]);
  
  const classes = useMemo(() => sortClasses(classesData), [classesData]);
  
  const [assigningClasses, setAssigningClasses] = useState<Set<string>>(new Set());
  const [isAddPopoverOpen, setIsAddPopoverOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [viewMode, setViewMode] = useState<ViewMode>('table');
  
  // Modal state for class viewing
  const [selectedClassId, setSelectedClassId] = useState<string | null>(null);
  const [isClassModalOpen, setIsClassModalOpen] = useState(false);
  
  // Prepare data for timetable view
  const timetableClasses = classes.map(c => c.class);
  const timetableSubjects: Record<string, Tables<'subjects'>> = {};
  const timetableStaff: Record<string, Tables<'staff'>[]> = {};
  classes.forEach(c => {
    if (c.subject) {
      timetableSubjects[c.class.id] = c.subject;
    }
    timetableStaff[c.class.id] = c.staff;
  });

  // Handle class assignment
  const handleAssignClass = async (classId: string) => {
    setAssigningClasses(prev => new Set(prev).add(classId));
    setIsAddPopoverOpen(false); // Close the popover immediately for better UX
    
    try {
      await classesApi.assignStaff(classId, staff.id);
      // Invalidate queries to trigger refetch
      await queryClient.invalidateQueries({ queryKey: ['staff', staff.id, 'classes'] });
      await queryClient.invalidateQueries({ queryKey: ['classes', 'withDetails'] });
      onStaffUpdated?.(); // Notify parent of changes
      
      toast({
        title: "Success",
        description: "Staff assigned to class successfully.",
      });
    } catch (error) {
      console.error('Failed to assign to class:', error);
      toast({
        title: "Assignment failed",
        description: "There was an error assigning the staff member to the class. Please try again.",
        variant: "destructive",
      });
    } finally {
      setAssigningClasses(prev => {
        const newSet = new Set(prev);
        newSet.delete(classId);
        return newSet;
      });
    }
  };

  const handleClassClick = (classId: string) => {
    setSelectedClassId(classId);
    setIsClassModalOpen(true);
  };

  // Get available classes for assignment (not currently assigned)
  const availableClasses = allClasses.filter(classData => 
    !classes.some(staffClass => staffClass.class.id === classData.class.id)
  );

  // Filter available classes based on search query
  const filteredAvailableClasses = availableClasses.filter(classData => {
    if (!searchQuery) return true;
    const query = searchQuery.toLowerCase();
    const subject = classData.subject ? formatSubjectDisplay(classData.subject) : '-';
    const level = classData.class.level || '';
    const day = getDayOfWeek(classData.class.day_of_week);
    const time = `${formatTime(classData.class.start_time)} - ${formatTime(classData.class.end_time)}`;
    
    return (
      subject.toLowerCase().includes(query) ||
      level.toLowerCase().includes(query) ||
      day.toLowerCase().includes(query) ||
      time.toLowerCase().includes(query)
    );
  });

  

  const getSubjectDisplay = (staffClass: StaffClass): string => {
    if (staffClass.subject) {
      return formatSubjectDisplay(staffClass.subject);
    }
    return '-';
  };

  if (isLoading) {
    return (
      <div className="flex-1 flex justify-center items-center">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex-1 flex justify-center items-center">
        <div className="text-center">
          <p className="text-red-500 mb-2">Failed to load classes</p>
          <Button variant="outline" onClick={() => queryClient.invalidateQueries({ queryKey: ['staff', staff.id, 'classes'] })}>
            Try Again
          </Button>
        </div>
      </div>
    );
  }

  if (classes.length === 0 && assigningClasses.size === 0) {
    return (
      <div className="flex-1 flex flex-col justify-center items-center">
        <Calendar className="h-12 w-12 text-muted-foreground mb-2" />
        <p className="text-sm text-muted-foreground mb-4">No classes assigned</p>
        <p className="text-xs text-muted-foreground text-center max-w-sm mb-4">
          This staff member is not currently assigned to any classes.
        </p>
        <Popover>
          <PopoverTrigger asChild>
            <Button variant="outline">
              <Plus className="h-4 w-4 mr-2" />
              Assign to a class
            </Button>
          </PopoverTrigger>
          <PopoverContent className="p-0 w-[400px]" align="center">
            <div className="p-3">
              <Input
                placeholder="Search classes..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="mb-3"
              />
              <ScrollArea className="max-h-[300px]">
                <div className="space-y-1">
                  {filteredAvailableClasses.length === 0 ? (
                    <div className="p-3 text-center text-sm text-muted-foreground">
                      {searchQuery ? 'No classes match your search' : 'No available classes found'}
                    </div>
                  ) : (
                    filteredAvailableClasses.map(classData => (
                      <Button
                        key={classData.class.id}
                        variant="ghost"
                        className="w-full justify-start h-auto p-3 hover:bg-accent hover:text-accent-foreground"
                        onClick={() => handleAssignClass(classData.class.id)}
                        disabled={assigningClasses.has(classData.class.id)}
                      >
                        <div className="flex items-center justify-between w-full">
                          <div className="flex flex-col items-start">
                            <div className="font-medium">
                              {getSubjectDisplay(classData)}
                            </div>
                            <div className="text-xs text-muted-foreground">
                              {getDayOfWeek(classData.class.day_of_week)} • {formatTime(classData.class.start_time)} - {formatTime(classData.class.end_time)}
                            </div>
                          </div>
                          {assigningClasses.has(classData.class.id) && (
                            <Loader2 className="h-4 w-4 animate-spin" />
                          )}
                        </div>
                      </Button>
                    ))
                  )}
                </div>
              </ScrollArea>
            </div>
          </PopoverContent>
        </Popover>
      </div>
    );
  }

  return (
    <div className="flex-1 h-full flex flex-col space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <h3 className="text-base font-medium">Assigned Classes ({classes.length})</h3>
          
          {/* Show currently assigning classes */}
          {assigningClasses.size > 0 && (
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin" />
              <span>Assigning to {assigningClasses.size} class{assigningClasses.size > 1 ? 'es' : ''}...</span>
            </div>
          )}
        </div>
        
        <div className="flex items-center gap-2">
          {/* View Mode Selector */}
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
          
          <Popover open={isAddPopoverOpen} onOpenChange={setIsAddPopoverOpen}>
            <PopoverTrigger asChild>
              <Button variant="outline" size="sm" className="flex items-center gap-2">
                <Plus className="h-4 w-4" />
                <span>Add Class</span>
              </Button>
            </PopoverTrigger>
          <PopoverContent className="p-0 w-[400px]" align="end">
            <div className="p-3">
              <Input
                placeholder="Search classes..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="mb-3"
              />
              <ScrollArea className="max-h-[300px]">
                <div className="space-y-1">
                  {filteredAvailableClasses.length === 0 ? (
                    <div className="p-3 text-center text-sm text-muted-foreground">
                      {searchQuery ? 'No classes match your search' : 'No available classes found'}
                    </div>
                  ) : (
                    filteredAvailableClasses.map(classData => (
                      <Button
                        key={classData.class.id}
                        variant="ghost"
                        className="w-full justify-start h-auto p-3 hover:bg-accent hover:text-accent-foreground"
                        onClick={() => handleAssignClass(classData.class.id)}
                        disabled={assigningClasses.has(classData.class.id)}
                      >
                        <div className="flex items-center justify-between w-full">
                          <div className="flex flex-col items-start">
                            <div className="font-medium">
                              {getSubjectDisplay(classData)}
                            </div>
                            <div className="text-xs text-muted-foreground">
                              {getDayOfWeek(classData.class.day_of_week)} • {formatTime(classData.class.start_time)} - {formatTime(classData.class.end_time)}
                            </div>
                          </div>
                          {assigningClasses.has(classData.class.id) && (
                            <Loader2 className="h-4 w-4 animate-spin" />
                          )}
                        </div>
                      </Button>
                    ))
                  )}
                </div>
              </ScrollArea>
            </div>
          </PopoverContent>
        </Popover>
        </div>
      </div>
      
      {/* Conditional View Rendering */}
      {viewMode === 'table' ? (
        <ScrollArea className="flex-1">
          <div className="space-y-6">
            {/* Show currently assigning classes at the top */}
            {Array.from(assigningClasses).map(classId => {
              const classData = allClasses.find(c => c.class.id === classId);
              if (!classData) return null;
              
              return (
                <ClassCard
                  key={`assigning-${classData.class.id}`}
                  class={classData.class}
                  subject={classData.subject}
                  staff={classData.staff}
                />
              );
            })}
            
            {/* Group classes by day */}
            {(() => {
              const classesByDay: Record<string, StaffClass[]> = {};
              
              classes.forEach(classData => {
                const day = getDayOfWeek(classData.class.day_of_week);
                if (!classesByDay[day]) {
                  classesByDay[day] = [];
                }
                classesByDay[day].push(classData);
              });
              
              // Sort days in weekday order
              const dayOrder = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];
              const sortedDays = Object.keys(classesByDay).sort((a, b) => {
                return dayOrder.indexOf(a) - dayOrder.indexOf(b);
              });
              
              return sortedDays.map(day => (
                <div key={day}>
                  <h4 className="text-sm font-semibold mb-2">{day}</h4>
                  <div className="space-y-2">
                    {classesByDay[day].map(staffClass => (
                      <ClassCard
                        key={staffClass.class.id}
                        class={staffClass.class}
                        subject={staffClass.subject}
                        staff={staffClass.staff}
                        onClick={() => handleClassClick(staffClass.class.id)}
                      />
                    ))}
                  </div>
                </div>
              ));
            })()}
          </div>
        </ScrollArea>
      ) : (
        <div className="flex-1 overflow-hidden">
          <TimetableView
            classes={timetableClasses}
            classSubjects={timetableSubjects}
            classStaff={timetableStaff}
            onClassClick={(cls) => handleClassClick(cls.id)}
          />
        </div>
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
            // Refresh staff classes when class is updated
            queryClient.invalidateQueries({ queryKey: ['staff', staff.id, 'classes'] });
            queryClient.invalidateQueries({ queryKey: ['classes', 'withDetails'] });
          }}
        />
      )}
    </div>
  );
} 