'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Button } from '@/components/ui/button';
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Loader2, CheckCircle2 } from 'lucide-react';
import Image from 'next/image';
import { useTheme } from 'next-themes';
import { authApi } from '@/features/auth/api';
import { useSupabaseClient } from '@/shared/lib/supabase/client';

const resetPasswordSchema = z.object({
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

type ResetPasswordData = z.infer<typeof resetPasswordSchema>;

export function ResetPasswordForm() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const [sessionValid, setSessionValid] = useState<boolean | null>(null);
  const { resolvedTheme } = useTheme();
  const supabase = useSupabaseClient();

  const form = useForm<ResetPasswordData>({
    resolver: zodResolver(resetPasswordSchema),
    defaultValues: {
      password: '',
      confirmPassword: '',
    },
  });

  // Verify session is valid for password reset on component mount
  useEffect(() => {
    const verifySession = async () => {
      try {
        const { data: { session }, error } = await supabase.auth.getSession();
        if (error || !session) {
          console.error('Session verification failed:', error);
          setSessionValid(false);
          setError('Invalid or expired reset session. Please request a new password reset.');
        } else {
          setSessionValid(true);
        }
      } catch (err) {
        console.error('Session check error:', err);
        setSessionValid(false);
        setError('Unable to verify reset session. Please try again.');
      }
    };

    verifySession();
  }, [supabase]);

  const onSubmit = async (data: ResetPasswordData) => {
    if (sessionValid !== true) {
      setError('Session not valid. Please request a new password reset.');
      return;
    }

    setLoading(true);
    setError(null);
    setSuccess(false);

    try {
      await authApi.confirmPasswordReset({
        password: data.password,
      });
      
      setSuccess(true);
      
      // Redirect after a brief delay to show success message
      setTimeout(() => {
      router.push('/login?reset=success');
      }, 2000);
      
    } catch (error) {
      console.error('Password reset error:', error);
      setError(
        error instanceof Error 
          ? error.message 
          : 'An error occurred while resetting your password. Please try again or request a new reset link.'
      );
    } finally {
      setLoading(false);
    }
  };

  // Show loading state while verifying session
  if (sessionValid === null) {
    return (
      <div className="w-full max-w-md space-y-6 p-6 bg-white dark:bg-brand-dark-card rounded-lg shadow-lg">
        <div className="flex justify-center">
          <Loader2 className="h-8 w-8 animate-spin text-brand-darkBlue dark:text-brand-lightBlue" />
        </div>
        <div className="text-center">
          <p className="text-muted-foreground">Verifying reset session...</p>
        </div>
      </div>
    );
  }

  // Show error if session is invalid
  if (sessionValid === false) {
    return (
      <div className="w-full max-w-md space-y-6 p-6 bg-white dark:bg-brand-dark-card rounded-lg shadow-lg">
        <div className="space-y-2 text-center">
          <div className="flex justify-center">
            <Image 
              src={resolvedTheme === 'dark' ? "/images/logo-icon-dark.svg" : "/images/logo-icon-light.svg"}
              alt="Altitutor Logo" 
              width={120} 
              height={120} 
              className="mb-4"
            />
          </div>
          <h1 className="text-2xl font-bold">Session Expired</h1>
        </div>

        <Alert variant="destructive">
          <AlertDescription>{error}</AlertDescription>
        </Alert>

        <div className="flex flex-col gap-2">
          <Button 
            onClick={() => router.push('/forgot-password')}
            className="w-full bg-brand-darkBlue hover:bg-brand-mediumBlue dark:bg-brand-lightBlue dark:text-white dark:hover:bg-brand-lightBlue/90"
          >
            Request New Reset
          </Button>
          <Button 
            variant="outline" 
            onClick={() => router.push('/login')}
            className="w-full"
          >
            Back to Login
          </Button>
        </div>
      </div>
    );
  }

  // Show success state
  if (success) {
    return (
      <div className="w-full max-w-md space-y-6 p-6 bg-white dark:bg-brand-dark-card rounded-lg shadow-lg">
        <div className="space-y-2 text-center">
          <div className="flex justify-center">
            <CheckCircle2 className="h-16 w-16 text-green-600 mb-4" />
          </div>
          <h1 className="text-2xl font-bold">Password Reset Successful</h1>
          <p className="text-gray-500 dark:text-gray-400">
            Your password has been updated successfully. Redirecting to login...
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="w-full max-w-md space-y-6 p-6 bg-white dark:bg-brand-dark-card rounded-lg shadow-lg">
      <div className="space-y-2 text-center">
        <div className="flex justify-center">
          <Image 
            src={resolvedTheme === 'dark' ? "/images/logo-icon-dark.svg" : "/images/logo-icon-light.svg"}
            alt="Altitutor Logo" 
            width={120} 
            height={120} 
            className="mb-4"
          />
        </div>
        <h1 className="text-2xl font-bold">Reset Your Password</h1>
        <p className="text-gray-500 dark:text-gray-400">
          Enter your new password below
        </p>
      </div>

      {error && (
        <Alert variant="destructive">
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

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
                    placeholder="Enter your new password"
                    disabled={loading}
                    {...field}
                  />
                </FormControl>
                <FormMessage />
                <div className="text-xs text-muted-foreground">
                  Password must be at least 8 characters with uppercase, lowercase, and a number
                </div>
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
                    placeholder="Confirm your new password"
                    disabled={loading}
                    {...field}
                  />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />

          <Button
            type="submit"
            className="w-full bg-brand-darkBlue hover:bg-brand-mediumBlue dark:bg-brand-lightBlue dark:text-white dark:hover:bg-brand-lightBlue/90"
            disabled={loading}
          >
            {loading ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Resetting Password...
              </>
            ) : (
              'Reset Password'
            )}
          </Button>
        </form>
      </Form>

      <div className="text-center">
        <Button 
          variant="link" 
          onClick={() => router.push('/login')}
          className="text-brand-mediumBlue dark:text-brand-lightBlue"
          disabled={loading}
        >
          Back to Login
        </Button>
      </div>
    </div>
  );
} 