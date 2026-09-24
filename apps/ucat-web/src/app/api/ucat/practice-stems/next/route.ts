import { captureApiError } from "@/lib/sentry/capture-api-error";
import { NextRequest, NextResponse } from "next/server";
import type { Json } from "@altitutor/shared";
import { getSupabaseServerClient } from "@/lib/supabase/server";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { pickStems } from "@/features/practice/server/pick-stems";
import type { PracticeSelectionInput } from "@/features/practice/model/types";
import type { QuestionStemWithQuestions } from "@/features/question-engine/model/types";
import {
  mapStemDetailToQuestionStemWithQuestions,
  type StemDetailRowFromDb,
} from "@/features/practice/lib/map-stem-detail-for-practice";
import {
  getPracticeQuotaStatusForStudent,
  quotaExceededResponse,
} from "@/lib/ucat/quota/quota-service";

type UnlimitedPracticeSessionRow = {
  id: string;
  stems_snapshot: Json | null;
  prefetched_stem_snapshot: Json | null;
  unlimited: boolean;
  completed_at: string | null;
  discarded_at: string | null;
  expired_at: string | null;
  stem_delivery_revision: number;
};

function asStemSnapshot(value: Json | null): QuestionStemWithQuestions | null {
  if (!value || Array.isArray(value) || typeof value !== "object") return null;
  const candidate = value as unknown as QuestionStemWithQuestions;
  return typeof candidate.id === "string" && Array.isArray(candidate.questions)
    ? candidate
    : null;
}

