import { useState, useMemo, useEffect, useCallback } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import type { Tables } from "@altitutor/shared";
import { Button } from "@altitutor/ui";
import { ScrollArea } from "@altitutor/ui";
import { Tabs, TabsList, TabsTrigger } from "@altitutor/ui";
import { Badge } from "@altitutor/ui";
import { useToast } from "@altitutor/ui";
import { Loader2, Plus, Pencil, X } from "lucide-react";
import { classesApi } from '@/shared/api';
import { ViewClassModal, CalendarView } from '@/features/classes';
import { ClassCard } from '@/shared/components/ClassCard';
import { useStaffClasses, type StaffClass } from '@/features/staff/hooks/useStaffClasses';
import { useClassesWithDetails } from '@/features/classes/hooks/useClassesQuery';
import { useStaffWithSubjectsById, staffKeys, useCurrentStaff } from '@/features/staff/hooks/useStaffQuery';
import { staffApi } from '@/features/staff/api/staff';
import { SubjectSearchPopover } from '@/features/subjects/components/SubjectSearchPopover';
import { useSubjectsList } from '@/features/subjects/hooks/useSubjectsQuery';
import { formatSubjectShortName, getSubjectColorStyle } from '@/shared/utils';
import { getDayOfWeek } from '@/shared/utils/datetime';
import { AssignStaffModal } from '@/features/enrollments';

