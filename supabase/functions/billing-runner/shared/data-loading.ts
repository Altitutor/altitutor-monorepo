// @ts-nocheck
// deno-lint-ignore-file no-explicit-any
import { createClient } from 'jsr:@supabase/supabase-js@2';

/**
 * Load billing settings from database
 */
export async function loadBillingSettings(supabase: any): Promise<{
  feePercentDom: number;
  feePercentIntl: number;
  feeFixedCents: number;
  domesticCountry: string;
}> {
  const { data: settings, error: settingsErr } = await supabase
    .from('billing_settings')
    .select('setting_key, setting_value');
  if (settingsErr) throw settingsErr;

  const settingsMap: Record<string, string> = {};
  for (const s of settings || []) settingsMap[s.setting_key] = s.setting_value;

  return {
    feePercentDom: Number(settingsMap.fee_percent_domestic || '0.0175'),
    feePercentIntl: Number(settingsMap.fee_percent_intl || '0.029'),
    feeFixedCents: Number(settingsMap.fee_fixed_cents || '30'),
    domesticCountry: (settingsMap.domestic_country || 'AU').toUpperCase(),
  };
}

/**
 * Load billing pricing tables
 */
export async function loadBillingPricing(supabase: any): Promise<
  Record<string, { hourly_rate_cents: number; currency: string }>
> {
  const { data: billingPricing, error: bpErr } = await supabase
    .from('billing_pricing')
    .select('billing_type, hourly_rate_cents, currency');
  if (bpErr) throw bpErr;

  const pricingByBillingType: Record<string, { hourly_rate_cents: number; currency: string }> =
    {};
  for (const p of billingPricing || []) {
    pricingByBillingType[p.billing_type] = {
      hourly_rate_cents: p.hourly_rate_cents,
      currency: p.currency,
    };
  }

  return pricingByBillingType;
}

/**
 * Load subject pricing overrides
 */
export async function loadPricingOverrides(
  supabase: any,
  subjectIds: string[]
): Promise<{
  overridesBySubjectAndBilling: Record<string, Record<string, any>>;
  pricingOverrides: any[];
}> {
  if (subjectIds.length === 0) {
    return { overridesBySubjectAndBilling: {}, pricingOverrides: [] };
  }

  const { data: pricingOverrides, error: poErr } = await supabase
    .from('billing_pricing_overrides')
    .select('subject_id, billing_type, hourly_rate_cents, currency, effective_from, effective_until')
    .in('subject_id', subjectIds);
  if (poErr) throw poErr;

  const overridesBySubjectAndBilling: Record<string, Record<string, any>> = {};
  for (const override of pricingOverrides || []) {
    if (!overridesBySubjectAndBilling[override.subject_id]) {
      overridesBySubjectAndBilling[override.subject_id] = {};
    }
    overridesBySubjectAndBilling[override.subject_id][override.billing_type] = {
      hourly_rate_cents: override.hourly_rate_cents,
      currency: override.currency,
      effective_from: override.effective_from,
      effective_until: override.effective_until,
    };
  }

  return { overridesBySubjectAndBilling, pricingOverrides: pricingOverrides || [] };
}

/**
 * Load student subsidies
 */
export async function loadSubsidies(supabase: any): Promise<any[]> {
  const { data: subsidies, error: subErr } = await supabase
    .from('student_subsidies')
    .select('student_id, subject_id, billing_type, price_cents, currency, effective_from, effective_until');
  if (subErr) throw subErr;

  return subsidies || [];
}

/**
 * Load billing info with default payment methods
 */
export async function loadBillingInfo(supabase: any): Promise<
  Record<string, {
    student_id: string;
    stripe_customer_id: string | null;
    payment_methods: Array<{
      stripe_payment_method_id: string;
      card_country: string | null;
    }>;
  }>
> {
  const { data: billingRows, error: billErr } = await supabase
    .from('vadmin_billing_with_payment_methods')
    .select('student_id, stripe_customer_id, stripe_payment_method_id, card_country');
  if (billErr) throw billErr;

  const billingByStudent: Record<string, any> = {};
  for (const b of billingRows || []) {
    billingByStudent[b.student_id] = {
      student_id: b.student_id,
      stripe_customer_id: b.stripe_customer_id,
      payment_methods: b.stripe_payment_method_id
        ? [
            {
              stripe_payment_method_id: b.stripe_payment_method_id,
              card_country: b.card_country,
            },
          ]
        : [],
    };
  }

  return billingByStudent;
}

/**
 * Load student and parent emails
 */
export async function loadStudentEmails(supabase: any): Promise<{
  parentEmailByStudent: Record<string, string | undefined>;
  studentEmailById: Record<string, string | undefined>;
}> {
  // Parent emails
  const { data: parentsJoin } = await supabase
    .from('parents_students')
    .select('student_id, parent:parents(id, email)');
  const parentEmailByStudent: Record<string, string | undefined> = {};
  for (const row of parentsJoin || []) {
    const email = (row as any).parent?.email as string | undefined;
    if (email && !parentEmailByStudent[row.student_id]) {
      parentEmailByStudent[row.student_id] = email;
    }
  }

  // Student emails
  const { data: students, error: stErr } = await supabase
    .from('students')
    .select('id, email');
  if (stErr) throw stErr;

  const studentEmailById: Record<string, string | undefined> = {};
  for (const s of students || []) {
    studentEmailById[s.id] = s.email || undefined;
  }

  return { parentEmailByStudent, studentEmailById };
}

/**
 * Load subjects
 */
export async function loadSubjects(
  supabase: any,
  subjectIds: string[]
): Promise<Record<string, any>> {
  if (subjectIds.length === 0) {
    return {};
  }

  const { data: subjects, error: subjErr } = await supabase
    .from('subjects')
    .select('id, name, curriculum, year_level')
    .in('id', subjectIds);
  if (subjErr) throw subjErr;

  const subjectById: Record<string, any> = {};
  for (const sub of subjects || []) {
    subjectById[sub.id] = sub;
  }

  return subjectById;
}

/**
 * Load classes
 */
export async function loadClasses(
  supabase: any,
  classIds: string[]
): Promise<Record<string, any>> {
  if (classIds.length === 0) {
    return {};
  }

  const { data: classes, error: classErr } = await supabase
    .from('classes')
    .select('id, level, subject_id')
    .in('id', classIds);
  if (classErr) throw classErr;

  const classById: Record<string, any> = {};
  for (const cls of classes || []) {
    classById[cls.id] = cls;
  }

  return classById;
}

/**
 * Check which sessions_students_ids are already invoiced
 * Returns a Set of invoiced sessions_students_ids
 */
export async function getInvoicedSessionsStudentsIds(
  supabase: any,
  sessionsStudentsIds: string[]
): Promise<Set<string>> {
  if (sessionsStudentsIds.length === 0) {
    return new Set();
  }

  const { data: invoiceItems, error } = await supabase
    .from('invoice_items')
    .select('sessions_students_id')
    .in('sessions_students_id', sessionsStudentsIds);

  if (error) {
    console.error('[billing-runner] Error checking invoiced sessions:', error);
    // On error, return empty set to be safe (won't skip sessions)
    return new Set();
  }

  const invoicedIds = new Set<string>();
  for (const item of invoiceItems || []) {
    if (item.sessions_students_id) {
      invoicedIds.add(item.sessions_students_id);
    }
  }

  return invoicedIds;
}
