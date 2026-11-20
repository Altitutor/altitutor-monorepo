import { interviewApiError, interviewResponse, requireInterviewAccess, resolveInterviewActor } from "@/features/interviews/server/context";
export const dynamic = "force-dynamic";
export async function GET(request: Request) {
  try {
    const actor = await resolveInterviewActor(request);
    if ("response" in actor) return actor.response;
    const denied = await requireInterviewAccess(actor);
    if (denied) return denied;
    const { data, error } = await actor.userClient.from("vstudent_interview_active_rounds")
      .select("id,name")
      .order("id");
    if (error) throw error;
    return interviewResponse((data ?? []).flatMap((round) => typeof round.id === "string" ? [{
      id: round.id, name: typeof round.name === "string" ? round.name : "Mock interview",
      href: `/interviews/rounds/${encodeURIComponent(round.id)}`,
    }] : []));
  } catch (error) { return interviewApiError(error); }
}
