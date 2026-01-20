import { useState, useCallback, useMemo } from 'react';
import type { Tables } from '@altitutor/shared';

interface UseStudentPasswordResetProps {
  student: Tables<'students'> | null;
}

interface UseStudentPasswordResetReturn {
  inviteDialogOpen: boolean;
  inviteDialogType: 'invite' | 'registration';
  hasPasswordResetLinkSent: boolean;
  passwordResetLabel: string;
  
  // Actions
  openPasswordResetOrRegistration: () => void;
  closeInviteDialog: () => void;
  setPasswordResetLinkSent: (sent: boolean) => void;
}

/**
 * Hook for managing student password reset and invite logic
 * Determines the appropriate action based on student status and account state
 */
export function useStudentPasswordReset({
  student,
}: UseStudentPasswordResetProps): UseStudentPasswordResetReturn {
  const [inviteDialogOpen, setInviteDialogOpen] = useState(false);
  const [inviteDialogType, setInviteDialogType] = useState<'invite' | 'registration'>('invite');
  const [hasPasswordResetLinkSent, setHasPasswordResetLinkSent] = useState(false);

  const passwordResetLabel = useMemo(() => {
    if (!student) return 'Send password reset';
    
    const isRegistered = student.status === 'ACTIVE';
    const hasAccount = !!student.user_id;
    
    if (isRegistered && !hasAccount) {
      return 'Send invite';
    } else if ((hasAccount && !isRegistered) || (!hasAccount && !isRegistered)) {
      return 'Send registration link';
    } else {
      return 'Send password reset';
    }
  }, [student]);

  const openPasswordResetOrRegistration = useCallback(() => {
    if (!student) return;
    
    const isRegistered = student.status === 'ACTIVE';
    const hasAccount = !!student.user_id;
    
    if (isRegistered && !hasAccount) {
      // Case 1: Registered but no account -> Send Invite
      setInviteDialogType('invite');
      setInviteDialogOpen(true);
    } else if ((hasAccount && !isRegistered) || (!hasAccount && !isRegistered)) {
      // Case 2 & 3: Has account but not registered OR no account and not registered -> Send Registration Link
      setInviteDialogType('registration');
      setInviteDialogOpen(true);
    } else {
      // Case 4: Registered AND has account -> Password Reset (handled by parent component)
      // This hook just sets the flag, parent handles the actual reset
      setHasPasswordResetLinkSent(true);
    }
  }, [student]);

  const closeInviteDialog = useCallback(() => {
    setInviteDialogOpen(false);
  }, []);

  return {
    inviteDialogOpen,
    inviteDialogType,
    hasPasswordResetLinkSent,
    passwordResetLabel,
    openPasswordResetOrRegistration,
    closeInviteDialog,
    setPasswordResetLinkSent: setHasPasswordResetLinkSent,
  };
}
