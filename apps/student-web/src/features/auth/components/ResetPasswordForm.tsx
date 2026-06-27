'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import Link from 'next/link';
import { MARKETING_TOKENS } from '@altitutor/shared';
import { resetPasswordSchema } from '../validations';
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
import { useSupabaseClient } from '@/shared/lib/supabase/client';
import { studentBtnPrimary } from '@/shared/lib/student-visual';
import { cn } from '@/shared/utils';

const { typography: typo } = MARKETING_TOKENS;

const authCardClassName = cn(
  'space-y-5 rounded-3xl border border-border/80 bg-card p-8 text-card-foreground shadow-sm',
  typo.secondarySans,
);

const footerLinkClassName =
  'font-medium text-primary underline-offset-2 transition-colors hover:underline';

type ResetPasswordData = z.infer<typeof resetPasswordSchema>;

export function ResetPasswordForm() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [sessionState, setSessionState] = useState<'loading' | 'valid' | 'invalid'>('loading');
  const supabase = useSupabaseClient();

  const form = useForm<ResetPasswordData>({
    resolver: zodResolver(resetPasswordSchema),
    defaultValues: {
      password: '',
      confirmPassword: '',
    },
  });

  useEffect(() => {
    void (async () => {
      const {
        data: { session },
        error: sessionError,
      } = await supabase.auth.getSession();

      if (sessionError || !session) {
        setError('Invalid or expired reset session. Please request a new password reset.');
        setSessionState('invalid');
        return;
      }

      setSessionState('valid');
    })();
  }, [supabase]);

  const onSubmit = async (data: ResetPasswordData) => {
    if (sessionState !== 'valid') {
      setError('Session not valid. Please request a new password reset.');
      return;
    }

    setLoading(true);
    setError(null);

    try {
      await authApi.confirmPasswordReset({
        password: data.password,
      });
      router.push('/login?reset=success');
    } catch (submitError) {
      setError(
        submitError instanceof Error
          ? submitError.message
          : 'An error occurred while resetting your password. Please try again or request a new reset link.',
      );
    } finally {
      setLoading(false);
    }
  };

  if (sessionState === 'loading') {
    return (
      <div
        className={cn(
          authCardClassName,
          'flex flex-col items-center justify-center gap-4 py-12',
        )}
      >
        <Loader2 className="h-8 w-8 animate-spin text-primary" aria-hidden />
        <p className="text-sm text-muted-foreground">Validating reset link…</p>
      </div>
    );
  }

  if (sessionState === 'invalid') {
    return (
      <div className={authCardClassName}>
        <Alert variant="destructive">
          <AlertDescription>
            {error ?? 'Invalid or expired reset session. Please request a new password reset.'}
          </AlertDescription>
        </Alert>
        <Button
          asChild
          className={cn(
            studentBtnPrimary,
            'w-full bg-brand-darkBlue hover:bg-brand-mediumBlue dark:bg-brand-lightBlue dark:text-brand-darkBlue dark:hover:bg-brand-lightBlue/90',
          )}
        >
          <Link href="/forgot-password">Request new reset</Link>
        </Button>
        <p className="text-center text-sm text-muted-foreground">
          <Link href="/login" className={footerLinkClassName}>
            Back to sign in
          </Link>
        </p>
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
            name="password"
            render={({ field }) => (
              <FormItem>
                <FormLabel>New password</FormLabel>
                <FormControl>
                  <Input
                    type="password"
                    placeholder="Enter your new password"
                    autoComplete="new-password"
                    disabled={loading}
                    {...field}
                  />
                </FormControl>
                <FormMessage />
                <p className="text-xs text-muted-foreground">
                  Password must be at least 8 characters with uppercase, lowercase, and a number
                </p>
              </FormItem>
            )}
          />

          <FormField
            control={form.control}
            name="confirmPassword"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Confirm password</FormLabel>
                <FormControl>
                  <Input
                    type="password"
                    placeholder="Confirm your new password"
                    autoComplete="new-password"
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
            className={cn(
              studentBtnPrimary,
              'w-full bg-brand-darkBlue hover:bg-brand-mediumBlue dark:bg-brand-lightBlue dark:text-brand-darkBlue dark:hover:bg-brand-lightBlue/90',
            )}
            disabled={loading}
          >
            {loading ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Saving...
              </>
            ) : (
              'Set new password'
            )}
          </Button>
        </form>
      </Form>
    </div>
  );
}
