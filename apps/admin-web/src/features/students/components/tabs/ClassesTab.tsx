import { useState, useMemo, useCallback } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import type { Tables, ClassWithExpandedSubject } from "@altitutor/shared";
import { Button } from "@altitutor/ui";
import { ScrollArea } from "@altitutor/ui";
import { Tabs, TabsList, TabsTrigger } from "@altitutor/ui";
import { Badge } from "@altitutor/ui";
import { useToast } from "@altitutor/ui";
import { Loader2, Plus, Pencil, X, UserX, UserCheck } from "lucide-react";
import { studentsApi } from '@/features/students/api/students';
import { classesApi } from '@/shared/api';
import { ViewClassModal, CalendarView } from '@/features/classes';
import { ClassCard } from '@/shared/components/ClassCard';
import { EnrollStudentModal, ChangeClassModal, UnenrollStudentModal } from '@/features/enrollments';
import { useCurrentStaff } from '@/features/staff/hooks/useStaffQuery';
import { useStudentClasses, type StudentClass } from '@/features/students/hooks/useStudentClasses';
import { useStudentWithSubjects, studentsKeys } from '@/features/students/hooks/useStudentsQuery';
import { SubjectSearchPopover } from '@/features/subjects/components/SubjectSearchPopover';
import { subjectsApi } from '@/features/subjects/api/subjects';
import { formatSubjectShortName, getSubjectColorStyle } from '@/shared/utils';
import { getSupabaseClient } from '@/shared/lib/supabase/client';

type ViewMode = 'table' | 'calendar';

interface ClassesTabProps {
  student: Tables<'students'>;
  onStudentUpdated?: () => void;
}

