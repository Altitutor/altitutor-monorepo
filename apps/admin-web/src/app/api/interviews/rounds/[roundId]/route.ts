import { captureApiError } from "@/lib/sentry/capture-api-error";
import {
  interviewResponse,
  readAdminInterviewRound,
} from "@/features/interviews/server/read";
export async function GET(
  _request: Request,
  { params }: { params: Promise<{ roundId: string }> },
) {
  try {
    const access = await readAdminInterviewRound((await params).roundId);
    return access.ok ? interviewResponse(access.round) : access.response;
  } catch (error) {
    captureApiError(error, "/api/interviews/rounds/[roundId]");
    return interviewResponse(
      { error: "Unable to load the interview. Try again." },
      500,
    );
  }
}
