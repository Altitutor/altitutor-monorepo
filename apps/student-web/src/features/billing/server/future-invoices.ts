import type { Database } from "@altitutor/shared";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { FutureInvoicePreview } from "../types/future-invoices";

type BillingType = Database["public"]["Enums"]["billing_type"];

export interface FutureSessionAssignment {
  id: string;
  session: {
    id: string;
    start_at: string;
    end_at: string;
    subject_id: string;
    billing_type: BillingType;
    long_name: string | null;
    subject: {
      id: string;
      name: string;
      long_name: string | null;
      short_name: string | null;
    } | null;
  };
}

interface BillingPrice {
  billing_type: BillingType;
  hourly_rate_cents: number;
  currency: string;
}

interface BillingPriceOverride extends BillingPrice {
  subject_id: string;
  effective_from: string;
  effective_until: string | null;
}

interface StudentSubsidy {
  student_id: string;
  subject_id: string;
  billing_type: BillingType;
  price_cents: number;
  currency: string;
  effective_from: string;
  effective_until: string | null;
}

export interface BuildFutureInvoicePreviewsInput {
  assignments: FutureSessionAssignment[];
  chargeableIds: Set<string>;
  invoicedIds: Set<string>;
  adjustmentControlledIds: Set<string>;
  pricing: BillingPrice[];
  pricingOverrides: BillingPriceOverride[];
  subsidies: StudentSubsidy[];
  studentId: string;
}

function isEffectiveAt(
  effectiveFrom: string | null,
  effectiveUntil: string | null,
  at: Date,
): boolean {
  return (
    (!effectiveFrom || new Date(effectiveFrom) <= at) &&
    (!effectiveUntil || new Date(effectiveUntil) > at)
  );
}

function calculateSessionAmount(
  assignment: FutureSessionAssignment,
  pricing: BillingPrice[],
  pricingOverrides: BillingPriceOverride[],
  subsidies: StudentSubsidy[],
  studentId: string,
): { amountCents: number; currency: string } {
  const { session } = assignment;
  const sessionDate = new Date(session.start_at);
  const defaultPrice = pricing.find(
    (price) => price.billing_type === session.billing_type,
  );
  const override = pricingOverrides.find(
    (price) =>
      price.subject_id === session.subject_id &&
      price.billing_type === session.billing_type &&
      isEffectiveAt(price.effective_from, price.effective_until, sessionDate),
  );

  let hourlyRateCents =
    override?.hourly_rate_cents ?? defaultPrice?.hourly_rate_cents ?? 0;
  let currency = (
    override?.currency ??
    defaultPrice?.currency ??
    "aud"
  ).toLowerCase();

  const subsidy = subsidies.find(
    (row) =>
      row.student_id === studentId &&
      row.subject_id === session.subject_id &&
      row.billing_type === session.billing_type &&
      isEffectiveAt(row.effective_from, row.effective_until, sessionDate),
  );
  if (subsidy) {
    hourlyRateCents = Math.min(hourlyRateCents, subsidy.price_cents);
    currency = subsidy.currency.toLowerCase();
  }

  const durationHours =
    (new Date(session.end_at).getTime() -
      new Date(session.start_at).getTime()) /
    (60 * 60 * 1000);

  return {
    amountCents: Math.round(hourlyRateCents * durationHours),
    currency,
  };
}

export function buildFutureInvoicePreviews({
  assignments,
  chargeableIds,
  invoicedIds,
  adjustmentControlledIds,
  pricing,
  pricingOverrides,
  subsidies,
  studentId,
}: BuildFutureInvoicePreviewsInput): FutureInvoicePreview[] {
  const sortedAssignments = assignments
    .filter(
      (assignment) =>
        chargeableIds.has(assignment.id) &&
        !invoicedIds.has(assignment.id) &&
        !adjustmentControlledIds.has(assignment.id),
    )
    .sort((left, right) => {
      const timeDifference =
        new Date(left.session.start_at).getTime() -
        new Date(right.session.start_at).getTime();
      return timeDifference || left.id.localeCompare(right.id);
    });

  const firstInvoiceBySubject = new Map<string, FutureInvoicePreview>();
  const cumulativeChargesByCurrency = new Map<string, number>();

  for (const assignment of sortedAssignments) {
    const { amountCents, currency } = calculateSessionAmount(
      assignment,
      pricing,
      pricingOverrides,
      subsidies,
      studentId,
    );
    const priorChargeCents = cumulativeChargesByCurrency.get(currency) ?? 0;
    const { session } = assignment;

    if (!firstInvoiceBySubject.has(session.subject_id)) {
      firstInvoiceBySubject.set(session.subject_id, {
        sessions_students_id: assignment.id,
        subject_id: session.subject_id,
        subject_name:
          session.subject?.long_name ||
          session.subject?.short_name ||
          session.subject?.name ||
          session.long_name ||
          "Session",
        session_start_at: session.start_at,
        full_amount_cents: amountCents,
        prior_charge_cents: priorChargeCents,
        currency,
      });
    }

    cumulativeChargesByCurrency.set(currency, priorChargeCents + amountCents);
  }

  return Array.from(firstInvoiceBySubject.values());
}

