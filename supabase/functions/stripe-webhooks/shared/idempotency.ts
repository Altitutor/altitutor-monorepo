/**
 * Idempotency utilities for Stripe webhooks
 * Extracted for testability
 */

export interface WebhookEvent {
  id: string;
  type: string;
  [key: string]: any;
}

export interface ExistingEvent {
  id: string;
  processed: boolean;
}

/**
 * Check if webhook event has already been processed
 * Returns true if event should be skipped (already processed)
 */
export function shouldSkipEvent(existingEvent: ExistingEvent | null): boolean {
  return existingEvent?.processed === true;
}

/**
 * Extract event ID from Stripe webhook event
 */
export function getEventId(event: WebhookEvent): string {
  return event.id;
}

/**
 * Extract event type from Stripe webhook event
 */
export function getEventType(event: WebhookEvent): string {
  return event.type;
}
