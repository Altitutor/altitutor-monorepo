import { changeAiConnection, listAiConnections } from '../connections';
import { getSupabaseClient } from '@/shared/lib/supabase/client';

jest.mock('@/shared/lib/supabase/client', () => ({ getSupabaseClient: jest.fn() }));

function fixture() {
  const calls: string[] = [];
  const deletion = { error: null as Error | null };
  const eq = jest.fn().mockReturnThis();
  const table = { select: jest.fn().mockReturnThis(), delete: jest.fn().mockReturnThis(), eq, upsert: jest.fn().mockResolvedValue({ error: null }) };
  table.delete.mockImplementation(() => { calls.push('delete'); return table; });
  eq.mockImplementation((field: string) => field === 'client_id' ? Promise.resolve(deletion) : table);
  const revokeGrant = jest.fn(async () => { calls.push('revoke'); return { error: null as Error | null }; });
  const client = {
    auth: { getUser: jest.fn().mockResolvedValue({ data: { user: { id: 'current-admin' } }, error: null }), oauth: { revokeGrant, listGrants: jest.fn() } },
    rpc: jest.fn().mockResolvedValue({ data: true, error: null }),
    from: jest.fn(() => table),
  };
  jest.mocked(getSupabaseClient).mockReturnValue(client as unknown as ReturnType<typeof getSupabaseClient>);
  return { calls, deletion, table, revokeGrant, client };
}

test('disconnect removes only the current user/client business grant before revoking OAuth', async () => {
  const f = fixture();
  await changeAiConnection('agent', 'disconnect');
  expect(f.calls).toEqual(['delete', 'revoke']);
  expect(f.table.eq.mock.calls).toEqual([['user_id', 'current-admin'], ['client_id', 'agent']]);
  expect(f.revokeGrant).toHaveBeenCalledWith({ clientId: 'agent' });
});

test('admin-only revocation leaves OAuth connected', async () => {
  const f = fixture();
  await changeAiConnection('agent', 'disable');
  expect(f.revokeGrant).not.toHaveBeenCalled();
});

test('does not revoke OAuth if removing the business grant fails', async () => {
  const f = fixture();
  f.deletion.error = new Error('offline');
  await expect(changeAiConnection('agent', 'disconnect')).rejects.toThrow('Unable to change admin access');
  expect(f.revokeGrant).not.toHaveBeenCalled();
});

test('reports partial success when OAuth revocation fails', async () => {
  const f = fixture();
  f.revokeGrant.mockResolvedValue({ error: new Error('offline') });
  await expect(changeAiConnection('agent', 'disconnect')).rejects.toThrow('Admin access was revoked');
});

test('inactive administrators cannot load or mutate connections', async () => {
  const f = fixture();
  f.client.rpc.mockResolvedValue({ data: false, error: null });
  await expect(listAiConnections()).rejects.toThrow('Active administrator access');
  await expect(changeAiConnection('agent', 'enable')).rejects.toThrow('Active administrator access');
  expect(f.client.from).not.toHaveBeenCalled();
  expect(f.client.auth.oauth.listGrants).not.toHaveBeenCalled();
});
