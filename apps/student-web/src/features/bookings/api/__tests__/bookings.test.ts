import { bookingsApi } from '../bookings';

describe('bookingsApi', () => {
  it('rejects a Drafting booking without a Subject before calling Supabase', async () => {
    await expect(bookingsApi.createBooking({
      session_type: 'DRAFTING',
      start_at: '2026-10-01T00:00:00.000Z',
      end_at: '2026-10-01T01:00:00.000Z',
    })).rejects.toThrow('A subject is required for drafting sessions');
  });
});
