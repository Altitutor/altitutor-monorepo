'use client';

import { useSearchParams } from 'next/navigation';
import { LoginForm, LoginPageLayout } from '@/features/auth/components';
import { Alert, AlertDescription } from '@altitutor/ui';
import { CheckCircle2 } from 'lucide-react';

export default function LoginPage() {
  const searchParams = useSearchParams();
  const resetSuccess = searchParams.get('reset') === 'success';
  const error = searchParams.get('error');

  return (
    <LoginPageLayout>
      <div className="space-y-4">
        {resetSuccess && (
          <Alert className="bg-green-50 border-green-200 dark:bg-green-900/20 dark:border-green-800">
            <CheckCircle2 className="h-4 w-4 text-green-600 dark:text-green-400" />
            <AlertDescription className="text-green-700 dark:text-green-400">
              Your password has been successfully reset. You can now log in with your new password.
            </AlertDescription>
          </Alert>
        )}
        {error && (
          <Alert variant="destructive">
            <AlertDescription>{decodeURIComponent(error)}</AlertDescription>
          </Alert>
        )}
        <LoginForm />
      </div>
    </LoginPageLayout>
  );
}
