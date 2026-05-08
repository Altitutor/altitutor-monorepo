'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@altitutor/ui";
import { useToast } from "@altitutor/ui";
import { Button as UIButton } from "@altitutor/ui";
import { Loader2, ArrowLeft } from "lucide-react";
import { ActionsMenu } from '@/shared/components/ActionsMenu';
import { useStaffActions } from '@/features/staff/hooks/useStaffActions';
import { useCurrentStaff } from '@/shared/hooks';
import { useQuickActions } from '@/shared/contexts/QuickActionsContext';
import { LogStaffAbsenceDialog } from '@/features/sessions/components/absences/LogStaffAbsenceDialog';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  Label,
  Input,
} from "@altitutor/ui";
import { SendInviteDialog } from '@/features/staff/components/modal/SendInviteDialog';
import { useStaffDetails, staffKeys } from '@/features/staff/hooks/useStaffQuery';
import { useSubjects } from '@/features/subjects';
import { useQueryClient } from '@tanstack/react-query';
import { StaffDetailsTab, StaffDetailsFormData } from '@/features/staff/components/modal/tabs/StaffDetailsTab';
import { ClassesTab } from '@/features/staff/components/modal/tabs/ClassesTab';
import { StaffSessionsTab } from '@/features/staff/components/modal/tabs/StaffSessionsTab';
import { MessagesTabContent } from '@/features/messages/components/MessagesTabContent';
import { SubjectSearchPopover, ViewSubjectModal } from '@/features/subjects/components';
import { StaffActivityTab } from '@/features/activity/components/tabs/StaffActivityTab';
import { SessionModal } from '@/features/sessions/components/SessionModal';
import { StaffFiles } from '@/features/staff/components/StaffFiles';
import {
  useStaffEditFlow,
  useStaffPasswordReset,
  useStaffMutations,
  useStaffModals,
  useStaffConversation,
} from '@/features/staff/hooks';

