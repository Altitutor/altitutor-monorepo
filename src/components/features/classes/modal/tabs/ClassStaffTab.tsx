import { useState } from 'react';
import { Class, Staff } from "@/lib/supabase/db/types";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Loader2, UserCheck, Plus, X, Search } from "lucide-react";
import { StaffRoleBadge, StaffStatusBadge } from "@/components/ui/enum-badge";
import { cn } from "@/lib/utils";
import { ViewStaffModal } from '@/components/features/staff/modal';

interface ClassStaffTabProps {
  classData: Class;
  classStaff: Staff[];
  allStaff: Staff[];
  loadingStaff: boolean;
  onViewStaff?: (staffId: string) => void;
  onAssignStaff: (staffId: string) => void;
  onRemoveStaff: (staffId: string) => void;
}

export function ClassStaffTab({
  classData,
  classStaff,
  allStaff,
  loadingStaff,
  onViewStaff,
  onAssignStaff,
  onRemoveStaff
}: ClassStaffTabProps) {
  const [assigningStaff, setAssigningStaff] = useState<Set<string>>(new Set());
  const [removingStaff, setRemovingStaff] = useState<Set<string>>(new Set());
  const [isAddPopoverOpen, setIsAddPopoverOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  
  // Modal state for staff viewing
  const [selectedStaffId, setSelectedStaffId] = useState<string | null>(null);
  const [isStaffModalOpen, setIsStaffModalOpen] = useState(false);

  const handleViewStaff = (staffId: string) => {
    setSelectedStaffId(staffId);
    setIsStaffModalOpen(true);
  };

  const handleAssignStaff = async (staffId: string) => {
    setAssigningStaff(prev => new Set(prev).add(staffId));
    setIsAddPopoverOpen(false); // Close the popover immediately for better UX
    
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

  const filteredAvailableStaff = availableStaff.filter(staff => {
    if (!searchQuery) return true;
    const query = searchQuery.toLowerCase();
    return (
      staff.firstName.toLowerCase().includes(query) ||
      staff.lastName.toLowerCase().includes(query) ||
      (staff.email && staff.email.toLowerCase().includes(query))
    );
  });

  return (
    <div className="flex-1 h-[calc(100vh-300px)] flex flex-col space-y-4">
      <div className="flex items-center gap-2">
        <h3 className="text-base font-medium">Staff ({classStaff.length})</h3>
        
        {/* Show currently assigning staff */}
        {assigningStaff.size > 0 && (
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin" />
            <span>Assigning {assigningStaff.size} staff member{assigningStaff.size > 1 ? 's' : ''}...</span>
          </div>
        )}
        
        <Popover open={isAddPopoverOpen} onOpenChange={setIsAddPopoverOpen}>
          <PopoverTrigger asChild>
            <Button variant="outline" size="sm" className="ml-auto flex items-center gap-2">
              <Plus className="h-4 w-4" />
              <span>Add Staff</span>
            </Button>
          </PopoverTrigger>
          <PopoverContent className="p-0 w-[300px]" align="end">
            <div className="p-3">
              <Input
                placeholder="Search staff..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="mb-3"
              />
              <ScrollArea className="max-h-[300px]">
                <div className="space-y-1">
                  {filteredAvailableStaff.length === 0 ? (
                    <div className="p-3 text-center text-sm text-muted-foreground">
                      {searchQuery ? 'No staff match your search' : 'No available staff found'}
                    </div>
                  ) : (
                    filteredAvailableStaff.map(staff => (
                      <Button
                        key={staff.id}
                        variant="ghost"
                        className="w-full justify-start h-auto p-2 hover:bg-accent hover:text-accent-foreground"
                        onClick={() => handleAssignStaff(staff.id)}
                        disabled={assigningStaff.has(staff.id)}
                      >
                        <div className="flex items-center justify-between w-full">
                          <div className="flex flex-col items-start">
                            <div className="font-medium">{staff.firstName} {staff.lastName}</div>
                            <div className="flex items-center gap-2 mt-1">
                              <StaffRoleBadge value={staff.role} />
                              <StaffStatusBadge value={staff.status} />
                            </div>
                            {staff.email && (
                              <div className="text-xs text-muted-foreground mt-1">{staff.email}</div>
                            )}
                          </div>
                          {assigningStaff.has(staff.id) && (
                            <Loader2 className="h-4 w-4 animate-spin" />
                          )}
                        </div>
                      </Button>
                    ))
                  )}
                </div>
              </ScrollArea>
            </div>
          </PopoverContent>
        </Popover>
      </div>
      
      {loadingStaff ? (
        <div className="flex-1 flex justify-center items-center">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </div>
      ) : classStaff.length === 0 && assigningStaff.size === 0 ? (
        <div className="flex-1 flex flex-col justify-center items-center">
          <UserCheck className="h-12 w-12 text-muted-foreground mb-2" />
          <p className="text-sm text-muted-foreground mb-4">No staff assigned</p>
          <Popover>
            <PopoverTrigger asChild>
              <Button variant="outline">
                <Plus className="h-4 w-4 mr-2" />
                Assign staff
              </Button>
            </PopoverTrigger>
            <PopoverContent className="p-0 w-[300px]" align="center">
              <div className="p-3">
                <Input
                  placeholder="Search staff..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="mb-3"
                />
                <ScrollArea className="max-h-[300px]">
                  <div className="space-y-1">
                    {filteredAvailableStaff.length === 0 ? (
                      <div className="p-3 text-center text-sm text-muted-foreground">
                        No staff found
                      </div>
                    ) : (
                      filteredAvailableStaff.map(staff => (
                        <Button
                          key={staff.id}
                          variant="ghost"
                          className="w-full justify-start h-auto p-2 hover:bg-accent hover:text-accent-foreground"
                          onClick={() => handleAssignStaff(staff.id)}
                          disabled={assigningStaff.has(staff.id)}
                        >
                          <div className="flex items-center justify-between w-full">
                            <div className="flex flex-col items-start">
                              <div className="font-medium">{staff.firstName} {staff.lastName}</div>
                              <div className="flex items-center gap-2 mt-1">
                                <StaffRoleBadge value={staff.role} />
                                <StaffStatusBadge value={staff.status} />
                              </div>
                              {staff.email && (
                                <div className="text-xs text-muted-foreground mt-1">{staff.email}</div>
                              )}
                            </div>
                            {assigningStaff.has(staff.id) && (
                              <Loader2 className="h-4 w-4 animate-spin" />
                            )}
                          </div>
                        </Button>
                      ))
                    )}
                  </div>
                </ScrollArea>
              </div>
            </PopoverContent>
          </Popover>
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
                      {staff.firstName} {staff.lastName}
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
              .sort((a, b) => `${a.lastName} ${a.firstName}`.localeCompare(`${b.lastName} ${b.firstName}`))
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
                    {staff.firstName} {staff.lastName}
                  </div>
                  <div className="flex items-center gap-2 mt-1">
                    <StaffRoleBadge value={staff.role} />
                    <StaffStatusBadge value={staff.status} />
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
      {selectedStaffId && (
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
      )}
    </div>
  );
} 