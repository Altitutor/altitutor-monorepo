import { useState, useEffect } from 'react';
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription } from "@altitutor/ui";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@altitutor/ui";
import { useToast } from "@altitutor/ui";
import { Button } from "@altitutor/ui";
import { Loader2, X } from "lucide-react";
import { useRouter } from "next/navigation";
import { ActionsMenu } from '@/shared/components/ActionsMenu';
import { useAdminShiftActions } from '../../hooks/useAdminShiftActions';
import { useQueryClient } from '@tanstack/react-query';
import { adminShiftsApi } from "../../api";
import { useAdminShiftDetails, adminShiftsKeys, useDeleteAdminShift } from '../../hooks/useAdminShiftsQuery';
import { useStaff } from '@/features/staff/hooks/useStaffQuery';
import { useUpdateAdminShift } from '../../hooks/useAdminShiftsQuery';
import { useCurrentStaff } from '@/features/staff/hooks/useStaffQuery';
import type { TablesUpdate } from '@altitutor/shared';
import { AdminShiftInfoTab, AdminShiftInfoFormData } from './tabs/AdminShiftInfoTab';
import { AdminShiftStaffTab } from './tabs/AdminShiftStaffTab';
import { AdminShiftSessionsTab } from './tabs/AdminShiftSessionsTab';
import { AdminShiftActivityTab } from './tabs/AdminShiftActivityTab';
import { formatTime, getDayOfWeek } from '@/shared/utils/datetime';
import { SessionModal } from '@/features/sessions/components/SessionModal';
import { ViewStaffModal } from '@/features/staff/components/modal/ViewStaffModal';
import { ViewStudentModal } from '@/features/students/components/ViewStudentModal';
import { useNestedModalEvents } from '@/shared/hooks/useNestedModalEvents';

interface ViewAdminShiftModalProps {
  isOpen: boolean;
  adminShiftId: string | null;
  onClose: () => void;
  onAdminShiftUpdated: () => void;
}

