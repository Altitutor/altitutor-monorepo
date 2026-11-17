import { interviewApiError, interviewResponse, requireInterviewAccess, resolveInterviewActor } from "@/features/interviews/server/context";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  try {
    const actor = await resolveInterviewActor(request);
    if ("response" in actor) return actor.response;
    const denied = await requireInterviewAccess(actor);
    if (denied) return denied;
    const students = [];
    const size = 250;
    for (let start = 0; ; start += size) {
      const { data, error } = await actor.userClient.from("vtutor_interview_performance_review_students")
        .select("id,name,details").order("id").range(start, start + size - 1);
      if (error) throw error;
      students.push(...(data ?? []));
      if (!data || data.length < size) break;
    }
    return interviewResponse(students.map(({ id, name, details }) => ({
      id, name, ...(details && typeof details === "object" && !Array.isArray(details) ? details : {}),
    })));
  } catch (error) { return interviewApiError(error); }
}
