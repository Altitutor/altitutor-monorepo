/** Resolve local services against the computer serving a native development bundle. */
export function developmentServerUrl(
  value: string,
  options: { isNativeDevelopment: boolean; hostUri?: string | null },
): string {
  if (!options.isNativeDevelopment || !options.hostUri) return value;

  const url = new URL(value);
  if (!['localhost', '127.0.0.1', '[::1]', '0.0.0.0'].includes(url.hostname)) return value;

  let host: string;
  try {
    host = new URL(`http://${options.hostUri}`).hostname;
  } catch {
    return value;
  }
  // An Expo tunnel forwards Metro only, not the web server or local Supabase.
  if (!/^(10\.\d{1,3}\.\d{1,3}\.\d{1,3}|192\.168\.\d{1,3}\.\d{1,3}|172\.(1[6-9]|2\d|3[01])\.\d{1,3}\.\d{1,3})$/.test(host)) return value;

  url.hostname = host;
  return url.toString();
}
