import { render, screen } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import type { ReactNode } from 'react';
import { LogSessionModal } from '../LogSessionModal';

const mockFrom = jest.fn();
jest.mock('@/shared/lib/supabase/client', () => ({ getSupabaseClient: () => ({ from: mockFrom }) }));
jest.mock('@/shared/components', () => ({ AdminDialogShell: ({ children }: { children: ReactNode }) => <div role="dialog">{children}</div> }));
jest.mock('../../hooks/useLogSessionFlow', () => ({ useLogSessionFlow: () => ({ formData: { sessionId: 'retained-session' }, submissionState: 'idle' }) }));

it('requires restoration before offering a new submission for a retired log', async () => {
  mockFrom.mockReturnValue({ select: () => ({ eq: () => ({ maybeSingle: async () => ({ data: { deleted_at: '2026-10-31T00:00:00Z' }, error: null }) }) }) });
  render(<QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}>
    <LogSessionModal isOpen onClose={() => {}} currentStaffId="admin" />
  </QueryClientProvider>);
  expect(await screen.findByText(/Restore it from Settings/)).toBeVisible();
  expect(screen.queryByRole('button', { name: /Submit|Next/ })).not.toBeInTheDocument();
  expect(mockFrom).toHaveBeenCalledWith('vadmin_session_log_state');
});
