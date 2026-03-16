'use client';

import { useState } from 'react';
import { Button, Popover, PopoverContent, PopoverTrigger, ScrollArea } from '@altitutor/ui';
import { User, Loader2 } from 'lucide-react';
import { useQueryClient } from '@tanstack/react-query';
import { useStaffSearch } from '@/features/tasks/hooks/useStaffSearch';
import { useUpdateTask } from '@/features/tasks/api/mutations';
import { reconciliationKeys } from '../api/queryKeys';

interface AssignTaskDropdownProps {
  taskId: string;
}

/**
 * Popover to assign a task to a staff member.
 * Searchable staff list, same pattern as EditTaskDialog TaskAssigneeField.
 */
export function AssignTaskDropdown({ taskId }: AssignTaskDropdownProps) {
  const queryClient = useQueryClient();
  const updateTask = useUpdateTask();
  const [isOpen, setIsOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const { staff: staffList, isLoading: isStaffLoading } = useStaffSearch(
    searchQuery,
    isOpen
  );

  const handleAssign = async (staffId: string) => {
    try {
      await updateTask.mutateAsync({
        id: taskId,
        updates: { assigned_to: staffId },
      });
      queryClient.invalidateQueries({ queryKey: reconciliationKeys.unassignedTasks() });
      setIsOpen(false);
      setSearchQuery('');
    } catch {
      // Error toast is handled by useUpdateTask
    }
  };

  return (
    <Popover open={isOpen} onOpenChange={setIsOpen}>
      <PopoverTrigger asChild>
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
      </PopoverTrigger>
      <PopoverContent className="p-0 w-[400px]" align="end">
        <div className="p-3">
          <input
            type="text"
            placeholder="Search staff..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full px-3 py-2 text-sm border rounded-md mb-3"
          />
          <ScrollArea className="h-[300px]">
            <div className="space-y-1 pr-4">
              {isStaffLoading ? (
                <div className="p-3 text-center text-sm text-muted-foreground flex items-center justify-center gap-2">
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Searching...
                </div>
              ) : staffList.length === 0 ? (
                <div className="p-3 text-center text-sm text-muted-foreground">
                  {searchQuery
                    ? 'No staff match your search'
                    : 'No staff found'}
                </div>
              ) : (
                staffList.map((staff) => (
                  <Button
                    key={staff.id}
                    variant="ghost"
                    className="w-full justify-start h-auto p-3"
                    onClick={() => handleAssign(staff.id)}
                  >
                    <div className="flex flex-col items-start flex-1">
                      <div>
                        {staff.first_name} {staff.last_name}
                      </div>
                      {staff.role && (
                        <div className="text-xs text-muted-foreground">
                          {staff.role}
                        </div>
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
  );
}
