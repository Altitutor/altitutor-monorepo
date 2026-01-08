'use client';

import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Button } from '@altitutor/ui';
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@altitutor/ui';
import { Input } from '@altitutor/ui';
import { Loader2, CheckCircle2 } from 'lucide-react';
import { useToast } from '@altitutor/ui';
import { authApi } from '@/features/auth/api';
import type { Database } from '@altitutor/shared';

type StudentProfile = Database['public']['Views']['vstudent_profile']['Row'];

const updatePasswordSchema = z.object({
  password: z.string()
    .min(8, 'Password must be at least 8 characters')
    .regex(/[A-Z]/, 'Password must contain at least one uppercase letter')
    .regex(/[a-z]/, 'Password must contain at least one lowercase letter')
    .regex(/[0-9]/, 'Password must contain at least one number'),
  confirmPassword: z.string(),
}).refine((data) => data.password === data.confirmPassword, {
  message: "Passwords don't match",
  path: ["confirmPassword"],
});

type UpdatePasswordData = z.infer<typeof updatePasswordSchema>;

interface AccountTabProps {
  profile: StudentProfile;
}

export function AccountTab({ profile }: AccountTabProps) {
  const { toast } = useToast();
  const [isLoading, setIsLoading] = useState(false);
  const [isSuccess, setIsSuccess] = useState(false);

  const form = useForm<UpdatePasswordData>({
    resolver: zodResolver(updatePasswordSchema),
    defaultValues: {
      password: '',
      confirmPassword: '',
    },
  });

  const onSubmit = async (data: UpdatePasswordData) => {
    try {
      setIsLoading(true);
      setIsSuccess(false);
      
      await authApi.updatePassword({ password: data.password });
      
      setIsSuccess(true);
      form.reset();
      
      toast({
        title: 'Success',
        description: 'Password updated successfully.',
      });
    } catch (error) {
      console.error('Failed to update password:', error);
      toast({
        title: 'Error',
        description: error instanceof Error ? error.message : 'Failed to update password. Please try again.',
        variant: 'destructive',
      });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="space-y-6">
      <h3 className="text-lg font-semibold">Account</h3>
      
      <div className="space-y-4">
        <p className="text-sm text-muted-foreground">
          Update your password. Make sure it's at least 8 characters long and contains uppercase, lowercase, and a number.
        </p>
        
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            <FormField
              control={form.control}
              name="password"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>New Password</FormLabel>
                  <FormControl>
                    <Input
                      type="password"
                      placeholder="Enter new password"
                      {...field}
                      disabled={isLoading}
                    />
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
                  <FormLabel>Confirm Password</FormLabel>
                  <FormControl>
                    <Input
                      type="password"
                      placeholder="Confirm new password"
                      {...field}
                      disabled={isLoading}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            
            <Button
              type="submit"
              disabled={isLoading || isSuccess}
              className="w-fit"
            >
              {isLoading ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Updating password...
                </>
              ) : isSuccess ? (
                <>
                  <CheckCircle2 className="mr-2 h-4 w-4" />
                  Password updated
                </>
              ) : (
                'Update Password'
              )}
            </Button>
          </form>
        </Form>
      </div>
    </div>
  );
}

