/**
 * Tests for pricing calculation logic
 * Tests the actual implementation from @/shared/utils/pricing.ts
 * Logic mirrors supabase/functions/billing-runner/shared/pricing.ts
 */

import {
  calculateSessionPrice,
  formatCurrency,
} from '../pricing';
import type { SubjectPricingOverrideRow } from '@/features/billing/api/subject-pricing-overrides';
import type { StudentSubsidyRow } from '@/features/students/api/subsidies';

describe('calculateSessionPrice', () => {
  // Helper to create minimal override row for tests
  function createOverride(
    overrides: Partial<SubjectPricingOverrideRow>
  ): SubjectPricingOverrideRow {
    return {
      subject_id: '',
      billing_type: 'CLASS',
      hourly_rate_cents: 0,
      currency: 'AUD',
      effective_from: '',
      effective_until: null,
      created_at: null,
      updated_at: null,
      subject: { id: '', name: '', curriculum: null, year_level: null },
      ...overrides,
    } as SubjectPricingOverrideRow;
  }

  // Helper to create minimal subsidy row for tests
  function createSubsidy(
    overrides: Partial<StudentSubsidyRow>
  ): StudentSubsidyRow {
    return {
      student_id: '',
      subject_id: '',
      billing_type: 'CLASS',
      price_cents: 0,
      currency: null,
      effective_from: null,
      effective_until: null,
      created_at: null,
      updated_at: null,
      created_by: null,
      subject: {} as StudentSubsidyRow['subject'],
      ...overrides,
    } as StudentSubsidyRow;
  }

  const mockSession = {
    billing_type: 'CLASS',
    subject_id: 'subject-1',
    start_at: '2024-01-15T10:00:00Z',
    end_at: '2024-01-15T11:00:00Z', // 1 hour
  };

  const mockPricingByBillingType = {
    CLASS: { hourly_rate_cents: 10000, currency: 'AUD' },
    EXAM_COURSE: { hourly_rate_cents: 15000, currency: 'AUD' },
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
      const override = createOverride({
        subject_id: 'subject-1',
        billing_type: 'CLASS',
        hourly_rate_cents: 12000,
        currency: 'AUD',
        effective_from: '2024-01-01',
        effective_until: null,
      });

      const overridesBySubjectAndBilling = {
        'subject-1': {
          CLASS: { hourly_rate_cents: 12000, currency: 'AUD' },
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
      const override = createOverride({
        subject_id: 'subject-1',
        billing_type: 'CLASS',
        hourly_rate_cents: 12000,
        currency: 'AUD',
        effective_from: '2024-02-01', // Future date
        effective_until: null,
      });

      const overridesBySubjectAndBilling = {
        'subject-1': {
          CLASS: { hourly_rate_cents: 12000, currency: 'AUD' },
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

    it('should fall back to default when override has expired', () => {
      const override = createOverride({
        subject_id: 'subject-1',
        billing_type: 'CLASS',
        hourly_rate_cents: 12000,
        currency: 'AUD',
        effective_from: '2024-01-01',
        effective_until: '2024-01-10', // Expired
      });

      const overridesBySubjectAndBilling = {
        'subject-1': {
          CLASS: { hourly_rate_cents: 12000, currency: 'AUD' },
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
      const subsidy = createSubsidy({
        student_id: 'student-1',
        subject_id: 'subject-1',
        billing_type: 'CLASS',
        price_cents: 8000, // $80/hour subsidy rate
        currency: 'AUD',
        effective_from: '2024-01-01',
        effective_until: null,
      });

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
      const override = createOverride({
        subject_id: 'subject-1',
        billing_type: 'CLASS',
        hourly_rate_cents: 9000,
        currency: 'AUD',
        effective_from: '2024-01-01',
        effective_until: null,
      });

      const subsidy = createSubsidy({
        student_id: 'student-1',
        subject_id: 'subject-1',
        billing_type: 'CLASS',
        price_cents: 8000,
        currency: 'AUD',
        effective_from: '2024-01-01',
        effective_until: null,
      });

      const overridesBySubjectAndBilling = {
        'subject-1': {
          CLASS: { hourly_rate_cents: 9000, currency: 'AUD' },
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

    it('should not apply subsidy when student has no subsidy', () => {
      const result = calculateSessionPrice(
        mockSession,
        'student-1',
        new Date('2024-01-15'),
        mockPricingByBillingType,
        {},
        [],
        []
      );

      expect(result.amount_cents).toBe(10000); // Default rate
    });

    it('should not apply subsidy when subsidy is not active (future)', () => {
      const subsidy = createSubsidy({
        student_id: 'student-1',
        subject_id: 'subject-1',
        billing_type: 'CLASS',
        price_cents: 8000,
        currency: 'AUD',
        effective_from: '2024-02-01', // Future
        effective_until: null,
      });

      const result = calculateSessionPrice(
        mockSession,
        'student-1',
        new Date('2024-01-15'),
        mockPricingByBillingType,
        {},
        [],
        [subsidy]
      );

      expect(result.amount_cents).toBe(10000); // Default rate
    });

    it('should not apply subsidy when subsidy has expired', () => {
      const subsidy = createSubsidy({
        student_id: 'student-1',
        subject_id: 'subject-1',
        billing_type: 'CLASS',
        price_cents: 8000,
        currency: 'AUD',
        effective_from: '2024-01-01',
        effective_until: '2024-01-10', // Expired
      });

      const result = calculateSessionPrice(
        mockSession,
        'student-1',
        new Date('2024-01-15'),
        mockPricingByBillingType,
        {},
        [],
        [subsidy]
      );

      expect(result.amount_cents).toBe(10000); // Default rate
    });
  });

  describe('currency handling', () => {
    it('should handle USD currency', () => {
      const override = createOverride({
        subject_id: 'subject-1',
        billing_type: 'CLASS',
        hourly_rate_cents: 12000,
        currency: 'USD',
        effective_from: '2024-01-01',
        effective_until: null,
      });

      const overridesBySubjectAndBilling = {
        'subject-1': {
          CLASS: { hourly_rate_cents: 12000, currency: 'USD' },
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

      expect(result.currency).toBe('usd'); // Lowercase
    });

    it('should use subsidy currency when provided', () => {
      const subsidy = createSubsidy({
        student_id: 'student-1',
        subject_id: 'subject-1',
        billing_type: 'CLASS',
        price_cents: 8000,
        currency: 'USD',
        effective_from: '2024-01-01',
        effective_until: null,
      });

      const result = calculateSessionPrice(
        mockSession,
        'student-1',
        new Date('2024-01-15'),
        mockPricingByBillingType,
        {},
        [],
        [subsidy]
      );

      expect(result.currency).toBe('usd');
    });
  });

  describe('edge cases', () => {
    it('should round to nearest cent correctly', () => {
      const session = {
        ...mockSession,
        start_at: '2024-01-15T10:00:00Z',
        end_at: '2024-01-15T10:20:00Z', // 20 minutes = 0.333... hours
      };

      const pricing = {
        CLASS: { hourly_rate_cents: 10000, currency: 'AUD' },
      };

      const result = calculateSessionPrice(
        session,
        undefined,
        new Date('2024-01-15'),
        pricing,
        {},
        [],
        []
      );

      // 10000 * 0.333... = 3333.33... should round to 3333
      expect(result.amount_cents).toBe(3333);
    });

    it('should handle missing pricing data gracefully', () => {
      const result = calculateSessionPrice(
        mockSession,
        undefined,
        new Date('2024-01-15'),
        {},
        {},
        [],
        []
      );

      expect(result.amount_cents).toBe(0);
      expect(result.currency).toBe('aud');
    });
  });
});

describe('formatCurrency', () => {
  it('should format AUD amount correctly', () => {
    expect(formatCurrency(10000, 'aud')).toBe('$100.00');
  });

  it('should format USD amount correctly', () => {
    const result = formatCurrency(12345, 'usd');
    expect(result).toContain('123.45');
    // Currency symbol/format varies by locale (e.g. $123.45, US$123.45, USD 123.45)
    expect(result.length).toBeGreaterThan(5);
  });

  it('should default to AUD when currency not provided', () => {
    expect(formatCurrency(5000)).toBe('$50.00');
  });

  it('should handle zero', () => {
    expect(formatCurrency(0, 'aud')).toBe('$0.00');
  });

  it('should round cents correctly', () => {
    expect(formatCurrency(9999, 'aud')).toBe('$99.99');
  });
});
