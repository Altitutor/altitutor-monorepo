import { createInterviewMediaHandlers } from '@altitutor/shared/interviews/server';
import { resolveInterviewActor, createInterviewServiceClient, interviewApiError } from './context';

export const interviewMediaHandlers = createInterviewMediaHandlers({
  role: 'tutor', resolveActor: resolveInterviewActor, serviceClient: createInterviewServiceClient,
  apiKey: () => process.env.DAILY_API_KEY, errorResponse: interviewApiError,
});
