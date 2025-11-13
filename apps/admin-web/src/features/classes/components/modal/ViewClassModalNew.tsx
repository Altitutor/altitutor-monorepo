import { useState, useEffect, useCallback } from 'react';
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@altitutor/ui";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@altitutor/ui";
import { useToast } from "@altitutor/ui";
import { classesApi } from "../../api";
import { useClassDetails } from '../../hooks/useClassesQuery';
import { useSubjects } from '@/features/subjects';
import { useStudents } from '@/features/students/hooks/useStudentsQuery';
import { useStaff } from '@/features/staff/hooks/useStaffQuery';
import { useUpdateClass } from '../../hooks/useClassesQuery';
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
  // Use React Query hooks for data fetching
  const { data: classDetails, isLoading } = useClassDetails(classId || '', isOpen && !!classId);
  const { data: allSubjects = [] } = useSubjects();
  const { data: allStudentsData = [] } = useStudents();
  const { data: allStaffData = [] } = useStaff();
  const updateClassMutation = useUpdateClass();
  
  // Extract data from classDetails
  const classData = classDetails?.class || null;
  const subject = classDetails?.subject || null;
  const classStudents = classDetails?.students || [];
  const classStaff = classDetails?.staff || [];
  const upcomingSessions = classDetails?.upcomingSessions || [];
  
  const [isEditing, setIsEditing] = useState(false);
  const [activeTab, setActiveTab] = useState('info');
  
  // Modal states
  const [isEnrollModalOpen, setIsEnrollModalOpen] = useState(false);
  const [isChangeClassModalOpen, setIsChangeClassModalOpen] = useState(false);
  const [isUnenrollModalOpen, setIsUnenrollModalOpen] = useState(false);
  const [selectedStudent, setSelectedStudent] = useState<Tables<'students'> & { subjects?: Tables<'subjects'>[] } | null>(null);
  
  const { toast } = useToast();
  const { data: currentStaff } = useCurrentStaff();

  // Reset states when modal closes
  useEffect(() => {
    if (!isOpen) {
      setIsEditing(false);
      setActiveTab('info');
    }
  }, [isOpen]);

  // Update class handler
  const handleClassUpdate = async (data: ClassInfoFormData) => {
    if (!classData) return;
    
    try {
      const updateData: TablesUpdate<'classes'> = {
        level: data.level,
        day_of_week: data.dayOfWeek,
        start_time: data.startTime,
        end_time: data.endTime,
        status: data.status,
        subject_id: data.subjectId || null,
        room: data.room || null,
      };
      await updateClassMutation.mutateAsync({ id: classData.id, data: updateData });
      
      // Reset edit mode
      setIsEditing(false);
      
      // Notify parent of update
      onClassUpdated();
      // React Query will automatically refetch via invalidation
      
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
      // React Query will automatically refetch via invalidation
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
      // React Query will automatically refetch via invalidation
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
      // React Query will automatically refetch via invalidation
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
      // React Query will automatically refetch via invalidation
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
      // React Query will automatically refetch via invalidation
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
    // Use the existing allStudentsData from useStudents hook
    return allStudentsData;
  };

  // Fetch all classes for change class modal
  const fetchClassesForChange = async () => {
    // Simplified: just fetch basic classes for the modal
    const classes = await classesApi.getAllClasses();
    return classes;
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
                  subjects={allSubjects}
                  isEditing={isEditing}
                  isLoading={isLoading || updateClassMutation.isPending}
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
                  loadingStudents={false}
                  onAddStudent={openEnrollModal}
                  onChangeClass={openChangeClassModal}
                  onUnenroll={openUnenrollModal}
                />
              </TabsContent>
              
              <TabsContent value="staff" className="mt-4">
                <ClassStaffTab
                  classData={classData}
                  classStaff={classStaff}
                  allStaff={allStaffData}
                  loadingStaff={false}
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

