'use client';

import { Button, FormControl, FormField, FormItem, SearchableSelect } from '@altitutor/ui';
import { cn } from '@/shared/utils/index';
import { UseFormReturn } from 'react-hook-form';
import {
  getStatusIcon,
  getStatusLabel,
  getStatusIconColor,
  TASK_STATUS_OPTIONS,
} from '../../utils/taskUtils';
import type { TaskFormData, TaskStatus } from '../../types';

interface TaskStatusPillProps {
  form: UseFormReturn<TaskFormData>;
  taskStatus?: TaskStatus;
}

type StatusOption = (typeof TASK_STATUS_OPTIONS)[number];

export function TaskStatusPill({ form, taskStatus }: TaskStatusPillProps) {
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
                  <Button
                    type="button"
                    variant="outline"
                    className="h-8 rounded-full px-3 text-xs"
                  >
                    <StatusIcon className={cn('h-3 w-3', iconColor)} />
                    <span>{displayValue}</span>
                  </Button>
                }
              />
            </FormControl>
          </FormItem>
        );
      }}
    />
  );
}
