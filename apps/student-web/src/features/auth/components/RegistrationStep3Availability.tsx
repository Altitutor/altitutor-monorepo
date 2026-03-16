'use client';

import { UseFormReturn, Path } from 'react-hook-form';
import {
  FormControl,
  FormField,
  FormItem,
  FormLabel,
} from '@altitutor/ui';
import { Checkbox } from '@altitutor/ui';
import type { RegistrationFormValues } from '../validations';

interface RegistrationStep3AvailabilityProps {
  form: UseFormReturn<RegistrationFormValues>;
}

const AVAILABILITY_OPTIONS: Array<{
  key: keyof RegistrationFormValues['availability'];
  label: string;
}> = [
  { key: 'monday', label: 'Monday' },
  { key: 'tuesday', label: 'Tuesday' },
  { key: 'wednesday', label: 'Wednesday' },
  { key: 'thursday', label: 'Thursday' },
  { key: 'friday', label: 'Friday' },
  { key: 'saturday_am', label: 'Saturday Morning' },
  { key: 'saturday_pm', label: 'Saturday Afternoon' },
  { key: 'sunday_am', label: 'Sunday Morning' },
  { key: 'sunday_pm', label: 'Sunday Afternoon' },
];

export function RegistrationStep3Availability({
  form,
}: RegistrationStep3AvailabilityProps) {
  return (
    <div className="space-y-6">
      <div>
        <h3 className="text-lg font-semibold">Availability</h3>
        <p className="text-sm text-muted-foreground mt-1">
          Select at least one day/time when you're available for sessions.
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {AVAILABILITY_OPTIONS.map((option) => (
          <FormField
            key={option.key}
            control={form.control}
            name={`availability.${option.key}` as Path<RegistrationFormValues>}
            render={({ field }) => (
              <FormItem className="flex flex-row items-start space-x-3 space-y-0 rounded-md border p-4">
                <FormControl>
                  <Checkbox
                    checked={Boolean(field.value)}
                    onCheckedChange={field.onChange}
                  />
                </FormControl>
                <FormLabel className="font-normal cursor-pointer">
                  {option.label}
                </FormLabel>
              </FormItem>
            )}
          />
        ))}
      </div>
      {form.formState.errors.availability && (
        <p className="text-sm text-destructive">
          {form.formState.errors.availability.message}
        </p>
      )}
    </div>
  );
}
