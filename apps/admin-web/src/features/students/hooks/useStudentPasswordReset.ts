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
    
    if (hasAccount) {
      return 'Send password reset';
    } else if (isRegistered) {
      return 'Send invite';
    } else {
      return 'Send registration link';
    }
  }, [student]);

  const openPasswordResetOrRegistration = useCallback(() => {
    if (!student) return;
    
    const isRegistered = student.status === 'ACTIVE';
    const hasAccount = !!student.user_id;
    
    if (hasAccount) {
      // Student has an auth account, even if profile registration is incomplete.
      setHasPasswordResetLinkSent(true);
    } else if (isRegistered) {
      // Case 1: Registered but no account -> Send Invite
      setInviteDialogType('invite');
      setInviteDialogOpen(true);
    } else {
      // No account and not registered -> Send Registration Link
      setInviteDialogType('registration');
      setInviteDialogOpen(true);
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
