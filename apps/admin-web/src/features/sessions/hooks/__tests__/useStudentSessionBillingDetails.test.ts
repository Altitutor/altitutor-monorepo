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

  it('always abbreviates the month to three letters', () => {
    expect(formatBillingDate('2026-08-01T01:30:00Z')).toBe('31 Jul');
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
      customerBalanceCents: 0,
      customerBalanceCurrency: 'aud',
      previewableAssignmentIds: new Set(['session-student-1', 'session-student-2']),
    });

    expect(previews['session-1']).toEqual({
      amountCents: 10000,
      fullAmountCents: 10000,
      creditAppliedCents: 0,
      balanceAddedCents: 0,
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
      customerBalanceCents: 0,
      customerBalanceCurrency: 'aud',
      previewableAssignmentIds: new Set(['session-student-1', 'session-student-2']),
    });

    expect(previews).toEqual({});
  });

  it('previews a planned absence when the runner still charges it', () => {
    const rpcSession = {
      id: 'session-1',
      type: 'CLASS',
      billing_type: 'CLASS',
      class_id: null,
      subject_id: 'subject-1',
      start_at: '2026-08-01T01:30:00Z',
      end_at: '2026-08-01T03:00:00Z',
    } as unknown as Tables<'sessions'>;

    const previews = buildSessionInvoicePreviews({
      studentId: 'student-1',
      sessions: [rpcSession],
      classesById: {},
      sessionStudents: {
        'session-1': [{
          id: 'student-1',
          planned_absence: true,
          was_trial: false,
          actual_was_trial: false,
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
      customerBalanceCents: 0,
      customerBalanceCurrency: 'aud',
      previewableAssignmentIds: new Set(['session-student-1', 'session-student-2']),
    });

    expect(previews['session-1']).toMatchObject({
      fullAmountCents: 15_000,
      balanceAddedCents: 0,
    });
  });

  it('does not preview an assignment the runner will not invoice', () => {
    const rpcSession = {
      id: 'session-1',
      type: 'CLASS',
      billing_type: 'CLASS',
      class_id: null,
      subject_id: 'subject-1',
      start_at: '2026-08-01T01:30:00Z',
      end_at: '2026-08-01T03:00:00Z',
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
      customerBalanceCents: 0,
      customerBalanceCurrency: 'aud',
      previewableAssignmentIds: new Set(),
    });

    expect(previews).toEqual({});
  });

  it('applies customer credit in session order without a processing fee', () => {
    const earlier = {
      id: 'session-1',
      type: 'CLASS',
      billing_type: 'CLASS',
      class_id: null,
      subject_id: 'subject-1',
      start_at: '2026-01-03T00:30:00Z',
      end_at: '2026-01-03T01:30:00Z',
    } as unknown as Tables<'sessions'>;
    const later = {
      ...earlier,
      id: 'session-2',
      start_at: '2026-01-10T00:30:00Z',
      end_at: '2026-01-10T01:30:00Z',
    } as unknown as Tables<'sessions'>;

    const previews = buildSessionInvoicePreviews({
      studentId: 'student-1',
      sessions: [later, earlier],
      classesById: {},
      sessionStudents: {
        'session-1': [{
          id: 'student-1',
          planned_absence: false,
          sessions_students_id: 'session-student-1',
          invoice_status_payload: null,
        }],
        'session-2': [{
          id: 'student-1',
          planned_absence: false,
          sessions_students_id: 'session-student-2',
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
        auto_bill_enabled: true,
        invoice_email_to_student: true,
        invoice_email_to_parents: true,
      },
      defaultPaymentMethod: {
        id: 'pm-1',
        stripe_payment_method_id: 'pm_123',
        is_default: true,
        card_brand: 'visa',
        card_last4: '4242',
        card_exp_month: 1,
        card_exp_year: 2030,
        card_country: 'US',
        created_at: '2026-01-01T00:00:00Z',
      },
      customerBalanceCents: -15_000,
      customerBalanceCurrency: 'AUD',
      previewableAssignmentIds: new Set(['session-student-1', 'session-student-2']),
    });

    expect(previews['session-1']).toMatchObject({
      amountCents: 0,
      fullAmountCents: 10_000,
      creditAppliedCents: 10_000,
      action: 'bill',
    });
    expect(previews['session-2']).toMatchObject({
      amountCents: 5_000,
      fullAmountCents: 10_000,
      creditAppliedCents: 5_000,
    });
  });

  it('adds a positive customer balance to the earliest session only', () => {
    const earlier = {
      id: 'session-1',
      type: 'CLASS',
      billing_type: 'CLASS',
      class_id: null,
      subject_id: 'subject-1',
      start_at: '2026-01-03T00:30:00Z',
      end_at: '2026-01-03T01:30:00Z',
    } as unknown as Tables<'sessions'>;
    const later = {
      ...earlier,
      id: 'session-2',
      start_at: '2026-01-10T00:30:00Z',
      end_at: '2026-01-10T01:30:00Z',
    } as unknown as Tables<'sessions'>;

    const previews = buildSessionInvoicePreviews({
      studentId: 'student-1',
      sessions: [later, earlier],
      classesById: {},
      sessionStudents: {
        'session-1': [{
          id: 'student-1',
          sessions_students_id: 'session-student-1',
        }],
        'session-2': [{
          id: 'student-1',
          sessions_students_id: 'session-student-2',
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
      customerBalanceCents: 2_000,
      customerBalanceCurrency: 'aud',
      previewableAssignmentIds: new Set(['session-student-1', 'session-student-2']),
    });

    expect(previews['session-1']).toMatchObject({
      amountCents: 12_000,
      fullAmountCents: 10_000,
      balanceAddedCents: 2_000,
      creditAppliedCents: 0,
    });
    expect(previews['session-2']).toMatchObject({
      amountCents: 10_000,
      balanceAddedCents: 0,
    });
  });
});
