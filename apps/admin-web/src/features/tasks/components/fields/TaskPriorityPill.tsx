'use client';

import { Button, FormControl, FormField, FormItem, SearchableSelect } from '@altitutor/ui';
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

type PriorityOption = (typeof PRIORITY_OPTIONS)[number];

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
        const selectedItem = PRIORITY_OPTIONS.find((o) => o.value === priorityValue) ?? null;

        return (
          <FormItem>
            <FormControl>
              <SearchableSelect<PriorityOption>
                items={PRIORITY_OPTIONS}
                value={selectedItem}
                onValueChange={(item) => field.onChange(item ? (item.value as TaskPriority) : 0)}
                getItemLabel={(opt) => opt.label}
                getItemId={(opt) => String(opt.value)}
                trigger={
                  <Button
                    type="button"
                    variant="outline"
                    className="h-8 rounded-full px-3 text-xs"
                  >
                    <PriorityIcon className={cn('h-3 w-3', iconColor)} />
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
