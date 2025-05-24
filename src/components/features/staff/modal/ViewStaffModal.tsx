import { useState, useEffect } from 'react';
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useToast } from "@/components/ui/use-toast";
import { staffApi } from "@/lib/supabase/api/staff";
import { subjectsApi } from "@/lib/supabase/api/subjects";
import { Staff, Subject } from "@/lib/supabase/db/types";
import { supabaseServer } from "@/lib/supabase/client";
import { StaffDetailsTab, StaffDetailsFormData } from './tabs/StaffDetailsTab';
import { SubjectsTab } from './tabs/SubjectsTab';
import { ClassesTab } from './tabs/ClassesTab';
import { AccountTab, AccountFormData } from './tabs/AccountTab';
import { DeleteConfirmationDialog } from './DeleteConfirmationDialog';

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
  const [staffMember, setStaffMember] = useState<Staff | null>(null);
  const [staffSubjects, setStaffSubjects] = useState<Subject[]>([]);
  const [allSubjects, setAllSubjects] = useState<Subject[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [loadingSubjects, setLoadingSubjects] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [isEditingAccount, setIsEditingAccount] = useState(false);
  const [hasPasswordResetLinkSent, setHasPasswordResetLinkSent] = useState(false);
  const [activeTab, setActiveTab] = useState('details');
  const [baseUrl, setBaseUrl] = useState('');
  
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
      setIsEditingAccount(false);
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
      setStaffSubjects(subjectsData);
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
      setStaffSubjects(subjects);
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
      setAllSubjects(subjects);
    } catch (err) {
      console.error('Failed to fetch subjects:', err);
    }
  };

  // Update staff handler
  const handleStaffUpdate = async (data: StaffDetailsFormData) => {
    if (!staffMember) return;
    
    try {
      setIsLoading(true);
      
      // Map form data to staff update - fix the updateStaff method to pass id and data separately
      await staffApi.updateStaff(staffMember.id, {
        firstName: data.firstName,
        lastName: data.lastName,
        // Email can be null or empty string
        email: data.email === '' ? null : data.email,
        phoneNumber: data.phoneNumber || null,
        role: data.role,
        status: data.status,
        // Handle office key properly
        officeKeyNumber: data.officeKeyNumber,
        hasParkingRemote: data.hasParkingRemote,
        availabilityMonday: data.availability_monday,
        availabilityTuesday: data.availability_tuesday,
        availabilityWednesday: data.availability_wednesday,
        availabilityThursday: data.availability_thursday,
        availabilityFriday: data.availability_friday,
        availabilitySaturdayAm: data.availability_saturday_am,
        availabilitySaturdayPm: data.availability_saturday_pm,
        availabilitySundayAm: data.availability_sunday_am,
        availabilitySundayPm: data.availability_sunday_pm
      });
      
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

  // Account update handler
  const handleAccountUpdate = async (data: AccountFormData) => {
    if (!staffMember) return;
    
    try {
      setIsLoading(true);
      
      // Update the user's account details
      // Since there's no updateStaffAccount method, we'll use the updateStaff method and supabaseServer directly
      await staffApi.updateStaff(staffMember.id, {
        firstName: data.firstName,
        lastName: data.lastName,
        role: data.role,
      });
      
      // Additionally update the user_metadata in auth
      if (staffMember.userId) {
        await supabaseServer.auth.admin.updateUserById(staffMember.userId, {
          user_metadata: {
            first_name: data.firstName,
            last_name: data.lastName,
            user_role: data.role,
          },
        });
      }
      
      // Refetch staff
      await fetchStaffMember();
      
      // Reset edit mode
      setIsEditingAccount(false);
      
      // Notify parent of update
      onStaffUpdated();
      
      toast({
        title: 'Account updated',
        description: 'Staff account has been updated successfully.',
      });
    } catch (err) {
      console.error('Failed to update account:', err);
      toast({
        title: 'Update failed',
        description: 'There was an error updating the account. Please try again.',
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
      
      const { error } = await supabaseServer.auth.resetPasswordForEmail(
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

  // Handle subject assignment
  const handleAssignSubject = async (subjectId: string) => {
    if (!staffMember) return;
    
    try {
      await staffApi.assignSubjectToStaff(staffMember.id, subjectId);
      await fetchStaffMember(); // Reload staff with updated subjects
      toast({
        title: 'Success',
        description: 'Subject assigned successfully.',
      });
    } catch (err) {
      console.error('Failed to assign subject:', err);
      toast({
        title: 'Assignment failed',
        description: 'There was an error assigning the subject. Please try again.',
        variant: 'destructive',
      });
    }
  };

  // Handle subject removal
  const handleRemoveSubject = async (subjectId: string) => {
    if (!staffMember) return;
    
    try {
      await staffApi.removeSubjectFromStaff(staffMember.id, subjectId);
      await fetchStaffMember(); // Reload staff with updated subjects
      toast({
        title: 'Success',
        description: 'Subject removed successfully.',
      });
    } catch (err) {
      console.error('Failed to remove subject:', err);
      toast({
        title: 'Removal failed',
        description: 'There was an error removing the subject. Please try again.',
        variant: 'destructive',
      });
    }
  };

  // Early return if no staff member loaded
  if (!staffMember) {
    return (
      <Sheet open={isOpen} onOpenChange={onClose}>
        <SheetContent>
          <SheetHeader>
            <SheetTitle>Loading staff member...</SheetTitle>
          </SheetHeader>
        </SheetContent>
      </Sheet>
    );
  }

  return (
    <Sheet open={isOpen} onOpenChange={onClose}>
      <SheetContent className="overflow-y-auto max-w-md">
        <SheetHeader>
          <SheetTitle>
            {staffMember.firstName} {staffMember.lastName}
          </SheetTitle>
        </SheetHeader>
        
        <div className="mt-6">
          <Tabs 
            defaultValue="details" 
            value={activeTab} 
            onValueChange={setActiveTab}
            className="w-full"
          >
            <TabsList className="w-full">
              <TabsTrigger value="details" className="flex-1">Details</TabsTrigger>
              <TabsTrigger value="subjects" className="flex-1">Subjects</TabsTrigger>
              <TabsTrigger value="classes" className="flex-1">Classes</TabsTrigger>
              <TabsTrigger value="account" className="flex-1">Account</TabsTrigger>
            </TabsList>
            
            <TabsContent value="details" className="mt-4">
              <StaffDetailsTab
                staffMember={staffMember}
                isEditing={isEditing}
                isLoading={isLoading}
                onEdit={() => setIsEditing(true)}
                onCancelEdit={() => setIsEditing(false)}
                onSubmit={handleStaffUpdate}
              />
            </TabsContent>
            
            <TabsContent value="subjects" className="mt-4">
              <SubjectsTab
                staffMember={staffMember}
                staffSubjects={staffSubjects}
                allSubjects={allSubjects}
                loadingSubjects={loadingSubjects}
                onAssignSubject={handleAssignSubject}
                onRemoveSubject={handleRemoveSubject}
              />
            </TabsContent>
            
            <TabsContent value="classes" className="mt-4">
              <ClassesTab
                staff={staffMember}
              />
            </TabsContent>
            
            <TabsContent value="account" className="mt-4">
              <AccountTab
                staffMember={staffMember}
                isLoading={isLoading}
                isEditingAccount={isEditingAccount}
                hasPasswordResetLinkSent={hasPasswordResetLinkSent}
                onEditAccount={() => setIsEditingAccount(true)}
                onCancelEditAccount={() => setIsEditingAccount(false)}
                onAccountUpdate={handleAccountUpdate}
                onPasswordResetRequest={handlePasswordResetRequest}
                onDelete={handleDelete}
                isDeleting={isDeleting}
              />
            </TabsContent>
          </Tabs>
        </div>
      </SheetContent>
    </Sheet>
  );
} 