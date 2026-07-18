import { captureApiError } from "@/lib/sentry/capture-api-error";
import { NextRequest, NextResponse } from "next/server";
import { getSupabaseServerClient } from "@/lib/supabase/server";
import { supabaseAdmin } from "@/lib/supabase/admin";
import type { QuestionStemWithQuestions } from "@/features/question-engine/model/types";
import type { PracticeSelectionInput } from "@/features/practice/model/types";
import {
  checkPracticeStartQuota,
  getPracticeQuotaStatusForStudent,
  quotaExceededResponse,
} from "@/lib/ucat/quota/quota-service";
import { QuotaExceededError } from "@/lib/ucat/quota/parse-quota-error";
import {
  preparePracticeStems,
  PracticeStemSelectionError,
} from "@/features/practice/server/prepare-practice-stems";

export async function POST(request: NextRequest) {
  const supabase = await getSupabaseServerClient();

  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();

  if (authError) {
    return NextResponse.json({ error: "Failed to get user" }, { status: 500 });
  }

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  if (!supabaseAdmin) {
    return NextResponse.json(
      { error: "Server write client not configured" },
      { status: 500 },
    );
  }

  const body = (await request.json()) as {
    sectionKey: string;
    ucatSectionId: string;
    filtersSnapshot?: unknown;
    stemsSnapshot?: unknown;
    unlimited?: boolean;
  };

  if (!body.sectionKey || !body.ucatSectionId) {
    return NextResponse.json(
      { error: "Missing required fields: sectionKey, ucatSectionId" },
      { status: 400 },
    );
  }

  const { data: student, error: studentError } = await supabaseAdmin
    .from("students")
    .select("id")
    .eq("user_id", user.id)
    .maybeSingle();

  if (studentError) {
    return NextResponse.json(
      { error: "Failed to resolve student" },
      { status: 500 },
    );
  }

  if (!student) {
    return NextResponse.json(
      { error: "No student profile found" },
      { status: 404 },
    );
  }

  let prepared: Awaited<ReturnType<typeof preparePracticeStems>> | undefined;
  if (!body.unlimited && !Array.isArray(body.stemsSnapshot)) {
    if (!body.filtersSnapshot || typeof body.filtersSnapshot !== "object") {
      return NextResponse.json(
        { error: "Missing practice filters" },
        { status: 400 },
      );
    }
    try {
      prepared = await preparePracticeStems({
        reader: supabase,
        admin: supabaseAdmin,
        studentId: student.id,
        input: body.filtersSnapshot as PracticeSelectionInput,
      });
      body.stemsSnapshot = prepared.stems;
    } catch (error) {
      captureApiError(error, "/api/ucat/practice-sessions");
      if (error instanceof QuotaExceededError) {
        return quotaExceededResponse(error.payload);
      }
      if (error instanceof PracticeStemSelectionError) {
        return NextResponse.json({ error: error.message }, { status: 400 });
      }
      return NextResponse.json(
        {
          error:
            error instanceof Error
              ? error.message
              : "Failed to prepare practice session",
        },
        { status: 500 },
      );
    }
  }

  if (body.unlimited) {
    const status = await getPracticeQuotaStatusForStudent(
      supabaseAdmin,
      student.id,
    );
    if (
      status &&
      !status.isQuotaExempt &&
      (status.limit === 0 || status.remaining === 0)
    ) {
      return quotaExceededResponse({
        code: "QUOTA_EXCEEDED",
        area: "practice",
        used: status.used,
        limit: status.limit,
        period: status.period,
      });
    }
  } else if (!prepared) {
    const stems = Array.isArray(body.stemsSnapshot)
      ? (body.stemsSnapshot as QuestionStemWithQuestions[])
      : [];
    const questionIds = stems.flatMap((stem) =>
      Array.isArray(stem.questions)
        ? stem.questions.map((question) => question.id)
        : [],
    );
    const quotaCheck = await checkPracticeStartQuota(
      supabaseAdmin,
      student.id,
      questionIds,
    );
    if (!quotaCheck.allowed) {
      return quotaExceededResponse(quotaCheck.payload);
    }
  }

  const insertPayload = {
    student_id: student.id,
    ucat_section_id: body.ucatSectionId,
    section_key: body.sectionKey,
    filters_snapshot: body.filtersSnapshot ?? null,
    stems_snapshot: body.stemsSnapshot ?? null,
    unlimited: body.unlimited ?? false,
  };

  const { data: inserted, error: insertError } = await (
    supabaseAdmin! as {
      from: (
        t: string,
      ) => ReturnType<NonNullable<typeof supabaseAdmin>["from"]>;
    }
  )
    .from("student_practice_sessions")
    .insert(insertPayload)
    .select("id")
    .maybeSingle();

  if (insertError || !inserted) {
    captureApiError(insertError, "/api/ucat/practice-sessions");
    return NextResponse.json(
      { error: insertError?.message ?? "Failed to create practice session" },
      { status: 500 },
    );
  }

  const insertedData = inserted as { id?: string };
  return NextResponse.json({
    id: insertedData.id ?? "",
    ...(prepared ?? {}),
  });
}
