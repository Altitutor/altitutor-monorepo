import { describe, it } from 'jsr:@std/testing/bdd';
import { expect } from 'jsr:@std/expect';
import {
  shouldSkipEvent,
  getEventId,
  getEventType,
  type WebhookEvent,
  type ExistingEvent,
} from '../shared/idempotency.ts';

describe('Stripe Webhook Idempotency', () => {
  describe('shouldSkipEvent', () => {
    it('should skip event that has already been processed', () => {
      const existingEvent: ExistingEvent = {
        id: 'evt_123',
        processed: true,
      };
      expect(shouldSkipEvent(existingEvent)).toBe(true);
    });

    it('should not skip event that has not been processed', () => {
      const existingEvent: ExistingEvent = {
        id: 'evt_123',
        processed: false,
      };
      expect(shouldSkipEvent(existingEvent)).toBe(false);
    });

    it('should not skip event when no existing event found', () => {
      expect(shouldSkipEvent(null)).toBe(false);
    });

    it('should handle undefined processed field as false', () => {
      // When processed is undefined, it's treated as not processed
      const existingEvent: ExistingEvent = {
        id: 'evt_123',
        processed: false,
      };
      expect(shouldSkipEvent(existingEvent)).toBe(false);
    });
  });

  describe('getEventId', () => {
    it('should extract event ID from webhook event', () => {
      const event: WebhookEvent = {
        id: 'evt_test123456789',
        type: 'invoice.paid',
        data: {},
      };
      expect(getEventId(event)).toBe('evt_test123456789');
    });

    it('should handle events with additional fields', () => {
      const event: WebhookEvent = {
        id: 'evt_abc',
        type: 'setup_intent.succeeded',
        data: { object: {} },
        created: 1234567890,
      };
      expect(getEventId(event)).toBe('evt_abc');
    });
  });

  describe('getEventType', () => {
    it('should extract event type from webhook event', () => {
      const event: WebhookEvent = {
        id: 'evt_test123456789',
        type: 'invoice.paid',
        data: {},
      };
      expect(getEventType(event)).toBe('invoice.paid');
    });

    it('should handle various event types', () => {
      const eventTypes = [
        'setup_intent.succeeded',
        'payment_method.detached',
        'customer.updated',
        'invoice.paid',
        'charge.dispute.created',
      ];

      eventTypes.forEach((eventType) => {
        const event: WebhookEvent = {
          id: 'evt_test',
          type: eventType,
          data: {},
        };
        expect(getEventType(event)).toBe(eventType);
      });
    });
  });
});
