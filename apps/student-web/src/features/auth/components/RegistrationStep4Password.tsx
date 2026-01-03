'use client';

import { UseFormReturn } from 'react-hook-form';
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@altitutor/ui';
import { Input } from '@altitutor/ui';

type RegistrationFormValues = {
  student: any;
  parents: any[];
  availability: any;
  password: string;
  confirmPassword: string;
};

interface RegistrationStep4PasswordProps {
  form: UseFormReturn<RegistrationFormValues>;
}

export function RegistrationStep4Password({
  form,
}: RegistrationStep4PasswordProps) {
  return (
    <div className="space-y-6">
      <div>
        <h3 className="text-lg font-semibold">Create Password</h3>
        <p className="text-sm text-muted-foreground mt-1">
          Choose a password for your account. It must be at least 6 characters long.
        </p>
      </div>

      <FormField
        control={form.control}
        name="password"
        render={({ field }) => (
          <FormItem>
            <FormLabel>Password *</FormLabel>
            <FormControl>
              <Input type="password" {...field} />
            </FormControl>
            <FormMessage />
          </FormItem>
        )}
      />

      <FormField
        control={form.control}
        name="confirmPassword"
        render={({ field }) => (
          <FormItem>
            <FormLabel>Confirm Password *</FormLabel>
            <FormControl>
              <Input type="password" {...field} />
            </FormControl>
            <FormMessage />
          </FormItem>
        )}
      />
    </div>
  );
}
