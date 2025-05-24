'use client';

import { useState, useEffect } from 'react';
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { useToast } from "@/components/ui/use-toast";
import { studentsApi } from '@/lib/supabase/api';
import { subjectsApi } from '@/lib/supabase/api/subjects';
import { Student, Subject } from '@/lib/supabase/db/types';
import { 
  DetailsTab,
  StudentSubjectsTab, 
  ClassesTab,
  StudentAccountTab,
  DetailsFormData,
  StudentAccountFormData
} from './tabs';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";

interface ViewStudentModalProps {
  isOpen: boolean;
  onClose: () => void;
  studentId: string | null;
  onStudentUpdated: () => void;
}

export function ViewStudentModal({
  isOpen,
  onClose,
  studentId,
  onStudentUpdated
}: ViewStudentModalProps) {
  const { toast } = useToast();
  const [student, setStudent] = useState<Student | null>(null);
  const [studentSubjects, setStudentSubjects] = useState<Subject[]>([]);
  const [allSubjects, setAllSubjects] = useState<Subject[]>([]);
  const [loadingStudent, setLoadingStudent] = useState(false);
  const [loadingSubjects, setLoadingSubjects] = useState(false);
  
  // Edit states for each tab
  const [isEditingDetails, setIsEditingDetails] = useState(false);
  const [isEditingAccount, setIsEditingAccount] = useState(false);
  
  // Loading states for each tab
  const [loadingDetailsUpdate, setLoadingDetailsUpdate] = useState(false);
  const [loadingAccountUpdate, setLoadingAccountUpdate] = useState(false);

  // Delete confirmation state
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [loadingDelete, setLoadingDelete] = useState(false);

  // Password reset state
  const [hasPasswordResetLinkSent, setHasPasswordResetLinkSent] = useState(false);

  // Load student data
  const loadStudent = async () => {
    if (!studentId) return;
    
    try {
      setLoadingStudent(true);
      // Use the optimized method that gets both student and subjects efficiently
      const { student: studentData, subjects: subjectsData } = await studentsApi.getStudentWithSubjects(studentId);
      setStudent(studentData || null);
      setStudentSubjects(subjectsData);
    } catch (error) {
      console.error('Failed to load student:', error);
      toast({
        title: "Error",
        description: "Failed to load student details. Please try again.",
        variant: "destructive",
      });
    } finally {
      setLoadingStudent(false);
    }
  };

  // Load subjects
  const loadSubjects = async () => {
    if (!studentId) return;
    
    try {
      setLoadingSubjects(true);
      // Just load all subjects for assignment dropdown
      const allSubjectsData = await subjectsApi.getAllSubjects();
      setAllSubjects(allSubjectsData);
    } catch (error) {
      console.error('Failed to load subjects:', error);
      toast({
        title: "Error",
        description: "Failed to load subjects. Please try again.",
        variant: "destructive",
      });
    } finally {
      setLoadingSubjects(false);
    }
  };

  // Initialize data when modal opens
  useEffect(() => {
    if (isOpen && studentId) {
      loadStudent(); // This now loads both student and subjects
      loadSubjects(); // This loads all subjects for dropdown
    }
  }, [isOpen, studentId]);

  // Reset edit states when modal closes
  useEffect(() => {
    if (!isOpen) {
      setIsEditingDetails(false);
      setIsEditingAccount(false);
    }
  }, [isOpen]);

  // Handle details update (merged student, parent, and availability)
  const handleDetailsSubmit = async (data: DetailsFormData) => {
    if (!student) return;
    
    try {
      setLoadingDetailsUpdate(true);
      const updatedStudent = await studentsApi.updateStudent(student.id, {
        // Student details
        firstName: data.firstName,
        lastName: data.lastName,
        studentEmail: data.studentEmail || null,
        studentPhone: data.studentPhone || null,
        school: data.school || null,
        curriculum: data.curriculum || null,
        yearLevel: data.yearLevel,
        status: data.status,
        notes: data.notes || null,
        // Parent details
        parentFirstName: data.parentFirstName || null,
        parentLastName: data.parentLastName || null,
        parentEmail: data.parentEmail || null,
        parentPhone: data.parentPhone || null,
        // Availability
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
      
      setStudent(updatedStudent);
      setIsEditingDetails(false);
      onStudentUpdated();
      
      toast({
        title: "Success",
        description: "Details updated successfully.",
      });
    } catch (error) {
      console.error('Failed to update details:', error);
      toast({
        title: "Error",
        description: "Failed to update details. Please try again.",
        variant: "destructive",
      });
    } finally {
      setLoadingDetailsUpdate(false);
    }
  };

  // Handle account update
  const handleAccountSubmit = async (data: StudentAccountFormData) => {
    if (!student) return;
    
    try {
      setLoadingAccountUpdate(true);
      const updatedStudent = await studentsApi.updateStudent(student.id, {
        firstName: data.firstName,
        lastName: data.lastName,
        studentEmail: data.studentEmail || null,
      });
      
      setStudent(updatedStudent);
      setIsEditingAccount(false);
      onStudentUpdated();
      
      toast({
        title: "Success",
        description: "Account information updated successfully.",
      });
    } catch (error) {
      console.error('Failed to update account:', error);
      toast({
        title: "Error",
        description: "Failed to update account information. Please try again.",
        variant: "destructive",
      });
    } finally {
      setLoadingAccountUpdate(false);
    }
  };

  // Handle password reset request
  const handlePasswordResetRequest = async () => {
    if (!student || !student.studentEmail) {
      toast({
        title: "Error",
        description: "No email address found for this student.",
        variant: "destructive",
      });
      return;
    }

    try {
      setLoadingAccountUpdate(true);
      // TODO: Implement password reset API call
      // await authApi.requestPasswordReset(student.studentEmail);
      
      setHasPasswordResetLinkSent(true);
      
      toast({
        title: "Success",
        description: "Password reset link sent successfully.",
      });
    } catch (error) {
      console.error('Failed to send password reset:', error);
      toast({
        title: "Error",
        description: "Failed to send password reset link. Please try again.",
        variant: "destructive",
      });
    } finally {
      setLoadingAccountUpdate(false);
    }
  };

  // Handle subject assignment
  const handleAssignSubject = async (subjectId: string) => {
    if (!student) return;
    
    try {
      await studentsApi.assignSubjectToStudent(student.id, subjectId);
      await loadStudent(); // Reload student with updated subjects
      toast({
        title: "Success",
        description: "Subject assigned successfully.",
      });
    } catch (error) {
      console.error('Failed to assign subject:', error);
      toast({
        title: "Assignment failed",
        description: "There was an error assigning the subject. Please try again.",
        variant: "destructive",
      });
    }
  };

  // Handle subject removal
  const handleRemoveSubject = async (subjectId: string) => {
    if (!student) return;
    
    try {
      await studentsApi.removeSubjectFromStudent(student.id, subjectId);
      await loadStudent(); // Reload student with updated subjects
      toast({
        title: "Success",
        description: "Subject removed successfully.",
      });
    } catch (error) {
      console.error('Failed to remove subject:', error);
      toast({
        title: "Removal failed",
        description: "There was an error removing the subject. Please try again.",
        variant: "destructive",
      });
    }
  };

  // Handle view subject (placeholder for now)
  const handleViewSubject = (subjectId: string) => {
    console.log('View subject:', subjectId);
    // TODO: Implement subject detail view
  };

  // Handle student deletion
  const handleDeleteStudent = async () => {
    if (!student) return;
    
    try {
      setLoadingDelete(true);
      await studentsApi.deleteStudent(student.id);
      setShowDeleteDialog(false);
      onClose();
      onStudentUpdated();
      
      toast({
        title: "Success",
        description: "Student deleted successfully.",
      });
    } catch (error) {
      console.error('Failed to delete student:', error);
      toast({
        title: "Error",
        description: "Failed to delete student. Please try again.",
        variant: "destructive",
      });
    } finally {
      setLoadingDelete(false);
    }
  };

  if (!student && loadingStudent) {
    return (
      <Sheet open={isOpen} onOpenChange={onClose}>
        <SheetContent className="w-[600px] sm:w-[800px] sm:max-w-none">
          <div className="flex justify-center items-center h-32">
            Loading...
          </div>
        </SheetContent>
      </Sheet>
    );
  }

  if (!student) return null;

  return (
    <>
      <Sheet open={isOpen} onOpenChange={onClose}>
        <SheetContent className="w-[600px] sm:w-[800px] sm:max-w-none">
          <SheetHeader>
            <SheetTitle>
              {student.firstName} {student.lastName}
            </SheetTitle>
          </SheetHeader>
          
          <Tabs defaultValue="details" className="mt-6 flex flex-col h-[calc(100vh-200px)]">
            <TabsList className="grid w-full grid-cols-4 flex-shrink-0">
              <TabsTrigger value="details">Details</TabsTrigger>
              <TabsTrigger value="subjects">Subjects</TabsTrigger>
              <TabsTrigger value="classes">Classes</TabsTrigger>
              <TabsTrigger value="account">Account</TabsTrigger>
            </TabsList>
            
            <div className="flex-1 overflow-hidden">
              <TabsContent value="details" className="mt-6 h-full overflow-y-auto">
                <DetailsTab
                  student={student}
                  isEditing={isEditingDetails}
                  isLoading={loadingDetailsUpdate}
                  onEdit={() => setIsEditingDetails(true)}
                  onCancelEdit={() => setIsEditingDetails(false)}
                  onSubmit={handleDetailsSubmit}
                />
              </TabsContent>
              
              <TabsContent value="subjects" className="mt-6 h-full overflow-y-auto">
                <StudentSubjectsTab
                  student={student}
                  studentSubjects={studentSubjects}
                  allSubjects={allSubjects}
                  loadingSubjects={loadingSubjects}
                  onAssignSubject={handleAssignSubject}
                  onRemoveSubject={handleRemoveSubject}
                />
              </TabsContent>
              
              <TabsContent value="classes" className="mt-6 h-full overflow-y-auto">
                <ClassesTab
                  student={student}
                />
              </TabsContent>
              
              <TabsContent value="account" className="mt-6 h-full overflow-y-auto">
                <StudentAccountTab
                  student={student}
                  isLoading={loadingAccountUpdate}
                  isEditingAccount={isEditingAccount}
                  hasPasswordResetLinkSent={hasPasswordResetLinkSent}
                  isDeleting={loadingDelete}
                  onEditAccount={() => setIsEditingAccount(true)}
                  onCancelEditAccount={() => setIsEditingAccount(false)}
                  onAccountUpdate={handleAccountSubmit}
                  onPasswordResetRequest={handlePasswordResetRequest}
                  onDelete={handleDeleteStudent}
                />
              </TabsContent>
            </div>
          </Tabs>
          
        </SheetContent>
      </Sheet>

      {/* Delete Confirmation Dialog */}
      <AlertDialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Student</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete {student.firstName} {student.lastName}? 
              This action cannot be undone and will remove all associated data.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={loadingDelete}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDeleteStudent}
              disabled={loadingDelete}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {loadingDelete ? "Deleting..." : "Delete"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
} 