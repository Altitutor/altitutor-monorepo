'use client';

import { useState, useEffect } from 'react';
import {
  FormControl,
  FormField,
  FormItem,
  FormMessage,
  SearchableSelect,
} from '@altitutor/ui';
import { Check, User } from 'lucide-react';
import { UseFormReturn } from 'react-hook-form';
import { useStaffSearch } from '../../hooks/useStaffSearch';
import { getUserInitials } from '../../utils/taskUtils';
import type { Tables } from '@altitutor/shared';
import type { TaskFormData } from '../../types';

interface TaskAssigneeFieldProps {
  form: UseFormReturn<TaskFormData>;
  selectedAssignee: Tables<'staff'> | null;
  onAssigneeChange: (staff: Tables<'staff'> | null) => void;
  enabled?: boolean;
}

export function TaskAssigneeField({
  form,
  selectedAssignee,
  onAssigneeChange,
  enabled = true,
}: TaskAssigneeFieldProps) {
  const [searchQuery, setSearchQuery] = useState('');
  const [open, setOpen] = useState(false);

  const { staff: staffList, isLoading: isSearchingStaff } = useStaffSearch(
    searchQuery,
    enabled && open
  );

  useEffect(() => {
    const currentAssignedTo = form.getValues('assignedTo');
    if (selectedAssignee && currentAssignedTo !== selectedAssignee.id) {
      form.setValue('assignedTo', selectedAssignee.id, { shouldDirty: false });
    } else if (!selectedAssignee && currentAssignedTo !== null) {
      form.setValue('assignedTo', null, { shouldDirty: false });
    }
  }, [selectedAssignee, form]);

  const assigneeInitials = selectedAssignee
    ? getUserInitials(selectedAssignee.first_name, selectedAssignee.last_name)
    : null;

  const trigger = (
    <FormControl>
      <button
        type="button"
        className="inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-md text-sm font-medium ring-offset-background transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 border hover:bg-muted h-10 px-4 py-2 w-full justify-start"
        disabled={!enabled}
      >
        <div className="flex items-center gap-2 flex-1">
          {selectedAssignee ? (
            <>
              <div className="w-5 h-5 rounded-full bg-muted flex items-center justify-center text-muted-foreground text-xs font-medium flex-shrink-0">
                {assigneeInitials}
              </div>
              <span>
                {selectedAssignee.first_name} {selectedAssignee.last_name}
              </span>
            </>
          ) : (
            <>
              <User className="h-4 w-4 text-muted-foreground" />
              <span className="text-muted-foreground">Assign</span>
            </>
          )}
        </div>
      </button>
    </FormControl>
  );

  return (
    <FormField
      control={form.control}
      name="assignedTo"
      render={({ field: _field }) => (
        <FormItem>
          <SearchableSelect<Tables<'staff'>>
            items={staffList}
            value={selectedAssignee}
            onValueChange={onAssigneeChange}
            getItemId={(s) => s.id}
            getItemLabel={(s) => `${s.first_name} ${s.last_name}`}
            getItemValue={(s) => `${s.first_name} ${s.last_name} ${s.email ?? ''}`.trim()}
            placeholder="Unassigned"
            searchPlaceholder="Search staff..."
            emptyMessage={
              searchQuery ? 'No staff match your search' : 'No staff found'
            }
            trigger={trigger}
            allowClear
            loading={isSearchingStaff}
            contentWidth="400px"
            onSearchChange={setSearchQuery}
            open={open}
            onOpenChange={setOpen}
            renderItem={(staff, isSelected) => (
              <>
                <Check
                  className={
                    isSelected ? 'h-4 w-4 flex-shrink-0 opacity-100' : 'h-4 w-4 flex-shrink-0 opacity-0'
                  }
                />
                <div className="flex flex-col items-start flex-1">
                  <span className={isSelected ? 'font-medium' : ''}>
                    {staff.first_name} {staff.last_name}
                  </span>
                  {staff.role && (
                    <span className="text-xs text-muted-foreground">
                      {staff.role}
                    </span>
                  )}
                </div>
              </>
            )}
          />
          <FormMessage />
        </FormItem>
      )}
    />
  );
}
