import { NextResponse, type NextRequest } from 'next/server'
import type { Database } from '@altitutor/shared'
import type { SupabaseClient } from '@supabase/supabase-js'
import { requireUcatTutor } from '@/features/ucat/shared/server/guard'
import { getServiceRoleClient } from '@/shared/lib/supabase/service-role'
import { loadUcatCatalogAiReviewStatuses } from '@/features/ucat/questions/server/ai-assessment/catalog-status'

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/iu

export async function GET(request: NextRequest) {
  const access = await requireUcatTutor()
  if (!access.ok) return access.response
  const stemIds = [...new Set(request.nextUrl.searchParams.getAll('id'))]
    .filter((id) => UUID_PATTERN.test(id))
    .slice(0, 100)
  try {
    const statuses = await loadUcatCatalogAiReviewStatuses({
      admin: getServiceRoleClient(),
      tutorClient: access.userClient as unknown as SupabaseClient<Database>,
      stemIds,
    })
    return NextResponse.json({ statuses }, {
      headers: { 'Cache-Control': 'private, no-store' },
    })
  } catch (error) {
    console.error('Could not load UCAT AI review catalog statuses', error)
    return NextResponse.json({ error: 'Failed to load AI review statuses' }, { status: 500 })
  }
}
