import { captureApiError } from "@/lib/sentry/capture-api-error";
import { maintainInterviewMedia } from "@altitutor/shared/interviews/server";
import {
  createInterviewServiceClient,
  interviewApiError,
  interviewResponse,
} from "@/features/interviews/server/context";

export const maxDuration = 60;
export const dynamic = "force-dynamic";
export async function GET(request: Request) {
  const secret = process.env.CRON_SECRET;
  if (!secret || request.headers.get("authorization") !== `Bearer ${secret}`)
    return interviewResponse({ error: "Unauthorized" }, 401);
  try {
    const client = createInterviewServiceClient();
    const result = await maintainInterviewMedia(
      client,
      process.env.DAILY_API_KEY,
      {
        deadlineAt: Date.now() + 50_000,
        onFailure: (failure) =>
          captureApiError(
            new Error(failure.message),
            `/api/cron/interview-media/${failure.stage}`,
          ),
      },
    );
    return interviewResponse(result);
  } catch (error) {
    return interviewApiError(error);
  }
}
