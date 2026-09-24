import { NextRequest, NextResponse } from "next/server";
import {
  requireUcatTutor,
  type UcatTutorSupabaseClient,
} from "@/features/ucat/shared/server/guard";
import { jsonUcatPublishedContentErrorResponse } from "@/features/ucat/shared/server/delete-blocked-response";

export async function POST(request: NextRequest) {
  const access = await requireUcatTutor();
  if (!access.ok) return access.response;

  const body = (await request.json().catch(() => null)) as {
    targetStemId?: unknown;
    sourceStemId?: unknown;
    similarityThreshold?: unknown;
  } | null;
  if (
    typeof body?.targetStemId !== "string" ||
    typeof body.sourceStemId !== "string" ||
    body.targetStemId === body.sourceStemId
  ) {
    return NextResponse.json(
      { error: "Two different question stem IDs are required." },
      { status: 400 },
    );
  }

  const client = access.userClient as unknown as UcatTutorSupabaseClient;
  const parsedThreshold = Number(body.similarityThreshold);
  const minimumSimilarity = Number.isFinite(parsedThreshold)
    ? Math.min(Math.max(parsedThreshold, 0.8), 1)
    : 0.95;
  const { error } = await client.rpc("tutor_ucat_merge_duplicate_stem_pair", {
    p_target_stem_id: body.targetStemId,
    p_source_stem_id: body.sourceStemId,
    p_minimum_similarity: minimumSimilarity,
  });
  if (error) {
    const published = jsonUcatPublishedContentErrorResponse(error.message);
    if (published) return published;
    return NextResponse.json({ error: error.message }, { status: 400 });
  }

  return NextResponse.json({
    ok: true,
    targetStemId: body.targetStemId,
    sourceStemId: body.sourceStemId,
  });
}
