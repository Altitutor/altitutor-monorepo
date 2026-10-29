import type { NextRequest } from 'next/server';
import { createClient } from '@/shared/lib/supabase/server-ssr';
import { submitTutorLog } from '@/features/tutor-logs/server/submit-tutor-log';

export function POST(request: NextRequest) {
  return submitTutorLog(request, createClient());
}
