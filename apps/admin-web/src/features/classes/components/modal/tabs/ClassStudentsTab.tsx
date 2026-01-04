import { useState, useEffect } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import type { Tables, ClassWithExpandedSubject } from '@altitutor/shared';
import { ScrollArea, Button } from "@altitutor/ui";
import { Loader2, Users, Plus } from "lucide-react";
import { ViewStudentModal } from '@/features/students';
import { StudentCard } from '@/shared/components/StudentCard';
import { EnrollStudentModal, ChangeClassModal, UnenrollStudentModal } from '@/shared/components/modals';
import { classesApi } from '@/shared/api';
import { useCurrentStaff } from '@/features/staff/hooks/useStaffQuery';
import { useToast } from "@altitutor/ui";
import { classesKeys } from '../../../hooks/useClassesQuery';
import { useChatStore } from '@/features/messages/state/chatStore';
import { ensureConversationForRelated } from '@/features/messages/api/queries';

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
  onViewStudent: _onViewStudent,
  onStudentsUpdated
}: ClassStudentsTabProps) {
  const { toast } = useToast();
  const { data: currentStaff } = useCurrentStaff();
  const queryClient = useQueryClient();
  const openWindow = useChatStore(s => s.openWindow);
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
      // Invalidate class details and classes list
      queryClient.invalidateQueries({ queryKey: classesKeys.detailFull(params.classId) });
      queryClient.invalidateQueries({ queryKey: classesKeys.minimal() });
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
      // Invalidate both old and new class details, and classes list
      queryClient.invalidateQueries({ queryKey: classesKeys.detailFull(params.oldClassId) });
      queryClient.invalidateQueries({ queryKey: classesKeys.detailFull(params.newClassId) });
      queryClient.invalidateQueries({ queryKey: classesKeys.minimal() });
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
      // Invalidate class details and classes list
      queryClient.invalidateQueries({ queryKey: classesKeys.detailFull(params.classId) });
      queryClient.invalidateQueries({ queryKey: classesKeys.minimal() });
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

  // Handle message student
  const handleMessageStudent = async (studentId: string) => {
    try {
      const conversationId = await ensureConversationForRelated(studentId, 'student');
      if (conversationId) {
        openWindow({ conversationId, title: 'Student' });
      }
    } catch (error) {
      console.error('Failed to open conversation:', error);
      toast({
        title: 'Error',
        description: 'Failed to open conversation. Please try again.',
        variant: 'destructive',
      });
    }
  };

  // Fetch all students for enrollment modal
  const fetchStudentsForEnrollment = async (): Promise<Array<Tables<'students'> & { subjects?: Tables<'subjects'>[]; isAlreadyEnrolled?: boolean; existingClassSubject?: Tables<'subjects'> }>> => {
    if (!classSubject) {
      return allStudents.map(s => ({ ...s, subjects: [] }));
    }
    
    const { getSupabaseClient } = await import('@/shared/lib/supabase/client');
    const supabase = getSupabaseClient();
    
    // Use search_students_admin RPC to fetch all students linked to this subject
    const { data: rpcResult, error: rpcError } = await supabase.rpc('search_students_admin', {
      p_search: undefined,
      p_statuses: undefined, // Get all statuses
      p_subject_ids: [classSubject.id],
      p_include_relationships: true,
      p_limit: 10000, // High limit to get all students
      p_offset: 0,
      p_order_by: 'last_name',
      p_ascending: true,
    });
    
    if (rpcError) throw rpcError;
    if (!rpcResult) return [];
    
    const rpcData = rpcResult as { students: Array<{
      id: string;
      first_name: string | null;
      last_name: string | null;
      status: string;
      curriculum: string | null;
      year_level: number | null;
      school: string | null;
      email: string | null;
      phone: string | null;
      created_at: string | null;
      updated_at: string | null;
    }>; total: number };
    const rpcStudents = rpcData.students || [];
    
    // Transform RPC response to match Tables<'students'> format
    const students = rpcStudents.map((s) => ({
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
    })) as Tables<'students'>[];
    
    // Get student subjects and classes to check enrollment status
    const studentIds = students.map(s => s.id);
    const { studentSubjects, studentClasses } = await import('@/features/students/api').then(m => 
      m.studentsApi.getDetailsForStudentIds(studentIds)
    );
    
    // Check which students are already enrolled in a class for this subject
    return students.map(student => {
      const studentCls = studentClasses[student.id] || [];
      const hasClassOfSubject = studentCls.some(cls => cls.subject_id === classSubject.id);
      const existingClass = hasClassOfSubject ? studentCls.find(cls => cls.subject_id === classSubject.id) : null;
      
      return {
        ...student,
        subjects: studentSubjects[student.id] || [],
        isAlreadyEnrolled: hasClassOfSubject,
        existingClassSubject: existingClass?.subject || undefined
      };
    });
  };

  // Fetch all classes for change class modal
  const fetchClassesForChange = async (): Promise<ClassWithExpandedSubject[]> => {
    const { classes, classSubjects: allClassSubjects, classStaff: allClassStaff, classStudents: allClassStudents } = await classesApi.getAllClassesWithDetails();
    return classes.map(c => {
      return {
        ...c,
        subject: allClassSubjects[c.id],
        staff: allClassStaff[c.id] || [],
        students: allClassStudents[c.id] || []
      } as ClassWithExpandedSubject;
    });
  };

  if (!currentStaff) {
    return null;
  }

  return (
    <>
      <div className="flex-1 min-h-0 flex flex-col space-y-4">
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
          <ScrollArea className="flex-1 min-h-0">
            <div className="space-y-2 pr-4">
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
                    onMessage={() => handleMessageStudent(student.id)}
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
        classData={classData}
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