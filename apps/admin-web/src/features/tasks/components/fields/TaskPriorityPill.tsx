'use client';

import { FormControl, FormField, FormItem } from '@altitutor/ui';
import { Select, SelectContent, SelectItem, SelectTrigger } from '@altitutor/ui';
import { UseFormReturn } from 'react-hook-form';
import { cn } from '@/shared/utils/index';
import {
  getPriorityIcon,
  getPriorityLabel,
  getPriorityIconColor,
  PRIORITY_OPTIONS,
} from '../../utils/taskUtils';
import type { TaskFormData, TaskPriority } from '../../types';

interface TaskPriorityPillProps {
  form: UseFormReturn<TaskFormData>;
}

export function TaskPriorityPill({ form }: TaskPriorityPillProps) {
  return (
    <FormField
      control={form.control}
      name="priority"
      render={({ field }) => {
        const priorityValue = (field.value ?? 0) as TaskPriority;
        const PriorityIcon = getPriorityIcon(priorityValue);
        const displayValue = getPriorityLabel(priorityValue);
        const iconColor = getPriorityIconColor(priorityValue);

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
                {PRIORITY_OPTIONS.map((opt) => {
                  const OptionIcon = getPriorityIcon(opt.value);
                  const optionColor = getPriorityIconColor(opt.value);
                  return (
                    <SelectItem key={opt.value} value={String(opt.value)}>
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
