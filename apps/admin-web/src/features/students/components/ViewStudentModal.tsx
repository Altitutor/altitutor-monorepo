'use client';

import { useState, useEffect } from 'react';
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription } from "@altitutor/ui";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@altitutor/ui";
import { Button } from "@altitutor/ui";
import { Loader2, X } from "lucide-react";
import { useRouter } from "next/navigation";
import { ActionsMenu } from '@/shared/components/ActionsMenu';
import { useStudentDetails } from '../hooks/useStudentsQuery';
import { useQueryClient } from '@tanstack/react-query';
import { useCurrentStaff } from '@/features/staff/hooks/useStaffQuery';
import { LogAbsenceDialog } from '@/features/sessions/components';
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
import { Input } from "@altitutor/ui";
import { Label } from "@altitutor/ui";
import { SendStudentInviteDialog } from './SendStudentInviteDialog';
import { 
  DetailsTab,
  ClassesTab,
  DetailsFormData
} from './tabs';
import { StudentSessionsTab } from './StudentSessionsTab';
import { StudentBillingTab } from './StudentBillingTab';
import { ViewSubjectModal } from '@/features/subjects/components';
import { MessagesTabContent } from '@/features/messages/components/MessagesTabContent';
import { ViewParentModal } from './ViewParentModal';
import { ParentSearchPopover } from './ParentSearchPopover';
import { Badge, useToast } from '@altitutor/ui';
import { AddParentModal } from '@/features/parents/components/AddParentModal';
import { StudentActivityTab } from '@/features/activity/components/tabs/StudentActivityTab';
import { SessionModal } from '@/features/sessions/components/SessionModal';
import { ViewStaffModal } from '@/features/staff/components/modal/ViewStaffModal';
import { EnrollStudentModal } from '@/features/enrollments/components/EnrollStudentModal';
import { studentsApi } from '../api/students';
import { classesApi } from '@/shared/api';
import type { Tables, ClassWithExpandedSubject } from "@altitutor/shared";
import { useStudentClasses } from '../hooks/useStudentClasses';
import {
  useStudentEditFlow,
  useStudentPasswordReset,
  useStudentMutations,
  useStudentModals,
  useStudentConversation,
  useAllParents,
  useStudentActions,
  studentsKeys,
} from '../hooks';
import { parentsKeys } from '@/features/parents/hooks/useParentsQuery';
import { useNestedModalEvents } from '@/shared/hooks/useNestedModalEvents';
import { DiscontinueStudentConfirmDialog } from './DiscontinueStudentConfirmDialog';

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
  const router = useRouter();
  const queryClient = useQueryClient();
  const { data: currentStaff } = useCurrentStaff();
  const { toast } = useToast();
  
  // Data fetching
  const { data: studentDetails, isLoading: loadingStudent } = useStudentDetails(studentId || '', isOpen && !!studentId);
  const student = studentDetails?.student || null;
  const studentSubjects = studentDetails?.subjects || [];
  const parents = studentDetails?.parents || [];

  // Business logic hooks
  const editFlow = useStudentEditFlow({
    initialSubjects: studentSubjects,
    initialParents: parents,
  });

  const passwordReset = useStudentPasswordReset({ student });

  const mutations = useStudentMutations({
    studentId: studentId || '',
    onSuccess: () => {
      if (studentId) {
        queryClient.invalidateQueries({ queryKey: studentsKeys.detailFull(studentId) });
      }
      editFlow.reset();
      onStudentUpdated();
    },
  });

  const modals = useStudentModals();

  const conversationId = useStudentConversation({
    studentId,
    enabled: isOpen && !!studentId,
  });

  const { data: allParentsData } = useAllParents({
    enabled: isOpen && editFlow.isEditing,
  });
  const allParents = allParentsData || [];

  // UI state
  const [activeTab, setActiveTab] = useState('details');
  const [loadingAccountUpdate, setLoadingAccountUpdate] = useState(false);
  const [deleteConfirmText, setDeleteConfirmText] = useState('');
  const [isDiscontinuing, setIsDiscontinuing] = useState(false);
  
  // Modal states for new actions
  const [isEnrollModalOpen, setIsEnrollModalOpen] = useState(false);
  const [isAddParentModalOpen, setIsAddParentModalOpen] = useState(false);
  const [isDiscontinueDialogOpen, setIsDiscontinueDialogOpen] = useState(false);

  // Get student classes for enroll modal
  const { data: studentClasses = [] } = useStudentClasses(studentId || '');
  
  // Nested modal state for sessions table interactions
  const {
    nestedSessionId,
    nestedStaffId,
    nestedStudentId,
    setNestedSessionId,
    setNestedStaffId,
    setNestedStudentId,
  } = useNestedModalEvents({ isOpen });

  // Reset edit states when modal closes
  useEffect(() => {
    if (!isOpen) {
      editFlow.cancelEdit();
      setActiveTab('details');
      modals.reset();
    }
  }, [isOpen]); // eslint-disable-line react-hooks/exhaustive-deps

  // Handle details submit
  const handleDetailsSubmit = async (data: DetailsFormData) => {
    if (!student || !studentId) return;
    
    await mutations.updateDetails(
      data,
      {
        toAdd: editFlow.subjectsToAdd,
        toRemove: editFlow.subjectsToRemove,
      },
      {
        toAdd: editFlow.parentsToAdd,
        toRemove: editFlow.parentsToRemove,
      }
    );
  };

  // Handle password reset request
  const handlePasswordResetRequest = async () => {
    if (!student || !student.email) {
      return;
    }

    try {
      setLoadingAccountUpdate(true);
      passwordReset.setPasswordResetLinkSent(true);
      // TODO: Implement password reset API call
      // await authApi.requestPasswordReset(student.email);
    } catch (error) {
      console.error('Failed to send password reset:', error);
    } finally {
      setLoadingAccountUpdate(false);
    }
  };

  // Handle student deletion
  const handleDeleteStudent = async () => {
    if (!student) return;
    
    try {
      await mutations.deleteStudent();
      modals.closeDeleteDialog();
      onClose();
    } catch (error) {
      // Error handling is done in the hook
    }
  };

  // Handle discontinue student. Returns true on success, false otherwise.
  const handleDiscontinue = async (): Promise<boolean> => {
    if (!student || !currentStaff) return false;

    try {
      setIsDiscontinuing(true);
      const result = await studentsApi.discontinueStudent(student.id, currentStaff.id);

      if (!result.success) {
        if (result.error === 'Unenroll student from classes first') {
          toast({
            title: 'Cannot Discontinue',
            description: 'Cannot discontinue student while still enrolled in classes. Please unenroll from all classes first.',
            variant: 'destructive',
          });
        } else if (result.error === 'Student has future sessions') {
          const sessionCount = result.sessions?.length || 0;
          toast({
            title: 'Cannot Discontinue',
            description: `Student has ${sessionCount} future session${sessionCount !== 1 ? 's' : ''}. Please cancel or reschedule them first.`,
            variant: 'destructive',
          });
        } else {
          toast({
            title: 'Cannot Discontinue',
            description: result.error || 'Failed to discontinue student',
            variant: 'destructive',
          });
        }
        return false;
      }

      await queryClient.invalidateQueries({ queryKey: studentsKeys.detail(student.id) });
      onStudentUpdated();
      toast({
        title: 'Success',
        description: 'Student discontinued successfully.',
      });
      return true;
    } catch (error) {
      console.error('Failed to discontinue student:', error);
      toast({
        title: 'Discontinue failed',
        description: error instanceof Error ? error.message : 'There was an error discontinuing the student. Please try again.',
        variant: 'destructive',
      });
      return false;
    } finally {
      setIsDiscontinuing(false);
    }
  };

  // Handle add class
  const handleAddClass = () => {
    setIsEnrollModalOpen(true);
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
      await queryClient.invalidateQueries({ queryKey: studentsKeys.detail(studentId || '') });
      await queryClient.invalidateQueries({ queryKey: ['students', studentId, 'classes'] });
      setIsEnrollModalOpen(false);
      onStudentUpdated();
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

  // Fetch classes for enrollment modal
  const fetchClassesForEnrollment = async (): Promise<ClassWithExpandedSubject[]> => {
    const { classes, classSubjects, classStaff, classStudents } = await classesApi.getAllClassesWithDetails();
    return classes.map(c => {
      return {
        ...c,
        subject: classSubjects[c.id],
        staff: classStaff[c.id] || [],
        students: classStudents[c.id] || []
      } as ClassWithExpandedSubject;
    });
  };

  // Centralized action handlers (must be after all handler functions are defined)
  const studentActions = useStudentActions({
    studentId: studentId || '',
    student,
    onOpenInPage: () => {
      router.push(`/students/${studentId}`);
      onClose();
    },
    onEditDetails: () => {
      setActiveTab('details');
      editFlow.startEdit();
    },
    onPasswordResetOrRegistration: passwordReset.openPasswordResetOrRegistration,
    passwordResetLabel: passwordReset.passwordResetLabel,
    onLogAbsence: modals.openLogAbsence,
    onBookDraftingSession: modals.openBookDraftingSession,
    onAddClass: handleAddClass,
    onDiscontinue: () => setIsDiscontinueDialogOpen(true),
    onDelete: modals.openDeleteDialog,
  });

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
                          {editFlow.isEditing ? 'Edit Student' : 'Student Details'}
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
                        {...studentActions}
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
                      isEditing={editFlow.isEditing}
                      isLoading={mutations.isUpdatingDetails}
                      onEdit={editFlow.startEdit}
                      onCancelEdit={editFlow.cancelEdit}
                      onSubmit={handleDetailsSubmit}
                      onDelete={undefined}
                      isDeleting={mutations.isDeleting}
                      studentSubjects={editFlow.isEditing ? editFlow.tempStudentSubjects : studentSubjects}
                      loadingSubjects={false}
                      onRemoveSubject={undefined}
                      onViewSubject={modals.openSubjectModal}
                      addSubjectButton={undefined}
                      parents={editFlow.isEditing ? editFlow.tempStudentParents : parents}
                      onViewParent={(parentId) => {
                        modals.openParentModal(parentId, 'messages');
                      }}
                      onRemoveParent={editFlow.isEditing ? editFlow.removeParent : undefined}
                      addParentButton={
                        editFlow.isEditing ? (
                          <ParentSearchPopover
                            allParents={allParents}
                            selectedParents={editFlow.tempStudentParents}
                            onSelectParent={editFlow.assignParent}
                            onCreateNewParent={() => setIsAddParentModalOpen(true)}
                          />
                        ) : undefined
                      }
                      isLoadingAccount={loadingAccountUpdate}
                      hasPasswordResetLinkSent={passwordReset.hasPasswordResetLinkSent}
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
                    <StudentSessionsTab 
                      student={student} 
                      onOpenSession={(sessionId) => {
                        window.dispatchEvent(new CustomEvent('open-session-modal', { detail: { id: sessionId } }));
                      }}
                    />
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
          {student && editFlow.isEditing && activeTab === 'details' && (
            <div className="sticky bottom-0 left-0 right-0 p-6 border-t bg-background mt-auto shrink-0">
              <div className="flex w-full justify-end">
                <div className="flex space-x-2">
                  <Button variant="outline" type="button" onClick={editFlow.cancelEdit} disabled={mutations.isUpdatingDetails}>
                    Cancel
                  </Button>
                  <Button 
                    type="button"
                    disabled={mutations.isUpdatingDetails}
                    onClick={() => {
                      const form = document.getElementById('student-edit-form') as HTMLFormElement;
                      if (form) {
                        form.requestSubmit();
                      }
                    }}
                  >
                    {mutations.isUpdatingDetails && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
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
        isOpen={modals.parentModalOpen}
        onClose={modals.closeParentModal}
        parentId={modals.selectedParentId}
        onParentUpdated={onStudentUpdated}
        defaultTab={modals.parentModalDefaultTab}
      />
      
      {/* Subject Modal */}
      {modals.selectedSubjectId && (
        <ViewSubjectModal
          isOpen={modals.subjectModalOpen}
          onClose={modals.closeSubjectModal}
          subjectId={modals.selectedSubjectId}
          onSubjectUpdated={onStudentUpdated}
        />
      )}

      {/* Log Absence Dialog */}
      {currentStaff && studentId && (
        <LogAbsenceDialog
          isOpen={modals.isLogAbsenceDialogOpen}
          onClose={modals.closeLogAbsence}
          staffId={currentStaff.id}
          initialStudentId={studentId}
          allowPastSessions={true}
        />
      )}

      {/* Book Drafting Session Modal */}
      {studentId && (
        <BookSessionModal
          isOpen={modals.isBookDraftingSessionModalOpen}
          onClose={modals.closeBookDraftingSession}
          sessionType="DRAFTING"
          initialStudentId={studentId}
          onBookingCreated={() => {
            modals.closeBookDraftingSession();
            onStudentUpdated();
          }}
        />
      )}

      {/* Send Invite Dialog */}
      {student && (
        <SendStudentInviteDialog
          isOpen={passwordReset.inviteDialogOpen}
          onClose={passwordReset.closeInviteDialog}
          student={student}
          linkType={passwordReset.inviteDialogType}
        />
      )}

      {/* Delete Confirmation Dialog */}
      {student && (
        <AlertDialog open={modals.isDeleteDialogOpen} onOpenChange={(open) => {
          if (open) {
            // Dialog is opening - no action needed, modals hook handles it
          } else {
            // Dialog is closing - reset confirmation text
            modals.closeDeleteDialog();
            setDeleteConfirmText('');
          }
        }}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Are you absolutely sure?</AlertDialogTitle>
              <AlertDialogDescription>
                This action cannot be undone. This will permanently delete the student
                "{student.first_name} {student.last_name}" and all associated data from the database.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <div className="py-4">
              <div className="space-y-2">
                <Label>
                  Type <strong>{student.first_name} {student.last_name}</strong> to confirm deletion
                </Label>
                <Input
                  type="text"
                  placeholder={`${student.first_name} ${student.last_name}`}
                  value={deleteConfirmText}
                  onChange={(e) => setDeleteConfirmText(e.target.value)}
                  className="mt-2"
                />
              </div>
            </div>
            <AlertDialogFooter>
              <AlertDialogCancel>Cancel</AlertDialogCancel>
              <AlertDialogAction
                onClick={async () => {
                  await handleDeleteStudent();
                  setDeleteConfirmText('');
                }}
                disabled={mutations.isDeleting || deleteConfirmText !== `${student.first_name} ${student.last_name}`}
                className="bg-destructive text-destructive-foreground hover:bg-destructive/90 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {mutations.isDeleting ? (
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

      {/* Discontinue Confirmation Dialog */}
      {student && (
        <DiscontinueStudentConfirmDialog
          isOpen={isDiscontinueDialogOpen}
          onOpenChange={setIsDiscontinueDialogOpen}
          studentName={`${student.first_name} ${student.last_name}`}
          onConfirm={handleDiscontinue}
          isDiscontinuing={isDiscontinuing}
        />
      )}

      {/* Nested Session Modal */}
      <SessionModal
        isOpen={!!nestedSessionId}
        sessionId={nestedSessionId}
        onClose={() => setNestedSessionId(null)}
      />

      {/* Nested Staff Modal */}
      {nestedStaffId && (
        <ViewStaffModal
          isOpen={!!nestedStaffId}
          staffId={nestedStaffId}
          onClose={() => setNestedStaffId(null)}
          onStaffUpdated={onStudentUpdated}
        />
      )}

      {/* Nested Student Modal */}
      {nestedStudentId && (
        <ViewStudentModal
          isOpen={!!nestedStudentId}
          studentId={nestedStudentId}
          onClose={() => setNestedStudentId(null)}
          onStudentUpdated={onStudentUpdated}
        />
      )}

      {/* Enroll Student Modal */}
      {student && currentStaff && (
        <EnrollStudentModal
          isOpen={isEnrollModalOpen}
          onClose={() => setIsEnrollModalOpen(false)}
          context="student"
          student={student}
          studentSubjects={studentSubjects}
          enrolledClassIds={studentClasses.map(c => c.class.id)}
          onFetchClasses={fetchClassesForEnrollment}
          onEnroll={handleEnroll}
          currentStaffId={currentStaff.id}
        />
      )}

      {/* Add Parent Modal */}
      <AddParentModal
        isOpen={isAddParentModalOpen}
        onClose={() => setIsAddParentModalOpen(false)}
        onParentAdded={async (newParent?: Tables<'parents'>) => {
          if (!newParent) return;
          
          // Invalidate queries to refresh parent list
          queryClient.invalidateQueries({ queryKey: ['students', 'all-parents'] });
          queryClient.invalidateQueries({ queryKey: parentsKeys.lists() });
          
          // Select the newly created parent
          editFlow.assignParent(newParent);
          setIsAddParentModalOpen(false);
        }}
      />
      
    </>
  );
}
