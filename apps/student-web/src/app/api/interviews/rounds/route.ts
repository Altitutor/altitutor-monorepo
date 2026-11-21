import {
  interviewApiError,
  interviewResponse,
  requireInterviewAccess,
  resolveInterviewActor,
} from "@/features/interviews/server/context";
function indexEntry(row: { id: string | null; version: number | null; phase: string | null }) {
  if (row.id === null || row.version === null) throw new Error("Invalid interview list index.");
  return { id: row.id, version: row.version, phase: row.phase };
}
export const dynamic = "force-dynamic";
export async function GET(request: Request) {
  try {
    const actor = await resolveInterviewActor(request);
    if ("response" in actor) return actor.response;
    const denied = await requireInterviewAccess(actor);
    if (denied) return denied;
    const params = new URL(request.url).searchParams;
    const summary = params.get("summary") === "1";
    const collection = params.get("collection");
    const cursor = params.get("cursor");
    if (collection !== null) {
      if (!summary || !["current", "history"].includes(collection) ||
        (cursor !== null && (collection !== "history" || !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(cursor))))
        return interviewResponse({ error: "Invalid round collection request." }, 400);
      if (collection === "history") {
        let query = actor.userClient.from("vstudent_interview_round_index")
          .select("id,version,phase").eq("phase", "completed").order("id").limit(101);
        if (cursor) query = query.gt("id", cursor);
        const index = await query;
        if (index.error) throw index.error;
        const page = (index.data ?? []).slice(0, 100).map(indexEntry);
        const rows = page.length ? await actor.userClient.from("vstudent_interview_round_summaries")
          .select("data").in("id", page.map((row) => row.id)).order("id") : { data: [], error: null };
        if (rows.error) throw rows.error;
        return interviewResponse({
          rounds: (rows.data ?? []).map((row) => row.data),
          nextCursor: (index.data?.length ?? 0) > 100 ? page[page.length - 1]!.id : null,
        });
      }
      // The identity/revision read avoids projecting completed round payloads.
      // Page it as well: PostgREST's row limit must not hide old history.
      const index: Array<{ id: string; version: number; phase: string | null }> = [];
      let afterId: string | null = null;
      for (;;) {
        let query = actor.userClient.from("vstudent_interview_round_index")
          .select("id,version,phase").order("id").limit(500);
        if (afterId) query = query.gt("id", afterId);
        const page = await query;
        if (page.error) throw page.error;
        index.push(...(page.data ?? []).map(indexEntry));
        if ((page.data?.length ?? 0) < 500) break;
        afterId = index[index.length - 1]!.id;
      }
      const ids = index.filter((row) => row.phase !== "completed").map((row) => row.id);
      const rounds: unknown[] = [];
      for (let start = 0; start < ids.length; start += 100) {
        const page = await actor.userClient.from("vstudent_interview_round_summaries").select("data")
          .in("id", ids.slice(start, start + 100));
        if (page.error) throw page.error;
        rounds.push(...(page.data ?? []).map((row) => row.data));
      }
      return interviewResponse({
        rounds,
        history: index.filter((row) => row.phase === "completed").map(({ id, version }) => ({ id, version })),
      });
    }
    const { data, error } = await actor.userClient
      .from(summary ? "vstudent_interview_round_summaries" : "vstudent_interview_rounds")
      .select("data");
    if (error) throw error;
    return interviewResponse((data ?? []).map((row) => row.data));
  } catch (error) {
    return interviewApiError(error);
  }
}
