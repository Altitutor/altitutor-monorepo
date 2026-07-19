import { NextRequest, NextResponse } from "next/server";
import {
  requireUcatTutor,
  type UcatTutorSupabaseClient,
} from "@/features/ucat/shared/server/guard";

export async function POST(request: NextRequest) {
  const access = await requireUcatTutor();
  if (!access.ok) return access.response;

  const body = (await request.json().catch(() => null)) as {
    targetStemId?: unknown;
    sourceStemId?: unknown;
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
  const { error } = await client.rpc("tutor_ucat_merge_question_stems", {
    p_target_stem_id: body.targetStemId,
    p_source_stem_id: body.sourceStemId,
  });
  if (error)
    return NextResponse.json({ error: error.message }, { status: 400 });

  return NextResponse.json({
    ok: true,
    targetStemId: body.targetStemId,
    sourceStemId: body.sourceStemId,
  });
}
