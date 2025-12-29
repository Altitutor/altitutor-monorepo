// @ts-nocheck
// deno-lint-ignore-file no-explicit-any
import 'jsr:@supabase/functions-js/edge-runtime.d.ts';
import { createClient } from 'jsr:@supabase/supabase-js@2';
import Stripe from 'npm:stripe@16.6.0';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

function json(resp: any, status = 200) {
  return new Response(JSON.stringify(resp), { 
    status, 
    headers: { 
      'Content-Type': 'application/json',
      ...corsHeaders 
    } 
  });
}

function grossUp(net: number, isInternational: boolean, percentDomestic: number, percentIntl: number, fixedCents: number) {
  const percent = isInternational ? percentIntl : percentDomestic;
  return Math.round((net + fixedCents) / (1 - percent));
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
    if (!isServiceRole && isStripeTestKey) {
      try {
        // Check for admin token in custom header (sent by API route)
        const adminToken = req.headers.get('x-admin-token');
        if (adminToken) {
          const supabase = createClient(supabaseUrl, supabaseServiceKey, { auth: { persistSession: false } });
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
      } catch {
        // Auth check failed, continue with normal flow
      }
    }
    
    // Only allow service role or admin users (in test mode)
    if (!isServiceRole && !isAdminUser) {
      return json({ error: 'Unauthorized: Billing can only be triggered by service role (cron jobs or manual service calls)' }, 403);
    }
    
  } catch (authErr: any) {
    return json({ error: 'Authentication error', message: authErr?.message }, 401);
  }

  const stripe = new Stripe(STRIPE_SECRET_KEY, { apiVersion: '2024-06-20' });
  const supabase = createClient(supabaseUrl, supabaseServiceKey, { auth: { persistSession: false } });

  try {
    // Load fee settings from DB
    const { data: settings, error: settingsErr } = await supabase
      .from('billing_settings')
      .select('setting_key, setting_value');
    if (settingsErr) throw settingsErr;
    
    const settingsMap: Record<string, string> = {};
    for (const s of settings || []) settingsMap[s.setting_key] = s.setting_value;
    
    const FEE_PERCENT_DOM = Number(settingsMap.fee_percent_domestic || '0.0175');
    const FEE_PERCENT_INTL = Number(settingsMap.fee_percent_intl || '0.029');
    const FEE_FIXED_CENTS = Number(settingsMap.fee_fixed_cents || '30');
    const DOMESTIC_COUNTRY = (settingsMap.domestic_country || 'AU').toUpperCase();

    // Determine date range: use override if provided, otherwise tomorrow (production)
    let targetDate: Date;
    if (dateOverride) {
      targetDate = new Date(dateOverride);
    } else {
      // Production mode: process tomorrow's sessions
      targetDate = new Date();
      targetDate.setDate(targetDate.getDate() + 1);
    }
    
    const { startIso, endIso } = (() => {
      const start = new Date(targetDate.getFullYear(), targetDate.getMonth(), targetDate.getDate(), 0, 0, 0);
      const end = new Date(targetDate.getFullYear(), targetDate.getMonth(), targetDate.getDate(), 23, 59, 59);
      return { startIso: start.toISOString(), endIso: end.toISOString() };
    })();

    const invoiceDate = targetDate.toISOString().split('T')[0]; // YYYY-MM-DD format

    // Find sessions for target date
    const { data: sessions, error: sessErr } = await supabase
      .from('sessions')
      .select('id, start_at, subject_id')
      .gte('start_at', startIso)
      .lte('start_at', endIso);
    if (sessErr) throw sessErr;

    if (!sessions?.length) {
      return json({ 
        ok: true, 
        processed: 0, 
        invoicesCreated: 0,
        dateRange: { start: startIso, end: endIso },
        message: `No sessions found for ${dateOverride ? `date ${invoiceDate}` : 'tomorrow'}`
      });
    }

    // Load attending students and subject pricing
    const sessionIds = sessions.map((s: any) => s.id);
    const { data: ssRows, error: ssErr } = await supabase
      .from('sessions_students')
      .select('id, session_id, student_id, planned_absence')
      .in('session_id', sessionIds);
    if (ssErr) throw ssErr;

    const subjectIds = Array.from(new Set(sessions.map((s: any) => s.subject_id).filter(Boolean)));
    const { data: subjects, error: subjErr } = await supabase
      .from('subjects')
      .select('id, billing_type, session_fee_cents, currency')
      .in('id', subjectIds);
    if (subjErr) throw subjErr;
    const subjectById: Record<string, any> = {};
    for (const sub of subjects || []) subjectById[sub.id] = sub;

    // Get billing info with default payment method using optimized view
    const { data: billingRows, error: billErr } = await supabase
      .from('vadmin_billing_with_payment_methods')
      .select('student_id, stripe_customer_id, stripe_payment_method_id, card_country');
    if (billErr) throw billErr;
    
    // Build map of student_id -> billing info with default payment method
    const billingByStudent: Record<string, any> = {};
    for (const b of billingRows || []) {
      billingByStudent[b.student_id] = {
        student_id: b.student_id,
        stripe_customer_id: b.stripe_customer_id,
        payment_methods: b.stripe_payment_method_id ? [{
          stripe_payment_method_id: b.stripe_payment_method_id,
          card_country: b.card_country
        }] : []
      };
    }

    // Parent emails
    const { data: parentsJoin } = await supabase
      .from('parents_students')
      .select('student_id, parent:parents(id, email)');
    const parentEmailByStudent: Record<string, string | undefined> = {};
    for (const row of parentsJoin || []) {
      const email = (row as any).parent?.email as string | undefined;
      if (email && !parentEmailByStudent[row.student_id]) parentEmailByStudent[row.student_id] = email;
    }
    const { data: students, error: stErr } = await supabase
      .from('students')
      .select('id, email');
    if (stErr) throw stErr;
    const studentEmailById: Record<string, string | undefined> = {};
    for (const s of students || []) studentEmailById[s.id] = s.email || undefined;

    // Subsidies (active)
    const { data: subsidies, error: subErr } = await supabase
      .from('student_subsidies')
      .select('student_id, subject_id, billing_type, price_cents, currency, effective_from, effective_until');
    if (subErr) throw subErr;

    // Group sessions by student_id
    const sessionsByStudent: Record<string, any[]> = {};
    for (const row of ssRows || []) {
      if (row.planned_absence) continue;
      const session = sessions.find((s: any) => s.id === row.session_id);
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
        subject
      });
    }

    const invoicesCreated: string[] = [];
    const errors: string[] = [];

    // Process each student
    for (const [studentId, studentSessions] of Object.entries(sessionsByStudent)) {
      try {
        // Check for existing invoice for this student and date
        const { data: existingInvoice } = await supabase
          .from('invoices')
          .select('id, stripe_invoice_id')
          .eq('student_id', studentId)
          .eq('invoice_date', invoiceDate)
          .maybeSingle();

        if (existingInvoice) {
          console.log(`[runner] Invoice already exists for student ${studentId} on ${invoiceDate}, skipping`);
          continue;
        }

        const billing = billingByStudent[studentId];
        const defaultPM = billing?.payment_methods?.[0];
        const receiptEmail = parentEmailByStudent[studentId] || studentEmailById[studentId];

        // Calculate pricing for each session and build invoice items
        const invoiceItems: any[] = [];
        let totalAmountCents = 0;

        for (const item of studentSessions) {
          const { session, subject, sessions_students_id, student_id } = item;

          // Resolve price (subsidy override if active)
          let netCents = subject.session_fee_cents || 0;
          const activeSub = (subsidies || []).find((s: any) =>
            s.student_id === student_id && 
            s.subject_id === session.subject_id && 
            s.billing_type === subject.billing_type && 
            (!s.effective_until || new Date(s.effective_until) > new Date())
          );
          
          if (activeSub) {
            const subsidyAmount = activeSub.price_cents;
            if (subsidyAmount < netCents) {
              // Partial subsidy: add negative item for subsidy
              const subsidyCents = -(netCents - subsidyAmount);
              invoiceItems.push({
                sessions_students_id,
                session_id: session.id,
                student_id,
                amount_cents: subsidyCents,
                description: `Subsidy for ${session.start_at}`,
                is_subsidy: true
              });
              netCents = subsidyAmount;
            } else if (subsidyAmount >= netCents) {
              // Full subsidy: add negative item for full amount
              invoiceItems.push({
                sessions_students_id,
                session_id: session.id,
                student_id,
                amount_cents: -netCents,
                description: `Full subsidy for ${session.start_at}`,
                is_subsidy: true
              });
              netCents = 0;
            }
          }

          // Skip zero-amount sessions (already handled by subsidies)
          if (netCents <= 0) continue;

          // Calculate gross amount with fees
          const isIntl = (defaultPM?.card_country && defaultPM.card_country.toUpperCase() !== DOMESTIC_COUNTRY);
          const grossCents = grossUp(netCents, !!isIntl, FEE_PERCENT_DOM, FEE_PERCENT_INTL, FEE_FIXED_CENTS);

          invoiceItems.push({
            sessions_students_id,
            session_id: session.id,
            student_id,
            amount_cents: grossCents,
            description: `Session charge for ${session.start_at}`,
            is_subsidy: false
          });

          totalAmountCents += grossCents;
        }

        // Skip if no items to invoice
        if (invoiceItems.length === 0) {
          console.log(`[runner] No invoice items for student ${studentId} on ${invoiceDate}, skipping`);
          continue;
        }

        // Handle missing billing or payment method
        if (!billing?.stripe_customer_id) {
          errors.push(`Student ${studentId}: No billing account configured`);
          continue;
        }

        if (!defaultPM?.stripe_payment_method_id) {
          // Create invoice with send_invoice collection method (no auto-charge)
          const idempotencyKey = `invoice_${studentId}_${invoiceDate}`;
          
          try {
            // Create invoice items in Stripe
            const stripeInvoiceItems = [];
            for (const item of invoiceItems) {
              const itemIdempotencyKey = `invoice_item_${item.sessions_students_id}`;
              const stripeItem = await stripe.invoiceItems.create({
                customer: billing.stripe_customer_id,
                amount: item.amount_cents,
                currency: 'aud',
                description: item.description,
                metadata: {
                  type: 'session_charge',
                  student_id: studentId,
                  session_id: item.session_id,
                  sessions_students_id: item.sessions_students_id,
                  is_subsidy: item.is_subsidy ? 'true' : 'false',
                },
              }, { idempotencyKey: itemIdempotencyKey });
              stripeInvoiceItems.push({ ...item, stripe_invoice_item_id: stripeItem.id });
            }

            // Create invoice
            const invoice = await stripe.invoices.create({
              customer: billing.stripe_customer_id,
              collection_method: 'send_invoice',
              auto_advance: false,
              pending_invoice_items_behavior: 'include',
              description: `Invoice for sessions on ${invoiceDate}`,
              metadata: {
                type: 'session_invoice',
                student_id: studentId,
                invoice_date: invoiceDate,
                stripe_key_type: isStripeTestKey ? 'test' : isStripeLiveKey ? 'live' : 'unknown',
              },
            }, { idempotencyKey });

            // Finalize invoice (sends email)
            const finalizedInvoice = await stripe.invoices.finalizeInvoice(invoice.id);

            // Store in database
            const { data: dbInvoice, error: dbErr } = await supabase
              .from('invoices')
              .insert({
                student_id: studentId,
                stripe_invoice_id: finalizedInvoice.id,
                stripe_invoice_number: finalizedInvoice.number,
                invoice_date: invoiceDate,
                amount_due_cents: finalizedInvoice.amount_due,
                amount_paid_cents: finalizedInvoice.amount_paid || 0,
                currency: finalizedInvoice.currency,
                status: finalizedInvoice.status,
                collection_method: finalizedInvoice.collection_method,
                auto_advance: finalizedInvoice.auto_advance,
                hosted_invoice_url: finalizedInvoice.hosted_invoice_url,
                invoice_pdf: finalizedInvoice.invoice_pdf,
                finalized_at: finalizedInvoice.status_transitions?.finalized_at 
                  ? new Date(finalizedInvoice.status_transitions.finalized_at * 1000).toISOString()
                  : null,
              })
              .select('id')
              .single();

            if (dbErr) throw dbErr;

            // Store invoice items
            for (const item of stripeInvoiceItems) {
              await supabase.from('invoice_items').insert({
                invoice_id: dbInvoice.id,
                sessions_students_id: item.sessions_students_id,
                stripe_invoice_item_id: item.stripe_invoice_item_id,
                amount_cents: item.amount_cents,
                description: item.description,
                is_subsidy: item.is_subsidy,
                session_id: item.session_id,
                student_id: item.student_id,
              });
            }

            invoicesCreated.push(dbInvoice.id);
          } catch (e: any) {
            console.error(`[runner] Failed to create invoice for student ${studentId}:`, e?.message || e);
            errors.push(`Student ${studentId}: ${e?.message || 'Invoice creation failed'}`);
          }
          continue;
        }

        // Create invoice with automatic collection
        const idempotencyKey = `invoice_${studentId}_${invoiceDate}`;
        
        try {
          // Create invoice items in Stripe
          const stripeInvoiceItems = [];
          for (const item of invoiceItems) {
            const itemIdempotencyKey = `invoice_item_${item.sessions_students_id}`;
            const stripeItem = await stripe.invoiceItems.create({
              customer: billing.stripe_customer_id,
              amount: item.amount_cents,
              currency: 'aud',
              description: item.description,
              metadata: {
                type: 'session_charge',
                student_id: studentId,
                session_id: item.session_id,
                sessions_students_id: item.sessions_students_id,
                is_subsidy: item.is_subsidy ? 'true' : 'false',
              },
            }, { idempotencyKey: itemIdempotencyKey });
            stripeInvoiceItems.push({ ...item, stripe_invoice_item_id: stripeItem.id });
          }

          // Create invoice
          const invoice = await stripe.invoices.create({
            customer: billing.stripe_customer_id,
            collection_method: 'charge_automatically',
            auto_advance: true,
            pending_invoice_items_behavior: 'include',
            description: `Invoice for sessions on ${invoiceDate}`,
            metadata: {
              type: 'session_invoice',
              student_id: studentId,
              invoice_date: invoiceDate,
              stripe_key_type: isStripeTestKey ? 'test' : isStripeLiveKey ? 'live' : 'unknown',
            },
          }, { idempotencyKey });

          // Finalize invoice (triggers automatic charge)
          const finalizedInvoice = await stripe.invoices.finalizeInvoice(invoice.id);

          // Store in database
          const { data: dbInvoice, error: dbErr } = await supabase
            .from('invoices')
            .insert({
              student_id: studentId,
              stripe_invoice_id: finalizedInvoice.id,
              stripe_invoice_number: finalizedInvoice.number,
              invoice_date: invoiceDate,
              amount_due_cents: finalizedInvoice.amount_due,
              amount_paid_cents: finalizedInvoice.amount_paid || 0,
              currency: finalizedInvoice.currency,
              status: finalizedInvoice.status,
              collection_method: finalizedInvoice.collection_method,
              auto_advance: finalizedInvoice.auto_advance,
              hosted_invoice_url: finalizedInvoice.hosted_invoice_url,
              invoice_pdf: finalizedInvoice.invoice_pdf,
              finalized_at: finalizedInvoice.status_transitions?.finalized_at 
                ? new Date(finalizedInvoice.status_transitions.finalized_at * 1000).toISOString()
                : null,
            })
            .select('id')
            .single();

          if (dbErr) throw dbErr;

          // Store invoice items
          for (const item of stripeInvoiceItems) {
            await supabase.from('invoice_items').insert({
              invoice_id: dbInvoice.id,
              sessions_students_id: item.sessions_students_id,
              stripe_invoice_item_id: item.stripe_invoice_item_id,
              amount_cents: item.amount_cents,
              description: item.description,
              is_subsidy: item.is_subsidy,
              session_id: item.session_id,
              student_id: item.student_id,
            });
          }

          invoicesCreated.push(dbInvoice.id);
        } catch (e: any) {
          console.error(`[runner] Failed to create invoice for student ${studentId}:`, e?.message || e);
          errors.push(`Student ${studentId}: ${e?.message || 'Invoice creation failed'}`);
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
      message: `Created ${invoicesCreated.length} invoices${isStripeTestKey ? ' (using Stripe test keys)' : isStripeLiveKey ? ' (using Stripe live keys)' : ''}`
    });
  } catch (e: any) {
    console.error('[runner] error', e?.message || e);
    return json({ error: 'runner_error', message: e?.message || String(e) }, 500);
  }
});
