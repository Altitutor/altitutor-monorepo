'use client';

import { UseFormReturn, useFieldArray } from 'react-hook-form';
import {
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@altitutor/ui';
import { Input } from '@altitutor/ui';
import { PhoneInput } from '@altitutor/ui';
import { Button } from '@altitutor/ui';
import { Plus, X } from 'lucide-react';
import type { RegistrationFormValues } from '../validations';
import { studentBtnOutline } from '@/shared/lib/student-visual';

interface RegistrationStep2ParentDetailsProps {
  form: UseFormReturn<RegistrationFormValues>;
}

export function RegistrationStep2ParentDetails({
  form,
}: RegistrationStep2ParentDetailsProps) {
  const { fields, append, remove } = useFieldArray({
    control: form.control,
    name: 'parents',
  });

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-semibold">Parent Details</h3>
        <Button
          type="button"
          variant="outline"
          size="sm"
          className={studentBtnOutline}
          onClick={() => append({ first_name: '', last_name: '', email: '', phone: '' })}
        >
          <Plus className="h-4 w-4 mr-2" />
          Add Another Parent
        </Button>
      </div>
      
      <p className="text-sm text-muted-foreground">
        At least one parent must have both email and phone number.
      </p>

      <div className="space-y-6">
        {fields.map((field, index) => (
          <div key={field.id} className="border rounded-lg p-4 space-y-4">
            <div className="flex items-center justify-between">
              <h4 className="font-medium">Parent {index + 1}</h4>
              {fields.length > 1 && (
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={() => remove(index)}
                >
                  <X className="h-4 w-4" />
                </Button>
              )}
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <FormField
                control={form.control}
                name={`parents.${index}.first_name`}
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>First Name *</FormLabel>
                    <FormControl>
                      <Input {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              
              <FormField
                control={form.control}
                name={`parents.${index}.last_name`}
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Last Name *</FormLabel>
                    <FormControl>
                      <Input {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <FormField
                control={form.control}
                name={`parents.${index}.email`}
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Email *</FormLabel>
                    <FormControl>
                      <Input type="email" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name={`parents.${index}.phone`}
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Phone *</FormLabel>
                    <FormControl>
                      <PhoneInput
                        value={field.value}
                        onChange={field.onChange}
                        error={form.formState.errors.parents?.[index]?.phone?.message}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
