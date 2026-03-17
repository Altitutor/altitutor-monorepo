'use client';

import {
  Button,
  FormControl,
  FormField,
  FormItem,
  FormMessage,
  SearchableSelect,
} from '@altitutor/ui';
import { UseFormReturn } from 'react-hook-form';
import { cn } from '@/shared/utils/index';
import {
  getStatusIcon,
  getStatusLabel,
  getStatusIconColor,
  TASK_STATUS_OPTIONS,
} from '../../utils/taskUtils';
import type { TaskFormData, TaskStatus } from '../../types';

interface TaskStatusFieldProps {
  form: UseFormReturn<TaskFormData>;
  taskStatus?: TaskStatus; // Fallback status from task data
}

type StatusOption = (typeof TASK_STATUS_OPTIONS)[number];

export function TaskStatusField({ form, taskStatus }: TaskStatusFieldProps) {
  return (
    <FormField
      control={form.control}
      name="status"
      render={({ field }) => {
        const selectValue = (field.value || taskStatus || 'backlog') as TaskStatus;
        const StatusIcon = getStatusIcon(selectValue);
        const displayValue = getStatusLabel(selectValue);
        const iconColor = getStatusIconColor(selectValue);
        const selectedItem =
          TASK_STATUS_OPTIONS.find((o) => o.value === selectValue) ??
          TASK_STATUS_OPTIONS[0];

        return (
          <FormItem>
            <FormControl>
              <SearchableSelect<StatusOption>
                items={TASK_STATUS_OPTIONS}
                value={selectedItem}
                onValueChange={(item) => {
                  field.onChange(item ? item.value : taskStatus ?? 'backlog');
                }}
                getItemLabel={(opt) => opt.label}
                getItemId={(opt) => opt.value}
                trigger={
                  <Button variant="outline" className="w-full justify-start font-normal">
                    <StatusIcon className={cn('h-4 w-4', iconColor)} />
                    <span className={cn(!field.value && 'text-muted-foreground')}>
                      {displayValue}
                    </span>
                  </Button>
                }
              />
            </FormControl>
            <FormMessage />
          </FormItem>
        );
      }}
    />
  );
}
