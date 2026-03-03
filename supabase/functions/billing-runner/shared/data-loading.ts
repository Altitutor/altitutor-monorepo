import type { SupabaseClient } from 'jsr:@supabase/supabase-js@2';

/**
 * Load billing settings from database
 */
export async function loadBillingSettings(supabase: SupabaseClient): Promise<{
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
export async function loadBillingPricing(supabase: SupabaseClient): Promise<
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
  supabase: SupabaseClient,
  subjectIds: string[]
): Promise<{
  overridesBySubjectAndBilling: Record<string, Record<string, PricingOverrideRecord>>;
  pricingOverrides: Array<{
    subject_id: string;
    billing_type: string;
    hourly_rate_cents: number;
    currency: string;
    effective_from: string;
    effective_until?: string | null;
  }>;
}> {
  if (subjectIds.length === 0) {
    return { overridesBySubjectAndBilling: {}, pricingOverrides: [] };
  }

  const { data: pricingOverrides, error: poErr } = await supabase
    .from('billing_pricing_overrides')
    .select('subject_id, billing_type, hourly_rate_cents, currency, effective_from, effective_until')
    .in('subject_id', subjectIds);
  if (poErr) throw poErr;

  const overridesBySubjectAndBilling: Record<string, Record<string, PricingOverrideRecord>> = {};
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
export async function loadSubsidies(supabase: SupabaseClient): Promise<Array<{
  student_id: string;
  subject_id: string;
  billing_type: string;
  price_cents: number;
  currency?: string | null;
  effective_from?: string | null;
  effective_until?: string | null;
}>> {
  const { data: subsidies, error: subErr } = await supabase
    .from('student_subsidies')
    .select('student_id, subject_id, billing_type, price_cents, currency, effective_from, effective_until');
  if (subErr) throw subErr;

  return subsidies || [];
}

/**
 * Load billing info with default payment methods and billing preferences
 */
export async function loadBillingInfo(supabase: SupabaseClient): Promise<
  Record<string, {
    student_id: string;
    stripe_customer_id: string | null;
    payment_methods: Array<{
      stripe_payment_method_id: string;
      card_country: string | null;
    }>;
    auto_bill_enabled: boolean;
    invoice_email_to_student: boolean;
    invoice_email_to_parents: boolean;
  }>
> {
  // Query students_billing and student_payment_methods separately, then combine
  const { data: billingRows, error: billErr } = await supabase
    .from('students_billing')
    .select('student_id, stripe_customer_id, auto_bill_enabled, invoice_email_to_student, invoice_email_to_parents');
  if (billErr) throw billErr;

  const { data: paymentMethods, error: pmErr } = await supabase
    .from('student_payment_methods')
    .select('student_id, stripe_payment_method_id, card_country')
    .eq('is_default', true);
  if (pmErr) throw pmErr;

  // Create a map of payment methods by student_id
  const paymentMethodsByStudent: Record<string, Array<{
    stripe_payment_method_id: string;
    card_country: string | null;
  }>> = {};
  
  for (const pm of paymentMethods || []) {
    if (!paymentMethodsByStudent[pm.student_id]) {
      paymentMethodsByStudent[pm.student_id] = [];
    }
    paymentMethodsByStudent[pm.student_id].push({
      stripe_payment_method_id: pm.stripe_payment_method_id,
      card_country: pm.card_country,
    });
  }

  // Combine billing info with payment methods and preferences
  const billingByStudent: Record<string, {
    student_id: string;
    stripe_customer_id: string | null;
    payment_methods: Array<{ stripe_payment_method_id: string; card_country: string | null }>;
    auto_bill_enabled: boolean;
    invoice_email_to_student: boolean;
    invoice_email_to_parents: boolean;
  }> = {};
  for (const b of billingRows || []) {
    billingByStudent[b.student_id] = {
      student_id: b.student_id,
      stripe_customer_id: b.stripe_customer_id,
      payment_methods: paymentMethodsByStudent[b.student_id] || [],
      // Billing preferences (defaults match migration defaults)
      auto_bill_enabled: b.auto_bill_enabled ?? true,
      invoice_email_to_student: b.invoice_email_to_student ?? true,
      invoice_email_to_parents: b.invoice_email_to_parents ?? true,
    };
  }

  return billingByStudent;
}

/**
 * Load student and parent emails
 * Returns all parent emails for each student (not just the first one)
 */
export async function loadStudentEmails(supabase: SupabaseClient): Promise<{
  parentEmailsByStudent: Record<string, string[]>; // All parent emails per student
  studentEmailById: Record<string, string | undefined>;
}> {
  // Parent emails - get ALL parent emails for each student
  const { data: parentsJoin } = await supabase
    .from('parents_students')
    .select('student_id, parent:parents(id, email)');
  const parentEmailsByStudent: Record<string, string[]> = {};
  for (const row of parentsJoin || []) {
    const parent = (row as { parent?: { email?: string } | null }).parent;
    const email = parent?.email;
    if (email) {
      if (!parentEmailsByStudent[row.student_id]) {
        parentEmailsByStudent[row.student_id] = [];
      }
      // Avoid duplicates
      if (!parentEmailsByStudent[row.student_id].includes(email)) {
        parentEmailsByStudent[row.student_id].push(email);
      }
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

  return { parentEmailsByStudent, studentEmailById };
}

/**
 * Load subjects
 */
interface SubjectRow {
  id: string;
  name?: string | null;
  curriculum?: string | null;
  year_level?: number | null;
}

export async function loadSubjects(
  supabase: SupabaseClient,
  subjectIds: string[]
): Promise<Record<string, SubjectRow>> {
  if (subjectIds.length === 0) {
    return {};
  }

  const { data: subjects, error: subjErr } = await supabase
    .from('subjects')
    .select('id, name, curriculum, year_level')
    .in('id', subjectIds);
  if (subjErr) throw subjErr;

  const subjectById: Record<string, SubjectRow> = {};
  for (const sub of subjects || []) {
    subjectById[sub.id] = sub;
  }

  return subjectById;
}

/**
 * Load classes
 */
interface ClassRow {
  id: string;
  level?: string | number | null;
  subject_id?: string | null;
}

export async function loadClasses(
  supabase: SupabaseClient,
  classIds: string[]
): Promise<Record<string, ClassRow>> {
  if (classIds.length === 0) {
    return {};
  }

  const { data: classes, error: classErr } = await supabase
    .from('classes')
    .select('id, level, subject_id')
    .in('id', classIds);
  if (classErr) throw classErr;

  const classById: Record<string, ClassRow> = {};
  for (const cls of classes || []) {
    classById[cls.id] = cls;
  }

  return classById;
}

/**
 * Check which sessions_students_ids are already invoiced
 * Returns a Set of invoiced sessions_students_ids
 * Excludes voided and uncollectible invoices to allow re-invoicing
 */
export async function getInvoicedSessionsStudentsIds(
  supabase: SupabaseClient,
  sessionsStudentsIds: string[]
): Promise<Set<string>> {
  if (sessionsStudentsIds.length === 0) {
    return new Set();
  }

  // First, get invoice_ids for active invoices (exclude voided/uncollectible)
  // This allows re-invoicing sessions that were previously voided or marked uncollectible
  const { data: activeInvoices, error: invoiceError } = await supabase
    .from('invoices')
    .select('id')
    .in('status', ['draft', 'open', 'paid']);

  if (invoiceError) {
    console.error('[billing-runner] Error fetching active invoices:', invoiceError);
    // On error, return empty set to be safe (won't skip sessions)
    return new Set();
  }

  const activeInvoiceIds = (activeInvoices || []).map((inv: { id: string }) => inv.id);
  
  if (activeInvoiceIds.length === 0) {
    return new Set();
  }

  // Only check invoice_items from active invoices
  const { data: invoiceItems, error } = await supabase
    .from('invoice_items')
    .select('sessions_students_id')
    .in('sessions_students_id', sessionsStudentsIds)
    .in('invoice_id', activeInvoiceIds)
    // Exclude fee items - only check session charges
    .eq('is_fee', false);

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
