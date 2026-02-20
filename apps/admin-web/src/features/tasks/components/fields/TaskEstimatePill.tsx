'use client';

import {
  FormControl,
  FormField,
  FormItem,
} from '@altitutor/ui';
import { Select, SelectContent, SelectItem, SelectTrigger } from '@altitutor/ui';
import { Gauge } from 'lucide-react';
import { UseFormReturn } from 'react-hook-form';
import { ESTIMATE_OPTIONS, getEstimateLabel } from '../../utils/taskUtils';
import type { TaskFormData } from '../../types';

interface TaskEstimatePillProps {
  form: UseFormReturn<TaskFormData>;
}

export function TaskEstimatePill({ form }: TaskEstimatePillProps) {
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
                <SelectTrigger className="h-8 px-3 text-xs border rounded-full">
                  <div className="flex items-center gap-1.5">
                    <Gauge className="h-3 w-3 text-muted-foreground" />
                    <span>{displayValue || 'Estimate'}</span>
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
          </FormItem>
        );
      }}
    />
  );
}
