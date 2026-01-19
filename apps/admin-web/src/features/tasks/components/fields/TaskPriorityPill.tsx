'use client';

import {
  FormControl,
  FormField,
  FormItem,
} from '@altitutor/ui';
import { Select, SelectContent, SelectItem, SelectTrigger } from '@altitutor/ui';
import { Circle, AlertCircle, AlertTriangle, Info } from 'lucide-react';
import { UseFormReturn } from 'react-hook-form';
import { cn } from '@/shared/utils/index';
import { getPriorityLabel, getPriorityIconColor } from '../../utils/taskUtils';
import type { TaskPriority } from '../../types';

interface TaskPriorityPillProps {
  form: UseFormReturn<{ priority: TaskPriority }>;
}

export function TaskPriorityPill({ form }: TaskPriorityPillProps) {
  return (
    <FormField
      control={form.control}
      name="priority"
      render={({ field }) => {
        const priorityValue = field.value ?? 0;
        const displayValue = getPriorityLabel(priorityValue);
        const iconColor = getPriorityIconColor(priorityValue);
        const PriorityIcon =
          priorityValue === 0
            ? Circle
            : priorityValue === 2
              ? AlertTriangle
              : priorityValue === 4
                ? Info
                : AlertCircle;

        return (
          <FormItem>
            <Select
              onValueChange={(value) => field.onChange(Number(value) as TaskPriority)}
              value={String(priorityValue)}
            >
              <FormControl>
                <SelectTrigger className="h-8 px-3 text-xs border rounded-full">
                  <div className="flex items-center gap-1.5">
                    <PriorityIcon className={cn('h-3 w-3', iconColor)} />
                    <span>{displayValue}</span>
                  </div>
                </SelectTrigger>
              </FormControl>
              <SelectContent>
                <SelectItem value="0">
                  <div className="flex items-center gap-2">
                    <Circle className="h-4 w-4 text-muted-foreground" />
                    <span>No priority</span>
                  </div>
                </SelectItem>
                <SelectItem value="1">
                  <div className="flex items-center gap-2">
                    <AlertCircle className="h-4 w-4 text-red-500 dark:text-red-400" />
                    <span>Urgent</span>
                  </div>
                </SelectItem>
                <SelectItem value="2">
                  <div className="flex items-center gap-2">
                    <AlertTriangle className="h-4 w-4 text-orange-500 dark:text-orange-400" />
                    <span>High</span>
                  </div>
                </SelectItem>
                <SelectItem value="3">
                  <div className="flex items-center gap-2">
                    <AlertCircle className="h-4 w-4 text-yellow-500 dark:text-yellow-400" />
                    <span>Medium</span>
                  </div>
                </SelectItem>
                <SelectItem value="4">
                  <div className="flex items-center gap-2">
                    <Info className="h-4 w-4 text-blue-500 dark:text-blue-400" />
                    <span>Low</span>
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
