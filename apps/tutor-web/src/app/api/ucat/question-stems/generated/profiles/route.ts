import { NextResponse } from 'next/server'
import type { Database } from '@altitutor/shared'
import type { SupabaseClient } from '@supabase/supabase-js'
import { requireUcatTutor } from '@/features/ucat/shared/server/guard'
import { getEnabledUcatAiProfiles, resolveUcatAiConfig } from '@/features/ucat/shared/server/ucat-ai-client'

export async function GET() {
  const access = await requireUcatTutor()
  if (!access.ok) return access.response

  const client = access.userClient as unknown as SupabaseClient<Database>
  const profiles = await getEnabledUcatAiProfiles(client)
  let maxRequestedStems = 20
  let maxCandidatesPerStem = 3
  try {
    const config = await resolveUcatAiConfig(client, profiles.find((profile) => profile.is_default)?.id ?? profiles[0]?.id ?? null)
    maxRequestedStems = config.settings.max_requested_stems_per_run
    maxCandidatesPerStem = config.settings.max_candidates_per_stem
  } catch {
    // Profiles endpoint should still render an empty/error-tolerant picker if settings are incomplete.
  }

  return NextResponse.json({
    profiles: profiles.map((profile) => ({
      id: profile.id,
      name: profile.name,
      model: profile.model,
      isDefault: profile.is_default,
      candidatesPerStem: profile.candidates_per_stem,
    })),
    settings: {
      maxRequestedStems,
      maxCandidatesPerStem,
    },
  })
}
