import { useState } from 'react';
import type { Tables } from '@altitutor/shared';
import { Button, SearchableSelect, ScrollArea, StaffRoleBadge, StaffStatusBadge } from "@altitutor/ui";
import { Loader2, UserCheck, Plus, X, Search } from "lucide-react";
import { cn } from "@/shared/utils";
// import { ViewStaffModal } from '@/features/staff'; // Tutors can't view other staff - removed

interface ClassStaffTabProps {
  classStaff: Tables<'staff'>[];
  allStaff: Tables<'staff'>[];
  loadingStaff: boolean;
  onAssignStaff: (staffId: string) => void;
  onRemoveStaff: (staffId: string) => void;
}

export function ClassStaffTab({
  classStaff,
  allStaff,
  loadingStaff,
  onAssignStaff,
  onRemoveStaff
}: ClassStaffTabProps) {
  const [assigningStaff, setAssigningStaff] = useState<Set<string>>(new Set());
  const [removingStaff, setRemovingStaff] = useState<Set<string>>(new Set());

  const handleViewStaff = (_staffId: string) => {
    // View staff functionality removed for tutors
  };

  const handleAssignStaff = async (staffId: string) => {
    setAssigningStaff(prev => new Set(prev).add(staffId));

    try {
      await onAssignStaff(staffId);
    } finally {
      setAssigningStaff(prev => {
        const newSet = new Set(prev);
        newSet.delete(staffId);
        return newSet;
      });
    }
  };

  const handleRemoveStaff = async (staffId: string) => {
    setRemovingStaff(prev => new Set(prev).add(staffId));

    try {
      await onRemoveStaff(staffId);
    } finally {
      setRemovingStaff(prev => {
        const newSet = new Set(prev);
        newSet.delete(staffId);
        return newSet;
      });
    }
  };

  const availableStaff = allStaff.filter(staff =>
    !classStaff.some(classStaffMember => classStaffMember.id === staff.id)
  );

  const getStaffLabel = (staff: Tables<'staff'>) => `${staff.first_name} ${staff.last_name}`;

  const addStaffTrigger = (
    <Button variant="outline" size="sm" className="ml-auto flex items-center gap-2">
      <Plus className="h-4 w-4" />
      <span>Add Staff</span>
    </Button>
  );

  const assignStaffTrigger = (
    <Button variant="outline">
      <Plus className="h-4 w-4 mr-2" />
      Assign staff
    </Button>
  );

  const staffSelectProps = {
    items: availableStaff,
    value: null as Tables<'staff'> | null,
    onValueChange: (staff: Tables<'staff'> | null) => staff && handleAssignStaff(staff.id),
    getItemId: (s: Tables<'staff'>) => s.id,
    getItemLabel: getStaffLabel,
    getItemValue: (s: Tables<'staff'>) =>
      `${s.first_name} ${s.last_name} ${s.email ?? ''}`.toLowerCase(),
    searchPlaceholder: "Search staff...",
    emptyMessage: "No available staff found",
    contentWidth: "300px",
    getItemDisabled: (s: Tables<'staff'>) => assigningStaff.has(s.id),
    renderItem: (staff: Tables<'staff'>) => (
      <div className="flex items-center justify-between w-full">
        <div className="flex flex-col items-start">
          <div className="font-medium">{getStaffLabel(staff)}</div>
          <div className="flex items-center gap-2 mt-1">
            <StaffRoleBadge value={staff.role as 'ADMIN' | 'TUTOR' | 'ADMINSTAFF' | null} />
            <StaffStatusBadge value={staff.status as 'ACTIVE' | 'INACTIVE' | 'TRIAL' | null} />
          </div>
          {staff.email && (
            <div className="text-xs text-muted-foreground mt-1">{staff.email}</div>
          )}
        </div>
        {assigningStaff.has(staff.id) && (
          <Loader2 className="h-4 w-4 animate-spin flex-shrink-0" />
        )}
      </div>
    ),
  };

  return (
    <div className="flex-1 h-[calc(100dvh-300px)] flex flex-col space-y-4">
      <div className="flex items-center gap-2">
        <h3 className="text-base font-medium">Staff ({classStaff.length})</h3>

        {/* Show currently assigning staff */}
        {assigningStaff.size > 0 && (
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin" />
            <span>Assigning {assigningStaff.size} staff member{assigningStaff.size > 1 ? 's' : ''}...</span>
          </div>
        )}

        <SearchableSelect<Tables<'staff'>>
          {...staffSelectProps}
          trigger={addStaffTrigger}
          align="end"
        />
      </div>

      {loadingStaff ? (
        <div className="flex-1 flex justify-center items-center">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </div>
      ) : classStaff.length === 0 && assigningStaff.size === 0 ? (
        <div className="flex-1 flex flex-col justify-center items-center">
          <UserCheck className="h-12 w-12 text-muted-foreground mb-2" />
          <p className="text-sm text-muted-foreground mb-4">No staff assigned</p>
          <SearchableSelect<Tables<'staff'>>
            {...staffSelectProps}
            trigger={assignStaffTrigger}
            align="center"
            emptyMessage="No staff found"
          />
        </div>
      ) : (
        <ScrollArea className="flex-1">
          <div className="space-y-2">
            {/* Show currently assigning staff at the top */}
            {Array.from(assigningStaff).map(staffId => {
              const staff = allStaff.find(s => s.id === staffId);
              if (!staff) return null;
              
              return (
                <div 
                  key={`assigning-${staff.id}`}
                  className="flex items-center justify-between p-3 rounded-md border border-dashed bg-muted/50"
                >
                  <div className="flex-1">
                    <div className="font-medium text-muted-foreground">
                      {staff.first_name} {staff.last_name}
                    </div>
                    <div className="text-xs text-muted-foreground">Assigning...</div>
                  </div>
                  
                  <div className="flex space-x-1">
                    <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
                  </div>
                </div>
              );
            })}
            
            {/* Show assigned staff */}
            {classStaff
              .sort((a, b) => `${a.last_name} ${a.first_name}`.localeCompare(`${b.last_name} ${b.first_name}`))
              .map((staff) => (
              <div 
                key={staff.id} 
                className={cn(
                  "flex items-center justify-between p-3 rounded-md border",
                  removingStaff.has(staff.id) && "opacity-50"
                )}
              >
                <div className="flex-1">
                    <div className="font-medium">
                    {staff.first_name} {staff.last_name}
                  </div>
                  <div className="flex items-center gap-2 mt-1">
                    <StaffRoleBadge value={staff.role as 'ADMIN' | 'TUTOR' | 'ADMINSTAFF' | null} />
                    <StaffStatusBadge value={staff.status as 'ACTIVE' | 'INACTIVE' | 'TRIAL' | null} />
                  </div>
                  {staff.email && (
                    <div className="text-sm text-muted-foreground mt-1">{staff.email}</div>
                  )}
                </div>
                
                <div className="flex space-x-1">
                  <Button
                    variant="outline"
                    size="icon"
                    onClick={() => handleViewStaff(staff.id)}
                    title="View Staff"
                    disabled={removingStaff.has(staff.id)}
                  >
                    <Search className="h-4 w-4" />
                  </Button>
                  <Button
                    variant="outline"
                    size="icon"
                    onClick={() => handleRemoveStaff(staff.id)}
                    title="Remove Staff"
                    disabled={removingStaff.has(staff.id)}
                  >
                    {removingStaff.has(staff.id) ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <X className="h-4 w-4" />
                    )}
                  </Button>
                </div>
              </div>
            ))}
          </div>
        </ScrollArea>
      )}
      
      {/* Staff Modal */}
      {/* Staff Modal - removed for tutors */}
      {/* {selectedStaffId && (
        <ViewStaffModal
          staffId={selectedStaffId}
          isOpen={isStaffModalOpen}
          onClose={() => {
            setIsStaffModalOpen(false);
            setSelectedStaffId(null);
          }}
          onStaffUpdated={() => {
            // Refresh would be handled by parent component
            // since we don't have direct access to refresh function here
          }}
        />
      )} */}
    </div>
  );
} 