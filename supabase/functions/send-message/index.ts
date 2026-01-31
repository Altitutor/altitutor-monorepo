// @ts-nocheck
// deno-lint-ignore-file no-explicit-any
/**
 * @deprecated This function is deprecated. Use 'send-message' instead.
 * This is kept for backward compatibility and routes to send-message internally.
 */
import 'jsr:@supabase/functions-js/edge-runtime.d.ts';

type SendBody = { messageId: string };

Deno.serve(async (req: Request) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    const acrh = req.headers.get('access-control-request-headers') || '';
    const requestHeaders = (acrh || 'authorization, x-client-info, apikey, content-type, x-supabase-authorization').toLowerCase();
    console.log('[send-sms] CORS preflight (deprecated, routing to send-message)', { acrh });
    return new Response('ok', {
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Headers': requestHeaders,
        'Access-Control-Allow-Methods': 'POST, OPTIONS',
        'Access-Control-Max-Age': '86400',
        'Vary': 'Origin, Access-Control-Request-Headers',
      },
    });
  }

  console.warn('[send-sms] DEPRECATED: This function is deprecated. Use send-message instead.');

  try {
    const body = (await req.json()) as SendBody;
    const messageId = body.messageId;

    if (!messageId) {
      return new Response(
        JSON.stringify({ error: 'messageId required' }),
        {
          status: 400,
          headers: {
            'Content-Type': 'application/json',
            'Access-Control-Allow-Origin': '*',
            'Access-Control-Allow-Headers':
              'content-type, authorization, x-client-info, apikey',
            'Access-Control-Allow-Methods': 'POST, OPTIONS',
          },
        }
      );
    }

    // Route to send-message function
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

    const response = await fetch(`${supabaseUrl}/functions/v1/send-message`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${serviceRoleKey}`,
        'apikey': serviceRoleKey,
      },
      body: JSON.stringify({ messageId }),
    });

    const data = await response.json();

    return new Response(JSON.stringify(data), {
      status: response.status,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Headers':
          'authorization, x-client-info, apikey, content-type, x-supabase-authorization',
        'Access-Control-Allow-Methods': 'POST, OPTIONS',
        'Vary': 'Origin, Access-Control-Request-Headers',
      },
    });
  } catch (e: any) {
    console.error('[send-sms] Error routing to send-message', e?.message || e);
    return new Response(JSON.stringify({ error: e.message || 'Unknown error' }), {
      status: 500,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Headers':
          'authorization, x-client-info, apikey, content-type, x-supabase-authorization',
        'Access-Control-Allow-Methods': 'POST, OPTIONS',
        'Vary': 'Origin, Access-Control-Request-Headers',
      },
    });
  }
});
