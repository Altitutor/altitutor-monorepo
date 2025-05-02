'use client';

import { useState, useEffect } from 'react';
import { ResetPasswordForm } from '@/components/auth/ResetPasswordForm';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Loader2 } from 'lucide-react';
import Link from 'next/link';

export default function ResetPasswordPage() {
  const [isLoading, setIsLoading] = useState(true);
  const [hashExists, setHashExists] = useState(false);

  useEffect(() => {
    // Check if there's a hash in the URL (this indicates a valid reset link)
    const checkHash = () => {
      const hash = window.location.hash;
      setHashExists(!!hash && hash.includes('access_token='));
      setIsLoading(false);
    };

    // Small timeout to ensure the hash is available (especially in Safari)
    setTimeout(checkHash, 100);
  }, []);

  if (isLoading) {
    return (
      <div className="h-[calc(100vh-var(--navbar-height))] flex items-center justify-center bg-gray-50 dark:bg-brand-dark-bg px-4">
        <div className="absolute top-0 left-0 w-full h-full bg-gradient-to-b from-transparent to-brand-lightBlue/20 dark:to-brand-dark-card/50 z-0"></div>
        <div className="relative z-10 flex flex-col items-center">
          <Loader2 className="h-8 w-8 animate-spin text-brand-darkBlue dark:text-brand-lightBlue mb-4" />
          <div className="text-center">Preparing password reset...</div>
        </div>
      </div>
    );
  }

  if (!hashExists) {
    return (
      <div className="h-[calc(100vh-var(--navbar-height))] flex items-center justify-center bg-gray-50 dark:bg-brand-dark-bg px-4">
        <div className="absolute top-0 left-0 w-full h-full bg-gradient-to-b from-transparent to-brand-lightBlue/20 dark:to-brand-dark-card/50 z-0"></div>
        <div className="relative z-10">
          <Alert variant="destructive" className="mb-4">
            <AlertDescription>
              Invalid or missing reset token. Please request a new password reset.
            </AlertDescription>
          </Alert>
          <div className="flex justify-center">
            <Button asChild className="bg-brand-darkBlue hover:bg-brand-mediumBlue dark:bg-brand-lightBlue dark:text-white dark:hover:bg-brand-lightBlue/90">
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