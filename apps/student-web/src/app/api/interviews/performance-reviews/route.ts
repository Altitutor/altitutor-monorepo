import { z } from "zod";
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
    const id = new URL(request.url).searchParams.get("id");
    if (id !== null) {
      if (!z.guid().safeParse(id).success) return interviewResponse({ error: "Review unavailable." }, 404);
      const { data, error } = await actor.userClient.from("vstudent_interview_performance_reviews")
        .select("data").eq("id", id).maybeSingle();
      if (error) throw error;
      return data ? interviewResponse(data.data) : interviewResponse({ error: "Review unavailable." }, 404);
    }
    const { data, error } = await actor.userClient.from("vstudent_interview_performance_reviews").select("summary");
    if (error) throw error;
    return interviewResponse((data ?? []).map((row) => row.summary));
  } catch (error) {
    return interviewApiError(error);
  }
}
