import { useState, useEffect } from 'react';
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription } from "@altitutor/ui";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@altitutor/ui";
import { useToast } from "@altitutor/ui";
import { Button as UIButton } from '@altitutor/ui';
import { Loader2, X } from 'lucide-react';
import { useRouter } from 'next/navigation';
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

interface ViewStaffModalProps {
  isOpen: boolean;
  staffId: string | null;
  onClose: () => void;
  onStaffUpdated: () => void;
}

export function ViewStaffModal({ 
  isOpen, 
  staffId, 
  onClose, 
  onStaffUpdated 
}: ViewStaffModalProps) {
  // Hooks
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const router = useRouter();
  const { data: currentStaff } = useCurrentStaff();
  
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

  // UI state
  const [activeTab, setActiveTab] = useState('details');
  const [baseUrl, setBaseUrl] = useState('');
  const [loadingPasswordReset, setLoadingPasswordReset] = useState(false);
  
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

  // Reset state when modal closes
  useEffect(() => {
    if (!isOpen) {
      editFlow.cancelEdit();
      passwordReset.setPasswordResetLinkSent(false);
      setActiveTab('details');
      modals.reset();
      setLoadingPasswordReset(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen]);

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
        <SheetContent hideCloseButton className="w-full md:w-[600px] lg:w-[800px] md:max-w-none h-full max-h-[100vh] flex flex-col p-0">
          {!staffMember ? (
            <div className="flex justify-center items-center h-full p-6">
              <div className="text-muted-foreground">
                {isLoading ? 'Loading...' : ''}
              </div>
            </div>
          ) : (
            <Tabs 
              defaultValue="details" 
              value={activeTab} 
              onValueChange={setActiveTab}
              className="flex flex-col h-full min-h-0"
            >
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
                          {staffMember.first_name} {staffMember.last_name}
                        </SheetDescription>
                      </div>
                    </div>
                    {staffId && (
                      <ActionsMenu
                        type="staff"
                        onOpenInPage={() => {
                          router.push(`/staff/${staffId}`);
                          onClose();
                        }}
                        onEditDetails={() => {
                          setActiveTab('details');
                          editFlow.startEdit();
                        }}
                        onPasswordResetOrRegistration={() => {
                          passwordReset.openPasswordResetOrRegistration();
                          if (staffMember?.user_id) {
                            handlePasswordResetRequest();
                          }
                        }}
                        passwordResetLabel={passwordReset.passwordResetLabel}
                        onLogAbsence={modals.openLogAbsence}
                        onDelete={modals.openDeleteDialog}
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
                    <TabsTrigger value="files">Files</TabsTrigger>
                    <TabsTrigger value="activity">Activity</TabsTrigger>
                  </TabsList>
                </div>
              </div>

              {/* Scrollable Content */}
              <div className="flex-1 min-h-0 relative">
                <TabsContent value="details" className="absolute inset-0 overflow-y-auto m-0 hidden data-[state=active]:block">
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
                </TabsContent>
                    
                <TabsContent value="classes" className="absolute inset-0 overflow-y-auto m-0 hidden data-[state=active]:block">
                  <div className="p-6">
                    <ClassesTab
                      staff={staffMember}
                      onStaffUpdated={onStaffUpdated}
                    />
                  </div>
                </TabsContent>

                <TabsContent value="messages" className="absolute inset-0 overflow-hidden m-0 p-0 hidden data-[state=active]:flex data-[state=active]:flex-col">
                  <div className="h-full p-6">
                    <MessagesTabContent 
                      conversationId={conversationId}
                      title={`${staffMember.first_name} ${staffMember.last_name}`}
                      onClose={onClose}
                      relatedId={staffId || undefined}
                      relatedType="staff"
                    />
                  </div>
                </TabsContent>

                <TabsContent value="sessions" className="absolute inset-0 overflow-hidden m-0 hidden data-[state=active]:flex data-[state=active]:flex-col">
                  <div className="h-full p-6">
                    {staffMember && (
                      <StaffSessionsTab staff={staffMember} />
                    )}
                  </div>
                </TabsContent>

                <TabsContent value="files" className="absolute inset-0 overflow-y-auto m-0 hidden data-[state=active]:block">
                  <div className="p-6">
                    {staffId && <StaffFiles staffId={staffId} />}
                  </div>
                </TabsContent>

                <TabsContent value="activity" className="absolute inset-0 overflow-y-auto m-0 hidden data-[state=active]:block">
                  <div className="p-6">
                    {staffId && (
                      <StaffActivityTab staffId={staffId} isOpen={isOpen} />
                    )}
                  </div>
                </TabsContent>
              </div>
            </Tabs>
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
      {staffMember && (
        <AlertDialog open={modals.isDeleteDialogOpen} onOpenChange={modals.closeDeleteDialog}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Are you absolutely sure?</AlertDialogTitle>
              <AlertDialogDescription>
                This action cannot be undone. This will permanently delete the staff member
                "{staffMember.first_name} {staffMember.last_name}" and all associated data from the database.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Cancel</AlertDialogCancel>
              <AlertDialogAction
                onClick={handleDelete}
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