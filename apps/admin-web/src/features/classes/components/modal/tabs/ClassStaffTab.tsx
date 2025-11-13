import { useState, useEffect } from 'react';
import type { Tables } from '@altitutor/shared';
import { Button } from "@altitutor/ui";
import { Input } from "@altitutor/ui";
import { ScrollArea } from "@altitutor/ui";
import { Popover, PopoverContent, PopoverTrigger } from "@altitutor/ui";
import { Loader2, UserCheck, Plus } from "lucide-react";
import { StaffRoleBadge, StaffStatusBadge } from "@altitutor/ui";
import { cn } from "@/shared/utils";
import { ViewStaffModal } from '@/features/staff';
import { StaffCard } from '@/shared/components/StaffCard';
import { useChatStore } from '@/features/messages/state/chatStore';
import { ensureConversationForRelated } from '@/features/messages/api/queries';
import { useToast } from "@altitutor/ui";

interface ClassStaffTabProps {
  classData: Tables<'classes'>;
  classStaff: Tables<'staff'>[];
  allStaff: Tables<'staff'>[];
  loadingStaff: boolean;
  onAssignStaff: (staffId: string) => void;
  onRemoveStaff: (staffId: string) => void;
}

export function ClassStaffTab({
  classData: _classData,
  classStaff,
  allStaff,
  loadingStaff,
  onAssignStaff,
  onRemoveStaff
}: ClassStaffTabProps) {
  const { toast } = useToast();
  const openWindow = useChatStore(s => s.openWindow);
  const [assigningStaff, setAssigningStaff] = useState<Set<string>>(new Set());
  const [_removingStaff, setRemovingStaff] = useState<Set<string>>(new Set());
  const [isAddPopoverOpen, setIsAddPopoverOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [staffSubjects, setStaffSubjects] = useState<Record<string, Tables<'subjects'>[]>>({});
  
  // Modal state for staff viewing
  const [selectedStaffId, setSelectedStaffId] = useState<string | null>(null);
  const [isStaffModalOpen, setIsStaffModalOpen] = useState(false);

  // Fetch subjects for all staff members
  useEffect(() => {
    const fetchStaffSubjects = async () => {
      if (classStaff.length === 0) return;
      
      try {
        const { staffApi } = await import('@/features/staff/api');
        const subjectsMap: Record<string, Tables<'subjects'>[]> = {};
        
        await Promise.all(
          classStaff.map(async (staff) => {
            try {
              const subjects = await staffApi.getStaffSubjects(staff.id);
              subjectsMap[staff.id] = subjects as Tables<'subjects'>[];
            } catch (err) {
              console.error(`Error fetching subjects for staff ${staff.id}:`, err);
              subjectsMap[staff.id] = [];
            }
          })
        );
        
        setStaffSubjects(subjectsMap);
      } catch (err) {
        console.error('Error fetching staff subjects:', err);
      }
    };
    
    fetchStaffSubjects();
  }, [classStaff]);

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

  // Handle message staff
  const handleMessageStaff = async (staffId: string) => {
    try {
      const conversationId = await ensureConversationForRelated(staffId, 'staff');
      if (conversationId) {
        openWindow({ conversationId, title: 'Staff' });
      }
    } catch (error) {
      console.error('Failed to open conversation:', error);
      toast({
        title: 'Error',
        description: 'Failed to open conversation. Please try again.',
        variant: 'destructive',
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
      staff.first_name.toLowerCase().includes(query) ||
      staff.last_name.toLowerCase().includes(query) ||
      (staff.email && staff.email.toLowerCase().includes(query))
    );
  });

  return (
    <div className="flex-1 min-h-0 flex flex-col space-y-4">
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
                            <div className="font-medium">{staff.first_name} {staff.last_name}</div>
                            <div className="flex items-center gap-2 mt-1">
                              <StaffRoleBadge value={staff.role as any} />
                              <StaffStatusBadge value={staff.status as any} />
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
                            <div className="font-medium">{staff.first_name} {staff.last_name}</div>
                            <div className="flex items-center gap-2 mt-1">
                              <StaffRoleBadge value={staff.role as any} />
                              <StaffStatusBadge value={staff.status as any} />
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
        <ScrollArea className="flex-1 min-h-0">
          <div className="space-y-2 pr-4">
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
                <StaffCard
                  key={staff.id}
                  staff={staff}
                  subjects={staffSubjects[staff.id] || []}
                  onClick={() => handleViewStaff(staff.id)}
                  onRemoveStaff={() => handleRemoveStaff(staff.id)}
                  onMessage={() => handleMessageStaff(staff.id)}
                />
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