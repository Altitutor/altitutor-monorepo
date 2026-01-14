// @ts-nocheck
// deno-lint-ignore-file no-explicit-any
import 'jsr:@supabase/functions-js/edge-runtime.d.ts';
import { createClient } from 'jsr:@supabase/supabase-js@2';
import Stripe from 'npm:stripe@16.6.0';

// Shared helpers
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
} from '../billing-runner/shared/data-loading.ts';
import { processStudentInvoicing } from '../billing-runner/shared/student-processing.ts';

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

  // Parse request body (must be done before auth check to avoid consuming body)
  let requestBody: any = null;
  if (req.method === 'POST') {
    try {
      const bodyText = await req.text();
      if (bodyText) {
        requestBody = JSON.parse(bodyText);
      }
    } catch {
      // Body parsing failed, continue
    }
  }

  let isServiceRole = false;
  let isAdminUser = false;

  try {
    const authHeader = req.headers.get('authorization');
    const apiKey = req.headers.get('apikey');

    // Check if this is a service role request
    const bearerToken = authHeader?.startsWith('Bearer ')
      ? authHeader.substring(7).trim()
      : authHeader;

    if (apiKey === supabaseServiceKey || bearerToken === supabaseServiceKey) {
      isServiceRole = true;
    }

    // Allow admin users to call this function (for manual invoicing from admin web)
    if (isStripeTestKey || isStripeLiveKey) {
      try {
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
        console.error('[billing-single] Admin token check failed:', err);
      }
    }

    // Only allow service role or admin users
    if (!isServiceRole && !isAdminUser) {
      return json(
        {
          error: 'Unauthorized: This function can only be called by service role or admin staff',
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
    // Parse request body
    const body = requestBody || {};
    const { sessions_students_id } = body;

    if (!sessions_students_id) {
      return json({ error: 'sessions_students_id is required' }, 400);
    }

    // *** EDGE CASE: Check if session is already invoiced ***
    const invoicedSet = await getInvoicedSessionsStudentsIds(supabase, [sessions_students_id]);
    if (invoicedSet.has(sessions_students_id)) {
      return json(
        {
          error: 'Session already invoiced',
          sessions_students_id,
          message: 'This session has already been invoiced and cannot be invoiced again.',
        },
        400
      );
    }

    // Load the session data
    const { data: sessionStudent, error: ssError } = await supabase
      .from('sessions_students')
      .select(
        `
        id,
        student_id,
        planned_absence,
        session:sessions (
          id,
          start_at,
          end_at,
          billing_type,
          subject_id,
          class_id
        )
      `
      )
      .eq('id', sessions_students_id)
      .single();

    if (ssError || !sessionStudent) {
      return json(
        {
          error: 'Session not found',
          sessions_students_id,
          message: ssError?.message || 'Could not find session_student record',
        },
        404
      );
    }

    const session = sessionStudent.session;
    if (!session) {
      return json(
        {
          error: 'Session data not found',
          sessions_students_id,
          message: 'Could not load session data',
        },
        404
      );
    }

    // *** EDGE CASE: Check for planned absence ***
    // Allow invoicing if planned_absence = true BUT tutor log shows they actually attended
    if (sessionStudent.planned_absence) {
      // First, check if there's a tutor log for this session
      const { data: tutorLog, error: tlError } = await supabase
        .from('tutor_logs')
        .select('id')
        .eq('session_id', session.id)
        .maybeSingle();

      if (tlError || !tutorLog) {
        return json(
          {
            error: 'Planned absence cannot be invoiced',
            sessions_students_id,
            message:
              'This session is marked as a planned absence. To invoice it, a tutor log must exist showing the student actually attended.',
          },
          400
        );
      }

      // Check if the tutor log shows the student actually attended
      const { data: tutorLogAttendance, error: tlaError } = await supabase
        .from('tutor_logs_student_attendance')
        .select('attended')
        .eq('tutor_log_id', tutorLog.id)
        .eq('student_id', sessionStudent.student_id)
        .eq('attended', true)
        .maybeSingle();

      // If no tutor log showing attendance, reject planned absence
      if (tlaError || !tutorLogAttendance) {
        return json(
          {
            error: 'Planned absence cannot be invoiced',
            sessions_students_id,
            message:
              'This session is marked as a planned absence. To invoice it, a tutor log must exist showing the student actually attended.',
          },
          400
        );
      }
    }

    // *** EDGE CASE: Check if session is billable ***
    if (!session.billing_type) {
      return json(
        {
          error: 'Session is not billable',
          sessions_students_id,
          message: 'This session does not have a billing_type and cannot be invoiced.',
        },
        400
      );
    }

    const studentId = sessionStudent.student_id;
    const sessionDate = new Date(session.start_at);
    const invoiceDate = sessionDate.toISOString().split('T')[0]; // YYYY-MM-DD format

    // Load all required data
    const [
      billingSettings,
      pricingByBillingType,
      { overridesBySubjectAndBilling, pricingOverrides },
      subsidies,
      billingByStudent,
      { parentEmailByStudent, studentEmailById },
    ] = await Promise.all([
      loadBillingSettings(supabase),
      loadBillingPricing(supabase),
      loadPricingOverrides(supabase, session.subject_id ? [session.subject_id] : []),
      loadSubsidies(supabase),
      loadBillingInfo(supabase),
      loadStudentEmails(supabase),
    ]);

    // Load subjects and classes
    const subjectIds = session.subject_id ? [session.subject_id] : [];
    const classIds = session.class_id ? [session.class_id] : [];
    const [subjectById, classById] = await Promise.all([
      loadSubjects(supabase, subjectIds),
      loadClasses(supabase, classIds),
    ]);

    // Prepare session data in the format expected by processStudentInvoicing
    const studentSessions = [
      {
        session,
        subject: session.subject_id ? subjectById[session.subject_id] : null,
        sessions_students_id,
        student_id: studentId,
      },
    ];

    // Process the single session
    const result = await processStudentInvoicing({
      supabase,
      stripe,
      studentId,
      studentSessions,
      invoiceDate,
      targetDate: sessionDate,
      feePercentDom: billingSettings.feePercentDom,
      feePercentIntl: billingSettings.feePercentIntl,
      feeFixedCents: billingSettings.feeFixedCents,
      domesticCountry: billingSettings.domesticCountry,
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
    });

    if (result.error) {
      return json(
        {
          error: result.error,
          sessions_students_id,
          invoiceId: result.invoiceId,
        },
        500
      );
    }

    if (!result.invoiceId) {
      return json(
        {
          error: 'Failed to create invoice',
          sessions_students_id,
          message: 'Invoice processing completed but no invoice ID was returned.',
        },
        500
      );
    }

    return json({
      ok: true,
      sessions_students_id,
      invoiceId: result.invoiceId,
      studentId,
      invoiceDate,
      message: 'Session invoiced successfully',
    });
  } catch (e: any) {
    console.error('[billing-single] Error:', e);
    return json(
      {
        error: 'Internal server error',
        message: e?.message || 'An unexpected error occurred',
      },
      500
    );
  }
});
