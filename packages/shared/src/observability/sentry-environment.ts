export type ServerSentryEnvironmentInput = {
  ci?: string;
  explicitEnvironment?: string;
  nodeEnvironment?: string;
  vercelEnvironment?: string;
};

function configured(value: string | undefined): string | undefined {
  const normalized = value?.trim();
  return normalized ? normalized : undefined;
}

function enabledFlag(value: string | undefined): boolean {
  const normalized = configured(value)?.toLowerCase();
  return normalized !== undefined && normalized !== "0" && normalized !== "false";
}

/**
 * Keeps local production-mode servers and CI builds out of Sentry's production
 * environment while preserving explicit overrides and Vercel environments.
 */
export function resolveServerSentryEnvironment({
  ci,
  explicitEnvironment,
  nodeEnvironment,
  vercelEnvironment,
}: ServerSentryEnvironmentInput): string {
  const explicit = configured(explicitEnvironment);
  if (explicit) return explicit;

  const vercel = configured(vercelEnvironment);
  if (vercel) return vercel;

  if (enabledFlag(ci)) return "ci";

  const node = configured(nodeEnvironment);
  return node === "production" ? "local" : node ?? "local";
}
