import * as Sentry from '@sentry/nextjs';

type InstrumentableSupabaseClient = Parameters<
  typeof Sentry.instrumentSupabaseClient
>[0];

export function instrumentSupabaseClient<
  Client extends InstrumentableSupabaseClient,
>(client: Client): Client {
  if (process.env.NEXT_PUBLIC_SENTRY_DSN) {
    Sentry.instrumentSupabaseClient(client);
  }
  return client;
}
