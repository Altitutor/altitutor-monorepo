const EXPECTED_UCAT_APP_OUTCOMES = [
  "QUOTA_EXCEEDED",
  "Invalid login credentials",
  "Please sign in to continue.",
  "Your session has ended. Please sign in again.",
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
      EXPECTED_UCAT_APP_OUTCOMES.some((outcome) => message === outcome),
  );
}

export function filterExpectedUcatAppError<TEvent extends NativeSentryEvent>(
  event: TEvent,
  hint?: NativeSentryHint,
): TEvent | null {
  const original = originalExceptionMessage(hint?.originalException);
  const exceptions = event.exception?.values?.map((value) => value.value) ?? [];
  const messages = exceptions.length ? [...exceptions, ...(original ? [original] : [])] : [original ?? event.message];
  return messages.length > 0 && messages.every(isExpectedUcatAppOutcome) ? null : event;
}
