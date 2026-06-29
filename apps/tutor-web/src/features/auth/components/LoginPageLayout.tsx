'use client';

import { useState } from 'react';
import { MARKETING_TOKENS } from '@altitutor/shared';
import { FeedbackDialog } from '@altitutor/ui';
import { AuthPageHeader } from '@/features/auth/components/AuthPageHeader';
import { TUTOR_APPLY_URL } from '@/shared/constants';
import { cn } from '@/shared/utils';

const { typography: typo } = MARKETING_TOKENS;

const footerLinkClassName =
  'font-medium text-primary underline-offset-2 transition-colors hover:underline';

export function LoginPageLayout({
  children,
  title = 'Log in',
  subtitle = 'Sign in to access your tutor dashboard.',
  footer,
}: {
  children: React.ReactNode;
  title?: string;
  subtitle?: string;
  footer?: React.ReactNode | null;
}) {
  const [contactOpen, setContactOpen] = useState(false);

  const defaultFooter = (
    <p className={cn('mt-6 text-center text-sm text-muted-foreground', typo.secondarySans)}>
      Don&apos;t have an account?{' '}
      <button type="button" onClick={() => setContactOpen(true)} className={footerLinkClassName}>
        Contact us
      </button>{' '}
      or{' '}
      <a
        href={TUTOR_APPLY_URL}
        className={footerLinkClassName}
        target="_blank"
        rel="noopener noreferrer"
      >
        apply to be a tutor
      </a>
    </p>
  );

  return (
    <div className="relative flex min-h-dvh flex-col bg-background text-foreground">
      <AuthPageHeader />

      <main className="relative z-10 flex flex-1 flex-col items-center justify-center px-4 py-12">
        <div className="w-full max-w-md">
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
          {footer === null ? null : footer ?? defaultFooter}
        </div>
      </main>

      <FeedbackDialog
        open={contactOpen}
        onOpenChange={setContactOpen}
        kind="contact"
        appName="tutor-web"
      />
    </div>
  );
}
