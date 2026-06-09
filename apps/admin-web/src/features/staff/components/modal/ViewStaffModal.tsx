import { useState, useEffect } from 'react';
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription } from "@altitutor/ui";
import { SegmentedControl, SegmentedTabPanelContent } from "@altitutor/ui";
import { useToast } from "@altitutor/ui";
import { Button as UIButton } from '@altitutor/ui';
import { Loader2, X } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useStaffActions } from '../../hooks/useStaffActions';
import { ActionsMenu } from '@/shared/components/ActionsMenu';
import { useStaffDetails, useCurrentStaff } from '../../hooks/useStaffQuery';
import { useSubjects } from '@/features/subjects';
import type { Database } from '@altitutor/shared';
import { getSupabaseClient } from "@/shared/lib/supabase/client";
import type { SupabaseClient } from '@supabase/supabase-js';
import { StaffDetailsTab, StaffDetailsFormData } from './tabs/StaffDetailsTab';
import { ClassesTab } from './tabs/ClassesTab';
import { StaffSessionsTab } from './tabs/StaffSessionsTab';
import { MessagesTabContent } from '@/features/messages/components/MessagesTabContent';
import { SubjectSearchPopover, ViewSubjectModal } from '@/features/subjects/components';
import { StaffFiles } from '../StaffFiles';
import { useQueryClient } from '@tanstack/react-query';
import { staffKeys } from '../../hooks/useStaffQuery';
import { StaffActivityTab } from '@/features/activity/components/tabs/StaffActivityTab';
import { StaffPayTierTab } from './tabs/StaffPayTierTab';
import { LogStaffAbsenceDialog } from '@/features/sessions/components';
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
import { Button } from "@altitutor/ui";
import { SendInviteDialog } from './SendInviteDialog';
import { SessionModal } from '@/features/sessions/components/SessionModal';
import { ViewStudentModal } from '@/features/students/components/ViewStudentModal';
import {
  useStaffEditFlow,
  useStaffPasswordReset,
  useStaffMutations,
  useStaffModals,
  useStaffConversation,
} from '../../hooks';
import { useNestedModalEvents } from '@/shared/hooks/useNestedModalEvents';
import { IssuePill } from '@/features/issues';
import { useQuickActions } from '@/shared/contexts/QuickActionsContext';

interface ViewStaffModalProps {
  isOpen: boolean;
  staffId: string | null;
  onClose: () => void;
  onStaffUpdated: () => void;
  /** When the modal opens, select this tab (e.g. `pay-tier` from Pay tiers page). */
  initialTab?: string;
}

