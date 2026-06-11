import { useState, useMemo, useCallback, useEffect } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import type { Tables, ClassWithExpandedSubject } from "@altitutor/shared";
import { Button } from "@altitutor/ui";
import { ScrollArea } from "@altitutor/ui";
import { SegmentedControl } from "@altitutor/ui";
import { Badge } from "@altitutor/ui";
import { useToast } from "@altitutor/ui";
import { Loader2, Plus, Pencil, X, UserCheck } from "lucide-react";
import { studentsApi } from '@/features/students/api/students';
import { classesApi } from '@/shared/api';
import { ViewClassModal, CalendarView } from '@/features/classes';
import { ClassCard } from '@/shared/components/ClassCard';
import { EnrollStudentModal, ChangeClassModal, UnenrollStudentModal } from '@/features/enrollments';
import { useCurrentStaff } from '@/shared/hooks';
import { useStudentClasses, type StudentClass } from '@/features/students/hooks/useStudentClasses';
import { useStudentWithSubjects, studentsKeys } from '@/features/students/hooks/useStudentsQuery';
import { SubjectSearchPopover } from '@/features/subjects/components/SubjectSearchPopover';
import { getSubjectColorStyle } from '@/shared/utils';
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
  const [isReEnrolling, setIsReEnrolling] = useState(false);
  
  // Use React Query hooks for data fetching
  const { data: classesData = [], isLoading, error } = useStudentClasses(student.id);
  const { data: studentWithSubjects } = useStudentWithSubjects(student.id);
  
  const studentSubjects = useMemo(() => studentWithSubjects?.subjects || [], [studentWithSubjects?.subjects]);
  const classes = useMemo(() => classesData, [classesData]);
  
  const [viewMode, setViewMode] = useState<ViewMode>('table');
  const [isEditMode, setIsEditMode] = useState(false);
  
  // Responsive: detect when container is too small for full cards
  // Use window width instead of container ref for more reliable detection
  const [useCompactCards, setUseCompactCards] = useState(false);
  
  useEffect(() => {
    const checkSize = () => {
      // Use window innerWidth for more reliable mobile detection
      // Account for padding (p-6 = 24px each side = 48px total) and subject pill (~80-100px)
      // So if window is < 640px, the card area will be < ~500px
      const windowWidth = window.innerWidth;
      const shouldUseCompact = windowWidth < 640;
      setUseCompactCards(shouldUseCompact);
    };
    
    // Check initially
    checkSize();
    
    // Listen to window resize
    window.addEventListener('resize', checkSize);
    
    return () => {
      window.removeEventListener('resize', checkSize);
    };
  }, []);
  
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
    const classesWithoutMatchingSubject: StudentClass[] = [];
    const studentSubjectIds = new Set(studentSubjects.map(s => s.id));
    
    // Add all student subjects (even if they have no classes)
    studentSubjects.forEach(subject => {
      grouped[subject.id] = [];
    });
    
    // Group classes by subject
    classes.forEach(classData => {
      if (classData.subject) {
        const subjectId = classData.subject.id;
        // Check if student has this subject
        if (studentSubjectIds.has(subjectId)) {
          // Student has this subject - add to grouped
          if (!grouped[subjectId]) {
            grouped[subjectId] = [];
          }
          grouped[subjectId].push(classData);
        } else {
          // Student doesn't have this subject - add to bottom section
          classesWithoutMatchingSubject.push(classData);
        }
      } else {
        // Class has no subject - add to bottom section
        classesWithoutMatchingSubject.push(classData);
      }
    });
    
    // Add classes without matching subjects at the end
    if (classesWithoutMatchingSubject.length > 0) {
      grouped['__no_subject__'] = classesWithoutMatchingSubject;
    }
    
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
    reason: import('@tiptap/core').JSONContent;
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

  // Fetch classes for enrollment modal - filtered by subject ID (uses classesApi which correctly maps short_name/long_name)
  const fetchClassesForSubject = useCallback(
    (subjectId: string) => classesApi.fetchClassesForSubject(subjectId),
    []
  );

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

  // Handle removing a subject
  const handleRemoveSubject = async (subjectId: string) => {
    // Check if student is enrolled in any classes for this subject
    const subjectClasses = classesBySubject[subjectId] || [];
    if (subjectClasses.length > 0) {
      toast({
        title: 'Cannot Remove Subject',
        description: 'Cannot remove subject because the student is enrolled in classes for this subject. Please unenroll from all classes first.',
        variant: 'destructive',
      });
      return;
    }

    try {
      await studentsApi.removeSubjectFromStudent(student.id, subjectId);
      await queryClient.invalidateQueries({ queryKey: studentsKeys.detail(student.id) });
      onStudentUpdated?.();
      toast({
        title: 'Success',
        description: 'Subject removed successfully.',
      });
    } catch (error) {
      console.error('Failed to remove subject:', error);
      toast({
        title: 'Remove failed',
        description: 'There was an error removing the subject. Please try again.',
        variant: 'destructive',
      });
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
              <SegmentedControl
                value={viewMode}
                onValueChange={(v) => setViewMode(v as ViewMode)}
                options={[
                  { value: 'table', label: 'Table' },
                  { value: 'calendar', label: 'Calendar' },
                ]}
              />
              
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
                {Object.entries(classesBySubject)
                  .sort(([a], [b]) => {
                    // Put __no_subject__ entries at the end
                    if (a === '__no_subject__') return 1;
                    if (b === '__no_subject__') return -1;
                    return 0;
                  })
                  .map(([subjectId, subjectClasses]) => {
                  // Handle classes without subjects (shown at bottom)
                  if (subjectId === '__no_subject__') {
                    return (
                      <div key={subjectId} className="space-y-2">
                        {subjectClasses.map(classData => (
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
                            compact={useCompactCards}
                          />
                        ))}
                      </div>
                    );
                  }
                  
                  const subject = studentSubjects.find(s => s.id === subjectId);
                  if (!subject) return null;
                  
                  const shortName = subject?.short_name ?? subject?.long_name ?? subject?.name ?? '';
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
                          {isEditMode && (
                            <button
                              type="button"
                              className="ml-1 rounded-full hover:bg-black/20 p-0.5 flex items-center justify-center"
                              onClick={(e) => {
                                e.stopPropagation();
                                handleRemoveSubject(subjectId);
                              }}
                              title="Remove subject"
                            >
                              <X className="h-3 w-3" />
                            </button>
                          )}
                        </Badge>
                      </div>
                      
                      {/* Class Cards - Show all classes for this subject stacked */}
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
                              compact={useCompactCards}
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
                {isEditMode && student.status === 'DISCONTINUED' && (
                  <div className="mt-8 pt-6 border-t">
                    <h4 className="text-sm font-medium mb-4">Actions</h4>
                    <div className="flex gap-2">
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
