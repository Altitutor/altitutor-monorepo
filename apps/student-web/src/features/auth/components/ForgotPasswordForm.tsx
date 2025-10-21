'use client';

import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useAuthStore } from '@/features/auth/hooks';
import { AuthState as AuthStore } from '@/features/auth/types';
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
import { Loader2 } from 'lucide-react';
import Link from 'next/link';
import Image from 'next/image';
import { useTheme } from 'next-themes';
import { authApi } from '@/features/auth/api';

const forgotPasswordSchema = z.object({
  email: z.string().email('Please enter a valid email address'),
});

type ForgotPasswordData = z.infer<typeof forgotPasswordSchema>;

export function ForgotPasswordForm() {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const { resolvedTheme } = useTheme();

  const form = useForm<ForgotPasswordData>({
    resolver: zodResolver(forgotPasswordSchema),
    defaultValues: {
      email: '',
    },
  });

  const onSubmit = async (data: ForgotPasswordData) => {
    setLoading(true);
    setError(null);
    try {
      await authApi.requestPasswordReset(data);
      setSuccess(true);
    } catch (error) {
      setError(error instanceof Error ? error.message : 'An error occurred');
    } finally {
      setLoading(false);
    }
  };

  if (success) {
    return (
      <div className="w-full max-w-md space-y-6 p-6 bg-white dark:bg-brand-dark-card rounded-lg shadow-lg">
        <div className="flex justify-center">
          <Image 
            src={resolvedTheme === 'dark' ? "/images/logo-icon-dark.svg" : "/images/logo-icon-light.svg"}
            alt="Altitutor Logo" 
            width={120} 
            height={120} 
            className="mb-4"
          />
        </div>
        <div className="space-y-2 text-center">
          <h2 className="text-2xl font-bold text-green-600 dark:text-green-400">Check Your Email</h2>
          <p className="text-gray-500 dark:text-gray-400">
            If an account exists with that email, we've sent password reset instructions.
          </p>
        </div>
        <Button 
          asChild
          className="w-full bg-brand-darkBlue hover:bg-brand-mediumBlue dark:bg-brand-lightBlue dark:text-white dark:hover:bg-brand-lightBlue/90"
        >
          <Link href="/login">Return to Login</Link>
        </Button>
      </div>
    );
  }

  return (
    <div className="w-full max-w-md space-y-6 p-6 bg-white dark:bg-brand-dark-card rounded-lg shadow-lg">
      <div className="flex justify-center">
        <Image 
          src={resolvedTheme === 'dark' ? "/images/logo-icon-dark.svg" : "/images/logo-icon-light.svg"}
          alt="Altitutor Logo" 
          width={120} 
          height={120} 
          className="mb-4"
        />
      </div>
      <div className="space-y-2 text-center">
        <h1 className="text-2xl font-bold">Reset Password</h1>
        <p className="text-gray-500 dark:text-gray-400">
          Enter your email to receive reset instructions
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
                <FormLabel>Email</FormLabel>
                <FormControl>
                  <Input
                    type="email"
                    placeholder="Enter your email"
                    {...field}
                  />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />

          <div className="space-y-4">
            <Button
              type="submit"
              className="w-full bg-brand-darkBlue hover:bg-brand-mediumBlue dark:bg-brand-lightBlue dark:text-dark dark:hover:bg-brand-lightBlue/90"
              disabled={loading}
            >
              {loading ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Sending...
                </>
              ) : (
                'Send Reset Instructions'
              )}
            </Button>

            <Button
              variant="outline"
              className="w-full hover:bg-brand-lightBlue/20 dark:hover:bg-brand-dark-card"
              asChild
            >
              <Link href="/login">Back to Login</Link>
            </Button>
          </div>
        </form>
      </Form>
    </div>
  );
} 