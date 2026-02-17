'use client';

import { useState, useEffect } from 'react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@altitutor/ui";
import { useToast } from "@altitutor/ui";
import { Button } from '@altitutor/ui';
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

interface StaffViewContentProps {
  staffId: string;
  isOpen: boolean;
  onClose: () => void;
  onStaffUpdated: () => void;
  hideHeader?: boolean;
}

export function StaffViewContent({
  staffId,
  isOpen,
  onClose,
  onStaffUpdated,
  hideHeader = false
}: StaffViewContentProps) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const router = useRouter();
  const { data: currentStaff } = useCurrentStaff();
  
  const { data: staffData, isLoading } = useStaffDetails(staffId, isOpen);
  const { data: allSubjects = [] } = useSubjects();
  
  const staffMember = staffData?.staff || null;
  const staffSubjects = staffData?.subjects || [];
  
  const editFlow = useStaffEditFlow({
    initialSubjects: staffSubjects,
  });

  const passwordReset = useStaffPasswordReset({ staff: staffMember });

  const mutations = useStaffMutations({
    staffId: staffId,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: staffKeys.detailFull(staffId) });
      editFlow.reset();
      onStaffUpdated();
    },
  });

  const modals = useStaffModals();

  const conversationId = useStaffConversation({
    staffId: staffId,
    enabled: isOpen,
  });

  const staffActions = useStaffActions({
    staffId: staffId,
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
    onDelete: modals.openDeleteDialog,
  });

  const [activeTab, setActiveTab] = useState('details');
  const [baseUrl, setBaseUrl] = useState('');
  const [loadingPasswordReset, setLoadingPasswordReset] = useState(false);
  
  const {
    nestedSessionId,
    nestedStaffId,
    nestedStudentId,
    setNestedSessionId,
    setNestedStaffId,
    setNestedStudentId,
  } = useNestedModalEvents({ isOpen });

  useEffect(() => {
    setBaseUrl(window.location.origin);
  }, []);

  useEffect(() => {
    if (!isOpen) {
      editFlow.cancelEdit();
      passwordReset.setPasswordResetLinkSent(false);
      setActiveTab('details');
      modals.reset();
      setLoadingPasswordReset(false);
    }
  }, [isOpen]);

  const handleDetailsSubmit = async (data: StaffDetailsFormData) => {
    if (!staffMember) return;
    await mutations.updateDetails(data, {
      toAdd: editFlow.subjectsToAdd,
      toRemove: editFlow.subjectsToRemove,
    });
  };

  const handleDelete = async () => {
    if (!staffMember) return;
    try {
      await mutations.deleteStaff();
      modals.closeDeleteDialog();
      onClose();
    } catch (error) {}
  };

  const handlePasswordResetRequest = async () => {
    if (!staffMember || !staffMember.email) {
      toast({ title: 'Error', description: 'No email found.', variant: 'destructive' });
      return;
    }
    
    try {
      setLoadingPasswordReset(true);
      let redirectUrl: string;
      if (staffMember.role === 'TUTOR') {
        const tutorUrl = process.env.NODE_ENV === 'development'
          ? 'http://localhost:3002'
          : (process.env.NEXT_PUBLIC_TUTOR_URL || 'https://tutor.altitutor.com');
        redirectUrl = `${tutorUrl}/auth/callback`;
      } else {
        redirectUrl = `${baseUrl}/auth/callback`;
      }
      
      const { error } = await (getSupabaseClient() as SupabaseClient<Database>).auth.resetPasswordForEmail(
        staffMember.email,
        { redirectTo: redirectUrl }
      );
      
      if (error) throw error;
      passwordReset.setPasswordResetLinkSent(true);
      toast({ title: 'Link sent', description: `Sent to ${staffMember.email}` });
    } catch (err) {
      toast({ title: 'Failed', description: 'Error resetting password.', variant: 'destructive' });
    } finally {
      setLoadingPasswordReset(false);
    }
  };

  const handleAssignSubject = (subjectId: string) => {
    const subject = allSubjects.find(s => s.id === subjectId);
    if (!subject) return;
    editFlow.assignSubject(subject);
  };

  if (!staffMember) {
    return (
      <div className="flex justify-center items-center h-full p-6">
        <div className="text-muted-foreground">{isLoading ? 'Loading...' : ''}</div>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full min-h-0 bg-background">
      <Tabs defaultValue="details" value={activeTab} onValueChange={setActiveTab} className="flex flex-col h-full min-h-0">
        {!hideHeader && (
          <div className="flex-shrink-0 border-b bg-background sticky top-0 z-10">
            <div className="px-6 py-4 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <Button variant="outline" size="icon" onClick={onClose} className="shrink-0">
                  <X className="h-4 w-4" />
                </Button>
                <h2 className="text-lg font-semibold">{staffMember.first_name} {staffMember.last_name}</h2>
              </div>
              <ActionsMenu type="staff" {...staffActions} />
            </div>
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
        )}

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
              <ClassesTab staff={staffMember} onStaffUpdated={onStaffUpdated} />
            </div>
          </TabsContent>

          <TabsContent value="messages" className="absolute inset-0 overflow-hidden m-0 p-0 hidden data-[state=active]:flex data-[state=active]:flex-col">
            <div className="h-full p-6">
              <MessagesTabContent 
                conversationId={conversationId}
                title={`${staffMember.first_name} ${staffMember.last_name}`}
                onClose={onClose}
                relatedId={staffId}
                relatedType="staff"
              />
            </div>
          </TabsContent>

          <TabsContent value="sessions" className="absolute inset-0 overflow-hidden m-0 hidden data-[state=active]:flex data-[state=active]:flex-col">
            <div className="h-full p-6">
              <StaffSessionsTab 
                staff={staffMember} 
                onOpenSession={(sessionId) => {
                  window.dispatchEvent(new CustomEvent('open-session-modal', { detail: { id: sessionId } }));
                }}
              />
            </div>
          </TabsContent>

          <TabsContent value="files" className="absolute inset-0 overflow-y-auto m-0 hidden data-[state=active]:block">
            <div className="p-6">{staffId && <StaffFiles staffId={staffId} />}</div>
          </TabsContent>

          <TabsContent value="activity" className="absolute inset-0 overflow-y-auto m-0 hidden data-[state=active]:block">
            <div className="p-6">{staffId && <StaffActivityTab staffId={staffId} isOpen={isOpen} />}</div>
          </TabsContent>
        </div>

        {staffMember && editFlow.isEditing && activeTab === 'details' && (
          <div className="p-6 border-t bg-background mt-auto shrink-0">
            <div className="flex w-full justify-end">
              <div className="flex space-x-2">
                <Button variant="outline" type="button" onClick={editFlow.cancelEdit}>Cancel</Button>
                <Button type="button" onClick={() => {
                  const form = document.getElementById('staff-edit-form') as HTMLFormElement;
                  if (form) form.requestSubmit();
                }}>
                  {mutations.isUpdatingDetails && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                  Save Changes
                </Button>
              </div>
            </div>
          </div>
        )}
      </Tabs>

      <ViewSubjectModal
        isOpen={modals.subjectModalOpen}
        onClose={modals.closeSubjectModal}
        subjectId={modals.selectedSubjectId || ''}
        onSubjectUpdated={() => {
          queryClient.invalidateQueries({ queryKey: staffKeys.detailFull(staffId) });
        }}
      />

      {currentStaff && (
        <LogStaffAbsenceDialog
          isOpen={modals.isLogAbsenceDialogOpen}
          onClose={modals.closeLogAbsence}
          staffId={currentStaff.id}
          initialStaffId={staffId}
          allowPastSessions={true}
        />
      )}

      <SendInviteDialog
        isOpen={passwordReset.inviteDialogOpen}
        onClose={passwordReset.closeInviteDialog}
        staffMember={staffMember}
      />

      <AlertDialog open={modals.isDeleteDialogOpen} onOpenChange={modals.closeDeleteDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Are you sure?</AlertDialogTitle>
            <AlertDialogDescription>Permanently delete {staffMember.first_name} {staffMember.last_name}?</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete} className="bg-destructive">Delete</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <SessionModal isOpen={!!nestedSessionId} sessionId={nestedSessionId || ''} onClose={() => setNestedSessionId(null)} />
      {nestedStaffId && <ViewStaffModal isOpen={!!nestedStaffId} staffId={nestedStaffId} onClose={() => setNestedStaffId(null)} onStaffUpdated={onStaffUpdated} />}
      {nestedStudentId && <ViewStudentModal isOpen={!!nestedStudentId} studentId={nestedStudentId} onClose={() => setNestedStudentId(null)} onStudentUpdated={onStaffUpdated} />}
    </div>
  );
}
