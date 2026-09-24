import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { createClient } from "@/shared/lib/supabase/server-ssr";
import { captureApiError } from "@/lib/sentry/capture-api-error";

const uuid = z.string().uuid();
const requestSchema = z.discriminatedUnion("action", [
  z.object({ action: z.literal("preview"), retained: uuid, source: uuid }),
  z.object({
    action: z.literal("dismiss"),
    a: uuid,
    b: uuid,
    fingerprint: z.string().min(1),
  }),
  z.object({
    action: z.literal("merge"),
    retained: uuid,
    source: uuid,
    fingerprint: z.string().min(1),
    choices: z.object({
      login_user_id: uuid.nullable(),
      billing_student_id: uuid.nullable(),
      fields: z.record(z.enum(["retained", "source"])),
      confirmed_same_person: z.literal(true),
      reviewed_parent_access: z.literal(true),
    }),
  }),
]);

async function adminClient() {
  const client = createClient();
  const {
    data: { user },
    error,
  } = await client.auth.getUser();
  if (error || !user)
    return {
      response: NextResponse.json(
        { error: "Sign in required" },
        { status: 401 },
      ),
    };
  const { data: allowed, error: roleError } = await client.rpc(
    "is_adminstaff_active",
  );
  if (roleError || !allowed)
    return {
      response: NextResponse.json(
        { error: "Active admin access required" },
        { status: 403 },
      ),
    };
  return { client };
}

export async function GET(request: NextRequest) {
  const auth = await adminClient();
  if (auth.response) return auth.response;
  const { client } = auth;
  const params = request.nextUrl.searchParams;
  if (params.has("search")) {
    const term = (params.get("search") ?? "")
      .replace(/[^\p{L}\p{N}@ .-]/gu, "")
      .trim()
      .slice(0, 100);
    if (term.length < 2) return NextResponse.json([]);
    const nameTerm = term.split(/\s+/)[0];
    const { data, error } = await client
      .from("students")
      .select("id,first_name,last_name,email")
      .or(
        `first_name.ilike.%${nameTerm}%,last_name.ilike.%${nameTerm}%,email.ilike.%${term}%`,
      )
      .order("first_name")
      .limit(30);
    if (error)
      return NextResponse.json(
        { error: "Could not search students" },
        { status: 500 },
      );
    return NextResponse.json(data, {
      headers: { "Cache-Control": "no-store" },
    });
  }
  const studentId = params.get("student");
  if (studentId && !uuid.safeParse(studentId).success)
    return NextResponse.json({ error: "Invalid student" }, { status: 400 });
  const { data, error } = await client.rpc(
    "student_duplicate_candidates",
    studentId ? { p_student_id: studentId } : {},
  );
  if (error) {
    captureApiError(error, "/api/student-merges");
    return NextResponse.json(
      { error: "Could not load duplicate candidates" },
      { status: 500 },
    );
  }
  return NextResponse.json(data, { headers: { "Cache-Control": "no-store" } });
}

export async function POST(request: NextRequest) {
  const auth = await adminClient();
  if (auth.response) return auth.response;
  const parsed = requestSchema.safeParse(
    await request.json().catch(() => null),
  );
  if (!parsed.success)
    return NextResponse.json(
      { error: "Invalid merge request" },
      { status: 400 },
    );
  const input = parsed.data;
  const { client } = auth;
  const result =
    input.action === "preview"
      ? await client.rpc("preview_student_merge", {
          p_retained: input.retained,
          p_source: input.source,
        })
      : input.action === "dismiss"
        ? await client.rpc("dismiss_student_duplicate", {
            p_a: input.a,
            p_b: input.b,
            p_fingerprint: input.fingerprint,
          })
        : await client.rpc("merge_students", {
            p_retained: input.retained,
            p_source: input.source,
            p_fingerprint: input.fingerprint,
            p_choices: input.choices,
          });
  if (result.error)
    return NextResponse.json({ error: result.error.message }, { status: 409 });
  return NextResponse.json(result.data);
}
