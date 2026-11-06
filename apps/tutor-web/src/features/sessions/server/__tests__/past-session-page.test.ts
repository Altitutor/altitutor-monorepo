import { collectPastSessionPage, readPastSessionRequest } from '../past-session-page';

function fixture(index: number) {
  return {
    startAt: '2026-11-05T06:30:00.123456+00:00',
    id: `22400000-0000-4000-8000-${String(index).padStart(12, '0')}`,
    match: index === 101 || index === 520,
  };
}

const history = Array.from({ length: 530 }, (_, index) => fixture(index + 1));

test('fills the result page from filtered history and resumes after the bounded scan', async () => {
  const load = jest.fn(async (after: { id: string } | null, limit: number) =>
    history.filter(({ id }) => after === null || id > after.id).slice(0, limit));
  const first = await collectPastSessionPage(load, (row) => row.match, null);

  expect(first.rows).toEqual([fixture(101)]);
  expect(first.next).toEqual({ startAt: fixture(500).startAt, id: fixture(500).id });
  expect(load).toHaveBeenCalledTimes(5);

  const second = await collectPastSessionPage(load, (row) => row.match, first.next);
  expect(second).toEqual({ rows: [fixture(520)], next: null });
});

test('date range uses the inclusive Adelaide calendar day across a clock change', () => {
  const params = readPastSessionRequest(new URLSearchParams({ from: '2026-04-05', to: '2026-04-05' }));
  expect(params).toMatchObject({ from: '2026-04-04T13:30:00.000Z', until: '2026-04-05T14:30:00.000Z' });
});

test('rejects a malformed cursor, invalid session types, and invalid calendar dates', () => {
  expect(readPastSessionRequest(new URLSearchParams({ before: 'invalid', afterId: fixture(1).id }))).toBeNull();
  expect(readPastSessionRequest(new URLSearchParams({ type: 'UNKNOWN' }))).toBeNull();
  expect(readPastSessionRequest(new URLSearchParams({ to: '2026-02-30' }))).toBeNull();
});

test('can restore an existing web filter that only contains excluded interviews', () => {
  expect(readPastSessionRequest(new URLSearchParams({ type: 'STAFF_INTERVIEW' })))
    .toMatchObject({ requestedTypes: true, types: [] });
});
