import { useState, useMemo, useCallback, useEffect } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import type { Tables, ClassWithExpandedSubject } from "@altitutor/shared";
import { Button } from "@altitutor/ui";
import { ScrollArea } from "@altitutor/ui";
import { Tabs, TabsList, TabsTrigger } from "@altitutor/ui";
import { Badge } from "@altitutor/ui";
import { useToast } from "@altitutor/ui";
import { Loader2, Plus, Pencil, X } from "lucide-react";
import { classesApi } from '@/shared/api';
import { ViewClassModal, CalendarView } from '@/features/classes';
import { ClassCard } from '@/shared/components/ClassCard';
import { EnrollStudentModal, ChangeClassModal, UnenrollStudentModal } from '@/shared/components/modals';
import { getDayOfWeek } from '@/shared/utils/datetime';
import { useCurrentStaff } from '@/features/staff/hooks/useStaffQuery';
import { useStudentClasses, useAllClassesForStudent, type StudentClass } from '@/features/students/hooks/useStudentClasses';
import { useStudentWithSubjects, studentsKeys } from '@/features/students/hooks/useStudentsQuery';
import { studentsApi } from '@/features/students/api/students';
import { SubjectSearchPopover } from '@/features/subjects/components/SubjectSearchPopover';
import { subjectsApi } from '@/features/subjects/api/subjects';
import { formatSubjectShortName, getSubjectColorStyle } from '@/shared/utils';

type ViewMode = 'table' | 'calendar';

interface ClassesTabProps {
  student: Tables<'students'>;
  onStudentUpdated?: () => void;
}

