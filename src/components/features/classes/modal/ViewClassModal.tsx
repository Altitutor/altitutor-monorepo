import { useState, useEffect } from 'react';
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useToast } from "@/components/ui/use-toast";
import { classesApi } from "@/lib/supabase/api/classes";
import { subjectsApi } from "@/lib/supabase/api/subjects";
import { studentsApi } from "@/lib/supabase/api/students";
import { staffApi } from "@/lib/supabase/api/staff";
import { Class, Subject, Student, Staff } from "@/lib/supabase/db/types";
import { ClassInfoTab, ClassInfoFormData } from './tabs/ClassInfoTab';
import { ClassStudentsTab } from './tabs/ClassStudentsTab';
import { ClassStaffTab } from './tabs/ClassStaffTab';

interface ViewClassModalProps {
  isOpen: boolean;
  classId: string | null;
  onClose: () => void;
  onClassUpdated: () => void;
}

export function ViewClassModal({ 
  isOpen, 
  classId, 
  onClose, 
  onClassUpdated 
}: ViewClassModalProps) {
  // State
  const [classData, setClassData] = useState<Class | null>(null);
  const [subject, setSubject] = useState<Subject | null>(null);
  const [subjects, setSubjects] = useState<Subject[]>([]);
  const [classStudents, setClassStudents] = useState<Student[]>([]);
  const [classStaff, setClassStaff] = useState<Staff[]>([]);
  const [allStudents, setAllStudents] = useState<Student[]>([]);
  const [allStaff, setAllStaff] = useState<Staff[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [loadingStudents, setLoadingStudents] = useState(false);
  const [loadingStaff, setLoadingStaff] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [activeTab, setActiveTab] = useState('info');
  
  const { toast } = useToast();

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
      
      // Use the targeted method for single class instead of fetching all classes
      const { class: currentClass, subject: subjectData, students, staff } = await classesApi.getClassWithDetails(classId);
      
      if (!currentClass) {
        throw new Error('Class not found');
      }
      
      setClassData(currentClass);
      setClassStudents(students);
      setClassStaff(staff);
      setSubject(subjectData);
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

  // Fetch all reference data (subjects, students, staff) in parallel
  const fetchAllData = async () => {
    try {
      const [subjectsData, studentsData, staffData] = await Promise.all([
        subjectsApi.getAllSubjects(),
        studentsApi.getAllStudents(),
        staffApi.getAllStaff()
      ]);
      
      setSubjects(subjectsData);
      setAllStudents(studentsData);
      setAllStaff(staffData);
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
      
      await classesApi.updateClass(classData.id, {
        level: data.level,
        dayOfWeek: data.dayOfWeek,
        startTime: data.startTime,
        endTime: data.endTime,
        status: data.status,
        subjectId: data.subjectId || undefined,
        room: data.room || undefined,
        notes: data.notes || undefined,
      });
      
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

  // Handle student enrollment
  const handleEnrollStudent = async (studentId: string) => {
    if (!classData) return;
    
    try {
      await classesApi.enrollStudent(classData.id, studentId);
      await refreshClassStudents(); // Reload class with updated students
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
    }
  };

  // Handle student removal
  const handleRemoveStudent = async (studentId: string) => {
    if (!classData) return;
    
    try {
      await classesApi.unenrollStudent(classData.id, studentId);
      await refreshClassStudents(); // Reload class with updated students
      toast({
        title: 'Success',
        description: 'Student removed successfully.',
      });
    } catch (err) {
      console.error('Failed to remove student:', err);
      toast({
        title: 'Removal failed',
        description: 'There was an error removing the student. Please try again.',
        variant: 'destructive',
      });
    }
  };

  // Handle staff assignment
  const handleAssignStaff = async (staffId: string) => {
    if (!classData) return;
    
    try {
      await classesApi.assignStaff(classData.id, staffId);
      await refreshClassStaff(); // Reload class with updated staff
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
      await refreshClassStaff(); // Reload class with updated staff
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

  // Fast refresh for just students after enrollment/removal
  const refreshClassStudents = async () => {
    if (!classId) return;
    
    try {
      const { students } = await classesApi.getClassWithDetails(classId);
      setClassStudents(students);
    } catch (err) {
      console.error('Failed to refresh students:', err);
    }
  };

  // Fast refresh for just staff after assignment/removal
  const refreshClassStaff = async () => {
    if (!classId) return;
    
    try {
      const { staff } = await classesApi.getClassWithDetails(classId);
      setClassStaff(staff);
    } catch (err) {
      console.error('Failed to refresh staff:', err);
    }
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

  return (
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
              <ClassStudentsTab
                classData={classData}
                classStudents={classStudents}
                allStudents={allStudents}
                loadingStudents={loadingStudents}
                onEnrollStudent={handleEnrollStudent}
                onRemoveStudent={handleRemoveStudent}
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
  );
} 