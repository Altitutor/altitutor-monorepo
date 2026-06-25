'use client';

import Link from 'next/link';
import { MARKETING_TOKENS } from '@altitutor/shared';
import { AuthPageHeader } from '@/features/auth/components/AuthPageHeader';
import { cn } from '@/shared/utils';

const { typography: typo } = MARKETING_TOKENS;

export function LoginPageLayout({
  children,
  title = 'Log in',
  subtitle = 'Sign in to access your student dashboard.',
}: {
  children: React.ReactNode;
  title?: string;
  subtitle?: string;
}) {
  return (
    <div className="relative flex min-h-dvh flex-col bg-background text-foreground">
      <AuthPageHeader />

      <main className="relative z-10 flex flex-1 flex-col items-center justify-center px-4 py-12">
        <div className="auth-entrance w-full max-w-md">
          <div className="mb-10">
            <span
              className={cn(
                'text-xs font-bold uppercase tracking-[0.2em] text-primary',
                typo.dataMono,
              )}
            >
              Altitutor
            </span>
            <h1
              className={cn(
                'mt-2 text-4xl font-bold leading-tight text-foreground sm:text-5xl',
                typo.headingSans,
              )}
            >
              {title}
            </h1>
            <p className={cn('mt-3 text-muted-foreground', typo.secondarySans)}>{subtitle}</p>
          </div>
          {children}
          <p
            className={cn(
              'mt-6 text-center text-sm text-muted-foreground',
              typo.secondarySans,
            )}
          >
            Don&apos;t have an account?{' '}
            <Link
              href="/booking/trial-session"
              className="font-medium text-primary underline-offset-2 transition-colors hover:underline"
            >
              Register as a student
            </Link>
          </p>
        </div>
      </main>
    </div>
  );
}
