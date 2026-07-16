import { NextResponse } from 'next/server'
import type { Database } from '@altitutor/shared'
import type { SupabaseClient } from '@supabase/supabase-js'
import { requireUcatTutor } from '@/features/ucat/shared/server/guard'

export async function GET() {
  const access = await requireUcatTutor()
  if (!access.ok) return access.response

  const client = access.userClient as unknown as SupabaseClient<Database>
  const { data: staffId, error: staffError } = await client.rpc('current_tutor_id')
  if (staffError || typeof staffId !== 'string') {
    return NextResponse.json({ error: staffError?.message ?? 'Tutor profile not found' }, { status: 403 })
  }

  const { data, error } = await client
    .from('ucat_ai_generation_runs')
    .select('id,status,requested_stem_count,accepted_stem_count,discarded_stem_count,processed_stem_count,progress_step,progress_message,error_message,generated_stem_ids,created_at,completed_at,dismissed_at')
    .is('dismissed_at', null)
    .not('progress_step', 'is', null)
    .eq('created_by', staffId)
    .order('created_at', { ascending: false })
    .limit(5)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ runs: data ?? [] })
}
