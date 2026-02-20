'use client';

import { useState, useEffect } from 'react';
import {
  FormControl,
  FormField,
  FormItem,
} from '@altitutor/ui';
import { Button } from '@altitutor/ui';
import { Popover, PopoverContent, PopoverTrigger } from '@altitutor/ui';
import { ScrollArea } from '@altitutor/ui';
import { User, Check, Loader2 } from 'lucide-react';
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
  const [assigneeSearchQuery, setAssigneeSearchQuery] = useState('');
  const [isPopoverOpen, setIsPopoverOpen] = useState(false);
  const { staff: staffList, isLoading: isSearchingStaff } = useStaffSearch(
    assigneeSearchQuery,
    enabled && isPopoverOpen
  );

  // Sync selectedAssignee with form field
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

  return (
    <FormField
      control={form.control}
      name="assignedTo"
      render={({ field: _field }) => (
        <FormItem>
          <Popover open={isPopoverOpen} onOpenChange={setIsPopoverOpen}>
            <PopoverTrigger asChild>
              <FormControl>
                <Button
                  variant="outline"
                  className="h-8 px-3 text-xs border rounded-full"
                  onClick={(e) => {
                    e.preventDefault();
                    setIsPopoverOpen(true);
                  }}
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
            </PopoverTrigger>
            <PopoverContent className="p-0 w-[400px]" align="start">
              <div className="p-3">
                <input
                  type="text"
                  placeholder="Search staff..."
                  value={assigneeSearchQuery}
                  onChange={(e) => setAssigneeSearchQuery(e.target.value)}
                  className="w-full px-3 py-2 text-sm border rounded-md mb-3"
                />
                <ScrollArea className="h-[300px]">
                  <div className="space-y-1 pr-4">
                    <Button
                      variant="ghost"
                      className="w-full justify-start h-auto p-3"
                      onClick={() => {
                        onAssigneeChange(null);
                        setIsPopoverOpen(false);
                        setAssigneeSearchQuery('');
                      }}
                    >
                      <div className="flex items-center gap-2 w-full">
                        {!selectedAssignee && <Check className="h-4 w-4" />}
                        <span className={!selectedAssignee ? 'font-medium' : ''}>
                          Unassigned
                        </span>
                      </div>
                    </Button>
                    {isSearchingStaff ? (
                      <div className="p-3 text-center text-sm text-muted-foreground flex items-center justify-center gap-2">
                        <Loader2 className="h-4 w-4 animate-spin" />
                        Searching...
                      </div>
                    ) : staffList.length === 0 ? (
                      <div className="p-3 text-center text-sm text-muted-foreground">
                        {assigneeSearchQuery
                          ? 'No staff match your search'
                          : 'No staff found'}
                      </div>
                    ) : (
                      staffList.map((staff) => (
                        <Button
                          key={staff.id}
                          variant="ghost"
                          className="w-full justify-start h-auto p-3"
                          onClick={() => {
                            onAssigneeChange(staff);
                            setIsPopoverOpen(false);
                            setAssigneeSearchQuery('');
                          }}
                        >
                          <div className="flex items-center gap-2 w-full">
                            {selectedAssignee?.id === staff.id && (
                              <Check className="h-4 w-4" />
                            )}
                            <div className="flex flex-col items-start flex-1">
                              <div
                                className={
                                  selectedAssignee?.id === staff.id ? 'font-medium' : ''
                                }
                              >
                                {staff.first_name} {staff.last_name}
                              </div>
                              {staff.role && (
                                <div className="text-xs text-muted-foreground">
                                  {staff.role}
                                </div>
                              )}
                            </div>
                          </div>
                        </Button>
                      ))
                    )}
                  </div>
                </ScrollArea>
              </div>
            </PopoverContent>
          </Popover>
        </FormItem>
      )}
    />
  );
}
