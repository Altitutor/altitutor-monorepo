'use client';

import { Suspense } from 'react';
import { SkeletonAuthCard } from '@altitutor/ui';
import { AcceptInviteForm } from '@/features/auth/components/AcceptInviteForm';

interface InvitePageProps {
  params: {
    token: string;
  };
}

function InvitePageContent({ token }: { token: string }) {
  return (
    <div className="min-h-[calc(100dvh-var(--navbar-height))] flex items-center justify-center bg-gray-50 dark:bg-brand-dark-bg px-4 py-10">
      <div className="absolute top-0 left-0 w-full h-full bg-gradient-to-b from-transparent to-brand-lightBlue/20 dark:to-brand-dark-card/50 z-0"></div>
      <div className="relative z-10">
        <AcceptInviteForm token={token} />
      </div>
    </div>
  );
}

export default function InvitePage({ params }: InvitePageProps) {
  return (
    <Suspense fallback={
      <div className="min-h-[calc(100dvh-var(--navbar-height))] flex items-center justify-center bg-gray-50 dark:bg-brand-dark-bg px-4 py-10">
        <SkeletonAuthCard />
      </div>
    }>
      <InvitePageContent token={params.token} />
    </Suspense>
  );
}
