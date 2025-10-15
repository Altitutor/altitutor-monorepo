'use client';

import { useState, useEffect, Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import { ResetPasswordForm } from '@/features/auth/components/ResetPasswordForm';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Loader2 } from 'lucide-react';
import Link from 'next/link';
import { useSupabaseClient } from '@/shared/lib/supabase/client';

function ResetPasswordContent() {
  const [isLoading, setIsLoading] = useState(true);
  const [isValidSession, setIsValidSession] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const supabase = useSupabaseClient();

  useEffect(() => {
    const validateSession = async () => {
      try {
        setIsLoading(true);
        setError(null);

        // Check if we have a valid session (PKCE flow)
        const { data: { session }, error: sessionError } = await supabase.auth.getSession();
        
        console.log('Reset password session check:', {
          hasSession: !!session,
          sessionError: sessionError?.message,
          userEmail: session?.user?.email
        });

        if (sessionError) {
          console.error('Session error during password reset validation:', sessionError);
          setError('Invalid or expired reset session. Please request a new password reset.');
          setIsValidSession(false);
          return;
        }

        if (!session) {
          setError('No active reset session found. Please click the reset link again or request a new one.');
          setIsValidSession(false);
          return;
        }

        // Session exists - user can proceed with password reset
        setIsValidSession(true);
        
      } catch (err) {
        console.error('Session validation error:', err);
        setError('Failed to validate reset session. Please try again.');
        setIsValidSession(false);
      } finally {
        setIsLoading(false);
      }
    };

    validateSession();
  }, [supabase]);

  if (isLoading) {
    return (
      <div className="h-[calc(100vh-var(--navbar-height))] flex items-center justify-center bg-gray-50 dark:bg-brand-dark-bg px-4">
        <div className="absolute top-0 left-0 w-full h-full bg-gradient-to-b from-transparent to-brand-lightBlue/20 dark:to-brand-dark-card/50 z-0"></div>
        <div className="relative z-10 flex flex-col items-center">
          <Loader2 className="h-8 w-8 animate-spin text-brand-darkBlue dark:text-brand-lightBlue mb-4" />
          <div className="text-center">Validating reset token...</div>
        </div>
      </div>
    );
  }

  if (!isValidSession || error) {
    return (
      <div className="h-[calc(100vh-var(--navbar-height))] flex items-center justify-center bg-gray-50 dark:bg-brand-dark-bg px-4">
        <div className="absolute top-0 left-0 w-full h-full bg-gradient-to-b from-transparent to-brand-lightBlue/20 dark:to-brand-dark-card/50 z-0"></div>
        <div className="relative z-10 max-w-md w-full">
          <Alert variant="destructive" className="mb-4">
            <AlertDescription>
              {error || 'Invalid or missing reset token. Please request a new password reset.'}
            </AlertDescription>
          </Alert>
          <div className="flex flex-col gap-2">
            <Button asChild variant="default" className="w-full bg-brand-darkBlue hover:bg-brand-mediumBlue dark:bg-brand-lightBlue dark:text-white dark:hover:bg-brand-lightBlue/90">
              <Link href="/forgot-password">Request New Reset</Link>
            </Button>
            <Button asChild variant="outline" className="w-full">
              <Link href="/login">Back to Login</Link>
            </Button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="h-[calc(100vh-var(--navbar-height))] flex items-center justify-center bg-gray-50 dark:bg-brand-dark-bg px-4">
      <div className="absolute top-0 left-0 w-full h-full bg-gradient-to-b from-transparent to-brand-lightBlue/20 dark:to-brand-dark-card/50 z-0"></div>
      <div className="relative z-10">
        <ResetPasswordForm />
      </div>
    </div>
  );
}

export default function ResetPasswordPage() {
  return (
    <Suspense fallback={
      <div className="h-[calc(100vh-var(--navbar-height))] flex items-center justify-center bg-gray-50 dark:bg-brand-dark-bg px-4">
        <Loader2 className="h-8 w-8 animate-spin text-brand-darkBlue dark:text-brand-lightBlue" />
      </div>
    }>
      <ResetPasswordContent />
    </Suspense>
  );
} 