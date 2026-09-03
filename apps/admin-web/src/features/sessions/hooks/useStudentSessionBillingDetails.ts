import { useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import type { Tables } from '@altitutor/shared';
import { billingApi } from '@/features/billing/api/billing';
import { invoicesKeys } from '@/features/billing/hooks/useInvoicesQuery';
import {
  getBillingPreferences,
  type BillingPreferences,
} from '@/features/billing/api/billing-preferences';
import {
  billingSettingsApi,
  type BillingSettingsRow,
} from '@/features/billing/api/billing-settings';
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
import {
  calculateSessionPrice,
  grossUpInvoiceAmount,
} from '@/shared/utils/pricing';

export type SessionInvoiceDetails = {
  invoiceNumber: string;
  amountCents: number;
  currency: string;
};

export type SessionInvoicePreview = {
  amountCents: number;
  currency: string;
  billingDate: string;
  action: 'bill' | 'send';
};

type UseStudentSessionBillingDetailsOptions = {
  enabled: boolean;
  studentId?: string;
  sessions: Tables<'sessions'>[];
  classesById: Record<string, Tables<'classes'>>;
  sessionStudents: Record<string, Array<{
    id: string;
    planned_absence?: boolean;
    sessions_students_id?: string | null;
    invoice_status_payload?: { invoice_id?: string | null } | null;
  }>>;
};

const DEFAULT_FEE_SETTINGS = {
  domesticPercent: 0.0175,
  internationalPercent: 0.029,
  fixedCents: 30,
  domesticCountry: 'AU',
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
  billingSettings: BillingSettingsRow[];
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

  return new Intl.DateTimeFormat('en-AU', {
    timeZone: 'UTC',
    day: 'numeric',
    month: 'short',
  }).format(billingDate);
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
  billingSettings,
}: BuildSessionInvoicePreviewsOptions): Record<string, SessionInvoicePreview> {
  if (!studentId) return {};

  const pricingByBillingType = Object.fromEntries(
    billingPricing.map((pricing) => [
      pricing.billing_type,
      {
        hourly_rate_cents: pricing.hourly_rate_cents,
        currency: pricing.currency,
      },
    ])
  );
  const overridesBySubjectAndBilling: Record<
    string,
    Record<string, { hourly_rate_cents: number; currency: string }>
  > = {};
  for (const override of [...pricingOverrides].reverse()) {
    overridesBySubjectAndBilling[override.subject_id] ??= {};
    overridesBySubjectAndBilling[override.subject_id][override.billing_type] = {
      hourly_rate_cents: override.hourly_rate_cents,
      currency: override.currency,
    };
  }

  const settingValues = Object.fromEntries(
    billingSettings.map((setting) => [setting.setting_key, setting.setting_value])
  );
  const domesticPercent = Number(settingValues.fee_percent_domestic);
  const internationalPercent = Number(settingValues.fee_percent_intl);
  const fixedCents = Number(settingValues.fee_fixed_cents);
  const domesticCountry = settingValues.domestic_country || DEFAULT_FEE_SETTINGS.domesticCountry;
  const feeSettings = {
    domesticPercent: Number.isFinite(domesticPercent)
      ? domesticPercent
      : DEFAULT_FEE_SETTINGS.domesticPercent,
    internationalPercent: Number.isFinite(internationalPercent)
      ? internationalPercent
      : DEFAULT_FEE_SETTINGS.internationalPercent,
    fixedCents: Number.isFinite(fixedCents) ? fixedCents : DEFAULT_FEE_SETTINGS.fixedCents,
  };
  const isInternational = !!defaultPaymentMethod?.card_country &&
    defaultPaymentMethod.card_country.toUpperCase() !== domesticCountry.toUpperCase();
  const action = preferences.auto_bill_enabled && defaultPaymentMethod ? 'bill' : 'send';

  return Object.fromEntries(
    sessions.flatMap((session) => {
      const student = sessionStudents[session.id]?.find((item) => item.id === studentId);
      const subjectId = session.subject_id ||
        (session.class_id ? classesById[session.class_id]?.subject_id : null);
      const billingType = session.billing_type;
      if (
        !student?.sessions_students_id ||
        student.planned_absence ||
        student.invoice_status_payload ||
        !billingType ||
        !subjectId ||
        !session.start_at ||
        !session.end_at
      ) {
        return [];
      }

      const price = calculateSessionPrice(
        {
          billing_type: billingType,
          subject_id: subjectId,
          start_at: session.start_at,
          end_at: session.end_at,
        },
        studentId,
        new Date(session.start_at),
        pricingByBillingType,
        overridesBySubjectAndBilling,
        pricingOverrides,
        subsidies
      );
      const amountCents = grossUpInvoiceAmount(
        price.amount_cents,
        isInternational,
        feeSettings.domesticPercent,
        feeSettings.internationalPercent,
        feeSettings.fixedCents
      );

      return [[
        session.id,
        {
          amountCents,
          currency: price.currency,
          billingDate: formatBillingDate(session.start_at),
          action,
        },
      ] as const];
    })
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
  const { data: billingSettings } = useQuery({
    queryKey: ['billing-settings'],
    queryFn: () => billingSettingsApi.getBillingSettings(),
    enabled: queryEnabled,
    staleTime: 1000 * 60 * 3,
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
      !billingSettings
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
      billingSettings,
    });
  }, [
    billingPricing,
    billingSettings,
    classesById,
    defaultPaymentMethod,
    preferences,
    pricingOverrides,
    sessionStudents,
    sessions,
    studentId,
    subsidies,
  ]);

  return { invoiceDetailsById, previewsBySessionId };
}
