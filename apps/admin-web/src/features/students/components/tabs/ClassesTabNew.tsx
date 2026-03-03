import { useState, useEffect } from 'react';
import type { Tables, ClassWithExpandedSubject } from "@altitutor/shared";
import { Button } from "@altitutor/ui";
import { Loader2, Plus, Grid3X3, Calendar } from "lucide-react";
import { classesApi } from '@/shared/api';
import { ClassCard } from '@/shared/components/ClassCard';
import { ViewClassModal } from '@/features/classes';
import { useCurrentStaff } from '@/shared/hooks';
import { useToast } from "@altitutor/ui";
import { EnrollStudentModal, ChangeClassModal, UnenrollStudentModal } from '@/features/enrollments';

type ViewMode = 'table' | 'timetable';

interface ClassesTabNewProps {
  student: Tables<'students'>;
  studentSubjects?: Tables<'subjects'>[];
  onStudentUpdated?: () => void;
}

interface StudentClass {
  class: Tables<'classes'>;
  subject?: Tables<'subjects'>;
  staff: Tables<'staff'>[];
  students?: Tables<'students'>[];
  enrollment?: Tables<'classes_students'>;
}

export function ClassesTabNew({
  student,
  studentSubjects = [],
  onStudentUpdated
}: ClassesTabNewProps) {
  const { toast } = useToast();
  const { data: currentStaff } = useCurrentStaff();
  const [classes, setClasses] = useState<StudentClass[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [viewMode, setViewMode] = useState<ViewMode>('table');
  
  // Modal states
  const [isEnrollModalOpen, setIsEnrollModalOpen] = useState(false);
  const [isChangeClassModalOpen, setIsChangeClassModalOpen] = useState(false);
  const [isUnenrollModalOpen, setIsUnenrollModalOpen] = useState(false);
  const [selectedClass, setSelectedClass] = useState<StudentClass | null>(null);
  
  // Class modal state
  const [selectedClassId, setSelectedClassId] = useState<string | null>(null);
  const [isClassModalOpen, setIsClassModalOpen] = useState(false);

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
      
      // Filter to classes where student is enrolled
      const studentClasses: StudentClass[] = [];
      
      for (const cls of allClassesData) {
        const subject = classSubjects[cls.id];
        const staff = classStaff[cls.id] || [];
        const enrolledStudents = classStudents[cls.id] || [];
        const isEnrolled = enrolledStudents.some(enrolledStudent => enrolledStudent.id === student.id);
        
        if (isEnrolled) {
          studentClasses.push({
            class: cls,
            subject,
            staff,
            students: enrolledStudents,
            enrollment: undefined // Could fetch enrollment details here
          });
        }
      }
      
      // Sort by day of week, then by start time
      const sortedClasses = studentClasses.sort((a, b) => {
        if (a.class.day_of_week !== b.class.day_of_week) {
          return a.class.day_of_week - b.class.day_of_week;
        }
        return a.class.start_time.localeCompare(b.class.start_time);
      });
      
      setClasses(sortedClasses);
    } catch (err) {
      console.error('Error loading student classes:', err);
      setError('Failed to load classes');
      toast({
        title: 'Error',
        description: 'Failed to load student classes',
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

  const handleEnroll = async (params: {
    studentId: string;
    classId: string;
    enrolledAt: Date;
    staffId: string;
  }) => {
    try {
      await classesApi.enrollStudent(params.classId, params.studentId, params.enrolledAt, params.staffId);
      await loadStudentClasses(); // Reload
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

  const handleChangeClass = async (params: {
    studentId: string;
    oldClassId: string;
    newClassId: string;
    changeoverDate: Date;
    staffId: string;
  }) => {
    try {
      await classesApi.changeClass(params);
      await loadStudentClasses(); // Reload
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

  const handleUnenroll = async (params: {
    studentId: string;
    classId: string;
    unenrolledAt: Date;
    reason: string;
    staffId: string;
  }) => {
    try {
      await classesApi.unenrollStudentWithReason(params);
      await loadStudentClasses(); // Reload
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

  const handleViewClass = (classId: string) => {
    setSelectedClassId(classId);
    setIsClassModalOpen(true);
  };

  // Fetch all classes for enrollment modal
  const fetchClassesForEnrollment = async (): Promise<ClassWithExpandedSubject[]> => {
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

  if (!currentStaff) {
    return null;
  }

  return (
    <>
      <div className="flex-1 h-[calc(100vh-300px)] flex flex-col space-y-4">
        <div className="flex items-center gap-2">
          <h3 className="text-base font-medium">Classes ({classes.length})</h3>
          
          <div className="flex gap-1 ml-auto">
            <Button
              variant={viewMode === 'table' ? 'secondary' : 'ghost'}
              size="icon"
              onClick={() => setViewMode('table')}
              title="Table view"
            >
              <Calendar className="h-4 w-4" />
            </Button>
            <Button
              variant={viewMode === 'timetable' ? 'secondary' : 'ghost'}
              size="icon"
              onClick={() => setViewMode('timetable')}
              title="Timetable view"
            >
              <Grid3X3 className="h-4 w-4" />
            </Button>
          </div>
          
          <Button 
            variant="outline" 
            size="sm" 
            className="flex items-center gap-2"
            onClick={openEnrollModal}
          >
            <Plus className="h-4 w-4" />
            <span>Add Class</span>
          </Button>
        </div>

        {loading ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
          </div>
        ) : error ? (
          <div className="flex items-center justify-center py-12 text-center">
            <p className="text-muted-foreground">{error}</p>
          </div>
        ) : classes.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-12 text-center">
            <p className="text-muted-foreground">This student is not enrolled in any classes yet.</p>
            <Button
              variant="outline"
              size="sm"
              className="mt-4"
              onClick={openEnrollModal}
            >
              <Plus className="h-4 w-4 mr-2" />
              Enroll in First Class
            </Button>
          </div>
        ) : (
          <div className="space-y-2">
            {classes.map((cls) => (
              <ClassCard
                key={cls.class.id}
                class={cls.class}
                subject={cls.subject}
                staff={cls.staff}
                students={cls.students}
                enrollment={cls.enrollment}
                onClick={() => handleViewClass(cls.class.id)}
                onChangeClass={() => openChangeClassModal(cls.class.id)}
                onUnenroll={() => openUnenrollModal(cls.class.id)}
              />
            ))}
          </div>
        )}
      </div>

      {/* Enrollment Modal */}
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

      {/* Change Class Modal */}
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

      {/* Unenroll Modal */}
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

      {/* Class Modal */}
      {selectedClassId && (
        <ViewClassModal
          isOpen={isClassModalOpen}
          onClose={() => {
            setIsClassModalOpen(false);
            setSelectedClassId(null);
          }}
          classId={selectedClassId}
          onClassUpdated={() => {
            loadStudentClasses();
            onStudentUpdated?.();
          }}
        />
      )}
    </>
  );
}

