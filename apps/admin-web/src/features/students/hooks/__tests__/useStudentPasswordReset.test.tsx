import { act, renderHook } from '@testing-library/react';
import type { Tables } from '@altitutor/shared';
import { useStudentPasswordReset } from '../useStudentPasswordReset';

jest.mock('next/navigation', () => ({ useRouter: () => ({ push: jest.fn() }) }));

it('offers in-person registration to a trial Student who already has a login', () => {
  const student = { id: 'student', status: 'TRIAL', user_id: 'existing-login' } as Tables<'students'>;
  const { result } = renderHook(() => useStudentPasswordReset({ student }));
  expect(result.current.passwordResetLabel).toBe('Send registration link');
  act(() => result.current.openPasswordResetOrRegistration());
  expect(result.current.inviteDialogOpen).toBe(true);
  expect(result.current.inviteDialogType).toBe('registration');
  expect(result.current.hasPasswordResetLinkSent).toBe(false);
});