export default function StaffDetailPage({ params }: { params: { id: string } }) {
  const { id } = params;
  const router = useRouter();
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const { data: currentStaff } = useCurrentStaff();
  const { openCheckInModal } = useQuickActions();
  
  // Data fetching
  const { data: staffData, isLoading } = useStaffDetails(id, !!id);
  const { data: allSubjects = [] } = useSubjects();
  
  const staffMember = staffData?.staff || null;
  const staffSubjects = staffData?.subjects || [];
  const staffFullName = staffMember ? `${staffMember.first_name} ${staffMember.last_name}` : '';
  
  // Business logic hooks
  const editFlow = useStaffEditFlow({
    initialSubjects: staffSubjects,
  });

  const passwordReset = useStaffPasswordReset({ staff: staffMember });

  const mutations = useStaffMutations({
    staffId: id,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: staffKeys.detailFull(id) });
      editFlow.reset();
    },
  });

  const modals = useStaffModals();

  const conversationId = useStaffConversation({
    staffId: id,
    enabled: !!id,
  });

  // Centralized action handlers
  const staffActions = useStaffActions({
    staffId: id,
    onEditDetails: () => {
      setActiveTab('details');
      editFlow.startEdit();
    },
    onPasswordResetOrRegistration: () => {
      passwordReset.openPasswordResetOrRegistration();
      if (staffMember?.user_id) {
        handlePasswordResetRequest();
      }
    },
    passwordResetLabel: passwordReset.passwordResetLabel,
    onLogAbsence: modals.openLogAbsence,
    onBookCheckIn: staffMember
      ? () =>
          openCheckInModal({
            staff: [
              {
                id: staffMember.id,
                first_name: staffMember.first_name,
                last_name: staffMember.last_name,
              },
            ],
          })
      : undefined,
    onDelete: modals.openDeleteDialog,
  });

  // UI state
  const [activeTab, setActiveTab] = useState('details');
  const [loadingPasswordReset, setLoadingPasswordReset] = useState(false);
  const [activeSessionId, setActiveSessionId] = useState<string | null>(null);
  const [deleteConfirmText, setDeleteConfirmText] = useState('');

  // Handle details submit
  const handleDetailsSubmit = async (data: StaffDetailsFormData) => {
    if (!staffMember) return;
    
    await mutations.updateDetails(
      data,
      {
        toAdd: editFlow.subjectsToAdd,
        toRemove: editFlow.subjectsToRemove,
      }
    );
  };

  // Handle password reset request
  const handlePasswordResetRequest = async () => {
    if (!staffMember || !staffMember.email) {
      toast({
        title: "Error",
        description: "No email address found for this staff member.",
        variant: "destructive",
      });
      return;
    }

    try {
      setLoadingPasswordReset(true);
      passwordReset.setPasswordResetLinkSent(true);
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
      setLoadingPasswordReset(false);
    }
  };

  // Handle delete with navigation
  const handleDelete = async () => {
    if (!staffMember) return;
    
    try {
      await mutations.deleteStaff();
      modals.closeDeleteDialog();
      setDeleteConfirmText('');
      router.push('/staff');
    } catch (error) {
      // Error handling is done in the mutation hook
    }
  };

  // Handle subject assignment (needs allSubjects for lookup)
  const handleAssignSubject = (subjectId: string) => {
    const subject = allSubjects.find(s => s.id === subjectId);
    if (!subject) return;
    editFlow.assignSubject(subject);
  };

  const handleStaffUpdated = () => {
    queryClient.invalidateQueries({ queryKey: staffKeys.detailFull(id) });
  };

  // Listen for session modal events
  useEffect(() => {
    const onOpenSession = (e: Event) => {
      const detail = (e as CustomEvent).detail as { id: string };
      if (detail?.id) setActiveSessionId(detail.id);
    };
    
    window.addEventListener('open-session-modal', onOpenSession as EventListener);
    
    return () => {
      window.removeEventListener('open-session-modal', onOpenSession as EventListener);
    };
  }, []);

  if (isLoading) {
    return (
      <div className="p-6">
        <div className="flex items-center justify-center h-64">
          <Loader2 className="h-8 w-8 animate-spin" />
        </div>
      </div>
    );
  }

  if (!staffMember) {
    return (
      <div className="p-6">
        <div className="flex items-center gap-4 mb-6">
          <UIButton
            variant="ghost"
            size="icon"
            onClick={() => router.push('/staff')}
            className="border"
          >
            <ArrowLeft className="h-4 w-4" />
          </UIButton>
          <h1 className="text-3xl font-bold tracking-tight">Staff Not Found</h1>
        </div>
      </div>
    );
  }

  return (
    <div className="p-6">
      {/* Header */}
      <div className="flex items-center gap-4 mb-6">
        <UIButton
          variant="ghost"
          size="icon"
          onClick={() => router.push('/staff')}
          className="border"
        >
          <ArrowLeft className="h-4 w-4" />
        </UIButton>
        <div className="flex-1">
          <h1 className="text-3xl font-bold tracking-tight">
            {editFlow.isEditing ? 'Edit Staff Member' : 'Staff Member Details'}
          </h1>
          <p className="text-lg text-muted-foreground mt-1">
            {staffMember.first_name} {staffMember.last_name}
          </p>
        </div>
        <ActionsMenu
          type="staff"
          entityId={staffMember.id}
          copyTagDisplayText={`${staffMember.first_name || ''} ${staffMember.last_name || ''}`.trim()}
          {...staffActions}
        />
      </div>

      {/* Tabs */}
      <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-6">
        <TabsList className="grid w-full grid-cols-6">
          <TabsTrigger value="details">Details</TabsTrigger>
          <TabsTrigger value="classes">Classes</TabsTrigger>
          <TabsTrigger value="sessions">Sessions</TabsTrigger>
          <TabsTrigger value="files">Files</TabsTrigger>
          <TabsTrigger value="messages">Messages</TabsTrigger>
          <TabsTrigger value="activity">Activity</TabsTrigger>
        </TabsList>

        <TabsContent value="details" className="space-y-6">
          <StaffDetailsTab
            staffMember={staffMember}
            isEditing={editFlow.isEditing}
            isLoading={mutations.isUpdatingDetails}
            onEdit={editFlow.startEdit}
            onCancelEdit={editFlow.cancelEdit}
            onSubmit={handleDetailsSubmit}
            onDelete={undefined}
            isDeleting={mutations.isDeleting}
            staffSubjects={editFlow.isEditing ? editFlow.tempStaffSubjects : staffSubjects}
            loadingSubjects={isLoading}
            onRemoveSubject={editFlow.removeSubject}
            onViewSubject={modals.openSubjectModal}
            addSubjectButton={
              <SubjectSearchPopover
                selectedSubjects={editFlow.isEditing ? editFlow.tempStaffSubjects : staffSubjects}
                onSelectSubject={(subject) => handleAssignSubject(subject.id)}
              />
            }
            isLoadingAccount={loadingPasswordReset}
            hasPasswordResetLinkSent={passwordReset.hasPasswordResetLinkSent}
            onPasswordResetRequest={handlePasswordResetRequest}
          />
          {editFlow.isEditing && (
            <div className="flex justify-end gap-2 pt-4 border-t">
              <UIButton variant="outline" onClick={editFlow.cancelEdit} disabled={mutations.isUpdatingDetails}>
                Cancel
              </UIButton>
              <UIButton 
                disabled={mutations.isUpdatingDetails}
                onClick={() => {
                  const form = document.getElementById('staff-edit-form') as HTMLFormElement;
                  if (form) {
                    const submitButton = form.querySelector('button[type="submit"]') as HTMLButtonElement;
                    if (submitButton) {
                      submitButton.click();
                    } else {
                      form.requestSubmit();
                    }
                  }
                }}
              >
                {mutations.isUpdatingDetails && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                Save Changes
              </UIButton>
            </div>
          )}
        </TabsContent>

        <TabsContent value="classes" className="space-y-6">
          <ClassesTab
            staff={staffMember}
            onStaffUpdated={handleStaffUpdated}
          />
        </TabsContent>

        <TabsContent value="sessions" className="space-y-6">
          {staffMember && (
            <StaffSessionsTab staff={staffMember} />
          )}
        </TabsContent>

        <TabsContent value="files" className="space-y-6">
          <StaffFiles staffId={id} />
        </TabsContent>

        <TabsContent value="messages" className="space-y-6">
          <div className="h-[calc(100dvh-400px)]">
            <MessagesTabContent 
              conversationId={conversationId}
              title={`${staffMember.first_name} ${staffMember.last_name}`}
              onClose={() => router.push('/staff')}
              relatedId={id}
              relatedType="staff"
            />
          </div>
        </TabsContent>

        <TabsContent value="activity" className="space-y-6">
          <StaffActivityTab staffId={id} isOpen={true} />
        </TabsContent>
      </Tabs>

      {/* Subject Modal */}
      {modals.selectedSubjectId && (
        <ViewSubjectModal
          isOpen={modals.subjectModalOpen}
          onClose={modals.closeSubjectModal}
          subjectId={modals.selectedSubjectId}
          onSubjectUpdated={handleStaffUpdated}
        />
      )}

      {/* Log Staff Absence Dialog */}
      {currentStaff && (
        <LogStaffAbsenceDialog
          isOpen={modals.isLogAbsenceDialogOpen}
          onClose={modals.closeLogAbsence}
          staffId={currentStaff.id}
          initialStaffId={id}
          allowPastSessions={true}
        />
      )}

      {/* Send Invite Dialog */}
      {staffMember && (
        <SendInviteDialog
          isOpen={passwordReset.inviteDialogOpen}
          onClose={passwordReset.closeInviteDialog}
          staffMember={staffMember}
        />
      )}

      {/* Delete Confirmation Dialog */}
      {staffMember && (
        <AlertDialog
          open={modals.isDeleteDialogOpen}
          onOpenChange={(open) => {
            if (!open) {
              modals.closeDeleteDialog();
              setDeleteConfirmText('');
            }
          }}
        >
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Are you absolutely sure?</AlertDialogTitle>
              <AlertDialogDescription>
                This action cannot be undone. This will permanently delete the staff member
                "{staffMember.first_name} {staffMember.last_name}" and all associated data from the database.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <div className="py-4">
              <div className="space-y-2">
                <Label>
                  Type <strong>{staffFullName}</strong> to confirm deletion
                </Label>
                <Input
                  type="text"
                  placeholder={staffFullName}
                  value={deleteConfirmText}
                  onChange={(e) => setDeleteConfirmText(e.target.value)}
                  className="mt-2"
                />
              </div>
            </div>
            <AlertDialogFooter>
              <AlertDialogCancel>Cancel</AlertDialogCancel>
              <AlertDialogAction
                onClick={handleDelete}
                disabled={mutations.isDeleting || deleteConfirmText !== staffFullName}
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

      {/* Session Modal */}
      <SessionModal
        isOpen={!!activeSessionId}
        sessionId={activeSessionId}
        onClose={() => setActiveSessionId(null)}
      />
    </div>
  );
}
