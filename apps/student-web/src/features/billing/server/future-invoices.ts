import {
  buildFutureSessionCharges,
  selectRunnerInvoiceAssignmentIds,
  type Database,
} from "@altitutor/shared";
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
  id?: string;
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
  const previewableIds = new Set(
    selectRunnerInvoiceAssignmentIds(
      assignments.map((assignment) => assignment.id),
      chargeableIds,
      invoicedIds,
      adjustmentControlledIds,
    ),
  );
  const includedAssignments = assignments.filter((assignment) =>
    previewableIds.has(assignment.id),
  );
  const charges = buildFutureSessionCharges(
    includedAssignments.map((assignment) => ({
      id: assignment.id,
      subjectId: assignment.session.subject_id,
      billingType: assignment.session.billing_type,
      startAt: assignment.session.start_at,
      endAt: assignment.session.end_at,
      assignment,
    })),
    { studentId, pricing, pricingOverrides, subsidies },
  );

  const firstInvoiceBySubject = new Map<string, FutureInvoicePreview>();
  for (const charge of charges) {
    const { session } = charge.assignment;
    if (firstInvoiceBySubject.has(session.subject_id)) continue;

    firstInvoiceBySubject.set(session.subject_id, {
      sessions_students_id: charge.id,
      subject_id: session.subject_id,
      session_name:
        session.long_name ||
        session.subject?.long_name ||
        session.subject?.short_name ||
        session.subject?.name ||
        "Session",
      session_start_at: session.start_at,
      full_amount_cents: charge.amountCents,
      prior_charge_cents: charge.priorChargeCents,
      currency: charge.currency,
      is_first_in_currency: charge.isFirstInCurrency,
    });
  }

  return Array.from(firstInvoiceBySubject.values()).sort((left, right) => {
    const timeDifference =
      new Date(right.session_start_at).getTime() -
      new Date(left.session_start_at).getTime();
    return (
      timeDifference ||
      right.sessions_students_id.localeCompare(left.sessions_students_id)
    );
  });
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
        "id, student_id, subject_id, billing_type, price_cents, currency, effective_from, effective_until",
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
