// @ts-nocheck
// deno-lint-ignore-file no-explicit-any
import 'jsr:@supabase/functions-js/edge-runtime.d.ts';
import { createClient } from 'jsr:@supabase/supabase-js@2';
import Stripe from 'npm:stripe@16.6.0';

// Shared helpers
import { calculateAdelaideDateRange } from './shared/utils.ts';
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
import { processStudentInvoicing } from './shared/student-processing.ts';

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
  const billingCronSecret = Deno.env.get('BILLING_CRON_SECRET_KEY')?.trim();

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

  let isCronJob = false;
  let isAdminUser = false;

  try {
    const authHeader = req.headers.get('authorization');
    const apiKey = req.headers.get('apikey');

    // Check if this is a cron job request using custom cron secret
    // Handle both Bearer token format and direct key comparison
    const bearerToken = authHeader?.startsWith('Bearer ')
      ? authHeader.substring(7).trim()
      : authHeader;

    // Authenticate cron jobs using custom secret (more secure and controllable)
    if (billingCronSecret && (apiKey === billingCronSecret || bearerToken === billingCronSecret)) {
      isCronJob = true;
    }

    // Allow admin users to call this function (for manual invoicing from admin web)
    // Enabled for both test and live keys (same as billing-single)
    if (isStripeTestKey || isStripeLiveKey) {
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

    // Only allow cron jobs or admin users
    if (!isCronJob && !isAdminUser) {
      return json(
        {
          error:
            'Unauthorized: Billing can only be triggered by cron jobs or admin staff',
        },
        403
      );
    }
  } catch (authErr: any) {
    return json({ error: 'Authentication error', message: authErr?.message }, 401);
  }

  const stripe = new Stripe(STRIPE_SECRET_KEY, { apiVersion: '2024-06-20' });
  const supabase = createClient(supabaseUrl, supabaseServiceKey, { auth: { persistSession: false } });
  const resendApiKey = Deno.env.get('RESEND_API_KEY')?.trim();

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
    const { parentEmailsByStudent, studentEmailById } = await loadStudentEmails(supabase);

    // Load subsidies
    const subsidies = await loadSubsidies(supabase);

    const invoicesCreated: string[] = [];
    const errors: string[] = [];

    // Process each session individually (same as billing-single)
    for (const row of uninvoicedSsRows) {
      const session = uninvoicedSessions.find((s: any) => s.id === row.session_id);
      if (!session) continue;

      const subject = session.subject_id ? subjectById[session.subject_id] : null;
      if (!subject) continue;

      // Use the session's actual date for invoiceDate and targetDate
      const sessionDate = new Date(session.start_at);
      const sessionInvoiceDate = sessionDate.toISOString().split('T')[0]; // YYYY-MM-DD format

      // Prepare session data in the format expected by processStudentInvoicing
      const studentSessions = [
        {
          session,
          subject,
          sessions_students_id: row.id,
          student_id: row.student_id,
        },
      ];

      const result = await processStudentInvoicing({
        supabase,
        stripe,
        studentId: row.student_id,
        studentSessions,
        invoiceDate: sessionInvoiceDate,
        targetDate: sessionDate,
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
      });

      if (result.invoiceId) {
        invoicesCreated.push(result.invoiceId);
      }
      if (result.error) {
        errors.push(result.error);
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
