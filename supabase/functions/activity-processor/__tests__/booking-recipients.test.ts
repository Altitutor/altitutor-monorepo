import { describe, it } from 'jsr:@std/testing/bdd';
import { expect } from 'jsr:@std/expect';
import type { SupabaseClient } from 'jsr:@supabase/supabase-js@2';
import type { Database } from '../../../../packages/shared/src/supabase/generated.ts';
import { resolveNotificationRecipients, type ActivityEvent } from '../recipients.ts';

function client(assigned: string[], creator: string | null, fail = false) {
  const filters: Record<string, unknown> = {};
  const supabase = {
    from(table: string) {
      const result = table === 'sessions_staff'
        ? { data: assigned.map((staff_id) => ({ staff_id })), error: null }
        : { data: creator ? { actor_staff_id: creator } : null, error: fail ? new Error('lookup failed') : null };
      const query = {
        select() { return query; },
        eq(column: string, value: unknown) { filters[`${table}.${column}`] = value; return query; },
        order() { return query; },
        limit() { return query; },
        maybeSingle() { return Promise.resolve(result); },
        then(resolve: (value: typeof result) => unknown) { return Promise.resolve(result).then(resolve); },
      };
      return query;
    },
  } as unknown as SupabaseClient<Database>;
  return { supabase, filters };
}

const event: ActivityEvent = {
  id: 'cancellation', entity_type: 'sessions', entity_id: 'session-1',
  session_id: 'session-1', event_type: 'STATUS_CHANGED', performed_by: 'canceller',
};
const recipientType = 'session_staff_and_booking_creator';

describe('public booking notification recipients', () => {
  it('notifies assigned staff and original creator without notifying the cancellation actor', async () => {
    const { supabase, filters } = client(['assigned-staff'], 'booking-creator');
    expect(await resolveNotificationRecipients(supabase, recipientType, event)).toEqual([
      { staff_id: 'assigned-staff' }, { staff_id: 'booking-creator' },
    ]);
    expect(filters).toEqual({
      'sessions_staff.session_id': 'session-1',
      'domain_events.event_name': 'session.created',
      'domain_events.subject_type': 'session',
      'domain_events.subject_id': 'session-1',
    });
  });

  it('deduplicates the creator when also assigned to the session', async () => {
    const { supabase } = client(['same-staff', 'same-staff'], 'same-staff');
    expect(await resolveNotificationRecipients(supabase, recipientType, event)).toEqual([{ staff_id: 'same-staff' }]);
  });

  it('handles public bookings without a staff creator', async () => {
    const { supabase } = client(['assigned-staff'], null);
    expect(await resolveNotificationRecipients(supabase, recipientType, event)).toEqual([{ staff_id: 'assigned-staff' }]);
  });

  it('keeps the booking creator when there are no assigned staff', async () => {
    const { supabase } = client([], 'booking-creator');
    expect(await resolveNotificationRecipients(supabase, recipientType, event)).toEqual([{ staff_id: 'booking-creator' }]);
  });

  it('retries failed lookups instead of silently dropping a recipient', async () => {
    const { supabase } = client(['assigned-staff'], null, true);
    await expect(resolveNotificationRecipients(supabase, recipientType, event)).rejects.toThrow('lookup failed');
  });
});
