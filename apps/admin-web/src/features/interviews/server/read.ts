import type { InterviewRound } from "@altitutor/shared";
import { createClient } from "@/shared/lib/supabase/server-ssr";
import { getServerSupabaseAdmin } from "@/shared/lib/supabase/server";

export function interviewResponse(body: unknown, status = 200) {
  return Response.json(body, {
    status,
    headers: { "Cache-Control": "private, no-store, max-age=0" },
  });
}

/** Service-role data is only obtained after verifying current, active admin access. */
export async function requireInterviewAdmin() {
  const client = await createClient();
  const {
    data: { user },
    error,
  } = await client.auth.getUser();
  if (error || !user)
    return {
      ok: false as const,
      response: interviewResponse(
        { error: "Sign in to view interviews." },
        401,
      ),
    };
  const access = await client.rpc("is_adminstaff_active");
  if (access.error || access.data !== true)
    return {
      ok: false as const,
      response: interviewResponse(
        { error: "Active administrator access is required." },
        403,
      ),
    };
  return {
    ok: true as const,
    actorId: user.id,
    admin: getServerSupabaseAdmin(),
  };
}

export async function readAdminInterviewRound(roundId: string) {
  const access = await requireInterviewAdmin();
  if (!access.ok) return access;
  if (
    !/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
      roundId,
    )
  )
    return {
      ok: false as const,
      response: interviewResponse({ error: "Invalid interview." }, 400),
    };
  const { data, error } = await access.admin.rpc("interview_media_state", {
    p_round_id: roundId,
  });
  if (error) throw error;
  if (
    !data ||
    typeof data !== "object" ||
    Array.isArray(data) ||
    data.id !== roundId
  )
    return {
      ok: false as const,
      response: interviewResponse({ error: "Interview not found." }, 404),
    };
  return { ...access, round: data as unknown as InterviewRound };
}
