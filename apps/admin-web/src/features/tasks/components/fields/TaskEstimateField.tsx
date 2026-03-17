'use client';

import {
  Button,
  FormControl,
  FormField,
  FormItem,
  FormMessage,
  SearchableSelect,
} from '@altitutor/ui';
import { Gauge } from 'lucide-react';
import { UseFormReturn } from 'react-hook-form';
import { cn } from '@/shared/utils/index';
import { ESTIMATE_OPTIONS, getEstimateLabel } from '../../utils/taskUtils';
import type { TaskFormData } from '../../types';

interface TaskEstimateFieldProps {
  form: UseFormReturn<TaskFormData>;
}

const NONE_OPTION = { value: null, label: 'None' } as const;
type EstimateOption = (typeof ESTIMATE_OPTIONS)[number] | typeof NONE_OPTION;

const ALL_ESTIMATE_ITEMS: EstimateOption[] = [NONE_OPTION, ...ESTIMATE_OPTIONS];

export function TaskEstimateField({ form }: TaskEstimateFieldProps) {
  return (
    <FormField
      control={form.control}
      name="estimate"
      render={({ field }) => {
        const estimateValue = field.value;
        const displayValue = estimateValue ? getEstimateLabel(estimateValue) : null;
        const selectedItem =
          estimateValue == null
            ? NONE_OPTION
            : ESTIMATE_OPTIONS.find((o) => o.value === estimateValue) ?? NONE_OPTION;

        return (
          <FormItem>
            <FormControl>
              <SearchableSelect<EstimateOption>
                items={ALL_ESTIMATE_ITEMS}
                value={selectedItem}
                onValueChange={(item) => {
                  field.onChange(item?.value ?? null);
                }}
                getItemLabel={(opt) => opt.label}
                getItemId={(opt) => (opt.value == null ? 'none' : String(opt.value))}
                placeholder="Set estimate"
                trigger={
                  <Button variant="outline" className="w-full justify-start font-normal">
                    <Gauge className="h-4 w-4 text-muted-foreground" />
                    <span className={cn(!estimateValue && 'text-muted-foreground')}>
                      {displayValue || 'Set estimate'}
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
