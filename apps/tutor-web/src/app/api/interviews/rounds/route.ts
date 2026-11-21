import {
  interviewApiError,
  interviewResponse,
  requireInterviewAccess,
  resolveInterviewActor,
} from "@/features/interviews/server/context";
export const dynamic = "force-dynamic";
export async function GET(request: Request) {
  try {
    const actor = await resolveInterviewActor(request);
    if ("response" in actor) return actor.response;
    const denied = await requireInterviewAccess(actor);
    if (denied) return denied;
    const summary = new URL(request.url).searchParams.get("summary") === "1";
    const { data, error } = await actor.userClient
      .from(summary ? "vtutor_interview_round_summaries" : "vtutor_interview_rounds")
      .select("data");
    if (error) throw error;
    return interviewResponse((data ?? []).map((row) => row.data));
  } catch (error) {
    return interviewApiError(error);
  }
}
