'use client';

import { useState, useEffect } from 'react';
import {
  FormControl,
  FormField,
  FormItem,
  SearchableSelect,
} from '@altitutor/ui';
import { Button } from '@altitutor/ui';
import { User, Check } from 'lucide-react';
import { UseFormReturn } from 'react-hook-form';
import { useStaffSearch } from '../../hooks/useStaffSearch';
import { getUserInitials } from '../../utils/taskUtils';
import type { Tables } from '@altitutor/shared';
import type { TaskFormData } from '../../types';

interface TaskAssigneePillProps {
  form: UseFormReturn<TaskFormData>;
  selectedAssignee: Tables<'staff'> | null;
  onAssigneeChange: (staff: Tables<'staff'> | null) => void;
  enabled?: boolean;
}

export function TaskAssigneePill({
  form,
  selectedAssignee,
  onAssigneeChange,
  enabled = true,
}: TaskAssigneePillProps) {
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
      <Button
        variant="outline"
        type="button"
        className="h-8 px-3 text-xs border rounded-full"
      >
        <div className="flex items-center gap-1.5">
          {selectedAssignee ? (
            <>
              <div className="w-4 h-4 rounded-full bg-muted flex items-center justify-center text-muted-foreground text-[10px] font-medium flex-shrink-0">
                {assigneeInitials}
              </div>
              <span className="truncate max-w-[80px]">
                {selectedAssignee.first_name} {selectedAssignee.last_name}
              </span>
            </>
          ) : (
            <>
              <User className="h-3 w-3 text-muted-foreground" />
              <span className="text-muted-foreground">Assign</span>
            </>
          )}
        </div>
      </Button>
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
            disabled={!enabled}
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
        </FormItem>
      )}
    />
  );
}
