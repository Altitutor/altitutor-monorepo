'use client';

import {
  FormControl,
  FormField,
  FormItem,
} from '@altitutor/ui';
import { Select, SelectContent, SelectItem, SelectTrigger } from '@altitutor/ui';
import { Clock, Circle, CheckCircle, Eye } from 'lucide-react';
import { UseFormReturn } from 'react-hook-form';
import { cn } from '@/shared/utils/index';
import { getStatusLabel, getStatusIconColor } from '../../utils/taskUtils';
import type { TaskStatus } from '../../types';

interface TaskStatusPillProps {
  form: UseFormReturn<{ status: TaskStatus }>;
  taskStatus?: TaskStatus;
}

export function TaskStatusPill({ form, taskStatus }: TaskStatusPillProps) {
  return (
    <FormField
      control={form.control}
      name="status"
      render={({ field }) => {
        const selectValue = field.value || taskStatus || 'backlog';
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
                    <Clock className={cn('h-3 w-3', iconColor)} />
                    <span>{displayValue}</span>
                  </div>
                </SelectTrigger>
              </FormControl>
              <SelectContent>
                <SelectItem value="backlog">
                  <div className="flex items-center gap-2">
                    <Circle className="h-4 w-4 text-gray-500 dark:text-gray-400" />
                    <span>Backlog</span>
                  </div>
                </SelectItem>
                <SelectItem value="todo">
                  <div className="flex items-center gap-2">
                    <Circle className="h-4 w-4 text-blue-500 dark:text-blue-400" />
                    <span>Todo</span>
                  </div>
                </SelectItem>
                <SelectItem value="in_progress">
                  <div className="flex items-center gap-2">
                    <Clock className="h-4 w-4 text-yellow-500 dark:text-yellow-400" />
                    <span>In Progress</span>
                  </div>
                </SelectItem>
                <SelectItem value="in_review">
                  <div className="flex items-center gap-2">
                    <Eye className="h-4 w-4 text-purple-500 dark:text-purple-400" />
                    <span>In Review</span>
                  </div>
                </SelectItem>
                <SelectItem value="done">
                  <div className="flex items-center gap-2">
                    <CheckCircle className="h-4 w-4 text-green-500 dark:text-green-400" />
                    <span>Done</span>
                  </div>
                </SelectItem>
              </SelectContent>
            </Select>
          </FormItem>
        );
      }}
    />
  );
}
