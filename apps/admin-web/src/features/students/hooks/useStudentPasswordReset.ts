import { useState, useCallback, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import type { Tables } from '@altitutor/shared';
import { studentAccountAction } from '../utils/studentAccountAction';

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
  const router = useRouter();
  const [inviteDialogOpen, setInviteDialogOpen] = useState(false);
  const [inviteDialogType, setInviteDialogType] = useState<'invite' | 'registration'>('invite');
  const [hasPasswordResetLinkSent, setHasPasswordResetLinkSent] = useState(false);

  const passwordResetLabel = useMemo(() => student ? studentAccountAction(student).label : 'Send password reset', [student]);

  const openPasswordResetOrRegistration = useCallback(() => {
    if (!student || student.deleted_at) return;
    const action = studentAccountAction(student);
    if (action.type === 'details') {
      router.push(`/students/${student.id}?tab=details`);
    } else if (action.type === 'reset') {
      setHasPasswordResetLinkSent(true);
    } else {
      setInviteDialogType(action.type);
      setInviteDialogOpen(true);
    }
  }, [student, router]);

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
