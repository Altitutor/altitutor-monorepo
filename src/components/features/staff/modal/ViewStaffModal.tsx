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
import { AccountTab, AccountFormData } from './tabs/AccountTab';
import { DeleteConfirmationDialog } from './DeleteConfirmationDialog';
import { useRouter } from "next/navigation";

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
  const router = useRouter();

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
      
      // Fetch staff details - fix method name from getStaffById to getStaff
      const staff = await staffApi.getStaff(staffId);
      setStaffMember(staff || null);
      
      // Fetch staff subjects
      if (staff) {
        await fetchStaffSubjects(staffId);
      }
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
        officeKeyNumber: data.officeKeyNumber === '' || data.officeKeyNumber === undefined ? null : data.officeKeyNumber,
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
    if (!staffMember) return;
    
    try {
      setIsLoading(true);
      
      const { error } = await supabaseServer.auth.resetPasswordForEmail(
        staffMember.email,
        {
          redirectTo: `${baseUrl}/reset-password`,
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

  // Subject handlers
  const handleAssignSubject = async (subjectId: string) => {
    if (!staffMember) return;
    
    try {
      setLoadingSubjects(true);
      await staffApi.assignSubjectToStaff(staffMember.id, subjectId);
      
      // Refetch subjects
      await fetchStaffSubjects(staffMember.id);
      
      toast({
        title: 'Subject assigned',
        description: 'Subject has been assigned to staff member.',
      });
    } catch (err) {
      console.error('Failed to assign subject:', err);
      toast({
        title: 'Assignment failed',
        description: 'There was an error assigning the subject. Please try again.',
        variant: 'destructive',
      });
    } finally {
      setLoadingSubjects(false);
    }
  };

  const handleRemoveSubject = async (subjectId: string) => {
    if (!staffMember) return;
    
    try {
      setLoadingSubjects(true);
      await staffApi.removeSubjectFromStaff(staffMember.id, subjectId);
      
      // Refetch subjects
      await fetchStaffSubjects(staffMember.id);
      
      toast({
        title: 'Subject removed',
        description: 'Subject has been removed from staff member.',
      });
    } catch (err) {
      console.error('Failed to remove subject:', err);
      toast({
        title: 'Removal failed',
        description: 'There was an error removing the subject. Please try again.',
        variant: 'destructive',
      });
    } finally {
      setLoadingSubjects(false);
    }
  };

  const handleViewSubject = (subjectId: string) => {
    // Close the current staff modal
    onClose();
    // Navigate to the subjects page with the subject ID as a view parameter
    router.push(`/dashboard/subjects?view=${subjectId}`);
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
                onViewSubject={handleViewSubject}
                onAssignSubject={handleAssignSubject}
                onRemoveSubject={handleRemoveSubject}
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