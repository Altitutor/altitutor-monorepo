import { useState, useCallback } from 'react';
import type { Tables } from '@altitutor/shared';
import { Button } from "@altitutor/ui";
import { Input } from "@altitutor/ui";
import { ScrollArea } from "@altitutor/ui";
import { Popover, PopoverContent, PopoverTrigger } from "@altitutor/ui";
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
  const [searchQuery, setSearchQuery] = useState('');
  
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
      setSearchQuery('');
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

  // Filter staff by search query
  const filteredAvailableStaff = availableStaff.filter(staff => {
    if (!searchQuery.trim()) return true;
    const query = searchQuery.toLowerCase();
    const fullName = `${staff.first_name} ${staff.last_name}`.toLowerCase();
    return fullName.includes(query);
  });

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-semibold">Staff Assignments</h3>
        <Popover open={isAddPopoverOpen} onOpenChange={setIsAddPopoverOpen}>
          <PopoverTrigger asChild>
            <Button size="sm" variant="outline">
              <Plus className="h-4 w-4 mr-2" />
              Assign Staff
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-80" align="end">
            <div className="space-y-2">
              <Input
                placeholder="Search staff..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="mb-2"
              />
              <ScrollArea className="h-[300px]">
                {filteredAvailableStaff.length === 0 ? (
                  <div className="text-sm text-muted-foreground text-center py-4">
                    {searchQuery ? 'No staff found' : 'All staff are already assigned'}
                  </div>
                ) : (
                  <div className="space-y-1">
                    {filteredAvailableStaff.map((staff) => (
                      <Button
                        key={staff.id}
                        variant="ghost"
                        className="w-full justify-start"
                        onClick={() => handleAssignStaffFromPopover(staff.id)}
                        disabled={assigningStaff.has(staff.id)}
                      >
                        {assigningStaff.has(staff.id) ? (
                          <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                        ) : (
                          <UserCheck className="h-4 w-4 mr-2" />
                        )}
                        {staff.first_name} {staff.last_name}
                      </Button>
                    ))}
                  </div>
                )}
              </ScrollArea>
            </div>
          </PopoverContent>
        </Popover>
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
