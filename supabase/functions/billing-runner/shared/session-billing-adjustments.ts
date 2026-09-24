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

interface StoredCreditNoteCommand {
  idempotencyKey: string;
  params: ReturnType<typeof buildSessionCreditNoteCommand>['params'];
  invoiceId: string;
  studentId: string;
  sourceInvoiceItemId: string;
}

class TerminalCreditNoteError extends Error {}

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
  created_by: string | null;
  idempotency_key: string;
  attempt_count: number;
  stripe_credit_note_request_version: number | null;
  stripe_credit_note_command: StoredCreditNoteCommand | null;
  stripe_credit_note_requested_at: string | null;
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
  adjustmentIds?: string[];
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

async function planCreditNote(
  supabase: SupabaseClient,
  stripe: Stripe,
  adjustment: SessionBillingAdjustment,
): Promise<StoredCreditNoteCommand> {
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
    createdByStaffId: adjustment.created_by,
  });
  return { ...command, invoiceId: invoice.id, studentId: invoice.student_id, sourceInvoiceItemId: invoiceItem.id };
}

async function prepareCreditNote(
  supabase: SupabaseClient,
  stripe: Stripe,
  adjustment: SessionBillingAdjustment,
): Promise<{ command: StoredCreditNoteCommand; requestedAt: string }> {
  if (adjustment.stripe_credit_note_command && adjustment.stripe_credit_note_requested_at) {
    return { command: adjustment.stripe_credit_note_command, requestedAt: adjustment.stripe_credit_note_requested_at };
  }
  // Older attempts may already have reached Stripe with a different request.
  // Never reconstruct those parameters or silently allocate a replacement key.
  if (adjustment.stripe_credit_note_request_version !== 1) {
    throw new TerminalCreditNoteError('Credit retry has no original Stripe request; reconcile before retrying');
  }
  const planned = await planCreditNote(supabase, stripe, adjustment);
  const { data, error } = await supabase.from('session_billing_adjustments')
    .update({ stripe_credit_note_command: planned })
    .eq('id', adjustment.id)
    .eq('status', 'processing')
    .is('stripe_credit_note_command', null)
    .select('stripe_credit_note_command, stripe_credit_note_requested_at')
    .maybeSingle();
  if (error) throw error;
  if (data?.stripe_credit_note_command && data.stripe_credit_note_requested_at) {
    return { command: data.stripe_credit_note_command, requestedAt: data.stripe_credit_note_requested_at };
  }
  // Another worker may have saved first. Only its immutable request is safe.
  const { data: stored, error: readError } = await supabase.from('session_billing_adjustments')
    .select('stripe_credit_note_command, stripe_credit_note_requested_at, status')
    .eq('id', adjustment.id).single();
  if (readError) throw readError;
  if (stored?.status !== 'processing' || !stored.stripe_credit_note_command || !stored.stripe_credit_note_requested_at) {
    throw new Error('Credit adjustment lost its processing claim before its request was saved');
  }
  return { command: stored.stripe_credit_note_command, requestedAt: stored.stripe_credit_note_requested_at };
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
  const { command, requestedAt } = await prepareCreditNote(supabase, stripe, adjustment);
  let creditNote: Stripe.CreditNote | undefined;
  if (adjustment.stripe_credit_note_command) {
    // Recover a successful create even when its response, local write or email
    // failed. Stripe retains idempotency keys for only a limited time.
    for await (const existing of stripe.creditNotes.list({ invoice: command.params.invoice, limit: 100 })) {
      if (existing.metadata?.billing_adjustment_id === adjustment.id) {
        if (existing.status === 'void') throw new TerminalCreditNoteError('Original credit note was voided; reconcile before retrying');
        creditNote = existing;
        break;
      }
    }
    if (!creditNote && Date.now() - Date.parse(requestedAt) >= 23 * 60 * 60 * 1000) {
      throw new TerminalCreditNoteError('Original credit request is outside the safe idempotency retry window; reconcile before retrying');
    }
  }
  creditNote ??= await stripe.creditNotes.create(command.params, { idempotencyKey: command.idempotencyKey });
  const remainsOnAccount = (command.params.credit_amount ?? 0) > 0;

  const { error: creditError } = await supabase.from('credit_notes').upsert(
    {
      invoice_id: command.invoiceId,
      stripe_credit_note_id: creditNote.id,
      amount_cents: creditNote.amount,
      currency: creditNote.currency,
      reason: creditNote.reason,
      status: creditNote.status,
      metadata: {
        ...(creditNote.metadata ?? {}),
        ...(creditNote.memo ? { memo: creditNote.memo } : {}),
      },
      credit_amount_cents: command.params.credit_amount ?? null,
      source_invoice_item_id: command.sourceInvoiceItemId,
      billing_adjustment_id: adjustment.id,
    },
    { onConflict: 'stripe_credit_note_id' },
  );
  if (creditError) throw creditError;

  if (notification.resendApiKey) {
    const preferences = notification.billingByStudent[command.studentId];
    const recipients = [
      ...(preferences?.invoice_email_to_student ? [notification.studentEmailById[command.studentId]] : []),
      ...(preferences?.invoice_email_to_parents ? (notification.parentEmailsByStudent[command.studentId] ?? []) : []),
    ].filter((email): email is string => Boolean(email));
    const uniqueRecipients = [...new Set(recipients)];
    const email = buildCreditNoteNotificationEmail({
      creditNoteNumber: creditNote.number ?? creditNote.id,
      amount: `${creditNote.currency.toUpperCase()} $${(creditNote.amount / 100).toFixed(2)}`,
      remainsOnAccount,
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
  const { data, error } = options.adjustmentIds
    ? await supabase.rpc('claim_session_billing_adjustments_by_ids', {
      p_adjustment_ids: options.adjustmentIds,
      p_limit: options.limit ?? 25,
    })
    : await supabase.rpc('claim_session_billing_adjustments', {
      p_limit: options.limit ?? 25,
    });
  if (error) throw error;

  const adjustments = (data ?? []) as SessionBillingAdjustment[];
  const result = { claimed: adjustments.length, succeeded: 0, failed: 0 };
  if (adjustments.length === 0) return result;

  // Opt in before any preload or Stripe lookup. Old workers never write this
  // marker, so a snapshot-free legacy attempt remains distinguishable from a
  // new worker that failed before it could persist/send its request.
  const unavailableAdjustments = new Set<string>();
  for (const adjustment of adjustments) {
    if (adjustment.kind !== 'credit_note' || adjustment.attempt_count !== 1 ||
      adjustment.stripe_credit_note_request_version != null) continue;
    try {
      const { data: optedIn, error: optInError } = await supabase.from('session_billing_adjustments')
        .update({ stripe_credit_note_request_version: 1 })
        .eq('id', adjustment.id).eq('status', 'processing').eq('attempt_count', 1)
        .is('stripe_credit_note_request_version', null)
        .select('stripe_credit_note_request_version').maybeSingle();
      if (optInError) throw optInError;
      if (optedIn?.stripe_credit_note_request_version !== 1) {
        throw new Error('Credit adjustment lost its first processing claim before protocol opt-in');
      }
      adjustment.stripe_credit_note_request_version = 1;
    } catch (optInError) {
      await recordAdjustmentFailure(supabase, adjustment, optInError);
      unavailableAdjustments.add(adjustment.id);
      result.failed += 1;
    }
  }
  if (unavailableAdjustments.size === adjustments.length) return result;

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
    if (unavailableAdjustments.has(adjustment.id)) continue;
    try {
      if (!(adjustment.kind === 'credit_note' && adjustment.stripe_credit_note_command) &&
        !(await revalidateAdjustment(supabase, adjustment))) {
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
      await recordAdjustmentFailure(supabase, adjustment, processingError);
      result.failed += 1;
    }
  }

  return result;
}

async function recordAdjustmentFailure(
  supabase: SupabaseClient,
  adjustment: SessionBillingAdjustment,
  processingError: unknown,
) {
  const message = processingError instanceof Error ? processingError.message : String(processingError);
  const terminal = adjustment.kind === 'credit_note' && isTerminalCreditNoteFailure(processingError);
  const { error: failureError } = terminal
    ? await supabase.from('session_billing_adjustments').update({
      status: 'failed', last_error: message.slice(0, 4000), completed_at: new Date().toISOString(),
    }).eq('id', adjustment.id).eq('status', 'processing')
    : await supabase.rpc('fail_session_billing_adjustment', {
      p_adjustment_id: adjustment.id,
      p_error: message,
    });
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
}

function isTerminalCreditNoteFailure(error: unknown): boolean {
  if (error instanceof TerminalCreditNoteError) return true;
  if (!(error instanceof Stripe.errors.StripeError)) return false;
  if (error.statusCode === 409 || error.statusCode === 429 || (error.statusCode ?? 0) >= 500 ||
    error.code === 'lock_timeout' || error.code === 'rate_limit' || error.code === 'idempotency_key_in_use') return false;
  return error instanceof Stripe.errors.StripeInvalidRequestError || error instanceof Stripe.errors.StripeIdempotencyError;
}
