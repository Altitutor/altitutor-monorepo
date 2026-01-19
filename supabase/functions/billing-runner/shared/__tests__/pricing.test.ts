/**
 * Tests for billing pricing calculation logic
 * These tests directly test the pricing.ts file logic
 */

import { describe, it } from 'jsr:@std/testing/bdd';
import { expect } from 'jsr:@std/expect';
import { calculateSessionPrice } from '../pricing.ts';

describe('calculateSessionPrice', () => {
  const mockSession = {
    billing_type: 'DOMESTIC',
    subject_id: 'subject-1',
    start_at: '2024-01-15T10:00:00Z',
    end_at: '2024-01-15T11:00:00Z', // 1 hour
  };

  const mockPricingByBillingType = {
    DOMESTIC: { hourly_rate_cents: 10000, currency: 'AUD' },
    INTERNATIONAL: { hourly_rate_cents: 15000, currency: 'AUD' },
  };

  describe('basic pricing', () => {
    it('should calculate price for 1 hour session with default pricing', () => {
      const result = calculateSessionPrice(
        mockSession,
        undefined,
        new Date('2024-01-15'),
        mockPricingByBillingType,
        {},
        [],
        []
      );

      expect(result.amount_cents).toBe(10000); // $100 for 1 hour
      expect(result.currency).toBe('aud');
    });

    it('should calculate price for 1.5 hour session', () => {
      const session = {
        ...mockSession,
        end_at: '2024-01-15T11:30:00Z', // 1.5 hours
      };

      const result = calculateSessionPrice(
        session,
        undefined,
        new Date('2024-01-15'),
        mockPricingByBillingType,
        {},
        [],
        []
      );

      expect(result.amount_cents).toBe(15000); // $100 * 1.5 = $150
      expect(result.currency).toBe('aud');
    });

    it('should return 0 for non-billable sessions', () => {
      const nonBillableSession = {
        ...mockSession,
        billing_type: null,
      };

      const result = calculateSessionPrice(
        nonBillableSession,
        undefined,
        new Date('2024-01-15'),
        mockPricingByBillingType,
        {},
        [],
        []
      );

      expect(result.amount_cents).toBe(0);
      expect(result.currency).toBe('aud');
    });
  });

  describe('subject overrides', () => {
    it('should use subject override when active', () => {
      const override = {
        subject_id: 'subject-1',
        billing_type: 'DOMESTIC',
        hourly_rate_cents: 12000,
        currency: 'AUD',
        effective_from: '2024-01-01',
        effective_until: null,
      };

      const overridesBySubjectAndBilling = {
        'subject-1': {
          DOMESTIC: { hourly_rate_cents: 12000, currency: 'AUD' },
        },
      };

      const result = calculateSessionPrice(
        mockSession,
        undefined,
        new Date('2024-01-15'),
        mockPricingByBillingType,
        overridesBySubjectAndBilling,
        [override],
        []
      );

      expect(result.amount_cents).toBe(12000); // $120 override rate
      expect(result.currency).toBe('aud');
    });

    it('should fall back to default when override is not active (future date)', () => {
      const override = {
        subject_id: 'subject-1',
        billing_type: 'DOMESTIC',
        hourly_rate_cents: 12000,
        currency: 'AUD',
        effective_from: '2024-02-01', // Future date
        effective_until: null,
      };

      const overridesBySubjectAndBilling = {
        'subject-1': {
          DOMESTIC: { hourly_rate_cents: 12000, currency: 'AUD' },
        },
      };

      const result = calculateSessionPrice(
        mockSession,
        undefined,
        new Date('2024-01-15'),
        mockPricingByBillingType,
        overridesBySubjectAndBilling,
        [override],
        []
      );

      expect(result.amount_cents).toBe(10000); // Default rate
      expect(result.currency).toBe('aud');
    });
  });

  describe('student subsidies', () => {
    it('should apply subsidy when student has active subsidy', () => {
      const subsidy = {
        student_id: 'student-1',
        subject_id: 'subject-1',
        billing_type: 'DOMESTIC',
        price_cents: 8000, // $80/hour subsidy rate
        currency: 'AUD',
        effective_from: '2024-01-01',
        effective_until: null,
      };

      const result = calculateSessionPrice(
        mockSession,
        'student-1',
        new Date('2024-01-15'),
        mockPricingByBillingType,
        {},
        [],
        [subsidy]
      );

      expect(result.amount_cents).toBe(8000); // Subsidy rate (lower)
      expect(result.currency).toBe('aud');
    });

    it('should use minimum of subsidy and override rate', () => {
      const override = {
        subject_id: 'subject-1',
        billing_type: 'DOMESTIC',
        hourly_rate_cents: 9000,
        currency: 'AUD',
        effective_from: '2024-01-01',
        effective_until: null,
      };

      const subsidy = {
        student_id: 'student-1',
        subject_id: 'subject-1',
        billing_type: 'DOMESTIC',
        price_cents: 8000,
        currency: 'AUD',
        effective_from: '2024-01-01',
        effective_until: null,
      };

      const overridesBySubjectAndBilling = {
        'subject-1': {
          DOMESTIC: { hourly_rate_cents: 9000, currency: 'AUD' },
        },
      };

      const result = calculateSessionPrice(
        mockSession,
        'student-1',
        new Date('2024-01-15'),
        mockPricingByBillingType,
        overridesBySubjectAndBilling,
        [override],
        [subsidy]
      );

      expect(result.amount_cents).toBe(8000); // Minimum of override (9000) and subsidy (8000)
      expect(result.currency).toBe('aud');
    });
  });
});
