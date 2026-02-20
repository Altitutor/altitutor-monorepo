'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
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
import { Alert, AlertDescription } from '@altitutor/ui';
import { Loader2, CheckCircle2 } from 'lucide-react';
import Image from 'next/image';
import { useTheme } from 'next-themes';
import { invitesApi } from '../api/invites';
import { useValidateInviteQuery } from '../hooks/useValidateInviteQuery';
import { useSupabaseClient } from '@/shared/lib/supabase/client';

const acceptInviteSchema = z.object({
  email: z.string().email('Please enter a valid email address'),
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

type AcceptInviteData = z.infer<typeof acceptInviteSchema>;

interface AcceptInviteFormProps {
  token: string;
}

export function AcceptInviteForm({ token }: AcceptInviteFormProps) {
  const router = useRouter();
  const supabase = useSupabaseClient();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const { resolvedTheme } = useTheme();

  const { data: validateResult, isPending: validating } = useValidateInviteQuery(token);
  const inviteData = validateResult?.valid ? validateResult : null;
  const validateError =
    !validating && validateResult && !validateResult.valid
      ? validateResult.error ?? 'Invalid or expired invite token'
      : null;

  const form = useForm<AcceptInviteData>({
    resolver: zodResolver(acceptInviteSchema),
    defaultValues: {
      email: '',
      password: '',
      confirmPassword: '',
    },
  });

  // Pre-fill email when validation result has it
  useEffect(() => {
    if (inviteData?.data?.email) {
      form.setValue('email', inviteData.data.email);
    }
  }, [inviteData?.data?.email, form]);

  const onSubmit = async (data: AcceptInviteData) => {
    setLoading(true);
    setError(null);
    setSuccess(false);

    try {
      const result = await invitesApi.acceptInvite({
        token,
        email: data.email,
        password: data.password,
      });

      if (!result.success) {
        setError(result.message || 'Failed to create account');
        return;
      }

      setSuccess(true);

      // If we have session data, use it to sign in
      if (result.session) {
        try {
          // Sign in with the credentials we just created
          const { error: signInError } = await supabase.auth.signInWithPassword({
            email: data.email,
            password: data.password,
          });

          if (signInError) {
            console.error('Sign in error:', signInError);
            // Account created but auto-login failed, redirect to login
            setTimeout(() => {
              router.push('/login?invite=success');
            }, 2000);
            return;
          }

          // Determine redirect based on role
          const redirectPath = inviteData?.data?.role === 'TUTOR' 
            ? (process.env.NODE_ENV === 'production' ? 'https://tutor.altitutor.com' : 'http://localhost:3002')
            : '/dashboard';

          // Use full page redirect to ensure cookies are properly set on the server
          setTimeout(() => {
            window.location.href = redirectPath;
          }, 2000);
        } catch (signInErr) {
          console.error('Auto-login error:', signInErr);
          // Redirect to login page
          setTimeout(() => {
            router.push('/login?invite=success');
          }, 2000);
        }
      } else {
        // No session returned, redirect to login
        setTimeout(() => {
          router.push('/login?invite=success');
        }, 2000);
      }
    } catch (error) {
      console.error('Accept invite error:', error);
      setError(
        error instanceof Error 
          ? error.message 
          : 'An error occurred while creating your account. Please try again.'
      );
    } finally {
      setLoading(false);
    }
  };

  // Show loading state while validating token
  if (validating) {
    return (
      <div className="w-full max-w-md space-y-6 p-6 bg-white dark:bg-brand-dark-card rounded-lg shadow-lg">
        <div className="flex justify-center">
          <Loader2 className="h-8 w-8 animate-spin text-brand-darkBlue dark:text-brand-lightBlue" />
        </div>
        <div className="text-center">
          <p className="text-muted-foreground">Validating invite...</p>
        </div>
      </div>
    );
  }

  // Show error if token is invalid
  if ((error || validateError) && !inviteData) {
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
          <h1 className="text-2xl font-bold">Invalid Invite</h1>
        </div>

        <Alert variant="destructive">
          <AlertDescription>{error ?? validateError}</AlertDescription>
        </Alert>

        <div className="flex flex-col gap-2">
          <Button 
            onClick={() => router.push('/login')}
            className="w-full bg-brand-darkBlue hover:bg-brand-mediumBlue dark:bg-brand-lightBlue dark:text-white dark:hover:bg-brand-lightBlue/90"
          >
            Go to Login
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
          <h1 className="text-2xl font-bold">Account Created Successfully</h1>
          <p className="text-gray-500 dark:text-gray-400">
            Your account has been created. Redirecting...
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
        <h1 className="text-2xl font-bold">Create Your Account</h1>
        <p className="text-gray-500 dark:text-gray-400">
          Welcome, {inviteData?.data?.first_name} {inviteData?.data?.last_name}!
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
            name="email"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Email Address</FormLabel>
                <FormControl>
                  <Input
                    type="email"
                    placeholder="Enter your email"
                    disabled={loading}
                    {...field}
                  />
                </FormControl>
                <FormMessage />
                <div className="text-xs text-muted-foreground">
                  You can change this if needed
                </div>
              </FormItem>
            )}
          />

          <FormField
            control={form.control}
            name="password"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Password</FormLabel>
                <FormControl>
                  <Input
                    type="password"
                    placeholder="Create a password"
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
                    placeholder="Confirm your password"
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
                Creating Account...
              </>
            ) : (
              'Create Account'
            )}
          </Button>
        </form>
      </Form>
    </div>
  );
}

