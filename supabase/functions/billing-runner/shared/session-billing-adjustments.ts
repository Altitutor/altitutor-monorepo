import type { SupabaseClient } from 'jsr:@supabase/supabase-js@2';
import Stripe from 'npm:stripe@16.6.0';
import {
  loadBillingInfo,
  loadBillingPricing,
  loadClasses,
  loadPricingOverrides,
  loadStudentEmails,
  loadSubjects,
  loadSubsidies,
} from './data-loading.ts';
import { processStudentInvoicing } from './student-processing.ts';
import { getAdelaideDateString } from './utils.ts';
import { buildRestorationBillingContext, buildSessionCreditNoteCommand } from './session-billing-adjustment-policy.ts';
import { buildCreditNoteNotificationEmail, deliverEdgeEmail } from '../../_shared/email.generated.ts';

interface SessionBillingAdjustment {
  id: string;
  sessions_students_id: string;
  kind: 'credit_note' | 'session_charge' | 'restoration_charge';
  source_invoice_item_id: string | null;
  source_credit_note_id: string | null;
  amount_cents: number | null;
  currency: string;
  reason_category: string;
  reason_note: string | null;
  idempotency_key: string;
}

interface AdjustmentSessionStudent {
  id: string;
  session_id: string;
  student_id: string;
}

interface AdjustmentSession {
  id: string;
  start_at: string;
  end_at: string;
  subject_id: string | null;
  class_id: string | null;
  billing_type: string | null;
}

export interface ProcessSessionBillingAdjustmentsOptions {
  supabase: SupabaseClient;
  stripe: Stripe;
  isStripeTestKey: boolean;
  isStripeLiveKey: boolean;
  resendApiKey?: string;
  limit?: number;
}

export interface ProcessSessionBillingAdjustmentsResult {
  claimed: number;
  succeeded: number;
  failed: number;
}

async function markSucceeded(supabase: SupabaseClient, adjustmentId: string) {
  const { error } = await supabase
    .from('session_billing_adjustments')
    .update({
      status: 'succeeded',
      completed_at: new Date().toISOString(),
      last_error: null,
    })
    .eq('id', adjustmentId)
    .eq('status', 'processing');
  if (error) throw error;
}

async function markSuperseded(supabase: SupabaseClient, adjustmentId: string) {
  const { error } = await supabase
    .from('session_billing_adjustments')
    .update({
      status: 'superseded',
      completed_at: new Date().toISOString(),
      last_error: 'Superseded after re-evaluating the current session obligation',
    })
    .eq('id', adjustmentId)
    .eq('status', 'processing');
  if (error) throw error;
}

async function revalidateAdjustment(
  supabase: SupabaseClient,
  adjustment: SessionBillingAdjustment,
): Promise<boolean> {
  const { data, error } = await supabase.rpc(
    'enqueue_session_billing_adjustment',
    {
      p_sessions_students_id: adjustment.sessions_students_id,
      p_created_by: null,
      p_reason_category: 'system_reconciliation',
      p_reason_note: 'Revalidated immediately before applying the financial adjustment',
      p_depends_on_adjustment_id: null,
    },
  );
  if (error) throw error;
  return data === adjustment.id;
}

