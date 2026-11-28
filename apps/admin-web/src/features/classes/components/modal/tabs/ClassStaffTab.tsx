import { requestPane } from '@/shared/components/pane-workspace/pane-routing';
import { EntityActionChip } from '@/shared/components/EntityActionChip';
import { classStaffReferenceActions } from '@/features/classes/utils/classReferenceActions';
import { useRegisterRecordActions } from '@/features/command-palette/RecordActionsContext';
import { useState, useCallback, useMemo } from 'react';
import type { Tables } from '@altitutor/shared';
import { Button, DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger, Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@altitutor/ui";
import { Eye, Loader2, MessageSquare, MoreVertical, Plus, UserMinus } from "lucide-react";
import { ViewStaffModal } from '@/features/staff';
import { useChatStore } from '@/features/messages/state/chatStore';
import { ensureConversationForRelated } from '@/features/messages/api/queries';
import { useToast } from "@altitutor/ui";
import { getErrorMessage } from '@/shared/utils';
import { AssignStaffModal } from '@/features/enrollments';
import { useCurrentStaff } from '@/shared/hooks';
import type { ClassStaff } from '@/features/classes/api/classes';

interface ClassStaffTabProps {
  classData: Tables<'classes'>;
  classSubject?: Tables<'subjects'>;
  classStaff: ClassStaff[];
  allStaff: Tables<'staff'>[];
  loadingStaff: boolean;
  onAssignStaff: (staffId: string) => void;
  onRemoveStaff: (staffId: string) => void;
}

export function ClassStaffTab({
  classData,
  classSubject,
  classStaff,
  allStaff: _allStaff,
  loadingStaff,
  onAssignStaff,
  onRemoveStaff
}: ClassStaffTabProps) {
  const { toast } = useToast();
  const openWindow = useChatStore(s => s.openWindow);
  const [assigningStaff] = useState<Set<string>>(new Set());
  const [removingStaff, setRemovingStaff] = useState<Set<string>>(new Set());
  
  // Modal state for staff viewing
  const [selectedStaffId, setSelectedStaffId] = useState<string | null>(null);
  const [isStaffModalOpen, setIsStaffModalOpen] = useState(false);
  
  // Assign staff modal state
  const [isAssignStaffModalOpen, setIsAssignStaffModalOpen] = useState(false);
  
  // Get current staff for assignment
  const { data: currentStaff } = useCurrentStaff();

  // Stable reference for assigned staff IDs to avoid infinite update loops when AssignStaffModal opens (parent re-renders)
  const assignedStaffIds = useMemo(() => classStaff.map(s => s.id), [classStaff]);

  const handleViewStaff = (staffId: string) => {
    setSelectedStaffId(staffId);
    setIsStaffModalOpen(true);
  };

  // Handle assignment from modal
  const handleAssignStaffFromModal = useCallback(async (params: {
    staffId: string;
    classId: string;
    assignedAt: Date;
    currentStaffId: string;
  }) => {
    try {
      await onAssignStaff(params.staffId);
      toast({
        title: 'Success',
        description: 'Staff assigned to class successfully.',
      });
    } catch (error: unknown) {
      toast({
        title: 'Error',
        description: getErrorMessage(error),
        variant: 'destructive',
      });
      throw error;
    }
  }, [onAssignStaff, toast]);

  // Memoize the close handler to prevent infinite loops
  const handleCloseAssignModal = useCallback(() => {
    setIsAssignStaffModalOpen(false);
  }, []);

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
  const handleMessageStaff = async (staffId: string, openInNewPane = false) => {
    try {
      const conversationId = await ensureConversationForRelated(staffId, 'staff');
      if (conversationId) {
        if (openInNewPane && requestPane('open', `/messages?conversation=${encodeURIComponent(conversationId)}`)) return;
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

  useRegisterRecordActions('class',classData.id,classData.short_name ?? 'Class',classStaff.flatMap(staff=>classStaffReferenceActions(
    {id:staff.id,label:[staff.first_name,staff.last_name].filter(Boolean).join(' ') || 'Staff'},
    {id:classData.id,label:classData.short_name || classSubject?.short_name || 'Class'},
    ()=>{void handleRemoveStaff(staff.id);},
  ).map(action=>({...action,ready:()=>Boolean(currentStaff) && !loadingStaff,disabled:removingStaff.has(staff.id)}))),{runOnly:true});

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
        
        {currentStaff && (
          <Button 
            variant="outline" 
            size="sm" 
            className="ml-auto flex items-center gap-2"
            onClick={() => setIsAssignStaffModalOpen(true)}
          >
            <Plus className="h-4 w-4" />
            <span>Add Staff</span>
          </Button>
        )}
      </div>
      
      {loadingStaff ? (
        <div className="flex-1 flex justify-center items-center">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </div>
      ) : classStaff.length === 0 && assigningStaff.size === 0 ? (
          <div className="rounded-md border p-6 text-center">
          <p className="text-sm text-muted-foreground mb-4">No staff assigned</p>
          {currentStaff && (
            <Button 
              variant="outline"
              onClick={() => setIsAssignStaffModalOpen(true)}
            >
              <Plus className="h-4 w-4 mr-2" />
              Assign staff
            </Button>
          )}
        </div>
      ) : (
        <div className="overflow-hidden rounded-lg border">
          <Table>
            <TableHeader><TableRow><TableHead>Staff</TableHead><TableHead>Assigned on</TableHead><TableHead className="w-14">Actions</TableHead></TableRow></TableHeader>
            <TableBody>
              {[...classStaff]
                .sort((a, b) => `${a.last_name} ${a.first_name}`.localeCompare(`${b.last_name} ${b.first_name}`))
                .map((staff) => (
                  <TableRow key={staff.id}>
                    <TableCell><EntityActionChip entityType="staff" entityId={staff.id} label={[staff.first_name,staff.last_name].filter(Boolean).join(' ') || 'Staff'} onClick={()=>handleViewStaff(staff.id)} hoverActions={classStaffReferenceActions(
                      {id:staff.id,label:[staff.first_name,staff.last_name].filter(Boolean).join(' ') || 'Staff'},
                      {id:classData.id,label:classData.short_name || classSubject?.short_name || 'Class'},
                      ()=>{void handleRemoveStaff(staff.id);},
                    ).map(action=>({...action,disabled:removingStaff.has(staff.id)}))} /></TableCell>
                    <TableCell>{new Date(staff.assigned_at).toLocaleDateString('en-AU', { timeZone: 'Australia/Adelaide', dateStyle: 'medium' })}</TableCell>
                    <TableCell>
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild><Button type="button" variant="outline" size="icon" className="h-8 w-8" aria-label={`Actions for ${staff.first_name} ${staff.last_name}`}><MoreVertical className="h-4 w-4" /></Button></DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuItem onClick={() => handleViewStaff(staff.id)}><Eye className="mr-2 h-4 w-4" />View staff</DropdownMenuItem>
                          <DropdownMenuItem onClick={(event) => void handleMessageStaff(staff.id, event.shiftKey)}><MessageSquare className="mr-2 h-4 w-4" />Message</DropdownMenuItem>
                          <DropdownMenuSeparator />
                          <DropdownMenuItem className="text-destructive focus:text-destructive" onClick={() => handleRemoveStaff(staff.id)}><UserMinus className="mr-2 h-4 w-4" />Remove from Class</DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </TableCell>
                  </TableRow>
                ))}
            </TableBody>
          </Table>
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
            // Refresh would be handled by parent component
            // since we don't have direct access to refresh function here
          }}
        />
      )}
      
      {/* Assign Staff Modal */}
      {currentStaff && classSubject && (
        <AssignStaffModal
          isOpen={isAssignStaffModalOpen}
          onClose={handleCloseAssignModal}
          context="class"
          classData={classData}
          classSubject={classSubject}
          classStaff={classStaff}
          assignedStaffIds={assignedStaffIds}
          onAssign={handleAssignStaffFromModal}
          currentStaffId={currentStaff.id}
        />
      )}
    </div>
  );
}
