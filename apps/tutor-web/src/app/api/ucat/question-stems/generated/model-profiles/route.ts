import { NextResponse } from 'next/server'
import type { Database } from '@altitutor/shared'
import type { SupabaseClient } from '@supabase/supabase-js'
import { requireUcatTutor } from '@/features/ucat/shared/server/guard'
import {
  getEnabledUcatAiModelProfiles,
  resolveUcatAiConfig,
} from '@/features/ucat/shared/server/ucat-ai-client'

export async function GET() {
  const access = await requireUcatTutor()
  if (!access.ok) return access.response

  const client = access.userClient as unknown as SupabaseClient<Database>
  const modelProfiles = await getEnabledUcatAiModelProfiles(client, true)
  let maxRequestedStems = 20
  try {
    const config = await resolveUcatAiConfig(
      client,
      modelProfiles.find((profile) => profile.is_default)?.id ?? modelProfiles[0]?.id ?? null,
      true,
    )
    maxRequestedStems = config.settings.max_requested_stems_per_run
  } catch {
    // Keep the model picker renderable while configuration is incomplete.
  }

  return NextResponse.json({
    modelProfiles: modelProfiles.map((profile) => ({
      id: profile.id,
      name: profile.name,
      model: profile.model,
      isDefault: profile.is_default,
    })),
    settings: { maxRequestedStems },
  })
}
