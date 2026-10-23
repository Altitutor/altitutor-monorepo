import {
  interviewApiError,
  interviewResponse,
  resolveInterviewActor,
} from "@/features/interviews/server/context";
export const dynamic = "force-dynamic";
export async function GET(request: Request) {
  try {
    const actor = await resolveInterviewActor(request);
    if ("response" in actor) return actor.response;
    const { data, error } = await actor.userClient
      .from("vtutor_interview_catalog")
      .select("data")
      .maybeSingle();
    if (error) throw error;
    return data
      ? interviewResponse(data.data)
      : interviewResponse(
          { error: "Medicine interview tutor access required." },
          403,
        );
  } catch (error) {
    return interviewApiError(error);
  }
}
