import { deliverOperationalMailboxEmail } from './email.generated.ts';

type OperationalEmail = { subject: string; previewText: string; html: string; text: string; from: string; replyTo: string };
export function operationalMailboxConfigured(): boolean {
  return Boolean((Deno.env.get('EMAIL_M365_TENANT_ID') ?? Deno.env.get('ONBOARDING_M365_TENANT_ID')) &&
    (Deno.env.get('EMAIL_M365_CLIENT_ID') ?? Deno.env.get('ONBOARDING_M365_CLIENT_ID')) &&
    (Deno.env.get('EMAIL_M365_CLIENT_SECRET') ?? Deno.env.get('ONBOARDING_M365_CLIENT_SECRET')));
}
export async function sendOperationalEdgeEmail(input: { to: string[]; email: OperationalEmail; idempotencyKey: string; links: Array<{ type: string; id: string }>; actorStaffId?: string }): Promise<{ providerMessageId: string; state: 'submitted' | 'sent' }> {
  const serviceUrl = Deno.env.get('SUPABASE_URL');
  const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
  if (!serviceUrl || !serviceKey || !operationalMailboxConfigured()) throw new Error('Microsoft mailbox operational delivery is not configured.');
  return deliverOperationalMailboxEmail({ ...input, serviceUrl, serviceKey, getAccessToken: async () => {
    const response = await fetch(`https://login.microsoftonline.com/${encodeURIComponent(Deno.env.get('EMAIL_M365_TENANT_ID') ?? Deno.env.get('ONBOARDING_M365_TENANT_ID')!)}/oauth2/v2.0/token`, {
      method: 'POST', body: new URLSearchParams({
        client_id: Deno.env.get('EMAIL_M365_CLIENT_ID') ?? Deno.env.get('ONBOARDING_M365_CLIENT_ID')!,
        client_secret: Deno.env.get('EMAIL_M365_CLIENT_SECRET') ?? Deno.env.get('ONBOARDING_M365_CLIENT_SECRET')!,
        scope: 'https://graph.microsoft.com/.default', grant_type: 'client_credentials',
      }), signal: AbortSignal.timeout(15_000),
    });
    if (!response.ok) throw new Error(`Microsoft mailbox authorization failed (${response.status}).`);
    const payload: unknown = await response.json();
    if (!payload || typeof payload !== 'object' || !('access_token' in payload) || typeof payload.access_token !== 'string') throw new Error('Microsoft omitted its mailbox access token.');
    return payload.access_token;
  } });
}
