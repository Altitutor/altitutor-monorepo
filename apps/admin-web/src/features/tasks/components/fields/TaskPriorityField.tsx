'use client';

import {
  FormControl,
  FormField,
  FormItem,
  FormMessage,
  SearchableSelect,
  Button,
} from '@altitutor/ui';
import { UseFormReturn } from 'react-hook-form';
import { cn } from '@/shared/utils/index';
import {
  getPriorityIcon,
  getPriorityLabel,
  getPriorityIconColor,
  PRIORITY_OPTIONS,
} from '../../utils/taskUtils';
import type { TaskFormData, TaskPriority } from '../../types';

interface TaskPriorityFieldProps {
  form: UseFormReturn<TaskFormData>;
}

export function TaskPriorityField({ form }: TaskPriorityFieldProps) {
  return (
    <FormField
      control={form.control}
      name="priority"
      render={({ field }) => {
        const priorityValue = (field.value ?? 0) as TaskPriority;
        const PriorityIcon = getPriorityIcon(priorityValue);
        const displayValue = getPriorityLabel(priorityValue);
        const iconColor = getPriorityIconColor(priorityValue);
        const selectedOpt =
          PRIORITY_OPTIONS.find((o) => o.value === priorityValue) ??
          PRIORITY_OPTIONS[0];

        return (
          <FormItem>
            <FormControl>
              <SearchableSelect<(typeof PRIORITY_OPTIONS)[number]>
                items={PRIORITY_OPTIONS}
                value={selectedOpt}
                onValueChange={(opt) =>
                  opt && field.onChange(opt.value as TaskFormData['priority'])
                }
                getItemId={(o) => String(o.value)}
                getItemLabel={(o) => o.label}
                placeholder="Priority"
                searchPlaceholder="Search priority..."
                emptyMessage="No options found"
                trigger={
                  <Button variant="outline" className="w-full justify-start font-normal">
                    <div className="flex items-center gap-2 flex-1">
                      <PriorityIcon className={cn('h-4 w-4', iconColor)} />
                      <span className={cn(priorityValue === 0 && 'text-muted-foreground')}>
                        {displayValue}
                      </span>
                    </div>
                  </Button>
                }
                renderItem={(opt) => {
                  const OptionIcon = getPriorityIcon(opt.value);
                  const optionColor = getPriorityIconColor(opt.value);
                  return (
                    <div className="flex items-center gap-2">
                      <OptionIcon className={cn('h-4 w-4', optionColor)} />
                      <span>{opt.label}</span>
                    </div>
                  );
                }}
              />
            </FormControl>
            <FormMessage />
          </FormItem>
        );
      }}
    />
  );
}
