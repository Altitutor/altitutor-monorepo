'use client';

import {
  FormControl,
  FormField,
  FormItem,
  SearchableSelect,
  Button,
} from '@altitutor/ui';
import { Gauge } from 'lucide-react';
import { UseFormReturn } from 'react-hook-form';
import { ESTIMATE_OPTIONS, getEstimateLabel } from '../../utils/taskUtils';
import type { TaskFormData } from '../../types';

const ESTIMATE_ITEMS = [
  { id: 'none', value: null as number | null, label: 'None' },
  ...ESTIMATE_OPTIONS.map((o) => ({ id: String(o.value), value: o.value, label: o.label })),
];

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
        const selectedItem =
          estimateValue != null
            ? ESTIMATE_ITEMS.find((i) => i.value === estimateValue) ?? null
            : ESTIMATE_ITEMS[0];

        return (
          <FormItem>
            <FormControl>
              <SearchableSelect<(typeof ESTIMATE_ITEMS)[number]>
                items={ESTIMATE_ITEMS}
                value={selectedItem}
                onValueChange={(item) => field.onChange(item?.value ?? null)}
                getItemId={(i) => i.id}
                getItemLabel={(i) => i.label}
                placeholder="Estimate"
                searchPlaceholder="Search..."
                emptyMessage="No options found"
                trigger={
                  <Button
                    variant="outline"
                    className="h-8 px-3 text-xs border rounded-full w-auto"
                  >
                    <div className="flex items-center gap-1.5">
                      <Gauge className="h-3 w-3 text-muted-foreground" />
                      <span>
                        {estimateValue != null
                          ? getEstimateLabel(estimateValue)
                          : 'Estimate'}
                      </span>
                    </div>
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
