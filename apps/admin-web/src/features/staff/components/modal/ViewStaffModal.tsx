import { useState, useEffect } from 'react';
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription } from "@altitutor/ui";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@altitutor/ui";
import { useToast } from "@altitutor/ui";
import { Button as UIButton } from '@altitutor/ui';
import { staffApi } from "../../api";
import { subjectsApi } from '@/features/subjects/api';
import type { Tables, Database } from '@altitutor/shared';
import { getSupabaseClient } from "@/shared/lib/supabase/client";
import type { SupabaseClient } from '@supabase/supabase-js';
import { StaffDetailsTab, StaffDetailsFormData } from './tabs/StaffDetailsTab';
import { ClassesTab } from './tabs/ClassesTab';
import { AccountTab } from './tabs/AccountTab';
import { MessagesTabContent } from '@/features/messages/components/MessagesTabContent';
import { getExistingConversationForRelated } from '@/features/messages/api/queries';
import { SubjectSearchPopover, ViewSubjectModal } from '@/features/subjects/components';

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
  // State
  const [staffMember, setStaffMember] = useState<Tables<'staff'> | null>(null);
  const [staffSubjects, setStaffSubjects] = useState<Tables<'subjects'>[]>([]);
  const [allSubjects, setAllSubjects] = useState<Tables<'subjects'>[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [loadingSubjects, setLoadingSubjects] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [hasPasswordResetLinkSent, setHasPasswordResetLinkSent] = useState(false);
  const [activeTab, setActiveTab] = useState('details');
  const [baseUrl, setBaseUrl] = useState('');
  const [conversationId, setConversationId] = useState<string | null>(null);
  
  // Subject modal state
  const [selectedSubjectId, setSelectedSubjectId] = useState<string | null>(null);
  const [subjectModalOpen, setSubjectModalOpen] = useState(false);
  
  // Temporary subjects state for editing (not saved until form submit)
  const [tempStaffSubjects, setTempStaffSubjects] = useState<Tables<'subjects'>[]>([]);
  const [subjectsToAdd, setSubjectsToAdd] = useState<string[]>([]);
  const [subjectsToRemove, setSubjectsToRemove] = useState<string[]>([]);
  
  const { toast } = useToast();

  // Set base URL for password reset
  useEffect(() => {
    setBaseUrl(window.location.origin);
  }, []);

  // Fetch staff data
  useEffect(() => {
    if (isOpen && staffId) {
      fetchStaffMember();
      fetchAllSubjects();
    } else {
      // Reset state when closing
      setStaffMember(null);
      setStaffSubjects([]);
      setAllSubjects([]);
      setIsEditing(false);
      setHasPasswordResetLinkSent(false);
      setActiveTab('details');
    }
  }, [isOpen, staffId]);

  // Fetch staff member data
  const fetchStaffMember = async () => {
    if (!staffId) return;
    
    try {
      setIsLoading(true);
      
      // Use the optimized method that gets both staff and subjects efficiently
      const { staff: staffData, subjects: subjectsData } = await staffApi.getStaffWithSubjects(staffId);
      setStaffMember(staffData || null);
      setStaffSubjects(subjectsData as Tables<'subjects'>[]);
      
      // Get existing conversation ID for messages tab (don't create new one)
      const convId = await getExistingConversationForRelated(staffId, 'staff');
      console.log('[ViewStaffModal] Existing conversation ID for staff', staffId, ':', convId);
      setConversationId(convId);
    } catch (err) {
      console.error('Failed to fetch staff:', err);
      toast({
        title: 'Error',
        description: 'Failed to load staff member details.',
        variant: 'destructive',
      });
    } finally {
      setIsLoading(false);
    }
  };

  // Fetch staff subjects
  const fetchStaffSubjects = async (id: string) => {
    try {
      setLoadingSubjects(true);
      const subjects = await staffApi.getStaffSubjects(id);
      setStaffSubjects((subjects as any) as Tables<'subjects'>[]);
    } catch (err) {
      console.error('Failed to fetch staff subjects:', err);
      toast({
        title: 'Error',
        description: 'Failed to load staff subjects.',
        variant: 'destructive',
      });
    } finally {
      setLoadingSubjects(false);
    }
  };

  // Fetch all subjects for assignment
  const fetchAllSubjects = async () => {
    try {
      const subjects = await subjectsApi.getAllSubjects();
      setAllSubjects((subjects as any) as Tables<'subjects'>[]);
    } catch (err) {
      console.error('Failed to fetch subjects:', err);
    }
  };

  // Update staff handler
  const handleStaffUpdate = async (data: StaffDetailsFormData) => {
    if (!staffMember) return;
    
    try {
      setIsLoading(true);
      
      // Map form data to staff update
      await staffApi.updateStaff(staffMember.id, {
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
        availability_sunday_pm: data.availability_sunday_pm
      });
      
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
      
      // Refetch staff
      await fetchStaffMember();
      
      // Reset edit mode
      setIsEditing(false);
      
      // Notify parent of update
      onStaffUpdated();
      
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
      setIsLoading(false);
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
      setIsLoading(true);
      
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
      console.error('Password reset error:', err);
      toast({
        title: 'Password reset failed',
        description: 'There was an error resetting the password. Please try again.',
        variant: 'destructive',
      });
    } finally {
      setIsLoading(false);
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
        <SheetContent className="w-[600px] sm:w-[800px] sm:max-w-none h-full flex flex-col p-0">
          {!staffMember ? (
            <div className="flex justify-center items-center h-full">
              <div className="text-muted-foreground">
                {isLoading ? 'Loading...' : ''}
              </div>
            </div>
          ) : (
            <>
              <SheetHeader className="flex-shrink-0 px-6 pt-6 pb-4">
                <SheetTitle>
                  Staff Member Details
                </SheetTitle>
                <SheetDescription className="text-lg font-medium">
                  {staffMember.first_name} {staffMember.last_name}
                </SheetDescription>
              </SheetHeader>
          
              <div className="flex-1 overflow-hidden flex flex-col px-6 pb-6">
                <Tabs 
                  defaultValue="details" 
                  value={activeTab} 
                  onValueChange={setActiveTab}
                  className="flex flex-col h-full"
                >
                  <TabsList className="grid w-full grid-cols-4 flex-shrink-0">
                    <TabsTrigger value="details">Details</TabsTrigger>
                    <TabsTrigger value="classes">Classes</TabsTrigger>
                    <TabsTrigger value="account">Account</TabsTrigger>
                    <TabsTrigger value="messages">Messages</TabsTrigger>
                  </TabsList>
                
                  <div className="flex-1 overflow-hidden mt-4">
                  <TabsContent value="details" className="h-full overflow-hidden m-0 data-[state=active]:flex data-[state=active]:flex-col">
                    <StaffDetailsTab
                      staffMember={staffMember}
                      isEditing={isEditing}
                      isLoading={isLoading}
                      onEdit={handleStartEdit}
                      onCancelEdit={handleCancelEdit}
                      onSubmit={handleStaffUpdate}
                      staffSubjects={isEditing ? tempStaffSubjects : staffSubjects}
                      loadingSubjects={loadingSubjects}
                      onRemoveSubject={handleRemoveSubject}
                      onViewSubject={handleViewSubject}
                      addSubjectButton={
                        <SubjectSearchPopover
                          allSubjects={allSubjects}
                          selectedSubjects={isEditing ? tempStaffSubjects : staffSubjects}
                          onSelectSubject={(subject) => handleAssignSubject(subject.id)}
                        />
                      }
                    />
                  </TabsContent>
                    
                    <TabsContent value="classes" className="h-full overflow-y-auto m-0 data-[state=active]:flex data-[state=active]:flex-col">
                      <ClassesTab
                        staff={staffMember}
                        onStaffUpdated={onStaffUpdated}
                      />
                    </TabsContent>
                    
                    <TabsContent value="account" className="h-full overflow-y-auto m-0 data-[state=active]:flex data-[state=active]:flex-col">
                      <AccountTab
                        staffMember={staffMember}
                        isLoading={isLoading}
                        hasPasswordResetLinkSent={hasPasswordResetLinkSent}
                        onPasswordResetRequest={handlePasswordResetRequest}
                        onDelete={handleDelete}
                        isDeleting={isDeleting}
                      />
                    </TabsContent>

                    <TabsContent value="messages" className="h-full overflow-hidden m-0 data-[state=active]:flex data-[state=active]:flex-col">
                      <MessagesTabContent 
                        conversationId={conversationId}
                        title={`${staffMember.first_name} ${staffMember.last_name}`}
                        onClose={onClose}
                        relatedId={staffId || undefined}
                        relatedType="staff"
                      />
                    </TabsContent>
                  </div>
                </Tabs>
              </div>
            </>
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
            fetchStaffMember();
          }}
        />
      )}
    </>
  );
} 