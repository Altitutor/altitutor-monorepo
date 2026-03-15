'use client';

import { FormControl, FormField, FormItem } from '@altitutor/ui';
import { Select, SelectContent, SelectItem, SelectTrigger } from '@altitutor/ui';
import { UseFormReturn } from 'react-hook-form';
import { cn } from '@/shared/utils/index';
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

        return (
          <FormItem>
            <Select
              onValueChange={(value) => {
                if (value && value !== '') {
                  field.onChange(value);
                } else if (taskStatus) {
                  field.onChange(taskStatus);
                }
              }}
              value={selectValue}
            >
              <FormControl>
                <SelectTrigger className="h-8 px-3 text-xs border rounded-full">
                  <div className="flex items-center gap-1.5">
                    <StatusIcon className={cn('h-3 w-3', iconColor)} />
                    <span>{displayValue}</span>
                  </div>
                </SelectTrigger>
              </FormControl>
              <SelectContent>
                {TASK_STATUS_OPTIONS.map((opt) => {
                  const OptionIcon = getStatusIcon(opt.value);
                  const optionColor = getStatusIconColor(opt.value);
                  return (
                    <SelectItem key={opt.value} value={opt.value}>
                      <div className="flex items-center gap-2">
                        <OptionIcon className={cn('h-4 w-4', optionColor)} />
                        <span>{opt.label}</span>
                      </div>
                    </SelectItem>
                  );
                })}
              </SelectContent>
            </Select>
          </FormItem>
        );
      }}
    />
  );
}
