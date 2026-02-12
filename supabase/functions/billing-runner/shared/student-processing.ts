// @ts-nocheck
// deno-lint-ignore-file no-explicit-any
import Stripe from 'npm:stripe@16.6.0';
import { grossUp, formatSessionDate, getClassLongName } from './utils.ts';
import { calculateSessionPrice } from './pricing.ts';
import {
  createStripeInvoiceItems,
  rollbackStripeInvoiceItems,
  createSendInvoiceInvoice,
  createChargeAutomaticallyInvoice,
  payInvoice,
  voidInvoice,
  createStripeCustomer,
  saveInvoiceToDatabase,
  saveInvoiceItemsToDatabase,
  updateInvoicePaymentStatus,
  updateInvoicePaymentError,
} from './invoice-creation.ts';
import { sendInvoiceEmail } from './invoice-email.ts';

export interface ProcessStudentResult {
  invoiceId: string | null;
  error: string | null;
}

export interface ProcessStudentDependencies {
  supabase: any;
  stripe: Stripe;
  studentId: string;
  studentSessions: any[];
  invoiceDate: string;
  targetDate: Date;
  feePercentDom: number;
  feePercentIntl: number;
  feeFixedCents: number;
  domesticCountry: string;
  pricingByBillingType: Record<string, { hourly_rate_cents: number; currency: string }>;
  overridesBySubjectAndBilling: Record<string, Record<string, any>>;
  pricingOverrides: any[];
  subsidies: any[];
  classById: Record<string, any>;
  subjectById: Record<string, any>;
  billingByStudent: Record<string, any>; // Mutable - will be updated if billing account is created
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
    // Note: We always create a new invoice for billing-single (manual reconciliation)
    // This ensures each session gets its own invoice, even if other sessions for the
    // same student/date were already invoiced. The billing-single function already
    // checks that the specific session isn't already invoiced before calling this.
    let billing = billingByStudent[studentId];
    const defaultPM = billing?.payment_methods?.[0];