/**
 * Fetches the next stem for unlimited practice mode.
 * Accepts filters + excludeStemIds. Returns 1 stem or null if none left.
 */
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

  let body: {
    input?: PracticeSelectionInput;
    excludeStemIds?: string[];
    practiceSessionId?: string;
    preview?: boolean;
    deliverStemId?: string;
  };
  try {
    body = (await request.json()) as {
      input?: PracticeSelectionInput;
      excludeStemIds?: string[];
      practiceSessionId?: string;
      preview?: boolean;
      deliverStemId?: string;
    };
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const input = body.input;
  const practiceSessionId = body.practiceSessionId;
  const excludeStemIds = body.excludeStemIds ?? [];

  if (!input?.section) {
    return NextResponse.json(
      { error: "A section must be selected." },
      { status: 400 },
    );
  }

  if (!practiceSessionId) {
    return NextResponse.json(
      { error: "Missing practice session id." },
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

  const { data: session, error: sessionError } = await supabaseAdmin
    .from("student_practice_sessions")
    .select(
      "id, stems_snapshot, prefetched_stem_snapshot, unlimited, completed_at, discarded_at, expired_at, stem_delivery_revision",
    )
    .eq("id", practiceSessionId)
    .eq("student_id", student.id)
    .maybeSingle();

  if (sessionError) {
    captureApiError(sessionError, "/api/ucat/practice-stems/next");
    return NextResponse.json({ error: sessionError.message }, { status: 500 });
  }
  const sessionRow = session as unknown as UnlimitedPracticeSessionRow | null;
  if (
    !sessionRow ||
    !sessionRow.unlimited ||
    sessionRow.completed_at ||
    sessionRow.discarded_at ||
    sessionRow.expired_at
  ) {
    return NextResponse.json(
      { error: "Practice session not found" },
      { status: 404 },
    );
  }

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

  const deliveredStems = Array.isArray(sessionRow.stems_snapshot)
    ? (sessionRow.stems_snapshot as unknown as QuestionStemWithQuestions[])
    : [];
  const deliveredStemIds = deliveredStems.map((stem) => stem.id);
  const prefetchedStem = asStemSnapshot(sessionRow.prefetched_stem_snapshot);

  if (body.deliverStemId) {
    const alreadyDelivered = deliveredStems.find(
      (stem) => stem.id === body.deliverStemId,
    );
    if (alreadyDelivered) {
      return NextResponse.json({ stem: alreadyDelivered });
    }

    if (!prefetchedStem || prefetchedStem.id !== body.deliverStemId) {
      return NextResponse.json(
        { error: "Prefetched practice stem is no longer available" },
        { status: 409 },
      );
    }

    const deliveryQuery = supabaseAdmin
      .from("student_practice_sessions")
      .update({
        stems_snapshot: [...deliveredStems, prefetchedStem] as unknown as Json,
        prefetched_stem_snapshot: null,
        last_activity_at: new Date().toISOString(),
        stem_delivery_revision: sessionRow.stem_delivery_revision + 1,
      })
      .eq("id", practiceSessionId)
      .eq("student_id", student.id)
      .eq("stem_delivery_revision", sessionRow.stem_delivery_revision);
    const { data: committed, error: updateError } = await deliveryQuery
      .select("id")
      .maybeSingle();
    if (updateError) {
      captureApiError(updateError, "/api/ucat/practice-stems/next");
      return NextResponse.json({ error: updateError.message }, { status: 500 });
    }
    if (!committed) {
      const { data: currentSession, error: currentSessionError } =
        await supabaseAdmin
          .from("student_practice_sessions")
          .select("stems_snapshot")
          .eq("id", practiceSessionId)
          .eq("student_id", student.id)
          .maybeSingle();
      if (currentSessionError) {
        captureApiError(currentSessionError, "/api/ucat/practice-stems/next");
        return NextResponse.json(
          { error: currentSessionError.message },
          { status: 500 },
        );
      }
      const currentStems = Array.isArray(currentSession?.stems_snapshot)
        ? (currentSession.stems_snapshot as unknown as QuestionStemWithQuestions[])
        : [];
      const concurrentlyDelivered = currentStems.find(
        (currentStem) => currentStem.id === body.deliverStemId,
      );
      if (concurrentlyDelivered) {
        return NextResponse.json({ stem: concurrentlyDelivered });
      }
      return NextResponse.json(
        { error: "Practice stem delivery changed; please retry" },
        { status: 409 },
      );
    }
    return NextResponse.json({ stem: prefetchedStem });
  }

  const excludedIds = new Set([...excludeStemIds, ...deliveredStemIds]);
  if (prefetchedStem && !excludedIds.has(prefetchedStem.id)) {
    if (body.preview) {
      return NextResponse.json({ stem: prefetchedStem });
    }

    const deliveryQuery = supabaseAdmin
      .from("student_practice_sessions")
      .update({
        stems_snapshot: [...deliveredStems, prefetchedStem] as unknown as Json,
        prefetched_stem_snapshot: null,
        last_activity_at: new Date().toISOString(),
        stem_delivery_revision: sessionRow.stem_delivery_revision + 1,
      })
      .eq("id", practiceSessionId)
      .eq("student_id", student.id)
      .eq("stem_delivery_revision", sessionRow.stem_delivery_revision);
    const { data: committed, error: updateError } = await deliveryQuery
      .select("id")
      .maybeSingle();
    if (updateError) {
      captureApiError(updateError, "/api/ucat/practice-stems/next");
      return NextResponse.json({ error: updateError.message }, { status: 500 });
    }
    if (!committed) {
      return NextResponse.json(
        { error: "Practice stem delivery changed; please retry" },
        { status: 409 },
      );
    }
    return NextResponse.json({ stem: prefetchedStem });
  }

  const result = await pickStems(supabase, input, {
    excludeStemIds: Array.from(
      new Set([...excludeStemIds, ...deliveredStemIds]),
    ),
    limitStems: 1,
  });

  if (result.chosenStemIds.length === 0) {
    return NextResponse.json({ stem: null });
  }

  const { data: stemDetails, error: stemDetailsError } = await supabase
    .from("vstudent_ucat_question_stem_delivery")
    .select("id,section_name,display_columns,stem_text,questions")
    .in("id", result.chosenStemIds);

  if (stemDetailsError || !stemDetails?.length) {
    captureApiError(stemDetailsError, "/api/ucat/practice-stems/next");
    return NextResponse.json(
      { error: stemDetailsError?.message ?? "Failed to load stem details" },
      { status: 500 },
    );
  }

  const stemRow = stemDetails[0] as StemDetailRowFromDb;
  const stem = mapStemDetailToQuestionStemWithQuestions(stemRow);

  if (body.preview) {
    const prefetchQuery = supabaseAdmin
      .from("student_practice_sessions")
      .update({
        prefetched_stem_snapshot: stem as unknown as Json,
        last_activity_at: new Date().toISOString(),
        stem_delivery_revision: sessionRow.stem_delivery_revision + 1,
      })
      .eq("id", practiceSessionId)
      .eq("student_id", student.id)
      .eq("stem_delivery_revision", sessionRow.stem_delivery_revision);
    const { data: committed, error: prefetchUpdateError } = await prefetchQuery
      .select("id")
      .maybeSingle();
    if (prefetchUpdateError) {
      captureApiError(prefetchUpdateError, "/api/ucat/practice-stems/next");
      return NextResponse.json(
        { error: prefetchUpdateError.message },
        { status: 500 },
      );
    }
    if (!committed) {
      const { data: currentSession, error: currentSessionError } =
        await supabaseAdmin
          .from("student_practice_sessions")
          .select("prefetched_stem_snapshot")
          .eq("id", practiceSessionId)
          .eq("student_id", student.id)
          .maybeSingle();
      if (currentSessionError) {
        captureApiError(currentSessionError, "/api/ucat/practice-stems/next");
        return NextResponse.json(
          { error: currentSessionError.message },
          { status: 500 },
        );
      }
      const concurrentPrefetch = asStemSnapshot(
        currentSession?.prefetched_stem_snapshot ?? null,
      );
      if (concurrentPrefetch) {
        return NextResponse.json({ stem: concurrentPrefetch });
      }
      return NextResponse.json(
        { error: "Practice stem prefetch changed; please retry" },
        { status: 409 },
      );
    }
    return NextResponse.json({ stem });
  }

  const nextDeliveredStems = [...deliveredStems, stem];
  const commitQuery = supabaseAdmin
    .from("student_practice_sessions")
    .update({
      stems_snapshot: nextDeliveredStems as unknown as Json,
      prefetched_stem_snapshot: null,
      last_activity_at: new Date().toISOString(),
      stem_delivery_revision: sessionRow.stem_delivery_revision + 1,
    })
    .eq("id", practiceSessionId)
    .eq("student_id", student.id)
    .eq("stem_delivery_revision", sessionRow.stem_delivery_revision);
  const { data: committed, error: updateError } = await commitQuery
    .select("id")
    .maybeSingle();

  if (updateError) {
    captureApiError(updateError, "/api/ucat/practice-stems/next");
    return NextResponse.json({ error: updateError.message }, { status: 500 });
  }

  if (!committed) {
    // Another tab/request delivered from the same snapshot first. Return the
    // server winner instead of showing a different question whose membership
    // was never committed to this session.
    const { data: currentSession, error: currentSessionError } =
      await supabaseAdmin
        .from("student_practice_sessions")
        .select("stems_snapshot")
        .eq("id", practiceSessionId)
        .eq("student_id", student.id)
        .maybeSingle();
    if (currentSessionError) {
      captureApiError(currentSessionError, "/api/ucat/practice-stems/next");
      return NextResponse.json(
        { error: currentSessionError.message },
        { status: 500 },
      );
    }
    const currentStems = Array.isArray(currentSession?.stems_snapshot)
      ? (currentSession.stems_snapshot as unknown as QuestionStemWithQuestions[])
      : [];
    const deliveredByConcurrentRequest = currentStems.find(
      (currentStem) => !deliveredStemIds.includes(currentStem.id),
    );
    if (deliveredByConcurrentRequest) {
      return NextResponse.json({ stem: deliveredByConcurrentRequest });
    }
    return NextResponse.json(
      { error: "Practice stem delivery changed; please retry" },
      { status: 409 },
    );
  }

  return NextResponse.json({ stem });
}
