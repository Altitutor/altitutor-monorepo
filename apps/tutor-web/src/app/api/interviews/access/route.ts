import {
  hasInterviewAccess,
  interviewApiError,
  interviewResponse,
  resolveInterviewActor,
} from "@/features/interviews/server/context";
export const dynamic = "force-dynamic";
export async function GET(request: Request) {
  try {
    const actor = await resolveInterviewActor(request);
    if ("response" in actor) return actor.response;
    return interviewResponse({ hasAccess: await hasInterviewAccess(actor) });
  } catch (error) {
    return interviewApiError(error);
  }
}
