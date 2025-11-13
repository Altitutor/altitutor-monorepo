'use client';

import { useState, useEffect } from 'react';
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription } from "@altitutor/ui";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@altitutor/ui";
import { useToast } from "@altitutor/ui";
import { studentsApi } from '../api';
import { useStudentDetails, useUpdateStudent, studentsKeys } from '../hooks/useStudentsQuery';
import { useSubjects } from '@/features/subjects';
import { useQueryClient } from '@tanstack/react-query';
import type { Tables, Database } from '@altitutor/shared';
import type { SupabaseClient } from '@supabase/supabase-js';
import { 
  DetailsTab,
  ClassesTab,
  StudentAccountTab,
  DetailsFormData
} from './tabs';
import { StudentSessionsTab } from './StudentSessionsTab';
import { StudentBillingTab } from './StudentBillingTab';
import { ViewSubjectModal, SubjectSearchPopover } from '@/features/subjects/components';
import { MessagesTabContent } from '@/features/messages/components/MessagesTabContent';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@altitutor/ui";
import { mapDetailsFormToStudentUpdate } from '@/features/students/mappers/studentMappers';
import { ViewParentModal } from './ViewParentModal';
import { getSupabaseClient } from '@/shared/lib/supabase/client';
import { getExistingConversationForRelated } from '@/features/messages/api/queries';

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
  const queryClient = useQueryClient();
  
  // Use React Query hooks for data fetching
  const { data: studentDetails, isLoading: loadingStudent } = useStudentDetails(studentId || '', isOpen && !!studentId);
  const { data: allSubjects = [] } = useSubjects();
  const updateStudentMutation = useUpdateStudent();
  
  // Extract data from studentDetails
  const student = studentDetails?.student || null;
  const studentSubjects = studentDetails?.subjects || [];
  const parents = studentDetails?.parents || [];
  const upcomingSessions = studentDetails?.upcomingSessions || [];
  const billingStatus = studentDetails?.billingStatus;
  
  const [conversationId, setConversationId] = useState<string | null>(null);
  
  // Edit states for each tab
  const [isEditingDetails, setIsEditingDetails] = useState(false);
  
  // Loading states for each tab
  const [loadingDetailsUpdate, setLoadingDetailsUpdate] = useState(false);
  const [loadingAccountUpdate, setLoadingAccountUpdate] = useState(false);

  // Delete confirmation state
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [loadingDelete, setLoadingDelete] = useState(false);

  // Password reset state
  const [hasPasswordResetLinkSent, setHasPasswordResetLinkSent] = useState(false);
  
  // Parent modal state
  const [selectedParentId, setSelectedParentId] = useState<string | null>(null);
  const [parentModalOpen, setParentModalOpen] = useState(false);
  const [parentModalDefaultTab, setParentModalDefaultTab] = useState<string>('students');
  
  // Subject modal state
  const [selectedSubjectId, setSelectedSubjectId] = useState<string | null>(null);
  const [subjectModalOpen, setSubjectModalOpen] = useState(false);

  // Temporary subjects state for editing (not saved until form submit)
  const [tempStudentSubjects, setTempStudentSubjects] = useState<Tables<'subjects'>[]>([]);
  const [subjectsToAdd, setSubjectsToAdd] = useState<string[]>([]);
  const [subjectsToRemove, setSubjectsToRemove] = useState<string[]>([]);

  // Get existing conversation ID for messages tab when modal opens
  useEffect(() => {
    if (isOpen && studentId) {
      getExistingConversationForRelated(studentId, 'student').then((convId) => {
      if (process.env.NODE_ENV !== 'production') {
        // eslint-disable-next-line no-console
        console.log('[ViewStudentModal] Existing conversation ID for student', studentId, ':', convId);
      }
      setConversationId(convId);
      });
    } else if (!isOpen) {
      setConversationId(null);
    }
  }, [isOpen, studentId]);

  // Reset edit states when modal closes
  useEffect(() => {
    if (!isOpen) {
      setIsEditingDetails(false);
    }
  }, [isOpen]);

  // Handle starting edit mode
  const handleStartEditDetails = () => {
    setTempStudentSubjects([...studentSubjects]);
    setSubjectsToAdd([]);
    setSubjectsToRemove([]);
    setIsEditingDetails(true);
  };

  // Handle canceling edit mode
  const handleCancelEditDetails = () => {
    setTempStudentSubjects([]);
    setSubjectsToAdd([]);
    setSubjectsToRemove([]);
    setIsEditingDetails(false);
  };

  // Handle details update (merged student, parent, and availability)
  const handleDetailsSubmit = async (data: DetailsFormData) => {
    if (!student) return;
    
    try {
      setLoadingDetailsUpdate(true);
      const payload = mapDetailsFormToStudentUpdate(data);
      await updateStudentMutation.mutateAsync({ id: student.id, data: payload });
      
      // Apply subject changes
      for (const subjectId of subjectsToAdd) {
        await studentsApi.assignSubjectToStudent(student.id, subjectId);
      }
      for (const subjectId of subjectsToRemove) {
        await studentsApi.removeSubjectFromStudent(student.id, subjectId);
      }
      
      // Clear temporary subject changes
      setSubjectsToAdd([]);
      setSubjectsToRemove([]);
      
      // Invalidate student details query to refetch with updated subjects
      queryClient.invalidateQueries({ queryKey: studentsKeys.detailFull(student.id) });
      
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

  // Handle password reset request
  const handlePasswordResetRequest = async () => {
    if (!student || !student.email) {
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
      // await authApi.requestPasswordReset(student.email);
      
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

  // Handle subject assignment (in edit mode - temporary)
  const handleAssignSubject = (subject: Tables<'subjects'>) => {
    if (!subject) return;
    
    // Add to temporary subjects list
    setTempStudentSubjects(prev => [...prev, subject]);
    
    // Track as added (unless it was previously marked for removal)
    if (subjectsToRemove.includes(subject.id)) {
      setSubjectsToRemove(prev => prev.filter(id => id !== subject.id));
    } else {
      setSubjectsToAdd(prev => [...prev, subject.id]);
    }
  };

  // Handle subject removal (in edit mode - temporary)
  const handleRemoveSubject = (subjectId: string) => {
    // Remove from temporary subjects list
    setTempStudentSubjects(prev => prev.filter(s => s.id !== subjectId));
    
    // Track as removed (unless it was previously marked for addition)
    if (subjectsToAdd.includes(subjectId)) {
      setSubjectsToAdd(prev => prev.filter(id => id !== subjectId));
    } else {
      setSubjectsToRemove(prev => [...prev, subjectId]);
    }
  };
  
  // Handle viewing subject details
  const handleViewSubject = (subjectId: string) => {
    setSelectedSubjectId(subjectId);
    setSubjectModalOpen(true);
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

  // Always render the Sheet to allow exit animation
  return (
    <>
      <Sheet open={isOpen} onOpenChange={onClose}>
        <SheetContent className="w-[600px] sm:w-[800px] sm:max-w-none h-full flex flex-col p-0">
          {!student ? (
            <div className="flex justify-center items-center h-full">
              <div className="text-muted-foreground">
                {loadingStudent ? 'Loading...' : ''}
              </div>
            </div>
          ) : (
            <>
              <SheetHeader className="flex-shrink-0 px-6 pt-6 pb-4">
                <SheetTitle>
                  Student Details
                </SheetTitle>
                <SheetDescription className="text-lg font-medium">
                  {student.first_name} {student.last_name}
                </SheetDescription>
              </SheetHeader>
          
          <div className="flex-1 overflow-hidden flex flex-col px-6 pb-6">
            <Tabs defaultValue="details" className="flex flex-col h-full min-h-0">
            <TabsList className="grid w-full grid-cols-6 flex-shrink-0">
                <TabsTrigger value="details">Details</TabsTrigger>
                <TabsTrigger value="classes">Classes</TabsTrigger>
                <TabsTrigger value="account">Account</TabsTrigger>
                <TabsTrigger value="messages">Messages</TabsTrigger>
              <TabsTrigger value="sessions">Sessions</TabsTrigger>
              <TabsTrigger value="billing">Billing</TabsTrigger>
              </TabsList>
            
            <div className="flex-1 min-h-0 overflow-hidden mt-4">
              <TabsContent value="details" className="h-full overflow-hidden m-0 data-[state=active]:flex data-[state=active]:flex-col">
                <DetailsTab
                  student={student}
                  isEditing={isEditingDetails}
                  isLoading={loadingDetailsUpdate}
                  onEdit={handleStartEditDetails}
                  onCancelEdit={handleCancelEditDetails}
                  onSubmit={handleDetailsSubmit}
                  studentSubjects={isEditingDetails ? tempStudentSubjects : studentSubjects}
                  loadingSubjects={false}
                  onRemoveSubject={handleRemoveSubject}
                  onViewSubject={handleViewSubject}
                  addSubjectButton={
                    <SubjectSearchPopover
                      allSubjects={allSubjects}
                      selectedSubjects={isEditingDetails ? tempStudentSubjects : studentSubjects}
                      onSelectSubject={handleAssignSubject}
                    />
                  }
                  parents={!isEditingDetails ? parents : []}
                  onViewParent={(parentId) => {
                    setSelectedParentId(parentId);
                    setParentModalDefaultTab('messages');
                    setParentModalOpen(true);
                  }}
                />
              </TabsContent>
              
              <TabsContent value="classes" className="h-full overflow-y-auto m-0 data-[state=active]:flex data-[state=active]:flex-col">
                <ClassesTab
                  student={student}
                  onStudentUpdated={onStudentUpdated}
                />
              </TabsContent>
              
              <TabsContent value="account" className="h-full overflow-y-auto m-0 data-[state=active]:flex data-[state=active]:flex-col">
                <StudentAccountTab
                  student={student}
                  isLoading={loadingAccountUpdate}
                  hasPasswordResetLinkSent={hasPasswordResetLinkSent}
                  isDeleting={loadingDelete}
                  onPasswordResetRequest={handlePasswordResetRequest}
                  onDelete={handleDeleteStudent}
                />
              </TabsContent>

              <TabsContent value="messages" className="h-full min-h-0 overflow-hidden m-0 data-[state=active]:flex data-[state=active]:flex-col">
                <MessagesTabContent 
                  conversationId={conversationId}
                  title={`${student.first_name} ${student.last_name}`}
                  onClose={onClose}
                  relatedId={studentId || undefined}
                  relatedType="student"
                />
              </TabsContent>

              <TabsContent value="sessions" className="h-full overflow-hidden m-0 data-[state=active]:flex data-[state=active]:flex-col">
                <StudentSessionsTab student={student} />
              </TabsContent>

              <TabsContent value="billing" className="h-full overflow-hidden m-0 data-[state=active]:flex data-[state=active]:flex-col">
                <StudentBillingTab student={student} />
              </TabsContent>
            </div>
          </Tabs>
          </div>
            </>
          )}
        </SheetContent>
      </Sheet>

      {/* Parent Modal */}
      <ViewParentModal
        isOpen={parentModalOpen}
        onClose={() => {
          setParentModalOpen(false);
          setSelectedParentId(null);
          setParentModalDefaultTab('students');
        }}
        parentId={selectedParentId}
        onParentUpdated={onStudentUpdated}
        defaultTab={parentModalDefaultTab}
      />
      
      {/* Subject Modal */}
      {selectedSubjectId && (
        <ViewSubjectModal
          isOpen={subjectModalOpen}
          onClose={() => {
            setSubjectModalOpen(false);
            setSelectedSubjectId(null);
          }}
          subjectId={selectedSubjectId}
          onSubjectUpdated={onStudentUpdated}
        />
      )}
      
      {/* Delete Confirmation Dialog */}
      <AlertDialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Student</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete {student?.first_name} {student?.last_name}? 
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