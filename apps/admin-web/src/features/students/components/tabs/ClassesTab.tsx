import { useState, useEffect } from 'react';
import type { Tables, ClassWithExpandedSubject } from "@altitutor/shared";
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
import { EnrollStudentModal, ChangeClassModal, UnenrollStudentModal } from '@/shared/components/modals';
import { getDayOfWeek } from '@/shared/utils/datetime';
import { formatTime } from '@/shared/utils/datetime';
import { useCurrentStaff } from '@/features/staff/hooks/useStaffQuery';

type ViewMode = 'table' | 'timetable';

interface ClassesTabProps {
  student: Tables<'students'>;
  onStudentUpdated?: () => void;
}

interface StudentClass {
  class: Tables<'classes'>;
  subject?: Tables<'subjects'>;
  staff: Tables<'staff'>[];
  students?: Tables<'students'>[];
  studentCount: number;
}

export function ClassesTab({
  student,
  onStudentUpdated
}: ClassesTabProps) {
  const { toast } = useToast();
  const { data: currentStaff } = useCurrentStaff();
  const [classes, setClasses] = useState<StudentClass[]>([]);
  const [allClasses, setAllClasses] = useState<StudentClass[]>([]);
  const [studentSubjects, setStudentSubjects] = useState<Tables<'subjects'>[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [viewMode, setViewMode] = useState<ViewMode>('table');
  
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
  classes.forEach(c => {
    if (c.subject) {
      timetableSubjects[c.class.id] = c.subject;
    }
    timetableStaff[c.class.id] = c.staff;
  });

  useEffect(() => {
    loadStudentClasses();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [student.id]);

  const loadStudentClasses = async () => {
    try {
      setLoading(true);
      setError(null);
      
      // Get all classes with details
      const { classes: allClassesData, classSubjects, classStaff, classStudents } = await classesApi.getAllClassesWithDetails();
      
      // Get student subjects
      const { studentSubjects: subjectsData } = await import('@/features/students/api').then(m => 
        m.studentsApi.getDetailsForStudentIds([student.id])
      );
      setStudentSubjects(subjectsData[student.id] || []);
      
      // Create StudentClass objects for all classes
      const allClassesWithDetails: StudentClass[] = [];
      const studentClasses: StudentClass[] = [];
      
      for (const cls of allClassesData) {
        const subject = classSubjects[cls.id];
        const staff = classStaff[cls.id] || [];
        const enrolledStudents = classStudents[cls.id] || [];
        const studentCount = enrolledStudents.length;
        const isEnrolled = enrolledStudents.some(enrolledStudent => enrolledStudent.id === student.id);
        
        const classWithDetails = {
          class: cls,
          subject,
          staff,
          students: enrolledStudents,
          studentCount
        };
        
        allClassesWithDetails.push(classWithDetails);
        
        if (isEnrolled) {
          studentClasses.push(classWithDetails);
        }
      }
      
      // Sort by day of week, then by start time
      const sortClasses = (classes: StudentClass[]) => {
        return classes.sort((a, b) => {
          const dayA = a.class.day_of_week === 0 ? 7 : a.class.day_of_week;
          const dayB = b.class.day_of_week === 0 ? 7 : b.class.day_of_week;
          
          if (dayA !== dayB) {
            return dayA - dayB;
          }
          
          return a.class.start_time.localeCompare(b.class.start_time);
        });
      };
      
      setClasses(sortClasses([...studentClasses]));
      setAllClasses(sortClasses([...allClassesWithDetails]));
    } catch (err) {
      console.error('Error loading student classes:', err);
      setError('Failed to load classes');
    } finally {
      setLoading(false);
    }
  };

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
      await loadStudentClasses();
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
      await loadStudentClasses();
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
      await loadStudentClasses();
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
  const fetchClassesForEnrollment = async (): Promise<ClassWithExpandedSubject[]> => {
    const { classes, classSubjects, classStaff, classStudents } = await classesApi.getAllClassesWithDetails();
    return classes.map(c => {
      const { subject, ...rest } = c;
      return {
        ...rest,
        subject: classSubjects[c.id],
        staff: classStaff[c.id] || [],
        students: classStudents[c.id] || []
      } as ClassWithExpandedSubject;
    });
  };

  // Fetch all classes for change class modal
  const fetchClassesForChange = async (): Promise<ClassWithExpandedSubject[]> => {
    const { classes, classSubjects, classStaff, classStudents } = await classesApi.getAllClassesWithDetails();
    return classes.map(c => {
      const { subject, ...rest } = c;
      return {
        ...rest,
        subject: classSubjects[c.id],
        staff: classStaff[c.id] || [],
        students: classStudents[c.id] || []
      } as ClassWithExpandedSubject;
    });
  };

  if (loading) {
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
          <p className="text-red-500 mb-2">{error}</p>
          <Button variant="outline" onClick={loadStudentClasses}>
            Try Again
          </Button>
        </div>
      </div>
    );
  }

  if (classes.length === 0) {
    return (
      <>
        <div className="flex-1 flex flex-col justify-center items-center">
          <Calendar className="h-12 w-12 text-muted-foreground mb-2" />
          <p className="text-sm text-muted-foreground mb-4">No classes enrolled</p>
          <p className="text-xs text-muted-foreground text-center max-w-sm mb-4">
            This student is not currently enrolled in any classes.
          </p>
          <Button variant="outline" onClick={openEnrollModal}>
            <Plus className="h-4 w-4 mr-2" />
            Enroll in a class
          </Button>
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
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <h3 className="text-base font-medium">Enrolled Classes ({classes.length})</h3>
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
              // Refresh student classes when class is updated
              loadStudentClasses();
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