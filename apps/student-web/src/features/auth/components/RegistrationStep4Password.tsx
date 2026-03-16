'use client';

import { UseFormReturn } from 'react-hook-form';
import {
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@altitutor/ui';
import { Input } from '@altitutor/ui';
import type { RegistrationFormValues } from '../validations';

interface RegistrationStep4PasswordProps {
  form: UseFormReturn<RegistrationFormValues>;
  skipPassword?: boolean; // If true, user is signing in with existing password
}

export function RegistrationStep4Password({
  form,
  skipPassword = false,
}: RegistrationStep4PasswordProps) {
  return (
    <div className="space-y-6">
      <div>
        <h3 className="text-lg font-semibold">
          {skipPassword ? 'Enter Your Password' : 'Create Password'}
        </h3>
        <p className="text-sm text-muted-foreground mt-1">
          {skipPassword
            ? 'Enter your password to verify your identity and complete registration.'
            : 'Choose a password for your account. It must be at least 6 characters long.'}
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

      {!skipPassword && (
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
      )}
    </div>
  );
}
