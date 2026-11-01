import { interviewMediaHandlers } from '@/features/interviews/server/media';

export const dynamic = 'force-dynamic';
export const maxDuration = 60;
export async function POST(request: Request, context: { params: Promise<{ roundId: string }> }) {
  return interviewMediaHandlers.uploadAudio(request, (await context.params).roundId);
}
