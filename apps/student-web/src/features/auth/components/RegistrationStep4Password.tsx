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
  skipPassword?: boolean; // Existing accounts retain their sign-in methods.
}

export function RegistrationStep4Password({
  form,
  skipPassword = false,
}: RegistrationStep4PasswordProps) {
  if (skipPassword) return (
    <div className="space-y-3">
      <h3 className="text-lg font-semibold">Keep your existing login</h3>
      <p className="text-sm text-muted-foreground">In-person registration uses your existing account. Your password and connected sign-in methods stay the same.</p>
      <p className="text-sm text-muted-foreground">If you signed up with Google or Apple and need a password for the student portal, use Forgot password after registration.</p>
    </div>
  );
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