type ViewMode = 'table' | 'calendar';

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
  const { data: staffWithSubjects } = useStaffWithSubjectsById(staff.id);
  
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
  const staffSubjects = useMemo(() => (staffWithSubjects?.subjects || []) as Tables<'subjects'>[], [staffWithSubjects?.subjects]);
  
  const [assigningClasses] = useState<Set<string>>(new Set());
  const [viewMode, setViewMode] = useState<ViewMode>('table');
  
  // Subjects editing state
  const [isEditingSubjects, setIsEditingSubjects] = useState(false);
  const [tempStaffSubjects, setTempStaffSubjects] = useState<Tables<'subjects'>[]>([]);
  const { data: subjectsListData } = useSubjectsList({ limit: 100, offset: 0 });
  const initialFilteredSubjects = subjectsListData?.subjects ?? [];
  
  // Modal state for class viewing
  const [selectedClassId, setSelectedClassId] = useState<string | null>(null);
  const [isClassModalOpen, setIsClassModalOpen] = useState(false);
  
  // Assign staff modal state
  const [isAssignStaffModalOpen, setIsAssignStaffModalOpen] = useState(false);
  
  // Get current staff for assignment
  const { data: currentStaff } = useCurrentStaff();

  // Memoize the close handler to prevent infinite loops
  const handleCloseAssignModal = useCallback(() => {
    setIsAssignStaffModalOpen(false);
  }, []);
  
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

  // Handle class assignment (used by modal)
  const handleAssignStaff = useCallback(async (params: {
    staffId: string;
    classId: string;
    assignedAt: Date;
    currentStaffId: string;
  }) => {
    try {
      await classesApi.assignStaff(params.classId, params.staffId, params.currentStaffId);
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
      throw error;
    }
  }, [staff.id, queryClient, onStaffUpdated, toast]);

  const handleClassClick = (classId: string) => {
    setSelectedClassId(classId);
    setIsClassModalOpen(true);
  };

  


  // Handle starting subject edit
  const handleStartEditSubjects = () => {
    setTempStaffSubjects([...staffSubjects]);
    setIsEditingSubjects(true);
  };

  // Handle canceling subject edit
  const handleCancelEditSubjects = () => {
    setTempStaffSubjects([]);
    setIsEditingSubjects(false);
  };

  // Handle adding a subject
  const handleAddSubject = (subject: Tables<'subjects'>) => {
    if (!tempStaffSubjects.some(s => s.id === subject.id)) {
      setTempStaffSubjects([...tempStaffSubjects, subject]);
    }
  };

  // Handle removing a subject
  const handleRemoveSubject = (subjectId: string) => {
    setTempStaffSubjects(tempStaffSubjects.filter(s => s.id !== subjectId));
  };

  // Handle saving subject changes
  const handleSaveSubjects = async () => {
    try {
      const currentSubjectIds = new Set(staffSubjects.map(s => s.id));
      const newSubjectIds = new Set(tempStaffSubjects.map(s => s.id));

      // Find subjects to add
      const subjectsToAdd = tempStaffSubjects.filter(s => !currentSubjectIds.has(s.id));
      // Find subjects to remove
      const subjectsToRemove = staffSubjects.filter(s => !newSubjectIds.has(s.id));

      // Apply changes
      for (const subject of subjectsToAdd) {
        await staffApi.assignSubjectToStaff(staff.id, subject.id);
      }
      for (const subject of subjectsToRemove) {
        await staffApi.removeSubjectFromStaff(staff.id, subject.id);
      }

      // Invalidate queries to refetch
      await queryClient.invalidateQueries({ queryKey: staffKeys.detail(staff.id) });
      await queryClient.invalidateQueries({ queryKey: staffKeys.detailFull(staff.id) });
      await queryClient.invalidateQueries({ queryKey: ['staff', staff.id, 'classes'] });
      
      setIsEditingSubjects(false);
      setTempStaffSubjects([]);
      onStaffUpdated?.();

      toast({
        title: 'Success',
        description: 'Subjects updated successfully.',
      });
    } catch (error) {
      console.error('Failed to update subjects:', error);
      toast({
        title: 'Update failed',
        description: 'There was an error updating subjects. Please try again.',
        variant: 'destructive',
      });
    }
  };

  // Get display subjects (temp when editing, actual otherwise)
  const displaySubjects = isEditingSubjects ? tempStaffSubjects : staffSubjects;

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
      <div className="flex-1 h-full flex flex-col space-y-4">
        {/* Subjects Section */}
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <h3 className="text-base font-medium">Subjects</h3>
            {!isEditingSubjects ? (
              <Button
                variant="outline"
                size="sm"
                onClick={handleStartEditSubjects}
              >
                <Pencil className="h-4 w-4 mr-2" />
                Edit
              </Button>
            ) : (
              <div className="flex items-center gap-2">
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={handleCancelEditSubjects}
                >
                  Cancel
                </Button>
                <Button
                  variant="default"
                  size="sm"
                  onClick={handleSaveSubjects}
                >
                  Save
                </Button>
              </div>
            )}
          </div>
          <div className="flex flex-wrap gap-2">
            {displaySubjects.length > 0 ? (
              displaySubjects.map((subject) => {
                const shortName = formatSubjectShortName(subject);
                const { style, textColorClass } = getSubjectColorStyle(subject);
                const defaultClass = !subject.color ? 'bg-gray-100 text-gray-800' : '';
                return (
                  <Badge
                    key={subject.id}
                    className={defaultClass || `${textColorClass} cursor-pointer hover:opacity-80 flex items-center gap-1 pr-1`}
                    style={style.backgroundColor ? style : undefined}
                  >
                    <span>{shortName}</span>
                    {isEditingSubjects && (
                      <button
                        type="button"
                        className="ml-1 rounded-full hover:bg-black/20 p-0.5 flex items-center justify-center"
                        onClick={(e) => {
                          e.stopPropagation();
                          handleRemoveSubject(subject.id);
                        }}
                      >
                        <X className="h-3 w-3" />
                      </button>
                    )}
                  </Badge>
                );
              })
            ) : (
              <p className="text-sm text-muted-foreground">No subjects assigned</p>
            )}
            {isEditingSubjects && (
              <SubjectSearchPopover
                selectedSubjects={tempStaffSubjects}
                onSelectSubject={handleAddSubject}
                initialSubjects={initialFilteredSubjects}
                trigger={
                  <Button variant="outline" size="sm" className="flex items-center gap-2">
                    <Plus className="h-4 w-4" />
                    <span>Add Subject</span>
                  </Button>
                }
              />
            )}
          </div>
        </div>

        {/* Classes Section */}
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <h3 className="text-base font-medium">Classes</h3>
            {currentStaff && (
              <Button 
                variant="outline" 
                size="sm" 
                className="flex items-center gap-2"
                onClick={() => setIsAssignStaffModalOpen(true)}
              >
                <Plus className="h-4 w-4" />
                <span>Add Class</span>
              </Button>
            )}
          </div>
          <div className="py-4">
            <p className="text-sm text-muted-foreground">
              This staff member is not currently assigned to any classes.
            </p>
          </div>
        </div>
        
        {/* Assign Staff Modal */}
        {currentStaff && (
          <AssignStaffModal
            isOpen={isAssignStaffModalOpen}
            onClose={handleCloseAssignModal}
            context="staff"
            staff={staff}
            staffSubjects={staffSubjects}
            assignedClassIds={classes.map(c => c.class.id)}
            onAssign={handleAssignStaff}
            currentStaffId={currentStaff.id}
          />
        )}
      </div>
    );
  }

  return (
    <div className="flex-1 h-full flex flex-col space-y-4">
      {/* Subjects Section */}
      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <h3 className="text-base font-medium">Subjects</h3>
          {!isEditingSubjects ? (
            <Button
              variant="outline"
              size="sm"
              onClick={handleStartEditSubjects}
            >
              <Pencil className="h-4 w-4 mr-2" />
              Edit
            </Button>
          ) : (
            <div className="flex items-center gap-2">
              <Button
                variant="ghost"
                size="sm"
                onClick={handleCancelEditSubjects}
              >
                Cancel
              </Button>
              <Button
                variant="default"
                size="sm"
                onClick={handleSaveSubjects}
              >
                Save
              </Button>
            </div>
          )}
        </div>
        <div className="flex flex-wrap gap-2">
          {displaySubjects.length > 0 ? (
            displaySubjects.map((subject) => {
              const shortName = formatSubjectShortName(subject);
              const { style, textColorClass } = getSubjectColorStyle(subject);
              const defaultClass = !subject.color ? 'bg-gray-100 text-gray-800' : '';
              return (
                <Badge
                  key={subject.id}
                  className={defaultClass || `${textColorClass} cursor-pointer hover:opacity-80 flex items-center gap-1 pr-1`}
                  style={style.backgroundColor ? style : undefined}
                >
                  <span>{shortName}</span>
                  {isEditingSubjects && (
                    <button
                      type="button"
                      className="ml-1 rounded-full hover:bg-black/20 p-0.5 flex items-center justify-center"
                      onClick={(e) => {
                        e.stopPropagation();
                        handleRemoveSubject(subject.id);
                      }}
                    >
                      <X className="h-3 w-3" />
                    </button>
                  )}
                </Badge>
              );
            })
          ) : (
            <p className="text-sm text-muted-foreground">No subjects assigned</p>
          )}
          {isEditingSubjects && (
            <SubjectSearchPopover
              selectedSubjects={tempStaffSubjects}
              onSelectSubject={handleAddSubject}
              initialSubjects={initialFilteredSubjects}
              trigger={
                <Button variant="outline" size="sm" className="flex items-center gap-2">
                  <Plus className="h-4 w-4" />
                  <span>Add Subject</span>
                </Button>
              }
            />
          )}
        </div>
      </div>

      {/* Classes Section */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <h3 className="text-base font-medium">Classes ({classes.length})</h3>
          
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
          <Tabs value={viewMode} onValueChange={(v) => setViewMode(v as ViewMode)}>
            <TabsList>
              <TabsTrigger value="table">Table</TabsTrigger>
              <TabsTrigger value="calendar">Calendar</TabsTrigger>
            </TabsList>
          </Tabs>
          
          <Button 
            variant="outline" 
            size="sm" 
            className="flex items-center gap-2"
            onClick={() => setIsAssignStaffModalOpen(true)}
          >
            <Plus className="h-4 w-4" />
            <span>Add Class</span>
          </Button>
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
              const students = allClassesWithDetailsData?.classStudents?.[classId] || [];
              
              return (
                <ClassCard
                  key={`assigning-${classData.class.id}`}
                  class={classData.class}
                  subject={classData.subject}
                  staff={classData.staff}
                  students={students}
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
                    {classesByDay[day].map(staffClass => {
                      const students = allClassesWithDetailsData?.classStudents?.[staffClass.class.id] || [];
                      return (
                        <ClassCard
                          key={staffClass.class.id}
                          class={staffClass.class}
                          subject={staffClass.subject}
                          staff={staffClass.staff}
                          students={students}
                          onClick={() => handleClassClick(staffClass.class.id)}
                        />
                      );
                    })}
                  </div>
                </div>
              ));
            })()}
          </div>
        </ScrollArea>
      ) : (
        <div className="flex-1 overflow-hidden">
          <CalendarView
            classes={timetableClasses}
            classSubjects={timetableSubjects}
            classStaff={timetableStaff}
            onClassClick={(cls) => handleClassClick(cls.id)}
            showFilters={false}
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
      
      {/* Assign Staff Modal */}
      {currentStaff && (
        <AssignStaffModal
          isOpen={isAssignStaffModalOpen}
          onClose={handleCloseAssignModal}
          context="staff"
          staff={staff}
          staffSubjects={staffSubjects}
          assignedClassIds={classes.map(c => c.class.id)}
          onAssign={handleAssignStaff}
          currentStaffId={currentStaff.id}
        />
      )}
    </div>
  );
} 