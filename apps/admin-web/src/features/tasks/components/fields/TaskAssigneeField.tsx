'use client';

import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { staffApi } from '@/features/staff/api/staff';
import {
  FormControl,
  FormField,
  FormItem,
  FormMessage,
  SearchableSelect,
  SearchableSelectFieldTrigger,
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
  selectedAssignee: initialAssignee,
  onAssigneeChange,
  enabled = true,
}: TaskAssigneeFieldProps) {
  const [searchQuery, setSearchQuery] = useState('');
  const [open, setOpen] = useState(false);

  const { staff: staffList, isLoading: isSearchingStaff } = useStaffSearch(
    searchQuery,
    enabled && open
  );

  const assignedTo = form.watch('assignedTo');
  const { data: fetchedAssignee } = useQuery({
    queryKey: ['staff', 'task-assignee', assignedTo],
    queryFn: () => staffApi.getById(assignedTo!),
    enabled: !!assignedTo && assignedTo !== initialAssignee?.id,
  });
  const selectedAssignee = assignedTo === initialAssignee?.id
    ? initialAssignee
    : assignedTo ? fetchedAssignee ?? null : null;

  const assigneeInitials = selectedAssignee
    ? getUserInitials(selectedAssignee.first_name, selectedAssignee.last_name)
    : null;

  const trigger = (
    <FormControl>
      <SearchableSelectFieldTrigger disabled={!enabled}>
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
      </SearchableSelectFieldTrigger>
    </FormControl>
  );

  return (
    <FormField
      control={form.control}
      name="assignedTo"
      render={({ field }) => (
        <FormItem>
          <SearchableSelect<Tables<'staff'>>
            items={staffList}
            value={selectedAssignee}
            onValueChange={(staff) => {
              field.onChange(staff?.id ?? null);
              onAssigneeChange(staff);
            }}
            getItemId={(s) => s.id}
            getItemLabel={(s) => `${s.first_name} ${s.last_name}`}
            getItemValue={(s) => `${s.first_name} ${s.last_name} ${s.email ?? ''}`.trim()}
            fullWidth
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
