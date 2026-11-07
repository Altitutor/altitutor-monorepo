import type { Tables } from '@altitutor/shared';

type StudentAccount = Pick<Tables<'students'>, 'status' | 'user_id' | 'deleted_at'>;

/** Primary shortcut; the details section also exposes password reset independently. */
export function studentAccountAction(student: StudentAccount) {
  if (student.deleted_at) return { type: 'details', label: 'View student' } as const;
  if (student.status === null) return { type: 'details', label: 'Start in-person onboarding' } as const;
  if (student.status === 'TRIAL') return { type: 'registration', label: 'Send registration link' } as const;
  if (student.user_id) return { type: 'reset', label: 'Send password reset' } as const;
  if (student.status === 'ACTIVE') return { type: 'invite', label: 'Send invite' } as const;
  return { type: 'details', label: 'View in-person relationship' } as const;
}
