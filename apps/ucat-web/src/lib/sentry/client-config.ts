const LOCAL_SENTRY_HOSTS = new Set(["localhost", "127.0.0.1", "::1"]);

export function shouldEnableClientSentry(
  dsn: string | undefined,
  hostname: string | undefined,
): boolean {
  return (
    Boolean(dsn) && (hostname == null || !LOCAL_SENTRY_HOSTS.has(hostname))
  );
}
