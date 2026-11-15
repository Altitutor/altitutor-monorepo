import { createInterviewMediaHandlers } from '@altitutor/shared/interviews/server';
import { withInterviewMediaEvidence } from './media-evidence';
import { resolveInterviewActor, createInterviewServiceClient, interviewApiError } from './context';

const dependencies = {
  role: 'tutor', resolveActor: resolveInterviewActor, serviceClient: createInterviewServiceClient,
  apiKey: () => process.env.DAILY_API_KEY, errorResponse: interviewApiError,
} as const;
const handlers = createInterviewMediaHandlers(dependencies);

export const interviewMediaHandlers = {
  ...handlers,
  ticket(request: Request, roundId: string) {
    return withInterviewMediaEvidence(
      (diagnostic) => createInterviewMediaHandlers({ ...dependencies, diagnostic }).ticket(request, roundId),
      request,
    );
  },
};
