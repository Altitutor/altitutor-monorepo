import { useState, useCallback, useMemo } from 'react';
import type { Tables } from '@altitutor/shared';

interface UseStaffPasswordResetProps {
  staff: Tables<'staff'> | null;
}

interface UseStaffPasswordResetReturn {
  inviteDialogOpen: boolean;
  hasPasswordResetLinkSent: boolean;
  passwordResetLabel: string;
  
  // Actions
  openPasswordResetOrRegistration: () => void;
  closeInviteDialog: () => void;
  setPasswordResetLinkSent: (sent: boolean) => void;
}

/**
 * Hook for managing staff password reset and invite logic
 * Determines the appropriate action based on staff account state
 */
export function useStaffPasswordReset({
  staff,
}: UseStaffPasswordResetProps): UseStaffPasswordResetReturn {
  const [inviteDialogOpen, setInviteDialogOpen] = useState(false);
  const [hasPasswordResetLinkSent, setHasPasswordResetLinkSent] = useState(false);

  const passwordResetLabel = useMemo(() => {
    if (!staff) return 'Send password reset';
    
    if (!staff.user_id) {
      return 'Send invite';
    } else {
      return 'Send password reset';
    }
  }, [staff]);

  const openPasswordResetOrRegistration = useCallback(() => {
    if (!staff) return;
    
    if (!staff.user_id) {
      // No account -> Send Invite
      setInviteDialogOpen(true);
    } else {
      // Has account -> Password Reset (handled by parent component)
      // This hook just sets the flag, parent handles the actual reset
      setHasPasswordResetLinkSent(true);
    }
  }, [staff]);

  const closeInviteDialog = useCallback(() => {
    setInviteDialogOpen(false);
  }, []);

  return {
    inviteDialogOpen,
    hasPasswordResetLinkSent,
    passwordResetLabel,
    openPasswordResetOrRegistration,
    closeInviteDialog,
    setPasswordResetLinkSent: setHasPasswordResetLinkSent,
  };
}
