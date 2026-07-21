import { NextRequest, NextResponse } from "next/server";
import { captureApiError } from "@/lib/sentry/capture-api-error";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { getSupabaseServerClient } from "@/lib/supabase/server";
import type {
  UcatContentRatingDescriptor,
  UcatContentRatingReason,
  UcatContentRatingValue,
} from "@/features/content-ratings/types";

const TARGET_TYPES = new Set([
  "answer_explanation",
  "question_insight",
  "attempt_insight",
  "progress_insight",
  "dashboard_insight",
]);
const SURFACES = new Set(["dashboard", "progress", "attempt"]);
const REASONS = new Set<UcatContentRatingReason>([
  "inaccurate",
  "unclear",
  "not_relevant",
  "too_generic",
  "timing_advice_wrong",
  "skips_steps",
  "too_long",
  "other",
]);

function validKey(value: unknown, max: number): value is string {
  return typeof value === "string" && value.length > 0 && value.length <= max;
}

function explanationQuestionId(descriptor: UcatContentRatingDescriptor): string | null {
  if (descriptor.targetType !== "answer_explanation") return null;
  const match = /^question:([0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12})$/i.exec(
    descriptor.targetKey,
  );
  return match?.[1] ?? null;
}

function parseDescriptor(value: unknown): UcatContentRatingDescriptor | null {
  if (!value || typeof value !== "object") return null;
  const item = value as Partial<UcatContentRatingDescriptor>;
  if (
    !TARGET_TYPES.has(item.targetType ?? "") ||
    !SURFACES.has(item.surface ?? "") ||
    !validKey(item.targetKey, 160) ||
    !validKey(item.targetVersion, 40) ||
    !validKey(item.contextKey, 240) ||
    !item.displayedContent ||
    typeof item.displayedContent !== "object" ||
    Array.isArray(item.displayedContent) ||
    JSON.stringify(item.displayedContent).length > 100_000 ||
    Object.values(item.displayedContent).some(
      (entry) => typeof entry !== "string",
    )
  ) {
    return null;
  }
  return item as UcatContentRatingDescriptor;
}

async function authenticatedContext() {
  const supabase = await getSupabaseServerClient();
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();
  if (authError || !user) return { status: "unauthorized" as const };
  if (!supabaseAdmin) return { status: "unconfigured" as const };
  const { data: student, error: studentError } = await supabaseAdmin
    .from("students")
    .select("id")
    .eq("user_id", user.id)
    .maybeSingle();
  if (studentError) {
    captureApiError(studentError, "/api/ucat/content-ratings");
    return { status: "error" as const };
  }
  if (!student) return { status: "not_found" as const };
  return { status: "ok" as const, studentId: student.id };
}

export async function GET(request: NextRequest) {
  const descriptor = parseDescriptor({
    targetType: request.nextUrl.searchParams.get("targetType"),
    targetKey: request.nextUrl.searchParams.get("targetKey"),
    targetVersion: request.nextUrl.searchParams.get("targetVersion"),
    contextKey: request.nextUrl.searchParams.get("contextKey"),
    surface: request.nextUrl.searchParams.get("surface"),
    displayedContent: {},
  });
  if (!descriptor) {
    return NextResponse.json({ error: "Invalid rating identity" }, { status: 400 });
  }
  const context = await authenticatedContext();
  if (context.status === "unauthorized") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  if (context.status === "not_found") {
    return NextResponse.json({ error: "Student not found" }, { status: 404 });
  }
  if (context.status !== "ok" || !supabaseAdmin) {
    return NextResponse.json({ error: "Server not configured" }, { status: 500 });
  }
  const { data, error } = await supabaseAdmin
    .from("student_ucat_content_ratings")
    .select("vote, reason_code, reason_text")
    .eq("student_id", context.studentId)
    .eq("target_type", descriptor.targetType)
    .eq("target_key", descriptor.targetKey)
    .eq("target_version", descriptor.targetVersion)
    .eq("context_key", descriptor.contextKey)
    .is("resolved_at", null)
    .maybeSingle();
  if (error) {
    captureApiError(error, "/api/ucat/content-ratings");
    return NextResponse.json({ error: "Failed to load rating" }, { status: 500 });
  }
  return NextResponse.json({
    rating: data
      ? {
          vote: data.vote,
          reasonCode: data.reason_code,
          reasonText: data.reason_text,
        }
      : null,
  });
}

export async function PUT(request: NextRequest) {
  const body = (await request.json().catch(() => null)) as
    | {
        descriptor?: unknown;
        rating?: Partial<UcatContentRatingValue>;
      }
    | null;
  const descriptor = parseDescriptor(body?.descriptor);
  const vote = body?.rating?.vote;
  const reasonCode = body?.rating?.reasonCode ?? null;
  const reasonText = body?.rating?.reasonText;
  const trimmedReasonText =
    typeof reasonText === "string" ? reasonText.trim() || null : null;
  const questionId = descriptor ? explanationQuestionId(descriptor) : null;
  if (
    !descriptor ||
    (descriptor.targetType === "answer_explanation" && !questionId) ||
    (vote !== -1 && vote !== 1) ||
    (reasonCode !== null && !REASONS.has(reasonCode)) ||
    (reasonText != null && typeof reasonText !== "string") ||
    (trimmedReasonText !== null && trimmedReasonText.length > 1000) ||
    (vote === 1 && (reasonCode !== null || trimmedReasonText !== null))
  ) {
    return NextResponse.json({ error: "Invalid rating" }, { status: 400 });
  }
  const context = await authenticatedContext();
  if (context.status === "unauthorized") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  if (context.status === "not_found") {
    return NextResponse.json({ error: "Student not found" }, { status: 404 });
  }
  if (context.status !== "ok" || !supabaseAdmin) {
    return NextResponse.json({ error: "Server not configured" }, { status: 500 });
  }
  const { data, error } = await supabaseAdmin
    .from("student_ucat_content_ratings")
    .upsert(
      {
        student_id: context.studentId,
        question_id: questionId,
        target_type: descriptor.targetType,
        target_key: descriptor.targetKey,
        target_version: descriptor.targetVersion,
        context_key: descriptor.contextKey,
        surface: descriptor.surface,
        displayed_content: descriptor.displayedContent,
        vote,
        reason_code: vote === -1 ? reasonCode : null,
        reason_text: vote === -1 ? trimmedReasonText : null,
        resolved_at: null,
        resolution_reason: null,
      },
      {
        onConflict:
          "student_id,target_type,target_key,target_version,context_key",
      },
    )
    .select("vote, reason_code, reason_text")
    .single();
  if (error) {
    captureApiError(error, "/api/ucat/content-ratings");
    return NextResponse.json({ error: "Failed to save rating" }, { status: 500 });
  }
  return NextResponse.json({
    rating: {
      vote: data.vote,
      reasonCode: data.reason_code,
      reasonText: data.reason_text,
    },
  });
}
