'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@altitutor/ui";
import { useToast } from "@altitutor/ui";
import { Button as UIButton } from "@altitutor/ui";
import { Loader2, ArrowLeft } from "lucide-react";
import { staffApi } from '@/features/staff/api';
import { ActionsMenu } from '@/shared/components/ActionsMenu';
import { useCurrentStaff } from '@/features/staff/hooks/useStaffQuery';
import { LogStaffAbsenceDialog } from '@/features/sessions/components/LogStaffAbsenceDialog';
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
import { SendInviteDialog } from '@/features/staff/components/modal/SendInviteDialog';
import { useStaffDetails, staffKeys } from '@/features/staff/hooks/useStaffQuery';
import { useSubjects } from '@/features/subjects';
import { useQueryClient } from '@tanstack/react-query';
import type { Tables } from '@altitutor/shared';
import { StaffDetailsTab, StaffDetailsFormData } from '@/features/staff/components/modal/tabs/StaffDetailsTab';
import { ClassesTab } from '@/features/staff/components/modal/tabs/ClassesTab';
import { StudentsTab } from '@/features/staff/components/modal/tabs/StudentsTab';
import { StaffSessionsTab } from '@/features/staff/components/modal/tabs/StaffSessionsTab';
import { MessagesTabContent } from '@/features/messages/components/MessagesTabContent';
import { getExistingConversationForRelated } from '@/features/messages/api/queries';
import { SubjectSearchPopover, ViewSubjectModal } from '@/features/subjects/components';
import { StaffActivityTab } from '@/features/activity/components/tabs/StaffActivityTab';

