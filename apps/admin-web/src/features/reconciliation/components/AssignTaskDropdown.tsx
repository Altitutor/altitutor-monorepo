'use client';

import { useState } from 'react';
import { Button, SearchableSelect } from '@altitutor/ui';
import { User, Loader2 } from 'lucide-react';
import { useQueryClient } from '@tanstack/react-query';
import { useStaffSearch } from '@/features/tasks/hooks/useStaffSearch';
import { useUpdateTask } from '@/features/tasks/api/mutations';
import { reconciliationKeys } from '../api/queryKeys';
import type { Tables } from '@altitutor/shared';

interface AssignTaskDropdownProps {
  taskId: string;
}

/**
 * Popover to assign a task to a staff member.
 * Uses SearchableSelect for consistent UI.
 */
export function AssignTaskDropdown({ taskId }: AssignTaskDropdownProps) {
  const queryClient = useQueryClient();
  const updateTask = useUpdateTask();
  const [open, setOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const { staff: staffList, isLoading: isStaffLoading } = useStaffSearch(
    searchQuery,
    open
  );

  const handleAssign = async (staff: Tables<'staff'> | null) => {
    if (!staff) return;
    try {
      await updateTask.mutateAsync({
        id: taskId,
        updates: { assigned_to: staff.id },
      });
      queryClient.invalidateQueries({ queryKey: reconciliationKeys.unassignedTasks() });
      setOpen(false);
    } catch {
      // Error toast is handled by useUpdateTask
    }
  };

  const trigger = (
    <Button
      variant="default"
      size="sm"
      disabled={updateTask.isPending}
    >
      {updateTask.isPending ? (
        <Loader2 className="h-4 w-4 mr-1 animate-spin" />
      ) : (
        <User className="h-4 w-4 mr-1" />
      )}
      Assign task
    </Button>
  );

  return (
    <SearchableSelect<Tables<'staff'>>
      items={staffList}
      value={null}
      onValueChange={handleAssign}
      getItemId={(s) => s.id}
      getItemLabel={(s) => `${s.first_name} ${s.last_name}`}
      getItemValue={(s) => `${s.first_name} ${s.last_name} ${s.email ?? ''}`.trim()}
      placeholder="Assign task"
      searchPlaceholder="Search staff..."
      emptyMessage={searchQuery ? 'No staff match your search' : 'No staff found'}
      trigger={trigger}
      loading={isStaffLoading}
      contentWidth="400px"
      align="end"
      onSearchChange={setSearchQuery}
      open={open}
      onOpenChange={setOpen}
      disabled={updateTask.isPending}
      renderItem={(staff) => (
        <div className="flex flex-col items-start flex-1">
          <div>{staff.first_name} {staff.last_name}</div>
          {staff.role && (
            <div className="text-xs text-muted-foreground">{staff.role}</div>
          )}
        </div>
      )}
    />
  );
}
