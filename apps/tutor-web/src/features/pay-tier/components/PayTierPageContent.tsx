'use client';

import { useState } from 'react';
import { Loader2 } from 'lucide-react';
import { TutorPageContainer } from '@/shared/components/layouts';
import { SessionModal } from '@/features/sessions/components/SessionModal';
import { useCurrentStaff } from '@/features/staff/hooks/useStaffQuery';
import { usePayTierProgress } from '../hooks/usePayTierProgress';
import { PayTierTierCards } from './PayTierTierCards';
import { PayTierCheckInsTable } from './PayTierCheckInsTable';
import { PayTierProgressFlowchart } from './PayTierProgressFlowchart';

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
      <TutorPageContainer>
        <div className="flex justify-center py-24">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </div>
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
          <h1 className="text-3xl font-bold tracking-tight">Pay tier</h1>
          <p className="mt-1 text-muted-foreground">
            Your current pay tier. Fulfil the requirements of your tier, then request a check in with us to advance to the next tier.
          </p>
        </header>

        <PayTierProgressFlowchart />

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
