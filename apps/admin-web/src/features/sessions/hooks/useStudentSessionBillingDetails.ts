import { useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import {
  applyCustomerBalanceToFutureCharge,
  buildFutureSessionCharges,
  type Tables,
} from '@altitutor/shared';
import { billingApi } from '@/features/billing/api/billing';
import { invoicesKeys } from '@/features/billing/hooks/useInvoicesQuery';
import {
  getBillingPreferences,
  type BillingPreferences,
} from '@/features/billing/api/billing-preferences';
import {
  paymentMethodsApi,
  type PaymentMethodData,
} from '@/features/billing/api/payment-methods';
import { pricingApi, type BillingPricingRow } from '@/features/billing/api/pricing';
import {
  subjectPricingOverridesApi,
  type SubjectPricingOverrideRow,
} from '@/features/billing/api/subject-pricing-overrides';
import {
  fetchStudentSubsidies,
  type StudentSubsidyRow,
} from '@/features/students/api/subsidies';
import { formatDayMonth } from '@/shared/utils/datetime';

export type SessionInvoiceDetails = {
  invoiceNumber: string;
  amountCents: number;
  currency: string;
};

export type SessionInvoicePreview = {
  amountCents: number;
  fullAmountCents: number;
  creditAppliedCents: number;
  balanceAddedCents: number;
  currency: string;
  billingDate: string;
  action: 'bill' | 'send';
};

type CustomerBalance = {
  balance_cents: number;
  currency: string;
};

type UseStudentSessionBillingDetailsOptions = {
  enabled: boolean;
  studentId?: string;
  sessions: Tables<'sessions'>[];
  classesById: Record<string, Tables<'classes'>>;
  sessionStudents: Record<string, Array<{
    id: string;
    planned_absence?: boolean;
    was_trial?: boolean;
    actual_was_trial?: boolean | null;
    sessions_students_id?: string | null;
    invoice_status_payload?: { invoice_id?: string | null } | null;
  }>>;
};

type BuildSessionInvoicePreviewsOptions = Omit<
  UseStudentSessionBillingDetailsOptions,
  'enabled'
> & {
  billingPricing: BillingPricingRow[];
  pricingOverrides: SubjectPricingOverrideRow[];
  subsidies: StudentSubsidyRow[];
  preferences: BillingPreferences;
  defaultPaymentMethod: PaymentMethodData | null;
  customerBalanceCents: number;
  customerBalanceCurrency: string;
  previewableAssignmentIds: ReadonlySet<string>;
};

export function formatBillingDate(sessionStartAt: string): string {
  const parts = new Intl.DateTimeFormat('en-AU', {
    timeZone: 'Australia/Adelaide',
    year: 'numeric',
    month: 'numeric',
    day: 'numeric',
  }).formatToParts(new Date(sessionStartAt));
  const value = (type: Intl.DateTimeFormatPartTypes) =>
    Number(parts.find((part) => part.type === type)?.value);
  const billingDate = new Date(Date.UTC(value('year'), value('month') - 1, value('day') - 1, 12));

  return formatDayMonth(billingDate);
}

export function buildSessionInvoicePreviews({
  studentId,
  sessions,
  classesById,
  sessionStudents,
  billingPricing,
  pricingOverrides,
  subsidies,
  preferences,
  defaultPaymentMethod,
  customerBalanceCents,
  customerBalanceCurrency,
  previewableAssignmentIds,
}: BuildSessionInvoicePreviewsOptions): Record<string, SessionInvoicePreview> {
  if (!studentId) return {};

  const action = preferences.auto_bill_enabled && defaultPaymentMethod ? 'bill' : 'send';
  const eligible = sessions.flatMap((session) => {
    const student = sessionStudents[session.id]?.find((item) => item.id === studentId);
    const subjectId = session.subject_id ||
      (session.class_id ? classesById[session.class_id]?.subject_id : null);
    const billingType = session.billing_type;
    if (
      !student?.sessions_students_id ||
      !previewableAssignmentIds.has(student.sessions_students_id) ||
      !billingType ||
      !subjectId ||
      !session.start_at ||
      !session.end_at
    ) {
      return [];
    }

    return [{
      id: student.sessions_students_id,
      sessionId: session.id,
      subjectId,
      billingType,
      startAt: session.start_at,
      endAt: session.end_at,
    }];
  });

  const charges = buildFutureSessionCharges(eligible, {
    studentId,
    pricing: billingPricing,
    pricingOverrides,
    subsidies,
  });

  return Object.fromEntries(
    charges.map((charge) => {
      const payment = applyCustomerBalanceToFutureCharge({
        fullAmountCents: charge.amountCents,
        priorChargeCents: charge.priorChargeCents,
        invoiceCurrency: charge.currency,
        customerBalanceCents,
        customerBalanceCurrency,
        isFirstInCurrency: charge.isFirstInCurrency,
      });

      return [
        charge.sessionId,
        {
          amountCents: payment.payableCents,
          fullAmountCents: charge.amountCents,
          creditAppliedCents: payment.creditAppliedCents,
          balanceAddedCents: payment.balanceAddedCents,
          currency: charge.currency,
          billingDate: formatBillingDate(charge.startAt),
          action,
        },
      ] as const;
    }),
  );
}

export function useStudentSessionBillingDetails({
  enabled,
  studentId,
  sessions,
  classesById,
  sessionStudents,
}: UseStudentSessionBillingDetailsOptions) {
  const queryEnabled = enabled && !!studentId;

  const { data: invoices } = useQuery({
    queryKey: [...invoicesKeys.lists(), 'student-session-summary', studentId],
    queryFn: () => billingApi.getInvoicesByStudent(studentId!),
    enabled: queryEnabled,
    staleTime: 1000 * 60 * 3,
  });
  const { data: billingPricing } = useQuery({
    queryKey: ['billing-pricing'],
    queryFn: () => pricingApi.getBillingPricing(),
    enabled: queryEnabled,
    staleTime: 1000 * 60 * 3,
  });
  const { data: pricingOverrides } = useQuery({
    queryKey: ['subject-pricing-overrides'],
    queryFn: () => subjectPricingOverridesApi.getAllSubjectOverrides(),
    enabled: queryEnabled,
    staleTime: 1000 * 60 * 3,
  });
  const { data: subsidies } = useQuery({
    queryKey: ['student-subsidies', studentId],
    queryFn: () => fetchStudentSubsidies(studentId!),
    enabled: queryEnabled,
    staleTime: 1000 * 60 * 3,
  });
  const { data: preferences } = useQuery({
    queryKey: ['billing-preferences', studentId],
    queryFn: () => getBillingPreferences(studentId!),
    enabled: queryEnabled,
    staleTime: 1000 * 60 * 2,
  });
  const { data: defaultPaymentMethod } = useQuery({
    queryKey: ['student-payment-methods', studentId, 'default'],
    queryFn: () => paymentMethodsApi.getDefaultPaymentMethod(studentId!),
    enabled: queryEnabled,
    staleTime: 1000 * 60 * 3,
  });
  const {
    data: previewableAssignmentIds,
    isSuccess: previewableAssignmentsLoaded,
  } = useQuery({
    queryKey: ['invoice-preview-assignments', studentId],
    queryFn: async (): Promise<string[]> => {
      const response = await fetch(`/api/students/${studentId}/invoice-preview-assignments`);
      if (!response.ok) {
        throw new Error('Failed to load invoice preview assignments');
      }
      const body = await response.json() as { sessions_students_ids: string[] };
      return body.sessions_students_ids;
    },
    enabled: queryEnabled,
    staleTime: 1000 * 60,
  });
  const {
    data: customerBalance,
    isSuccess: customerBalanceLoaded,
    isError: customerBalanceFailed,
  } = useQuery({
    queryKey: ['customer-balance', studentId],
    queryFn: async (): Promise<CustomerBalance> => {
      const response = await fetch(`/api/students/${studentId}/customer-balance`);
      if (!response.ok) {
        throw new Error('Failed to fetch customer balance');
      }
      return response.json() as Promise<CustomerBalance>;
    },
    enabled: queryEnabled,
    staleTime: 1000 * 60,
  });

  const invoiceDetailsById = useMemo<Record<string, SessionInvoiceDetails>>(
    () =>
      Object.fromEntries(
        (invoices ?? []).map((invoice) => [
          invoice.id,
          {
            invoiceNumber: invoice.stripe_invoice_number || invoice.id.slice(0, 8),
            amountCents: invoice.total_cents ?? invoice.amount_due_cents,
            currency: invoice.currency,
          },
        ])
      ),
    [invoices]
  );

  const previewsBySessionId = useMemo<Record<string, SessionInvoicePreview>>(() => {
    if (
      !studentId ||
      !billingPricing ||
      !pricingOverrides ||
      !subsidies ||
      !preferences ||
      defaultPaymentMethod === undefined ||
      !previewableAssignmentsLoaded ||
      (!customerBalanceLoaded && !customerBalanceFailed)
    ) {
      return {};
    }
    return buildSessionInvoicePreviews({
      studentId,
      sessions,
      classesById,
      sessionStudents,
      billingPricing,
      pricingOverrides,
      subsidies,
      preferences,
      defaultPaymentMethod,
      customerBalanceCents: customerBalance?.balance_cents ?? 0,
      customerBalanceCurrency: customerBalance?.currency ?? 'aud',
      previewableAssignmentIds: new Set(previewableAssignmentIds ?? []),
    });
  }, [
    billingPricing,
    classesById,
    customerBalance,
    customerBalanceFailed,
    customerBalanceLoaded,
    defaultPaymentMethod,
    preferences,
    previewableAssignmentIds,
    previewableAssignmentsLoaded,
    pricingOverrides,
    sessionStudents,
    sessions,
    studentId,
    subsidies,
  ]);

  return { invoiceDetailsById, previewsBySessionId };
}
