import type { SupabaseClient } from '@supabase/supabase-js';
import type { Database } from '@altitutor/shared';
import { isPublicBookingIdentifierRevoked } from '../public-booking-guards';
import { isRegistrationTokenRevoked } from '@/features/registration/lib/public-registration-token';

type RpcResult = { data: boolean | null; error: Error | null };

function createClient(result: RpcResult) {
  return {
    rpc: jest.fn(async () => result),
  } as unknown as SupabaseClient<Database>;
}

describe('public link revocation lookups', () => {
  it('checks booking revocation through the bounded service RPC', async () => {
    const supabase = createClient({ data: true, error: null });

    await expect(
      isPublicBookingIdentifierRevoked(supabase, 'booking-token')
    ).resolves.toBe(true);
    expect(supabase.rpc).toHaveBeenCalledWith('service_is_public_link_revoked', {
      p_purpose: 'BOOKING',
      p_token: 'booking-token',
    });
  });

  it('checks registration revocation through the same bounded service RPC', async () => {
    const supabase = createClient({ data: false, error: null });

    await expect(
      isRegistrationTokenRevoked(supabase, 'registration-token')
    ).resolves.toBe(false);
    expect(supabase.rpc).toHaveBeenCalledWith('service_is_public_link_revoked', {
      p_purpose: 'REGISTRATION',
      p_token: 'registration-token',
    });
  });

  it('does not treat a failed security lookup as an active link', async () => {
    const error = new Error('lookup unavailable');
    const supabase = createClient({ data: null, error });

    await expect(
      isPublicBookingIdentifierRevoked(supabase, 'booking-token')
    ).rejects.toBe(error);
  });
});
