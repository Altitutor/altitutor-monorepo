'use client';

import { useState, useEffect } from 'react';
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription } from "@altitutor/ui";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@altitutor/ui";
import { useToast } from "@altitutor/ui";
import { Button } from "@altitutor/ui";
import { Loader2, X } from "lucide-react";
import { useRouter } from "next/navigation";
import { ActionsMenu } from '@/shared/components/ActionsMenu';
import { studentsApi } from '../api';
import { useStudentDetails, useUpdateStudent, studentsKeys } from '../hooks/useStudentsQuery';
import { useSubjects } from '@/features/subjects';
import { useQueryClient } from '@tanstack/react-query';
import { useCurrentStaff } from '@/features/staff/hooks/useStaffQuery';
import type { Tables } from '@altitutor/shared';
import { LogAbsenceDialog } from '@/features/sessions/components/LogAbsenceDialog';
import { BookSessionModal } from '@/features/bookings/components/BookSessionModal';
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
import { SendStudentInviteDialog } from './SendStudentInviteDialog';
import { 
  DetailsTab,
  ClassesTab,
  DetailsFormData
} from './tabs';
import { StudentSessionsTab } from './StudentSessionsTab';
import { StudentBillingTab } from './StudentBillingTab';
import { ViewSubjectModal, SubjectSearchPopover } from '@/features/subjects/components';
import { MessagesTabContent } from '@/features/messages/components/MessagesTabContent';
import { mapDetailsFormToStudentUpdate } from '@/features/students/mappers/studentMappers';
import { ViewParentModal } from './ViewParentModal';
import { getExistingConversationForRelated } from '@/features/messages/api/queries';
import { ParentSearchPopover } from './ParentSearchPopover';
import { Separator } from '@altitutor/ui';
import { Badge } from '@altitutor/ui';
import { StudentActivityTab } from '@/features/activity/components/tabs/StudentActivityTab';

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
  const router = useRouter();
  const { data: currentStaff } = useCurrentStaff();
  
  // Use React Query hooks for data fetching
  const { data: studentDetails, isLoading: loadingStudent } = useStudentDetails(studentId || '', isOpen && !!studentId);
  const { data: allSubjects = [] } = useSubjects();
  const updateStudentMutation = useUpdateStudent();
  
  // Extract data from studentDetails
  const student = studentDetails?.student || null;
  const studentSubjects = studentDetails?.subjects || [];
  const parents = studentDetails?.parents || [];
  const _upcomingSessions = studentDetails?.upcomingSessions || [];
  const _billingStatus = studentDetails?.billingStatus;
  
  const [conversationId, setConversationId] = useState<string | null>(null);
  
  // Edit states for each tab
  const [isEditingDetails, setIsEditingDetails] = useState(false);
  const [activeTab, setActiveTab] = useState('details');
  
  // Loading states for each tab
  const [loadingDetailsUpdate, setLoadingDetailsUpdate] = useState(false);
  const [loadingAccountUpdate, setLoadingAccountUpdate] = useState(false);

  // Delete state
  const [loadingDelete, setLoadingDelete] = useState(false);

  // Password reset state
  const [hasPasswordResetLinkSent, setHasPasswordResetLinkSent] = useState(false);
  const [inviteDialogOpen, setInviteDialogOpen] = useState(false);
  const [inviteDialogType, setInviteDialogType] = useState<'invite' | 'registration'>('invite');
  
  // Parent modal state
  const [selectedParentId, setSelectedParentId] = useState<string | null>(null);
  const [parentModalOpen, setParentModalOpen] = useState(false);
  const [parentModalDefaultTab, setParentModalDefaultTab] = useState<string>('students');
  
  // Subject modal state
  const [selectedSubjectId, setSelectedSubjectId] = useState<string | null>(null);
  const [subjectModalOpen, setSubjectModalOpen] = useState(false);

  // Absence and booking modals
  const [isLogAbsenceDialogOpen, setIsLogAbsenceDialogOpen] = useState(false);
  const [isBookDraftingSessionModalOpen, setIsBookDraftingSessionModalOpen] = useState(false);
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);

  // Temporary subjects state for editing (not saved until form submit)
  const [tempStudentSubjects, setTempStudentSubjects] = useState<Tables<'subjects'>[]>([]);
  const [subjectsToAdd, setSubjectsToAdd] = useState<string[]>([]);
  const [subjectsToRemove, setSubjectsToRemove] = useState<string[]>([]);

  // Temporary parents state for editing (not saved until form submit)
  const [tempStudentParents, setTempStudentParents] = useState<Tables<'parents'>[]>([]);
  const [parentsToAdd, setParentsToAdd] = useState<string[]>([]);
  const [parentsToRemove, setParentsToRemove] = useState<string[]>([]);

  // Get all parents for the search popover
  const [allParents, setAllParents] = useState<Tables<'parents'>[]>([]);
  useEffect(() => {
    if (isOpen && isEditingDetails) {
      studentsApi.getAllParents().then(setAllParents).catch(console.error);
    }
  }, [isOpen, isEditingDetails]);

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
      setActiveTab('details');
    }
  }, [isOpen]);

  // Handle starting edit mode
  const handleStartEditDetails = () => {
    setTempStudentSubjects([...studentSubjects]);
    setSubjectsToAdd([]);
    setSubjectsToRemove([]);
    setTempStudentParents([...parents]);
    setParentsToAdd([]);
    setParentsToRemove([]);
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
      
      // Apply parent changes
      for (const parentId of parentsToAdd) {
        await studentsApi.assignParentToStudent(student.id, parentId);
      }
      for (const parentId of parentsToRemove) {
        await studentsApi.removeParentFromStudent(student.id, parentId);
      }
      
      // Clear temporary changes
      setSubjectsToAdd([]);
      setSubjectsToRemove([]);
      setParentsToAdd([]);
      setParentsToRemove([]);
      
      // Invalidate student details query to refetch with updated subjects and parents
      queryClient.invalidateQueries({ queryKey: studentsKeys.detailFull(student.id) });
      
      setIsEditingDetails(false);
      onStudentUpdated();
      
      toast({
        title: "Success",
        description: "Details updated successfully.",
      });
    } catch (error) {
      console.error('Failed to update details:', error);
      const errorMessage = error instanceof Error 
        ? error.message 
        : "Failed to update details. Please try again.";
      toast({
        title: "Error",
        description: errorMessage,
        variant: "destructive",
      });
    } finally {
      setLoadingDetailsUpdate(false);
    }
  };

  // Handle password reset/registration request
  const handlePasswordResetOrRegistration = () => {
    if (!student) return;
    
    const isRegistered = student.status === 'ACTIVE';
    const hasAccount = !!student.user_id;
    
    if (isRegistered && !hasAccount) {
      // Case 1: Registered but no account -> Send Invite
      setInviteDialogType('invite');
      setInviteDialogOpen(true);
    } else if ((hasAccount && !isRegistered) || (!hasAccount && !isRegistered)) {
      // Case 2 & 3: Has account but not registered OR no account and not registered -> Send Registration Link
      setInviteDialogType('registration');
      setInviteDialogOpen(true);
    } else {
      // Case 4: Registered AND has account -> Password Reset
      handlePasswordResetRequest();
    }
  };

  // Get password reset label
  const getPasswordResetLabel = () => {
    if (!student) return 'Send password reset';
    
    const isRegistered = student.status === 'ACTIVE';
    const hasAccount = !!student.user_id;
    
    if (isRegistered && !hasAccount) {
      return 'Send invite';
    } else if ((hasAccount && !isRegistered) || (!hasAccount && !isRegistered)) {
      return 'Send registration link';
    } else {
      return 'Send password reset';
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
      const errorMessage = error instanceof Error 
        ? error.message 
        : "Failed to send password reset link. Please try again.";
      toast({
        title: "Error",
        description: errorMessage,
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
  
  // Handle parent assignment (in edit mode - temporary)
  const handleAssignParent = (parent: Tables<'parents'>) => {
    if (!parent) return;
    
    // Add to temporary parents list
    setTempStudentParents(prev => [...prev, parent]);
    
    // Track as added (unless it was previously marked for removal)
    if (parentsToRemove.includes(parent.id)) {
      setParentsToRemove(prev => prev.filter(id => id !== parent.id));
    } else {
      setParentsToAdd(prev => [...prev, parent.id]);
    }
  };

  // Handle parent removal (in edit mode - temporary)
  const handleRemoveParent = (parentId: string) => {
    // Remove from temporary parents list
    setTempStudentParents(prev => prev.filter(p => p.id !== parentId));
    
    // Track as removed (unless it was previously marked for addition)
    if (parentsToAdd.includes(parentId)) {
      setParentsToAdd(prev => prev.filter(id => id !== parentId));
    } else {
      setParentsToRemove(prev => [...prev, parentId]);
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
      setIsDeleteDialogOpen(false);
      onClose();
      onStudentUpdated();
      
      toast({
        title: "Success",
        description: "Student deleted successfully.",
      });
    } catch (error) {
      console.error('Failed to delete student:', error);
      const errorMessage = error instanceof Error 
        ? error.message 
        : "Failed to delete student. Please try again.";
      toast({
        title: "Error",
        description: errorMessage,
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
        <SheetContent hideCloseButton className="w-full md:w-[600px] lg:w-[800px] md:max-w-none h-full max-h-[100vh] flex flex-col p-0">
          {!student ? (
            <div className="flex justify-center items-center h-full p-6">
              <div className="text-muted-foreground">
                {loadingStudent ? 'Loading...' : ''}
              </div>
            </div>
          ) : (
            <Tabs defaultValue="details" value={activeTab} onValueChange={setActiveTab} className="flex flex-col h-full min-h-0">
              {/* Sticky Header */}
              <div className="flex-shrink-0 border-b bg-background sticky top-0 z-10">
                <SheetHeader className="px-6 pt-6 pb-4">
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex items-center gap-3 flex-1">
                      <Button
                        variant="outline"
                        size="icon"
                        onClick={onClose}
                        className="shrink-0"
                      >
                        <X className="h-4 w-4" />
                      </Button>
                      <div className="flex-1">
                        <SheetTitle>
                          {isEditingDetails ? 'Edit Student' : 'Student Details'}
                        </SheetTitle>
                        <SheetDescription className="text-lg font-medium">
                          <div className="flex items-center gap-2">
                            {student.first_name} {student.last_name}
                            <Badge 
                              variant={
                                student.status === 'ACTIVE' ? 'success' :
                                student.status === 'TRIAL' ? 'secondary' :
                                student.status === 'DISCONTINUED' ? 'destructive' :
                                'outline'
                              }
                              className="text-xs"
                            >
                              {student.status}
                            </Badge>
                          </div>
                        </SheetDescription>
                      </div>
                    </div>
                    {studentId && (
                      <ActionsMenu
                        type="student"
                        onOpenInPage={() => {
                          router.push(`/students/${studentId}`);
                          onClose();
                        }}
                        onEditDetails={() => {
                          setActiveTab('details');
                          handleStartEditDetails();
                        }}
                        onPasswordResetOrRegistration={handlePasswordResetOrRegistration}
                        passwordResetLabel={getPasswordResetLabel()}
                        onLogAbsence={() => {
                          setIsLogAbsenceDialogOpen(true);
                        }}
                        onBookDraftingSession={() => {
                          setIsBookDraftingSessionModalOpen(true);
                        }}
                        onDelete={() => {
                          setIsDeleteDialogOpen(true);
                        }}
                      />
                    )}
                  </div>
                </SheetHeader>
                <div className="px-6 pb-4">
                  <TabsList className="grid w-full grid-cols-6">
                    <TabsTrigger value="details">Details</TabsTrigger>
                    <TabsTrigger value="classes">Classes</TabsTrigger>
                    <TabsTrigger value="messages">Messages</TabsTrigger>
                    <TabsTrigger value="sessions">Sessions</TabsTrigger>
                    <TabsTrigger value="billing">Billing</TabsTrigger>
                    <TabsTrigger value="activity">Activity</TabsTrigger>
                  </TabsList>
                </div>
              </div>

              {/* Scrollable Content */}
              <div className="flex-1 min-h-0 relative">
                <TabsContent value="details" className="absolute inset-0 overflow-y-auto m-0 hidden data-[state=active]:block">
                  <div className="p-6">
                    <DetailsTab
                      student={student}
                      isEditing={isEditingDetails}
                      isLoading={loadingDetailsUpdate}
                      onEdit={handleStartEditDetails}
                      onCancelEdit={handleCancelEditDetails}
                      onSubmit={handleDetailsSubmit}
                      onDelete={undefined}
                      isDeleting={loadingDelete}
                      studentSubjects={isEditingDetails ? tempStudentSubjects : studentSubjects}
                      loadingSubjects={false}
                      onRemoveSubject={handleRemoveSubject}
                      onViewSubject={handleViewSubject}
                      addSubjectButton={
                        <SubjectSearchPopover
                          selectedSubjects={isEditingDetails ? tempStudentSubjects : studentSubjects}
                          onSelectSubject={handleAssignSubject}
                        />
                      }
                      parents={isEditingDetails ? tempStudentParents : parents}
                      onViewParent={(parentId) => {
                        setSelectedParentId(parentId);
                        setParentModalDefaultTab('messages');
                        setParentModalOpen(true);
                      }}
                      onRemoveParent={isEditingDetails ? handleRemoveParent : undefined}
                      addParentButton={
                        isEditingDetails ? (
                          <ParentSearchPopover
                            allParents={allParents}
                            selectedParents={tempStudentParents}
                            onSelectParent={handleAssignParent}
                          />
                        ) : undefined
                      }
                      isLoadingAccount={loadingAccountUpdate}
                      hasPasswordResetLinkSent={hasPasswordResetLinkSent}
                      onPasswordResetRequest={handlePasswordResetRequest}
                    />
                  </div>
                </TabsContent>
              
                <TabsContent value="classes" className="absolute inset-0 overflow-y-auto m-0 hidden data-[state=active]:block">
                  <div className="p-6">
                    <ClassesTab
                      student={student}
                      onStudentUpdated={onStudentUpdated}
                    />
                  </div>
                </TabsContent>

                <TabsContent value="messages" className="absolute inset-0 overflow-hidden m-0 p-0 hidden data-[state=active]:flex data-[state=active]:flex-col">
                  <div className="h-full p-6">
                    <MessagesTabContent 
                      conversationId={conversationId}
                      title={`${student.first_name} ${student.last_name}`}
                      onClose={onClose}
                      relatedId={studentId || undefined}
                      relatedType="student"
                    />
                  </div>
                </TabsContent>

                <TabsContent value="sessions" className="absolute inset-0 overflow-hidden m-0 hidden data-[state=active]:flex data-[state=active]:flex-col">
                  <div className="h-full p-6">
                    <StudentSessionsTab student={student} />
                  </div>
                </TabsContent>

                <TabsContent value="billing" className="absolute inset-0 overflow-y-auto m-0 hidden data-[state=active]:block">
                  <div className="p-6">
                    <StudentBillingTab student={student} />
                  </div>
                </TabsContent>

                <TabsContent value="activity" className="absolute inset-0 overflow-y-auto m-0 hidden data-[state=active]:block">
                  <div className="p-6">
                    {studentId && (
                      <StudentActivityTab studentId={studentId} isOpen={isOpen} />
                    )}
                  </div>
                </TabsContent>
              </div>
            </Tabs>
          )}
          
          {/* Sticky Footer with Buttons */}
          {student && isEditingDetails && activeTab === 'details' && (
            <div className="sticky bottom-0 left-0 right-0 p-6 border-t bg-background mt-auto shrink-0">
              <div className="flex w-full justify-end">
                <div className="flex space-x-2">
                  <Button variant="outline" type="button" onClick={handleCancelEditDetails} disabled={loadingDetailsUpdate}>
                    Cancel
                  </Button>
                  <Button 
                    type="button"
                    disabled={loadingDetailsUpdate}
                    onClick={() => {
                      const form = document.getElementById('student-edit-form') as HTMLFormElement;
                      if (form) {
                        form.requestSubmit();
                      }
                    }}
                  >
                    {loadingDetailsUpdate && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                    Save Changes
                  </Button>
                </div>
              </div>
            </div>
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

      {/* Log Absence Dialog */}
      {currentStaff && studentId && (
        <LogAbsenceDialog
          isOpen={isLogAbsenceDialogOpen}
          onClose={() => setIsLogAbsenceDialogOpen(false)}
          staffId={currentStaff.id}
          initialStudentId={studentId}
          allowPastSessions={true}
        />
      )}

      {/* Book Drafting Session Modal */}
      {studentId && (
        <BookSessionModal
          isOpen={isBookDraftingSessionModalOpen}
          onClose={() => setIsBookDraftingSessionModalOpen(false)}
          sessionType="DRAFTING"
          initialStudentId={studentId}
          onBookingCreated={() => {
            setIsBookDraftingSessionModalOpen(false);
            onStudentUpdated();
          }}
        />
      )}

      {/* Send Invite Dialog */}
      {student && (
        <SendStudentInviteDialog
          isOpen={inviteDialogOpen}
          onClose={() => setInviteDialogOpen(false)}
          student={student}
          linkType={inviteDialogType}
        />
      )}

      {/* Delete Confirmation Dialog */}
      {student && (
        <AlertDialog open={isDeleteDialogOpen} onOpenChange={setIsDeleteDialogOpen}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Are you absolutely sure?</AlertDialogTitle>
              <AlertDialogDescription>
                This action cannot be undone. This will permanently delete the student
                "{student.first_name} {student.last_name}" and all associated data from the database.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Cancel</AlertDialogCancel>
              <AlertDialogAction
                onClick={handleDeleteStudent}
                disabled={loadingDelete}
                className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              >
                {loadingDelete ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Deleting...
                  </>
                ) : (
                  'Delete'
                )}
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      )}
      
    </>
  );
} 