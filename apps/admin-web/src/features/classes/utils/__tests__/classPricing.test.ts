import type { Tables } from '@altitutor/shared';
import {
  calculateStandardClassSessionPrice,
  resolveStandardClassRate,
} from '../classPricing';

const pricing = [
  { billing_type: 'EXAM_COURSE', hourly_rate_cents: 4000, currency: 'AUD' },
] as Tables<'billing_pricing'>[];

describe('Class standard pricing', () => {
  it('uses an effective subject override before the billing-type default', () => {
    const overrides = [{
      subject_id: 'subject-1',
      billing_type: 'EXAM_COURSE',
      hourly_rate_cents: 6000,
      currency: 'AUD',
      effective_from: '2026-09-01T00:00:00+09:30',
      effective_until: null,
    }] as Tables<'billing_pricing_overrides'>[];

    expect(resolveStandardClassRate(
      'EXAM_COURSE',
      'subject-1',
      new Date('2026-09-10T00:00:00+09:30'),
      pricing,
      overrides
    )).toEqual({ hourlyRateCents: 6000, currency: 'AUD' });
  });

  it('falls back when the subject override is not effective', () => {
    const overrides = [{
      subject_id: 'subject-1',
      billing_type: 'EXAM_COURSE',
      hourly_rate_cents: 6000,
      currency: 'AUD',
      effective_from: '2026-10-01T00:00:00+09:30',
      effective_until: null,
    }] as Tables<'billing_pricing_overrides'>[];

    expect(resolveStandardClassRate(
      'EXAM_COURSE',
      'subject-1',
      new Date('2026-09-10T00:00:00+09:30'),
      pricing,
      overrides
    )).toEqual({ hourlyRateCents: 4000, currency: 'AUD' });
  });

  it('multiplies the hourly rate by each schedule row duration', () => {
    expect(calculateStandardClassSessionPrice(
      '16:00',
      '17:30',
      { hourlyRateCents: 5000, currency: 'AUD' }
    )).toEqual({ amountCents: 7500, currency: 'AUD' });
  });
});
