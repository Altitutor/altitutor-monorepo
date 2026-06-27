'use client';

import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import Link from 'next/link';
import { MARKETING_TOKENS } from '@altitutor/shared';
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
import { authApi } from '@/features/auth/api';
import { cn } from '@/shared/utils';

const { typography: typo } = MARKETING_TOKENS;

const forgotPasswordSchema = z.object({
  email: z.string().email('Please enter a valid email address'),
});

const authCardClassName = cn(
  'space-y-5 rounded-3xl border border-border/80 bg-card p-8 text-card-foreground shadow-sm',
  typo.secondarySans,
);

const footerLinkClassName =
  'font-medium text-primary underline-offset-2 transition-colors hover:underline';

type ForgotPasswordData = z.infer<typeof forgotPasswordSchema>;

export function ForgotPasswordForm() {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

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
    } catch (submitError) {
      setError(submitError instanceof Error ? submitError.message : 'An error occurred');
    } finally {
      setLoading(false);
    }
  };

  if (success) {
    return (
      <div className={authCardClassName}>
        <div className="space-y-2 text-center">
          <h2 className={cn('text-2xl font-bold text-foreground', typo.headingSans)}>
            Check your email
          </h2>
          <p className="text-sm text-muted-foreground">
            If an account exists with that email, we&apos;ve sent password reset instructions.
          </p>
        </div>
        <Button
          asChild
          className="w-full bg-brand-darkBlue hover:bg-brand-mediumBlue dark:bg-brand-lightBlue dark:text-brand-darkBlue dark:hover:bg-brand-lightBlue/90"
        >
          <Link href="/login">Return to sign in</Link>
        </Button>
      </div>
    );
  }

  return (
    <div className={authCardClassName}>
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
                    autoComplete="email"
                    {...field}
                  />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />

          <Button
            type="submit"
            className="w-full bg-brand-darkBlue hover:bg-brand-mediumBlue dark:bg-brand-lightBlue dark:text-brand-darkBlue dark:hover:bg-brand-lightBlue/90"
            disabled={loading}
          >
            {loading ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Sending...
              </>
            ) : (
              'Send reset instructions'
            )}
          </Button>
        </form>
      </Form>

      <p className="text-center text-sm text-muted-foreground">
        <Link href="/login" className={footerLinkClassName}>
          Back to sign in
        </Link>
      </p>
    </div>
  );
}
