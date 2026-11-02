import { enrollmentStartDateOptions } from '../enrollmentStartDates';

const now = new Date('2026-10-23T03:30:00.000Z');

it('offers the latest past session and every session from today onward', () => {
  const options = enrollmentStartDateOptions([
    { start_at: '2026-10-21T06:30:00.000Z' },
    { start_at: '2026-10-22T06:30:00.000Z' },
    { start_at: '2026-10-23T06:30:00.000Z' },
    { start_at: '2026-10-29T06:30:00.000Z' },
  ], now);

  expect(options.map((option) => option.value)).toEqual([
    '2026-10-22',
    '2026-10-23',
    '2026-10-29',
  ]);
  expect(options[0]?.label).toContain('Most recent past');
  expect(options[1]?.label).not.toContain('Most recent past');
});

it('keeps a session earlier today on today without a second past option', () => {
  const options = enrollmentStartDateOptions([
    { start_at: '2026-10-23T01:00:00.000Z' },
    { start_at: '2026-10-30T06:30:00.000Z' },
  ], now);

  expect(options.map((option) => option.value)).toEqual(['2026-10-23', '2026-10-30']);
  expect(options[0]?.label).not.toContain('Most recent past');
});

it('still offers the latest past session when every session has already started', () => {
  const options = enrollmentStartDateOptions([
    { start_at: '2026-10-21T06:30:00.000Z' },
    { start_at: '2026-10-22T06:30:00.000Z' },
  ], now);

  expect(options.map((option) => option.value)).toEqual(['2026-10-22']);
});