export function ViewStaffModal({ 
  isOpen, 
  staffId, 
  onClose, 
  onStaffUpdated,
  initialTab,
}: ViewStaffModalProps) {
  // Hooks
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const router = useRouter();
  const { data: currentStaff } = useCurrentStaff();
  const { openCheckInModal } = useQuickActions();
  
  // React Query hooks - fetch data only when modal is open and staffId exists
  const { data: staffData, isLoading } = useStaffDetails(staffId || '', isOpen && !!staffId);
  const { data: allSubjects = [] } = useSubjects();
  
  // Extract data from hook
  const staffMember = staffData?.staff || null;
  const staffSubjects = staffData?.subjects || [];
  
  // Business logic hooks
  const editFlow = useStaffEditFlow({
    initialSubjects: staffSubjects,
  });

  const passwordReset = useStaffPasswordReset({ staff: staffMember });

  const mutations = useStaffMutations({
    staffId: staffId || '',
    onSuccess: () => {
      if (staffId) {
        queryClient.invalidateQueries({ queryKey: staffKeys.detailFull(staffId) });
      }
      editFlow.reset();
      onStaffUpdated();
    },
  });

  const modals = useStaffModals();

  const conversationId = useStaffConversation({
    staffId: staffId,
    enabled: isOpen && !!staffId,
  });

  // Centralized action handlers
  const staffActions = useStaffActions({
    staffId: staffId || '',
    onOpenInPage: () => {
      router.push(`/staff/${staffId}`);
      onClose();
    },
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
  const [baseUrl, setBaseUrl] = useState('');
  const [loadingPasswordReset, setLoadingPasswordReset] = useState(false);
  const [deleteConfirmText, setDeleteConfirmText] = useState('');
  
  // Nested modal state for sessions table interactions
  const {
    nestedSessionId,
    nestedStaffId,
    nestedStudentId,
    setNestedSessionId,
    setNestedStaffId,
    setNestedStudentId,
  } = useNestedModalEvents({ isOpen });

  // Set base URL for password reset
  useEffect(() => {
    setBaseUrl(window.location.origin);
  }, []);

  // Reset state when modal closes; honour initialTab when opening
  useEffect(() => {
    if (!isOpen) {
      editFlow.cancelEdit();
      passwordReset.setPasswordResetLinkSent(false);
      setActiveTab('details');
      modals.reset();
      setLoadingPasswordReset(false);
      return;
    }
    if (initialTab) {
      setActiveTab(initialTab);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen, initialTab]);

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

  // Handle delete with modal close
  const handleDelete = async () => {
    if (!staffMember) return;
    
    try {
      await mutations.deleteStaff();
      modals.closeDeleteDialog();
      setDeleteConfirmText('');
      onClose();
    } catch (error) {
      // Error handling is done in the mutation hook
    }
  };

  // Password reset handler
  const handlePasswordResetRequest = async () => {
    if (!staffMember || !staffMember.email) {
      toast({
        title: 'Error',
        description: 'No email address found for this staff member.',
        variant: 'destructive',
      });
      return;
    }
    
    try {
      setLoadingPasswordReset(true);
      // Determine redirect URL based on staff role
      let redirectUrl: string;
      if (staffMember.role === 'TUTOR') {
        const tutorUrl = process.env.NODE_ENV === 'development'
          ? 'http://localhost:3002'
          : (process.env.NEXT_PUBLIC_TUTOR_URL || 'https://tutor.altitutor.com');
        redirectUrl = `${tutorUrl}/auth/callback`;
      } else {
        // ADMINSTAFF goes to admin portal
        redirectUrl = `${baseUrl}/auth/callback`;
      }
      
      const { error } = await (getSupabaseClient() as SupabaseClient<Database>).auth.resetPasswordForEmail(
        staffMember.email,
        {
          redirectTo: redirectUrl,
        }
      );
      
      if (error) throw error;
      
      passwordReset.setPasswordResetLinkSent(true);
      
      toast({
        title: 'Password reset link sent',
        description: `A password reset link has been sent to ${staffMember.email}.`,
      });
    } catch (err) {
      toast({
        title: 'Password reset failed',
        description: 'There was an error resetting the password. Please try again.',
        variant: 'destructive',
      });
    } finally {
      setLoadingPasswordReset(false);
    }
  };

  // Handle subject assignment (needs allSubjects for lookup)
  const handleAssignSubject = (subjectId: string) => {
    const subject = allSubjects.find(s => s.id === subjectId);
    if (!subject) return;
    editFlow.assignSubject(subject);
  };

  // Always render the Sheet to allow exit animation
  return (
    <>
      <Sheet open={isOpen} onOpenChange={onClose}>
        <SheetContent hideCloseButton className="w-full md:w-[600px] lg:w-[800px] md:max-w-none h-full max-h-[100dvh] flex flex-col p-0">
          {!staffMember ? (
            <div className="flex justify-center items-center h-full p-6">
              <div className="text-muted-foreground">
                {isLoading ? 'Loading...' : ''}
              </div>
            </div>
          ) : (
            <div className="flex flex-col h-full min-h-0">
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
                          {editFlow.isEditing ? 'Edit Staff Member' : 'Staff Member Details'}
                        </SheetTitle>
                        <SheetDescription className="text-lg font-medium">
                          <div className="flex items-center gap-2 flex-wrap">
                            {staffMember.first_name} {staffMember.last_name}
                            <IssuePill
                              entityType="staff"
                              entityId={staffId}
                              enabled={isOpen && !!staffId}
                            />
                          </div>
                        </SheetDescription>
                      </div>
                    </div>
                    {staffId && (
                      <ActionsMenu
                        type="staff"
                        entityId={staffId}
                        copyTagDisplayText={`${staffMember.first_name || ''} ${staffMember.last_name || ''}`.trim()}
                        {...staffActions}
                      />
                    )}
                  </div>
                </SheetHeader>
                <div className="px-6 pb-4">
                  <SegmentedControl
                    fullWidth
                    value={activeTab}
                    onValueChange={setActiveTab}
                    options={[
                      { value: 'details', label: 'Details' },
                      { value: 'classes', label: 'Classes' },
                      { value: 'pay-tier', label: 'Pay tier' },
                      { value: 'messages', label: 'Messages' },
                      { value: 'sessions', label: 'Sessions' },
                      { value: 'files', label: 'Files' },
                      { value: 'activity', label: 'Activity' },
                    ]}
                  />
                </div>
              </div>

              {/* Scrollable Content */}
              <div className="flex-1 min-h-0 relative">
                <SegmentedTabPanelContent when="details" activeTab={activeTab} className="absolute inset-0 overflow-y-auto">
                  <div className="p-6">
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
                  </div>
                </SegmentedTabPanelContent>

                <SegmentedTabPanelContent when="classes" activeTab={activeTab} className="absolute inset-0 overflow-y-auto">
                  <div className="p-6">
                    <ClassesTab
                      staff={staffMember}
                      onStaffUpdated={onStaffUpdated}
                    />
                  </div>
                </SegmentedTabPanelContent>

                <SegmentedTabPanelContent when="pay-tier" activeTab={activeTab} className="absolute inset-0 overflow-y-auto">
                  <div className="p-6">
                    {staffId && staffMember && (
                      <StaffPayTierTab
                        staffId={staffId}
                        staffFirstName={staffMember.first_name}
                        staffLastName={staffMember.last_name}
                        onOpenSession={(sessionId) => setNestedSessionId(sessionId)}
                      />
                    )}
                  </div>
                </SegmentedTabPanelContent>

                <SegmentedTabPanelContent when="messages" activeTab={activeTab} className="absolute inset-0 overflow-hidden flex flex-col">
                  <div className="h-full p-6">
                    <MessagesTabContent 
                      conversationId={conversationId}
                      title={`${staffMember.first_name} ${staffMember.last_name}`}
                      onClose={onClose}
                      relatedId={staffId || undefined}
                      relatedType="staff"
                    />
                  </div>
                </SegmentedTabPanelContent>

                <SegmentedTabPanelContent when="sessions" activeTab={activeTab} className="absolute inset-0 overflow-hidden flex flex-col">
                  <div className="h-full p-6">
                    {staffMember && (
                      <StaffSessionsTab 
                        staff={staffMember} 
                        onOpenSession={(sessionId) => {
                          window.dispatchEvent(new CustomEvent('open-session-modal', { detail: { id: sessionId } }));
                        }}
                      />
                    )}
                  </div>
                </SegmentedTabPanelContent>

                <SegmentedTabPanelContent when="files" activeTab={activeTab} className="absolute inset-0 overflow-y-auto">
                  <div className="p-6">
                    {staffId && <StaffFiles staffId={staffId} />}
                  </div>
                </SegmentedTabPanelContent>

                <SegmentedTabPanelContent when="activity" activeTab={activeTab} className="absolute inset-0 overflow-y-auto">
                  <div className="p-6">
                    {staffId && (
                      <StaffActivityTab staffId={staffId} isOpen={isOpen} />
                    )}
                  </div>
                </SegmentedTabPanelContent>
              </div>
            </div>
          )}
          
          {/* Sticky Footer with Buttons */}
          {staffMember && editFlow.isEditing && activeTab === 'details' && (
            <div className="sticky bottom-0 left-0 right-0 p-6 border-t bg-background mt-auto shrink-0">
              <div className="flex w-full justify-end">
                <div className="flex space-x-2">
                  <UIButton variant="outline" type="button" onClick={editFlow.cancelEdit} disabled={mutations.isUpdatingDetails}>
                    Cancel
                  </UIButton>
                  <UIButton 
                    type="button"
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
              </div>
            </div>
          )}
        </SheetContent>
      </Sheet>

      {/* Subject Modal */}
      {modals.selectedSubjectId && (
        <ViewSubjectModal
          isOpen={modals.subjectModalOpen}
          onClose={modals.closeSubjectModal}
          subjectId={modals.selectedSubjectId}
          onSubjectUpdated={() => {
            if (staffId) {
              queryClient.invalidateQueries({ queryKey: staffKeys.detailFull(staffId) });
            }
          }}
        />
      )}

      {/* Log Staff Absence Dialog */}
      {currentStaff && staffId && (
        <LogStaffAbsenceDialog
          isOpen={modals.isLogAbsenceDialogOpen}
          onClose={modals.closeLogAbsence}
          staffId={currentStaff.id}
          initialStaffId={staffId}
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
      {staffMember && (() => {
        const staffFullName = `${staffMember.first_name} ${staffMember.last_name}`;
        return (
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
        );
      })()}

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
          onStaffUpdated={onStaffUpdated}
        />
      )}

      {/* Nested Student Modal */}
      {nestedStudentId && (
        <ViewStudentModal
          isOpen={!!nestedStudentId}
          studentId={nestedStudentId}
          onClose={() => setNestedStudentId(null)}
          onStudentUpdated={onStaffUpdated}
        />
      )}
    </>
  );
} 
