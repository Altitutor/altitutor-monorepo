// @ts-nocheck
// deno-lint-ignore-file no-explicit-any
import Stripe from 'npm:stripe@16.6.0';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

/**
 * Create JSON response with CORS headers
 */
export function json(resp: any, status = 200): Response {
  try {
    const body = JSON.stringify(resp);
    return new Response(body, { 
      status, 
      headers: { 
        'Content-Type': 'application/json',
        ...corsHeaders 
      } 
    });
  } catch (e: any) {
    console.error('[reconcile] Failed to serialize response:', e?.message || e);
    return new Response(JSON.stringify({ 
      error: 'serialization_error', 
      message: 'Failed to serialize response',
      original_status: status 
    }), { 
      status: 500, 
      headers: { 
        'Content-Type': 'application/json',
        ...corsHeaders 
      } 
    });
  }
}

/**
 * Verify service role authentication
 */
export function verifyAuth(req: Request, serviceKey: string): { authorized: boolean; error?: string } {
  const authHeader = req.headers.get('authorization');
  const apiKey = req.headers.get('apikey');
  const bearerToken = authHeader?.startsWith('Bearer ') 
    ? authHeader.substring(7).trim() 
    : authHeader;
  
  if (apiKey !== serviceKey && bearerToken !== serviceKey) {
    return { authorized: false, error: 'Unauthorized' };
  }
  
  return { authorized: true };
}

/**
 * Calculate amount paid from customer balance
 * Based on Stripe docs: amount_paid_from_balance = total - amount_due
 */
export function calculateAmountPaidFromBalance(
  totalCents: number | null,
  amountDueCents: number
): number | null {
  if (totalCents === null) return null;
  return Math.max(0, totalCents - amountDueCents);
}

/**
 * Fetch full invoice from Stripe API
 * Always fetch full invoice for reliable data (webhook payloads can be incomplete)
 */
export async function fetchFullInvoice(
  stripe: Stripe,
  invoiceId: string
): Promise<Stripe.Invoice | null> {
  try {
    return await stripe.invoices.retrieve(invoiceId, {
      expand: ['lines.data.price.product'],
    });
  } catch (err: any) {
    console.error(`[reconcile] Failed to retrieve Stripe invoice ${invoiceId}:`, err?.message || err);
    return null;
  }
}

/**
 * Validate sessions_students_id exists, with fallback lookup
 */
export async function validateSessionsStudentsId(
  supabase: any,
  sessionsStudentsId: string | undefined,
  sessionId: string | undefined,
  studentId: string | undefined
): Promise<{ valid: boolean; sessions_students_id?: string; error?: string }> {
  // If sessions_students_id provided, check if it exists
  if (sessionsStudentsId) {
    const { data: ssCheck, error: ssCheckErr } = await supabase
      .from('sessions_students')
      .select('id')
      .eq('id', sessionsStudentsId)
      .maybeSingle();
    
    if (!ssCheckErr && ssCheck) {
      return { valid: true, sessions_students_id: sessionsStudentsId };
    }
    
    // Try lookup by session_id + student_id
    if (sessionId && studentId) {
      const { data: ssLookup } = await supabase
        .from('sessions_students')
        .select('id')
        .eq('session_id', sessionId)
        .eq('student_id', studentId)
        .maybeSingle();
      
      if (ssLookup) {
        return { valid: true, sessions_students_id: ssLookup.id };
      }
    }
    
    return { 
      valid: false, 
      error: `sessions_students_id ${sessionsStudentsId} not found and cannot be looked up` 
    };
  }
  
  // Try lookup by session_id + student_id if no sessions_students_id provided
  if (sessionId && studentId) {
    const { data: ssLookup } = await supabase
      .from('sessions_students')
      .select('id')
      .eq('session_id', sessionId)
      .eq('student_id', studentId)
      .maybeSingle();
    
    if (ssLookup) {
      return { valid: true, sessions_students_id: ssLookup.id };
    }
  }
  
  return { 
    valid: false, 
    error: 'Missing sessions_students_id and cannot lookup (missing session_id or student_id)' 
  };
}

/**
 * Check if invoice status transition is valid
 * Based on Stripe docs: paid is terminal, but can be changed back to open
 */
export function isValidStatusTransition(
  currentStatus: string,
  newStatus: string
): boolean {
  // Terminal statuses that can't be changed
  const terminalStatuses = ['void'];
  
  if (terminalStatuses.includes(currentStatus)) {
    return false;
  }
  
  // Paid can be changed back to open (per Stripe docs)
  if (currentStatus === 'paid' && newStatus === 'open') {
    return true;
  }
  
  // Don't downgrade from paid to other statuses
  if (currentStatus === 'paid' && newStatus !== 'open') {
    return false;
  }
  
  return true;
}

/**
 * Extract error message safely
 */
export function getErrorMessage(error: any): string {
  if (typeof error === 'string') return error;
  if (error?.message) return error.message;
  return 'Unknown error';
}
