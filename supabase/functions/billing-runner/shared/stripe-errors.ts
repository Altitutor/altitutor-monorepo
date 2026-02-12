// @ts-nocheck
// deno-lint-ignore-file no-explicit-any
import Stripe from 'npm:stripe@16.6.0';

/**
 * Extract Stripe error details from an error object
 */
export function getStripeErrorDetails(error: unknown): {
  type?: string;
  code?: string;
  statusCode?: number;
  message?: string;
  isStripeError: boolean;
} {
  if (error instanceof Stripe.errors.StripeError) {
    return {
      type: error.type,
      code: error.code,
      statusCode: error.statusCode,
      message: error.message,
      isStripeError: true,
    };
  }

  // Check if it's a Stripe-like error object
  if (
    error !== null &&
    typeof error === 'object' &&
    ('statusCode' in error || 'type' in error || 'code' in error)
  ) {
    const e = error as any;
    return {
      type: e.type,
      code: e.code,
      statusCode: e.statusCode,
      message: e.message,
      isStripeError: true,
    };
  }

  return {
    isStripeError: false,
    message: error instanceof Error ? error.message : String(error),
  };
}

/**
 * Determine if a Stripe error should be retried
 * Based on Stripe best practices:
 * - 5xx errors: Retry with same idempotency key (indeterminate state)
 * - 429 errors: Retry with exponential backoff, same idempotency key
 * - 4xx errors: Don't retry (except idempotency conflicts)
 * - Network errors: Retry with same idempotency key
 */
export function shouldRetryStripeError(error: unknown): {
  shouldRetry: boolean;
  useNewIdempotencyKey: boolean;
  isRateLimit: boolean;
} {
  const details = getStripeErrorDetails(error);

  if (!details.isStripeError) {
    // Non-Stripe errors: don't retry by default
    return { shouldRetry: false, useNewIdempotencyKey: false, isRateLimit: false };
  }

  const statusCode = details.statusCode || 0;

  // Rate limit errors (429): Retry with exponential backoff, same idempotency key
  if (statusCode === 429 || details.code === 'rate_limit') {
    return { shouldRetry: true, useNewIdempotencyKey: false, isRateLimit: true };
  }

  // Server errors (5xx): Retry with same idempotency key (indeterminate state)
  if (statusCode >= 500) {
    return { shouldRetry: true, useNewIdempotencyKey: false, isRateLimit: false };
  }

  // Idempotency conflicts (409): Retry with same idempotency key
  if (statusCode === 409 || details.code === 'idempotency_key_in_use') {
    return { shouldRetry: true, useNewIdempotencyKey: false, isRateLimit: false };
  }

  // Client errors (4xx): Don't retry, but generate new idempotency key if retrying manually
  if (statusCode >= 400 && statusCode < 500) {
    return { shouldRetry: false, useNewIdempotencyKey: true, isRateLimit: false };
  }

  // Network errors or other errors: Don't retry by default
  return { shouldRetry: false, useNewIdempotencyKey: false, isRateLimit: false };
}

/**
 * Format Stripe error message with context
 */
export function formatStripeErrorMessage(
  error: unknown,
  operation: string,
  context?: { studentId?: string; sessionId?: string; invoiceId?: string; [key: string]: any }
): string {
  const details = getStripeErrorDetails(error);
  const contextParts: string[] = [];

  if (context?.studentId) contextParts.push(`studentId: ${context.studentId}`);
  if (context?.sessionId) contextParts.push(`sessionId: ${context.sessionId}`);
  if (context?.invoiceId) contextParts.push(`invoiceId: ${context.invoiceId}`);

  const contextStr = contextParts.length > 0 ? ` (${contextParts.join(', ')})` : '';

  if (details.isStripeError) {
    const parts = [`Failed to ${operation}${contextStr}`];
    if (details.type) parts.push(`Type: ${details.type}`);
    if (details.code) parts.push(`Code: ${details.code}`);
    if (details.statusCode) parts.push(`Status: ${details.statusCode}`);
    if (details.message) parts.push(`Message: ${details.message}`);
    return parts.join(' | ');
  }

  return `Failed to ${operation}${contextStr}: ${details.message || 'Unknown error'}`;
}

/**
 * Create standardized error response object
 */
export function createErrorResponse(
  error: unknown,
  operation: string,
  context?: { studentId?: string; sessionId?: string; invoiceId?: string; [key: string]: any }
): {
  error: string;
  code?: string;
  type?: string;
  statusCode?: number;
  message: string;
  context?: Record<string, any>;
} {
  const details = getStripeErrorDetails(error);
  const message = formatStripeErrorMessage(error, operation, context);

  return {
    error: details.isStripeError ? details.type || 'stripe_error' : 'internal_error',
    code: details.code,
    type: details.type,
    statusCode: details.statusCode,
    message,
    ...(Object.keys(context || {}).length > 0 ? { context } : {}),
  };
}
