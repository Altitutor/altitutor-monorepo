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
  parentEmailByStudent: Record<string, string | undefined>;
  studentEmailById: Record<string, string | undefined>;
  isStripeTestKey: boolean;
  isStripeLiveKey: boolean;
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
    parentEmailByStudent,
    studentEmailById,
    isStripeTestKey,
    isStripeLiveKey,
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

      // Skip zero-amount sessions
      if (netCents <= 0) continue;

      // Add session charge
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

      // Add fees as a separate line item
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

    // Skip if no items to invoice
    if (invoiceItems.length === 0) {
      console.log(`[runner] No invoice items for student ${studentId} on ${invoiceDate}, skipping`);
      return { invoiceId: null, error: null };
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
        const studentEmail = studentEmailById[studentId] || parentEmailByStudent[studentId];
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

    // Handle invoice creation based on payment method availability
    if (!defaultPM?.stripe_payment_method_id) {
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

        // Always attempt to save invoice items (upsert handles duplicates)
        // This fixes the issue where items weren't saved if invoice already existed
        try {
          await saveInvoiceItemsToDatabase(supabase, dbInvoice.id, stripeInvoiceItems);
        } catch (itemsErr: any) {
          console.error(
            `[runner] Failed to save invoice items for invoice ${dbInvoice.id}:`,
            itemsErr?.message || itemsErr
          );
          // Don't throw - invoice is saved, items can be reconciled later
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

        // If invoice is already paid (via webhook), skip payment
        if (dbInvoice.status === 'paid') {
          return { invoiceId: dbInvoice.id, error: null };
        }

        // Always attempt to save invoice items (upsert handles duplicates)
        // This fixes the issue where items weren't saved if invoice already existed
        try {
          await saveInvoiceItemsToDatabase(supabase, dbInvoice.id, stripeInvoiceItems);
        } catch (itemsErr: any) {
          console.error(
            `[runner] Failed to save invoice items for invoice ${dbInvoice.id}:`,
            itemsErr?.message || itemsErr
          );
          // Don't throw - invoice is saved, items can be reconciled later
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
