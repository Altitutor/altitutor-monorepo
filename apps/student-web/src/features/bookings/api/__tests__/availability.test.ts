import { availabilityApi } from '../availability';

describe('availabilityApi.getAvailableSlots', () => {
  const fetchMock = jest.fn();

  beforeEach(() => {
    fetchMock.mockReset();
    global.fetch = fetchMock as unknown as typeof fetch;
  });

  it('fetches a 12-week lookahead as multiple requests within the 31-day cap', async () => {
    fetchMock.mockResolvedValue({
      ok: true,
      json: async () => [],
    });

    await availabilityApi.getAvailableSlots({
      start_date: '2026-09-08',
      end_date: '2026-12-01',
      session_type: 'TRIAL_SESSION',
      duration_minutes: 45,
    });

    const requestedUrls = fetchMock.mock.calls.map(([url]) => String(url));
    expect(requestedUrls).toEqual([
      '/api/bookings/availability?start_date=2026-09-08&end_date=2026-10-09&session_type=TRIAL_SESSION&duration_minutes=45',
      '/api/bookings/availability?start_date=2026-10-10&end_date=2026-11-10&session_type=TRIAL_SESSION&duration_minutes=45',
      '/api/bookings/availability?start_date=2026-11-11&end_date=2026-12-01&session_type=TRIAL_SESSION&duration_minutes=45',
    ]);
  });

  it('fetches a visible week as a single request', async () => {
    fetchMock.mockResolvedValue({
      ok: true,
      json: async () => [],
    });

    await availabilityApi.getAvailableSlots({
      start_date: '2026-09-08',
      end_date: '2026-09-14',
      session_type: 'TRIAL_SESSION',
      duration_minutes: 45,
    });

    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(fetchMock.mock.calls[0]?.[0]).toBe(
      '/api/bookings/availability?start_date=2026-09-08&end_date=2026-09-14&session_type=TRIAL_SESSION&duration_minutes=45',
    );
  });
});
