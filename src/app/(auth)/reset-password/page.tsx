'use client';

import { useSearchParams } from 'next/navigation';
import { ResetPasswordForm } from '@/components/auth/ResetPasswordForm';
import { Alert, AlertDescription } from '@/components/ui/alert';
import Link from 'next/link';
import { Button } from '@/components/ui/button';

export default function ResetPasswordPage() {
  const searchParams = useSearchParams();
  const token = searchParams.get('token');

  if (!token) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50 dark:bg-gray-900 px-4">
        <div className="w-full max-w-md space-y-6 p-6 bg-white dark:bg-gray-800 rounded-lg shadow-lg">
          <Alert variant="destructive">
            <AlertDescription>Invalid or missing reset token</AlertDescription>
          </Alert>
          <Button asChild className="w-full">
            <Link href="/login">Return to Login</Link>
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 dark:bg-gray-900 px-4">
      <ResetPasswordForm token={token} />
    </div>
  );
} 