export function ClassesTab({
  student,
  onStudentUpdated
}: ClassesTabProps) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const { data: currentStaff } = useCurrentStaff();
  const [isDiscontinuing, setIsDiscontinuing] = useState(false);
  const [isReEnrolling, setIsReEnrolling] = useState(false);
  
  // Use React Query hooks for data fetching
  const { data: classesData = [], isLoading, error } = useStudentClasses(student.id);
  const { data: studentWithSubjects } = useStudentWithSubjects(student.id);
  
  const studentSubjects = useMemo(() => studentWithSubjects?.subjects || [], [studentWithSubjects?.subjects]);
  const classes = useMemo(() => classesData, [classesData]);
  
  const [viewMode, setViewMode] = useState<ViewMode>('table');
  const [isEditMode, setIsEditMode] = useState(false);
  
  // Modal state for class viewing
  const [selectedClassId, setSelectedClassId] = useState<string | null>(null);
  const [isClassModalOpen, setIsClassModalOpen] = useState(false);
  
  // Modal states for enrollment workflows
  const [isEnrollModalOpen, setIsEnrollModalOpen] = useState(false);
  const [isEnrollModalSubjectId, setIsEnrollModalSubjectId] = useState<string | null>(null);
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

  // Group classes by subject
  const classesBySubject = useMemo(() => {
    const grouped: Record<string, StudentClass[]> = {};
    
    // Add all student subjects (even if they have no classes)
    studentSubjects.forEach(subject => {
      grouped[subject.id] = [];
    });
    
    // Group classes by subject
    classes.forEach(classData => {
      if (classData.subject) {
        const subjectId = classData.subject.id;
        if (!grouped[subjectId]) {
          grouped[subjectId] = [];
        }
        grouped[subjectId].push(classData);
      }
    });
    
    return grouped;
  }, [classes, studentSubjects]);

  // Modal handlers
  const handleClassClick = (classId: string) => {
    setSelectedClassId(classId);
    setIsClassModalOpen(true);
  };

  const openEnrollModal = (subjectId?: string) => {
    setIsEnrollModalSubjectId(subjectId || null);
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
      await queryClient.invalidateQueries({ queryKey: studentsKeys.detail(student.id) });
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

  // Fetch classes for enrollment modal - filtered by subject ID
  const fetchClassesForSubject = useCallback(async (subjectId: string): Promise<ClassWithExpandedSubject[]> => {
    const supabase = getSupabaseClient();
    
    const { data: rpcResult, error: rpcError } = await supabase.rpc('search_classes_admin', {
      p_search: undefined,
      p_statuses: ['ACTIVE'],
      p_subject_ids: [subjectId], // Filter by specific subject
      p_include_relationships: true,
      p_limit: 10000,
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
    
    const rpcData = rpcResult as unknown as { 
      classes: RPCClass[]; 
      classSubjects: Record<string, RPCSubject>; 
      classStudents: Record<string, RPCStudent[]>; 
      classStaff: Record<string, RPCStaff[]>; 
      total: number 
    };
    
    const rpcClasses = rpcData.classes || [];
    
    // Transform RPC response to match ClassWithExpandedSubject format
    const allClasses: ClassWithExpandedSubject[] = rpcClasses.map(c => ({
      id: c.id,
      day_of_week: c.day_of_week,
      start_time: c.start_time,
      end_time: c.end_time,
      status: c.status as Tables<'classes'>['status'],
      room: c.room,
      level: c.level,
      subject_id: c.subject_id,
      created_at: null,
      updated_at: null,
      created_by: null,
      session_start_date: null,
      session_end_date: null,
      subject: rpcData.classSubjects?.[c.id] as Tables<'subjects'> | undefined,
      staff: (rpcData.classStaff?.[c.id] || []).map((s) => ({
        id: s.id,
        first_name: s.first_name,
        last_name: s.last_name,
        role: s.role as Tables<'staff'>['role'],
        status: s.status as Tables<'staff'>['status'],
        email: s.email || null,
        phone_number: s.phone_number || null,
        created_at: null,
        updated_at: null,
      })),
      students: (rpcData.classStudents?.[c.id] || []).map((s) => ({
        id: s.id,
        first_name: s.first_name,
        last_name: s.last_name,
        status: s.status as Tables<'students'>['status'],
        curriculum: s.curriculum || null,
        year_level: s.year_level || null,
        school: s.school || null,
        email: null,
        phone: null,
        phone_number: null,
        created_at: null,
        updated_at: null,
      }))
    })) as unknown as ClassWithExpandedSubject[];
    
    return allClasses;
  }, []);

  // Fetch classes for change class modal
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

  // Handle adding a subject
  const handleAddSubject = async (subject: Tables<'subjects'>) => {
    try {
      await studentsApi.assignSubjectToStudent(student.id, subject.id);
      await queryClient.invalidateQueries({ queryKey: studentsKeys.detail(student.id) });
      onStudentUpdated?.();
      toast({
        title: 'Success',
        description: 'Subject added successfully.',
      });
    } catch (error) {
      console.error('Failed to add subject:', error);
      toast({
        title: 'Add failed',
        description: 'There was an error adding the subject. Please try again.',
        variant: 'destructive',
      });
    }
  };

  // Handle discontinue student
  const handleDiscontinue = async () => {
    if (!currentStaff) return;
    
    try {
      setIsDiscontinuing(true);
      const result = await studentsApi.discontinueStudent(student.id, currentStaff.id);
      
      if (!result.success) {
        if (result.error === 'Unenroll student from classes first') {
          toast({
            title: 'Cannot Discontinue',
            description: 'Unenroll student from classes first',
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
        return;
      }
      
      await queryClient.invalidateQueries({ queryKey: studentsKeys.detail(student.id) });
      onStudentUpdated?.();
      toast({
        title: 'Success',
        description: 'Student discontinued successfully.',
      });
    } catch (error) {
      console.error('Failed to discontinue student:', error);
      toast({
        title: 'Discontinue failed',
        description: error instanceof Error ? error.message : 'There was an error discontinuing the student. Please try again.',
        variant: 'destructive',
      });
    } finally {
      setIsDiscontinuing(false);
    }
  };

  // Handle re-enroll student
  const handleReEnroll = async () => {
    try {
      setIsReEnrolling(true);
      await studentsApi.reEnrollStudent(student.id);
      await queryClient.invalidateQueries({ queryKey: studentsKeys.detail(student.id) });
      onStudentUpdated?.();
      toast({
        title: 'Success',
        description: 'Student re-enrolled successfully.',
      });
    } catch (error) {
      console.error('Failed to re-enroll student:', error);
      toast({
        title: 'Re-enroll failed',
        description: error instanceof Error ? error.message : 'There was an error re-enrolling the student. Please try again.',
        variant: 'destructive',
      });
    } finally {
      setIsReEnrolling(false);
    }
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
          <Button variant="outline" onClick={() => queryClient.invalidateQueries({ queryKey: ['students', student.id, 'classes'] })}>
            Try Again
          </Button>
        </div>
      </div>
    );
  }

  if (!currentStaff) {
    return null;
  }

  return (
    <>
      <div className="flex-1 h-full flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-base font-medium">Classes</h3>
          
          {!isEditMode ? (
            <div className="flex items-center gap-2">
              {/* View Mode Selector */}
              <Tabs value={viewMode} onValueChange={(v) => setViewMode(v as ViewMode)}>
                <TabsList>
                  <TabsTrigger value="table">Table</TabsTrigger>
                  <TabsTrigger value="calendar">Calendar</TabsTrigger>
                </TabsList>
              </Tabs>
              
              <Button variant="outline" size="sm" onClick={() => setIsEditMode(true)}>
                <Pencil className="h-4 w-4 mr-2" />
                Edit
              </Button>
            </div>
          ) : (
            <div className="flex items-center gap-2">
              <SubjectSearchPopover
                selectedSubjects={studentSubjects}
                onSelectSubject={handleAddSubject}
                trigger={
                  <Button variant="outline" size="sm" className="flex items-center gap-2">
                    <Plus className="h-4 w-4" />
                    <span>Add Subject</span>
                  </Button>
                }
              />
            </div>
          )}
        </div>

        {/* Content Area - Takes remaining space and scrolls */}
        <div className="flex-1 min-h-0 overflow-hidden">
          {viewMode === 'table' ? (
            <ScrollArea className="h-full">
              <div className="space-y-4">
                {Object.entries(classesBySubject).map(([subjectId, subjectClasses]) => {
                  const subject = studentSubjects.find(s => s.id === subjectId);
                  if (!subject) return null;
                  
                  const shortName = formatSubjectShortName(subject);
                  const { style, textColorClass } = getSubjectColorStyle(subject);
                  const defaultClass = !subject.color ? 'bg-gray-100 text-gray-800' : '';
                  
                  return (
                    <div key={subjectId} className="flex items-start gap-4">
                      {/* Subject Pill */}
                      <div className="flex-shrink-0 pt-2">
                        <Badge
                          className={defaultClass || `${textColorClass} flex items-center gap-1 pr-1`}
                          style={style.backgroundColor ? style : undefined}
                        >
                          <span>{shortName}</span>
                        </Badge>
                      </div>
                      
                      {/* Class Cards */}
                      <div className="flex-1 space-y-2">
                        {subjectClasses.length > 0 ? (
                          subjectClasses.map(classData => (
                            <ClassCard
                              key={classData.class.id}
                              class={classData.class}
                              subject={classData.subject}
                              staff={classData.staff}
                              students={classData.students}
                              onClick={() => handleClassClick(classData.class.id)}
                              onChangeClass={isEditMode ? () => openChangeClassModal(classData.class.id) : undefined}
                              onUnenroll={isEditMode ? () => openUnenrollModal(classData.class.id) : undefined}
                              hideActions={!isEditMode}
                            />
                          ))
                        ) : (
                          <div
                            className={`border-2 border-dashed rounded-lg p-4 flex items-center justify-center transition-colors ${
                              student.status === 'ACTIVE' 
                                ? 'hover:border-primary/50 cursor-pointer' 
                                : 'opacity-50 cursor-not-allowed'
                            }`}
                            onClick={() => {
                              if (student.status === 'ACTIVE') {
                                openEnrollModal(subjectId);
                              } else {
                                toast({
                                  title: 'Cannot Enroll',
                                  description: 'Student must be active to be enrolled in classes',
                                  variant: 'destructive',
                                });
                              }
                            }}
                          >
                            <Button 
                              variant="ghost" 
                              size="sm" 
                              className="flex items-center gap-2"
                              disabled={student.status !== 'ACTIVE'}
                            >
                              <Plus className="h-4 w-4" />
                              <span>Add Class</span>
                            </Button>
                          </div>
                        )}
                      </div>
                    </div>
                  );
                })}
                
                {Object.keys(classesBySubject).length === 0 && (
                  <div className="text-center py-8 text-muted-foreground">
                    <p>No subjects assigned. Add a subject to get started.</p>
                  </div>
                )}
                
                {/* Actions Section - Only show in edit mode */}
                {isEditMode && (
                  <div className="mt-8 pt-6 border-t">
                    <h4 className="text-sm font-medium mb-4">Actions</h4>
                    <div className="flex gap-2">
                      {(student.status === 'TRIAL' || student.status === 'ACTIVE') && (
                        <Button
                          variant="destructive"
                          size="sm"
                          onClick={handleDiscontinue}
                          disabled={isDiscontinuing}
                        >
                          {isDiscontinuing ? (
                            <>
                              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                              Discontinuing...
                            </>
                          ) : (
                            <>
                              <UserX className="h-4 w-4 mr-2" />
                              Discontinue
                            </>
                          )}
                        </Button>
                      )}
                      {student.status === 'DISCONTINUED' && (
                        <Button
                          variant="default"
                          size="sm"
                          onClick={handleReEnroll}
                          disabled={isReEnrolling}
                        >
                          {isReEnrolling ? (
                            <>
                              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                              Re-enrolling...
                            </>
                          ) : (
                            <>
                              <UserCheck className="h-4 w-4 mr-2" />
                              Re-enroll
                            </>
                          )}
                        </Button>
                      )}
                    </div>
                  </div>
                )}
              </div>
            </ScrollArea>
          ) : (
            <div className="h-full overflow-hidden">
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
        </div>

        {/* Edit Mode Footer - Sticky at bottom */}
        {isEditMode && (
          <div className="border-t pt-4 mt-4 flex-shrink-0 bg-background">
            <div className="flex justify-end">
              <Button variant="default" onClick={() => setIsEditMode(false)}>
                Save
              </Button>
            </div>
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
        onClose={() => {
          setIsEnrollModalOpen(false);
          setIsEnrollModalSubjectId(null);
        }}
        context="student"
        student={student}
        studentSubjects={studentSubjects}
        enrolledClassIds={classes.map(c => c.class.id)}
        onFetchClasses={isEnrollModalSubjectId ? () => fetchClassesForSubject(isEnrollModalSubjectId) : undefined}
        subjectId={isEnrollModalSubjectId || undefined}
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
