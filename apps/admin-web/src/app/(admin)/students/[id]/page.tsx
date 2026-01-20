'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@altitutor/ui";
import { Button } from "@altitutor/ui";
import { Loader2, ArrowLeft } from "lucide-react";
import { ActionsMenu } from '@/shared/components/ActionsMenu';
import { useCurrentStaff } from '@/features/staff/hooks/useStaffQuery';
import { LogAbsenceDialog } from '@/features/sessions/components/absences/LogAbsenceDialog';
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
import { SendStudentInviteDialog } from '@/features/students/components/SendStudentInviteDialog';
import { useStudentDetails, studentsKeys } from '@/features/students/hooks/useStudentsQuery';
import { useQueryClient } from '@tanstack/react-query';
import { 
  DetailsTab,
  ClassesTab,
  DetailsFormData
} from '@/features/students/components/tabs';
import { StudentSessionsTab } from '@/features/students/components/StudentSessionsTab';
import { StudentBillingTab } from '@/features/students/components/StudentBillingTab';
import { ViewSubjectModal } from '@/features/subjects/components';
import { MessagesTabContent } from '@/features/messages/components/MessagesTabContent';
import { ViewParentModal } from '@/features/students/components/ViewParentModal';
import { ParentSearchPopover } from '@/features/students/components/ParentSearchPopover';
import { StudentActivityTab } from '@/features/activity/components/tabs/StudentActivityTab';
import {
  useStudentEditFlow,
  useStudentPasswordReset,
  useStudentMutations,
  useStudentModals,
  useStudentConversation,
  useAllParents,
} from '@/features/students/hooks';