export function ViewAdminShiftModal({ 
  isOpen, 
  adminShiftId, 
  onClose, 
  onAdminShiftUpdated 
}: ViewAdminShiftModalProps) {
  const router = useRouter();
  // Use React Query hooks for data fetching
  const { data: adminShiftDetails, isLoading } = useAdminShiftDetails(adminShiftId || '', isOpen && !!adminShiftId);
  const { data: allStaffData = [] } = useStaff();
  const updateAdminShiftMutation = useUpdateAdminShift();
  
  // Extract data from adminShiftDetails
  const adminShiftData = adminShiftDetails?.adminShift || null;
  const adminShiftStaff = adminShiftDetails?.staff || [];
  const adminShiftSessions = adminShiftDetails?.sessions || [];
  const staffToAdminShiftStaffId = adminShiftDetails?.staffToAdminShiftStaffId || {};
  
  const [isEditing, setIsEditing] = useState(false);
  const [activeTab, setActiveTab] = useState('details');
  const [isDeleting, setIsDeleting] = useState(false);
  
  // Nested modal state for sessions table interactions
  const {
    nestedSessionId,
    nestedStaffId,
    nestedStudentId,
    setNestedSessionId,
    setNestedStaffId,
    setNestedStudentId,
  } = useNestedModalEvents({ isOpen });
  
  const { toast } = useToast();
  const { data: currentStaff } = useCurrentStaff();
  const queryClient = useQueryClient();
  const deleteAdminShiftMutation = useDeleteAdminShift();

  // Centralized action handlers
  const adminShiftActions = useAdminShiftActions({
    adminShiftId: adminShiftId || '',
    onOpenInPage: () => {
      router.push(`/admin-shifts/${adminShiftId}`);
      onClose();
    },
  });

  // Reset states when modal closes
  useEffect(() => {
    if (!isOpen) {
      setIsEditing(false);
      setActiveTab('details');
    }
  }, [isOpen]);

  // Update admin shift handler
  const handleAdminShiftUpdate = async (data: AdminShiftInfoFormData) => {
    if (!adminShiftData) return;
    
    try {
      const updateData: TablesUpdate<'admin_shifts'> = {
        day_of_week: data.dayOfWeek,
        start_time: data.startTime,
        end_time: data.endTime,
        status: data.status,
        session_start_date: data.sessionStartDate || null,
        session_end_date: data.sessionEndDate || null,
      };
      await updateAdminShiftMutation.mutateAsync({ id: adminShiftData.id, data: updateData });
      
      // Invalidate admin shift details to refetch full data
      queryClient.invalidateQueries({ queryKey: adminShiftsKeys.detailFull(adminShiftData.id) });
      
      // Reset edit mode
      setIsEditing(false);
      
      // Notify parent of update
      onAdminShiftUpdated();
      
      toast({
        title: 'Admin shift updated',
        description: 'Admin shift has been updated successfully.',
      });
    } catch (err) {
      console.error('Failed to update admin shift:', err);
      toast({
        title: 'Update failed',
        description: 'There was an error updating the admin shift. Please try again.',
        variant: 'destructive',
      });
    }
  };

  // Handle staff assignment
  const handleAssignStaff = async (staffId: string) => {
    if (!adminShiftData || !currentStaff?.id) return;
    
    try {
      await adminShiftsApi.assignStaff(adminShiftData.id, staffId, currentStaff.id);
      // Invalidate and refetch admin shift details immediately
      await queryClient.invalidateQueries({ queryKey: adminShiftsKeys.detailFull(adminShiftData.id) });
      await queryClient.refetchQueries({ queryKey: adminShiftsKeys.detailFull(adminShiftData.id) });
      queryClient.invalidateQueries({ queryKey: adminShiftsKeys.minimal() });
      onAdminShiftUpdated();
      toast({
        title: 'Success',
        description: 'Staff assigned successfully.',
      });
    } catch (err) {
      console.error('Failed to assign staff:', err);
      toast({
        title: 'Assignment failed',
        description: 'There was an error assigning the staff. Please try again.',
        variant: 'destructive',
      });
      throw err;
    }
  };

  // Handle staff removal
  const handleRemoveStaff = async (adminShiftStaffId: string) => {
    if (!adminShiftData) return;
    
    try {
      await adminShiftsApi.unassignStaff(adminShiftStaffId);
      // Invalidate and refetch admin shift details immediately
      await queryClient.invalidateQueries({ queryKey: adminShiftsKeys.detailFull(adminShiftData.id) });
      await queryClient.refetchQueries({ queryKey: adminShiftsKeys.detailFull(adminShiftData.id) });
      queryClient.invalidateQueries({ queryKey: adminShiftsKeys.minimal() });
      onAdminShiftUpdated();
      toast({
        title: 'Success',
        description: 'Staff removed successfully.',
      });
    } catch (err) {
      console.error('Failed to remove staff:', err);
      toast({
        title: 'Removal failed',
        description: 'There was an error removing the staff. Please try again.',
        variant: 'destructive',
      });
      throw err;
    }
  };

  // Handle admin shift deletion
  const handleDeleteAdminShift = async () => {
    if (!adminShiftData) return;
    
    try {
      setIsDeleting(true);
      await deleteAdminShiftMutation.mutateAsync(adminShiftData.id);
      onClose();
      onAdminShiftUpdated();
      toast({
        title: 'Admin shift deleted',
        description: 'Admin shift has been deleted successfully.',
      });
    } catch (err) {
      console.error('Failed to delete admin shift:', err);
      toast({
        title: 'Delete failed',
        description: 'There was an error deleting the admin shift. Please try again.',
        variant: 'destructive',
      });
    } finally {
      setIsDeleting(false);
    }
  };

  // Format admin shift display name
  const formatAdminShiftName = () => {
    if (!adminShiftData) return '';
    return `${getDayOfWeek(adminShiftData.day_of_week)} ${formatTime(adminShiftData.start_time)} - ${formatTime(adminShiftData.end_time)}`;
  };

  // Early return if no admin shift data loaded
  if (!adminShiftData) {
    return (
      <>
        <Sheet open={isOpen} onOpenChange={onClose}>
          <SheetContent className="w-full md:w-[600px] md:max-w-none">
            <SheetHeader>
              <SheetTitle>Loading admin shift...</SheetTitle>
            </SheetHeader>
          </SheetContent>
        </Sheet>

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
            onStaffUpdated={onAdminShiftUpdated}
          />
        )}

        {/* Nested Student Modal */}
        {nestedStudentId && (
          <ViewStudentModal
            isOpen={!!nestedStudentId}
            studentId={nestedStudentId}
            onClose={() => setNestedStudentId(null)}
            onStudentUpdated={onAdminShiftUpdated}
          />
        )}
      </>
    );
  }

  return (
    <>
    <Sheet open={isOpen} onOpenChange={onClose}>
      <SheetContent hideCloseButton className="h-full max-h-[100vh] flex flex-col p-0 w-full md:w-[600px] lg:w-[800px] md:max-w-none">
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
                      {isEditing ? 'Edit Admin Shift' : 'Admin Shift Details'}
                    </SheetTitle>
                    <SheetDescription className="text-lg font-medium">
                      {formatAdminShiftName()}
                    </SheetDescription>
                  </div>
                </div>
                {adminShiftId && (
                  <ActionsMenu
                    type="adminShift"
                    {...adminShiftActions}
                  />
                )}
              </div>
            </SheetHeader>
            <div className="px-6 pb-4">
              <TabsList className="w-full">
                <TabsTrigger value="details" className="flex-1">Details</TabsTrigger>
                <TabsTrigger value="staff" className="flex-1">Staff</TabsTrigger>
                <TabsTrigger value="sessions" className="flex-1">Sessions</TabsTrigger>
                <TabsTrigger value="activity" className="flex-1">Activity</TabsTrigger>
              </TabsList>
            </div>
          </div>

          {/* Scrollable Content */}
          <div className="flex-1 min-h-0 relative">
            <TabsContent value="details" className="absolute inset-0 overflow-y-auto m-0 hidden data-[state=active]:block">
              <div className="p-6">
                <AdminShiftInfoTab
                  adminShiftData={adminShiftData}
                  isEditing={isEditing}
                  isLoading={isLoading}
                  onEdit={() => setIsEditing(true)}
                  onCancelEdit={() => setIsEditing(false)}
                  onSubmit={handleAdminShiftUpdate}
                  onDelete={isEditing ? handleDeleteAdminShift : undefined}
                  isDeleting={isDeleting}
                />
              </div>
            </TabsContent>
        
            <TabsContent value="staff" className="absolute inset-0 overflow-y-auto m-0 hidden data-[state=active]:block">
              <div className="p-6">
                <AdminShiftStaffTab
                  adminShiftData={adminShiftData}
                  adminShiftStaff={adminShiftStaff}
                  allStaff={allStaffData}
                  loadingStaff={false}
                  staffToAdminShiftStaffId={staffToAdminShiftStaffId}
                  onAssignStaff={handleAssignStaff}
                  onRemoveStaff={handleRemoveStaff}
                />
              </div>
            </TabsContent>
        
            <TabsContent value="sessions" className="absolute inset-0 overflow-hidden m-0 hidden data-[state=active]:flex data-[state=active]:flex-col">
              <div className="h-full p-6">
                <AdminShiftSessionsTab
                  adminShiftData={adminShiftData}
                  adminShiftStaff={adminShiftStaff}
                  adminShiftSessions={adminShiftSessions}
                />
              </div>
            </TabsContent>

            <TabsContent value="activity" className="absolute inset-0 overflow-y-auto m-0 hidden data-[state=active]:block">
              <div className="p-6">
                {adminShiftId && (
                  <AdminShiftActivityTab adminShiftId={adminShiftId} isOpen={isOpen} />
                )}
              </div>
            </TabsContent>
          </div>
        </Tabs>
        
        {/* Sticky Footer with Buttons */}
        {adminShiftData && isEditing && activeTab === 'details' && (
          <div className="sticky bottom-0 left-0 right-0 p-6 border-t bg-background mt-auto shrink-0">
            <div className="flex w-full justify-end">
              <div className="flex space-x-2">
                <Button variant="outline" type="button" onClick={() => setIsEditing(false)} disabled={isLoading}>
                  Cancel
                </Button>
                <Button 
                  type="button"
                  disabled={isLoading}
                  onClick={() => {
                    const form = document.getElementById('admin-shift-edit-form') as HTMLFormElement;
                    if (form) {
                      form.requestSubmit();
                    }
                  }}
                >
                  {isLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                  Save Changes
                </Button>
              </div>
            </div>
          </div>
        )}
      </SheetContent>
    </Sheet>

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
        onStaffUpdated={onAdminShiftUpdated}
      />
    )}

    {/* Nested Student Modal */}
    {nestedStudentId && (
      <ViewStudentModal
        isOpen={!!nestedStudentId}
        studentId={nestedStudentId}
        onClose={() => setNestedStudentId(null)}
        onStudentUpdated={onAdminShiftUpdated}
      />
    )}
  </>
  );
}
