/**
 * Tests for pricing calculation logic
 * These tests mirror the logic from supabase/functions/billing-runner/shared/pricing.ts
 */

describe('calculateSessionPrice', () => {
  // Mock implementation based on the actual function logic
  function calculateSessionPrice(
    session: {
      billing_type: string | null;
      subject_id: string;
      start_at: string;
      end_at: string;
    },
    studentId: string | undefined,
    targetDate: Date,
    pricingByBillingType: Record<string, { hourly_rate_cents: number; currency: string }>,
    overridesBySubjectAndBilling: Record<string, Record<string, any>>,
    pricingOverrides: any[],
    subsidies: any[]
  ): { amount_cents: number; currency: string } {
    if (!session.billing_type) {
      return { amount_cents: 0, currency: 'aud' };
    }

    const startTime = new Date(session.start_at).getTime();
    const endTime = new Date(session.end_at).getTime();
    const durationMs = endTime - startTime;
    const durationHours = durationMs / (1000 * 60 * 60);

    const override = overridesBySubjectAndBilling[session.subject_id]?.[session.billing_type];
    let hourlyRateCents = 0;
    let currency = 'aud';

    if (override) {
      const overrideData = pricingOverrides?.find(
        (o: any) =>
          o.subject_id === session.subject_id && o.billing_type === session.billing_type
      );
      if (overrideData) {
        const effectiveFrom = new Date(overrideData.effective_from);
        const effectiveUntil = overrideData.effective_until
          ? new Date(overrideData.effective_until)
          : null;
        if (effectiveFrom <= targetDate && (!effectiveUntil || effectiveUntil > targetDate)) {
          hourlyRateCents = override.hourly_rate_cents;
          currency = override.currency.toLowerCase();
        } else {
          const defaultPricing = pricingByBillingType[session.billing_type];
          hourlyRateCents = defaultPricing?.hourly_rate_cents || 0;
          currency = defaultPricing?.currency?.toLowerCase() || 'aud';
        }
      } else {
        const defaultPricing = pricingByBillingType[session.billing_type];
        hourlyRateCents = defaultPricing?.hourly_rate_cents || 0;
        currency = defaultPricing?.currency?.toLowerCase() || 'aud';
      }
    } else {
      const defaultPricing = pricingByBillingType[session.billing_type];
      hourlyRateCents = defaultPricing?.hourly_rate_cents || 0;
      currency = defaultPricing?.currency?.toLowerCase() || 'aud';
    }

    if (studentId && session.subject_id && session.billing_type) {
      const activeSub = (subsidies || []).find(
        (s: any) =>
          s.student_id === studentId &&
          s.subject_id === session.subject_id &&
          s.billing_type === session.billing_type &&
          (!s.effective_from || new Date(s.effective_from) <= targetDate) &&
          (!s.effective_until || new Date(s.effective_until) > targetDate)
      );

      if (activeSub) {
        const subsidyHourlyRateCents = activeSub.price_cents;
        hourlyRateCents = Math.min(hourlyRateCents, subsidyHourlyRateCents);
        if (activeSub.currency) {
          currency = activeSub.currency.toLowerCase();
        }
      }
    }

    return {
      amount_cents: Math.round(hourlyRateCents * durationHours),
      currency,
    };
  }

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

    it('should fall back to default when override has expired', () => {
      const override = {
        subject_id: 'subject-1',
        billing_type: 'DOMESTIC',
        hourly_rate_cents: 12000,
        currency: 'AUD',
        effective_from: '2024-01-01',
        effective_until: '2024-01-10', // Expired
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
      const subsidy = {
        student_id: 'student-1',
        subject_id: 'subject-1',
        billing_type: 'DOMESTIC',
        price_cents: 8000,
        currency: 'AUD',
        effective_from: '2024-02-01', // Future
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

      expect(result.amount_cents).toBe(10000); // Default rate
    });

    it('should not apply subsidy when subsidy has expired', () => {
      const subsidy = {
        student_id: 'student-1',
        subject_id: 'subject-1',
        billing_type: 'DOMESTIC',
        price_cents: 8000,
        currency: 'AUD',
        effective_from: '2024-01-01',
        effective_until: '2024-01-10', // Expired
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

      expect(result.amount_cents).toBe(10000); // Default rate
    });
  });

  describe('currency handling', () => {
    it('should handle USD currency', () => {
      const override = {
        subject_id: 'subject-1',
        billing_type: 'DOMESTIC',
        hourly_rate_cents: 12000,
        currency: 'USD',
        effective_from: '2024-01-01',
        effective_until: null,
      };

      const overridesBySubjectAndBilling = {
        'subject-1': {
          DOMESTIC: { hourly_rate_cents: 12000, currency: 'USD' },
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
      const subsidy = {
        student_id: 'student-1',
        subject_id: 'subject-1',
        billing_type: 'DOMESTIC',
        price_cents: 8000,
        currency: 'USD',
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
        DOMESTIC: { hourly_rate_cents: 10000, currency: 'AUD' },
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
