import { filterMobileAuthTelemetry } from "@/lib/privacy/mobile-auth-telemetry";

type UcatWebSentryEvent = {
  message?: string;
  exception?: {
    values?: Array<{ value?: string }>;
  };
};

type UcatWebSentryHint = {
  originalException?: unknown;
};

function originalExceptionMessage(
  originalException: unknown,
): string | undefined {
  if (originalException instanceof Error) return originalException.message;
  if (!originalException || typeof originalException !== "object")
    return undefined;
  const message = (originalException as { message?: unknown }).message;
  return typeof message === "string" ? message : undefined;
}

function isExpectedUcatWebOutcome(message: string | undefined): boolean {
  if (message === "Invalid login credentials") return true;
  // Retain only the established extension rejection signature, not arbitrary
  // failures that happen to contain one of these words.
  if (message && /^Non-Error promise rejection captured with value: Object Not Found Matching Id:\d+, MethodName:update, ParamCount:4$/.test(message)) return true;
  if (!message?.startsWith("QUOTA_EXCEEDED:")) return false;
  try {
    const quota: unknown = JSON.parse(message.slice("QUOTA_EXCEEDED:".length));
    return Boolean(quota && typeof quota === "object" && "code" in quota && quota.code === "QUOTA_EXCEEDED");
  } catch {
    return false;
  }
}

export function filterExpectedUcatWebError<TEvent extends UcatWebSentryEvent>(
  event: TEvent,
  hint?: UcatWebSentryHint,
): TEvent | null {
  if (!filterMobileAuthTelemetry(event)) return null;
  const original = originalExceptionMessage(hint?.originalException);
  const exceptions = event.exception?.values?.map((value) => value.value) ?? [];
  const messages = exceptions.length ? [...exceptions, ...(original ? [original] : [])] : [original ?? event.message];
  return messages.length > 0 && messages.every(isExpectedUcatWebOutcome) ? null : event;
}