export default function StudentDetailPage({ params }: { params: { id: string } }) {
  const { id } = params;
  const router = useRouter();
  const queryClient = useQueryClient();
  const { data: currentStaff } = useCurrentStaff();
  
  // Data fetching
  const { data: studentDetails, isLoading: loadingStudent } = useStudentDetails(id, !!id);
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
    studentId: id,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: studentsKeys.detailFull(id) });
      editFlow.reset();
    },
  });

  const modals = useStudentModals();

  const conversationId = useStudentConversation({
    studentId: id,
    enabled: !!id,
  });

  const { data: allParentsData } = useAllParents({
    enabled: editFlow.isEditing,
  });
  const allParents = allParentsData || [];

  // UI state
  const [activeTab, setActiveTab] = useState('details');
  const [loadingAccountUpdate, setLoadingAccountUpdate] = useState(false);

  // Handle details submit
  const handleDetailsSubmit = async (data: DetailsFormData) => {
    if (!student) return;
    
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
      router.push('/students');
    } catch (error) {
      // Error handling is done in the hook
    }
  };

  const handleStudentUpdated = () => {
    queryClient.invalidateQueries({ queryKey: studentsKeys.detailFull(id) });
  };

  if (loadingStudent) {
    return (
      <div className="p-6">
        <div className="flex items-center justify-center h-64">
          <Loader2 className="h-8 w-8 animate-spin" />
        </div>
      </div>
    );
  }

  if (!student) {
    return (
      <div className="p-6">
        <div className="flex items-center gap-4 mb-6">
          <Button
            variant="ghost"
            size="icon"
            onClick={() => router.push('/students')}
            className="border"
          >
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <h1 className="text-3xl font-bold tracking-tight">Student Not Found</h1>
        </div>
      </div>
    );
  }

  return (
    <div className="p-6">
      {/* Header */}
      <div className="flex items-center gap-4 mb-6">
        <Button
          variant="ghost"
          size="icon"
          onClick={() => router.push('/students')}
          className="border"
        >
          <ArrowLeft className="h-4 w-4" />
        </Button>
        <div className="flex-1">
          <h1 className="text-3xl font-bold tracking-tight">
            {editFlow.isEditing ? 'Edit Student' : 'Student Details'}
          </h1>
          <p className="text-lg text-muted-foreground mt-1">
            {student.first_name} {student.last_name}
          </p>
        </div>
        <ActionsMenu
          type="student"
          onOpenInPage={() => {
            router.push(`/students/${id}`);
          }}
          onEditDetails={() => {
            setActiveTab('details');
            editFlow.startEdit();
          }}
          onPasswordResetOrRegistration={passwordReset.openPasswordResetOrRegistration}
          passwordResetLabel={passwordReset.passwordResetLabel}
          onLogAbsence={modals.openLogAbsence}
          onBookDraftingSession={modals.openBookDraftingSession}
          onDelete={modals.openDeleteDialog}
        />
      </div>

      {/* Tabs */}
      <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-6">
        <TabsList className="grid w-full grid-cols-6">
          <TabsTrigger value="details">Details</TabsTrigger>
          <TabsTrigger value="classes">Classes</TabsTrigger>
          <TabsTrigger value="messages">Messages</TabsTrigger>
          <TabsTrigger value="sessions">Sessions</TabsTrigger>
          <TabsTrigger value="billing">Billing</TabsTrigger>
          <TabsTrigger value="activity">Activity</TabsTrigger>
        </TabsList>

        <TabsContent value="details" className="space-y-6">
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
                />
              ) : undefined
            }
            isLoadingAccount={loadingAccountUpdate}
            hasPasswordResetLinkSent={passwordReset.hasPasswordResetLinkSent}
            onPasswordResetRequest={handlePasswordResetRequest}
          />
          {editFlow.isEditing && (
            <div className="flex justify-end gap-2 pt-4 border-t">
              <Button variant="outline" onClick={editFlow.cancelEdit} disabled={mutations.isUpdatingDetails}>
                Cancel
              </Button>
              <Button 
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
          )}
        </TabsContent>

        <TabsContent value="classes" className="space-y-6">
          <ClassesTab
            student={student}
            onStudentUpdated={handleStudentUpdated}
          />
        </TabsContent>

        <TabsContent value="messages" className="space-y-6">
          <div className="h-[calc(100vh-400px)]">
            <MessagesTabContent 
              conversationId={conversationId}
              title={`${student.first_name} ${student.last_name}`}
              onClose={() => router.push('/students')}
              relatedId={id}
              relatedType="student"
            />
          </div>
        </TabsContent>

        <TabsContent value="sessions" className="space-y-6">
          <StudentSessionsTab student={student} />
        </TabsContent>

        <TabsContent value="billing" className="space-y-6">
          <StudentBillingTab student={student} />
        </TabsContent>

        <TabsContent value="activity" className="space-y-6">
          <StudentActivityTab studentId={id} isOpen={true} />
        </TabsContent>
      </Tabs>

      {/* Parent Modal */}
      <ViewParentModal
        isOpen={modals.parentModalOpen}
        onClose={modals.closeParentModal}
        parentId={modals.selectedParentId}
        onParentUpdated={handleStudentUpdated}
        defaultTab={modals.parentModalDefaultTab}
      />
      
      {/* Subject Modal */}
      {modals.selectedSubjectId && (
        <ViewSubjectModal
          isOpen={modals.subjectModalOpen}
          onClose={modals.closeSubjectModal}
          subjectId={modals.selectedSubjectId}
          onSubjectUpdated={handleStudentUpdated}
        />
      )}

      {/* Log Absence Dialog */}
      {currentStaff && (
        <LogAbsenceDialog
          isOpen={modals.isLogAbsenceDialogOpen}
          onClose={modals.closeLogAbsence}
          staffId={currentStaff.id}
          initialStudentId={id}
          allowPastSessions={true}
        />
      )}

      {/* Book Drafting Session Modal */}
      <BookSessionModal
        isOpen={modals.isBookDraftingSessionModalOpen}
        onClose={modals.closeBookDraftingSession}
        sessionType="DRAFTING"
        initialStudentId={id}
        onBookingCreated={() => {
          modals.closeBookDraftingSession();
          handleStudentUpdated();
        }}
      />

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
        <AlertDialog open={modals.isDeleteDialogOpen} onOpenChange={modals.closeDeleteDialog}>
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
                disabled={mutations.isDeleting}
                className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
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
    </div>
  );
}