export default function StaffDetailPage({ params }: { params: { id: string } }) {
  const { id } = params;
  const router = useRouter();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const { data: currentStaff } = useCurrentStaff();
  
  const { data: staffData, isLoading } = useStaffDetails(id, !!id);
  const { data: allSubjects = [] } = useSubjects();
  
  const staffMember = staffData?.staff || null;
  const staffSubjects = staffData?.subjects || [];
  
  const [isDeleting, setIsDeleting] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [hasPasswordResetLinkSent, setHasPasswordResetLinkSent] = useState(false);
  const [activeTab, setActiveTab] = useState('details');
  const [conversationId, setConversationId] = useState<string | null>(null);
  const [loadingStaffUpdate, setLoadingStaffUpdate] = useState(false);
  const [loadingPasswordReset, setLoadingPasswordReset] = useState(false);
  const [inviteDialogOpen, setInviteDialogOpen] = useState(false);
  
  const [selectedSubjectId, setSelectedSubjectId] = useState<string | null>(null);
  const [subjectModalOpen, setSubjectModalOpen] = useState(false);

  // Absence and delete modals
  const [isLogAbsenceDialogOpen, setIsLogAbsenceDialogOpen] = useState(false);
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
  
  const [tempStaffSubjects, setTempStaffSubjects] = useState<Tables<'subjects'>[]>([]);
  const [subjectsToAdd, setSubjectsToAdd] = useState<string[]>([]);
  const [subjectsToRemove, setSubjectsToRemove] = useState<string[]>([]);

  useEffect(() => {
    if (staffMember && id) {
      getExistingConversationForRelated(id, 'staff').then(convId => {
        setConversationId(convId);
      });
    }
  }, [staffMember, id]);

  const handleStartEdit = () => {
    setTempStaffSubjects([...staffSubjects]);
    setSubjectsToAdd([]);
    setSubjectsToRemove([]);
    setIsEditing(true);
  };

  const handleCancelEdit = () => {
    setTempStaffSubjects([]);
    setSubjectsToAdd([]);
    setSubjectsToRemove([]);
    setIsEditing(false);
  };

  const handleStaffUpdate = async (data: StaffDetailsFormData) => {
    if (!staffMember) return;
    
    try {
      setLoadingStaffUpdate(true);
      const updateData = {
        first_name: data.firstName,
        last_name: data.lastName,
        email: data.email || undefined,
        phone_number: data.phoneNumber || null,
        role: data.role,
        status: data.status,
        office_key_number: data.officeKeyNumber,
        has_parking_remote: data.hasParkingRemote,
        availability_monday: data.availability_monday,
        availability_tuesday: data.availability_tuesday,
        availability_wednesday: data.availability_wednesday,
        availability_thursday: data.availability_thursday,
        availability_friday: data.availability_friday,
        availability_saturday_am: data.availability_saturday_am,
        availability_saturday_pm: data.availability_saturday_pm,
        availability_sunday_am: data.availability_sunday_am,
        availability_sunday_pm: data.availability_sunday_pm,
        drafting_availability: data.drafting_availability,
        trial_session_availability: data.trial_session_availability,
        subsidy_interview_availability: data.subsidy_interview_availability,
      };
      await staffApi.updateStaff(staffMember.id, updateData);
      
      for (const subjectId of subjectsToAdd) {
        await staffApi.assignSubjectToStaff(staffMember.id, subjectId);
      }
      for (const subjectId of subjectsToRemove) {
        await staffApi.removeSubjectFromStaff(staffMember.id, subjectId);
      }
      
      setSubjectsToAdd([]);
      setSubjectsToRemove([]);
      
      await queryClient.invalidateQueries({ queryKey: staffKeys.detailFull(staffMember.id) });
      await queryClient.invalidateQueries({ queryKey: staffKeys.minimal({}) });
      
      setIsEditing(false);
      
      toast({
        title: 'Staff updated',
        description: 'Staff member has been updated successfully.',
      });
    } catch (err) {
      console.error('Failed to update staff:', err);
      toast({
        title: 'Update failed',
        description: 'There was an error updating the staff member. Please try again.',
        variant: 'destructive',
      });
    } finally {
      setLoadingStaffUpdate(false);
    }
  };

  // Handle password reset/invite request
  const handlePasswordResetOrRegistration = () => {
    if (!staffMember) return;
    
    if (!staffMember.user_id) {
      // No account -> Send Invite
      setInviteDialogOpen(true);
    } else {
      // Has account -> Password Reset
      handlePasswordResetRequest();
    }
  };

  // Get password reset label
  const getPasswordResetLabel = () => {
    if (!staffMember) return 'Send password reset';
    
    if (!staffMember.user_id) {
      return 'Send invite';
    } else {
      return 'Send password reset';
    }
  };

  const handleDelete = async () => {
    if (!staffMember) return;
    
    try {
      setIsDeleting(true);
      await staffApi.deleteStaff(staffMember.id);
      setIsDeleteDialogOpen(false);
      router.push('/staff');
      
      toast({
        title: 'Staff deleted',
        description: 'Staff member has been deleted successfully.',
      });
    } catch (err) {
      console.error('Failed to delete staff:', err);
      toast({
        title: 'Delete failed',
        description: 'There was an error deleting the staff member. Please try again.',
        variant: 'destructive',
      });
    } finally {
      setIsDeleting(false);
    }
  };

  const handleAssignSubject = (subjectId: string) => {
    const subject = allSubjects.find(s => s.id === subjectId);
    if (!subject) return;
    setTempStaffSubjects(prev => [...prev, subject]);
    if (subjectsToRemove.includes(subjectId)) {
      setSubjectsToRemove(prev => prev.filter(id => id !== subjectId));
    } else {
      setSubjectsToAdd(prev => [...prev, subjectId]);
    }
  };

  const handleRemoveSubject = (subjectId: string) => {
    setTempStaffSubjects(prev => prev.filter(s => s.id !== subjectId));
    if (subjectsToAdd.includes(subjectId)) {
      setSubjectsToAdd(prev => prev.filter(id => id !== subjectId));
    } else {
      setSubjectsToRemove(prev => [...prev, subjectId]);
    }
  };

  const handleViewSubject = (subjectId: string) => {
    setSelectedSubjectId(subjectId);
    setSubjectModalOpen(true);
  };

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
      setLoadingPasswordReset(false);
    }
  };

  const handleStaffUpdated = () => {
    queryClient.invalidateQueries({ queryKey: staffKeys.detailFull(id) });
  };

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
            {isEditing ? 'Edit Staff Member' : 'Staff Member Details'}
          </h1>
          <p className="text-lg text-muted-foreground mt-1">
            {staffMember.first_name} {staffMember.last_name}
          </p>
        </div>
        <ActionsMenu
          type="staff"
          onOpenInPage={() => {
            router.push(`/staff/${id}`);
          }}
          onEditDetails={() => {
            setActiveTab('details');
            handleStartEdit();
          }}
          onPasswordResetOrRegistration={handlePasswordResetOrRegistration}
          passwordResetLabel={getPasswordResetLabel()}
          onLogAbsence={() => {
            setIsLogAbsenceDialogOpen(true);
          }}
          onDelete={() => {
            setIsDeleteDialogOpen(true);
          }}
        />
      </div>

      {/* Tabs */}
      <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-6">
        <TabsList className="grid w-full grid-cols-6">
          <TabsTrigger value="details">Details</TabsTrigger>
          <TabsTrigger value="classes">Classes</TabsTrigger>
          <TabsTrigger value="students">Students</TabsTrigger>
          <TabsTrigger value="sessions">Sessions</TabsTrigger>
          <TabsTrigger value="messages">Messages</TabsTrigger>
          <TabsTrigger value="activity">Activity</TabsTrigger>
        </TabsList>

        <TabsContent value="details" className="space-y-6">
          <StaffDetailsTab
            staffMember={staffMember}
            isEditing={isEditing}
            isLoading={loadingStaffUpdate}
            onEdit={handleStartEdit}
            onCancelEdit={handleCancelEdit}
            onSubmit={handleStaffUpdate}
            onDelete={undefined}
            isDeleting={isDeleting}
            staffSubjects={isEditing ? tempStaffSubjects : staffSubjects}
            loadingSubjects={isLoading}
            onRemoveSubject={handleRemoveSubject}
            onViewSubject={handleViewSubject}
            addSubjectButton={
              <SubjectSearchPopover
                selectedSubjects={isEditing ? tempStaffSubjects : staffSubjects}
                onSelectSubject={(subject) => handleAssignSubject(subject.id)}
              />
            }
            isLoadingAccount={loadingPasswordReset}
            hasPasswordResetLinkSent={hasPasswordResetLinkSent}
            onPasswordResetRequest={handlePasswordResetRequest}
          />
          {isEditing && (
            <div className="flex justify-end gap-2 pt-4 border-t">
              <UIButton variant="outline" onClick={handleCancelEdit} disabled={loadingStaffUpdate}>
                Cancel
              </UIButton>
              <UIButton 
                disabled={loadingStaffUpdate}
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
                {loadingStaffUpdate && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
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

        <TabsContent value="students" className="space-y-6">
          <StudentsTab
            staffId={id}
            isOpen={true}
          />
        </TabsContent>

        <TabsContent value="sessions" className="space-y-6">
          {staffMember && (
            <StaffSessionsTab staff={staffMember} />
          )}
        </TabsContent>

        <TabsContent value="messages" className="space-y-6">
          <div className="h-[calc(100vh-400px)]">
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
      {selectedSubjectId && (
        <ViewSubjectModal
          isOpen={subjectModalOpen}
          onClose={() => {
            setSubjectModalOpen(false);
            setSelectedSubjectId(null);
          }}
          subjectId={selectedSubjectId}
          onSubjectUpdated={handleStaffUpdated}
        />
      )}

      {/* Log Staff Absence Dialog */}
      {currentStaff && (
        <LogStaffAbsenceDialog
          isOpen={isLogAbsenceDialogOpen}
          onClose={() => setIsLogAbsenceDialogOpen(false)}
          staffId={currentStaff.id}
          initialStaffId={id}
          allowPastSessions={true}
        />
      )}

      {/* Send Invite Dialog */}
      {staffMember && (
        <SendInviteDialog
          isOpen={inviteDialogOpen}
          onClose={() => setInviteDialogOpen(false)}
          staffMember={staffMember}
        />
      )}

      {/* Delete Confirmation Dialog */}
      {staffMember && (
        <AlertDialog open={isDeleteDialogOpen} onOpenChange={setIsDeleteDialogOpen}>
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
                disabled={isDeleting}
                className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              >
                {isDeleting ? (
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
