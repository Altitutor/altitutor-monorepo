import type { Tables } from '@altitutor/shared';
import {
  buildSessionInvoicePreviews,
  formatBillingDate,
} from '../useStudentSessionBillingDetails';

describe('formatBillingDate', () => {
  it('shows the Adelaide calendar day before the session as d MMM', () => {
    expect(formatBillingDate('2026-01-03T00:30:00Z')).toBe('2 Jan');
  });

  it('handles month and year boundaries', () => {
    expect(formatBillingDate('2026-01-01T00:30:00Z')).toBe('31 Dec');
  });
});

describe('buildSessionInvoicePreviews', () => {
  it('builds a preview using billing_type returned by search_sessions_admin', () => {
    const rpcSession = {
      id: 'session-1',
      type: 'CLASS',
      billing_type: 'CLASS',
      class_id: null,
      subject_id: 'subject-1',
      admin_shift_id: null,
      start_at: '2026-01-03T00:30:00Z',
      end_at: '2026-01-03T01:30:00Z',
      status: 'ACTIVE',
      created_at: '2026-01-01T00:00:00Z',
      updated_at: '2026-01-01T00:00:00Z',
    } as unknown as Tables<'sessions'>;

    const previews = buildSessionInvoicePreviews({
      studentId: 'student-1',
      sessions: [rpcSession],
      classesById: {},
      sessionStudents: {
        'session-1': [{
          id: 'student-1',
          planned_absence: false,
          sessions_students_id: 'session-student-1',
          invoice_status_payload: null,
        }],
      },
      billingPricing: [{
        billing_type: 'CLASS',
        hourly_rate_cents: 10000,
        currency: 'AUD',
        created_at: '2026-01-01T00:00:00Z',
        updated_at: '2026-01-01T00:00:00Z',
      }],
      pricingOverrides: [],
      subsidies: [],
      preferences: {
        auto_bill_enabled: false,
        invoice_email_to_student: true,
        invoice_email_to_parents: true,
      },
      defaultPaymentMethod: null,
      billingSettings: [
        {
          id: 'setting-1',
          setting_key: 'fee_percent_domestic',
          setting_value: '0.0175',
          description: null,
          updated_at: '2026-01-01T00:00:00Z',
        },
        {
          id: 'setting-2',
          setting_key: 'fee_percent_intl',
          setting_value: '0.029',
          description: null,
          updated_at: '2026-01-01T00:00:00Z',
        },
        {
          id: 'setting-3',
          setting_key: 'fee_fixed_cents',
          setting_value: '30',
          description: null,
          updated_at: '2026-01-01T00:00:00Z',
        },
      ],
    });

    expect(previews['session-1']).toEqual({
      amountCents: 10209,
      currency: 'aud',
      billingDate: '2 Jan',
      action: 'send',
    });
  });

  it('does not infer billing_type from the session type', () => {
    const rpcSession = {
      id: 'session-1',
      type: 'CLASS',
      billing_type: null,
      class_id: null,
      subject_id: 'subject-1',
      start_at: '2026-01-03T00:30:00Z',
      end_at: '2026-01-03T01:30:00Z',
    } as unknown as Tables<'sessions'>;

    const previews = buildSessionInvoicePreviews({
      studentId: 'student-1',
      sessions: [rpcSession],
      classesById: {},
      sessionStudents: {
        'session-1': [{
          id: 'student-1',
          sessions_students_id: 'session-student-1',
        }],
      },
      billingPricing: [{
        billing_type: 'CLASS',
        hourly_rate_cents: 10000,
        currency: 'AUD',
        created_at: '2026-01-01T00:00:00Z',
        updated_at: '2026-01-01T00:00:00Z',
      }],
      pricingOverrides: [],
      subsidies: [],
      preferences: {
        auto_bill_enabled: true,
        invoice_email_to_student: true,
        invoice_email_to_parents: true,
      },
      defaultPaymentMethod: null,
      billingSettings: [],
    });

    expect(previews).toEqual({});
  });
});
