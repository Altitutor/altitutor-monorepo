import { NextResponse } from "next/server";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@altitutor/shared";
import { createClient as createCookieClient } from "@/shared/lib/supabase/server-ssr";
import { instrumentSupabaseClient } from "@/lib/sentry/instrument-supabase-client";
import { captureApiError } from "@/lib/sentry/capture-api-error";

export const INTERVIEW_PRIVATE_HEADERS = {
  "Cache-Control": "private, no-store, max-age=0",
};
export function interviewResponse(body: unknown, status = 200) {
  return NextResponse.json(body, {
    status,
    headers: INTERVIEW_PRIVATE_HEADERS,
  });
}
export interface InterviewActor {
  userId: string;
  userClient: SupabaseClient<Database>;
}

export async function resolveInterviewActor(
  request: Request,
): Promise<InterviewActor | { response: NextResponse }> {
  const token = request.headers
    .get("authorization")
    ?.match(/^Bearer\s+(\S+)$/i)?.[1];
  const userClient = token
    ? instrumentSupabaseClient(
        createClient<Database>(
          process.env.NEXT_PUBLIC_SUPABASE_URL!,
          process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
          {
            global: {
              headers: { Authorization: `Bearer ${token}` },
              fetch: (input, init) =>
                fetch(input, { ...init, cache: "no-store" }),
            },
            auth: {
              persistSession: false,
              autoRefreshToken: false,
              detectSessionInUrl: false,
            },
          },
        ),
      )
    : createCookieClient();
  const {
    data: { user },
    error,
  } = await userClient.auth.getUser();
  if (error || !user)
    return {
      response: interviewResponse(
        { error: "Sign in to access interviews." },
        401,
      ),
    };
  return { userClient, userId: user.id };
}

export function createInterviewServiceClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) throw new Error("Missing interview server configuration");
  return instrumentSupabaseClient(
    createClient<Database>(url, key, {
      global: {
        fetch: (input, init) => fetch(input, { ...init, cache: "no-store" }),
      },
      auth: { persistSession: false, autoRefreshToken: false },
    }),
  );
}

export function interviewApiError(error: unknown) {
  const code =
    error && typeof error === "object" && "code" in error
      ? String(error.code)
      : "";
  const message =
    error && typeof error === "object" && "message" in error
      ? String(error.message)
      : "";
  const status =
    code === "42501"
      ? 403
      : code === "P0002"
        ? 404
        : code === "PT409" || code === "40001" || code === "23505"
          ? 409
          : ["22023", "22P02", "23514", "23503", "23502"].includes(code)
            ? 400
            : 500;
  if (status === 500) captureApiError(error, "/api/interviews");
  return interviewResponse(
    {
      error:
        status === 500
          ? "Unable to process interviews. Please try again."
          : message || "Interview request rejected.",
    },
    status,
  );
}

export async function hasInterviewAccess(
  actor: InterviewActor,
): Promise<boolean> {
  const { data, error } = await actor.userClient
    .from("vtutor_interview_access")
    .select("has_access")
    .maybeSingle();
  if (error) throw error;
  return data?.has_access === true;
}

export async function requireInterviewAccess(actor: InterviewActor) {
  return (await hasInterviewAccess(actor))
    ? null
    : interviewResponse(
        { error: "Active Medicine interview access is required." },
        403,
      );
}

export { readInterviewCommandBody } from "@altitutor/shared/interviews/server";
