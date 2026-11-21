/** @jest-environment node */
import { createClient } from '@supabase/supabase-js';
import { getSupabaseClient } from '@/shared/lib/supabase/client';
import { fetchContactMessagingAddresses } from '../queries';

jest.mock('@/shared/lib/supabase/client', () => ({ getSupabaseClient: jest.fn() }));

const contactId = 'e4919900-0000-4000-8000-000000000001';

function addressApi(replyAddress: string | null, failure?: 'contact' | 'reply') {
  const requests: string[] = [];
  const fetch: typeof globalThis.fetch = async (url, init) => {
    const path = new URL(String(url)).pathname;
    requests.push(path);
    const contact = path.endsWith('/contacts');
    const reply = path.endsWith('/rpc/get_contact_latest_inbound_address') &&
      JSON.parse(String(init?.body)).p_contact_id === contactId;
    if ((failure === 'contact' && contact) || (failure === 'reply' && reply)) {
      return Response.json({ code: '42501', message: 'Access changed' }, { status: 403 });
    }
    if (contact) return Response.json({ phone_e164: ' +61400549101 ', email: ' REPLY@EXAMPLE.TEST ' });
    if (reply) return Response.json(replyAddress);
    return Response.json({ message: 'Mailbox-wide address lookup is not available' }, { status: 400 });
  };
  const client = createClient('https://database.example', 'fixture-key', {
    auth: { persistSession: false, autoRefreshToken: false }, global: { fetch },
  });
  jest.mocked(getSupabaseClient).mockReturnValue(client as unknown as ReturnType<typeof getSupabaseClient>);
  return requests;
}

it('loads normalised contact handles and the latest reply address without reading mailbox-wide messages', async () => {
  const requests = addressApi('incoming@dev491msg.test');
  await expect(fetchContactMessagingAddresses(contactId)).resolves.toEqual({
    phone: '+61400549101', email: 'reply@example.test', replyAddress: 'incoming@dev491msg.test',
  });
  expect(requests).toHaveLength(2);
  expect(requests.some(path => path.endsWith('/messages'))).toBe(false);
});

it.each([null, ''])('preserves an absent or blank latest reply address: %s', async replyAddress => {
  addressApi(replyAddress);
  await expect(fetchContactMessagingAddresses(contactId)).resolves.toEqual({
    phone: '+61400549101', email: 'reply@example.test', replyAddress,
  });
});

it.each(['contact', 'reply'] as const)('propagates changed access from the %s read', async failure => {
  addressApi('incoming@dev491msg.test', failure);
  await expect(fetchContactMessagingAddresses(contactId)).rejects.toMatchObject({ code: '42501', message: 'Access changed' });
});
