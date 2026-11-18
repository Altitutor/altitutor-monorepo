import { randomUUID } from 'node:crypto';
import * as Sentry from '@sentry/nextjs';
import { interviewMediaVercelId, type InterviewMediaEvidence } from '@altitutor/shared/interviews/server';

/** Isolation includes the SDK's automatic capture, which happens inside the RPC. */
export function withInterviewMediaEvidence<T>(run: (diagnostic: (evidence: InterviewMediaEvidence) => void) => Promise<T>, request?: Request): Promise<T> {
  let started = false;
  let result: Promise<T> | undefined;
  try {
    const requestId = randomUUID();
    const vercelId = interviewMediaVercelId(request?.headers.get('x-vercel-id'));
    return Sentry.withIsolationScope((scope) => {
      started = true;
      result = run((evidence) => {
        try {
          scope.setContext('interview_media', { ...evidence, requestId, ...(vercelId ? { vercelId } : {}) });
        } catch {
          // Evidence collection cannot alter the action's authorization or response.
        }
      });
      return result;
    });
  } catch (error) {
    // A scope failure after invocation must not replay a provider/DB operation.
    if (result) return result;
    // Preserve a genuine synchronous action failure, including its identity.
    if (started) throw error;
    return run(() => {});
  }
}
