// @ts-nocheck
// deno-lint-ignore-file no-explicit-any
import 'jsr:@supabase/functions-js/edge-runtime.d.ts';
import { createClient } from 'jsr:@supabase/supabase-js@2';
import Stripe from 'npm:stripe@16.6.0';
import type { ReconciliationRequest, ReconciliationResponse, ReconciliationMode, StrategyResult } from './shared/types.ts';
import { json, verifyAuth } from './shared/utils.ts';
import { reconcileMissingInvoices } from './strategies/missing-invoices.ts';
import { reconcileIncompleteInvoices } from './strategies/incomplete-invoices.ts';
import { reconcileStatusDrift } from './strategies/status-drift.ts';
import { reconcileAmountsMismatch } from './strategies/amounts-mismatch.ts';

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
  
  // Verify service role auth
  const authResult = verifyAuth(req, supabaseServiceKey);
  if (!authResult.authorized) {
    return json({ error: authResult.error || 'Unauthorized' }, 401);
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
  } catch (e: any) {
    console.error('[reconcile] Top-level error:', e);
    const errorMessage = e?.message || (typeof e === 'string' ? e : String(e) || 'Unknown error');
    return json({ 
      error: 'reconcile_error', 
      message: errorMessage,
    }, 500);
  }
});
