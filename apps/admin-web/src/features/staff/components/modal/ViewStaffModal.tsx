import { useState, useEffect } from 'react';
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription } from "@altitutor/ui";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@altitutor/ui";
import { useToast } from "@altitutor/ui";
import { Button as UIButton } from '@altitutor/ui';
import { Loader2, ExternalLink } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { staffApi } from "../../api";
import { useStaffDetails } from '../../hooks/useStaffQuery';
import { useSubjects } from '@/features/subjects';
import type { Tables, Database } from '@altitutor/shared';
import { getSupabaseClient } from "@/shared/lib/supabase/client";
import type { SupabaseClient } from '@supabase/supabase-js';
import { StaffDetailsTab, StaffDetailsFormData } from './tabs/StaffDetailsTab';
import { ClassesTab } from './tabs/ClassesTab';
import { StaffSessionsTab } from './tabs/StaffSessionsTab';
import { MessagesTabContent } from '@/features/messages/components/MessagesTabContent';
import { getExistingConversationForRelated } from '@/features/messages/api/queries';
import { SubjectSearchPopover, ViewSubjectModal } from '@/features/subjects/components';
import { useQueryClient } from '@tanstack/react-query';
import { staffKeys } from '../../hooks/useStaffQuery';
import { StaffActivityTab } from '@/features/activity/components/tabs/StaffActivityTab';

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
  
  // React Query hooks - fetch data only when modal is open and staffId exists
  const { data: staffData, isLoading } = useStaffDetails(staffId || '', isOpen && !!staffId);
  const { data: allSubjects = [] } = useSubjects();
  
  // Extract data from hook
  const staffMember = staffData?.staff || null;
  const staffSubjects = staffData?.subjects || [];
  
  // Local state
  const [isDeleting, setIsDeleting] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [hasPasswordResetLinkSent, setHasPasswordResetLinkSent] = useState(false);
  const [activeTab, setActiveTab] = useState('details');
  const [baseUrl, setBaseUrl] = useState('');
  const [conversationId, setConversationId] = useState<string | null>(null);
  const [loadingStaffUpdate, setLoadingStaffUpdate] = useState(false);
  
  // Subject modal state
  const [selectedSubjectId, setSelectedSubjectId] = useState<string | null>(null);
  const [subjectModalOpen, setSubjectModalOpen] = useState(false);
  
  
  // Temporary subjects state for editing (not saved until form submit)
  const [tempStaffSubjects, setTempStaffSubjects] = useState<Tables<'subjects'>[]>([]);
  const [subjectsToAdd, setSubjectsToAdd] = useState<string[]>([]);
  const [subjectsToRemove, setSubjectsToRemove] = useState<string[]>([]);

  // Set base URL for password reset
  useEffect(() => {
    setBaseUrl(window.location.origin);
  }, []);

  // Reset state when modal closes
  useEffect(() => {
    if (!isOpen) {
      setIsEditing(false);
      setHasPasswordResetLinkSent(false);
      setActiveTab('details');
      setTempStaffSubjects([]);
      setSubjectsToAdd([]);
      setSubjectsToRemove([]);
      setLoadingStaffUpdate(false);
    }
  }, [isOpen]);
      
  // Fetch conversation ID when staff data loads
  useEffect(() => {
    if (staffMember && staffId) {
      getExistingConversationForRelated(staffId, 'staff').then(convId => {
        setConversationId(convId);
      });
    }
  }, [staffMember, staffId]);

  // Update staff handler
  const handleStaffUpdate = async (data: StaffDetailsFormData) => {
    if (!staffMember) {
      return;
    }
    
    try {
      setLoadingStaffUpdate(true);
      // Map form data to staff update
      const updateData = {
        first_name: data.firstName,
        last_name: data.lastName,
        // Email can be null or empty string
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
      
      // Apply subject changes
      for (const subjectId of subjectsToAdd) {
        await staffApi.assignSubjectToStaff(staffMember.id, subjectId);
      }
      for (const subjectId of subjectsToRemove) {
        await staffApi.removeSubjectFromStaff(staffMember.id, subjectId);
      }
      
      // Clear temporary subject changes
      setSubjectsToAdd([]);
      setSubjectsToRemove([]);
      
      // Invalidate queries to refetch
      await queryClient.invalidateQueries({ queryKey: staffKeys.detailFull(staffMember.id) });
      await queryClient.invalidateQueries({ queryKey: staffKeys.minimal({}) });
      
      // Reset edit mode
      setIsEditing(false);
      
      toast({
        title: 'Staff updated',
        description: 'Staff member has been updated successfully.',
      });
      
      // Notify parent of update
      onStaffUpdated();
    } catch (err) {
      toast({
        title: 'Update failed',
        description: 'There was an error updating the staff member. Please try again.',
        variant: 'destructive',
      });
    } finally {
      setLoadingStaffUpdate(false);
    }
  };

  // Delete staff handler
  const handleDelete = async () => {
    if (!staffMember) return;
    
    try {
      setIsDeleting(true);
      await staffApi.deleteStaff(staffMember.id);
      
      toast({
        title: 'Staff deleted',
        description: 'Staff member has been deleted successfully.',
      });
      
      // Close the modal and refresh the list
      onClose();
      onStaffUpdated();
    } catch (err) {
      toast({
        title: 'Delete failed',
        description: 'There was an error deleting the staff member. Please try again.',
        variant: 'destructive',
      });
    } finally {
      setIsDeleting(false);
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
      const { error } = await (getSupabaseClient() as SupabaseClient<Database>).auth.resetPasswordForEmail(
        staffMember.email,
        {
          redirectTo: `${baseUrl}/auth/callback`,
        }
      );
      
      if (error) throw error;
      
      setHasPasswordResetLinkSent(true);
      
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
    }
  };

  // Handle starting edit mode
  const handleStartEdit = () => {
    setTempStaffSubjects([...staffSubjects]);
    setSubjectsToAdd([]);
    setSubjectsToRemove([]);
    setIsEditing(true);
  };

  // Handle canceling edit mode
  const handleCancelEdit = () => {
    setTempStaffSubjects([]);
    setSubjectsToAdd([]);
    setSubjectsToRemove([]);
    setIsEditing(false);
  };

  // Handle subject assignment (in edit mode - temporary)
  const handleAssignSubject = (subjectId: string) => {
    const subject = allSubjects.find(s => s.id === subjectId);
    if (!subject) return;
    
    // Add to temporary subjects list
    setTempStaffSubjects(prev => [...prev, subject]);
    
    // Track as added (unless it was previously marked for removal)
    if (subjectsToRemove.includes(subjectId)) {
      setSubjectsToRemove(prev => prev.filter(id => id !== subjectId));
    } else {
      setSubjectsToAdd(prev => [...prev, subjectId]);
    }
  };

  // Handle subject removal (in edit mode - temporary)
  const handleRemoveSubject = (subjectId: string) => {
    // Remove from temporary subjects list
    setTempStaffSubjects(prev => prev.filter(s => s.id !== subjectId));
    
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

  // Always render the Sheet to allow exit animation
  return (
    <>
      <Sheet open={isOpen} onOpenChange={onClose}>
        <SheetContent className="w-full md:w-[600px] lg:w-[800px] md:max-w-none h-full max-h-[100vh] flex flex-col p-0">
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
                    <div className="flex-1">
                      <SheetTitle>
                        {isEditing ? 'Edit Staff Member' : 'Staff Member Details'}
                      </SheetTitle>
                      <SheetDescription className="text-lg font-medium">
                        {staffMember.first_name} {staffMember.last_name}
                      </SheetDescription>
                    </div>
                    {staffId && (
                      <UIButton
                        variant="ghost"
                        size="icon"
                        onClick={() => {
                          router.push(`/staff/${staffId}`);
                          onClose();
                        }}
                        className="shrink-0"
                        title="Open in new page"
                      >
                        <ExternalLink className="h-4 w-4" />
                      </UIButton>
                    )}
                  </div>
                </SheetHeader>
                <div className="px-6 pb-4">
                  <TabsList className="grid w-full grid-cols-5">
                    <TabsTrigger value="details">Details</TabsTrigger>
                    <TabsTrigger value="classes">Classes</TabsTrigger>
                    <TabsTrigger value="sessions">Sessions</TabsTrigger>
                    <TabsTrigger value="messages">Messages</TabsTrigger>
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
                      isEditing={isEditing}
                      isLoading={loadingStaffUpdate}
                      onEdit={handleStartEdit}
                      onCancelEdit={handleCancelEdit}
                      onSubmit={handleStaffUpdate}
                      onDelete={isEditing ? handleDelete : undefined}
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
                      isLoadingAccount={isLoading}
                      hasPasswordResetLinkSent={hasPasswordResetLinkSent}
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

                <TabsContent value="sessions" className="absolute inset-0 overflow-hidden m-0 hidden data-[state=active]:flex data-[state=active]:flex-col">
                  <div className="h-full p-6">
                    {staffMember && (
                      <StaffSessionsTab staff={staffMember} />
                    )}
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
          {staffMember && isEditing && activeTab === 'details' && (
            <div className="sticky bottom-0 left-0 right-0 p-6 border-t bg-background mt-auto shrink-0">
              <div className="flex w-full justify-end">
                <div className="flex space-x-2">
                  <UIButton variant="outline" type="button" onClick={handleCancelEdit} disabled={loadingStaffUpdate}>
                    Cancel
                  </UIButton>
                  <UIButton 
                    type="button"
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
              </div>
            </div>
          )}
        </SheetContent>
      </Sheet>

      {/* Subject Modal */}
      {selectedSubjectId && (
        <ViewSubjectModal
          isOpen={subjectModalOpen}
          onClose={() => {
            setSubjectModalOpen(false);
            setSelectedSubjectId(null);
          }}
          subjectId={selectedSubjectId}
          onSubjectUpdated={() => {
            if (staffId) {
              queryClient.invalidateQueries({ queryKey: staffKeys.detailFull(staffId) });
            }
          }}
        />
      )}
    </>
  );
} 