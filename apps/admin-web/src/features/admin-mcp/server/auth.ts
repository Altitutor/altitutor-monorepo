import type { AuthInfo } from "@modelcontextprotocol/sdk/server/auth/types.js";
import { createClient } from "@supabase/supabase-js";
import type { Database } from "@altitutor/shared";

export function createAdminMcpClient(token: string) {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !key) throw new Error("Supabase is not configured.");
  return createClient<Database>(url, key, {
    global: { headers: { Authorization: `Bearer ${token}` } },
    auth: {
      persistSession: false,
      autoRefreshToken: false,
      detectSessionInUrl: false,
    },
  });
}

export async function verifyAdminMcpToken(
  _request: Request,
  token?: string,
): Promise<AuthInfo | undefined> {
  if (!token) return undefined;
  try {
    const claims: {
      sub?: string;
      client_id?: string;
      iss?: string;
      aud?: string | string[];
    } = JSON.parse(Buffer.from(token.split(".")[1], "base64url").toString());
    if (
      !claims.sub ||
      !claims.client_id ||
      claims.iss !==
        `${process.env.NEXT_PUBLIC_SUPABASE_URL?.replace(/\/$/, "")}/auth/v1` ||
      !(Array.isArray(claims.aud)
        ? claims.aud.includes("authenticated")
        : claims.aud === "authenticated")
    )
      return undefined;
    const client = createAdminMcpClient(token);
    const [user, access] = await Promise.all([
      client.auth.getUser(token),
      client.rpc("has_admin_mcp_access"),
    ]);
    if (
      user.error ||
      user.data.user?.id !== claims.sub ||
      access.error ||
      access.data !== true
    )
      return undefined;
    return {
      token,
      clientId: claims.client_id,
      scopes: ["admin:read", "admin:operations"],
      extra: { userId: claims.sub },
    };
  } catch {
    return undefined;
  }
}
