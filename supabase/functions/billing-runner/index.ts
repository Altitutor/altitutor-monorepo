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
    // Check admin token even if service role is provided, as a fallback for local dev
    if (isStripeTestKey) {
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
      } catch (err) {
        // Auth check failed, continue with normal flow
        console.error('[billing-runner] Admin token check failed:', err);
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
    
    const { startIso, endIso } = (() => {
      // Convert target date to Adelaide timezone to get the correct date range
      // Sessions are stored in UTC, but we want to filter by Adelaide date
      // Adelaide is UTC+10:30 (ACDT) or UTC+9:30 (ACST)
      // For January, Adelaide uses ACDT (UTC+10:30)
      // Example: 03/01/2026 Adelaide = 2026-01-02 13:30:00 UTC to 2026-01-03 13:29:59 UTC
      
      const year = targetDate.getUTCFullYear();
      const month = targetDate.getUTCMonth();
      const day = targetDate.getUTCDate();
      
      // Calculate UTC range that covers the entire Adelaide day
      // Start: 00:00:00 Adelaide = 13:30:00 previous day UTC (UTC+10:30)
      // End: 23:59:59.999 Adelaide = 13:29:59.999 same day UTC
      const adelaideOffsetMs = 10.5 * 60 * 60 * 1000; // 10.5 hours in milliseconds
      
      // Start of day in Adelaide (00:00:00 Adelaide time)
      const startAdelaide = new Date(Date.UTC(year, month, day, 0, 0, 0, 0));
      const startUTC = new Date(startAdelaide.getTime() - adelaideOffsetMs);
      
      // End of day in Adelaide (23:59:59.999 Adelaide time)
      const endAdelaide = new Date(Date.UTC(year, month, day, 23, 59, 59, 999));
      const endUTC = new Date(endAdelaide.getTime() - adelaideOffsetMs);
      
      return { startIso: startUTC.toISOString(), endIso: endUTC.toISOString() };
    })();

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
        message: `No billable sessions found for ${dateOverride ? `date ${invoiceDate}` : 'tomorrow'}`
      });
    }

    // Load billing pricing tables
    const { data: billingPricing, error: bpErr } = await supabase
      .from('billing_pricing')
      .select('billing_type, hourly_rate_cents, currency');
    if (bpErr) throw bpErr;
    const pricingByBillingType: Record<string, { hourly_rate_cents: number; currency: string }> = {};
    for (const p of billingPricing || []) {
      pricingByBillingType[p.billing_type] = {
        hourly_rate_cents: p.hourly_rate_cents,
        currency: p.currency
      };
    }

    // Load subject pricing overrides
    const subjectIds = Array.from(new Set(sessions.map((s: any) => s.subject_id).filter(Boolean)));
    const { data: pricingOverrides, error: poErr } = await supabase
      .from('billing_pricing_overrides')
      .select('subject_id, billing_type, hourly_rate_cents, currency, effective_from, effective_until')
      .in('subject_id', subjectIds);
    if (poErr) throw poErr;
    const overridesBySubjectAndBilling: Record<string, Record<string, any>> = {};
    // Note: Override validation will be done per-session using targetDate in calculateSessionPrice
    // This map is kept for quick lookup, but actual validation happens during price calculation
    for (const override of pricingOverrides || []) {
      if (!overridesBySubjectAndBilling[override.subject_id]) {
        overridesBySubjectAndBilling[override.subject_id] = {};
      }
      overridesBySubjectAndBilling[override.subject_id][override.billing_type] = {
        hourly_rate_cents: override.hourly_rate_cents,
        currency: override.currency,
        effective_from: override.effective_from,
        effective_until: override.effective_until
      };
    }

    // Load attending students
    const sessionIds = sessions.map((s: any) => s.id);
    const { data: ssRows, error: ssErr } = await supabase
      .from('sessions_students')
      .select('id, session_id, student_id, planned_absence')
      .in('session_id', sessionIds);
    if (ssErr) throw ssErr;

    // Load subjects for display names (no pricing fields needed)
    const { data: subjects, error: subjErr } = await supabase
      .from('subjects')
      .select('id, name, curriculum, year_level')
      .in('id', subjectIds);
    if (subjErr) throw subjErr;
    const subjectById: Record<string, any> = {};
    for (const sub of subjects || []) subjectById[sub.id] = sub;

    // Load classes for class name display
    const classIds = Array.from(new Set(sessions.map((s: any) => s.class_id).filter(Boolean)));
    const { data: classes, error: classErr } = await supabase
      .from('classes')
      .select('id, level, subject_id')
      .in('id', classIds);
    if (classErr) throw classErr;
    const classById: Record<string, any> = {};
    for (const cls of classes || []) classById[cls.id] = cls;

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

    // Pricing calculation function - returns { amount_cents, currency }
    // Now accepts studentId to check for subsidies (hourly rate overrides)
    const calculateSessionPrice = (session: any, studentId?: string): { amount_cents: number; currency: string } => {
      if (!session.billing_type) return { amount_cents: 0, currency: 'aud' }; // Non-billable session
      
      // Calculate duration in hours
      const startTime = new Date(session.start_at).getTime();
      const endTime = new Date(session.end_at).getTime();
      const durationMs = endTime - startTime;
      const durationHours = durationMs / (1000 * 60 * 60);
      
      // Check for subject override first (use targetDate for override validation)
      const override = overridesBySubjectAndBilling[session.subject_id]?.[session.billing_type];
      let hourlyRateCents = 0;
      let currency = 'aud';
      
      if (override) {
        // Validate override is active for targetDate
        const overrideData = pricingOverrides?.find((o: any) => 
          o.subject_id === session.subject_id && 
          o.billing_type === session.billing_type
        );
        if (overrideData) {
          const effectiveFrom = new Date(overrideData.effective_from);
          const effectiveUntil = overrideData.effective_until ? new Date(overrideData.effective_until) : null;
          if (effectiveFrom <= targetDate && (!effectiveUntil || effectiveUntil > targetDate)) {
            hourlyRateCents = override.hourly_rate_cents;
            currency = override.currency.toLowerCase();
          } else {
            // Override not active, use default pricing
            const defaultPricing = pricingByBillingType[session.billing_type];
            hourlyRateCents = defaultPricing?.hourly_rate_cents || 0;
            currency = defaultPricing?.currency?.toLowerCase() || 'aud';
          }
        } else {
          // Override not found in active list, use default
          const defaultPricing = pricingByBillingType[session.billing_type];
          hourlyRateCents = defaultPricing?.hourly_rate_cents || 0;
          currency = defaultPricing?.currency?.toLowerCase() || 'aud';
        }
      } else {
        // No override, use default pricing
        const defaultPricing = pricingByBillingType[session.billing_type];
        hourlyRateCents = defaultPricing?.hourly_rate_cents || 0;
        currency = defaultPricing?.currency?.toLowerCase() || 'aud';
      }
      
      // Check for student subsidy (hourly rate override)
      // Subsidies are stored as hourly_rate_cents (price_cents field)
      // Student pays the minimum of subsidy rate and default/override rate
      if (studentId && session.subject_id && session.billing_type) {
        const activeSub = (subsidies || []).find((s: any) =>
          s.student_id === studentId && 
          s.subject_id === session.subject_id && 
          s.billing_type === session.billing_type && 
          (!s.effective_from || new Date(s.effective_from) <= targetDate) &&
          (!s.effective_until || new Date(s.effective_until) > targetDate)
        );
        
        if (activeSub) {
          // Subsidy price_cents is now the hourly rate override
          const subsidyHourlyRateCents = activeSub.price_cents;
          // Use the minimum of subsidy rate and default/override rate
          hourlyRateCents = Math.min(hourlyRateCents, subsidyHourlyRateCents);
          // Use subsidy currency if provided, otherwise keep existing currency
          if (activeSub.currency) {
            currency = activeSub.currency.toLowerCase();
          }
        }
      }
      
      // Calculate total: hourly_rate * duration (rounded to nearest cent)
      return {
        amount_cents: Math.round(hourlyRateCents * durationHours),
        currency
      };
    };

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
        // Check for existing invoice for this student and date BEFORE creating any Stripe resources
        // This prevents idempotency key conflicts
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

        let billing = billingByStudent[studentId];
        const defaultPM = billing?.payment_methods?.[0];
        const receiptEmail = parentEmailByStudent[studentId] || studentEmailById[studentId];

        // Calculate pricing for each session and build invoice items
        const invoiceItems: any[] = [];
        let totalNetCents = 0; // Track total net amount (before fees)
        let invoiceCurrency: string | null = null; // Track currency for validation

        // Helper function to build class long name
        const getClassLongName = (session: any): string => {
          const cls = session.class_id ? classById[session.class_id] : null;
          const subj = session.subject_id ? subjectById[session.subject_id] : null;
          if (!subj) return 'Session';
          
          const parts: string[] = [];
          if (subj.curriculum) parts.push(String(subj.curriculum));
          if (subj.year_level != null) parts.push(String(subj.year_level));
          if (subj.name) parts.push(subj.name);
          if (cls?.level) parts.push(String(cls.level));
          return parts.length > 0 ? parts.join(' ') : subj.name || 'Session';
        };

        // Helper function to format session date in Australia/Adelaide timezone
        const formatSessionDate = (startAt: string): string => {
          try {
            const date = new Date(startAt);
            // Format in Australia/Adelaide timezone
            return date.toLocaleString('en-AU', { 
              timeZone: 'Australia/Adelaide',
              weekday: 'short', 
              year: 'numeric', 
              month: 'short', 
              day: 'numeric',
              hour: '2-digit',
              minute: '2-digit'
            });
          } catch {
            return startAt;
          }
        };

        for (const item of studentSessions) {
          const { session, subject, sessions_students_id, student_id } = item;

          // Calculate price from hourly rate and duration (subsidy is now applied as hourly rate override)
          // Pass student_id to calculateSessionPrice so it can check for subsidies
          const priceResult = calculateSessionPrice(session, student_id);
          const netCents = priceResult.amount_cents;
          const sessionCurrency = priceResult.currency;
          
          // Validate currency consistency
          if (invoiceCurrency === null) {
            invoiceCurrency = sessionCurrency;
          } else if (invoiceCurrency !== sessionCurrency) {
            errors.push(`Student ${studentId}: Mixed currencies detected (${invoiceCurrency} vs ${sessionCurrency}). All sessions must use the same currency.`);
            continue;
          }
          
          // Skip zero-amount sessions
          if (netCents <= 0) continue;

          // Add session charge (subsidy is already applied as hourly rate override, no separate line item needed)
          const classLongName = getClassLongName(session);
          const sessionDate = formatSessionDate(session.start_at);
          invoiceItems.push({
            sessions_students_id,
            session_id: session.id,
            student_id,
            amount_cents: netCents,
            description: `${classLongName} - ${sessionDate}`,
            is_subsidy: false,
            currency: sessionCurrency
          });

          totalNetCents += netCents;
        }

        // Calculate total fees as a separate line item
        // If no payment method exists, assume Australian card (domestic fees)
        if (totalNetCents > 0 && invoiceCurrency) {
          // If no payment method, assume Australian card (domestic fees)
          const isIntl = defaultPM 
            ? (defaultPM.card_country && defaultPM.card_country.toUpperCase() !== DOMESTIC_COUNTRY)
            : false; // Assume domestic (Australian) card when no payment method
          const feePercent = isIntl ? FEE_PERCENT_INTL : FEE_PERCENT_DOM;
          const feeFixedCents = FEE_FIXED_CENTS;
          
          // Calculate gross amount with fees
          const grossCents = grossUp(totalNetCents, !!isIntl, FEE_PERCENT_DOM, FEE_PERCENT_INTL, FEE_FIXED_CENTS);
          const totalFeesCents = grossCents - totalNetCents;
          
          // Add fees as a separate line item
          // Note: sessions_students_id and session_id are required by DB schema (NOT NULL constraint)
          // For fee items, we use the first session's IDs as a technical requirement
          // Fees apply to the entire invoice, not a specific session
          if (totalFeesCents > 0 && invoiceItems.length > 0) {
            const firstSessionItem = invoiceItems.find((item: any) => item.sessions_students_id);
            if (firstSessionItem) {
              invoiceItems.push({
                sessions_students_id: firstSessionItem.sessions_students_id, // Use first session's ID for DB constraint
                session_id: firstSessionItem.session_id, // Use first session's ID for DB constraint
                student_id: studentId,
                amount_cents: totalFeesCents,
                description: `Payment processing fee (${(feePercent * 100).toFixed(2)}%${feeFixedCents > 0 ? ` + $${(feeFixedCents / 100).toFixed(2)}` : ''})`,
                is_subsidy: false,
                is_fee: true,
                currency: invoiceCurrency
              });
            }
          }
        }

        // Skip if no items to invoice
        if (invoiceItems.length === 0) {
          console.log(`[runner] No invoice items for student ${studentId} on ${invoiceDate}, skipping`);
          continue;
        }

        // Validate currency consistency (all items must use the same currency)
        if (!invoiceCurrency) {
          errors.push(`Student ${studentId}: No currency determined for invoice items`);
          continue;
        }
        
        // Ensure all items have the same currency
        const mismatchedCurrency = invoiceItems.find((item: any) => item.currency !== invoiceCurrency);
        if (mismatchedCurrency) {
          errors.push(`Student ${studentId}: Currency mismatch detected. Expected ${invoiceCurrency}, found ${mismatchedCurrency.currency}`);
          continue;
        }

        // Handle missing billing account - auto-create if missing
        if (!billing?.stripe_customer_id) {
          try {
            // Get student email for Stripe customer creation
            const studentEmail = studentEmailById[studentId] || parentEmailByStudent[studentId];
            const { data: studentData } = await supabase
              .from('students')
              .select('first_name, last_name, email')
              .eq('id', studentId)
              .single();
            
            // Create Stripe customer
            const stripeCustomer = await stripe.customers.create({
              email: studentEmail || studentData?.email || undefined,
              name: studentData ? `${studentData.first_name} ${studentData.last_name}`.trim() : undefined,
              metadata: {
                student_id: studentId,
                type: 'student',
              },
            });

            // Create or update billing account in database
            const { data: billingData, error: billingErr } = await supabase
              .from('students_billing')
              .upsert({
                student_id: studentId,
                stripe_customer_id: stripeCustomer.id,
              }, {
                onConflict: 'student_id',
              })
              .select('student_id, stripe_customer_id')
              .single();

            if (billingErr) throw billingErr;

            // Update billing map
            billingByStudent[studentId] = {
              student_id: studentId,
              stripe_customer_id: stripeCustomer.id,
              payment_methods: []
            };
            billing = billingByStudent[studentId];
            
            console.log(`[runner] Auto-created billing account for student ${studentId} with Stripe customer ${stripeCustomer.id}`);
          } catch (createErr: any) {
            console.error(`[runner] Failed to auto-create billing account for student ${studentId}:`, createErr?.message || createErr);
            errors.push(`Student ${studentId}: Failed to create billing account - ${createErr?.message || 'Unknown error'}`);
            continue;
          }
        }

        if (!defaultPM?.stripe_payment_method_id) {
          // Create invoice with send_invoice collection method (no auto-charge)
          // Generate deterministic idempotency key (no timestamp to ensure retries use same key)
          const idempotencyKey = `invoice_${studentId}_${invoiceDate}`;
          
          try {
            // Helper function to generate deterministic idempotency key
            // Deterministic keys ensure retries use the same key, preventing duplicate Stripe resources
            const generateItemIdempotencyKey = (item: any): string => {
              if (item.sessions_students_id) {
                return `invoice_item_${item.sessions_students_id}_${invoiceDate}`;
              } else {
                return `invoice_item_fee_${studentId}_${invoiceDate}`;
              }
            };

            // Create invoice items in Stripe
            // Track created items for rollback on failure
            const stripeInvoiceItems = [];
            const createdStripeItemIds: string[] = [];
            
            try {
              for (const item of invoiceItems) {
                // Generate unique idempotency key with hash of amount and description
                const itemIdempotencyKey = generateItemIdempotencyKey(item);
                const stripeItem = await stripe.invoiceItems.create({
                  customer: billing.stripe_customer_id,
                  amount: item.amount_cents,
                  currency: invoiceCurrency, // Use currency from pricing data, not hardcoded
                  description: item.description,
                  metadata: {
                    type: 'session_charge',
                    student_id: studentId,
                    session_id: item.session_id || '',
                    sessions_students_id: item.sessions_students_id || '',
                    is_subsidy: item.is_subsidy ? 'true' : 'false',
                    is_fee: item.is_fee ? 'true' : 'false',
                  },
                }, { idempotencyKey: itemIdempotencyKey });
                stripeInvoiceItems.push({ ...item, stripe_invoice_item_id: stripeItem.id });
                createdStripeItemIds.push(stripeItem.id);
              }
            } catch (itemErr: any) {
              // Rollback: delete created invoice items if any failed
              console.error(`[runner] Failed to create invoice items for student ${studentId}, rolling back:`, itemErr?.message || itemErr);
              for (const itemId of createdStripeItemIds) {
                try {
                  await stripe.invoiceItems.del(itemId);
                } catch (delErr) {
                  console.error(`[runner] Failed to delete invoice item ${itemId} during rollback:`, delErr);
                }
              }
              throw itemErr;
            }

            // Create invoice with send_invoice collection method
            // Stripe requires due_date or days_until_due when collection_method is 'send_invoice'
            const invoice = await stripe.invoices.create({
              customer: billing.stripe_customer_id,
              collection_method: 'send_invoice',
              days_until_due: 30, // Set 30 days payment window for manual invoices
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

            // Store in database - wrap in try/catch for rollback
            let dbInvoice: any = null;
            try {
              const { data: insertedInvoice, error: dbErr } = await supabase
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
              dbInvoice = insertedInvoice;

              // Store invoice items
              const itemInserts = stripeInvoiceItems.map((item) => ({
                invoice_id: dbInvoice.id,
                sessions_students_id: item.sessions_students_id,
                stripe_invoice_item_id: item.stripe_invoice_item_id,
                amount_cents: item.amount_cents,
                description: item.description,
                is_subsidy: item.is_subsidy,
                session_id: item.session_id,
                student_id: item.student_id,
              }));

              const { error: itemsErr } = await supabase
                .from('invoice_items')
                .insert(itemInserts);

              if (itemsErr) throw itemsErr;

              invoicesCreated.push(dbInvoice.id);
            } catch (dbErr: any) {
              // Rollback: void the Stripe invoice if DB insert failed
              console.error(`[runner] Database insert failed for student ${studentId}, voiding Stripe invoice:`, dbErr?.message || dbErr);
              try {
                await stripe.invoices.voidInvoice(finalizedInvoice.id);
              } catch (voidErr: any) {
                // Void failed - invoice might have been paid manually
                console.error(`[runner] Failed to void invoice ${finalizedInvoice.id} during rollback:`, voidErr);
                
                // Check if invoice is paid
                const invoiceStatus = await stripe.invoices.retrieve(finalizedInvoice.id);
                if (invoiceStatus.status === 'paid') {
                  // Invoice was paid - reconcile by creating DB record
                  console.warn(`[runner] Invoice ${finalizedInvoice.id} was paid before void, creating DB record for reconciliation`);
                  
                  try {
                    // Fetch invoice items from Stripe
                    const stripeItems = await stripe.invoiceItems.list({
                      invoice: finalizedInvoice.id,
                    });

                    // Create DB record
                    const { data: reconciledInvoice, error: reconcileErr } = await supabase
                      .from('invoices')
                      .insert({
                        student_id: studentId,
                        stripe_invoice_id: finalizedInvoice.id,
                        stripe_invoice_number: finalizedInvoice.number,
                        invoice_date: invoiceDate,
                        amount_due_cents: invoiceStatus.amount_due,
                        amount_paid_cents: invoiceStatus.amount_paid || 0,
                        currency: invoiceStatus.currency,
                        status: invoiceStatus.status,
                        collection_method: invoiceStatus.collection_method,
                        auto_advance: invoiceStatus.auto_advance,
                        hosted_invoice_url: invoiceStatus.hosted_invoice_url,
                        invoice_pdf: invoiceStatus.invoice_pdf,
                        finalized_at: invoiceStatus.status_transitions?.finalized_at 
                          ? new Date(invoiceStatus.status_transitions.finalized_at * 1000).toISOString()
                          : null,
                      })
                      .select('id')
                      .single();

                    if (!reconcileErr) {
                      // Insert invoice items
                      const itemInserts = stripeItems.data.map((item) => ({
                        invoice_id: reconciledInvoice.id,
                        sessions_students_id: item.metadata?.sessions_students_id || '',
                        stripe_invoice_item_id: item.id,
                        amount_cents: item.amount,
                        description: item.description || '',
                        is_subsidy: item.metadata?.is_subsidy === 'true',
                        session_id: item.metadata?.session_id || '',
                        student_id: studentId,
                      }));

                      await supabase.from('invoice_items').insert(itemInserts);
                      invoicesCreated.push(reconciledInvoice.id);
                      console.log(`[runner] Successfully reconciled paid invoice ${finalizedInvoice.id}`);
                      // Don't throw error - reconciliation succeeded
                      continue;
                    } else {
                      errors.push(`Student ${studentId}: Database insert failed and reconciliation failed. Manual intervention required.`);
                    }
                  } catch (reconcileErr) {
                    errors.push(`Student ${studentId}: Database insert failed and reconciliation failed: ${reconcileErr}`);
                  }
                } else {
                  errors.push(`Student ${studentId}: Database insert failed and invoice void failed. Manual intervention required.`);
                }
              }
              throw dbErr;
            }
          } catch (e: any) {
            console.error(`[runner] Failed to create invoice for student ${studentId}:`, e?.message || e);
            errors.push(`Student ${studentId}: ${e?.message || 'Invoice creation failed'}`);
          }
          continue;
        }

        // Create invoice with automatic collection
        // Generate deterministic idempotency key (no timestamp to ensure retries use same key)
        const idempotencyKey = `invoice_${studentId}_${invoiceDate}`;
        
        try {
          // Helper function to generate deterministic idempotency key
          // Deterministic keys ensure retries use the same key, preventing duplicate Stripe resources
          const generateItemIdempotencyKey = (item: any): string => {
            if (item.sessions_students_id) {
              return `invoice_item_${item.sessions_students_id}_${invoiceDate}`;
            } else {
              return `invoice_item_fee_${studentId}_${invoiceDate}`;
            }
          };

          // Create invoice items in Stripe
          // Track created items for rollback on failure
          const stripeInvoiceItems = [];
          const createdStripeItemIds: string[] = [];
          
          try {
            for (const item of invoiceItems) {
              // Generate unique idempotency key with hash of amount and description
              const itemIdempotencyKey = generateItemIdempotencyKey(item);
              const stripeItem = await stripe.invoiceItems.create({
                customer: billing.stripe_customer_id,
                amount: item.amount_cents,
                currency: invoiceCurrency, // Use currency from pricing data, not hardcoded
                description: item.description,
                metadata: {
                  type: 'session_charge',
                  student_id: studentId,
                  session_id: item.session_id || '',
                  sessions_students_id: item.sessions_students_id || '',
                  is_subsidy: item.is_subsidy ? 'true' : 'false',
                  is_fee: item.is_fee ? 'true' : 'false',
                },
              }, { idempotencyKey: itemIdempotencyKey });
              stripeInvoiceItems.push({ ...item, stripe_invoice_item_id: stripeItem.id });
              createdStripeItemIds.push(stripeItem.id);
            }
          } catch (itemErr: any) {
            // Rollback: delete created invoice items if any failed
            console.error(`[runner] Failed to create invoice items for student ${studentId}, rolling back:`, itemErr?.message || itemErr);
            for (const itemId of createdStripeItemIds) {
              try {
                await stripe.invoiceItems.del(itemId);
              } catch (delErr) {
                console.error(`[runner] Failed to delete invoice item ${itemId} during rollback:`, delErr);
              }
            }
            throw itemErr;
          }

          // Create invoice with automatic collection
          const invoice = await stripe.invoices.create({
            customer: billing.stripe_customer_id,
            collection_method: 'charge_automatically',
            auto_advance: true,
            pending_invoice_items_behavior: 'include',
            default_payment_method: defaultPM.stripe_payment_method_id, // Explicitly set default payment method
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

          // Store in database FIRST (before payment)
          // This ensures we can void the invoice if DB insert fails (before payment)
          let dbInvoice: any = null;
          try {
            const { data: insertedInvoice, error: dbErr } = await supabase
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
            dbInvoice = insertedInvoice;

            // Store invoice items
            const itemInserts = stripeInvoiceItems.map((item) => ({
              invoice_id: dbInvoice.id,
              sessions_students_id: item.sessions_students_id,
              stripe_invoice_item_id: item.stripe_invoice_item_id,
              amount_cents: item.amount_cents,
              description: item.description,
              is_subsidy: item.is_subsidy,
              session_id: item.session_id,
              student_id: item.student_id,
            }));

            const { error: itemsErr } = await supabase
              .from('invoice_items')
              .insert(itemInserts);

            if (itemsErr) throw itemsErr;

            // NOW pay invoice (only if DB insert succeeded)
            // Stripe may delay automatic payment by up to 1 hour, so we pay immediately
            if (finalizedInvoice.status === 'open' && finalizedInvoice.collection_method === 'charge_automatically') {
              try {
                const paidInvoice = await stripe.invoices.pay(finalizedInvoice.id);
                
                // Update DB record with payment status
                await supabase
                  .from('invoices')
                  .update({
                    status: paidInvoice.status,
                    amount_paid_cents: paidInvoice.amount_paid || 0,
                    amount_due_cents: paidInvoice.amount_due,
                  })
                  .eq('id', dbInvoice.id);
              } catch (payErr: any) {
                // Payment failed (e.g., card declined) - invoice remains open
                console.warn(`[runner] Failed to pay invoice ${finalizedInvoice.id} for student ${studentId}:`, payErr?.message || payErr);
                // DB record already created with 'open' status - Stripe will retry according to retry settings
              }
            }

            invoicesCreated.push(dbInvoice.id);
          } catch (dbErr: any) {
            // DB insert failed - void invoice (before payment, so void will succeed)
            console.error(`[runner] Database insert failed for student ${studentId}, voiding Stripe invoice:`, dbErr?.message || dbErr);
            try {
              await stripe.invoices.voidInvoice(finalizedInvoice.id);
            } catch (voidErr: any) {
              // Void failed - invoice might have been auto-paid by Stripe
              // This is rare but possible if Stripe processes payment before we void
              console.error(`[runner] Failed to void invoice ${finalizedInvoice.id} during rollback:`, voidErr);
              
              // Check if invoice is paid
              const invoiceStatus = await stripe.invoices.retrieve(finalizedInvoice.id);
              if (invoiceStatus.status === 'paid') {
                // Invoice was paid - reconcile by creating DB record
                console.warn(`[runner] Invoice ${finalizedInvoice.id} was paid before void, creating DB record for reconciliation`);
                
                try {
                  // Fetch invoice items from Stripe
                  const stripeItems = await stripe.invoiceItems.list({
                    invoice: finalizedInvoice.id,
                  });

                  // Create DB record
                  const { data: reconciledInvoice, error: reconcileErr } = await supabase
                    .from('invoices')
                    .insert({
                      student_id: studentId,
                      stripe_invoice_id: finalizedInvoice.id,
                      stripe_invoice_number: finalizedInvoice.number,
                      invoice_date: invoiceDate,
                      amount_due_cents: invoiceStatus.amount_due,
                      amount_paid_cents: invoiceStatus.amount_paid || 0,
                      currency: invoiceStatus.currency,
                      status: invoiceStatus.status,
                      collection_method: invoiceStatus.collection_method,
                      auto_advance: invoiceStatus.auto_advance,
                      hosted_invoice_url: invoiceStatus.hosted_invoice_url,
                      invoice_pdf: invoiceStatus.invoice_pdf,
                      finalized_at: invoiceStatus.status_transitions?.finalized_at 
                        ? new Date(invoiceStatus.status_transitions.finalized_at * 1000).toISOString()
                        : null,
                    })
                    .select('id')
                    .single();

                  if (!reconcileErr) {
                    // Insert invoice items
                    const itemInserts = stripeItems.data.map((item) => ({
                      invoice_id: reconciledInvoice.id,
                      sessions_students_id: item.metadata?.sessions_students_id || '',
                      stripe_invoice_item_id: item.id,
                      amount_cents: item.amount,
                      description: item.description || '',
                      is_subsidy: item.metadata?.is_subsidy === 'true',
                      session_id: item.metadata?.session_id || '',
                      student_id: studentId,
                    }));

                    await supabase.from('invoice_items').insert(itemInserts);
                    invoicesCreated.push(reconciledInvoice.id);
                    console.log(`[runner] Successfully reconciled paid invoice ${finalizedInvoice.id}`);
                    // Don't throw error - reconciliation succeeded
                    continue;
                  } else {
                    errors.push(`Student ${studentId}: Database insert failed and reconciliation failed. Manual intervention required.`);
                  }
                } catch (reconcileErr) {
                  errors.push(`Student ${studentId}: Database insert failed and reconciliation failed: ${reconcileErr}`);
                }
              } else {
                errors.push(`Student ${studentId}: Database insert failed and invoice void failed. Manual intervention required.`);
              }
            }
            throw dbErr;
          }
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
