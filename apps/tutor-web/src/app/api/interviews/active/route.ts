import { interviewApiError, interviewResponse, requireInterviewAccess, resolveInterviewActor } from "@/features/interviews/server/context";
export const dynamic = "force-dynamic";
export async function GET(request: Request) {
  try {
    const actor = await resolveInterviewActor(request);
    if ("response" in actor) return actor.response;
    const denied = await requireInterviewAccess(actor);
    if (denied) return denied;
    const { data: profile, error: profileError } = await actor.userClient.from("vtutor_profile").select("id").maybeSingle();
    if (profileError) throw profileError;
    if (!profile?.id) return interviewResponse([]);
    const { data, error } = await actor.userClient.from("vtutor_interview_rounds")
      .select("id,name:data->name")
      .not("data->>startedAt", "is", null).neq("data->>phase", "completed")
      .contains("data->assignments", JSON.stringify([{ tutorId: profile.id }]))
      .order("id");
    if (error) throw error;
    return interviewResponse((data ?? []).flatMap((round) => typeof round.id === "string" ? [{
      id: round.id, name: typeof round.name === "string" ? round.name : "Mock interview",
      href: `/interviews/rounds/${encodeURIComponent(round.id)}/live`,
    }] : []));
  } catch (error) { return interviewApiError(error); }
}
