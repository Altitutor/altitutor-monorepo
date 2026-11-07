import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { ToastProvider } from '@altitutor/ui';
import type { Tables } from '@altitutor/shared';
import { StudentAccountSection } from '../StudentAccountSection';

jest.mock('../SendStudentInviteDialog', () => ({
  SendStudentInviteDialog: ({ isOpen, linkType }: { isOpen: boolean; linkType: string }) => isOpen ? <div role="dialog">{linkType}</div> : null,
}));
jest.mock('@/features/auth/components/password-reset/AdminPasswordResetSection', () => ({
  AdminPasswordResetSection: () => <button>Send password reset</button>,
}));

function renderAccount(status: Tables<'students'>['status'], deleted = false) {
  const student = { id: 'student-1', first_name: 'UCAT', last_name: 'Student', user_id: 'login-1', status, deleted_at: deleted ? '2026-01-01' : null } as Tables<'students'>;
  return render(<QueryClientProvider client={new QueryClient()}><ToastProvider><StudentAccountSection student={student} /></ToastProvider></QueryClientProvider>);
}

it('offers registration alongside password reset for a trial Student with a login', async () => {
  renderAccount('TRIAL');
  expect(screen.getByRole('button', { name: 'Send password reset' })).toBeInTheDocument();
  await userEvent.click(screen.getByRole('button', { name: 'Send registration link' }));
  expect(screen.getByRole('dialog')).toHaveTextContent('registration');
});

it('starts onboarding for an online-only Student without offering immediate activation', async () => {
  const originalFetch = global.fetch;
  const request = jest.fn().mockResolvedValue({ ok: true, json: async () => ({ journeyId: 'journey-1' }) });
  global.fetch = request;
  try {
    renderAccount(null);
    expect(screen.queryByRole('button', { name: /activate/i })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Send registration link' })).not.toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: 'Start in-person onboarding' }));
    expect(request).toHaveBeenCalledWith('/api/students/student-1/start-in-person', { method: 'POST' });
  } finally { global.fetch = originalFetch; }
});

it.each(['ACTIVE', 'DISCONTINUED'] as const)('does not restart onboarding for %s Students', (status) => {
  renderAccount(status);
  expect(screen.queryByRole('button', { name: 'Start in-person onboarding' })).not.toBeInTheDocument();
  expect(screen.queryByRole('button', { name: 'Send registration link' })).not.toBeInTheDocument();
});

it('keeps deleted Students unavailable', () => {
  renderAccount(null, true);
  expect(screen.queryByRole('button')).not.toBeInTheDocument();
});
