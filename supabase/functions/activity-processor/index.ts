import 'jsr:@supabase/functions-js/edge-runtime.d.ts';
import { createClient } from 'jsr:@supabase/supabase-js@2';
import { serveWithSentry } from '../_shared/sentry.ts';
import { processExecution } from './execution.ts';
import { corsHeaders, json } from './utils.ts';

type ProcessBody = { execution_id?: string };

serveWithSentry('activity-processor', async (req: Request, sentry) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });

  try {
    const body = (await req.json()) as ProcessBody;
    if (!body.execution_id) return json({ error: 'execution_id required' }, 400);
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
      { auth: { persistSession: false } }
    );
    const result = await processExecution(supabase, body.execution_id);
    return json({ processed: true, executions: [result] });
  } catch (error: unknown) {
    sentry.captureException(error);
    const message = error instanceof Error ? error.message : 'Unknown error';
    console.error('[activity-processor] Error', message);
    return json({ error: message }, 500);
  }
});
