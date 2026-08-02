const LOCAL_SENTRY_HOSTS = new Set(["localhost", "127.0.0.1", "::1"]);

export function shouldEnableClientSentry(
  dsn: string | undefined,
  _hostname: string | undefined,
): boolean {
  return Boolean(dsn);
}

export function shouldSendClientSentryEvent(
  eventType: string | undefined,
  hostname: string | undefined,
): boolean {
  return (
    eventType === "feedback" ||
    hostname == null ||
    !LOCAL_SENTRY_HOSTS.has(hostname)
  );
}

export function shouldSendClientSentryTransaction(
  hostname: string | undefined,
): boolean {
  return hostname == null || !LOCAL_SENTRY_HOSTS.has(hostname);
}
