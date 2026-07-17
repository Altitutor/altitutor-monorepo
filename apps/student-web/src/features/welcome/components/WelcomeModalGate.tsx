'use client';

import { useEffect, useState } from 'react';
import { useProfile } from '@/features/profile';
import { WelcomeOnboardingWizard } from './WelcomeOnboardingWizard';
import { useWelcomeModalAcknowledge } from '../hooks/useWelcomeModalAcknowledge';
import { useWelcomeModalContext } from '../hooks/useWelcomeModalContext';
import { isTourCompleted, STUDENT_WELCOME_TOUR } from '../lib/onboarding';

export const OPEN_WELCOME_MODAL_EVENT = 'student-web:open-welcome-modal';

export function WelcomeModalGate() {
  const { data: profile, isLoading: isProfileLoading } = useProfile();
  const acknowledgeMutation = useWelcomeModalAcknowledge();
  const [open, setOpen] = useState(false);
  const [forceOpen, setForceOpen] = useState(false);
  const [isCelebrating, setIsCelebrating] = useState(false);
  const hasAcknowledgedWelcome = isTourCompleted(profile, STUDENT_WELCOME_TOUR);
  const shouldShowModal = !!profile && !hasAcknowledgedWelcome;
  const isEligibleToShow = shouldShowModal || forceOpen || isCelebrating;
  const { data: contextData, isLoading: isContextLoading } = useWelcomeModalContext(
    open && isEligibleToShow,
  );

  useEffect(() => {
    if (isProfileLoading) return;
    if (!profile) return;
    if (forceOpen || isCelebrating) return;

    setOpen(!hasAcknowledgedWelcome);
  }, [
    profile,
    isProfileLoading,
    forceOpen,
    isCelebrating,
    hasAcknowledgedWelcome,
  ]);

  useEffect(() => {
    const handler = () => {
      setForceOpen(true);
      setIsCelebrating(false);
      setOpen(true);
    };

    window.addEventListener(OPEN_WELCOME_MODAL_EVENT, handler);
    return () => window.removeEventListener(OPEN_WELCOME_MODAL_EVENT, handler);
  }, []);

  const handleAcknowledge = async () => {
    setIsCelebrating(true);
    await acknowledgeMutation.mutateAsync();
  };

  const handleDismiss = () => {
    setOpen(false);
    setForceOpen(false);
    setIsCelebrating(false);
  };

  if (isProfileLoading || !profile) {
    return null;
  }

  return (
    <WelcomeOnboardingWizard
      open={open}
      onAcknowledge={handleAcknowledge}
      onDismiss={handleDismiss}
      isSubmitting={acknowledgeMutation.isPending}
      studentFirstName={profile?.first_name ?? null}
      subjects={contextData?.data.subjects ?? []}
      homeworkHelpTime={contextData?.data.homework_help_time ?? null}
      defaultClassHourlyRateCents={
        contextData?.data.default_class_hourly_rate_cents ?? null
      }
      isContextLoading={isContextLoading}
    />
  );
}
