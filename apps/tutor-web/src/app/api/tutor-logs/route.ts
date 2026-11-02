import type { NextRequest } from 'next/server';
import { createClient } from '@/shared/lib/supabase/server-ssr';
import { submitTutorLog } from '@/features/tutor-logs/server/submit-tutor-log';

export async function POST(request: NextRequest) {
  return submitTutorLog(request, await createClient());
}
