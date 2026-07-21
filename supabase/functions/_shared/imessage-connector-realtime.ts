import { createClient } from "jsr:@supabase/supabase-js@2";
import type { SupabaseClient } from "jsr:@supabase/supabase-js@2";

export const IMESSAGE_CONNECTOR_WAKE_TOPIC = "imessage:connector:wake";
export const IMESSAGE_CONNECTOR_REALTIME_SESSION_TTL_SECONDS = 15 * 60;

function connectorRealtimeEmail(connectorId: string): string {
  const safe = connectorId.toLowerCase().replace(/[^a-z0-9._-]/g, "-");
  return `imessage-connector+${safe}@internal.altitutor.invalid`;
}

export async function connectorRealtimePassword(
  secret: string,
  connectorId: string,
): Promise<string> {
  const material = new TextEncoder().encode(
    `imessage-realtime-v1:${secret}:${connectorId}`,
  );
  const digest = await crypto.subtle.digest("SHA-256", material);
  return Array.from(new Uint8Array(digest), (byte) =>
    byte.toString(16).padStart(2, "0")
  ).join("");
}

async function findUserIdByEmail(
  admin: SupabaseClient,
  email: string,
): Promise<string | null> {
  let page = 1;
  for (;;) {
    const { data, error } = await admin.auth.admin.listUsers({
      page,
      perPage: 200,
    });
    if (error) throw error;
    const match = data.users.find((user) =>
      (user.email ?? "").toLowerCase() === email.toLowerCase()
    );
    if (match?.id) return match.id;
    if (data.users.length < 200) return null;
    page += 1;
    if (page > 50) return null;
  }
}

export async function ensureConnectorRealtimeUser(
  admin: SupabaseClient,
  connectorId: string,
  secret: string,
): Promise<{ email: string; password: string; userId: string }> {
  const email = connectorRealtimeEmail(connectorId);
  const password = await connectorRealtimePassword(secret, connectorId);
  const appMetadata = {
    imessage_connector: true,
    connector_id: connectorId,
  };

  const { data, error } = await admin.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
    app_metadata: appMetadata,
  });
  if (!error && data.user?.id) {
    return { email, password, userId: data.user.id };
  }

  const existingId = await findUserIdByEmail(admin, email);
  if (!existingId) {
    throw error ?? new Error("Failed to create connector realtime user");
  }
  const { error: updateError } = await admin.auth.admin.updateUserById(
    existingId,
    {
      password,
      email_confirm: true,
      app_metadata: appMetadata,
    },
  );
  if (updateError) throw updateError;
  return { email, password, userId: existingId };
}

export async function issueConnectorRealtimeSession(args: {
  admin: SupabaseClient;
  connectorId: string;
  secret: string;
  supabaseUrl: string;
  anonKey: string;
}): Promise<{
  accessToken: string;
  refreshToken: string | null;
  expiresAt: number | null;
  expiresIn: number;
  topic: string;
  supabaseUrl: string;
  anonKey: string;
}> {
  const { email, password } = await ensureConnectorRealtimeUser(
    args.admin,
    args.connectorId,
    args.secret,
  );

  const authClient = createClient(args.supabaseUrl, args.anonKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const { data, error } = await authClient.auth.signInWithPassword({
    email,
    password,
  });
  if (error || !data.session?.access_token) {
    throw new Error(
      error?.message ?? "Failed to issue connector realtime session",
    );
  }

  return {
    accessToken: data.session.access_token,
    refreshToken: data.session.refresh_token ?? null,
    expiresAt: data.session.expires_at ?? null,
    expiresIn: data.session.expires_in ??
      IMESSAGE_CONNECTOR_REALTIME_SESSION_TTL_SECONDS,
    topic: IMESSAGE_CONNECTOR_WAKE_TOPIC,
    supabaseUrl: args.supabaseUrl,
    anonKey: args.anonKey,
  };
}
