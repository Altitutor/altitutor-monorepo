import { captureApiError } from '@/lib/sentry/capture-api-error';
import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/shared/lib/supabase/server-ssr';
import { z } from 'zod';

const bodySchema = z.object({
  fileId: z.string().uuid(),
  copies: z.number().int().min(1).max(20).default(1),
});

/**
 * POST /api/print-jobs
 * Tutor enqueue for office print (RPC policy + write-via-API convention).
 */
export async function POST(request: NextRequest): Promise<NextResponse> {
  try {
    const parsed = bodySchema.safeParse(await request.json());
    if (!parsed.success) {
      return NextResponse.json(
        { error: 'Invalid body', details: parsed.error.flatten() },
        { status: 400 }
      );
    }

    const userClient = createClient();
    const { data: isTutor, error: tutorCheckError } = await userClient.rpc('is_tutor');
    if (tutorCheckError) {
      captureApiError(tutorCheckError, '/api/print-jobs');
      return NextResponse.json({ error: 'Failed to verify tutor status' }, { status: 500 });
    }
    if (!isTutor) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 403 });
    }

    const { data, error } = await userClient.rpc('enqueue_print_job' as never, {
      p_file_id: parsed.data.fileId,
      p_copies: parsed.data.copies,
    } as never);

    if (error) {
      captureApiError(error, '/api/print-jobs');
      const message = error.message || 'Failed to enqueue print job';
      const status =
        message.includes('offline') ||
        message.includes('admin shift') ||
        message.includes('in progress') ||
        message.includes('Only PDF') ||
        message.includes('not available')
          ? 400
          : 500;
      return NextResponse.json({ error: message }, { status });
    }

    return NextResponse.json({ job: data }, { status: 201 });
  } catch (error: unknown) {
    captureApiError(error, '/api/print-jobs');
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
