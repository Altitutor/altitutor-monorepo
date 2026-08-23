import * as Sentry from '@sentry/nextjs';

import { instrumentSupabaseClient } from '@/lib/sentry/instrument-supabase-client';

jest.mock('@sentry/nextjs', () => ({
  instrumentSupabaseClient: jest.fn(),
}));

const mockInstrumentSupabaseClient = jest.mocked(
  Sentry.instrumentSupabaseClient,
);
const originalDsn = process.env.NEXT_PUBLIC_SENTRY_DSN;

afterEach(() => {
  mockInstrumentSupabaseClient.mockClear();
  if (originalDsn === undefined) {
    delete process.env.NEXT_PUBLIC_SENTRY_DSN;
  } else {
    process.env.NEXT_PUBLIC_SENTRY_DSN = originalDsn;
  }
});

it('instruments and returns a Supabase client when Sentry is enabled', () => {
  process.env.NEXT_PUBLIC_SENTRY_DSN = 'https://public@sentry.example/1';
  const client = { auth: {} } as never;

  expect(instrumentSupabaseClient(client)).toBe(client);
  expect(mockInstrumentSupabaseClient).toHaveBeenCalledWith(client);
});

it('leaves the client untouched when Sentry is disabled', () => {
  delete process.env.NEXT_PUBLIC_SENTRY_DSN;
  const client = { auth: {} } as never;

  expect(instrumentSupabaseClient(client)).toBe(client);
  expect(mockInstrumentSupabaseClient).not.toHaveBeenCalled();
});
