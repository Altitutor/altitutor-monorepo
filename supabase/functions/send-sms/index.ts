// deno-lint-ignore-file no-explicit-any
import 'jsr:@supabase/functions-js/edge-runtime.d.ts';

type SendBody = { messageId: string };

export default async function handler(req: Request) {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: { 'Access-Control-Allow-Origin': '*' } });
  }

  try {
    const { messageId } = (await req.json()) as SendBody;
    if (!messageId) {
      return new Response(JSON.stringify({ error: 'messageId required' }), { status: 400 });
    }
    // Placeholder: integrate Twilio call here
    return new Response(JSON.stringify({ success: true, messageId }), { status: 200 });
  } catch (e: any) {
    return new Response(JSON.stringify({ error: e.message || 'Unknown error' }), { status: 500 });
  }
}


