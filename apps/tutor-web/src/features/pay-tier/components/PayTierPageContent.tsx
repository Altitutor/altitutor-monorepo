'use client';

import { useState } from 'react';
import { Skeleton, SkeletonPageHeader, SkeletonTable } from '@altitutor/ui';
import { TutorPageContainer } from '@/shared/components/layouts';
import { SessionModal } from '@/features/sessions/components/SessionModal';
import { useCurrentStaff } from '@/features/staff/hooks/useStaffQuery';
import { usePayTierProgress } from '../hooks/usePayTierProgress';
import { PayTierTierCards } from './PayTierTierCards';
import { PayTierCheckInsTable } from './PayTierCheckInsTable';
import { PayTierHowItWorksDialog } from './PayTierHowItWorksDialog';

export function PayTierPageContent() {
  const { data: staff } = useCurrentStaff();
  const { data: progress, isLoading, isError, error } = usePayTierProgress();

  const [selectedSessionId, setSelectedSessionId] = useState<string | null>(null);
  const [isSessionModalOpen, setIsSessionModalOpen] = useState(false);

  const handleOpenSession = (sessionId: string) => {
    setSelectedSessionId(sessionId);
    setIsSessionModalOpen(true);
  };

  const handleCloseSessionModal = () => {
    setIsSessionModalOpen(false);
    setTimeout(() => setSelectedSessionId(null), 300);
  };

  if (isLoading) {
    return (
      <TutorPageContainer className="space-y-10">
        <SkeletonPageHeader />
        <Skeleton className="h-48 w-full rounded-xl" />
        <div className="grid gap-4 md:grid-cols-3">
          {Array.from({ length: 3 }).map((_, i) => (
            <Skeleton key={i} className="h-40 w-full rounded-xl" />
          ))}
        </div>
        <SkeletonTable rows={5} columns={4} />
      </TutorPageContainer>
    );
  }

  if (isError || !progress) {
    return (
      <TutorPageContainer>
        <p className="text-destructive">
          {error instanceof Error ? error.message : 'Unable to load pay tier'}
        </p>
      </TutorPageContainer>
    );
  }

  return (
    <>
      <TutorPageContainer className="space-y-10">
        <header>
          <div className="flex items-center gap-2">
            <h1 className="text-3xl font-bold tracking-tight">Pay tier</h1>
            <PayTierHowItWorksDialog />
          </div>
          <p className="mt-1 text-muted-foreground">
            Your current pay tier. Fulfil the requirements of your tier, then request a check in with us to advance to the next tier.
          </p>
        </header>

        <PayTierTierCards progress={progress} />
        <PayTierCheckInsTable checkIns={progress.checkIns} onOpenSession={handleOpenSession} />
      </TutorPageContainer>

      <SessionModal
        isOpen={isSessionModalOpen}
        sessionId={selectedSessionId}
        onClose={handleCloseSessionModal}
        currentStaffId={staff?.id ?? null}
        currentStaffIdForNotes={staff?.id ?? null}
      />
    </>
  );
}
