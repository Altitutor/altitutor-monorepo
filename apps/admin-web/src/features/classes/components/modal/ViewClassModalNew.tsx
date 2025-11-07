import { useState, useEffect } from 'react';
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@altitutor/ui";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@altitutor/ui";
import { useToast } from "@altitutor/ui";
import { classesApi } from "../../api";
import { subjectsApi } from '@/features/subjects/api';
import { studentsApi } from '@/features/students/api';
import { staffApi } from "@/features/staff/api";
import { useCurrentStaff } from '@/features/staff/hooks/useStaffQuery';
import type { Tables, TablesUpdate } from '@altitutor/shared';
import { ClassInfoTab, ClassInfoFormData } from './tabs/ClassInfoTab';
import { ClassStudentsTabNew } from './tabs/ClassStudentsTabNew';
import { ClassStaffTab } from './tabs/ClassStaffTab';
import { EnrollStudentModal, ChangeClassModal, UnenrollStudentModal } from '@/shared/components/modals';

interface ViewClassModalNewProps {
  isOpen: boolean;
  classId: string | null;
  onClose: () => void;
  onClassUpdated: () => void;
}

export function ViewClassModalNew({ 
  isOpen, 
  classId, 
  onClose, 
  onClassUpdated 
}: ViewClassModalNewProps) {
  // State
  const [classData, setClassData] = useState<Tables<'classes'> | null>(null);
  const [subject, setSubject] = useState<Tables<'subjects'> | null>(null);
  const [subjects, setSubjects] = useState<Tables<'subjects'>[]>([]);
  const [classStudents, setClassStudents] = useState<Array<Tables<'students'> & { subjects?: Tables<'subjects'>[]; enrollment?: any }>>([]);
  const [classStaff, setClassStaff] = useState<Tables<'staff'>[]>([]);
  const [allStudents, setAllStudents] = useState<Tables<'students'>[]>([]);
  const [allStaff, setAllStaff] = useState<Tables<'staff'>[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [loadingStudents, setLoadingStudents] = useState(false);
  const [loadingStaff, setLoadingStaff] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [activeTab, setActiveTab] = useState('info');
  
  // Modal states
  const [isEnrollModalOpen, setIsEnrollModalOpen] = useState(false);
  const [isChangeClassModalOpen, setIsChangeClassModalOpen] = useState(false);
  const [isUnenrollModalOpen, setIsUnenrollModalOpen] = useState(false);
  const [selectedStudent, setSelectedStudent] = useState<Tables<'students'> & { subjects?: Tables<'subjects'>[] } | null>(null);
  const [selectedStudentEnrollment, setSelectedStudentEnrollment] = useState<any>(null);
  
  const { toast } = useToast();
  const { data: currentStaff } = useCurrentStaff();

  // Fetch class data using the optimized method
  useEffect(() => {
    if (isOpen && classId) {
      fetchClassData();
      fetchAllData();
    } else {
      // Reset state when closing
      setClassData(null);
      setSubject(null);
      setClassStudents([]);
      setClassStaff([]);
      setIsEditing(false);
      setActiveTab('info');
    }
  }, [isOpen, classId]);

  // Optimized fetch that gets all data in one efficient call
  const fetchClassData = async () => {
    if (!classId) return;
    
    try {
      setIsLoading(true);
      
      // Use the targeted method for single class
      const { class: currentClass, subject: subjectData, students, staff } = await classesApi.getClassWithDetails(classId);
      
      if (!currentClass) {
        throw new Error('Class not found');
      }
      
      setClassData(currentClass);
      setClassStaff(staff);
      setSubject(subjectData);
      
      // Fetch student details with their subjects
      const { studentSubjects } = await studentsApi.getDetailsForStudentIds(students.map(s => s.id));
      
      const studentsWithSubjects = students.map(s => ({
        ...s,
        subjects: studentSubjects[s.id] || [],
        enrollment: {} // You'd fetch enrollment details here
      }));
      
      setClassStudents(studentsWithSubjects);
    } catch (err) {
      console.error('Failed to fetch class:', err);
      toast({
        title: 'Error',
        description: 'Failed to load class details.',
        variant: 'destructive',
      });
    } finally {
      setIsLoading(false);
    }
  };

  // Fetch reference data lazily for pickers
  const fetchAllData = async () => {
    try {
      const [subjectsPage, studentsPage, staffPage] = await Promise.all([
        subjectsApi.list({ search: '', limit: 100, offset: 0 }),
        studentsApi.list({ search: '', limit: 100, offset: 0 }),
        staffApi.list({ search: '', limit: 100, offset: 0 }),
      ]);
      setSubjects(subjectsPage.subjects);
      setAllStudents(studentsPage.students);
      setAllStaff(staffPage.staff);
    } catch (err) {
      console.error('Failed to fetch reference data:', err);
      toast({
        title: 'Warning',
        description: 'Some data may not be available for editing.',
        variant: 'destructive',
      });
    }
  };

  // Update class handler
  const handleClassUpdate = async (data: ClassInfoFormData) => {
    if (!classData) return;
    
    try {
      setIsLoading(true);
      
      const updateData: TablesUpdate<'classes'> = {
        level: data.level,
        day_of_week: data.dayOfWeek,
        start_time: data.startTime,
        end_time: data.endTime,
        status: data.status,
        subject_id: data.subjectId || null,
        room: data.room || null,
      };
      await classesApi.updateClass(classData.id, updateData);
      
      // Refetch class
      await fetchClassData();
      
      // Reset edit mode
      setIsEditing(false);
      
      // Notify parent of update
      onClassUpdated();
      
      toast({
        title: 'Class updated',
        description: 'Class has been updated successfully.',
      });
    } catch (err) {
      console.error('Failed to update class:', err);
      toast({
        title: 'Update failed',
        description: 'There was an error updating the class. Please try again.',
        variant: 'destructive',
      });
    } finally {
      setIsLoading(false);
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
      await fetchClassData(); // Reload
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
      await fetchClassData(); // Reload
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
      await fetchClassData(); // Reload
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

  // Handle staff assignment
  const handleAssignStaff = async (staffId: string) => {
    if (!classData) return;
    
    try {
      await classesApi.assignStaff(classData.id, staffId);
      await fetchClassData(); // Reload
      toast({
        title: 'Success',
        description: 'Staff assigned successfully.',
      });
    } catch (err) {
      console.error('Failed to assign staff:', err);
      toast({
        title: 'Assignment failed',
        description: 'There was an error assigning the staff. Please try again.',
        variant: 'destructive',
      });
    }
  };

  // Handle staff removal
  const handleRemoveStaff = async (staffId: string) => {
    if (!classData) return;
    
    try {
      await classesApi.unassignStaff(classData.id, staffId);
      await fetchClassData(); // Reload
      toast({
        title: 'Success',
        description: 'Staff removed successfully.',
      });
    } catch (err) {
      console.error('Failed to remove staff:', err);
      toast({
        title: 'Removal failed',
        description: 'There was an error removing the staff. Please try again.',
        variant: 'destructive',
      });
    }
  };

  // Modal triggers
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

  // Fetch all students with their subjects for enrollment modal
  const fetchStudentsForEnrollment = async () => {
    const { students: allStudents, studentSubjects } = await studentsApi.getAllStudentsWithSubjectsAndClasses();
    return allStudents.map(s => ({
      ...s,
      subjects: studentSubjects[s.id] || []
    }));
  };

  // Fetch all classes for change class modal
  const fetchClassesForChange = async () => {
    const { classes, classSubjects, classStaff } = await classesApi.getAllClassesWithDetails();
    return classes.map(c => ({
      ...c,
      subject: classSubjects[c.id],
      staff: classStaff[c.id] || [],
      students: []
    }));
  };

  // Early return if no class data loaded
  if (!classData) {
    return (
      <Sheet open={isOpen} onOpenChange={onClose}>
        <SheetContent>
          <SheetHeader>
            <SheetTitle>Loading class...</SheetTitle>
          </SheetHeader>
        </SheetContent>
      </Sheet>
    );
  }

  if (!currentStaff) {
    return null;
  }

  return (
    <>
      <Sheet open={isOpen} onOpenChange={onClose}>
        <SheetContent className="overflow-y-auto max-w-md">
          <SheetHeader>
            <SheetTitle>
              {classData.level}
            </SheetTitle>
          </SheetHeader>
          
          <div className="mt-6">
            <Tabs 
              defaultValue="info" 
              value={activeTab} 
              onValueChange={setActiveTab}
              className="w-full"
            >
              <TabsList className="w-full">
                <TabsTrigger value="info" className="flex-1">Info</TabsTrigger>
                <TabsTrigger value="students" className="flex-1">Students</TabsTrigger>
                <TabsTrigger value="staff" className="flex-1">Staff</TabsTrigger>
              </TabsList>
              
              <TabsContent value="info" className="mt-4">
                <ClassInfoTab
                  classData={classData}
                  subject={subject}
                  subjects={subjects}
                  isEditing={isEditing}
                  isLoading={isLoading}
                  onEdit={() => setIsEditing(true)}
                  onCancelEdit={() => setIsEditing(false)}
                  onSubmit={handleClassUpdate}
                />
              </TabsContent>
              
              <TabsContent value="students" className="mt-4">
                <ClassStudentsTabNew
                  classData={classData}
                  classSubject={subject || undefined}
                  classStaff={classStaff}
                  classStudents={classStudents}
                  loadingStudents={loadingStudents}
                  onAddStudent={openEnrollModal}
                  onChangeClass={openChangeClassModal}
                  onUnenroll={openUnenrollModal}
                />
              </TabsContent>
              
              <TabsContent value="staff" className="mt-4">
                <ClassStaffTab
                  classData={classData}
                  classStaff={classStaff}
                  allStaff={allStaff}
                  loadingStaff={loadingStaff}
                  onAssignStaff={handleAssignStaff}
                  onRemoveStaff={handleRemoveStaff}
                />
              </TabsContent>
            </Tabs>
          </div>
        </SheetContent>
      </Sheet>

      {/* Enrollment Modal */}
      <EnrollStudentModal
        isOpen={isEnrollModalOpen}
        onClose={() => setIsEnrollModalOpen(false)}
        context="class"
        classData={classData}
        classSubject={subject || undefined}
        classStaff={classStaff}
        enrolledStudentIds={classStudents.map(s => s.id)}
        onFetchStudents={fetchStudentsForEnrollment}
        onEnroll={handleEnroll}
        currentStaffId={currentStaff.id}
      />

      {/* Change Class Modal */}
      {selectedStudent && (
        <ChangeClassModal
          isOpen={isChangeClassModalOpen}
          onClose={() => {
            setIsChangeClassModalOpen(false);
            setSelectedStudent(null);
          }}
          student={selectedStudent}
          studentSubjects={selectedStudent.subjects}
          oldClass={classData}
          oldClassSubject={subject || undefined}
          oldClassStaff={classStaff}
          onFetchClasses={fetchClassesForChange}
          onChange={handleChangeClass}
          currentStaffId={currentStaff.id}
        />
      )}

      {/* Unenroll Modal */}
      {selectedStudent && (
        <UnenrollStudentModal
          isOpen={isUnenrollModalOpen}
          onClose={() => {
            setIsUnenrollModalOpen(false);
            setSelectedStudent(null);
          }}
          student={selectedStudent}
          studentSubjects={selectedStudent.subjects}
          class={classData}
          classSubject={subject || undefined}
          classStaff={classStaff}
          onUnenroll={handleUnenroll}
          currentStaffId={currentStaff.id}
        />
      )}
    </>
  );
}

