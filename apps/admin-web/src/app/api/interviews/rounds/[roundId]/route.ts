import { captureApiError } from "@/lib/sentry/capture-api-error";
import {
  interviewResponse,
  readAdminInterviewRound,
  readAdminInterviewObserver,
} from "@/features/interviews/server/read";
export async function GET(
  request: Request,
  { params }: { params: Promise<{ roundId: string }> },
) {
  try {
    const { roundId } = await params;
    const search = new URL(request.url).searchParams;
    if (search.get("observer") === "1") {
      const access = await readAdminInterviewObserver(
        roundId,
        search.get("stationId"),
        search.get("contentRevision"),
      );
      return access.ok ? interviewResponse(access.observer) : access.response;
    }
    const access = await readAdminInterviewRound(roundId);
    return access.ok ? interviewResponse(access.round) : access.response;
  } catch (error) {
    captureApiError(error, "/api/interviews/rounds/[roundId]");
    return interviewResponse(
      { error: "Unable to load the interview. Try again." },
      500,
    );
  }
}