async function issueCreditNote(
  supabase: SupabaseClient,
  stripe: Stripe,
  adjustment: SessionBillingAdjustment,
  notification: {
    resendApiKey?: string;
    billingByStudent: Record<string, {
      invoice_email_to_student?: boolean;
      invoice_email_to_parents?: boolean;
    }>;
    parentEmailsByStudent: Record<string, string[]>;
    studentEmailById: Record<string, string | undefined>;
  },
) {
  if (!adjustment.source_invoice_item_id || !adjustment.amount_cents) {
    throw new Error(
      'Credit adjustment is missing its source invoice line or amount',
    );
  }

  const { data: invoiceItem, error: lineError } = await supabase
    .from('invoice_items')
    .select(
      'id, invoice_id, sessions_students_id, stripe_invoice_item_id, amount_cents, line_kind',
    )
    .eq('id', adjustment.source_invoice_item_id)
    .is('deleted_at', null)
    .single();
  if (lineError || !invoiceItem) {
    throw lineError ?? new Error('Source invoice line not found');
  }

  const { data: invoice, error: invoiceError } = await supabase
    .from('invoices')
    .select('id, student_id, stripe_invoice_id, status')
    .eq('id', invoiceItem.invoice_id)
    .is('deleted_at', null)
    .single();
  if (invoiceError || !invoice) {
    throw invoiceError ?? new Error('Source invoice not found');
  }
  if (invoice.status !== 'open' && invoice.status !== 'paid') {
    throw new Error(
      `Invoice ${invoice.id} cannot be credited while status is ${invoice.status}`,
    );
  }

  const { data: creditableInvoiceItems, error: creditableLinesError } = await supabase
    .from('invoice_items')
    .select('id, stripe_invoice_item_id, amount_cents, is_fee')
    .eq('invoice_id', invoice.id)
    .eq('sessions_students_id', invoiceItem.sessions_students_id)
    .is('deleted_at', null);
  if (creditableLinesError) throw creditableLinesError;
  const creditableLines = (creditableInvoiceItems ?? []).filter(
    (item) =>
      item.id === invoiceItem.id ||
      (invoiceItem.line_kind === 'session_charge' && item.is_fee),
  );

  const stripeLines = await stripe.invoices.listLineItems(
    invoice.stripe_invoice_id,
    { limit: 100 },
  );
  const stripeLineByInvoiceItemId = new Map<string, string>();
  for (const line of stripeLines.data) {
    const lineRecord = line as unknown as {
      invoice_item?: string | { id?: string } | null;
      parent?: {
        invoice_item_details?: { invoice_item?: string };
        subscription_item_details?: { invoice_item?: string };
      } | null;
    };
    const parent = lineRecord.parent;
    const legacyInvoiceItemId = typeof lineRecord.invoice_item === 'string'
      ? lineRecord.invoice_item
      : lineRecord.invoice_item?.id;
    const stripeInvoiceItemId = parent?.invoice_item_details?.invoice_item ??
      parent?.subscription_item_details?.invoice_item ??
      legacyInvoiceItemId;
    if (stripeInvoiceItemId) {
      stripeLineByInvoiceItemId.set(stripeInvoiceItemId, line.id);
    }
  }

  const commandLines = creditableLines.map((item) => ({
    id: stripeLineByInvoiceItemId.get(item.stripe_invoice_item_id),
    amountCents: item.amount_cents,
  }));
  if (commandLines.some((line) => !line.id)) {
    throw new Error('A source Stripe invoice line no longer exists');
  }

  const command = buildSessionCreditNoteCommand({
    adjustmentId: adjustment.id,
    idempotencyKey: adjustment.idempotency_key,
    stripeInvoiceId: invoice.stripe_invoice_id,
    stripeLines: commandLines as Array<{ id: string; amountCents: number }>,
    sourceInvoiceItemId: invoiceItem.id,
    sessionsStudentsId: adjustment.sessions_students_id,
    amountCents: adjustment.amount_cents,
    invoiceStatus: invoice.status,
    reasonCategory: adjustment.reason_category,
    reasonNote: adjustment.reason_note,
  });
  const creditNote = await stripe.creditNotes.create(
    command.params,
    { idempotencyKey: command.idempotencyKey },
  );

  const { error: creditError } = await supabase.from('credit_notes').upsert(
    {
      invoice_id: invoice.id,
      stripe_credit_note_id: creditNote.id,
      amount_cents: creditNote.amount,
      currency: creditNote.currency,
      reason: creditNote.reason,
      status: creditNote.status,
      metadata: creditNote.metadata,
      credit_amount_cents: invoice.status === 'paid' ? adjustment.amount_cents : null,
      source_invoice_item_id: invoiceItem.id,
      billing_adjustment_id: adjustment.id,
    },
    { onConflict: 'stripe_credit_note_id' },
  );
  if (creditError) throw creditError;

  if (notification.resendApiKey) {
    const preferences = notification.billingByStudent[invoice.student_id];
    const recipients = [
      ...(preferences?.invoice_email_to_student ? [notification.studentEmailById[invoice.student_id]] : []),
      ...(preferences?.invoice_email_to_parents ? (notification.parentEmailsByStudent[invoice.student_id] ?? []) : []),
    ].filter((email): email is string => Boolean(email));
    const uniqueRecipients = [...new Set(recipients)];
    const email = buildCreditNoteNotificationEmail({
      creditNoteNumber: creditNote.number ?? creditNote.id,
      amount: `${creditNote.currency.toUpperCase()} $${(creditNote.amount / 100).toFixed(2)}`,
      remainsOnAccount: invoice.status === 'paid',
    });
    const failedRecipients: string[] = [];

    for (const recipient of uniqueRecipients) {
      try {
        await deliverEdgeEmail({
          apiKey: notification.resendApiKey,
          to: recipient,
          email,
          idempotencyKey: `core-credit-note/${creditNote.id}/${recipient}`,
        });
      } catch (emailError) {
        failedRecipients.push(recipient);
        console.error(
          `[billing-runner] Failed to send credit note ${creditNote.id} to ${recipient}:`,
          emailError,
        );
      }
    }

    if (failedRecipients.length > 0) {
      throw new Error(
        `Credit note ${creditNote.id} was created, but notification delivery failed for ${failedRecipients.length} recipient(s)`,
      );
    }
  }
}