function isFutureSessionAssignment(
  row: Omit<FutureSessionAssignment, "session"> & {
    session: FutureSessionAssignment["session"] | null;
  },
): row is FutureSessionAssignment {
  return Boolean(
    row.session?.start_at &&
      row.session.end_at &&
      row.session.subject_id &&
      row.session.billing_type,
  );
}

export async function loadFutureInvoicePreviews(
  admin: SupabaseClient<Database>,
  studentId: string,
  now = new Date(),
): Promise<FutureInvoicePreview[]> {
  const { data: assignmentData, error: assignmentError } = await admin
    .from("sessions_students")
    .select(
      `
        id,
        session:sessions!inner(
          id,
          start_at,
          end_at,
          subject_id,
          billing_type,
          long_name,
          subject:subjects(id, name, long_name, short_name)
        )
      `,
    )
    .eq("student_id", studentId)
    .gt("session.start_at", now.toISOString())
    .eq("session.status", "ACTIVE")
    .not("session.billing_type", "is", null)
    .is("session.calendar_tombstone_until", null);

  if (assignmentError) throw assignmentError;

  const assignments = (
    (assignmentData ?? []) as unknown as Array<
      Omit<FutureSessionAssignment, "session"> & {
        session: FutureSessionAssignment["session"] | null;
      }
    >
  ).filter(isFutureSessionAssignment);
  if (assignments.length === 0) return [];

  const assignmentIds = assignments.map((assignment) => assignment.id);
  const subjectIds = Array.from(
    new Set(assignments.map((assignment) => assignment.session.subject_id)),
  );

  const [
    chargeableResult,
    invoicedResult,
    adjustmentResult,
    pricingResult,
    overrideResult,
    subsidyResult,
  ] = await Promise.all([
    admin.rpc("get_chargeable_sessions_students_ids", {
      p_sessions_students_ids: assignmentIds,
    }),
    admin.rpc("get_invoiced_sessions_students_ids", {
      p_sessions_students_ids: assignmentIds,
    }),
    admin
      .from("session_billing_adjustments")
      .select("sessions_students_id")
      .in("sessions_students_id", assignmentIds)
      .in("status", ["pending", "processing", "retryable", "failed"]),
    admin
      .from("billing_pricing")
      .select("billing_type, hourly_rate_cents, currency"),
    admin
      .from("billing_pricing_overrides")
      .select(
        "subject_id, billing_type, hourly_rate_cents, currency, effective_from, effective_until",
      )
      .in("subject_id", subjectIds),
    admin
      .from("student_subsidies")
      .select(
        "student_id, subject_id, billing_type, price_cents, currency, effective_from, effective_until",
      )
      .eq("student_id", studentId)
      .in("subject_id", subjectIds),
  ]);

  const queryError =
    chargeableResult.error ||
    invoicedResult.error ||
    adjustmentResult.error ||
    pricingResult.error ||
    overrideResult.error ||
    subsidyResult.error;
  if (queryError) throw queryError;

  return buildFutureInvoicePreviews({
    assignments,
    chargeableIds: new Set(chargeableResult.data ?? []),
    invoicedIds: new Set(invoicedResult.data ?? []),
    adjustmentControlledIds: new Set(
      (adjustmentResult.data ?? []).map((row) => row.sessions_students_id),
    ),
    pricing: pricingResult.data ?? [],
    pricingOverrides: overrideResult.data ?? [],
    subsidies: subsidyResult.data ?? [],
    studentId,
  });
}
