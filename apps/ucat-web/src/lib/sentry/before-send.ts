type UcatWebSentryEvent = {
  message?: string;
  exception?: {
    values?: Array<{ value?: string }>;
  };
};

type UcatWebSentryHint = {
  originalException?: unknown;
};

const EXPECTED_UCAT_WEB_OUTCOMES = [
  "QUOTA_EXCEEDED",
  "Invalid login credentials",
  "Object Not Found Matching Id",
] as const;

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
  return Boolean(
    message &&
      EXPECTED_UCAT_WEB_OUTCOMES.some((outcome) => message.includes(outcome)),
  );
}

export function filterExpectedUcatWebError<TEvent extends UcatWebSentryEvent>(
  event: TEvent,
  hint?: UcatWebSentryHint,
): TEvent | null {
  const messages = [
    event.message,
    ...(event.exception?.values?.map((value) => value.value) ?? []),
    originalExceptionMessage(hint?.originalException),
  ];

  return messages.some(isExpectedUcatWebOutcome) ? null : event;
}