    // Calculate pricing for each session and build invoice items
    const invoiceItems: any[] = [];
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
        const firstSessionItem = invoiceItems.find((item: any) => item.sessions_students_id);
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
      console.log(`[runner] No invoice items for student ${studentId} on ${invoiceDate}, skipping`);
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
    const mismatchedCurrency = invoiceItems.find((item: any) => item.currency !== invoiceCurrency);
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
          `[runner] Auto-created billing account for student ${studentId} with Stripe customer ${stripeCustomer.id}`
        );
      } catch (createErr: any) {
        console.error(
          `[runner] Failed to auto-create billing account for student ${studentId}:`,
          createErr?.message || createErr
        );
        return {
          invoiceId: null,
          error: `Student ${studentId}: Failed to create billing account - ${createErr?.message || 'Unknown error'}`,
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

    if (!shouldAutoBill) {
      // Create invoice with send_invoice collection method (no auto-charge)
      try {
        // Create invoice items in Stripe
        let stripeInvoiceItems: any[] = [];
        let createdStripeItemIds: string[] = [];

        try {
          const result = await createStripeInvoiceItems(
            stripe,
            billing.stripe_customer_id!,
            invoiceItems,
            invoiceCurrency,
            studentId,
            invoiceDate,
            timestamp
          );
          stripeInvoiceItems = result.stripeInvoiceItems;
          createdStripeItemIds = result.createdStripeItemIds;
        } catch (itemErr: any) {
          // Rollback: delete created invoice items if any failed
          console.error(
            `[runner] Failed to create invoice items for student ${studentId}, rolling back:`,
            itemErr?.message || itemErr
          );
          if (createdStripeItemIds.length > 0) {
            await rollbackStripeInvoiceItems(stripe, createdStripeItemIds);
          }
          throw itemErr;
        }

        // Create invoice with send_invoice collection method
        const finalizedInvoice = await createSendInvoiceInvoice(
          stripe,
          billing.stripe_customer_id!,
          invoiceDate,
          studentId,
          isStripeTestKey,
          isStripeLiveKey,
          timestamp
        );

        // Save invoice to database
        let dbInvoice = await saveInvoiceToDatabase(supabase, studentId, finalizedInvoice, invoiceDate);

        if (!dbInvoice) {
          // Failed to save - void invoice
          console.error(
            `[runner] Failed to save invoice for student ${studentId}, voiding Stripe invoice`
          );
          try {
            await voidInvoice(stripe, finalizedInvoice.id);
          } catch (voidErr) {
            console.error(
              `[runner] Failed to void invoice ${finalizedInvoice.id} during rollback:`,
              voidErr
            );
          }
          throw new Error('Failed to save invoice to database');
        }

        // Save invoice items IMMEDIATELY after invoice record creation (before webhook can fire)
        // This prevents race condition where invoice.paid webhook fires before items are saved
        // Upsert handles duplicates and race conditions
        try {
          await saveInvoiceItemsToDatabase(supabase, dbInvoice.id, stripeInvoiceItems);
        } catch (itemsErr: any) {
          console.error(
            `[runner] Failed to save invoice items for invoice ${dbInvoice.id}:`,
            itemsErr?.message || itemsErr
          );
          // Don't throw - invoice is saved, items can be reconciled later
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
              console.log(`[runner] Sent invoice ${finalizedInvoice.id} emails to: ${emailResult.sent.join(', ')}`);
            }
            if (emailResult.failed.length > 0) {
              console.warn(`[runner] Failed to send invoice ${finalizedInvoice.id} emails to: ${emailResult.failed.join(', ')}`);
            }
          } catch (emailErr: any) {
            // Don't fail invoice creation if email fails - log and continue
            console.error(`[runner] Failed to send invoice email for ${finalizedInvoice.id}:`, emailErr?.message || emailErr);
          }
        } else {
          console.warn(`[runner] RESEND_API_KEY not configured, skipping invoice email for ${finalizedInvoice.id}`);
        }

        return { invoiceId: dbInvoice.id, error: null };
      } catch (e: any) {
        console.error(`[runner] Failed to create invoice for student ${studentId}:`, e?.message || e);
        return { invoiceId: null, error: `Student ${studentId}: ${e?.message || 'Invoice creation failed'}` };
      }
    } else {
      // Create invoice with automatic collection
      try {
        // Create invoice items in Stripe
        let stripeInvoiceItems: any[] = [];
        let createdStripeItemIds: string[] = [];

        try {
          const result = await createStripeInvoiceItems(
            stripe,
            billing.stripe_customer_id!,
            invoiceItems,
            invoiceCurrency,
            studentId,
            invoiceDate,
            timestamp
          );
          stripeInvoiceItems = result.stripeInvoiceItems;
          createdStripeItemIds = result.createdStripeItemIds;
        } catch (itemErr: any) {
          // Rollback: delete created invoice items if any failed
          console.error(
            `[runner] Failed to create invoice items for student ${studentId}, rolling back:`,
            itemErr?.message || itemErr
          );
          if (createdStripeItemIds.length > 0) {
            await rollbackStripeInvoiceItems(stripe, createdStripeItemIds);
          }
          throw itemErr;
        }

        // Create invoice with automatic collection
        const finalizedInvoice = await createChargeAutomaticallyInvoice(
          stripe,
          billing.stripe_customer_id!,
          defaultPM.stripe_payment_method_id,
          invoiceDate,
          studentId,
          isStripeTestKey,
          isStripeLiveKey,
          timestamp
        );

        // Save invoice to database FIRST (before payment)
        let dbInvoice = await saveInvoiceToDatabase(supabase, studentId, finalizedInvoice, invoiceDate);

        if (!dbInvoice) {
          // Failed to save - void invoice
          console.error(
            `[runner] Failed to save invoice for student ${studentId}, voiding Stripe invoice`
          );
          try {
            await voidInvoice(stripe, finalizedInvoice.id);
          } catch (voidErr) {
            console.error(
              `[runner] Failed to void invoice ${finalizedInvoice.id} during rollback:`,
              voidErr
            );
            return {
              invoiceId: null,
              error: `Student ${studentId}: Database insert failed and invoice void failed. Manual reconciliation required.`,
            };
          }
          throw new Error('Failed to save invoice to database');
        }

        // Save invoice items IMMEDIATELY after invoice record creation (before webhook can fire)
        // This prevents race condition where invoice.paid webhook fires before items are saved
        // Upsert handles duplicates and race conditions
        try {
          await saveInvoiceItemsToDatabase(supabase, dbInvoice.id, stripeInvoiceItems);
        } catch (itemsErr: any) {
          console.error(
            `[runner] Failed to save invoice items for invoice ${dbInvoice.id}:`,
            itemsErr?.message || itemsErr
          );
          // Don't throw - invoice is saved, items can be reconciled later
        }

        // If invoice is already paid (via webhook), skip payment
        if (dbInvoice.status === 'paid') {
          return { invoiceId: dbInvoice.id, error: null };
        }

        // Attempt payment (after DB insert succeeds)
        if (
          finalizedInvoice.status === 'open' &&
          finalizedInvoice.collection_method === 'charge_automatically'
        ) {
          try {
            const paidInvoice = await payInvoice(stripe, finalizedInvoice.id);

            // Update DB record with payment status
            await updateInvoicePaymentStatus(supabase, dbInvoice.id, paidInvoice);

            return { invoiceId: dbInvoice.id, error: null };
          } catch (payErr: any) {
            // Payment failed but DB record exists - log for reconciliation
            console.warn(
              `[runner] Failed to pay invoice ${finalizedInvoice.id} for student ${studentId}:`,
              payErr?.message || payErr
            );

            // Update DB with error status (invoice remains 'open')
            await updateInvoicePaymentError(supabase, dbInvoice.id, payErr?.message || 'Payment failed');

            // Don't throw - invoice created, payment can be retried
            return {
              invoiceId: dbInvoice.id,
              error: `Student ${studentId}: Invoice created but payment failed. Will retry automatically.`,
            };
          }
        } else {
          // For send_invoice or already paid, no payment needed
          return { invoiceId: dbInvoice.id, error: null };
        }
      } catch (e: any) {
        console.error(`[runner] Failed to create invoice for student ${studentId}:`, e?.message || e);
        return { invoiceId: null, error: `Student ${studentId}: ${e?.message || 'Invoice creation failed'}` };
      }
    }
  } catch (e: any) {
    console.error(`[runner] Error processing student ${studentId}:`, e?.message || e);
    return { invoiceId: null, error: `Student ${studentId}: ${e?.message || 'Processing failed'}` };
  }
}
