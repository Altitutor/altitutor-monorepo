import {
  interviewApiError,
  interviewResponse,
  requireInterviewAccess,
  resolveInterviewActor,
} from "@/features/interviews/server/context";
export const dynamic = "force-dynamic";
export async function GET(
  request: Request,
  { params }: { params: { roundId: string } },
) {
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
