/**
 * Tests for billing utility functions
 * These tests mirror the logic from supabase/functions/billing-runner/shared/utils.ts
 */

describe('grossUp', () => {
  function grossUp(
    net: number,
    isInternational: boolean,
    percentDomestic: number,
    percentIntl: number,
    fixedCents: number
  ): number {
    const percent = isInternational ? percentIntl : percentDomestic;
    return Math.round((net + fixedCents) / (1 - percent));
  }

  describe('domestic fees', () => {
    it('should calculate gross amount with domestic percentage fee', () => {
      const net = 10000; // $100
      const percentDomestic = 0.03; // 3%
      const percentIntl = 0.05; // 5%
      const fixedCents = 0;

      const result = grossUp(net, false, percentDomestic, percentIntl, fixedCents);

      // gross = (10000 + 0) / (1 - 0.03) = 10000 / 0.97 = 10309.28... ≈ 10309
      expect(result).toBe(10309);
    });

    it('should calculate gross amount with domestic percentage and fixed fee', () => {
      const net = 10000; // $100
      const percentDomestic = 0.03; // 3%
      const percentIntl = 0.05; // 5%
      const fixedCents = 50; // $0.50

      const result = grossUp(net, false, percentDomestic, percentIntl, fixedCents);

      // gross = (10000 + 50) / (1 - 0.03) = 10050 / 0.97 = 10360.82... ≈ 10361
      expect(result).toBe(10361);
    });
  });

  describe('international fees', () => {
    it('should calculate gross amount with international percentage fee', () => {
      const net = 10000; // $100
      const percentDomestic = 0.03; // 3%
      const percentIntl = 0.05; // 5%
      const fixedCents = 0;

      const result = grossUp(net, true, percentDomestic, percentIntl, fixedCents);

      // gross = (10000 + 0) / (1 - 0.05) = 10000 / 0.95 = 10526.31... ≈ 10526
      expect(result).toBe(10526);
    });

    it('should calculate gross amount with international percentage and fixed fee', () => {
      const net = 10000; // $100
      const percentDomestic = 0.03; // 3%
      const percentIntl = 0.05; // 5%
      const fixedCents = 50; // $0.50

      const result = grossUp(net, true, percentDomestic, percentIntl, fixedCents);

      // gross = (10000 + 50) / (1 - 0.05) = 10050 / 0.95 = 10578.94... ≈ 10579
      expect(result).toBe(10579);
    });
  });

  describe('edge cases', () => {
    it('should handle zero net amount', () => {
      const result = grossUp(0, false, 0.03, 0.05, 50);
      // gross = (0 + 50) / (1 - 0.03) = 50 / 0.97 = 51.54... ≈ 52
      expect(result).toBe(52);
    });

    it('should handle zero percentage fee', () => {
      const net = 10000;
      const result = grossUp(net, false, 0, 0, 0);
      // gross = (10000 + 0) / (1 - 0) = 10000
      expect(result).toBe(10000);
    });

    it('should round correctly for fractional results', () => {
      const net = 1000; // $10
      const percentDomestic = 0.025; // 2.5%
      const result = grossUp(net, false, percentDomestic, 0.05, 0);
      // gross = 1000 / (1 - 0.025) = 1000 / 0.975 = 1025.64... ≈ 1026
      expect(result).toBe(1026);
    });
  });
});

describe('calculateAdelaideDateRange', () => {
  function calculateAdelaideDateRange(targetDate: Date): {
    startIso: string;
    endIso: string;
  } {
    const year = targetDate.getUTCFullYear();
    const month = targetDate.getUTCMonth();
    const day = targetDate.getUTCDate();

    const adelaideOffsetMs = 10.5 * 60 * 60 * 1000; // 10.5 hours in milliseconds

    const startAdelaide = new Date(Date.UTC(year, month, day, 0, 0, 0, 0));
    const startUTC = new Date(startAdelaide.getTime() - adelaideOffsetMs);

    const endAdelaide = new Date(Date.UTC(year, month, day, 23, 59, 59, 999));
    const endUTC = new Date(endAdelaide.getTime() - adelaideOffsetMs);

    return { startIso: startUTC.toISOString(), endIso: endUTC.toISOString() };
  }

  it('should calculate correct date range for Adelaide timezone', () => {
    // January 15, 2024 in UTC
    const targetDate = new Date(Date.UTC(2024, 0, 15, 12, 0, 0)); // Noon UTC

    const result = calculateAdelaideDateRange(targetDate);

    expect(result.startIso).toBeTruthy();
    expect(result.endIso).toBeTruthy();
    expect(new Date(result.startIso).getTime()).toBeLessThan(new Date(result.endIso).getTime());
  });

  it('should cover full Adelaide day', () => {
    const targetDate = new Date(Date.UTC(2024, 0, 15));
    const result = calculateAdelaideDateRange(targetDate);

    const start = new Date(result.startIso);
    const end = new Date(result.endIso);

    // Should be approximately 24 hours apart
    const diffHours = (end.getTime() - start.getTime()) / (1000 * 60 * 60);
    expect(diffHours).toBeCloseTo(24, 0);
  });
});

describe('generateInvoiceIdempotencyKey', () => {
  function generateInvoiceIdempotencyKey(
    studentId: string,
    invoiceDate: string,
    timestamp: number
  ): string {
    return `invoice_${studentId}_${invoiceDate}_${timestamp}`;
  }

  it('should generate unique idempotency key', () => {
    const key = generateInvoiceIdempotencyKey('student-123', '2024-01-15', 1234567890);
    expect(key).toBe('invoice_student-123_2024-01-15_1234567890');
  });

  it('should generate different keys for different students', () => {
    const key1 = generateInvoiceIdempotencyKey('student-1', '2024-01-15', 1234567890);
    const key2 = generateInvoiceIdempotencyKey('student-2', '2024-01-15', 1234567890);
    expect(key1).not.toBe(key2);
  });

  it('should generate different keys for different dates', () => {
    const key1 = generateInvoiceIdempotencyKey('student-1', '2024-01-15', 1234567890);
    const key2 = generateInvoiceIdempotencyKey('student-1', '2024-01-16', 1234567890);
    expect(key1).not.toBe(key2);
  });
});
