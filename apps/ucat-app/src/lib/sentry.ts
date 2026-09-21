const EXPECTED_UCAT_APP_OUTCOMES = [
  "QUOTA_EXCEEDED",
  "Invalid login credentials",
  "Please sign in to continue.",
  "Please sign in again",
  "Your session has ended",
] as const;

export type NativeSentryEvent = {
  message?: string;
  exception?: {
    values?: { value?: string }[];
  };
};

export type NativeSentryHint = {
  originalException?: unknown;
};

export function shouldEnableNativeSentry(dsn: string | undefined): boolean {
  return Boolean(dsn?.trim());
}

export function resolveNativeSentryEnvironment({
  explicit,
  isDev,
}: {
  explicit?: string;
  isDev: boolean;
}): string {
  const configured = explicit?.trim();
  if (configured) return configured;
  return isDev ? "development" : "production";
}

export function nativeSentryTracePropagationTargets(
  webUrl: string | undefined,
): (string | RegExp)[] {
  const targets: (string | RegExp)[] = [
    "localhost",
    "127.0.0.1",
    /^https:\/\/ucat\.altitutor\.com/,
    /^https:\/\/ucat\.development\.altitutor\.com/,
  ];
  const origin = webUrl?.trim();
  if (!origin) return targets;
  try {
    const host = new URL(origin).hostname;
    if (host && !["localhost", "127.0.0.1"].includes(host)) {
      targets.push(host);
    }
  } catch {
    return targets;
  }
  return targets;
}

function originalExceptionMessage(
  originalException: unknown,
): string | undefined {
  if (originalException instanceof Error) return originalException.message;
  if (!originalException || typeof originalException !== "object") {
    return undefined;
  }
  const message = (originalException as { message?: unknown }).message;
  return typeof message === "string" ? message : undefined;
}

function isExpectedUcatAppOutcome(message: string | undefined): boolean {
  return Boolean(
    message &&
      EXPECTED_UCAT_APP_OUTCOMES.some((outcome) => message.includes(outcome)),
  );
}

export function filterExpectedUcatAppError<TEvent extends NativeSentryEvent>(
  event: TEvent,
  hint?: NativeSentryHint,
): TEvent | null {
  const messages = [
    event.message,
    ...(event.exception?.values?.map((value) => value.value) ?? []),
    originalExceptionMessage(hint?.originalException),
  ];
  return messages.some(isExpectedUcatAppOutcome) ? null : event;
}
