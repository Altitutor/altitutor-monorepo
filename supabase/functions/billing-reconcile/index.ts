// @ts-nocheck
// deno-lint-ignore-file no-explicit-any
import 'jsr:@supabase/functions-js/edge-runtime.d.ts';
import { createClient } from 'jsr:@supabase/supabase-js@2';
import Stripe from 'npm:stripe@16.6.0';
import type { ReconciliationRequest, ReconciliationResponse, ReconciliationMode, StrategyResult } from './shared/types.ts';
import { json } from './shared/utils.ts';
import { reconcileMissingInvoices } from './strategies/missing-invoices.ts';
import { reconcileIncompleteInvoices } from './strategies/incomplete-invoices.ts';
import { reconcileStatusDrift } from './strategies/status-drift.ts';
import { reconcileAmountsMismatch } from './strategies/amounts-mismatch.ts';
import { reconcileRefundDrift } from './strategies/refund-drift.ts';
import { reconcileChargeIdBackfill } from './strategies/charge-id-backfill.ts';

/**
 * Unified reconciliation coordinator
 * Routes to different reconciliation strategies based on request parameters
 * 
 * Based on Stripe best practices:
 * - Always fetch full invoice from Stripe API for reliable data
 * - Handle customer balance properly (amount_paid_from_balance_cents)
 * - Validate status transitions (paid is terminal but can be changed back to open)
 * - Use webhooks as primary sync, reconciliation as backup
 */
Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { 
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
      } 
    });
  }
  
  const STRIPE_SECRET_KEY = Deno.env.get('STRIPE_SECRET_KEY')?.trim();
  if (!STRIPE_SECRET_KEY) {
    return json({ error: 'Stripe key not configured' }, 500);
  }
  
  const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
  const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
  const billingCronSecret = Deno.env.get('BILLING_CRON_SECRET_KEY')?.trim();
  
  // Check if using test or live Stripe keys (for admin token support)
  const isStripeTestKey = STRIPE_SECRET_KEY.startsWith('sk_test_');
  const isStripeLiveKey = STRIPE_SECRET_KEY.startsWith('sk_live_');
  
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
    
    // Allow admin users to call this function (for manual reconciliation from admin web)
    // Enabled for both test and live keys (same as billing-runner)
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
        console.error('[reconcile] Admin token check failed:', err);
      }
    }
    
    // Only allow cron jobs or admin users
    if (!isCronJob && !isAdminUser) {
      return json(
        {
          error: 'Unauthorized: Reconciliation can only be triggered by cron jobs or admin staff',
        },
        403
      );
    }
  } catch (authErr) {
    console.error('[reconcile] Auth check failed:', authErr);
    return json({ error: 'Unauthorized' }, 401);
  }
  
  const stripe = new Stripe(STRIPE_SECRET_KEY, { apiVersion: '2024-06-20' });
  const supabase = createClient(supabaseUrl, supabaseServiceKey, { auth: { persistSession: false } });
  
  try {
    // Parse request body
    let body: ReconciliationRequest = {};
    try {
      const bodyText = await req.text();
      if (bodyText) {
        body = JSON.parse(bodyText);
      }
    } catch (parseErr) {
      // Body parsing failed, use defaults
      console.warn('[reconcile] Failed to parse request body, using defaults');
    }
    
    // Determine which strategies to run
    const mode: ReconciliationMode = body.mode || 'all';
    const daysBack = body.days_back || 7;
    const onlyMissingItems = body.only_missing_items !== false; // Default true
    const onlyMissingTotals = body.only_missing_totals !== false; // Default true
    const fixStatusDrift = body.fix_status_drift === true; // Default false (report only)
    const fixAmountsMismatch = body.fix_amounts_mismatch === true; // Default false (report only)
    const fixRefundDrift = body.fix_refund_drift === true; // Default false (report only)
    const fixChargeIdBackfill = body.fix_charge_id_backfill === true; // Default false (report only)
    
    const strategies: StrategyResult[] = [];
    
    // Run strategies based on mode
    if (mode === 'all' || mode === 'missing-invoices') {
      console.log('[reconcile] Running missing-invoices strategy...');
      const result = await reconcileMissingInvoices(stripe, supabase, daysBack);
      strategies.push(result);
    }
    
    if (mode === 'all' || mode === 'incomplete-invoices') {
      console.log('[reconcile] Running incomplete-invoices strategy...');
      const result = await reconcileIncompleteInvoices(
        stripe,
        supabase,
        daysBack,
        onlyMissingItems,
        onlyMissingTotals
      );
      strategies.push(result);
    }
    
    if (mode === 'all' || mode === 'status-drift') {
      console.log('[reconcile] Running status-drift strategy...');
      const result = await reconcileStatusDrift(stripe, supabase, daysBack, fixStatusDrift);
      strategies.push(result);
    }
    
    if (mode === 'all' || mode === 'amounts-mismatch') {
      console.log('[reconcile] Running amounts-mismatch strategy...');
      const result = await reconcileAmountsMismatch(stripe, supabase, daysBack, fixAmountsMismatch);
      strategies.push(result);
    }
    
    if (mode === 'all' || mode === 'refund-drift') {
      console.log('[reconcile] Running refund-drift strategy...');
      const result = await reconcileRefundDrift(stripe, supabase, daysBack, fixRefundDrift);
      strategies.push(result);
    }
    
    if (mode === 'all' || mode === 'charge-id-backfill') {
      console.log('[reconcile] Running charge-id-backfill strategy...');
      const result = await reconcileChargeIdBackfill(stripe, supabase, daysBack, fixChargeIdBackfill);
      strategies.push(result);
    }
    
    // Calculate summary
    const summary = {
      total_reconciled: strategies.reduce((sum, s) => sum + s.reconciled.length, 0),
      total_errors: strategies.reduce((sum, s) => sum + s.errors.length, 0),
      total_skipped: strategies.reduce((sum, s) => sum + s.skipped.length, 0),
      total_warnings: strategies.reduce((sum, s) => sum + s.warnings.length, 0),
      total_mismatches: strategies.reduce((sum, s) => sum + (s.mismatches?.length || 0), 0),
    };
    
    const response: ReconciliationResponse = {
      ok: summary.total_errors === 0,
      strategies,
      summary,
      date_range: {
        start: new Date(Date.now() - daysBack * 24 * 60 * 60 * 1000).toISOString(),
        end: new Date().toISOString(),
      },
    };
    
    return json(response);
  } catch (e: unknown) {
    console.error('[reconcile] Top-level error:', e);
    const errorMessage = e instanceof Error ? e.message : (typeof e === 'string' ? e : String(e) || 'Unknown error');
    return json({ 
      error: 'reconcile_error', 
      message: errorMessage,
    }, 500);
  }
});
