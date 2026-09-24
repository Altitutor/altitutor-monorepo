import { captureApiError } from '@/lib/sentry/capture-api-error';
import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import type { Json } from '@altitutor/shared';
import { createClient } from '@/shared/lib/supabase/server-ssr';
import { supabaseAdmin } from '@/shared/lib/supabase/server/admin';
import {
  completeCodexDeviceFlow,
  deriveAccountId,
  encryptSecret,
} from '@/features/ucat-generation-settings/server/codex-oauth';

export const dynamic = 'force-dynamic';

const CompleteBodySchema = z.object({
  deviceAuthId: z.string().min(1),
  userCode: z.string().min(1),
  providerName: z.string().trim().min(1).max(80).default('ChatGPT/Codex subscription'),
  accountLabel: z.string().trim().max(80).optional(),
  modelName: z.string().trim().min(1).max(80).default('Codex subscription default'),
  model: z.string().trim().min(1).max(120).default('gpt-5.3-codex'),
});

type SupabaseAny = NonNullable<typeof supabaseAdmin> & {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  from: (table: string) => any;
};

async function requireAdminStaff() {
  const userClient = createClient();
  const { data: { user }, error: userError } = await userClient.auth.getUser();
  if (userError || !user) {
    return { ok: false as const, response: NextResponse.json({ error: 'Unauthorized' }, { status: 401 }) };
  }

  const { data: staff, error: staffError } = await userClient
    .from('staff')
    .select('id, role, status')
    .eq('user_id', user.id)
    .maybeSingle<{ id: string; role: string | null; status: string | null }>();

  if (staffError) {
    return { ok: false as const, response: NextResponse.json({ error: 'Failed to verify admin access' }, { status: 500 }) };
  }

  if (!staff || staff.role !== 'ADMINSTAFF' || staff.status !== 'ACTIVE') {
    return { ok: false as const, response: NextResponse.json({ error: 'Forbidden' }, { status: 403 }) };
  }

  return { ok: true as const, staffId: staff.id };
}

export async function POST(request: NextRequest) {
  const access = await requireAdminStaff();
  if (!access.ok) return access.response;
  if (!supabaseAdmin) {
    return NextResponse.json({ error: 'Server configuration error' }, { status: 500 });
  }

  let body: z.infer<typeof CompleteBodySchema>;
  try {
    body = CompleteBodySchema.parse(await request.json());
  } catch (error) {
    return NextResponse.json(
      { error: 'Invalid Codex OAuth completion payload', details: error instanceof Error ? error.message : undefined },
      { status: 400 },
    );
  }

  try {
    const tokens = await completeCodexDeviceFlow({
      deviceAuthId: body.deviceAuthId,
      userCode: body.userCode,
    });

    if (!tokens) {
      return NextResponse.json({ status: 'pending' });
    }

    const accountId = deriveAccountId(tokens);
    if (!accountId) {
      return NextResponse.json({ error: 'OpenAI account id was not present in the OAuth token' }, { status: 400 });
    }

    const admin = supabaseAdmin as SupabaseAny;
    const providerKey = `codex_oauth_${accountId.replace(/[^a-zA-Z0-9_-]/g, '_')}`;
    const { data: provider, error: providerError } = await admin
      .from('ucat_ai_generation_providers')
      .upsert(
        {
          name: body.providerName,
          provider_key: providerKey,
          provider_kind: 'codex_oauth',
          base_url: 'https://chatgpt.com/backend-api/codex',
          secret_env_var_name: 'UCAT_CODEX_OAUTH_ENCRYPTION_KEY',
          default_headers: {},
          is_enabled: true,
          updated_by: access.staffId,
          created_by: access.staffId,
        },
        { onConflict: 'provider_key' },
      )
      .select('id,name')
      .single();

    if (providerError || !provider) throw providerError ?? new Error('Failed to save Codex provider');

    const encryptedAccount = {
      provider_id: provider.id,
      label: body.accountLabel?.trim() || body.providerName,
      account_id: accountId,
      access_token_ciphertext: encryptSecret(tokens.accessToken) as unknown as Json,
      refresh_token_ciphertext: tokens.refreshToken ? (encryptSecret(tokens.refreshToken) as unknown as Json) : null,
      id_token_ciphertext: tokens.idToken ? (encryptSecret(tokens.idToken) as unknown as Json) : null,
      expires_at: tokens.expiresAt ? new Date(tokens.expiresAt).toISOString() : null,
      status: 'connected',
      last_error: null,
      metadata: { source: 'admin-device-flow' } as Json,
      updated_by: access.staffId,
      created_by: access.staffId,
    };

    const { data: oauthAccount, error: accountError } = await admin
      .from('ucat_ai_generation_oauth_accounts')
      .upsert(encryptedAccount, { onConflict: 'provider_id' })
      .select('id,label,account_id,expires_at,status')
      .single();

    if (accountError || !oauthAccount) throw accountError ?? new Error('Failed to save Codex OAuth account');

    const { data: existingModel, error: existingModelError } = await admin
      .from('ucat_ai_generation_model_profiles')
      .select('id')
      .eq('provider_id', provider.id)
      .limit(1)
      .maybeSingle();

    if (existingModelError) throw existingModelError;

    if (!existingModel) {
      const { error: modelError } = await admin
        .from('ucat_ai_generation_model_profiles')
        .insert({
          name: body.modelName,
          provider_id: provider.id,
          model: body.model,
          temperature: 0.8,
          max_completion_tokens: 6000,
          is_enabled: true,
          is_default: false,
          created_by: access.staffId,
          updated_by: access.staffId,
        });
      if (modelError) throw modelError;
    }

    return NextResponse.json({
      status: 'connected',
      provider,
      oauthAccount,
      modelCreated: !existingModel,
    });
  } catch (error) {
    captureApiError(error, "/api/ucat-generation/codex-oauth/complete");
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to complete Codex OAuth' },
      { status: 500 },
    );
  }
}
