// @ts-nocheck
// deno-lint-ignore-file no-explicit-any
import 'jsr:@supabase/functions-js/edge-runtime.d.ts';
import { createClient } from 'jsr:@supabase/supabase-js@2';
import Stripe from 'npm:stripe@16.6.0';

// Shared helpers
import { grossUp, formatSessionDate, getClassLongName, calculateAdelaideDateRange } from './shared/utils.ts';
import { calculateSessionPrice } from './shared/pricing.ts';
import {
  loadBillingSettings,
  loadBillingPricing,
  loadPricingOverrides,
  loadSubsidies,
  loadBillingInfo,
  loadStudentEmails,
  loadSubjects,
  loadClasses,
  getInvoicedSessionsStudentsIds,
} from './shared/data-loading.ts';
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
} from './shared/invoice-creation.ts';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

function json(resp: any, status = 200) {
  return new Response(JSON.stringify(resp), {
    status,
    headers: {
      'Content-Type': 'application/json',
      ...corsHeaders,
    },
  });
}

Deno.serve(async (req: Request) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  const STRIPE_SECRET_KEY = Deno.env.get('STRIPE_SECRET_KEY')?.trim();
  if (!STRIPE_SECRET_KEY) return json({ error: 'Stripe key not configured' }, 500);

  // Check if using test or live Stripe keys
  const isStripeTestKey = STRIPE_SECRET_KEY.startsWith('sk_test_');
  const isStripeLiveKey = STRIPE_SECRET_KEY.startsWith('sk_live_');

  const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
  const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

  // Parse request body for date override (must be done before auth check to avoid consuming body)
  let dateOverride: string | null = null;
  let requestBody: any = null;

  if (req.method === 'POST') {
    try {
      const bodyText = await req.text();
      if (bodyText) {
        requestBody = JSON.parse(bodyText);
        dateOverride = requestBody.date || null;
      }
    } catch {
      // Body parsing failed, continue with defaults
    }
  }

  let isServiceRole = false;
  let isAdminUser = false;

  try {
    const authHeader = req.headers.get('authorization');
    const apiKey = req.headers.get('apikey');

    // Check if this is a service role request (cron job or direct service call)
    // Handle both Bearer token format and direct key comparison
    const bearerToken = authHeader?.startsWith('Bearer ')
      ? authHeader.substring(7).trim()
      : authHeader;

    if (apiKey === supabaseServiceKey || bearerToken === supabaseServiceKey) {
      isServiceRole = true;
    }

    // Development mode: Allow admin users to test (only when using test Stripe keys)
    // This bypasses service role requirement for local/testing scenarios
    // Check admin token even if service role is provided, as a fallback for local dev
    if (isStripeTestKey) {
      try {
        // Check for admin token in custom header (sent by API route)
        const adminToken = req.headers.get('x-admin-token');
        if (adminToken) {
          const supabase = createClient(supabaseUrl, supabaseServiceKey, {
            auth: { persistSession: false },
          });
          const { data: { user }, error: userError } = await supabase.auth.getUser(adminToken);

          if (!userError && user) {
            // Check if user is admin staff
            const { data: staffData } = await supabase
              .from('staff')
              .select('role, status')
              .eq('user_id', user.id)
              .maybeSingle();

            if (staffData?.role === 'ADMINSTAFF' && staffData?.status === 'ACTIVE') {
              isAdminUser = true;
            }
          }
        }
      } catch (err) {
        // Auth check failed, continue with normal flow
        console.error('[billing-runner] Admin token check failed:', err);
      }
    }

    // Only allow service role or admin users (in test mode)
    if (!isServiceRole && !isAdminUser) {
      return json(
        {
          error:
            'Unauthorized: Billing can only be triggered by service role (cron jobs or manual service calls)',
        },
        403
      );
    }
  } catch (authErr: any) {
    return json({ error: 'Authentication error', message: authErr?.message }, 401);
  }

  const stripe = new Stripe(STRIPE_SECRET_KEY, { apiVersion: '2024-06-20' });
  const supabase = createClient(supabaseUrl, supabaseServiceKey, { auth: { persistSession: false } });

  try {
    // Load billing settings
    const { feePercentDom, feePercentIntl, feeFixedCents, domesticCountry } =
      await loadBillingSettings(supabase);

    // Determine date range: use override if provided, otherwise tomorrow (production)
    let targetDate: Date;
    if (dateOverride) {
      // Parse date string as UTC date (YYYY-MM-DD format)
      // This ensures we're working with the correct date regardless of server timezone
      const [year, month, day] = dateOverride.split('-').map(Number);
      targetDate = new Date(Date.UTC(year, month - 1, day));
    } else {
      // Production mode: process tomorrow's sessions
      const tomorrow = new Date();
      tomorrow.setUTCDate(tomorrow.getUTCDate() + 1);
      targetDate = tomorrow;
    }

    const { startIso, endIso } = calculateAdelaideDateRange(targetDate);
    const invoiceDate = targetDate.toISOString().split('T')[0]; // YYYY-MM-DD format

    // Find billable sessions for target date (filter by billing_type IS NOT NULL)
    const { data: sessions, error: sessErr } = await supabase
      .from('sessions')
      .select('id, start_at, end_at, subject_id, class_id, billing_type')
      .gte('start_at', startIso)
      .lte('start_at', endIso)
      .not('billing_type', 'is', null); // Only billable sessions
    if (sessErr) throw sessErr;

    if (!sessions?.length) {
      return json({
        ok: true,
        processed: 0,
        invoicesCreated: 0,
        dateRange: { start: startIso, end: endIso },
        message: `No billable sessions found for ${dateOverride ? `date ${invoiceDate}` : 'tomorrow'}`,
      });
    }

    // Load attending students
    const sessionIds = sessions.map((s: any) => s.id);
    const { data: ssRows, error: ssErr } = await supabase
      .from('sessions_students')
      .select('id, session_id, student_id, planned_absence')
      .in('session_id', sessionIds);
    if (ssErr) throw ssErr;

    // *** NEW: Check which sessions_students_ids are already invoiced (session-level idempotency) ***
    const sessionsStudentsIds = (ssRows || [])
      .filter((row: any) => !row.planned_absence)
      .map((row: any) => row.id);
    const invoicedSessionsStudentsIds = await getInvoicedSessionsStudentsIds(
      supabase,
      sessionsStudentsIds
    );

    // Filter out already-invoiced sessions
    const uninvoicedSsRows = (ssRows || []).filter(
      (row: any) => !row.planned_absence && !invoicedSessionsStudentsIds.has(row.id)
    );

    if (uninvoicedSsRows.length === 0) {
      return json({
        ok: true,
        processed: 0,
        invoicesCreated: 0,
        dateRange: { start: startIso, end: endIso },
        message: `No uninvoiced sessions found for ${dateOverride ? `date ${invoiceDate}` : 'tomorrow'}`,
      });
    }

    // Get unique session IDs from uninvoiced sessions
    const uninvoicedSessionIds = Array.from(
      new Set(uninvoicedSsRows.map((row: any) => row.session_id))
    );
    const uninvoicedSessions = sessions.filter((s: any) =>
      uninvoicedSessionIds.includes(s.id)
    );

    // Load billing pricing tables
    const pricingByBillingType = await loadBillingPricing(supabase);

    // Load subject pricing overrides
    const subjectIds = Array.from(new Set(uninvoicedSessions.map((s: any) => s.subject_id).filter(Boolean)));
    const { overridesBySubjectAndBilling, pricingOverrides } = await loadPricingOverrides(
      supabase,
      subjectIds
    );

    // Load subjects for display names
    const subjectById = await loadSubjects(supabase, subjectIds);

    // Load classes for class name display
    const classIds = Array.from(
      new Set(uninvoicedSessions.map((s: any) => s.class_id).filter(Boolean))
    );
    const classById = await loadClasses(supabase, classIds);

    // Load billing info with default payment method
    const billingByStudent = await loadBillingInfo(supabase);

    // Load student and parent emails
    const { parentEmailByStudent, studentEmailById } = await loadStudentEmails(supabase);

    // Load subsidies
    const subsidies = await loadSubsidies(supabase);

    // Group uninvoiced sessions by student_id
    const sessionsByStudent: Record<string, any[]> = {};
    for (const row of uninvoicedSsRows) {
      const session = uninvoicedSessions.find((s: any) => s.id === row.session_id);
      if (!session) continue;
      const subject = subjectById[session.subject_id];
      if (!subject) continue;

      if (!sessionsByStudent[row.student_id]) {
        sessionsByStudent[row.student_id] = [];
      }
      sessionsByStudent[row.student_id].push({
        sessions_students_id: row.id,
        session_id: row.session_id,
        student_id: row.student_id,
        session,
        subject,
      });
    }

    const invoicesCreated: string[] = [];
    const errors: string[] = [];

    // Process each student
    for (const [studentId, studentSessions] of Object.entries(sessionsByStudent)) {
      try {
        // Check for existing invoice for this student and date
        // If invoice exists, we'll add items to it (if not finalized) or skip if finalized
        const { data: existingInvoice } = await supabase
          .from('invoices')
          .select('id, stripe_invoice_id, status')
          .eq('student_id', studentId)
          .eq('invoice_date', invoiceDate)
          .maybeSingle();

        // If invoice exists and is finalized/paid, skip (items already added or invoice closed)
        if (existingInvoice && (existingInvoice.status === 'paid' || existingInvoice.status === 'void')) {
          console.log(
            `[runner] Invoice already exists and is ${existingInvoice.status} for student ${studentId} on ${invoiceDate}, skipping`
          );
          continue;
        }

        let billing = billingByStudent[studentId];
        const defaultPM = billing?.payment_methods?.[0];

        // Calculate pricing for each session and build invoice items
        const invoiceItems: any[] = [];
        let totalNetCents = 0; // Track total net amount (before fees)
        let invoiceCurrency: string | null = null; // Track currency for validation

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
          continue;
        }

        // Validate currency consistency
        if (!invoiceCurrency) {
          errors.push(`Student ${studentId}: No currency determined for invoice items`);
          continue;
        }

        // Ensure all items have the same currency
        const mismatchedCurrency = invoiceItems.find((item: any) => item.currency !== invoiceCurrency);
        if (mismatchedCurrency) {
          errors.push(
            `Student ${studentId}: Currency mismatch detected. Expected ${invoiceCurrency}, found ${mismatchedCurrency.currency}`
          );
          continue;
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
              studentData
                ? `${studentData.first_name} ${studentData.last_name}`.trim()
                : undefined
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

            // Update billing map
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
            errors.push(
              `Student ${studentId}: Failed to create billing account - ${createErr?.message || 'Unknown error'}`
            );
            continue;
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

            // Check if invoice was just created (not existing)
            const { data: checkInvoice } = await supabase
              .from('invoices')
              .select('id')
              .eq('stripe_invoice_id', finalizedInvoice.id)
              .maybeSingle();

            // Store invoice items (only if we just created the invoice)
            if (checkInvoice && checkInvoice.id === dbInvoice.id) {
              // Double-check: verify items don't already exist
              const { data: existingItems } = await supabase
                .from('invoice_items')
                .select('id')
                .eq('invoice_id', dbInvoice.id)
                .limit(1);

              if (!existingItems || existingItems.length === 0) {
                await saveInvoiceItemsToDatabase(supabase, dbInvoice.id, stripeInvoiceItems);
              }
            }

            invoicesCreated.push(dbInvoice.id);
          } catch (e: any) {
            console.error(`[runner] Failed to create invoice for student ${studentId}:`, e?.message || e);
            errors.push(`Student ${studentId}: ${e?.message || 'Invoice creation failed'}`);
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
                errors.push(
                  `Student ${studentId}: Database insert failed and invoice void failed. Manual reconciliation required.`
                );
              }
              throw new Error('Failed to save invoice to database');
            }

            // If invoice is already paid (via webhook), skip payment
            if (dbInvoice.status === 'paid') {
              invoicesCreated.push(dbInvoice.id);
              continue;
            }

            // Check if invoice was just created (not existing)
            const { data: checkInvoice } = await supabase
              .from('invoices')
              .select('id')
              .eq('stripe_invoice_id', finalizedInvoice.id)
              .maybeSingle();

            // Store invoice items (only if we just created the invoice)
            if (checkInvoice && checkInvoice.id === dbInvoice.id) {
              // Double-check: verify items don't already exist
              const { data: existingItems } = await supabase
                .from('invoice_items')
                .select('id')
                .eq('invoice_id', dbInvoice.id)
                .limit(1);

              if (!existingItems || existingItems.length === 0) {
                await saveInvoiceItemsToDatabase(supabase, dbInvoice.id, stripeInvoiceItems);
              }
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

                invoicesCreated.push(dbInvoice.id);
              } catch (payErr: any) {
                // Payment failed but DB record exists - log for reconciliation
                console.warn(
                  `[runner] Failed to pay invoice ${finalizedInvoice.id} for student ${studentId}:`,
                  payErr?.message || payErr
                );

                // Update DB with error status (invoice remains 'open')
                await updateInvoicePaymentError(
                  supabase,
                  dbInvoice.id,
                  payErr?.message || 'Payment failed'
                );

                // Don't throw - invoice created, payment can be retried
                errors.push(
                  `Student ${studentId}: Invoice created but payment failed. Will retry automatically.`
                );
                invoicesCreated.push(dbInvoice.id); // Still count as created
              }
            } else {
              // For send_invoice or already paid, no payment needed
              invoicesCreated.push(dbInvoice.id);
            }
          } catch (e: any) {
            console.error(`[runner] Failed to create invoice for student ${studentId}:`, e?.message || e);
            errors.push(`Student ${studentId}: ${e?.message || 'Invoice creation failed'}`);
          }
        }
      } catch (e: any) {
        console.error(`[runner] Error processing student ${studentId}:`, e?.message || e);
        errors.push(`Student ${studentId}: ${e?.message || 'Processing failed'}`);
      }
    }

    return json({
      ok: true,
      invoicesCreated: invoicesCreated.length,
      errors: errors.length > 0 ? errors : undefined,
      stripeKeyType: isStripeTestKey ? 'test' : isStripeLiveKey ? 'live' : 'unknown',
      dateRange: { start: startIso, end: endIso },
      message: `Created ${invoicesCreated.length} invoices${isStripeTestKey ? ' (using Stripe test keys)' : isStripeLiveKey ? ' (using Stripe live keys)' : ''}`,
    });
  } catch (e: any) {
    console.error('[runner] error', e?.message || e);
    return json({ error: 'runner_error', message: e?.message || String(e) }, 500);
  }
});