// Sort classes by day of week, then by start time
const sortClasses = (classes: StudentClass[]): StudentClass[] => {
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
  student,
  onStudentUpdated
}: ClassesTabProps) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const { data: currentStaff } = useCurrentStaff();
  
  // Use React Query hooks for data fetching
  const { data: classesData = [], isLoading, error } = useStudentClasses(student.id);
  const { data: allClassesData = [] } = useAllClassesForStudent(student.id);
  const { data: studentWithSubjects } = useStudentWithSubjects(student.id);
  
  const studentSubjects = useMemo(() => studentWithSubjects?.subjects || [], [studentWithSubjects?.subjects]);
  const classes = useMemo(() => sortClasses(classesData), [classesData]);
  
  const [viewMode, setViewMode] = useState<ViewMode>('table');
  
  // Subjects editing state
  const [isEditingSubjects, setIsEditingSubjects] = useState(false);
  const [tempStudentSubjects, setTempStudentSubjects] = useState<Tables<'subjects'>[]>([]);
  const [initialFilteredSubjects, setInitialFilteredSubjects] = useState<Tables<'subjects'>[]>([]);
  
  // Modal state for class viewing
  const [selectedClassId, setSelectedClassId] = useState<string | null>(null);
  const [isClassModalOpen, setIsClassModalOpen] = useState(false);
  
  // Modal states for enrollment workflows
  const [isEnrollModalOpen, setIsEnrollModalOpen] = useState(false);
  const [isChangeClassModalOpen, setIsChangeClassModalOpen] = useState(false);
  const [isUnenrollModalOpen, setIsUnenrollModalOpen] = useState(false);
  const [selectedClass, setSelectedClass] = useState<StudentClass | null>(null);
  
  // Prepare data for timetable view
  const timetableClasses = classes.map(c => c.class);
  const timetableSubjects: Record<string, Tables<'subjects'>> = {};
  const timetableStaff: Record<string, Tables<'staff'>[]> = {};
  const timetableStudents: Record<string, Tables<'students'>[]> = {};
  classes.forEach(c => {
    if (c.subject) {
      timetableSubjects[c.class.id] = c.subject;
    }
    timetableStaff[c.class.id] = c.staff;
    timetableStudents[c.class.id] = c.students || [];
  });

  // Modal handlers
  const handleClassClick = (classId: string) => {
    setSelectedClassId(classId);
    setIsClassModalOpen(true);
  };

  const openEnrollModal = () => {
    setIsEnrollModalOpen(true);
  };

  const openChangeClassModal = (classId: string) => {
    const cls = classes.find(c => c.class.id === classId);
    if (cls) {
      setSelectedClass(cls);
      setIsChangeClassModalOpen(true);
    }
  };

  const openUnenrollModal = (classId: string) => {
    const cls = classes.find(c => c.class.id === classId);
    if (cls) {
      setSelectedClass(cls);
      setIsUnenrollModalOpen(true);
    }
  };

  // Handle enrollment
  const handleEnroll = async (params: {
    studentId: string;
    classId: string;
    enrolledAt: Date;
    staffId: string;
  }) => {
    try {
      await classesApi.enrollStudent(params.classId, params.studentId, params.enrolledAt, params.staffId);
      // Invalidate queries to trigger refetch
      await queryClient.invalidateQueries({ queryKey: ['students', student.id, 'classes'] });
      await queryClient.invalidateQueries({ queryKey: ['students', student.id, 'allClasses'] });
      onStudentUpdated?.();
      toast({
        title: 'Success',
        description: 'Student enrolled successfully.',
      });
    } catch (err) {
      console.error('Failed to enroll student:', err);
      toast({
        title: 'Enrollment failed',
        description: 'There was an error enrolling the student. Please try again.',
        variant: 'destructive',
      });
      throw err;
    }
  };

  // Handle change class
  const handleChangeClass = async (params: {
    studentId: string;
    oldClassId: string;
    newClassId: string;
    changeoverDate: Date;
    staffId: string;
  }) => {
    try {
      await classesApi.changeClass(params);
      // Invalidate queries to trigger refetch
      await queryClient.invalidateQueries({ queryKey: ['students', student.id, 'classes'] });
      await queryClient.invalidateQueries({ queryKey: ['students', student.id, 'allClasses'] });
      onStudentUpdated?.();
      toast({
        title: 'Success',
        description: 'Student moved to new class successfully.',
      });
    } catch (err) {
      console.error('Failed to change class:', err);
      toast({
        title: 'Change failed',
        description: 'There was an error changing the class. Please try again.',
        variant: 'destructive',
      });
      throw err;
    }
  };

  // Handle unenrollment
  const handleUnenroll = async (params: {
    studentId: string;
    classId: string;
    unenrolledAt: Date;
    reason: string;
    staffId: string;
  }) => {
    try {
      await classesApi.unenrollStudentWithReason(params);
      // Invalidate queries to trigger refetch
      await queryClient.invalidateQueries({ queryKey: ['students', student.id, 'classes'] });
      await queryClient.invalidateQueries({ queryKey: ['students', student.id, 'allClasses'] });
      onStudentUpdated?.();
      toast({
        title: 'Success',
        description: 'Student unenrolled successfully.',
      });
    } catch (err) {
      console.error('Failed to unenroll student:', err);
      toast({
        title: 'Unenrollment failed',
        description: 'There was an error unenrolling the student. Please try again.',
        variant: 'destructive',
      });
      throw err;
    }
  };

  // Fetch all classes for enrollment modal
  const fetchClassesForEnrollment = useCallback(async (): Promise<ClassWithExpandedSubject[]> => {
    if (!studentSubjects || studentSubjects.length === 0) {
      return [];
    }
    
    const { getSupabaseClient } = await import('@/shared/lib/supabase/client');
    const supabase = getSupabaseClient();
    
    // Get subject IDs for filtering
    const subjectIds = studentSubjects.map(s => s.id);
    
    // Get enrolled class IDs to filter out - use classesData directly to avoid closure issues
    const enrolledClassIds = (classesData || []).map(c => c.class.id);
    
    // Use search_classes_admin RPC to fetch all classes linked to student's subjects
    const { data: rpcResult, error: rpcError } = await supabase.rpc('search_classes_admin', {
      p_search: undefined,
      p_statuses: undefined, // Get all statuses
      p_subject_ids: subjectIds,
      p_include_relationships: true,
      p_limit: 10000, // High limit to get all classes
      p_offset: 0,
      p_order_by: 'day_of_week',
      p_ascending: true,
    });
    
    if (rpcError) throw rpcError;
    if (!rpcResult) return [];
    
    interface RPCClass {
      id: string;
      day_of_week: number;
      start_time: string;
      end_time: string;
      status: string;
      room: string | null;
      subject_id: string | null;
      level: string | null;
    }
    
    interface RPCSubject {
      id: string;
      curriculum: string | null;
      year_level: number | null;
      name: string;
      discipline: string | null;
      level: string | null;
      color: string | null;
    }
    
    interface RPCStaff {
      id: string;
      first_name: string;
      last_name: string;
      role: string;
      status: string;
      email: string | null;
      phone_number: string | null;
    }
    
    interface RPCStudent {
      id: string;
      first_name: string;
      last_name: string;
      status: string;
      curriculum: string | null;
      year_level: number | null;
      school: string | null;
    }
    
    const rpcData = rpcResult as { 
      classes: RPCClass[]; 
      classSubjects: Record<string, RPCSubject>; 
      classStudents: Record<string, RPCStudent[]>; 
      classStaff: Record<string, RPCStaff[]>; 
      total: number 
    };
    
    const rpcClasses = rpcData.classes || [];
    
    // Transform RPC response to match ClassWithExpandedSubject format
    const classes: ClassWithExpandedSubject[] = rpcClasses
      .filter(c => !enrolledClassIds.includes(c.id)) // Filter out classes student is already enrolled in
      .map(c => ({
        ...c,
        subject: rpcData.classSubjects?.[c.id] as Tables<'subjects'> | undefined,
        staff: (rpcData.classStaff?.[c.id] || []).map((s) => ({
          id: s.id,
          first_name: s.first_name,
          last_name: s.last_name,
          role: s.role,
          status: s.status,
          email: s.email || null,
          phone_number: s.phone_number || null,
          created_at: s.created_at || null,
          updated_at: s.updated_at || null,
        })),
        students: (rpcData.classStudents?.[c.id] || []).map((s) => ({
          id: s.id,
          first_name: s.first_name,
          last_name: s.last_name,
          status: s.status,
          curriculum: s.curriculum || null,
          year_level: s.year_level || null,
          school: s.school || null,
          email: s.email || null,
          phone: s.phone || null,
          created_at: s.created_at || null,
          updated_at: s.updated_at || null,
        }))
      })) as ClassWithExpandedSubject[];
    
    return classes;
  }, [studentSubjects, classesData]);

  // Fetch all classes for change class modal
  const fetchClassesForChange = async (): Promise<ClassWithExpandedSubject[]> => {
    const { classes, classSubjects, classStaff, classStudents } = await classesApi.getAllClassesWithDetails();
    return classes.map(c => {
      return {
        ...c,
        subject: classSubjects[c.id],
        staff: classStaff[c.id] || [],
        students: classStudents[c.id] || []
      } as ClassWithExpandedSubject;
    });
  };

  // Fetch initial subjects filtered by curriculum and year level
  useEffect(() => {
    const fetchInitialSubjects = async () => {
      if (!student.curriculum || !student.year_level) {
        setInitialFilteredSubjects([]);
        return;
      }

      try {
        const { subjects } = await subjectsApi.list({
          curriculums: [student.curriculum],
          yearLevels: [student.year_level],
          limit: 100,
          offset: 0,
        });
        setInitialFilteredSubjects(subjects);
      } catch (error) {
        console.error('Error fetching initial subjects:', error);
        setInitialFilteredSubjects([]);
      }
    };

    fetchInitialSubjects();
  }, [student.curriculum, student.year_level]);

  // Handle starting subject edit
  const handleStartEditSubjects = () => {
    setTempStudentSubjects([...studentSubjects]);
    setIsEditingSubjects(true);
  };

  // Handle canceling subject edit
  const handleCancelEditSubjects = () => {
    setTempStudentSubjects([]);
    setIsEditingSubjects(false);
  };

  // Handle adding a subject
  const handleAddSubject = (subject: Tables<'subjects'>) => {
    if (!tempStudentSubjects.some(s => s.id === subject.id)) {
      setTempStudentSubjects([...tempStudentSubjects, subject]);
    }
  };

  // Handle removing a subject
  const handleRemoveSubject = (subjectId: string) => {
    setTempStudentSubjects(tempStudentSubjects.filter(s => s.id !== subjectId));
  };

  // Handle saving subject changes
  const handleSaveSubjects = async () => {
    try {
      const currentSubjectIds = new Set(studentSubjects.map(s => s.id));
      const newSubjectIds = new Set(tempStudentSubjects.map(s => s.id));

      // Find subjects to add
      const subjectsToAdd = tempStudentSubjects.filter(s => !currentSubjectIds.has(s.id));
      // Find subjects to remove
      const subjectsToRemove = studentSubjects.filter(s => !newSubjectIds.has(s.id));

      // Apply changes
      for (const subject of subjectsToAdd) {
        await studentsApi.assignSubjectToStudent(student.id, subject.id);
      }
      for (const subject of subjectsToRemove) {
        await studentsApi.removeSubjectFromStudent(student.id, subject.id);
      }

      // Invalidate queries to refetch
      await queryClient.invalidateQueries({ queryKey: studentsKeys.detailFull(student.id) });
      await queryClient.invalidateQueries({ queryKey: ['students', student.id, 'classes'] });
      await queryClient.invalidateQueries({ queryKey: ['students', student.id, 'allClasses'] });
      
      setIsEditingSubjects(false);
      setTempStudentSubjects([]);
      onStudentUpdated?.();

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
  const displaySubjects = isEditingSubjects ? tempStudentSubjects : studentSubjects;

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
          <Button variant="outline" onClick={() => queryClient.invalidateQueries({ queryKey: ['students', student.id, 'classes'] })}>
            Try Again
          </Button>
        </div>
      </div>
    );
  }

  if (classes.length === 0) {
    return (
      <>
        <div className="flex-1 h-full flex flex-col space-y-4">
          {/* Subjects Section */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <h3 className="text-base font-medium">Subjects</h3>
              {!isEditingSubjects ? (
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-8 w-8 p-0"
                  onClick={handleStartEditSubjects}
                >
                  <Pencil className="h-4 w-4" />
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
                  selectedSubjects={tempStudentSubjects}
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

          {/* Enrolled Classes Section */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <h3 className="text-base font-medium">Enrolled Classes</h3>
              <Button variant="outline" size="sm" className="flex items-center gap-2" onClick={openEnrollModal}>
                <Plus className="h-4 w-4" />
                <span>Add Class</span>
              </Button>
            </div>
            <div className="py-4">
              <p className="text-sm text-muted-foreground">
                This student is not currently enrolled in any classes.
              </p>
            </div>
          </div>
        </div>
        
        {/* Modals */}
        {currentStaff && (
          <EnrollStudentModal
            isOpen={isEnrollModalOpen}
            onClose={() => setIsEnrollModalOpen(false)}
            context="student"
            student={student}
            studentSubjects={studentSubjects}
            enrolledClassIds={classes.map(c => c.class.id)}
            onFetchClasses={fetchClassesForEnrollment}
            onEnroll={handleEnroll}
            currentStaffId={currentStaff.id}
          />
        )}
      </>
    );
  }

  if (!currentStaff) {
    return null;
  }

  return (
    <>
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
                selectedSubjects={tempStudentSubjects}
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

        {/* Enrolled Classes Section */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <h3 className="text-base font-medium">Enrolled Classes</h3>
          </div>
          
          <div className="flex items-center gap-2">
            {/* View Mode Selector */}
            <Tabs value={viewMode} onValueChange={(v) => setViewMode(v as ViewMode)}>
              <TabsList>
                <TabsTrigger value="table">Table</TabsTrigger>
                <TabsTrigger value="calendar">Calendar</TabsTrigger>
              </TabsList>
            </Tabs>
            
            <Button variant="outline" size="sm" className="flex items-center gap-2" onClick={openEnrollModal}>
              <Plus className="h-4 w-4" />
              <span>Add Class</span>
            </Button>
          </div>
        </div>
      
        {/* Conditional View Rendering */}
        {viewMode === 'table' ? (
          <ScrollArea className="flex-1">
            <div className="space-y-6">
              {/* Group classes by day */}
              {(() => {
                const classesByDay: Record<string, StudentClass[]> = {};
                
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
                      {classesByDay[day].map(studentClass => (
                        <ClassCard
                          key={studentClass.class.id}
                          class={studentClass.class}
                          subject={studentClass.subject}
                          staff={studentClass.staff}
                          students={studentClass.students}
                          onClick={() => handleClassClick(studentClass.class.id)}
                          onChangeClass={() => openChangeClassModal(studentClass.class.id)}
                          onUnenroll={() => openUnenrollModal(studentClass.class.id)}
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
            <CalendarView
              classes={timetableClasses}
              classSubjects={timetableSubjects}
              classStaff={timetableStaff}
              classStudents={timetableStudents}
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
              // Refresh student classes when class is updated
              queryClient.invalidateQueries({ queryKey: ['students', student.id, 'classes'] });
              queryClient.invalidateQueries({ queryKey: ['students', student.id, 'allClasses'] });
            }}
          />
        )}
      </div>

      {/* Enrollment Modals */}
      <EnrollStudentModal
        isOpen={isEnrollModalOpen}
        onClose={() => setIsEnrollModalOpen(false)}
        context="student"
        student={student}
        studentSubjects={studentSubjects}
        enrolledClassIds={classes.map(c => c.class.id)}
        onFetchClasses={fetchClassesForEnrollment}
        onEnroll={handleEnroll}
        currentStaffId={currentStaff.id}
      />

      {selectedClass && (
        <ChangeClassModal
          isOpen={isChangeClassModalOpen}
          onClose={() => {
            setIsChangeClassModalOpen(false);
            setSelectedClass(null);
          }}
          student={student}
          studentSubjects={studentSubjects}
          oldClass={selectedClass.class}
          oldClassSubject={selectedClass.subject}
          oldClassStaff={selectedClass.staff}
          onFetchClasses={fetchClassesForChange}
          onChange={handleChangeClass}
          currentStaffId={currentStaff.id}
        />
      )}

      {selectedClass && (
        <UnenrollStudentModal
          isOpen={isUnenrollModalOpen}
          onClose={() => {
            setIsUnenrollModalOpen(false);
            setSelectedClass(null);
          }}
          student={student}
          studentSubjects={studentSubjects}
          class={selectedClass.class}
          classSubject={selectedClass.subject}
          classStaff={selectedClass.staff}
          onUnenroll={handleUnenroll}
          currentStaffId={currentStaff.id}
        />
      )}
    </>
  );
} 