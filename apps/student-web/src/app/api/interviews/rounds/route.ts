import { readInterviewRoundList } from "@altitutor/shared/interviews/server";
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
    const result = await readInterviewRoundList(
      actor.userClient,
      "student",
      new URL(request.url).searchParams,
    );
    return interviewResponse(result.body, result.status);
  } catch (error) {
    return interviewApiError(error);
  }
}
