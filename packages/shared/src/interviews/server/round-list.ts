import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database, Json } from "../../supabase/generated";
import type {
  InterviewRoundHistoryPage,
  InterviewRoundListSnapshot,
} from "../round-list";

type InterviewRoundListRead =
  | {
      status: 200;
      body:
        | Json[]
        | InterviewRoundListSnapshot<Json>
        | InterviewRoundHistoryPage<Json>;
    }
  | { status: 400; body: { error: string } };

const callerViews = {
  tutor: {
    index: "vtutor_interview_round_index",
    summaries: "vtutor_interview_round_summaries",
    rich: "vtutor_interview_rounds",
  },
  student: {
    index: "vstudent_interview_round_index",
    summaries: "vstudent_interview_round_summaries",
    rich: "vstudent_interview_rounds",
  },
} as const;

function indexEntry(row: {
  id: string | null;
  version: number | null;
  phase: string | null;
}) {
  if (row.id === null || row.version === null)
    throw new Error("Invalid interview list index.");
  return { id: row.id, version: row.version, phase: row.phase };
}

/** Read through the already-authorized caller's scoped facades. */
export async function readInterviewRoundList(
  client: SupabaseClient<Database>,
  scope: keyof typeof callerViews,
  params: URLSearchParams,
): Promise<InterviewRoundListRead> {
  const views = callerViews[scope];
  const summary = params.get("summary") === "1";
  const collection = params.get("collection");
  const cursor = params.get("cursor");
  if (collection !== null) {
    if (
      !summary ||
      !["current", "history"].includes(collection) ||
      (cursor !== null &&
        (collection !== "history" ||
          !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(
            cursor,
          )))
    )
      return {
        status: 400,
        body: { error: "Invalid round collection request." },
      };
    if (collection === "history") {
      let query = client
        .from(views.index)
        .select("id,version,phase")
        .eq("phase", "completed")
        .order("id")
        .limit(101);
      if (cursor) query = query.gt("id", cursor);
      const index = await query;
      if (index.error) throw index.error;
      const page = (index.data ?? []).slice(0, 100).map(indexEntry);
      const rows = page.length
        ? await client
            .from(views.summaries)
            .select("data")
            .in(
              "id",
              page.map((row) => row.id),
            )
            .order("id")
        : { data: [], error: null };
      if (rows.error) throw rows.error;
      return {
        status: 200,
        body: {
          rounds: (rows.data ?? []).map((row) => row.data),
          nextCursor:
            (index.data?.length ?? 0) > 100 ? page[page.length - 1]!.id : null,
        },
      };
    }
    // The identity/revision read avoids projecting completed round payloads.
    // Page it as well: PostgREST's row limit must not hide old history.
    const index: Array<{ id: string; version: number; phase: string | null }> =
      [];
    let afterId: string | null = null;
    for (;;) {
      let query = client
        .from(views.index)
        .select("id,version,phase")
        .order("id")
        .limit(500);
      if (afterId) query = query.gt("id", afterId);
      const page = await query;
      if (page.error) throw page.error;
      index.push(...(page.data ?? []).map(indexEntry));
      if ((page.data?.length ?? 0) < 500) break;
      afterId = index[index.length - 1]!.id;
    }
    const ids = index
      .filter((row) => row.phase !== "completed")
      .map((row) => row.id);
    const rounds: Json[] = [];
    for (let start = 0; start < ids.length; start += 100) {
      const page = await client
        .from(views.summaries)
        .select("data")
        .in("id", ids.slice(start, start + 100));
      if (page.error) throw page.error;
      rounds.push(...(page.data ?? []).map((row) => row.data));
    }
    return {
      status: 200,
      body: {
        rounds,
        history: index
          .filter((row) => row.phase === "completed")
          .map(({ id, version }) => ({ id, version })),
      },
    };
  }
  const { data, error } = await client
    .from(summary ? views.summaries : views.rich)
    .select("data");
  if (error) throw error;
  return { status: 200, body: (data ?? []).map((row) => row.data) };
}
