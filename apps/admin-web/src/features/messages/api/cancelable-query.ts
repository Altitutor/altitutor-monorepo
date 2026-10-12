import * as Sentry from '@sentry/nextjs';

function isAbortError(error: unknown): error is { name: 'AbortError'; message: string } {
  return !!error && typeof error === 'object' && 'name' in error && error.name === 'AbortError'
    && 'message' in error && typeof error.message === 'string';
}

/** Only inbox reads with an explicit caller signal can be expected cancellations. */
export async function executeCancelableInboxQuery<Result>(
  query: PromiseLike<Result> & { throwOnError(): PromiseLike<Result> },
  signal: AbortSignal | undefined,
  operation: 'conversation-list' | 'message-preview' | 'reaction-preview' | 'unread-count' | 'unread-ids',
): Promise<Result> {
  if (!signal) return await query;

  try {
    signal.throwIfAborted();
    // The SDK captures returned error objects automatically. Throwing preserves
    // the fetch exception and lets us distinguish caller cancellation first.
    return await query.throwOnError();
  } catch (error) {
    const cancelled = signal.aborted && isAbortError(signal.reason) && isAbortError(error);
    if (!cancelled) {
      // throwOnError bypasses the SDK's automatic response-error capture, so
      // unexpected aborts, timeouts and database failures still need one event.
      Sentry.withScope((scope) => {
        scope.setTag('inbox.operation', operation);
        scope.setTag('inbox.signal_state', signal.aborted ? 'aborted' : 'active');
        Sentry.captureException(error, { mechanism: { type: 'app.inbox.query', handled: true } });
      });
      // Previously Supabase returned a plain error object with this message.
      // Retain that retry behaviour: the admin policy skips errors *named*
      // AbortError, which is appropriate only for actual caller cancellation.
      if (isAbortError(error)) throw new Error(`AbortError: ${error.message}`, { cause: error });
    }
    throw error;
  }
}
