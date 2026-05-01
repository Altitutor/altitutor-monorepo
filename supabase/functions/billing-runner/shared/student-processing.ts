import type { SupabaseClient } from 'jsr:@supabase/supabase-js@2';
import Stripe from 'npm:stripe@16.6.0';
import { grossUp, formatSessionDate, getClassLongName } from './utils.ts';
import { calculateSessionPrice } from './pricing.ts';
import {
  createStripeInvoiceItems,
  createDraftSendInvoiceInvoice,
  createDraftChargeAutomaticallyInvoice,
  finalizeInvoice,
  deleteDraftInvoice,
  voidInvoice,
  createStripeCustomer,
  saveInvoiceToDatabase,
  saveInvoiceItemsToDatabase,
  updateInvoicePaymentStatus,
  updateInvoicePaymentError,
  rollbackIncompleteSessionInvoice,
} from './invoice-creation.ts';
import { sendInvoiceEmail } from './invoice-email.ts';
import {
  getStripeErrorDetails,
  formatStripeErrorMessage,
} from './stripe-errors.ts';

const LOG_PREFIX = '[billing-runner]';

export interface ProcessStudentResult {
  invoiceId: string | null;
  error: string | null;
}

interface StudentSessionInput {
  session: { id: string; start_at: string; subject_id?: string | null; class_id?: string | null; billing_type?: string | null; end_at: string };
  subject: { long_name?: string; short_name?: string } | null;
  sessions_students_id: string;
  student_id: string;
}

export interface ProcessStudentDependencies {
  supabase: SupabaseClient;
  stripe: Stripe;
  studentId: string;
  studentSessions: StudentSessionInput[];
  invoiceDate: string;
  targetDate: Date;
  feePercentDom: number;
  feePercentIntl: number;
  feeFixedCents: number;
  domesticCountry: string;
  pricingByBillingType: Record<string, { hourly_rate_cents: number; currency: string }>;
  overridesBySubjectAndBilling: Record<string, Record<string, { hourly_rate_cents: number; currency: string; effective_from: string; effective_until?: string | null }>>;
  pricingOverrides: Array<{ subject_id: string; billing_type: string; hourly_rate_cents: number; currency: string; effective_from: string; effective_until?: string | null }>;
  subsidies: Array<{ student_id: string; subject_id: string; billing_type: string; price_cents: number; currency?: string | null; effective_from?: string | null; effective_until?: string | null }>;
  classById: Record<string, { level?: string | number | null }>;
  subjectById: Record<string, { name?: string; curriculum?: string; year_level?: number }>;
  billingByStudent: Record<string, {
    student_id: string;
    stripe_customer_id: string | null;
    payment_methods: Array<{ stripe_payment_method_id: string; card_country: string | null }>;
    auto_bill_enabled?: boolean;
    invoice_email_to_student?: boolean;
    invoice_email_to_parents?: boolean;
  }>;
  parentEmailsByStudent: Record<string, string[]>; // All parent emails per student
  studentEmailById: Record<string, string | undefined>;
  isStripeTestKey: boolean;
  isStripeLiveKey: boolean;
  resendApiKey?: string; // Optional Resend API key for sending invoice emails
}

/**
 * Process invoicing for a single student
 * Returns invoice ID if successful, or error message if failed
 */
