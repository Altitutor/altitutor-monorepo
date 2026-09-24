import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { AiConnectionsPage } from '../AiConnectionsPage';
import { changeAiConnection, listAiConnections } from '../../api/connections';

jest.mock('../../api/connections', () => ({ listAiConnections: jest.fn(), changeAiConnection: jest.fn() }));
jest.mock('@/shared/components', () => ({ SettingsPageHeader: ({ title }: { title: string }) => <h1>{title}</h1> }));
jest.mock('@altitutor/ui', () => ({ Button: ({ variant: _variant, ...props }: React.ButtonHTMLAttributes<HTMLButtonElement> & { variant?: string }) => <button {...props} /> }));

function mount() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } });
  render(<QueryClientProvider client={client}><AiConnectionsPage /></QueryClientProvider>);
}
beforeEach(() => {
  jest.clearAllMocks();
  jest.mocked(listAiConnections).mockResolvedValue([{ id: 'agent', name: 'Test agent', enabled: true, grantedAt: '2026-09-19' }]);
  jest.mocked(changeAiConnection).mockResolvedValue(undefined);
});

test('disconnect requires confirmation and is separate from revoking admin access', async () => {
  mount();
  fireEvent.click(await screen.findByRole('button', { name: 'Disconnect application' }));
  expect(changeAiConnection).not.toHaveBeenCalled();
  fireEvent.click(screen.getByRole('button', { name: 'Confirm disconnect' }));
  await waitFor(() => expect(changeAiConnection).toHaveBeenCalledWith('agent', 'disconnect'));
});

test('admin access can be revoked without disconnecting the application', async () => {
  mount();
  fireEvent.click(await screen.findByRole('button', { name: 'Revoke admin access' }));
  await waitFor(() => expect(changeAiConnection).toHaveBeenCalledWith('agent', 'disable'));
});

test('failed loading displays a retry action instead of an empty successful result', async () => {
  jest.mocked(listAiConnections).mockRejectedValue(new Error('Unable to load connected applications.'));
  mount();
  expect(await screen.findByRole('alert')).toHaveTextContent('Unable to load');
  expect(screen.queryByText(/No connected applications yet/)).not.toBeInTheDocument();
  expect(screen.getByRole('button', { name: 'Refresh' })).toBeEnabled();
});
