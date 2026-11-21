import {
  interviewApiError,
  interviewResponse,
  requireInterviewAccess,
  resolveInterviewActor,
} from "@/features/interviews/server/context";
export const dynamic = "force-dynamic";
export async function GET(request: Request, props: { params: Promise<{ roundId: string }> }) {
  const params = await props.params;
  try {
    const actor = await resolveInterviewActor(request);
    if ("response" in actor) return actor.response;
    const denied = await requireInterviewAccess(actor);
    if (denied) return denied;
    if (
      !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(
        params.roundId,
      )
    )
      return interviewResponse({ error: "Invalid interview round." }, 400);
    const url = new URL(request.url);
    if (url.searchParams.get("live") === "1") {
      const revision = url.searchParams.get("contentRevision");
      if (revision !== null && !/^[0-9a-f]{32}$/.test(revision))
        return interviewResponse({ error: "Invalid interview content revision." }, 400);
      const read = async (includeStations: boolean) => {
        const view = actor.userClient.from("vtutor_interview_live_rounds");
        const { data, error } = includeStations
          ? await view.select("id,actor_id,content_revision,data,stations").eq("id", params.roundId).maybeSingle()
          : await view.select("id,actor_id,content_revision,data").eq("id", params.roundId).maybeSingle();
        if (error) throw error;
        return data;
      };
      let live = await read(revision === null);
      if (live && revision !== null && revision !== live.content_revision) {
        // A second read supplies both state and content from its own snapshot.
        // Never combine the first read with content fetched after a rotation,
        // rubric update, deletion or access revocation.
        live = await read(true);
      }
      if (!live) return interviewResponse({ error: "Interview not found or access has ended." }, 404);
      return interviewResponse({
        actorId: live.actor_id,
        contentRevision: live.content_revision,
        round: live.data,
        stations: "stations" in live ? live.stations : null,
      });
    }
    const { data, error } = await actor.userClient
      .from("vtutor_interview_rounds")
      .select("data")
      .eq("id", params.roundId)
      .maybeSingle();
    if (error) throw error;
    return data
      ? interviewResponse(data.data)
      : interviewResponse(
          { error: "Interview not found or access has ended." },
          404,
        );
  } catch (error) {
    return interviewApiError(error);
  }
}