export async function processStudentInvoicing(
  deps: ProcessStudentDependencies
): Promise<ProcessStudentResult> {
  const {
    supabase,
    stripe,
    studentId,
    studentSessions,
    invoiceDate,
    targetDate,
    feePercentDom,
    feePercentIntl,
    feeFixedCents,
    domesticCountry,
    pricingByBillingType,
    overridesBySubjectAndBilling,
    pricingOverrides,
    subsidies,
    classById,
    subjectById,
    billingByStudent,
    parentEmailsByStudent,
    studentEmailById,
    isStripeTestKey,
    isStripeLiveKey,
    resendApiKey,
  } = deps;

  try {
    let billing = billingByStudent[studentId];
    const defaultPM = billing?.payment_methods?.[0];

    // Calculate pricing for each session and build invoice items
    interface InvoiceItemRow {
      sessions_students_id: string;
      session_id: string;
      student_id: string;
      amount_cents: number;
      description: string;
      is_subsidy: boolean;
      currency: string;
      is_fee?: boolean;
    }
    const invoiceItems: InvoiceItemRow[] = [];
    let totalNetCents = 0; // Track total net amount (before fees)
    let invoiceCurrency: string | null = null; // Track currency for validation
    const errors: string[] = [];

    for (const item of studentSessions) {
      const { session, subject, sessions_students_id, student_id } = item;

      // Calculate price from hourly rate and duration
      const priceResult = calculateSessionPrice(
        session,
        student_id,
        targetDate,
        pricingByBillingType,
        overridesBySubjectAndBilling,
        pricingOverrides,
        subsidies
      );
      const netCents = priceResult.amount_cents;
      const sessionCurrency = priceResult.currency;

      // Validate currency consistency
      if (invoiceCurrency === null) {
        invoiceCurrency = sessionCurrency;
      } else if (invoiceCurrency !== sessionCurrency) {
        errors.push(
          `Student ${studentId}: Mixed currencies detected (${invoiceCurrency} vs ${sessionCurrency}). All sessions must use the same currency.`
        );
        continue;
      }

      // Include zero-amount sessions (e.g., $0 subsidies) - Stripe will automatically mark $0 invoices as paid
      // This ensures proper audit trail and reconciliation even when session price is $0

      // Add session charge (even if amount is 0)
      const classLongName = getClassLongName(session, classById, subjectById);
      const sessionDate = formatSessionDate(session.start_at);
      invoiceItems.push({
        sessions_students_id,
        session_id: session.id,
        student_id,
        amount_cents: netCents,
        description: `${classLongName} - ${sessionDate}`,
        is_subsidy: false,
        currency: sessionCurrency,
      });

      totalNetCents += netCents;
    }

    // Calculate total fees as a separate line item
    // Note: Fees are only added if totalNetCents > 0 (fees on $0 amounts would be $0 anyway)
    if (totalNetCents > 0 && invoiceCurrency) {
      // If no payment method, assume Australian card (domestic fees)
      const isIntl = defaultPM
        ? defaultPM.card_country && defaultPM.card_country.toUpperCase() !== domesticCountry
        : false; // Assume domestic (Australian) card when no payment method
      const feePercent = isIntl ? feePercentIntl : feePercentDom;

      // Calculate gross amount with fees
      const grossCents = grossUp(
        totalNetCents,
        !!isIntl,
        feePercentDom,
        feePercentIntl,
        feeFixedCents
      );
      const totalFeesCents = grossCents - totalNetCents;

      // Add fees as a separate line item (only if fees > 0)
      if (totalFeesCents > 0 && invoiceItems.length > 0) {
        const firstSessionItem = invoiceItems.find((item: InvoiceItemRow) => item.sessions_students_id);
        if (firstSessionItem) {
          invoiceItems.push({
            sessions_students_id: firstSessionItem.sessions_students_id,
            session_id: firstSessionItem.session_id,
            student_id: studentId,
            amount_cents: totalFeesCents,
            description: `Payment processing fee (${(feePercent * 100).toFixed(2)}%${feeFixedCents > 0 ? ` + $${(feeFixedCents / 100).toFixed(2)}` : ''})`,
            is_subsidy: false,
            is_fee: true,
            currency: invoiceCurrency,
          });
        }
      }
    }
    // If totalNetCents is 0, fees would also be 0, so we skip adding a fee line item
    // The invoice will still be created with $0 line items and Stripe will mark it as paid automatically

    // Safety check: Skip if no items to invoice
    // This should rarely happen now that we include $0 sessions, but could occur if all sessions
    // had currency mismatches or other validation errors
    if (invoiceItems.length === 0) {
      console.log(`${LOG_PREFIX} No invoice items for student ${studentId} on ${invoiceDate}, skipping`);
      return { 
        invoiceId: null, 
        error: `No invoice items generated. All sessions may have been skipped due to validation errors.${errors.length > 0 ? ' Errors: ' + errors.join('; ') : ''}` 
      };
    }

    // Validate currency consistency
    if (!invoiceCurrency) {
      return {
        invoiceId: null,
        error: `Student ${studentId}: No currency determined for invoice items`,
      };
    }

    // Ensure all items have the same currency
    const mismatchedCurrency = invoiceItems.find((item: InvoiceItemRow) => item.currency !== invoiceCurrency);
    if (mismatchedCurrency) {
      return {
        invoiceId: null,
        error: `Student ${studentId}: Currency mismatch detected. Expected ${invoiceCurrency}, found ${mismatchedCurrency.currency}`,
      };
    }

    // Return currency errors if any
    if (errors.length > 0) {
      return { invoiceId: null, error: errors.join('; ') };
    }

    // Handle missing billing account - auto-create if missing
    if (!billing?.stripe_customer_id) {
      try {
        const parentEmails = parentEmailsByStudent[studentId] || [];
        const studentEmail = studentEmailById[studentId] || parentEmails[0];
        const { data: studentData } = await supabase
          .from('students')
          .select('first_name, last_name, email')
          .eq('id', studentId)
          .single();

        // Create Stripe customer
        const stripeCustomer = await createStripeCustomer(
          stripe,
          studentId,
          studentEmail || studentData?.email || undefined,
          studentData ? `${studentData.first_name} ${studentData.last_name}`.trim() : undefined
        );

        // Create or update billing account in database
        const { data: billingData, error: billingErr } = await supabase
          .from('students_billing')
          .upsert(
            {
              student_id: studentId,
              stripe_customer_id: stripeCustomer.id,
            },
            {
              onConflict: 'student_id',
            }
          )
          .select('student_id, stripe_customer_id')
          .single();

        if (billingErr) throw billingErr;

        // Update billing map (mutable reference)
        billingByStudent[studentId] = {
          student_id: studentId,
          stripe_customer_id: stripeCustomer.id,
          payment_methods: [],
        };
        billing = billingByStudent[studentId];

        console.log(
          `${LOG_PREFIX} Auto-created billing account for student ${studentId} with Stripe customer ${stripeCustomer.id}`
        );
      } catch (createErr: unknown) {
        getStripeErrorDetails(createErr);
        console.error(
          `${LOG_PREFIX} Failed to auto-create billing account for student ${studentId}:`,
          formatStripeErrorMessage(createErr, 'create billing account', { studentId })
        );
        const msg = createErr instanceof Error ? createErr.message : String(createErr);
        return {
          invoiceId: null,
          error: `Student ${studentId}: Failed to create billing account - ${msg}`,
        };
      }
    }

    const timestamp = Date.now();

    // Get billing preferences (defaults match migration defaults)
    const autoBillEnabled = billing?.auto_bill_enabled ?? true;
    const invoiceEmailToStudent = billing?.invoice_email_to_student ?? true;
    const invoiceEmailToParents = billing?.invoice_email_to_parents ?? true;

    // Handle invoice creation based on billing preferences and payment method availability
    // Auto-bill if: preferences allow it AND payment method exists
    const shouldAutoBill = autoBillEnabled && defaultPM?.stripe_payment_method_id;

    // Collect the set of sessions_students_id values included in this invoice.
    const sessionsStudentsIds = Array.from(
      new Set(
        studentSessions
          .map((s) => s.sessions_students_id)
          .filter((id): id is string => Boolean(id))
      )
    );

    if (!shouldAutoBill) {
      // Create invoice with send_invoice collection method (no auto-charge)
      try {
        // Create draft invoice (no pending items sweep)
        const draftInvoice = await createDraftSendInvoiceInvoice(
          stripe,
          billing.stripe_customer_id!,
          invoiceDate,
          studentId,
          isStripeTestKey,
          isStripeLiveKey,
          timestamp,
          sessionsStudentsIds
        );

        let stripeInvoiceItems: Array<InvoiceItemRow & { stripe_invoice_item_id: string }> = [];
        try {
          const result = await createStripeInvoiceItems(
            stripe,
            billing.stripe_customer_id!,
            invoiceItems,
            invoiceCurrency,
            studentId,
            invoiceDate,
            timestamp,
            draftInvoice.id
          );
          stripeInvoiceItems = result.stripeInvoiceItems as Array<InvoiceItemRow & { stripe_invoice_item_id: string }>;
        } catch (itemErr: unknown) {
          console.error(
            `${LOG_PREFIX} Failed to create invoice items for student ${studentId}, deleting draft invoice:`,
            formatStripeErrorMessage(itemErr, 'create invoice items', { studentId })
          );
          try {
            await deleteDraftInvoice(stripe, draftInvoice.id);
          } catch (delErr) {
            console.error(
              `${LOG_PREFIX} Failed to delete draft invoice ${draftInvoice.id}:`,
              formatStripeErrorMessage(delErr, 'delete draft invoice', { studentId })
            );
          }
          throw itemErr;
        }

        let finalizedInvoice: Stripe.Invoice;
        try {
          finalizedInvoice = await finalizeInvoice(stripe, draftInvoice.id);
        } catch (finalizeErr: unknown) {
          console.error(
            `${LOG_PREFIX} Failed to finalize invoice for student ${studentId}, deleting draft:`,
            formatStripeErrorMessage(finalizeErr, 'finalize invoice', { studentId })
          );
          try {
            await deleteDraftInvoice(stripe, draftInvoice.id);
          } catch (delErr) {
            console.error(
              `${LOG_PREFIX} Failed to delete draft invoice ${draftInvoice.id}:`,
              formatStripeErrorMessage(delErr, 'delete draft invoice', { studentId })
            );
          }
          throw finalizeErr;
        }

        // Save invoice to database
        const dbInvoice = await saveInvoiceToDatabase(supabase, studentId, finalizedInvoice, invoiceDate);

        if (!dbInvoice) {
          // Failed to save - void invoice
          console.error(
            `${LOG_PREFIX} Failed to save invoice for student ${studentId}, voiding Stripe invoice ${finalizedInvoice.id}`
          );
          try {
            await voidInvoice(stripe, finalizedInvoice.id);
            console.log(`${LOG_PREFIX} Successfully voided invoice ${finalizedInvoice.id} during rollback`);
          } catch (voidErr) {
            getStripeErrorDetails(voidErr);
            console.error(
              `${LOG_PREFIX} Failed to void invoice ${finalizedInvoice.id} during rollback:`,
              formatStripeErrorMessage(voidErr, 'void invoice', { studentId, invoiceId: finalizedInvoice.id })
            );
          }
          throw new Error('Failed to save invoice to database');
        }

        // Save invoice items IMMEDIATELY after invoice record creation (before webhook can fire)
        // This prevents race condition where invoice.paid webhook fires before items are saved
        // Upsert handles duplicates and race conditions
        try {
          await saveInvoiceItemsToDatabase(supabase, dbInvoice.id, stripeInvoiceItems);
        } catch (itemsErr: unknown) {
          console.error(
            `${LOG_PREFIX} Failed to save invoice items for invoice ${dbInvoice.id}:`,
            formatStripeErrorMessage(itemsErr, 'save invoice items', { studentId, invoiceId: dbInvoice.id })
          );
          try {
            await rollbackIncompleteSessionInvoice(stripe, supabase, finalizedInvoice.id, dbInvoice.id);
          } catch (rollbackErr: unknown) {
            console.error(
              `${LOG_PREFIX} Rollback after failed invoice items failed for student ${studentId}:`,
              formatStripeErrorMessage(rollbackErr, 'rollback incomplete invoice', {
                studentId,
                invoiceId: dbInvoice.id,
              })
            );
            return {
              invoiceId: null,
              error:
                formatStripeErrorMessage(itemsErr, 'save invoice items', { studentId, invoiceId: dbInvoice.id }) +
                ' Manual reconciliation required.',
            };
          }
          return {
            invoiceId: null,
            error: formatStripeErrorMessage(itemsErr, 'save invoice items', {
              studentId,
              invoiceId: dbInvoice.id,
            }),
          };
        }

        // Send invoice email based on billing preferences
        if (resendApiKey) {
          const studentEmail = studentEmailById[studentId];
          const parentEmails = parentEmailsByStudent[studentId] || [];
          
          try {
            const emailResult = await sendInvoiceEmail(
              stripe,
              finalizedInvoice.id,
              studentId,
              invoiceEmailToStudent,
              invoiceEmailToParents,
              studentEmail,
              parentEmails,
              resendApiKey
            );
            
            if (emailResult.sent.length > 0) {
              console.log(`${LOG_PREFIX} Sent invoice ${finalizedInvoice.id} emails to: ${emailResult.sent.join(', ')}`);
            }
            if (emailResult.failed.length > 0) {
              console.warn(`${LOG_PREFIX} Failed to send invoice ${finalizedInvoice.id} emails to: ${emailResult.failed.join(', ')}`);
            }
          } catch (emailErr: unknown) {
            // Don't fail invoice creation if email fails - log and continue
            console.error(
              `${LOG_PREFIX} Failed to send invoice email for ${finalizedInvoice.id}:`,
              formatStripeErrorMessage(emailErr, 'send invoice email', { studentId, invoiceId: finalizedInvoice.id })
            );
          }
        } else {
          console.warn(`${LOG_PREFIX} RESEND_API_KEY not configured, skipping invoice email for ${finalizedInvoice.id}`);
        }

        return { invoiceId: dbInvoice.id, error: null };
      } catch (e: unknown) {
        getStripeErrorDetails(e);
        console.error(
          `${LOG_PREFIX} Failed to create invoice for student ${studentId}:`,
          formatStripeErrorMessage(e, 'create invoice (send_invoice)', { studentId })
        );
        return {
          invoiceId: null,
          error: formatStripeErrorMessage(e, 'create invoice', { studentId }),
        };
      }
    } else {
      // Create invoice with automatic collection
      try {
        // Create draft invoice (no pending items sweep)
        const draftInvoice = await createDraftChargeAutomaticallyInvoice(
          stripe,
          billing.stripe_customer_id!,
          defaultPM.stripe_payment_method_id,
          invoiceDate,
          studentId,
          isStripeTestKey,
          isStripeLiveKey,
          timestamp,
          sessionsStudentsIds
        );

        let stripeInvoiceItems: Array<InvoiceItemRow & { stripe_invoice_item_id: string }> = [];
        try {
          const result = await createStripeInvoiceItems(
            stripe,
            billing.stripe_customer_id!,
            invoiceItems,
            invoiceCurrency,
            studentId,
            invoiceDate,
            timestamp,
            draftInvoice.id
          );
          stripeInvoiceItems = result.stripeInvoiceItems as Array<InvoiceItemRow & { stripe_invoice_item_id: string }>;
        } catch (itemErr: unknown) {
          console.error(
            `${LOG_PREFIX} Failed to create invoice items for student ${studentId}, deleting draft invoice:`,
            formatStripeErrorMessage(itemErr, 'create invoice items', { studentId })
          );
          try {
            await deleteDraftInvoice(stripe, draftInvoice.id);
          } catch (delErr) {
            console.error(
              `${LOG_PREFIX} Failed to delete draft invoice ${draftInvoice.id}:`,
              formatStripeErrorMessage(delErr, 'delete draft invoice', { studentId })
            );
          }
          throw itemErr;
        }

        let finalizedInvoice: Stripe.Invoice;
        try {
          finalizedInvoice = await finalizeInvoice(stripe, draftInvoice.id, {
            autoAdvance: true,
          });
        } catch (finalizeErr: unknown) {
          console.error(
            `${LOG_PREFIX} Failed to finalize invoice for student ${studentId}, deleting draft:`,
            formatStripeErrorMessage(finalizeErr, 'finalize invoice', { studentId })
          );
          try {
            await deleteDraftInvoice(stripe, draftInvoice.id);
          } catch (delErr) {
            console.error(
              `${LOG_PREFIX} Failed to delete draft invoice ${draftInvoice.id}:`,
              formatStripeErrorMessage(delErr, 'delete draft invoice', { studentId })
            );
          }
          throw finalizeErr;
        }

        // Save invoice to database FIRST (before payment)
        const dbInvoice = await saveInvoiceToDatabase(supabase, studentId, finalizedInvoice, invoiceDate);

        if (!dbInvoice) {
          // Failed to save - void invoice
          console.error(
            `${LOG_PREFIX} Failed to save invoice for student ${studentId}, voiding Stripe invoice ${finalizedInvoice.id}`
          );
          try {
            await voidInvoice(stripe, finalizedInvoice.id);
            console.log(`${LOG_PREFIX} Successfully voided invoice ${finalizedInvoice.id} during rollback`);
          } catch (voidErr) {
            getStripeErrorDetails(voidErr);
            console.error(
              `${LOG_PREFIX} Failed to void invoice ${finalizedInvoice.id} during rollback:`,
              formatStripeErrorMessage(voidErr, 'void invoice', { studentId, invoiceId: finalizedInvoice.id })
            );
            return {
              invoiceId: null,
              error: formatStripeErrorMessage(
                voidErr,
                'save invoice and void invoice',
                { studentId, invoiceId: finalizedInvoice.id }
              ) + ' Manual reconciliation required.',
            };
          }
          throw new Error('Failed to save invoice to database');
        }

        // Save invoice items IMMEDIATELY after invoice record creation (before webhook can fire)
        // This prevents race condition where invoice.paid webhook fires before items are saved
        // Upsert handles duplicates and race conditions
        try {
          await saveInvoiceItemsToDatabase(supabase, dbInvoice.id, stripeInvoiceItems);
        } catch (itemsErr: unknown) {
          console.error(
            `${LOG_PREFIX} Failed to save invoice items for invoice ${dbInvoice.id}:`,
            formatStripeErrorMessage(itemsErr, 'save invoice items', { studentId, invoiceId: dbInvoice.id })
          );
          try {
            await rollbackIncompleteSessionInvoice(stripe, supabase, finalizedInvoice.id, dbInvoice.id);
          } catch (rollbackErr: unknown) {
            console.error(
              `${LOG_PREFIX} Rollback after failed invoice items failed for student ${studentId}:`,
              formatStripeErrorMessage(rollbackErr, 'rollback incomplete invoice', {
                studentId,
                invoiceId: dbInvoice.id,
              })
            );
            return {
              invoiceId: null,
              error:
                formatStripeErrorMessage(itemsErr, 'save invoice items', { studentId, invoiceId: dbInvoice.id }) +
                ' Manual reconciliation required.',
            };
          }
          return {
            invoiceId: null,
            error: formatStripeErrorMessage(itemsErr, 'save invoice items', {
              studentId,
              invoiceId: dbInvoice.id,
            }),
          };
        }

        // For automatic collection, rely on Stripe's billing + webhooks to handle payment status
        return { invoiceId: dbInvoice.id, error: null };
      } catch (e: unknown) {
        console.error(
          `${LOG_PREFIX} Failed to create invoice for student ${studentId}:`,
          formatStripeErrorMessage(e, 'create invoice (charge_automatically)', { studentId })
        );
        return {
          invoiceId: null,
          error: formatStripeErrorMessage(e, 'create invoice', { studentId }),
        };
      }
    }
  } catch (e: unknown) {
    console.error(
      `${LOG_PREFIX} Error processing student ${studentId}:`,
      formatStripeErrorMessage(e, 'process student invoicing', { studentId })
    );
    return {
      invoiceId: null,
      error: formatStripeErrorMessage(e, 'process student invoicing', { studentId }),
    };
  }
}
