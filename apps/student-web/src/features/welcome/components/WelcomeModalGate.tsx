'use client';

import { useEffect, useState } from 'react';
import { useProfile } from '@/features/profile';
import { WelcomeModal } from './WelcomeModal';
import { useWelcomeModalAcknowledge } from '../hooks/useWelcomeModalAcknowledge';

export function WelcomeModalGate() {
  const { data: profile, isLoading: isProfileLoading } = useProfile();
  const acknowledgeMutation = useWelcomeModalAcknowledge();
  const [open, setOpen] = useState(false);

  useEffect(() => {
    if (isProfileLoading) return;
    if (!profile) return;

    setOpen(profile.welcome_modal_acknowledged_at === null);
  }, [profile, isProfileLoading]);

  const handleAcknowledge = async () => {
    try {
      await acknowledgeMutation.mutateAsync();
      setOpen(false);
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
    />
  );
}
