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
    const { data, error } = await actor.userClient
      .from("vtutor_interview_rounds")
      .select("data");
    if (error) throw error;
    return interviewResponse((data ?? []).map((row) => row.data));
  } catch (error) {
    return interviewApiError(error);
  }
}
