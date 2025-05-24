'use client';

import { useState, useEffect } from 'react';
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { useToast } from "@/components/ui/use-toast";
import { studentsApi } from '@/lib/supabase/api';
import { subjectsApi } from '@/lib/supabase/api/subjects';
import { Student, Subject } from '@/lib/supabase/db/types';
import { StudentDetailsTab, StudentDetailsFormData } from './tabs/StudentDetailsTab';
import { StudentSubjectsTab } from './tabs/StudentSubjectsTab';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { Trash2 } from 'lucide-react';
import { useRouter } from "next/navigation";

interface ViewStudentModalProps {
  isOpen: boolean;
  onClose: () => void;
  studentId: string | null;
  onStudentUpdated: () => void;
}

export function ViewStudentModal({ 
  isOpen, 
  studentId, 
  onClose, 
  onStudentUpdated 
}: ViewStudentModalProps) {
  // State
  const [student, setStudent] = useState<Student | null>(null);
  const [studentSubjects, setStudentSubjects] = useState<Subject[]>([]);
  const [allSubjects, setAllSubjects] = useState<Subject[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [loadingSubjects, setLoadingSubjects] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [activeTab, setActiveTab] = useState('details');
  
  const { toast } = useToast();
  const router = useRouter();

  // Fetch student data
  useEffect(() => {
    if (isOpen && studentId) {
      fetchStudent();
      fetchAllSubjects();
    } else {
      // Reset state when closing
      setStudent(null);
      setStudentSubjects([]);
      setAllSubjects([]);
      setIsEditing(false);
      setActiveTab('details');
    }
  }, [isOpen, studentId]);

  // Fetch student data
  const fetchStudent = async () => {
    if (!studentId) return;
    
    try {
      setIsLoading(true);
      
      // Fetch student details
      const studentData = await studentsApi.getStudent(studentId);
      setStudent(studentData || null);
      
      // Fetch student subjects
      if (studentData) {
        await fetchStudentSubjects(studentId);
      }
    } catch (err) {
      console.error('Failed to fetch student:', err);
      toast({
        title: 'Error',
        description: 'Failed to load student details.',
        variant: 'destructive',
      });
    } finally {
      setIsLoading(false);
    }
  };

  // Fetch student subjects
  const fetchStudentSubjects = async (id: string) => {
    try {
      setLoadingSubjects(true);
      const subjects = await studentsApi.getStudentSubjects(id);
      setStudentSubjects(subjects);
    } catch (err) {
      console.error('Failed to fetch student subjects:', err);
      toast({
        title: 'Error',
        description: 'Failed to load student subjects.',
        variant: 'destructive',
      });
    } finally {
      setLoadingSubjects(false);
    }
  };

  // Fetch all subjects for assignment
  const fetchAllSubjects = async () => {
    try {
      const subjects = await subjectsApi.getAllSubjects();
      setAllSubjects(subjects);
    } catch (err) {
      console.error('Failed to fetch subjects:', err);
    }
  };

  // Update student handler
  const handleStudentUpdate = async (data: StudentDetailsFormData) => {
    if (!student) return;
    
    try {
      setIsLoading(true);
      
      // Map form data to student update
      await studentsApi.updateStudent(student.id, {
        firstName: data.firstName,
        lastName: data.lastName,
        studentEmail: data.studentEmail === '' ? null : data.studentEmail,
        studentPhone: data.studentPhone || null,
        parentFirstName: data.parentFirstName || null,
        parentLastName: data.parentLastName || null,
        parentEmail: data.parentEmail === '' ? null : data.parentEmail,
        parentPhone: data.parentPhone || null,
        school: data.school || null,
        curriculum: data.curriculum || null,
                 yearLevel: data.yearLevel,
        status: data.status,
        notes: data.notes || null,
        availabilityMonday: data.availability_monday,
        availabilityTuesday: data.availability_tuesday,
        availabilityWednesday: data.availability_wednesday,
        availabilityThursday: data.availability_thursday,
        availabilityFriday: data.availability_friday,
        availabilitySaturdayAm: data.availability_saturday_am,
        availabilitySaturdayPm: data.availability_saturday_pm,
        availabilitySundayAm: data.availability_sunday_am,
        availabilitySundayPm: data.availability_sunday_pm,
      });
      
      // Refetch student
      await fetchStudent();
      
      // Reset edit mode
      setIsEditing(false);
      
      // Notify parent of update
      onStudentUpdated();
      
      toast({
        title: 'Student updated',
        description: 'Student has been updated successfully.',
      });
    } catch (err) {
      console.error('Failed to update student:', err);
      toast({
        title: 'Update failed',
        description: 'There was an error updating the student. Please try again.',
        variant: 'destructive',
      });
    } finally {
      setIsLoading(false);
    }
  };

  // Delete student handler
  const handleDelete = async () => {
    if (!student) return;
    
    try {
      setIsDeleting(true);
      await studentsApi.deleteStudent(student.id);
      
      toast({
        title: 'Student deleted',
        description: 'Student has been deleted successfully.',
      });
      
      // Close the modal and refresh the list
      onClose();
      onStudentUpdated();
    } catch (err) {
      console.error('Failed to delete student:', err);
      toast({
        title: 'Delete failed',
        description: 'There was an error deleting the student. Please try again.',
        variant: 'destructive',
      });
    } finally {
      setIsDeleting(false);
    }
  };

  // Subject handlers
  const handleAssignSubject = async (subjectId: string) => {
    if (!student) return;
    
    try {
      setLoadingSubjects(true);
      await studentsApi.assignSubjectToStudent(student.id, subjectId);
      
      // Refetch subjects
      await fetchStudentSubjects(student.id);
      
      toast({
        title: 'Subject assigned',
        description: 'Subject has been assigned to student.',
      });
    } catch (err) {
      console.error('Failed to assign subject:', err);
      toast({
        title: 'Assignment failed',
        description: 'There was an error assigning the subject. Please try again.',
        variant: 'destructive',
      });
    } finally {
      setLoadingSubjects(false);
    }
  };

  const handleRemoveSubject = async (subjectId: string) => {
    if (!student) return;
    
    try {
      setLoadingSubjects(true);
      await studentsApi.removeSubjectFromStudent(student.id, subjectId);
      
      // Refetch subjects
      await fetchStudentSubjects(student.id);
      
      toast({
        title: 'Subject removed',
        description: 'Subject has been removed from student.',
      });
    } catch (err) {
      console.error('Failed to remove subject:', err);
      toast({
        title: 'Removal failed',
        description: 'There was an error removing the subject. Please try again.',
        variant: 'destructive',
      });
    } finally {
      setLoadingSubjects(false);
    }
  };

  const handleViewSubject = (subjectId: string) => {
    // Close the current student modal
    onClose();
    // Navigate to the subjects page with the subject ID as a view parameter
    router.push(`/dashboard/subjects?view=${subjectId}`);
  };

  // Early return if no student loaded
  if (!student) {
    return (
      <Sheet open={isOpen} onOpenChange={onClose}>
        <SheetContent>
          <SheetHeader>
            <SheetTitle>Loading student...</SheetTitle>
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
            {student.firstName} {student.lastName}
          </SheetTitle>
        </SheetHeader>
        
        <div className="mt-6">
          <Tabs 
            defaultValue="details" 
            value={activeTab} 
            onValueChange={setActiveTab}
            className="w-full"
          >
            <TabsList className="w-full">
              <TabsTrigger value="details" className="flex-1">Details</TabsTrigger>
              <TabsTrigger value="subjects" className="flex-1">Subjects</TabsTrigger>
            </TabsList>
            
            <TabsContent value="details" className="mt-4">
              <StudentDetailsTab
                student={student}
                isEditing={isEditing}
                isLoading={isLoading}
                onEdit={() => setIsEditing(true)}
                onCancelEdit={() => setIsEditing(false)}
                onSubmit={handleStudentUpdate}
              />
              
              {/* Delete button in details tab */}
              <div className="mt-6 pt-6 border-t">
                <AlertDialog>
                  <AlertDialogTrigger asChild>
                    <Button 
                      variant="destructive" 
                      size="sm"
                      disabled={isLoading || isDeleting}
                      className="flex items-center gap-2"
                    >
                      <Trash2 className="h-4 w-4" />
                      Delete Student
                    </Button>
                  </AlertDialogTrigger>
                  <AlertDialogContent>
                    <AlertDialogHeader>
                      <AlertDialogTitle>Are you sure?</AlertDialogTitle>
                      <AlertDialogDescription>
                        This action cannot be undone. This will permanently delete the student
                        "{student.firstName} {student.lastName}" and remove all their data from the system.
                      </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                      <AlertDialogCancel>Cancel</AlertDialogCancel>
                      <AlertDialogAction 
                        onClick={handleDelete}
                        className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                      >
                        {isDeleting ? 'Deleting...' : 'Delete Student'}
                      </AlertDialogAction>
                    </AlertDialogFooter>
                  </AlertDialogContent>
                </AlertDialog>
              </div>
            </TabsContent>
            
            <TabsContent value="subjects" className="mt-4">
              <StudentSubjectsTab
                student={student}
                studentSubjects={studentSubjects}
                allSubjects={allSubjects}
                loadingSubjects={loadingSubjects}
                onViewSubject={handleViewSubject}
                onAssignSubject={handleAssignSubject}
                onRemoveSubject={handleRemoveSubject}
              />
            </TabsContent>
          </Tabs>
        </div>
      </SheetContent>
    </Sheet>
  );
} 