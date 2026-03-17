import { useState, useCallback } from 'react';
import type { Tables } from '@altitutor/shared';
import { Button, SearchableSelect } from "@altitutor/ui";
import { Loader2, UserCheck, Plus } from "lucide-react";
import { ViewStaffModal } from '@/features/staff';
import { StaffCard } from '@/shared/components/StaffCard';
import { useToast } from "@altitutor/ui";

interface AdminShiftStaffTabProps {
  adminShiftData: Tables<'admin_shifts'>;
  adminShiftStaff: Tables<'staff'>[];
  allStaff: Tables<'staff'>[];
  loadingStaff: boolean;
  staffToAdminShiftStaffId?: Record<string, string>;
  onAssignStaff: (staffId: string) => void;
  onRemoveStaff: (adminShiftStaffId: string) => void;
}

export function AdminShiftStaffTab({
  adminShiftData: _adminShiftData,
  adminShiftStaff,
  allStaff,
  loadingStaff,
  staffToAdminShiftStaffId = {},
  onAssignStaff,
  onRemoveStaff
}: AdminShiftStaffTabProps) {
  const { toast } = useToast();
  const [assigningStaff, setAssigningStaff] = useState<Set<string>>(new Set());
  const [isAddPopoverOpen, setIsAddPopoverOpen] = useState(false);
  
  // Modal state for staff viewing
  const [selectedStaffId, setSelectedStaffId] = useState<string | null>(null);
  const [isStaffModalOpen, setIsStaffModalOpen] = useState(false);

  // Use staffToAdminShiftStaffId from props (fetched by API)
  const adminShiftStaffIds = staffToAdminShiftStaffId;

  const handleViewStaff = (staffId: string) => {
    setSelectedStaffId(staffId);
    setIsStaffModalOpen(true);
  };

  // Handle assignment
  const handleAssignStaffFromPopover = useCallback(async (staffId: string) => {
    if (assigningStaff.has(staffId)) return;
    
    try {
      setAssigningStaff(prev => new Set(prev).add(staffId));
      await onAssignStaff(staffId);
      setIsAddPopoverOpen(false);
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
    } finally {
      setAssigningStaff(prev => {
        const next = new Set(prev);
        next.delete(staffId);
        return next;
      });
    }
  }, [assigningStaff, onAssignStaff, toast]);

  // Handle removal
  const handleRemoveStaff = useCallback(async (staffId: string) => {
    const adminShiftStaffId = adminShiftStaffIds[staffId];
    if (!adminShiftStaffId) {
      toast({
        title: 'Error',
        description: 'Could not find staff assignment record.',
        variant: 'destructive',
      });
      return;
    }
    
    try {
      await onRemoveStaff(adminShiftStaffId);
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
    }
  }, [adminShiftStaffIds, onRemoveStaff, toast]);

  // Filter available staff (not already assigned and only ADMINSTAFF role)
  const availableStaff = allStaff.filter(
    staff => staff.role === 'ADMINSTAFF' && !adminShiftStaff.some(assigned => assigned.id === staff.id)
  );

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-semibold">Staff Assignments</h3>
        <SearchableSelect<Tables<'staff'>>
          items={availableStaff}
          value={null}
          onValueChange={(staff) => staff && handleAssignStaffFromPopover(staff.id)}
          getItemLabel={(s) => `${s.first_name} ${s.last_name}`}
          getItemId={(s) => s.id}
          getItemValue={(s) => `${s.first_name} ${s.last_name}`}
          placeholder="Assign Staff"
          searchPlaceholder="Search staff..."
          emptyMessage={
            availableStaff.length === 0
              ? 'All staff are already assigned'
              : 'No staff found'
          }
          trigger={
            <Button size="sm" variant="outline">
              <Plus className="h-4 w-4 mr-2" />
              Assign Staff
            </Button>
          }
          open={isAddPopoverOpen}
          onOpenChange={setIsAddPopoverOpen}
          getItemDisabled={(s) => assigningStaff.has(s.id)}
          renderItem={(staff) => (
            <>
              {assigningStaff.has(staff.id) ? (
                <Loader2 className="h-4 w-4 flex-shrink-0 animate-spin" />
              ) : (
                <UserCheck className="h-4 w-4 flex-shrink-0" />
              )}
              <span className={assigningStaff.has(staff.id) ? 'text-muted-foreground' : ''}>
                {staff.first_name} {staff.last_name}
              </span>
            </>
          )}
          align="end"
          contentWidth="320px"
        />
      </div>

      {loadingStaff ? (
        <div className="flex items-center justify-center py-8">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </div>
      ) : adminShiftStaff.length === 0 ? (
        <div className="text-center py-8 text-muted-foreground">
          No staff assigned to this admin shift
        </div>
      ) : (
        <div className="grid gap-4">
          {adminShiftStaff.map((staff) => (
            <StaffCard
              key={staff.id}
              staff={staff}
              onClick={() => handleViewStaff(staff.id)}
              onRemoveStaff={() => handleRemoveStaff(staff.id)}
              showActions={true}
            />
          ))}
        </div>
      )}

      {/* Staff Modal */}
      {selectedStaffId && (
        <ViewStaffModal
          staffId={selectedStaffId}
          isOpen={isStaffModalOpen}
          onClose={() => {
            setIsStaffModalOpen(false);
            setSelectedStaffId(null);
          }}
          onStaffUpdated={() => {
            // Refresh admin shift data
            window.location.reload();
          }}
        />
      )}
    </div>
  );
}
