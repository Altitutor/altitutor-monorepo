import { getSupabaseClient } from '@/shared/lib/supabase/client';

async function currentAdmin() {
  const client = getSupabaseClient();
  const [user, access] = await Promise.all([
    client.auth.getUser(),
    client.rpc('is_adminstaff_active'),
  ]);
  if (user.error || !user.data.user || access.error || access.data !== true) {
    throw new Error('Active administrator access is required. Sign in again.');
  }
  return { client, userId: user.data.user.id };
}

export async function listAiConnections() {
  const { client, userId } = await currentAdmin();
  const [oauth, grants] = await Promise.all([
    client.auth.oauth.listGrants(),
    client.from('admin_mcp_grants').select('client_id').eq('user_id', userId),
  ]);
  if (oauth.error || grants.error) throw new Error('Unable to load connected applications. Please retry.');
  return oauth.data.map((grant) => ({
    id: grant.client.id,
    name: grant.client.name,
    grantedAt: grant.granted_at,
    enabled: grants.data.some((row) => row.client_id === grant.client.id),
  }));
}

export type ConnectionAction = 'enable' | 'disable' | 'disconnect';

export async function changeAiConnection(clientId: string, action: ConnectionAction) {
  const { client, userId } = await currentAdmin();
  const result = action === 'enable'
    ? await client.from('admin_mcp_grants').upsert(
      { user_id: userId, client_id: clientId },
      { onConflict: 'user_id,client_id', ignoreDuplicates: true },
    )
    : await client.from('admin_mcp_grants').delete().eq('user_id', userId).eq('client_id', clientId);
  if (result.error) throw new Error('Unable to change admin access. Please retry.');
  // Remove the independent business grant first, so reconnecting cannot silently restore it.
  if (action === 'disconnect') {
    const { error } = await client.auth.oauth.revokeGrant({ clientId });
    if (error) throw new Error('Admin access was revoked, but the application could not be disconnected. Please retry Disconnect application.');
  }
}