export async function processSessionBillingAdjustments(
  options: ProcessSessionBillingAdjustmentsOptions,
): Promise<ProcessSessionBillingAdjustmentsResult> {
  const { supabase, stripe } = options;
  const { data, error } = await supabase.rpc(
    'claim_session_billing_adjustments',
    {
      p_limit: options.limit ?? 25,
    },
  );
  if (error) throw error;

  const adjustments = (data ?? []) as SessionBillingAdjustment[];
  const result = { claimed: adjustments.length, succeeded: 0, failed: 0 };
  if (adjustments.length === 0) return result;

  const chargeAdjustments = adjustments.filter((item) => item.kind !== 'credit_note');
  const sessionStudentIds = chargeAdjustments.map((item) => item.sessions_students_id);
  const assignmentsById = new Map<string, AdjustmentSessionStudent>();
  const sessionsById = new Map<string, AdjustmentSession>();

  if (sessionStudentIds.length > 0) {
    const { data: assignments, error: assignmentsError } = await supabase
      .from('sessions_students')
      .select('id, session_id, student_id')
      .in('id', sessionStudentIds);
    if (assignmentsError) throw assignmentsError;
    for (
      const assignment of (assignments ?? []) as AdjustmentSessionStudent[]
    ) {
      assignmentsById.set(assignment.id, assignment);
    }

    const sessionIds = Array.from(
      new Set((assignments ?? []).map((item) => item.session_id)),
    );
    const { data: sessions, error: sessionsError } = await supabase
      .from('sessions')
      .select('id, start_at, end_at, subject_id, class_id, billing_type')
      .in('id', sessionIds);
    if (sessionsError) throw sessionsError;
    for (const session of (sessions ?? []) as AdjustmentSession[]) {
      sessionsById.set(session.id, session);
    }
  }

  const allSessions = Array.from(sessionsById.values());
  const subjectIds = Array.from(
    new Set(
      allSessions.map((item) => item.subject_id).filter((id): id is string => Boolean(id)),
    ),
  );
  const classIds = Array.from(
    new Set(
      allSessions.map((item) => item.class_id).filter((id): id is string => Boolean(id)),
    ),
  );
  const pricingByBillingType = await loadBillingPricing(supabase);
  const { overridesBySubjectAndBilling, pricingOverrides } = await loadPricingOverrides(supabase, subjectIds);
  const subjectById = await loadSubjects(supabase, subjectIds);
  const normalizedSubjectById = Object.fromEntries(
    Object.entries(subjectById).map(([id, subject]) => [id, {
      name: subject.name ?? undefined,
      curriculum: subject.curriculum ?? undefined,
      year_level: subject.year_level ?? undefined,
    }]),
  );
  const classById = await loadClasses(supabase, classIds);
  const billingByStudent = await loadBillingInfo(supabase);
  const { parentEmailsByStudent, studentEmailById } = await loadStudentEmails(
    supabase,
  );
  const subsidies = await loadSubsidies(supabase);

  for (const adjustment of adjustments) {
    try {
      if (!(await revalidateAdjustment(supabase, adjustment))) {
        await markSuperseded(supabase, adjustment.id);
        continue;
      }

      if (adjustment.kind === 'credit_note') {
        await issueCreditNote(supabase, stripe, adjustment, {
          resendApiKey: options.resendApiKey,
          billingByStudent,
          parentEmailsByStudent,
          studentEmailById,
        });
      } else {
        const assignment = assignmentsById.get(adjustment.sessions_students_id);
        const session = assignment ? sessionsById.get(assignment.session_id) : null;
        const rawSubject = session?.subject_id ? subjectById[session.subject_id] : null;
        const subject = rawSubject
          ? {
            long_name: rawSubject.name ?? undefined,
            short_name: rawSubject.name ?? undefined,
          }
          : null;
        if (!assignment || !session || !subject) {
          throw new Error('Charge adjustment session data is incomplete');
        }

        const invoiceResult = await processStudentInvoicing({
          ...options,
          studentId: assignment.student_id,
          studentSessions: [{
            session,
            subject,
            sessions_students_id: assignment.id,
            student_id: assignment.student_id,
          }],
          invoiceDate: getAdelaideDateString(session.start_at),
          targetDate: new Date(session.start_at),
          pricingByBillingType,
          overridesBySubjectAndBilling,
          pricingOverrides,
          subsidies,
          classById,
          subjectById: normalizedSubjectById,
          billingByStudent,
          parentEmailsByStudent,
          studentEmailById,
          billingAdjustment: adjustment.kind === 'restoration_charge'
            ? buildRestorationBillingContext({
              adjustmentId: adjustment.id,
              creditNoteId: adjustment.source_credit_note_id!,
              amountCents: adjustment.amount_cents!,
              currency: adjustment.currency,
            })
            : { id: adjustment.id, kind: 'session_charge' },
        });
        if (invoiceResult.error || !invoiceResult.invoiceId) {
          throw new Error(
            invoiceResult.error ?? 'Charge adjustment created no invoice',
          );
        }
      }

      await markSucceeded(supabase, adjustment.id);
      result.succeeded += 1;
    } catch (processingError) {
      const message = processingError instanceof Error ? processingError.message : String(processingError);
      const { error: failureError } = await supabase.rpc(
        'fail_session_billing_adjustment',
        {
          p_adjustment_id: adjustment.id,
          p_error: message,
        },
      );
      if (failureError) {
        console.error(
          '[billing-runner] Failed to record adjustment failure:',
          failureError,
        );
      }
      console.error(
        `[billing-runner] Session billing adjustment ${adjustment.id} failed:`,
        message,
      );
      result.failed += 1;
    }
  }

  return result;
}
