import { useState, useEffect } from 'react';
import type { Tables } from '@altitutor/shared';
import { Button } from "@altitutor/ui";
import { ScrollArea } from "@altitutor/ui";
import { Loader2, Users, Plus } from "lucide-react";
import { ViewStudentModal } from '@/features/students';
import { StudentCard } from '@/shared/components/StudentCard';
import { EnrollStudentModal, ChangeClassModal, UnenrollStudentModal } from '@/shared/components/modals';
import { classesApi } from '@/shared/api';
import { useCurrentStaff } from '@/features/staff/hooks/useStaffQuery';
import { useToast } from "@altitutor/ui";

interface ClassStudentsTabProps {
  classData: Tables<'classes'>;
  classSubject?: Tables<'subjects'>;
  classStaff: Tables<'staff'>[];
  classStudents: Tables<'students'>[];
  allStudents: Tables<'students'>[];
  loadingStudents: boolean;
  onViewStudent?: (studentId: string) => void;
  onStudentsUpdated?: () => void;
}

export function ClassStudentsTab({
  classData,
  classSubject,
  classStaff,
  classStudents,
  allStudents,
  loadingStudents,
  onViewStudent,
  onStudentsUpdated
}: ClassStudentsTabProps) {
  const { toast } = useToast();
  const { data: currentStaff } = useCurrentStaff();
  const [studentSubjects, setStudentSubjects] = useState<Record<string, Tables<'subjects'>[]>>({});
  
  // Modal state for student viewing
  const [selectedStudentId, setSelectedStudentId] = useState<string | null>(null);
  const [isStudentModalOpen, setIsStudentModalOpen] = useState(false);
  
  // Modal states for enrollment workflows
  const [isEnrollModalOpen, setIsEnrollModalOpen] = useState(false);
  const [isChangeClassModalOpen, setIsChangeClassModalOpen] = useState(false);
  const [isUnenrollModalOpen, setIsUnenrollModalOpen] = useState(false);
  const [selectedStudent, setSelectedStudent] = useState<Tables<'students'> | null>(null);
  
  // Fetch student subjects
  useEffect(() => {
    const fetchStudentSubjects = async () => {
      if (classStudents.length === 0) return;
      
      try {
        const { studentSubjects: subjectsData } = await import('@/features/students/api').then(m => 
          m.studentsApi.getDetailsForStudentIds(classStudents.map(s => s.id))
        );
        setStudentSubjects(subjectsData);
      } catch (err) {
        console.error('Error fetching student subjects:', err);
      }
    };
    
    fetchStudentSubjects();
  }, [classStudents]);

  // Modal handlers
  const handleViewStudent = (studentId: string) => {
    setSelectedStudentId(studentId);
    setIsStudentModalOpen(true);
  };

  const openEnrollModal = () => {
    setIsEnrollModalOpen(true);
  };

  const openChangeClassModal = (studentId: string) => {
    const student = classStudents.find(s => s.id === studentId);
    if (student) {
      setSelectedStudent(student);
      setIsChangeClassModalOpen(true);
    }
  };

  const openUnenrollModal = (studentId: string) => {
    const student = classStudents.find(s => s.id === studentId);
    if (student) {
      setSelectedStudent(student);
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
      onStudentsUpdated?.();
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
      onStudentsUpdated?.();
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
      onStudentsUpdated?.();
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

  // Fetch all students for enrollment modal
  const fetchStudentsForEnrollment = async () => {
    return allStudents;
  };

  // Fetch all classes for change class modal
  const fetchClassesForChange = async () => {
    const { classes, classSubjects: allClassSubjects, classStaff: allClassStaff, classStudents: allClassStudents } = await classesApi.getAllClassesWithDetails();
    return classes.map(c => ({
      ...c,
      subject: allClassSubjects[c.id],
      staff: allClassStaff[c.id] || [],
      students: allClassStudents[c.id] || []
    }));
  };

  if (!currentStaff) {
    return null;
  }

  return (
    <>
      <div className="flex-1 h-[calc(100vh-300px)] flex flex-col space-y-4">
        <div className="flex items-center gap-2">
          <h3 className="text-base font-medium">Students ({classStudents.length})</h3>
          
          <Button variant="outline" size="sm" className="ml-auto flex items-center gap-2" onClick={openEnrollModal}>
            <Plus className="h-4 w-4" />
            <span>Add Student</span>
          </Button>
        </div>
      
        {loadingStudents ? (
          <div className="flex-1 flex justify-center items-center">
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
          </div>
        ) : classStudents.length === 0 ? (
          <div className="flex-1 flex flex-col justify-center items-center">
            <Users className="h-12 w-12 text-muted-foreground mb-2" />
            <p className="text-sm text-muted-foreground mb-4">No students enrolled</p>
            <Button variant="outline" onClick={openEnrollModal}>
              <Plus className="h-4 w-4 mr-2" />
              Enroll a student
            </Button>
          </div>
        ) : (
          <ScrollArea className="flex-1">
            <div className="space-y-2">
              {/* Show enrolled students */}
              {classStudents
                .sort((a, b) => `${a.last_name} ${a.first_name}`.localeCompare(`${b.last_name} ${b.first_name}`))
                .map((student) => (
                  <StudentCard
                    key={student.id}
                    student={student}
                    subjects={studentSubjects[student.id] || []}
                    onClick={() => handleViewStudent(student.id)}
                    onChangeClass={() => openChangeClassModal(student.id)}
                    onUnenroll={() => openUnenrollModal(student.id)}
                  />
                ))}
            </div>
          </ScrollArea>
        )}
      </div>

      {/* Enrollment Modals */}
      <EnrollStudentModal
        isOpen={isEnrollModalOpen}
        onClose={() => setIsEnrollModalOpen(false)}
        context="class"
        class={classData}
        classSubject={classSubject}
        classStaff={classStaff}
        enrolledStudentIds={classStudents.map(s => s.id)}
        onFetchStudents={fetchStudentsForEnrollment}
        onEnroll={handleEnroll}
        currentStaffId={currentStaff.id}
      />

      {selectedStudent && (
        <ChangeClassModal
          isOpen={isChangeClassModalOpen}
          onClose={() => {
            setIsChangeClassModalOpen(false);
            setSelectedStudent(null);
          }}
          student={selectedStudent}
          studentSubjects={studentSubjects[selectedStudent.id] || []}
          oldClass={classData}
          oldClassSubject={classSubject}
          oldClassStaff={classStaff}
          onFetchClasses={fetchClassesForChange}
          onChange={handleChangeClass}
          currentStaffId={currentStaff.id}
        />
      )}

      {selectedStudent && (
        <UnenrollStudentModal
          isOpen={isUnenrollModalOpen}
          onClose={() => {
            setIsUnenrollModalOpen(false);
            setSelectedStudent(null);
          }}
          student={selectedStudent}
          studentSubjects={studentSubjects[selectedStudent.id] || []}
          class={classData}
          classSubject={classSubject}
          classStaff={classStaff}
          onUnenroll={handleUnenroll}
          currentStaffId={currentStaff.id}
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
            // Refresh would be handled by parent component
            // since we don't have direct access to refresh function here
            onStudentsUpdated?.();
          }}
        />
      )}
    </>
  );
} 