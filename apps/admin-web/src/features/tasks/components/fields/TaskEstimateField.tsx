'use client';

import {
  FormControl,
  FormField,
  FormItem,
  FormMessage,
} from '@altitutor/ui';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@altitutor/ui';
import { Gauge } from 'lucide-react';
import { UseFormReturn } from 'react-hook-form';
import { cn } from '@/shared/utils/index';
import { ESTIMATE_OPTIONS, getEstimateLabel } from '../../utils/taskUtils';

interface TaskEstimateFieldProps {
  form: UseFormReturn<{ estimate: number | null }>;
}

export function TaskEstimateField({ form }: TaskEstimateFieldProps) {
  return (
    <FormField
      control={form.control}
      name="estimate"
      render={({ field }) => {
        const estimateValue = field.value;
        const displayValue = estimateValue ? getEstimateLabel(estimateValue) : null;

        return (
          <FormItem>
            <Select
              onValueChange={(value) => {
                field.onChange(value === 'none' ? null : Number(value));
              }}
              value={estimateValue ? String(estimateValue) : 'none'}
            >
              <FormControl>
                <SelectTrigger className="w-full">
                  <div className="flex items-center gap-2 flex-1">
                    <Gauge className="h-4 w-4 text-muted-foreground" />
                    <span className={cn(!estimateValue && 'text-muted-foreground')}>
                      {displayValue || 'Set estimate'}
                    </span>
                  </div>
                </SelectTrigger>
              </FormControl>
              <SelectContent>
                <SelectItem value="none">None</SelectItem>
                {ESTIMATE_OPTIONS.map((option) => (
                  <SelectItem key={option.value} value={String(option.value)}>
                    {option.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <FormMessage />
          </FormItem>
        );
      }}
    />
  );
}
