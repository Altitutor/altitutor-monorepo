'use client';

import { useEffect, useState } from 'react';
import { useProfile } from '@/features/profile';
import { WelcomeModal } from './WelcomeModal';
import { useWelcomeModalAcknowledge } from '../hooks/useWelcomeModalAcknowledge';
import { useWelcomeModalContext } from '../hooks/useWelcomeModalContext';

export const OPEN_WELCOME_MODAL_EVENT = 'student-web:open-welcome-modal';

export function WelcomeModalGate() {
  const { data: profile, isLoading: isProfileLoading } = useProfile();
  const acknowledgeMutation = useWelcomeModalAcknowledge();
  const [open, setOpen] = useState(false);
  const [forceOpen, setForceOpen] = useState(false);
  const shouldShowModal = !!profile && profile.welcome_modal_acknowledged_at === null;
  const isEligibleToShow = shouldShowModal || forceOpen;
  const { data: contextData, isLoading: isContextLoading } = useWelcomeModalContext(open && isEligibleToShow);

  useEffect(() => {
    if (isProfileLoading) return;
    if (!profile) return;

    if (!forceOpen) {
      setOpen(profile.welcome_modal_acknowledged_at === null);
    }
  }, [profile, isProfileLoading, forceOpen]);

  useEffect(() => {
    const handler = () => {
      setForceOpen(true);
      setOpen(true);
    };

    window.addEventListener(OPEN_WELCOME_MODAL_EVENT, handler);
    return () => window.removeEventListener(OPEN_WELCOME_MODAL_EVENT, handler);
  }, []);

  const handleAcknowledge = async () => {
    try {
      await acknowledgeMutation.mutateAsync();
      setOpen(false);
      setForceOpen(false);
    } catch (_error) {
      // Error toast is handled by the mutation hook.
    }
  };

  const handleOpenChange = (nextOpen: boolean) => {
    // Require explicit acknowledgement action to dismiss.
    if (nextOpen) {
      setOpen(true);
    }
  };

  if (isProfileLoading || !profile) {
    return null;
  }

  return (
    <WelcomeModal
      open={open}
      onOpenChange={handleOpenChange}
      onAcknowledge={handleAcknowledge}
      isSubmitting={acknowledgeMutation.isPending}
      studentFirstName={profile?.first_name ?? null}
      subjects={contextData?.data.subjects ?? []}
      homeworkHelpTime={contextData?.data.homework_help_time ?? null}
      defaultClassHourlyRateCents={contextData?.data.default_class_hourly_rate_cents ?? null}
      isContextLoading={isContextLoading}
    />
  );
}
