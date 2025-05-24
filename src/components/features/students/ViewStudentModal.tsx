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
  StudentDetailsTab, 
  ParentDetailsTab, 
  StudentSubjectsTab, 
  AvailabilityTab,
  StudentAccountTab,
  StudentDetailsFormData,
  ParentDetailsFormData,
  AvailabilityFormData,
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

import { useRouter } from "next/navigation";

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
  const [isEditingStudentDetails, setIsEditingStudentDetails] = useState(false);
  const [isEditingParentDetails, setIsEditingParentDetails] = useState(false);
  const [isEditingAvailability, setIsEditingAvailability] = useState(false);
  const [isEditingAccount, setIsEditingAccount] = useState(false);
  
  // Loading states for each tab
  const [loadingStudentDetailsUpdate, setLoadingStudentDetailsUpdate] = useState(false);
  const [loadingParentDetailsUpdate, setLoadingParentDetailsUpdate] = useState(false);
  const [loadingAvailabilityUpdate, setLoadingAvailabilityUpdate] = useState(false);
  const [loadingAccountUpdate, setLoadingAccountUpdate] = useState(false);

  // Delete confirmation state
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [loadingDelete, setLoadingDelete] = useState(false);

  // Password reset state
  const [hasPasswordResetLinkSent, setHasPasswordResetLinkSent] = useState(false);

  const router = useRouter();

  // Load student data
  const loadStudent = async () => {
    if (!studentId) return;
    
    try {
      setLoadingStudent(true);
                    const data = await studentsApi.getStudent(studentId);
       setStudent(data || null);
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
      const [studentSubjectsData, allSubjectsData] = await Promise.all([
        studentsApi.getStudentSubjects(studentId),
        subjectsApi.getAllSubjects()
      ]);
      setStudentSubjects(studentSubjectsData);
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
      loadStudent();
      loadSubjects();
    }
  }, [isOpen, studentId]);

  // Reset edit states when modal closes
  useEffect(() => {
    if (!isOpen) {
      setIsEditingStudentDetails(false);
      setIsEditingParentDetails(false);
      setIsEditingAvailability(false);
      setIsEditingAccount(false);
    }
  }, [isOpen]);

  // Handle student details update
  const handleStudentDetailsSubmit = async (data: StudentDetailsFormData) => {
    if (!student) return;
    
    try {
      setLoadingStudentDetailsUpdate(true);
      const updatedStudent = await studentsApi.updateStudent(student.id, {
        firstName: data.firstName,
        lastName: data.lastName,
        studentEmail: data.studentEmail || null,
        studentPhone: data.studentPhone || null,
        school: data.school || null,
        curriculum: data.curriculum || null,
        yearLevel: data.yearLevel,
        status: data.status,
        notes: data.notes || null,
      });
      
      setStudent(updatedStudent);
      setIsEditingStudentDetails(false);
      onStudentUpdated();
      
      toast({
        title: "Success",
        description: "Student details updated successfully.",
      });
    } catch (error) {
      console.error('Failed to update student details:', error);
      toast({
        title: "Error",
        description: "Failed to update student details. Please try again.",
        variant: "destructive",
      });
    } finally {
      setLoadingStudentDetailsUpdate(false);
    }
  };

  // Handle parent details update
  const handleParentDetailsSubmit = async (data: ParentDetailsFormData) => {
    if (!student) return;
    
    try {
      setLoadingParentDetailsUpdate(true);
      const updatedStudent = await studentsApi.updateStudent(student.id, {
        parentFirstName: data.parentFirstName || null,
        parentLastName: data.parentLastName || null,
        parentEmail: data.parentEmail || null,
        parentPhone: data.parentPhone || null,
      });
      
      setStudent(updatedStudent);
      setIsEditingParentDetails(false);
      onStudentUpdated();
      
      toast({
        title: "Success",
        description: "Parent details updated successfully.",
      });
    } catch (error) {
      console.error('Failed to update parent details:', error);
      toast({
        title: "Error",
        description: "Failed to update parent details. Please try again.",
        variant: "destructive",
      });
    } finally {
      setLoadingParentDetailsUpdate(false);
    }
  };

  // Handle availability update
  const handleAvailabilitySubmit = async (data: AvailabilityFormData) => {
    if (!student) return;
    
    try {
      setLoadingAvailabilityUpdate(true);
      const updatedStudent = await studentsApi.updateStudent(student.id, {
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
      setIsEditingAvailability(false);
      onStudentUpdated();
      
      toast({
        title: "Success",
        description: "Availability updated successfully.",
      });
    } catch (error) {
      console.error('Failed to update availability:', error);
      toast({
        title: "Error",
        description: "Failed to update availability. Please try again.",
        variant: "destructive",
      });
    } finally {
      setLoadingAvailabilityUpdate(false);
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
      await loadSubjects(); // Reload subjects
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
      await loadSubjects(); // Reload subjects
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
          
          <Tabs defaultValue="student-details" className="mt-6">
            <TabsList className="grid w-full grid-cols-5">
              <TabsTrigger value="student-details">Student Details</TabsTrigger>
              <TabsTrigger value="parent-details">Parent Details</TabsTrigger>
              <TabsTrigger value="subjects">Subjects</TabsTrigger>
              <TabsTrigger value="availability">Availability</TabsTrigger>
              <TabsTrigger value="account">Account</TabsTrigger>
            </TabsList>
            
            <TabsContent value="student-details" className="mt-6">
              <StudentDetailsTab
                student={student}
                isEditing={isEditingStudentDetails}
                isLoading={loadingStudentDetailsUpdate}
                onEdit={() => setIsEditingStudentDetails(true)}
                onCancelEdit={() => setIsEditingStudentDetails(false)}
                onSubmit={handleStudentDetailsSubmit}
              />
            </TabsContent>
            
            <TabsContent value="parent-details" className="mt-6">
              <ParentDetailsTab
                student={student}
                isEditing={isEditingParentDetails}
                isLoading={loadingParentDetailsUpdate}
                onEdit={() => setIsEditingParentDetails(true)}
                onCancelEdit={() => setIsEditingParentDetails(false)}
                onSubmit={handleParentDetailsSubmit}
              />
            </TabsContent>
            
            <TabsContent value="subjects" className="mt-6">
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
            
            <TabsContent value="availability" className="mt-6">
              <AvailabilityTab
                student={student}
                isEditing={isEditingAvailability}
                isLoading={loadingAvailabilityUpdate}
                onEdit={() => setIsEditingAvailability(true)}
                onCancelEdit={() => setIsEditingAvailability(false)}
                onSubmit={handleAvailabilitySubmit}
              />
            </TabsContent>
            
            <TabsContent value="account" className="mt-6">
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